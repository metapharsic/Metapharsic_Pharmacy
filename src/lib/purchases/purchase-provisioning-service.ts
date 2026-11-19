/**
 * Purchase Provisioning & Persistence Service
 *
 * Implements atomic database provisioning for confirmed purchase bills ingested
 * via the automated purchase bill scanner.
 *
 * Features:
 * - F11: Transactional Provisioning Service (atomic prisma.$transaction)
 * - F12: Purchase Record Persistence (Purchase status: RECEIVED & PurchaseItem records)
 * - F13: Collision-Safe Batch Upsert (@@unique([productId, batchNumber]) with reactivation of EXHAUSTED)
 * - F14: Free Quantity Bonus Stock Provisioning (billedQuantity + freeQuantity into usable stock)
 * - F15: CAS Branch Inventory Increments (@@unique([productId, branchId]))
 * - F16: Inventory Movement Audit Logging (type: 'IN', referenceType: 'PURCHASE')
 * - F17: Accounts Payable Ledger Posting (SupplierLedger credit liability)
 * - F18: Input Tax Credit (ITC) GST Posting (postGstTransactionForPurchase)
 */

import type { Prisma } from '@prisma/client'
import { z } from 'zod'

import prisma from '@/lib/db/prisma'
import { postGstTransactionForPurchase } from '@/lib/finance/gst-service'

// ─── Error Classes ──────────────────────────────────────────

export class UnreconciledTotalError extends Error {
  statusCode = 422
  constructor(message: string) {
    super(message)
    this.name = 'UnreconciledTotalError'
  }
}

export class ProvisioningValidationError extends Error {
  statusCode = 400
  constructor(message: string) {
    super(message)
    this.name = 'ProvisioningValidationError'
  }
}

// ─── Zod Schemas & Types ─────────────────────────────────────

export const commitPurchaseItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().optional(),
  packSize: z.string().optional(),
  hsnCode: z.string().optional(),
  isNewProduct: z.boolean().optional(),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  billedQuantity: z.number().min(0, 'Billed quantity must be non-negative'),
  freeQuantity: z.number().min(0).default(0).optional(),
  unitCost: z.number().min(0, 'Unit cost must be non-negative'),
  mrp: z.number().min(0, 'MRP must be non-negative'),
  ptr: z.number().min(0).optional(),
  tabsPerStrip: z.number().int().min(1).optional(),
  stripSellingPrice: z.number().min(0).optional(),
  tabletCost: z.number().min(0).optional(),
  tabletSellingPrice: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).default(0).optional(),
  taxPercent: z.number().min(0).max(100).default(0).optional(),
  taxAmount: z.number().min(0).default(0).optional(),
  totalAmount: z.number().min(0, 'Total amount must be non-negative'),
})

export const commitPurchasePayloadSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  supplierId: z.string().optional(),
  newSupplier: z
    .object({
      name: z.string().min(1, 'Supplier name is required'),
      gstin: z.string().optional(),
      pan: z.string().optional(),
      dlNumber: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
      bankIfsc: z.string().optional(),
      creditDays: z.number().optional(),
    })
    .optional(),
  supplierDetails: z
    .object({
      name: z.string().optional(),
      gstin: z.string().optional(),
      pan: z.string().optional(),
      dlNumber: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      bankName: z.string().optional(),
      bankAccount: z.string().optional(),
      bankIfsc: z.string().optional(),
      creditDays: z.number().optional(),
    })
    .optional(),
  paymentMethod: z
    .enum(['CASH', 'CARD', 'UPI', 'NETBANKING', 'CHEQUE', 'CREDIT'])
    .default('CREDIT')
    .optional(),
  paymentReference: z.string().optional(),
  amountPaid: z.number().min(0).optional(),
  creditDays: z.number().optional(),
  dueDate: z.string().optional(),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  items: z.array(commitPurchaseItemSchema).min(1, 'At least one line item is required'),
  subtotal: z.number(),
  discountAmount: z.number().default(0).optional(),
  taxAmount: z.number().default(0).optional(),
  roundOff: z.number().default(0).optional(),
  totalAmount: z.number(),
  notes: z.string().optional(),
  allowVarianceOverride: z.boolean().default(false).optional(),
  adminRiskAccepted: z.boolean().default(false).optional(),
  adminOverrideReason: z.string().optional(),
})

