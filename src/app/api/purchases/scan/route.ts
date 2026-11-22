import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { provisionPurchaseBill } from '@/lib/purchases/purchase-provisioning-service'
import { parsePurchaseBill } from '@/lib/scanner/purchase-bill-parser'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

function isAllowedFormat(mimeType: string, filename: string): boolean {
  if (!mimeType) return true
  const lowerMime = mimeType.toLowerCase()
  const lowerName = filename.toLowerCase()

  if (
    lowerMime.startsWith('image/') ||
    lowerMime.includes('pdf') ||
    lowerMime.includes('excel') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('csv') ||
    lowerMime.includes('text') ||
    lowerMime.includes('json') ||
    lowerMime === 'application/octet-stream'
  ) {
    return true
  }

  const allowedExtensions = [
    '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp', '.heic',
    '.xlsx', '.xls', '.csv', '.tsv', '.txt', '.json'
  ]
  return allowedExtensions.some((ext) => lowerName.endsWith(ext))
}

function getErrorStatus(message: string): number {
  if (message === 'Unauthorized') return 401
  if (message.startsWith('Forbidden')) return 403
  if (message.startsWith('Not Found')) return 404
  return 400
}

/**
 * POST /api/purchases/scan
 * Ingests a purchase bill document (PDF/Image), runs the multi-tier OCR & parsing pipeline,
 * resolves entities, and returns structured preview JSON with confidence and reconciliation metrics.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authorization check
    const sessionUser = await requirePermission(PERMISSIONS.PURCHASES_CREATE)

    // 2. Parse Multipart Form-Data
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORM_DATA',
            message: 'Failed to parse multipart/form-data request body',
          },
        },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null
    const branchId = (formData.get('branchId') as string | null) || undefined

    // 3. Validate File Presence
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_MISSING',
            message: 'No file provided in form-data field "file"',
          },
        },
        { status: 400 }
      )
    }

    // 4. Validate File Size (<= 15MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 15 MB`,
          },
        },
        { status: 400 }
      )
    }

    // 5. Validate Format Support (Universal: PDF, Images, Excel, CSV, JSON, TXT)
    const mimeType = file.type || 'application/octet-stream'
    if (!isAllowedFormat(mimeType, file.name || '')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_MIME_TYPE',
            message: `Unsupported file format: "${mimeType}". Supported: PDF, Images (PNG, JPG, WEBP, TIFF, BMP), Excel (XLSX, XLS), CSV, JSON, TXT`,
          },
        },
        { status: 400 }
      )
    }

    // 6. Convert file stream to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check mock flags (header, query parameter, or env)
    const isMock =
      req.headers.get('x-mock-scan') === 'true' ||
      req.nextUrl.searchParams.get('mock') === 'true'

    // 7. Execute Multi-Tier Hybrid Extraction Pipeline
    const parsedResult = await parsePurchaseBill(buffer, mimeType, {
      filename: file.name,
      branchId,
      organizationId: (sessionUser as { organizationId?: string }).organizationId,
      mock: isMock,
    })

    // 8. Auto-Provisioning to Inventory (using exact extracted names, rackId unassigned for chemist)
    const autoProvision =
      formData.get('autoProvision') === 'true' ||
      req.nextUrl.searchParams.get('autoProvision') === 'true'

    if (autoProvision && parsedResult.success && parsedResult.extractedData?.items?.length > 0) {
      try {
        let effectiveBranchId = branchId || (sessionUser as { branchId?: string }).branchId
        if (!effectiveBranchId) {
          const firstBranch = await prisma.branch.findFirst({
            where: {
              organizationId: sessionUser.organizationId || '__NO_ACCESS__',
              isActive: true,
            },
          })
          effectiveBranchId = firstBranch?.id
        }

        if (!effectiveBranchId) {
          console.warn('[PurchaseScan] Auto-provisioning skipped: no active branch found for organization')
          return NextResponse.json({
            ...parsedResult,
            autoProvisioned: false,
            message: 'Scan succeeded. Auto-provisioning skipped because no active branch was found for this organization.',
          })
        }

        await assertBranchAccess(sessionUser as any, effectiveBranchId)

        const supplierData = parsedResult.extractedData.supplier as unknown as Record<string, unknown>
        const supplierDataTyped = parsedResult.extractedData.supplier
        const supplierId = supplierDataTyped.matchedSupplierId || undefined
        const newSupplier = !supplierId
          ? {
              name: (supplierData.rawName as string | undefined)?.trim() || 'Wholesale Supplier',
              gstin: supplierData.gstin as string | undefined,
              pan: supplierData.pan as string | undefined,
              dlNumber: supplierData.dlNumber as string | undefined,
              phone: supplierData.phone as string | undefined,
              email: supplierData.email as string | undefined,
              address: supplierData.address as string | undefined,
              city: supplierData.city as string | undefined,
              state: supplierData.state as string | undefined,
              pincode: supplierData.pincode as string | undefined,
            }
          : undefined

        const items = parsedResult.extractedData.items.map((it, idx) => {
          const exactName = (it.rawDescription || it.matchedProductName || `Medicine-${idx + 1}`).trim()
          const cleanBatch = (it.batchNumber || `BAT-${Date.now().toString(36).toUpperCase()}-${idx}`).trim()
          const expDate = it.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0]
          const qty = it.billedQuantity > 0 ? it.billedQuantity : 1
          const taxPct = it.taxPercent || 0
          let cost = it.unitCost && it.unitCost > 0 ? it.unitCost : 0
          if (cost <= 0 && it.totalAmount && it.totalAmount > 0) {
            cost = Math.round((it.totalAmount / (qty * (1 + taxPct / 100))) * 100) / 100
          }
          let mrp = it.mrp && it.mrp > 0 ? it.mrp : cost > 0 ? Math.round(cost * 1.25 * 100) / 100 : 100
          if (cost <= 0 && mrp > 0) {
            cost = Math.round((mrp / 1.25) * 100) / 100
          }
          const totalAmt = it.totalAmount && it.totalAmount > 0 ? it.totalAmount : Math.round(qty * cost * (1 + taxPct / 100) * 100) / 100

          return {
            productId: it.matchedProductId || `NEW_PRODUCT_${idx}_${Date.now()}`,
            productName: exactName,
            packSize: it.packSize || '10 Tablets',
            hsnCode: it.hsnCode || undefined,
            isNewProduct: !it.matchedProductId,
            batchNumber: cleanBatch,
            expiryDate: expDate,
            billedQuantity: qty,
            freeQuantity: it.freeQuantity || 0,
            unitCost: cost,
            mrp: mrp,
            ptr: it.unitCost || cost,
            tabsPerStrip: 10,
            stripSellingPrice: mrp,
            discountPercent: it.discountPercent || 0,
            taxPercent: taxPct,
            taxAmount: it.taxAmount || 0,
            totalAmount: totalAmt,
          }
        })

        const invNumber = parsedResult.extractedData.invoice?.invoiceNumber?.trim() || `INV-${Date.now()}`
        const invDate = parsedResult.extractedData.invoice?.invoiceDate || new Date().toISOString().split('T')[0]
        const financials = parsedResult.extractedData.financials
        const itemSum = items.reduce((s, x) => s + x.totalAmount, 0)
        const subtotal = financials?.subtotal ?? itemSum
        const totalAmount =
          typeof financials?.totalAmount === 'number' && financials.totalAmount > 0
            ? financials.totalAmount
            : Math.round((itemSum + (financials?.roundOff || 0)) * 100) / 100

        const provisionResult = await provisionPurchaseBill(
          {
            branchId: effectiveBranchId,
            supplierId,
            newSupplier,
            paymentMethod: 'CREDIT',
            invoiceNumber: invNumber,
            invoiceDate: invDate,
            items,
            subtotal,
            discountAmount: financials?.discountAmount || 0,
            taxAmount: financials?.taxAmount || 0,
            roundOff: financials?.roundOff || 0,
            totalAmount,
            notes: 'Auto-provisioned on invoice scan using exact extracted names. Racks left unassigned for chemist design.',
            allowVarianceOverride: true,
            adminRiskAccepted: true,
            adminOverrideReason: 'Auto-provisioned on scan with Administrator authority',
          },
          {
            id: sessionUser.id,
            name: sessionUser.name ?? undefined,
            roles: sessionUser.roles,
            permissions: sessionUser.permissions,
          }
        )

        return NextResponse.json(
          {
            ...parsedResult,
            autoProvisioned: true,
            provisionResult,
            message: `Auto-provisioned ${items.length} items into inventory with exact extracted names. Racks left unassigned for chemist design.`,
          },
          { status: 200 }
        )
      } catch (autoErr: unknown) {
        const autoErrorMsg = autoErr instanceof Error ? autoErr.message : String(autoErr)
        console.warn('[POST /api/purchases/scan] Auto-provisioning note:', autoErr)

        try {
          await prisma.auditLog.create({
            data: {
              action: 'PURCHASE_SCAN_PROVISION_ERROR',
              entity: 'PurchaseScanner',
              userId: (sessionUser as any)?.id,
              metadata: {
                error: autoErrorMsg,
                filename: file.name,
                branchId: branchId || (sessionUser as any)?.branchId,
                organizationId: sessionUser.organizationId,
                supplierName: (parsedResult.extractedData?.supplier as any)?.rawName || (parsedResult.extractedData?.supplier as any)?.name,
                itemCount: parsedResult.extractedData?.items?.length,
                diagnostics: 'Failed to auto-provision scanned invoice into database inventory',
              },
            },
          })
        } catch {
          // Non-blocking
        }

        return NextResponse.json(
          {
            ...parsedResult,
            autoProvisioned: false,
            autoProvisionError: autoErrorMsg,
          },
          { status: 200 }
        )
      }
    }

    return NextResponse.json(parsedResult, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    const status = getErrorStatus(message)

    try {
      await prisma.auditLog.create({
        data: {
          action: 'PURCHASE_SCAN_ERROR',
          entity: 'PurchaseScanner',
          metadata: {
            error: message,
            diagnostics: 'Purchase bill OCR & document extraction pipeline failure',
          },
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'PARSING_FAILED',
          message,
        },
      },
      { status }
    )
  }
}
