import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import {
  createBox,
  deleteBox,
  modifyBox,
} from '@/lib/inventory/rack-service'

// POST /api/inventory/boxes — Append / Create a new Box in a Shelf
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = await req.json()

    if (!body.rack || !body.shelf || !body.box) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION', message: 'rack, shelf, and box are required' },
        },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, body.branchId)

    const created = await createBox({
      branchId: branchId ?? undefined,
      rack: body.rack,
      shelf: body.shelf,
      box: body.box,
      capacity: body.capacity ? Number(body.capacity) : null,
      description: body.description,
      type: body.type,
    })

    return NextResponse.json({
      success: true,
      data: created,
      message: `Box "${created.box}" provisioned on ${created.rack} > ${created.shelf}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// PATCH /api/inventory/boxes — Rename / Update a Box (cascades to all contained products)
export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = await req.json()

    if (!body.rack || !body.shelf || !body.oldBoxName || !body.newBoxName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'rack, shelf, oldBoxName, and newBoxName are required',
          },
        },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, body.branchId)

    const result = await modifyBox({
      branchId: branchId ?? undefined,
      rack: body.rack,
      shelf: body.shelf,
      oldBoxName: body.oldBoxName,
      newBoxName: body.newBoxName,
      capacity: body.capacity !== undefined ? (body.capacity ? Number(body.capacity) : null) : undefined,
      description: body.description,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Box renamed to "${result.newBox}". Updated ${result.productsUpdated} products.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// DELETE /api/inventory/boxes — Delete a Box (unassigns or moves contained products)
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = await req.json()

    if (!body.rack || !body.shelf || !body.boxName) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION', message: 'rack, shelf, and boxName are required' },
        },
        { status: 400 }
      )
    }

    const branchId = await resolveBranchScope(user, body.branchId)

    const result = await deleteBox({
      branchId: branchId ?? undefined,
      rack: body.rack,
      shelf: body.shelf,
      boxName: body.boxName,
      targetBoxName: body.targetBoxName,
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Box "${result.deletedBox}" removed. ${result.productsReassigned} products reassigned.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