export type CommitPurchaseItem = z.infer<typeof commitPurchaseItemSchema>
export type CommitPurchasePayload = z.infer<typeof commitPurchasePayloadSchema>

// Cross-compatible aliases
export const confirmPurchaseBillSchema = commitPurchasePayloadSchema
export type ConfirmPurchaseBillInput = CommitPurchasePayload

export interface ProvisioningSessionUser {
  id: string
  name?: string
  role?: string
  roles?: string[]
  permissions?: string[]
}

export interface ProvisionPurchaseResult {
  success: boolean
  purchase: unknown
  purchaseId: string
  purchaseNumber: string
  itemsProvisioned: number
  totalItemsProvisioned: number
  totalUsableQty: number
  totalUnitsAdded: number
  totalAmount: number
  status: 'RECEIVED'
}

// ─── Transaction Client Contracts ───────────────────────────

export interface ProvisioningTxClient {
  supplier: {
    create?: (args: { data: Record<string, unknown> }) => Promise<{ id: string; outstandingBalance?: number }>
    findFirst?: (args: { where: Record<string, unknown> }) => Promise<{ id: string; outstandingBalance?: number } | null>
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ id: string; outstandingBalance?: number }>
  }
  hsnCode?: {
    upsert?: (args: Record<string, unknown>) => Promise<unknown>
  }
  product?: {
    findUnique?: (args: { where: Record<string, unknown> }) => Promise<{ id: string; name?: string; tabsPerStrip?: number | null } | null>
    findFirst?: (args: { where: Record<string, unknown> }) => Promise<{ id: string; name?: string; tabsPerStrip?: number | null } | null>
    create?: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
    update?: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>
  }
  purchase: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; purchaseNumber: string; totalAmount?: unknown }>
  }
  purchaseItem: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>
  }
  payment?: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
  }
  batch: {
    upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<{ id: string }>
  }
  inventory: {
    findUnique: (args: { where: Record<string, unknown> }) => Promise<{ id: string; availableQuantity: number } | null>
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
  }
  inventoryMovement: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
  supplierLedger: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
  gstTransaction?: {
    create?: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
  auditLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
}

export type ProvisioningPrismaClient = {
  $transaction?: (
    fn: (tx: ProvisioningTxClient) => Promise<ProvisionPurchaseResult>,
    options?: { timeout?: number }
  ) => Promise<ProvisionPurchaseResult>
} & Partial<ProvisioningTxClient>

// ─── Transactional Provisioning Implementation ───────────────

/**
 * Executes atomic purchase bill provisioning inside a prisma.$transaction.
 * Mutates Purchase, PurchaseItem, Batch, Inventory, InventoryMovement, Supplier,
 * SupplierLedger, GstTransaction, and AuditLog in a single atomic commit.
 */
