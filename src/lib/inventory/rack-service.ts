// ─────────────────────────────────────────────────────────────
// Storage Rack & Box Management Service
// Provides first-class operations to Create, Modify, Rename,
// and Configure Storage Racks, Shelves, and Boxes in PostgreSQL.
// ─────────────────────────────────────────────────────────────
import type { LocationType, Prisma, StorageLocation } from '@prisma/client'

import prisma from '@/lib/db/prisma'

export interface CreateRackInput {
  rack: string
  shelf?: string
  box?: string
  branchId?: string | null
  type?: LocationType
  capacity?: number | null
  description?: string | null
}

export interface ModifyRackInput {
  oldRackName: string
  newRackName: string
  branchId?: string | null
  type?: LocationType
  description?: string | null
}

export interface DeleteRackInput {
  rackName: string
  branchId?: string | null
  targetRackName?: string | null // If specified, reassign products to this rack; otherwise unassign
}

/**
 * Create or provision a new Storage Rack, Shelf, and Box
 */
export async function createRack(input: CreateRackInput): Promise<StorageLocation> {
  const cleanRack = input.rack.trim().toUpperCase()
  const cleanShelf = input.shelf?.trim() || 'Shelf 1'
  const cleanBox = input.box?.trim() || 'Box 01'

  // Upsert storage location in database
  const loc = await prisma.storageLocation.upsert({
    where: {
      branchId_rack_shelf_box: {
        branchId: input.branchId ?? null as any,
        rack: cleanRack,
        shelf: cleanShelf,
        box: cleanBox,
      },
    },
    update: {
      type: input.type || 'GENERAL',
      capacity: input.capacity,
      description: input.description,
    },
    create: {
      branchId: input.branchId || null,
      rack: cleanRack,
      shelf: cleanShelf,
      box: cleanBox,
      type: input.type || 'GENERAL',
      capacity: input.capacity,
      description: input.description,
    },
  })

  return loc
}

/**
 * Modify / Rename an existing Rack across all storage locations and products
 */
