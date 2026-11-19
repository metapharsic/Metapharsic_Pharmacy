import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { prisma } from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface PosSubstituteItem {
  id: string
  name: string
  genericName: string | null
  composition: string | null
  manufacturer: string | null
  unitOfMeasure: string
  rack: string | null
  mrp: number
  availableQuantity: number
  batch: {
    id: string
    batchNumber: string
    expiryDate: string
    mrp: number
    availableQuantity: number
  } | null
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const canAccess =
      user.permissions.includes(PERMISSIONS.PRODUCTS_READ) ||
      user.permissions.includes(PERMISSIONS.SALES_CREATE) ||
      user.permissions.includes(PERMISSIONS.SALES_READ)
    if (!canAccess) {
      throw new Error(`Forbidden: requires sales/product permissions`)
    }

    const { searchParams } = new URL(req.url)
    const genericName = searchParams.get('genericName')?.trim()
    const strength = searchParams.get('strength')?.trim()
    const excludeProductId = searchParams.get('excludeProductId')?.trim()
    const branchIdParam = searchParams.get('branchId')?.trim()

    const branchId = await resolveBranchScope(user, branchIdParam || undefined)
    if (!branchId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Branch is required' } },
        { status: 400 }
      )
    }

    if (!genericName) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Query active products sharing the generic name
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
        OR: [
          { genericName: { contains: genericName, mode: 'insensitive' } },
          { composition: { contains: genericName, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        genericName: true,
        composition: true,
        manufacturer: true,
        unitOfMeasure: true,
        rack: true,
        mrp: true,
      },
      take: 20,
    })

    const productIds = products.map((p) => p.id)

    // Fetch inventory for these products in the branch
    const [inventoryRows, batchRows] = await Promise.all([
      prisma.inventory.findMany({
        where: {
          branchId,
          productId: { in: productIds },
        },
        select: {
          productId: true,
          availableQuantity: true,
        },
      }),
      prisma.batch.findMany({
        where: {
          branchId,
          productId: { in: productIds },
          status: 'ACTIVE',
          quantity: { gt: 0 },
          expiryDate: { gt: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
        select: {
          id: true,
          productId: true,
          batchNumber: true,
          expiryDate: true,
          mrp: true,
          quantity: true,
          reservedQuantity: true,
          soldQuantity: true,
        },
      }),
    ])

    const invMap = new Map<string, number>()
    for (const inv of inventoryRows) {
      invMap.set(inv.productId, inv.availableQuantity)
    }

    const batchMap = new Map<string, typeof batchRows[0]>()
    for (const b of batchRows) {
      if (!batchMap.has(b.productId)) {
        batchMap.set(b.productId, b)
      }
    }

    // Map and filter items with available quantity > 0
    let results: PosSubstituteItem[] = products
      .map((p) => {
        const qty = invMap.get(p.id) ?? 0
        const b = batchMap.get(p.id)
        const batchAvail = b ? Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity) : 0
        return {
          id: p.id,
          name: p.name,
          genericName: p.genericName,
          composition: p.composition,
          manufacturer: p.manufacturer,
          unitOfMeasure: p.unitOfMeasure,
          rack: p.rack ? (p.rack.shelfNumber ? `${p.rack.code}-${p.rack.shelfNumber}` : p.rack.code) : null,
          mrp: b ? Number(b.mrp) : Number(p.mrp),
          availableQuantity: qty,
          batch: b
            ? {
                id: b.id,
                batchNumber: b.batchNumber,
                expiryDate: b.expiryDate.toISOString(),
                mrp: Number(b.mrp),
                availableQuantity: batchAvail,
              }
            : null,
        }
      })
      .filter((p) => p.availableQuantity > 0)

    // If strength is specified (e.g. "650mg"), prioritize exact strength matches
    if (strength) {
      const cleanStrength = strength.toLowerCase().replace(/\s+/g, '')
      results = results.sort((a, b) => {
        const aMatches =
          (a.name.toLowerCase() + ' ' + (a.composition || '')).replace(/\s+/g, '').includes(cleanStrength)
        const bMatches =
          (b.name.toLowerCase() + ' ' + (b.composition || '')).replace(/\s+/g, '').includes(cleanStrength)
        if (aMatches && !bMatches) return -1
        if (!aMatches && bMatches) return 1
        return b.availableQuantity - a.availableQuantity
      })
    } else {
      results.sort((a, b) => b.availableQuantity - a.availableQuantity)
    }

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: 400 }
    )
  }
}