export async function provisionPurchaseBill(
  payload: CommitPurchasePayload,
  sessionUser: ProvisioningSessionUser,
  customPrisma?: unknown
): Promise<ProvisionPurchaseResult> {
  // 1. Strict Schema Validation
  const parsed = commitPurchasePayloadSchema.parse(payload)

  // 2. Mathematical Reconciliation & Consistency Verification
  const itemTotalSum = parsed.items.reduce((acc, it) => acc + it.totalAmount, 0)
  const roundOff = parsed.roundOff || 0
  const taxAmount = parsed.taxAmount || 0
  const discountAmount = parsed.discountAmount || 0

  // Evaluate accounting variance tolerance across standard distributor combinations:
  // 1) Post-tax items with roundOff: Math.abs((itemTotalSum + roundOff) - parsed.totalAmount)
  // 2) Pre-tax items + tax + roundOff - discount: Math.abs((itemTotalSum + taxAmount + roundOff - discountAmount) - parsed.totalAmount)
  // 3) Direct item sum: Math.abs(itemTotalSum - parsed.totalAmount)
  const diff1 = Math.abs((itemTotalSum + roundOff) - parsed.totalAmount)
  const diff2 = Math.abs((itemTotalSum + taxAmount + roundOff - discountAmount) - parsed.totalAmount)
  const diff3 = Math.abs(itemTotalSum - parsed.totalAmount)
  const effectiveVariance = Math.min(diff1, diff2, diff3)

  const isVarianceExceeded = effectiveVariance > 2.0
  const isAdminUser = Boolean(
    sessionUser?.role === 'admin' ||
    sessionUser?.role === 'owner' ||
    sessionUser?.roles?.includes('admin') ||
    sessionUser?.roles?.includes('owner') ||
    sessionUser?.permissions?.includes('purchases:create')
  )
  const isOverrideAuthorized = Boolean(
    parsed.adminRiskAccepted ||
    parsed.allowVarianceOverride ||
    isAdminUser
  )

  if (isVarianceExceeded && !isOverrideAuthorized) {
    throw new UnreconciledTotalError(
      `Reconciliation Error: Bill total (₹${parsed.totalAmount.toFixed(2)}) does not match line item sum (₹${itemTotalSum.toFixed(2)}) within allowable ₹2.00 variance tolerance (variance: ₹${effectiveVariance.toFixed(2)}). Administrator override required to save at own risk.`
    )
  }

  // 3. Quantitative Integrity Verification
  for (const item of parsed.items) {
    const usable = item.billedQuantity + (item.freeQuantity || 0)
    if (usable <= 0) {
      throw new ProvisioningValidationError(
        `Validation Error: Line item for batch ${item.batchNumber} has no usable quantity`
      )
    }
  }

  const client = (customPrisma ?? prisma) as ProvisioningPrismaClient
  const userId = sessionUser?.id || 'system-user'

  const executeInTransaction = async (tx: ProvisioningTxClient): Promise<ProvisionPurchaseResult> => {
    // ── 0. Resolve effective organizationId from sessionUser or branch ──
    let effectiveOrgId: string | null = (sessionUser as any)?.organizationId || null
    if (!effectiveOrgId && parsed.branchId && (tx as any).branch?.findUnique) {
      try {
        const br = await (tx as any).branch.findUnique({
          where: { id: parsed.branchId },
          select: { organizationId: true },
        })
        if (br?.organizationId) effectiveOrgId = br.organizationId
      } catch {
        // Fallback gracefully
      }
    }

    // ── 1. Supplier Resolution / On-the-fly Upsert / Credential Update ──
    let supplierId = parsed.supplierId
    const supDetails = parsed.supplierDetails || parsed.newSupplier

    if (supplierId && supDetails) {
      // Update existing supplier with any newly provided credentials
      const updateData: Record<string, unknown> = {}
      if (effectiveOrgId) updateData.organizationId = effectiveOrgId
      if (supDetails.gstin) updateData.gstin = supDetails.gstin
      if (supDetails.pan) updateData.pan = supDetails.pan
      if (supDetails.dlNumber) updateData.dlNumber = supDetails.dlNumber
      if (supDetails.phone) updateData.phone = supDetails.phone
      if (supDetails.email) updateData.email = supDetails.email
      if (supDetails.address) updateData.address = supDetails.address
      if (supDetails.city) updateData.city = supDetails.city
      if (supDetails.state) updateData.state = supDetails.state
      if (supDetails.pincode) updateData.pincode = supDetails.pincode
      if (supDetails.bankName) updateData.bankName = supDetails.bankName
      if (supDetails.bankAccount) updateData.bankAccount = supDetails.bankAccount
      if (supDetails.bankIfsc) updateData.bankIfsc = supDetails.bankIfsc
      if (supDetails.creditDays) updateData.creditDays = supDetails.creditDays

      if (Object.keys(updateData).length > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: updateData,
        })
      }
    } else if (!supplierId && supDetails && tx.supplier.create) {
      const createdSupplier = await tx.supplier.create({
        data: {
          organizationId: effectiveOrgId,
          name: supDetails.name || 'Wholesale Pharma Distributor',
          gstin: supDetails.gstin || null,
          pan: supDetails.pan || null,
          dlNumber: supDetails.dlNumber || null,
          phone: supDetails.phone || null,
          email: supDetails.email || null,
          address: supDetails.address || null,
          city: supDetails.city || null,
          state: supDetails.state || null,
          pincode: supDetails.pincode || null,
          bankName: supDetails.bankName || null,
          bankAccount: supDetails.bankAccount || null,
          bankIfsc: supDetails.bankIfsc || null,
          creditDays: supDetails.creditDays || 30,
          isActive: true,
          outstandingBalance: 0,
        },
      })
      supplierId = createdSupplier.id
    }

    if (!supplierId) {
      // Look up fallback supplier or create if none exists
      const fallback = tx.supplier.findFirst
        ? await tx.supplier.findFirst({
            where: {
              isActive: true,
              ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
            },
          })
        : null
      if (fallback) {
        supplierId = fallback.id
      } else if (tx.supplier.create) {
        const createdFallback = await tx.supplier.create({
          data: {
            organizationId: effectiveOrgId,
            name: 'Default Wholesale Supplier',
            isActive: true,
            outstandingBalance: 0,
          },
        })
        supplierId = createdFallback.id
      } else {
        supplierId = 'supplier-default-01'
      }
    }

    // ── 2. Payment Terms & Financial Settlement Calculations ──
    const paymentMethod = parsed.paymentMethod || 'CREDIT'
    const isPaidImmediate = paymentMethod !== 'CREDIT'
    const amountPaid = isPaidImmediate
      ? parsed.amountPaid !== undefined
        ? parsed.amountPaid
        : parsed.totalAmount
      : parsed.amountPaid || 0
    const balanceDue = Math.max(0, Math.round((parsed.totalAmount - amountPaid) * 100) / 100)

    // ── 3. Persist Purchase Header Record ──
    const purchaseNumber = `PB-${Date.now()}`
    const parsedInvoiceDate = new Date(parsed.invoiceDate)
    const sanitizedInvoiceDate = isNaN(parsedInvoiceDate.getTime())
      ? new Date()
      : parsedInvoiceDate

    let purchaseNotes = parsed.notes || `Ingested via Automated Purchase Bill Scanner (${paymentMethod})`
    if (isVarianceExceeded && isOverrideAuthorized) {
      const adminName = sessionUser.name || sessionUser.id || 'Administrator'
      purchaseNotes += ` [ADMIN RISK OVERRIDE: Bill total of ₹${parsed.totalAmount.toFixed(2)} authorized at admin risk (line sum: ₹${itemTotalSum.toFixed(2)}, variance: ₹${effectiveVariance.toFixed(2)}) by ${adminName}]`
    }

    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        branchId: parsed.branchId,
        supplierId,
        invoiceNumber: parsed.invoiceNumber,
        invoiceDate: sanitizedInvoiceDate,
        purchaseDate: new Date(),
        receivedAt: new Date(),
        status: 'RECEIVED',
        subtotal: parsed.subtotal,
        discountAmount: parsed.discountAmount ?? 0,
        taxAmount: parsed.taxAmount ?? 0,
        totalAmount: parsed.totalAmount,
        amountPaid,
        balanceDue,
        createdById: userId,
        notes: purchaseNotes,
      },
    })

    // If payment was made immediately (UPI, CASH, CARD, NETBANKING, CHEQUE), log Payment
    if (amountPaid > 0 && tx.payment?.create) {
      try {
        await tx.payment.create({
          data: {
            purchaseId: purchase.id,
            supplierId,
            method: paymentMethod as any,
            amount: amountPaid,
            reference: parsed.paymentReference || `${paymentMethod} Settlement for Inv #${parsed.invoiceNumber}`,
            notes: `Auto payment settlement on purchase bill ingestion`,
            paymentDate: sanitizedInvoiceDate,
          },
        })
      } catch {
        // Fallback gracefully if payment table constraints differ
      }
    }

    let totalUnitsAdded = 0

    // ── 4. Line Item Provisioning, Product Auto-Catalog, Batch Upsert & Inventory ──
    for (let idx = 0; idx < parsed.items.length; idx++) {
      const item = parsed.items[idx]
      const totalUsableQty = item.billedQuantity + (item.freeQuantity || 0)
      totalUnitsAdded += totalUsableQty
      const batchNumberClean = item.batchNumber.trim().toUpperCase()
      const itemExpiry = new Date(item.expiryDate)
      const sanitizedExpiry = isNaN(itemExpiry.getTime()) ? new Date() : itemExpiry

      // Auto-create product in catalog if unmapped or isNewProduct
      let effectiveProductId = item.productId
      let existingProd = null
      const rawItemName = (item.productName || (item as unknown as Record<string, unknown>).rawDescription || (item as unknown as Record<string, unknown>).name || '').toString().trim()
      const cleanProductName = rawItemName || `Medicine-${batchNumberClean}`

      if (tx.product) {
        const isGeneratedId =
          !effectiveProductId ||
          effectiveProductId.startsWith('NEW_PRODUCT_') ||
          effectiveProductId.startsWith('prod-auto-') ||
          effectiveProductId.startsWith('item-') ||
          effectiveProductId === 'prod-default'

        // 1. If an actual database product ID was supplied (and NOT marked as new product),
        // verify that the product's name closely matches cleanProductName to avoid cross-product pollution
        if (!isGeneratedId && !item.isNewProduct && tx.product.findUnique) {
          const candidate = await tx.product.findUnique({ where: { id: effectiveProductId } })
          if (candidate && candidate.name) {
            const candName = candidate.name.trim().toLowerCase()
            const reqName = cleanProductName.toLowerCase()
            if (candName === reqName || candName.includes(reqName) || reqName.includes(candName)) {
              existingProd = candidate
            }
          }
        }

        // 2. If not matched by ID or if new item, check if product with this exact name already exists in catalog
        if (!existingProd && cleanProductName && tx.product.findFirst) {
          existingProd = await tx.product.findFirst({
            where: {
              name: {
                equals: cleanProductName,
                mode: 'insensitive',
              },
              ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
            },
          })
        }

        if (existingProd) {
          effectiveProductId = existingProd.id
          if (tx.product.update) {
            await tx.product.update({
              where: { id: effectiveProductId },
              data: {
                ...(effectiveOrgId && !(existingProd as any).organizationId ? { organizationId: effectiveOrgId } : {}),
                ...(item.tabsPerStrip ? { tabsPerStrip: item.tabsPerStrip } : {}),
                ...(item.stripSellingPrice ? { mrp: item.stripSellingPrice } : item.mrp ? { mrp: item.mrp } : {}),
                ...(item.unitCost ? { costPrice: item.unitCost } : {}),
                ...(item.ptr ? { ptr: item.ptr } : {}),
              },
            })
          }
        } else if (tx.product.create) {
          // Ensure HsnCode exists if provided to satisfy foreign key constraint
          let validHsnCode: string | null = null
          if (item.hsnCode && tx.hsnCode?.upsert) {
            const hsnClean = item.hsnCode.trim()
            await tx.hsnCode.upsert({
              where: { code: hsnClean },
              update: {},
              create: {
                code: hsnClean,
                description: `Pharmaceutical HSN ${hsnClean}`,
                gstRate: item.taxPercent || 12,
                cgstRate: (item.taxPercent || 12) / 2,
                sgstRate: (item.taxPercent || 12) / 2,
                igstRate: item.taxPercent || 12,
              },
            })
            validHsnCode = hsnClean
          }

          const createdProd = await tx.product.create({
            data: {
              organizationId: effectiveOrgId,
              name: cleanProductName || `Medicine-${batchNumberClean}`,
              sku: `SKU-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              hsnCode: validHsnCode,
              tabsPerStrip: item.tabsPerStrip ?? 10,
              packSize: item.packSize || (item.tabsPerStrip ? `${item.tabsPerStrip} Tablets` : '10 Tablets'),
              mrp: item.stripSellingPrice ?? item.mrp,
              ptr: item.ptr ?? item.unitCost,
              costPrice: item.unitCost,
              gstRate: item.taxPercent || 12,
              cgstRate: (item.taxPercent || 12) / 2,
              sgstRate: (item.taxPercent || 12) / 2,
              igstRate: item.taxPercent || 12,
              createdById: userId,
              isActive: true,
            },
          })
          effectiveProductId = createdProd.id
        }
      }

      // a. PurchaseItem record
      const purchaseItem = await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: effectiveProductId,
          orderedQuantity: item.billedQuantity,
          receivedQuantity: item.billedQuantity,
          freeQuantity: item.freeQuantity || 0,
          unitCost: item.unitCost,
          mrp: item.mrp,
          ptr: item.ptr ?? item.unitCost,
          discountPercent: item.discountPercent || 0,
          taxPercent: item.taxPercent || 0,
          taxAmount: item.taxAmount || 0,
          totalAmount: item.totalAmount,
          batchNumber: batchNumberClean,
          expiryDate: sanitizedExpiry,
        },
      })

      // b. Collision-Safe Batch Upsert on @@unique([productId, batchNumber])
      const batch = await tx.batch.upsert({
        where: {
          productId_batchNumber: {
            productId: effectiveProductId,
            batchNumber: batchNumberClean,
          },
        },
        create: {
          productId: effectiveProductId,
          batchNumber: batchNumberClean,
          expiryDate: sanitizedExpiry,
          purchasePrice: item.unitCost,
          mrp: item.stripSellingPrice ?? item.mrp,
          ptr: item.ptr ?? item.unitCost,
          quantity: totalUsableQty,
          status: 'ACTIVE',
          purchaseId: purchase.id,
          branchId: parsed.branchId,
        },
        update: {
          quantity: { increment: totalUsableQty },
          status: 'ACTIVE', // Automatically reactivates EXHAUSTED batches to ACTIVE
          purchasePrice: item.unitCost,
          mrp: item.stripSellingPrice ?? item.mrp,
          expiryDate: sanitizedExpiry,
        },
      })

      // Link batch back to purchaseItem
      await tx.purchaseItem.update({
        where: { id: purchaseItem.id },
        data: { batchId: batch.id },
      })

      // c. CAS Inventory Update on @@unique([productId, branchId])
      const currentInv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: effectiveProductId,
            branchId: parsed.branchId,
          },
        },
      })

      let inventoryId: string
      const quantityBefore = currentInv ? currentInv.availableQuantity : 0

      if (currentInv) {
        inventoryId = currentInv.id
        await tx.inventory.update({
          where: { id: currentInv.id },
          data: {
            totalQuantity: { increment: totalUsableQty },
            availableQuantity: { increment: totalUsableQty },
          },
        })
      } else {
        const createdInv = await tx.inventory.create({
          data: {
            productId: effectiveProductId,
            branchId: parsed.branchId,
            totalQuantity: totalUsableQty,
            availableQuantity: totalUsableQty,
            reservedQuantity: 0,
          },
        })
        inventoryId = createdInv.id
      }

      // d. Inventory Movement Audit Trail Logging
      await tx.inventoryMovement.create({
        data: {
          inventoryId,
          type: 'IN',
          quantity: totalUsableQty,
          quantityBefore,
          quantityAfter: quantityBefore + totalUsableQty,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          batchId: batch.id,
          notes: `Purchase bill auto-provision: Inv #${parsed.invoiceNumber}, Batch ${batchNumberClean}`,
          createdById: userId,
        },
      })
    }

    // ── 5. Accounts Payable & Supplier Ledger Posting ──
    if (supplierId) {
      // Step A: Post CREDIT for full invoice bill liability
      const supplierAfterBill = await tx.supplier.update({
        where: { id: supplierId },
        data: {
          outstandingBalance: { increment: parsed.totalAmount },
        },
      })

      await tx.supplierLedger.create({
        data: {
          supplierId,
          type: 'CREDIT',
          amount: parsed.totalAmount,
          balance: supplierAfterBill.outstandingBalance ?? parsed.totalAmount,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          description: `Purchase Bill Inv #${parsed.invoiceNumber} (${paymentMethod})`,
        },
      })

      // Step B: If immediate payment was recorded (CASH, UPI, CARD, etc.), post DEBIT settlement
      if (amountPaid > 0) {
        const supplierAfterPayment = await tx.supplier.update({
          where: { id: supplierId },
          data: {
            outstandingBalance: { decrement: amountPaid },
          },
        })

        await tx.supplierLedger.create({
          data: {
            supplierId,
            type: 'DEBIT',
            amount: amountPaid,
            balance: supplierAfterPayment.outstandingBalance ?? 0,
            referenceType: 'PAYMENT',
            referenceId: purchase.id,
            description: `${paymentMethod} Settlement for Inv #${parsed.invoiceNumber} (Ref: ${parsed.paymentReference || 'Direct'})`,
          },
        })
      }
    }

    // ── 5. Input Tax Credit (ITC) GST Posting ──
    try {
      if (typeof postGstTransactionForPurchase === 'function') {
        const gstResult = await postGstTransactionForPurchase(
          purchase.id,
          tx as unknown as Prisma.TransactionClient
        )
        if ((!gstResult || gstResult.length === 0) && tx.gstTransaction?.create) {
          await tx.gstTransaction.create({
            data: {
              type: 'INPUT',
              purchaseId: purchase.id,
              taxAmount: parsed.taxAmount ?? 0,
              invoiceNumber: parsed.invoiceNumber,
            },
          })
        }
      } else if (tx.gstTransaction?.create) {
        await tx.gstTransaction.create({
          data: {
            type: 'INPUT',
            purchaseId: purchase.id,
            taxAmount: parsed.taxAmount ?? 0,
            invoiceNumber: parsed.invoiceNumber,
          },
        })
      }
    } catch {
      if (tx.gstTransaction?.create) {
        await tx.gstTransaction.create({
          data: {
            type: 'INPUT',
            purchaseId: purchase.id,
            taxAmount: parsed.taxAmount ?? 0,
            invoiceNumber: parsed.invoiceNumber,
          },
        })
      }
    }

    // ── 6. Security Audit Log & Troubleshooting Stream ──
    try {
      await tx.auditLog.create({
        data: {
          action: isVarianceExceeded && isOverrideAuthorized
            ? 'PURCHASE_BILL_ADMIN_RISK_OVERRIDE'
            : 'PURCHASE_BILL_SCAN_CONFIRM',
          entity: 'Purchase',
          entityId: purchase.id,
          userId: userId !== 'system-user' ? userId : undefined,
          newData: {
            invoiceNumber: parsed.invoiceNumber,
            supplierId,
            branchId: parsed.branchId,
            organizationId: effectiveOrgId,
            itemCount: parsed.items.length,
            totalAmount: parsed.totalAmount,
            totalUnitsAdded,
            adminRiskAccepted: isOverrideAuthorized,
            reconciliationVariance: effectiveVariance,
            items: parsed.items.map((it) => ({
              productName: it.productName,
              batchNumber: it.batchNumber,
              billedQuantity: it.billedQuantity,
              mrp: it.mrp,
              unitCost: it.unitCost,
            })),
          },
          metadata: {
            branchId: parsed.branchId,
            organizationId: effectiveOrgId,
            invoiceNumber: parsed.invoiceNumber,
            supplierId,
            itemCount: parsed.items.length,
            totalAmount: parsed.totalAmount,
            totalUnitsAdded,
            adminRiskAccepted: isOverrideAuthorized,
            reconciliationVariance: effectiveVariance,
            overrideReason: parsed.adminOverrideReason || (isOverrideAuthorized ? 'Admin accepted discrepancy at own risk' : undefined),
            authorizedBy: (sessionUser as any)?.name || (sessionUser as any)?.id || 'Admin',
            operatorEmail: (sessionUser as any)?.email,
          },
        },
      })
    } catch (auditErr) {
      console.warn('[PurchaseAudit] Audit log creation warning:', auditErr)
    }

    return {
      success: true,
      purchase,
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      itemsProvisioned: parsed.items.length,
      totalItemsProvisioned: parsed.items.length,
      totalUsableQty: totalUnitsAdded,
      totalUnitsAdded,
      totalAmount: parsed.totalAmount,
      status: 'RECEIVED' as const,
    }
  }

  // Execute in single transaction with 15000ms timeout
  if (client.$transaction) {
    return await client.$transaction(executeInTransaction, { timeout: 15000 })
  }

  return await executeInTransaction(client as ProvisioningTxClient)
}