export async function modifyRack(input: ModifyRackInput) {
  const oldName = input.oldRackName.trim().toUpperCase()
  const newName = input.newRackName.trim().toUpperCase()

  return prisma.$transaction(async (tx) => {
    // 1. Update all storage_locations matching old rack name
    await tx.storageLocation.updateMany({
      where: {
        rack: oldName,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      data: {
        rack: newName,
        ...(input.type ? { type: input.type } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    })

    // 2. Cascade rename in racks table
    await tx.rack.updateMany({
      where: {
        code: oldName,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      data: {
        code: newName,
      },
    })

    const matchingRacks = await tx.rack.findMany({
      where: { code: newName },
      select: { id: true },
    })

    const productCount = matchingRacks.length > 0
      ? await tx.product.count({ where: { rackId: { in: matchingRacks.map((r) => r.id) } } })
      : 0

    return {
      success: true,
      oldRack: oldName,
      newRack: newName,
      productsUpdated: productCount,
    }
  })
}

/**
 * Delete a Rack — either unassigns products or moves them to a target rack
 */
export async function deleteRack(input: DeleteRackInput) {
  const cleanRack = input.rackName.trim().toUpperCase()
  const targetRack = input.targetRackName?.trim().toUpperCase() || null

  return prisma.$transaction(async (tx) => {
    // 1. Find all rack records matching cleanRack
    const oldRacks = await tx.rack.findMany({
      where: {
        code: cleanRack,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      select: { id: true },
    })
    const oldRackIds = oldRacks.map((r) => r.id)

    let targetRackId: string | null = null
    if (targetRack) {
      const defaultBranch = await tx.branch.findFirst({ select: { id: true } })
      const branchId = input.branchId || defaultBranch?.id || 'default-branch'
      const targetRecord = await tx.rack.upsert({
        where: {
          branchId_code_shelfNumber: {
            branchId,
            code: targetRack,
            shelfNumber: 'S1',
          },
        },
        create: {
          branchId,
          code: targetRack,
          shelfNumber: 'S1',
        },
        update: {},
      })
      targetRackId = targetRecord.id
    }

    // 2. Reassign or unassign products
    let productUpdateCount = 0
    if (oldRackIds.length > 0) {
      const updateRes = await tx.product.updateMany({
        where: { rackId: { in: oldRackIds } },
        data: {
          rackId: targetRackId,
        },
      })
      productUpdateCount = updateRes.count
    }

    // 3. Delete storage locations and racks
    const deleteCount = await tx.storageLocation.deleteMany({
      where: {
        rack: cleanRack,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
    })

    await tx.rack.deleteMany({
      where: {
        code: cleanRack,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
    })

    return {
      success: true,
      deletedRack: cleanRack,
      locationsRemoved: deleteCount.count,
      productsReassigned: productUpdateCount,
      newRack: targetRack,
    }
  })
}

/**
 * List all defined racks and storage locations
 */
export async function getStorageLocations(branchId?: string) {
  return prisma.storageLocation.findMany({
    where: branchId ? { branchId } : undefined,
    orderBy: [{ rack: 'asc' }, { shelf: 'asc' }, { box: 'asc' }],
  })
}

// ─── Box CRUD Operations ──────────────────────────────────────

export interface CreateBoxInput {
  branchId?: string | null
  rack: string
  shelf: string
  box: string
  capacity?: number | null
  description?: string | null
  type?: LocationType
}

export interface ModifyBoxInput {
  branchId?: string | null
  rack: string
  shelf: string
  oldBoxName: string
  newBoxName: string
  capacity?: number | null
  description?: string | null
}

export interface DeleteBoxInput {
  branchId?: string | null
  rack: string
  shelf: string
  boxName: string
  targetBoxName?: string | null
}

export async function createBox(input: CreateBoxInput) {
  const cleanRack = input.rack.trim().toUpperCase()
  const cleanShelf = input.shelf.trim()
  const cleanBox = input.box.trim()

  return prisma.storageLocation.upsert({
    where: {
      branchId_rack_shelf_box: {
        branchId: input.branchId ?? (null as any),
        rack: cleanRack,
        shelf: cleanShelf,
        box: cleanBox,
      },
    },
    update: {
      capacity: input.capacity,
      description: input.description,
      type: input.type || undefined,
    },
    create: {
      branchId: input.branchId || null,
      rack: cleanRack,
      shelf: cleanShelf,
      box: cleanBox,
      capacity: input.capacity,
      description: input.description,
      type: input.type || 'GENERAL',
    },
  })
}

export async function modifyBox(input: ModifyBoxInput) {
  const cleanRack = input.rack.trim().toUpperCase()
  const cleanShelf = input.shelf.trim()
  const oldBox = input.oldBoxName.trim()
  const newBox = input.newBoxName.trim()

  return prisma.$transaction(async (tx) => {
    // 1. Update storageLocation
    await tx.storageLocation.updateMany({
      where: {
        rack: cleanRack,
        shelf: cleanShelf,
        box: oldBox,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
      data: {
        box: newBox,
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    })

    return {
      success: true,
      rack: cleanRack,
      shelf: cleanShelf,
      oldBox,
      newBox,
      productsUpdated: 0,
    }
  })
}

export async function deleteBox(input: DeleteBoxInput) {
  const cleanRack = input.rack.trim().toUpperCase()
  const cleanShelf = input.shelf.trim()
  const cleanBox = input.boxName.trim()
  const targetBox = input.targetBoxName?.trim() || null

  return prisma.$transaction(async (tx) => {
    // Delete storageLocation entry
    const deleteCount = await tx.storageLocation.deleteMany({
      where: {
        rack: cleanRack,
        shelf: cleanShelf,
        box: cleanBox,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      },
    })

    return {
      success: true,
      deletedBox: cleanBox,
      locationsRemoved: deleteCount.count,
      productsReassigned: 0,
      targetBox,
    }
  })
}

export async function assignProductToBox(
  productId: string,
  location: { rack: string; shelf?: string | null; box?: string | null }
) {
  const cleanRack = location.rack.trim().toUpperCase()
  const cleanShelf = location.shelf?.trim() || '1'
  const cleanBox = location.box?.trim() || 'Box 01'

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, inventory: { select: { branchId: true }, take: 1 } },
  })
  const branchId = product?.inventory?.[0]?.branchId || 'default-branch'

  // Upsert rack
  const existingRack = await prisma.rack.findFirst({
    where: { branchId, code: cleanRack },
  })
  const rackId = existingRack?.id || (await prisma.rack.create({
    data: {
      branchId,
      code: cleanRack,
      shelfNumber: cleanShelf,
      description: `Rack ${cleanRack}`,
    },
  })).id

  // Create or record in storageLocation
  await prisma.storageLocation.create({
    data: {
      branchId,
      rack: cleanRack,
      shelf: cleanShelf,
      box: cleanBox,
    },
  }).catch(() => null)

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      rackId,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      rackId: true,
      rack: { select: { code: true, shelfNumber: true } },
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    sku: updated.sku,
    rack: updated.rack?.code ?? cleanRack,
    shelf: updated.rack?.shelfNumber ?? cleanShelf,
    box: cleanBox,
  }
}

export async function unassignProductFromBox(productId: string) {
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      rackId: null,
    },
    select: {
      id: true,
      name: true,
      sku: true,
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    sku: updated.sku,
    rack: null,
    shelf: null,
    box: null,
  }
}
