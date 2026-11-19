import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { prisma } from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'

// GET /api/inventory/adjustments/context?productId=&branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')
    const reqBranchId = searchParams.get('branchId')

    if (!productId) {
      return NextResponse.json(
        { success: false, error: { message: 'productId is required' } },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, reqBranchId || undefined)

    // 1. Fetch Product with storage coordinates and pricing
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        rack: true,
        unitOfMeasure: true,
        mrp: true,
        costPrice: true,
        ptr: true,
        reorderLevel: true,
        isActive: true,
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: { message: 'Product not found' } },
        { status: 404 }
      )
    }

    // 2. Fetch Inventory for branch
    const inventory = branchId
      ? await prisma.inventory.findUnique({
          where: { productId_branchId: { productId, branchId } },
          select: {
            availableQuantity: true,
            totalQuantity: true,
            reservedQuantity: true,
            updatedAt: true,
          },
        })
      : null

    // 3. Fetch active batches with vendor/supplier details
    const batches = await prisma.batch.findMany({
      where: {
        productId,
        status: 'ACTIVE',
        branchId: branchId || undefined,
      },
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        quantity: true,
        reservedQuantity: true,
        purchasePrice: true,
        mrp: true,
        purchase: {
          select: {
            supplier: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    })

    const now = Date.now()
    const enrichedBatches = batches.map((b) => {
      const expTime = new Date(b.expiryDate).getTime()
      const daysToExpiry = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24))
      const isExpired = daysToExpiry <= 0
      const isNearExpiry = daysToExpiry <= 90 && !isExpired

      return {
        id: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        daysToExpiry,
        isExpired,
        isNearExpiry,
        quantity: b.quantity,
        purchasePrice: Number(b.purchasePrice),
        mrp: Number(b.mrp),
        supplier: (b.purchase?.supplier || (b as any).supplier || null),
      }
    })

    // 4. Inactivity & Dead Stock Radar Calculation
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000)
    const [lastSaleItem, lastMovement] = await Promise.all([
      prisma.saleItem.findFirst({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      inventory
        ? prisma.inventoryMovement.findFirst({
            where: {
              inventory: { productId, branchId: branchId || undefined },
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
        : null,
    ])

    const lastActivityTime = Math.max(
      lastSaleItem?.createdAt ? new Date(lastSaleItem.createdAt).getTime() : 0,
      lastMovement?.createdAt ? new Date(lastMovement.createdAt).getTime() : 0,
      inventory?.updatedAt ? new Date(inventory.updatedAt).getTime() : 0
    )

    const daysInactive = lastActivityTime > 0
      ? Math.max(0, Math.floor((now - lastActivityTime) / (1000 * 60 * 60 * 24)))
      : 999

    let deadStockStatus: 'HEALTHY' | 'SLOW_MOVING' | 'DEAD_STOCK' | 'OBSOLETE' = 'HEALTHY'
    if (daysInactive >= 180) deadStockStatus = 'OBSOLETE'
    else if (daysInactive >= 90) deadStockStatus = 'DEAD_STOCK'
    else if (daysInactive >= 60) deadStockStatus = 'SLOW_MOVING'

    // Formulate Chemist Assistance Recommendation
    const recommendations: string[] = []
    const rackCode = product.rack?.code || null
    const shelfNum = product.rack?.shelfNumber || null
    if (rackCode || shelfNum) {
      const locStr = [
        rackCode ? `Rack ${rackCode}` : null,
        shelfNum ? `Shelf ${shelfNum}` : null,
      ].filter(Boolean).join(' > ')
      recommendations.push(`Physical location: ${locStr}`)
    } else {
      recommendations.push('Physical location: Not assigned to any Rack/Box yet.')
    }

    const nearExpiryBatches = enrichedBatches.filter((b) => b.isNearExpiry || b.isExpired)
    if (nearExpiryBatches.length > 0) {
      const earliest = nearExpiryBatches[0]
      recommendations.push(
        `Critical Expiry: Batch ${earliest.batchNumber} expires in ${earliest.daysToExpiry} days (${earliest.daysToExpiry <= 0 ? 'EXPIRED' : 'Near Expiry'}). ${
          earliest.supplier ? `Supplier: ${earliest.supplier.name} - consider return voucher.` : ''
        }`
      )
    }

    if (deadStockStatus !== 'HEALTHY') {
      recommendations.push(
        `Dead Stock Warning: Inactive for ${daysInactive} days (${deadStockStatus.replace('_', ' ')}). Re-verify physical count in storage.`
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitOfMeasure: product.unitOfMeasure,
          rack: product.rack?.code ?? null,
          shelf: product.rack?.shelfNumber ?? null,
          box: null,
          mrp: Number(product.mrp),
          costPrice: product.costPrice ? Number(product.costPrice) : Number(product.mrp) * 0.7,
        },
        inventory: {
          availableQuantity: inventory?.availableQuantity ?? 0,
          totalQuantity: inventory?.totalQuantity ?? 0,
          reservedQuantity: inventory?.reservedQuantity ?? 0,
        },
        batches: enrichedBatches,
        deadStock: {
          daysInactive,
          status: deadStockStatus,
          isDeadStock: deadStockStatus !== 'HEALTHY',
          lastActivityDate: lastActivityTime > 0 ? new Date(lastActivityTime).toISOString() : null,
        },
        recommendations,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}
