import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import {
  createRack,
  deleteRack,
  getStorageLocations,
  modifyRack,
} from '@/lib/inventory/rack-service'

// GET /api/inventory/racks?branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)
    const { searchParams } = new URL(req.url)
    const rawBranchId = searchParams.get('branchId') || undefined
    const branchId = await resolveBranchScope(user, rawBranchId)

    const locations = await getStorageLocations(branchId ?? undefined)
    return NextResponse.json({ success: true, data: locations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/inventory/racks — Create / Provision a new Rack or Box
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = await req.json()

    if (!body.rack || typeof body.rack !== 'string' || !body.rack.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Rack name is required' } },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, body.branchId)

    const created = await createRack({
      rack: body.rack,
      shelf: body.shelf,
      box: body.box,
      branchId: branchId ?? undefined,
      type: body.type,
      capacity: body.capacity ? Number(body.capacity) : null,
      description: body.description,
    })

    return NextResponse.json({
      success: true,
      data: created,
      message: `Rack ${created.rack} provisioned successfully in storage locations.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// PATCH /api/inventory/racks — Rename / Modify Rack (cascades to all contained products)
export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = await req.json()

    if (!body.oldRackName || !body.newRackName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'oldRackName and newRackName are required' } },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, body.branchId)

    const result = await modifyRack({
      oldRackName: body.oldRackName,
      newRackName: body.newRackName,
      branchId: branchId ?? undefined,
      type: body.type,
      description: body.description,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Rack renamed from ${result.oldRack} to ${result.newRack}. Updated ${result.productsUpdated} products.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// DELETE /api/inventory/racks — Delete Rack & Reassign/Unassign Products
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = await req.json()

    if (!body.rackName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'rackName is required' } },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, body.branchId)

    const result = await deleteRack({
      rackName: body.rackName,
      branchId: branchId ?? undefined,
      targetRackName: body.targetRackName,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Rack ${result.deletedRack} deleted. ${result.productsReassigned} products reassigned.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
