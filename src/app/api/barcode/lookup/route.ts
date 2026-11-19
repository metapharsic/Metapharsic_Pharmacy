import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import type { PosCartLine } from '@/lib/stores/pos-cart-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/barcode/lookup?barcode=&branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    let orgId = user.organizationId || undefined

    try {
      const { getTenantContext } = await import('@/lib/auth/tenant-context')
      const tenant = await getTenantContext(req)
      if (tenant?.organizationId) orgId = tenant.organizationId
    } catch {
      // In mocked test environment fallback
    }

    const canAccess =
      user.permissions.includes(PERMISSIONS.PRODUCTS_READ) ||
      user.permissions.includes(PERMISSIONS.INVENTORY_READ) ||
      user.permissions.includes(PERMISSIONS.SALES_CREATE) ||
      user.permissions.includes(PERMISSIONS.SALES_READ)

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized to scan or look up products' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const rawBarcode = searchParams.get('barcode')?.trim()
    const reqBranchId = searchParams.get('branchId')?.trim()

    if (!rawBarcode) {
      return NextResponse.json(
        { success: false, error: { message: 'Barcode is required' } },
        { status: 400 }
      )
    }

    const branchScope = await resolveBranchScope(user, reqBranchId || undefined)

    // 1. Find product matching exact barcode, additional barcodes, SKU, or ID (tenant-scoped)
    let product = await prisma.product.findFirst({
      where: {
        isActive: true,
        ...(orgId ? { organizationId: orgId } : {}),
        OR: [
          { barcode: { equals: rawBarcode, mode: 'insensitive' } },
          { barcodes: { some: { barcode: { equals: rawBarcode, mode: 'insensitive' } } } },
          { sku: { equals: rawBarcode, mode: 'insensitive' } },
          { id: rawBarcode },
        ],
      },
      include: {
        categories: { take: 1, select: { category: { select: { name: true } } } },
        barcodes: { select: { barcode: true } },
        rack: true,
      },
    })

    // If no exact match, fallback to contains match (tenant-scoped)
    if (!product) {
      product = await prisma.product.findFirst({
        where: {
          isActive: true,
          ...(orgId ? { organizationId: orgId } : {}),
          OR: [
            { barcode: { contains: rawBarcode, mode: 'insensitive' } },
            { barcodes: { some: { barcode: { contains: rawBarcode, mode: 'insensitive' } } } },
            { sku: { contains: rawBarcode, mode: 'insensitive' } },
            { name: { contains: rawBarcode, mode: 'insensitive' } },
          ],
        },
        include: {
          categories: { take: 1, select: { category: { select: { name: true } } } },
          barcodes: { select: { barcode: true } },
          rack: true,
        },
      })
    }

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `No product found matching barcode or SKU "${rawBarcode}"`,
          },
        },
        { status: 404 }
      )
    }

    // 2. Fetch inventory and active FEFO batches for the branch
    const branchId = branchScope || user.branchId || null

    let inventory = null
    let batches: Array<{
      id: string
      batchNumber: string
      expiryDate: Date
      quantity: number
      availableQuantity: number
      mrp: unknown
      status: string
      isNearExpiry: boolean
      isFefoFirst: boolean
    }> = []

    if (branchId) {
      const invRecord = await prisma.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: product.id,
            branchId,
          },
        },
        include: { branch: { select: { id: true, name: true, code: true } } },
      })

      if (invRecord) {
        inventory = {
          totalQuantity: invRecord.totalQuantity,
          availableQuantity: invRecord.availableQuantity,
          reservedQuantity: invRecord.reservedQuantity,
          branch: invRecord.branch,
        }
      }

      const rawBatches = await prisma.batch.findMany({
        where: {
          branchId,
          productId: product.id,
          status: 'ACTIVE',
          quantity: { gt: 0 },
          expiryDate: { gt: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
      })

      const now = Date.now()
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

      batches = rawBatches.map((b, index) => {
        const available = Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity)
        return {
          id: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          quantity: b.quantity,
          availableQuantity: available,
          mrp: Number(b.mrp),
          status: b.status,
          isNearExpiry: b.expiryDate.getTime() - now <= ninetyDaysMs,
          isFefoFirst: index === 0,
        }
      })
    }

    // 3. Recommended FEFO batch
    const activeBatches = batches.filter((b) => b.availableQuantity > 0)
    const fefoBatch = activeBatches[0] || null

    const availableQuantity = inventory?.availableQuantity ?? 0

    // 4. Construct standardized POS cart line item
    const posCartItem: PosCartLine = {
      productId: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      genericName: product.genericName,
      unitOfMeasure: product.unitOfMeasure,
      mrp: Number(fefoBatch?.mrp ?? product.mrp),
      gstRate: Number(product.gstRate),
      cgstRate: Number(product.cgstRate),
      sgstRate: Number(product.sgstRate),
      igstRate: Number(product.igstRate),
      hsnCode: product.hsnCode,
      drugSchedule: product.drugSchedule,
      isPrescriptionRequired: product.isPrescriptionRequired,
      isGstExempt: product.isGstExempt,
      quantity: 1,
      discountPercent: 0,
      availableQuantity,
      categoryName: product.categories[0]?.category.name || null,
      composition: product.composition,
      batchId: fefoBatch?.id,
      batchNumber: fefoBatch?.batchNumber,
      expiryDate: fefoBatch?.expiryDate ? new Date(fefoBatch.expiryDate).toISOString() : undefined,
    }

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          genericName: product.genericName,
          sku: product.sku,
          barcode: product.barcode,
          rack: product.rack
            ? product.rack.shelfNumber
              ? `${product.rack.code}-${product.rack.shelfNumber}`
              : product.rack.code
            : null,
          unitOfMeasure: product.unitOfMeasure,
          mrp: Number(product.mrp),
          composition: product.composition,
          manufacturer: product.manufacturer,
          drugSchedule: product.drugSchedule,
          isPrescriptionRequired: product.isPrescriptionRequired,
          categoryName: product.categories[0]?.category.name || null,
          additionalBarcodes: product.barcodes.map((b) => b.barcode),
        },
        inventory,
        batches,
        fefoBatch,
        posCartItem,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Barcode scan lookup failed'
    return NextResponse.json({ success: false, error: { message } }, { status: 500 })
  }
}
