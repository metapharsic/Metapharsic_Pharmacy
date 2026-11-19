import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { round2 } from '@/lib/sales/pricing'

export const dynamic = 'force-dynamic'

const scanDispenseSchema = z.object({
  branchId: z.string().optional(),
  productId: z.string().optional(),
  batchId: z.string().optional(),
  batchNumber: z.string().min(1, 'Batch number is required'),
  productName: z.string().min(1, 'Product name is required'),
  genericName: z.string().nullable().optional(),
  strength: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  expiryDate: z.string().optional(),
  mrp: z.number().positive('MRP must be positive'),
  tabsPerStrip: z.number().int().min(1).default(10),
  tabsCut: z.number().int().min(1, 'Must cut at least 1 tablet'),
  paymentMethod: z.enum(['UPI', 'CASH', 'CREDIT']).default('UPI'),
  paymentReference: z.string().optional(),
  cashTendered: z.number().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_CREATE)
    const body: unknown = await req.json()
    const input = scanDispenseSchema.parse(body)

    // 1. Resolve branch
    const branch = await prisma.branch.findFirst({
      where: input.branchId ? { id: input.branchId } : { isActive: true },
      select: { id: true, invoicePrefix: true, invoiceCounter: true },
    })
    const branchId = branch?.id ?? 'default-branch'

    // 2. Compute pro-rated cut tablet pricing
    const pricePerTab = round2(input.mrp / input.tabsPerStrip)
    const lineTotal = round2(input.tabsCut * pricePerTab)
    const gstRate = 12
    const baseAmount = round2(lineTotal / (1 + gstRate / 100))
    const gstAmount = round2(lineTotal - baseAmount)
    const changeAmount =
      input.paymentMethod === 'CASH' && input.cashTendered
        ? Math.max(0, round2(input.cashTendered - lineTotal))
        : 0

    const targetExpiry = input.expiryDate
      ? new Date(input.expiryDate)
      : new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000)

    // 3. Atomic Transaction for Cut-Strip Dispense & POS Bill
    const result = await prisma.$transaction(async (tx) => {
      // A. Resolve or create Product
      let productId = input.productId
      let prodSku = `SKU-${Date.now().toString().slice(-6)}`

      if (!productId) {
        const existingProd = await tx.product.findFirst({
          where: { name: { contains: input.productName.split(' ')[0], mode: 'insensitive' } },
        })
        if (existingProd) {
          productId = existingProd.id
          prodSku = existingProd.sku
        } else {
          const defaultCategory = await tx.category.findFirst({
            where: { isActive: true },
            select: { id: true },
          })
          const newProduct = await tx.product.create({
            data: {
              name: input.productName.trim(),
              genericName: input.genericName?.trim() || null,
              sku: prodSku,
              unitOfMeasure: 'Strip',
              tabsPerStrip: input.tabsPerStrip,
              mrp: input.mrp,
              drugSchedule: 'NONE',
              createdById: user.id,
              categories: defaultCategory
                ? { create: [{ categoryId: defaultCategory.id }] }
                : undefined,
            },
          })
          productId = newProduct.id
        }
      } else {
        const prod = await tx.product.findUnique({
          where: { id: productId },
          select: { sku: true },
        })
        if (prod) prodSku = prod.sku
      }

      const purchaseCost = round2(input.mrp * 0.72)

      // B. Resolve or upsert Batch
      const batch = await tx.batch.upsert({
        where: {
          productId_batchNumber: {
            productId,
            batchNumber: input.batchNumber.trim().toUpperCase(),
          },
        },
        create: {
          productId,
          batchNumber: input.batchNumber.trim().toUpperCase(),
          expiryDate: targetExpiry,
          mrp: input.mrp,
          purchasePrice: purchaseCost,
          quantity: 50, // default receiving buffer if new
          soldQuantity: 1,
          status: 'ACTIVE',
          branchId,
        },
        update: {
          soldQuantity: { increment: 1 },
        },
      })

      // C. Deduct branch aggregate Inventory
      const inventory = await tx.inventory.upsert({
        where: {
          productId_branchId: {
            productId,
            branchId,
          },
        },
        create: {
          productId,
          branchId,
          totalQuantity: 49,
          availableQuantity: 49,
        },
        update: {
          totalQuantity: { decrement: 1 },
          availableQuantity: { decrement: 1 },
        },
      })

      // D. Generate sequential Invoice Number
      const nextCounter = (branch?.invoiceCounter ?? 1000) + 1
      if (branch) {
        await tx.branch.update({
          where: { id: branch.id },
          data: { invoiceCounter: nextCounter },
        })
      }
      const prefix = branch?.invoicePrefix ?? 'INV'
      const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(nextCounter).padStart(5, '0')}`

      // E. Resolve or create Customer if provided
      let customerId: string | null = null
      if (input.customerName) {
        let customer = input.customerPhone
          ? await tx.customer.findFirst({
              where: { phone: input.customerPhone },
            })
          : null

        if (!customer) {
          customer = await tx.customer.create({
            data: {
              name: input.customerName.trim(),
              phone: input.customerPhone?.trim() || `98${Date.now().toString().slice(-8)}`,
              creditLimit: 5000,
            },
          })
        }
        customerId = customer.id
      }

      // F. Create official Sale record
      const paymentStatus = input.paymentMethod === 'CREDIT' ? 'CREDIT' : 'PAID'
      const sale = await tx.sale.create({
        data: {
          branchId,
          invoiceNumber,
          saleDate: new Date(),
          status: 'COMPLETED',
          paymentStatus,
          subtotal: baseAmount,
          taxAmount: gstAmount,
          totalAmount: lineTotal,
          customerId,
          notes:
            input.notes ||
            `Touchscreen Cut-Strip Dispense: ${input.tabsCut}/${input.tabsPerStrip} tabs cut from Batch ${batch.batchNumber}`,
          createdById: user.id,
        },
      })

      // G. Create SaleItem record with itemBatches relation
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId,
          productName: input.productName,
          productSku: prodSku,
          quantity: input.tabsCut,
          unitPrice: pricePerTab,
          mrp: input.mrp,
          discountPercent: 0,
          discountAmount: 0,
          taxPercent: gstRate,
          taxAmount: gstAmount,
          totalAmount: lineTotal,
          itemBatches: {
            create: [
              {
                batchId: batch.id,
                quantity: input.tabsCut,
                unitPrice: pricePerTab,
              },
            ],
          },
        },
      })

      // H. Create Payment record
      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          method: input.paymentMethod,
          amount: lineTotal,
          reference:
            input.paymentReference ||
            (input.paymentMethod === 'UPI' ? `UPI-${Date.now().toString().slice(-8)}` : null),
          notes: `Dispensed by user ${user.id}`,
        },
      })

      // I. Log Inventory Movement audit record
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'OUT',
          quantity: 1,
          quantityBefore: inventory.totalQuantity + 1,
          quantityAfter: inventory.totalQuantity,
          referenceType: 'TOUCHSCREEN_DISPENSE',
          referenceId: sale.id,
          batchId: batch.id,
          notes: `Touchscreen Dispense: ${input.tabsCut} tabs of ${input.productName} (Batch ${batch.batchNumber}) via ${input.paymentMethod}`,
          createdById: user.id,
        },
      })

      return {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        productName: input.productName,
        genericName: input.genericName,
        strength: input.strength,
        batchNumber: batch.batchNumber,
        expiryDate: targetExpiry.toISOString().slice(0, 10),
        tabsPerStrip: input.tabsPerStrip,
        tabsCut: input.tabsCut,
        pricePerTab,
        lineTotal,
        gstAmount,
        paymentMethod: input.paymentMethod,
        paymentReference: payment.reference,
        cashTendered: input.cashTendered,
        changeAmount,
        customerName: input.customerName || 'Walk-in Patient',
        remainingStock: inventory.availableQuantity,
        createdAt: sale.saleDate.toISOString(),
        branch: {
          name: 'METAPHARSIC PHARMACARE & HEALTHCARE',
          legalName: 'Metapharsic Healthcare Solutions Pvt. Ltd.',
          address: '123, Healthcare Complex, Medical Square, Health Nagar',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          phone: '+91 98765 43210 / 080-23456789',
          email: 'billing@metapharsic.com',
          gstin: '29ABCDE1234F1Z5',
          dlNumber: 'DL-20B-KA-12345 / DL-21B-KA-67890',
          fssaiNumber: '11524000000123',
          regPharmacist: 'R.Ph. Anita Roy (Reg. No: 129482)',
        },
      }
    })

    return NextResponse.json({
      success: true,
      message: `Dispensed ${input.tabsCut} tablets of ${input.productName}. Bill ${result.invoiceNumber} prepared.`,
      data: result,
    })
  } catch (err: unknown) {
    console.error('Scan-dispense failed:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: err.errors[0]?.message || 'Validation error' } },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Failed to dispense and bill cut-strip'
    return NextResponse.json({ success: false, error: { message } }, { status: 400 })
  }
}
