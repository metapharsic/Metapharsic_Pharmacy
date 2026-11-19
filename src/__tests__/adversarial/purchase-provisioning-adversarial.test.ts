/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { NextRequest } from 'next/server'

import { POST as commitPOST } from '@/app/api/purchases/scan/commit/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import {
  provisionPurchaseBill,
  UnreconciledTotalError,
  ProvisioningValidationError,
  type CommitPurchasePayload,
} from '@/lib/purchases/purchase-provisioning-service'

// ─── Auth Mocking ─────────────────────────────────────────────

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

const mockedPermission = requirePermission as jest.Mock

// ─── Transaction Mock Store Factory ───────────────────────────

function createAdversarialMockPrisma() {
  const store = {
    suppliers: new Map<string, any>(),
    purchases: new Map<string, any>(),
    purchaseItems: new Map<string, any>(),
    batches: new Map<string, any>(),
    inventories: new Map<string, any>(),
    inventoryMovements: [] as any[],
    supplierLedgers: [] as any[],
    gstTransactions: [] as any[],
    auditLogs: [] as any[],
  }

  // Pre-seed supplier
  store.suppliers.set('sup-adv-01', {
    id: 'sup-adv-01',
    name: 'Adversarial Test Supplier Ltd',
    gstin: '29ABCDE1234F1Z5',
    dlNumber: '20B/KA-ADV/11223',
    outstandingBalance: 5000.0,
    isActive: true,
  })

  // Pre-seed exhausted batch
  store.batches.set('prod-azithro-500_EXH-BATCH-01', {
    id: 'batch-azithro-exh',
    productId: 'prod-azithro-500',
    batchNumber: 'EXH-BATCH-01',
    quantity: 0,
    status: 'EXHAUSTED',
    purchasePrice: 95.0,
    mrp: 130.0,
    expiryDate: new Date('2026-12-31'),
  })

  // Pre-seed active batch with existing stock
  store.batches.set('prod-azithro-500_ACT-BATCH-02', {
    id: 'batch-azithro-act',
    productId: 'prod-azithro-500',
    batchNumber: 'ACT-BATCH-02',
    quantity: 15,
    status: 'ACTIVE',
    purchasePrice: 90.0,
    mrp: 125.0,
    expiryDate: new Date('2027-05-31'),
  })

  // Pre-seed existing branch inventory
  store.inventories.set('prod-azithro-500_branch-blr-adv', {
    id: 'inv-azithro-blr',
    productId: 'prod-azithro-500',
    branchId: 'branch-blr-adv',
    totalQuantity: 15,
    availableQuantity: 15,
    reservedQuantity: 0,
  })

  const tx = {
    supplier: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const record = { id, outstandingBalance: 0, ...data }
        store.suppliers.set(id, record)
        return record
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        for (const s of store.suppliers.values()) {
          if (!where || where.isActive === undefined || s.isActive === where.isActive) {
            return s
          }
        }
        return null
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const record = store.suppliers.get(where.id) || { id: where.id, outstandingBalance: 0 }
        if (data.outstandingBalance?.increment) {
          record.outstandingBalance += data.outstandingBalance.increment
        }
        store.suppliers.set(where.id, record)
        return record
      }),
    },
    purchase: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `purch-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const record = { id, ...data }
        store.purchases.set(id, record)
        return record
      }),
    },
    purchaseItem: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `pi-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const record = { id, ...data }
        store.purchaseItems.set(id, record)
        return record
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const record = store.purchaseItems.get(where.id) || { id: where.id }
        Object.assign(record, data)
        return record
      }),
    },
    batch: {
      upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => {
        const key = `${where.productId_batchNumber.productId}_${where.productId_batchNumber.batchNumber}`
        let record = store.batches.get(key)
        if (record) {
          if (update.quantity?.increment) {
            record.quantity += update.quantity.increment
          }
          if (update.status) {
            record.status = update.status
          }
          if (update.purchasePrice !== undefined) record.purchasePrice = update.purchasePrice
          if (update.mrp !== undefined) record.mrp = update.mrp
          if (update.expiryDate) record.expiryDate = update.expiryDate
        } else {
          record = { id: `batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...create }
          store.batches.set(key, record)
        }
        return record
      }),
    },
    inventory: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        const key = `${where.productId_branchId.productId}_${where.productId_branchId.branchId}`
        return store.inventories.get(key) || null
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        let found: any = null
        for (const v of store.inventories.values()) {
          if (v.id === where.id) {
            found = v
            break
          }
        }
        if (found) {
          if (data.totalQuantity?.increment) found.totalQuantity += data.totalQuantity.increment
          if (data.availableQuantity?.increment) found.availableQuantity += data.availableQuantity.increment
        }
        return found
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const key = `${data.productId}_${data.branchId}`
        const record = { id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...data }
        store.inventories.set(key, record)
        return record
      }),
    },
    inventoryMovement: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `mov-${Date.now()}`, ...data }
        store.inventoryMovements.push(record)
        return record
      }),
    },
    supplierLedger: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `sl-${Date.now()}`, ...data }
        store.supplierLedgers.push(record)
        return record
      }),
    },
    gstTransaction: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `gst-${Date.now()}`, ...data }
        store.gstTransactions.push(record)
        return record
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `audit-${Date.now()}`, ...data }
        store.auditLogs.push(record)
        return record
      }),
    },
  }

  const client = {
    ...tx,
    $transaction: jest.fn().mockImplementation(async (callback: any, _options?: any) => {
      // Snapshot state to emulate real atomic rollback
      const snapshot = {
        suppliers: new Map(Array.from(store.suppliers.entries()).map(([k, v]) => [k, { ...v }])),
        purchases: new Map(Array.from(store.purchases.entries()).map(([k, v]) => [k, { ...v }])),
        purchaseItems: new Map(Array.from(store.purchaseItems.entries()).map(([k, v]) => [k, { ...v }])),
        batches: new Map(Array.from(store.batches.entries()).map(([k, v]) => [k, { ...v }])),
        inventories: new Map(Array.from(store.inventories.entries()).map(([k, v]) => [k, { ...v }])),
        inventoryMovements: [...store.inventoryMovements],
        supplierLedgers: [...store.supplierLedgers],
        gstTransactions: [...store.gstTransactions],
        auditLogs: [...store.auditLogs],
      }

      try {
        return await callback(tx)
      } catch (err) {
        // Rollback state on failure
        store.suppliers = snapshot.suppliers
        store.purchases = snapshot.purchases
        store.purchaseItems = snapshot.purchaseItems
        store.batches = snapshot.batches
        store.inventories = snapshot.inventories
        store.inventoryMovements = snapshot.inventoryMovements
        store.supplierLedgers = snapshot.supplierLedgers
        store.gstTransactions = snapshot.gstTransactions
        store.auditLogs = snapshot.auditLogs
        throw err
      }
    }),
    _store: store,
  }

  return client
}

// ─── Adversarial Test Suite ───────────────────────────────────

describe('Adversarial Stress Test: Inventory Provisioning & Persistence Engine', () => {
  let mockPrisma: ReturnType<typeof createAdversarialMockPrisma>
  const testUser = {
    id: 'usr-pharmacist-adv',
    name: 'Adversarial Tester',
    role: 'pharmacist',
    permissions: ['purchases:create', 'purchases:read'],
  }

  beforeEach(() => {
    mockPrisma = createAdversarialMockPrisma()
    jest.clearAllMocks()
    mockedPermission.mockResolvedValue({
      id: 'usr-pharmacist-adv',
      name: 'Adversarial Tester',
      roles: ['PHARMACIST'],
      permissions: ['purchases:create'],
    })
  })

  // ═════════════════════════════════════════════════════════════
  // SECTION 1: Batch Upsert Collision & EXHAUSTED Reactivation
  // ═════════════════════════════════════════════════════════════

  describe('Section 1: Batch Upsert Collision & EXHAUSTED Reactivation', () => {
    it('ADV-1.1: Reactivates EXHAUSTED batch to ACTIVE and correctly increments stock by totalUsableQty (billed + free)', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-EXH-01',
        invoiceDate: '2026-11-03',
        subtotal: 3000.0,
        totalAmount: 3000.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'EXH-BATCH-01', // Pre-seeded EXHAUSTED batch with qty: 0
            expiryDate: '2028-12-31',
            billedQuantity: 30,
            freeQuantity: 3, // totalUsable = 33
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 3000.0,
          },
        ],
      }

      const preBatch = mockPrisma._store.batches.get('prod-azithro-500_EXH-BATCH-01')
      expect(preBatch.status).toBe('EXHAUSTED')
      expect(preBatch.quantity).toBe(0)

      const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

      expect(result.success).toBe(true)
      expect(result.totalUnitsAdded).toBe(33)

      const postBatch = mockPrisma._store.batches.get('prod-azithro-500_EXH-BATCH-01')
      expect(postBatch.status).toBe('ACTIVE')
      expect(postBatch.quantity).toBe(33)
      expect(postBatch.purchasePrice).toBe(100.0)
      expect(postBatch.mrp).toBe(140.0)
    })

    it('ADV-1.2: Re-orders an already ACTIVE batch, preserving ACTIVE status and adding totalUsableQty to existing stock', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-ACT-02',
        invoiceDate: '2026-11-03',
        subtotal: 2000.0,
        totalAmount: 2000.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'ACT-BATCH-02', // Pre-seeded ACTIVE batch with qty: 15
            expiryDate: '2028-05-31',
            billedQuantity: 20,
            freeQuantity: 2, // totalUsable = 22
            unitCost: 100.0,
            mrp: 135.0,
            totalAmount: 2000.0,
          },
        ],
      }

      const preBatch = mockPrisma._store.batches.get('prod-azithro-500_ACT-BATCH-02')
      expect(preBatch.status).toBe('ACTIVE')
      expect(preBatch.quantity).toBe(15)

      await provisionPurchaseBill(payload, testUser, mockPrisma)

      const postBatch = mockPrisma._store.batches.get('prod-azithro-500_ACT-BATCH-02')
      expect(postBatch.status).toBe('ACTIVE')
      expect(postBatch.quantity).toBe(15 + 22) // 37
      expect(postBatch.mrp).toBe(135.0)
    })

    it('ADV-1.3: Handles intra-invoice duplicate batch lines safely by sequentially accumulating stock', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-DUAL-LINE',
        invoiceDate: '2026-11-03',
        subtotal: 4000.0,
        totalAmount: 4000.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'MULTI-LINE-B1',
            expiryDate: '2028-10-31',
            billedQuantity: 10,
            freeQuantity: 1, // 11
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1000.0,
          },
          {
            productId: 'prod-azithro-500',
            batchNumber: 'MULTI-LINE-B1', // Same batch on second line
            expiryDate: '2028-10-31',
            billedQuantity: 30,
            freeQuantity: 0, // 30
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 3000.0,
          },
        ],
      }

      const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

      expect(result.success).toBe(true)
      expect(result.totalUnitsAdded).toBe(41) // 11 + 30

      const batch = mockPrisma._store.batches.get('prod-azithro-500_MULTI-LINE-B1')
      expect(batch).toBeDefined()
      expect(batch.quantity).toBe(41)
      expect(batch.status).toBe('ACTIVE')
    })

    it('ADV-1.4: Normalizes batch number whitespace and case (e.g. "  bat-001 " -> "BAT-001")', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-CASE-NORM',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        totalAmount: 1000.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: '  exh-batch-01  ', // Lowercase with surrounding whitespace
            expiryDate: '2028-12-31',
            billedQuantity: 10,
            freeQuantity: 0,
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1000.0,
          },
        ],
      }

      await provisionPurchaseBill(payload, testUser, mockPrisma)

      // Should have hit EXH-BATCH-01, reactivating it from 0 to 10
      const batch = mockPrisma._store.batches.get('prod-azithro-500_EXH-BATCH-01')
      expect(batch.status).toBe('ACTIVE')
      expect(batch.quantity).toBe(10)
    })
  })

  // ═════════════════════════════════════════════════════════════
  // SECTION 2: Atomic Rollback & All-or-Nothing Guarantee
  // ═════════════════════════════════════════════════════════════

  describe('Section 2: Atomic Rollback & All-or-Nothing Guarantee', () => {
    it('ADV-2.1: Rollback leaves database completely untouched if inventory update fails', async () => {
      mockPrisma.inventory.update.mockRejectedValueOnce(
        new Error('Prisma Deadlock: Transaction rolled back')
      )

      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-FAIL-INV',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        totalAmount: 1000.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'ACT-BATCH-02',
            expiryDate: '2028-05-31',
            billedQuantity: 10,
            unitCost: 100.0,
            mrp: 125.0,
            totalAmount: 1000.0,
          },
        ],
      }

      await expect(provisionPurchaseBill(payload, testUser, mockPrisma)).rejects.toThrow(
        'Prisma Deadlock: Transaction rolled back'
      )

      // Verify complete rollback in store
      expect(mockPrisma._store.purchases.size).toBe(0)
      expect(mockPrisma._store.purchaseItems.size).toBe(0)
      expect(mockPrisma._store.inventoryMovements.length).toBe(0)
      expect(mockPrisma._store.supplierLedgers.length).toBe(0)
      expect(mockPrisma._store.auditLogs.length).toBe(0)

      // Pre-existing batch and inventory must remain unmodified
      const batch = mockPrisma._store.batches.get('prod-azithro-500_ACT-BATCH-02')
      expect(batch.quantity).toBe(15) // Still 15, not 25!
      const inv = mockPrisma._store.inventories.get('prod-azithro-500_branch-blr-adv')
      expect(inv.availableQuantity).toBe(15) // Still 15!
    })

    it('ADV-2.2: Rollback leaves database untouched if supplier ledger posting fails', async () => {
      mockPrisma.supplierLedger.create.mockRejectedValueOnce(
        new Error('Foreign Key Violation on SupplierLedger')
      )

      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-FAIL-LEDGER',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        totalAmount: 1000.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'ACT-BATCH-02',
            expiryDate: '2028-05-31',
            billedQuantity: 10,
            unitCost: 100.0,
            mrp: 125.0,
            totalAmount: 1000.0,
          },
        ],
      }

      await expect(provisionPurchaseBill(payload, testUser, mockPrisma)).rejects.toThrow(
        'Foreign Key Violation on SupplierLedger'
      )

      expect(mockPrisma._store.purchases.size).toBe(0)
      expect(mockPrisma._store.inventoryMovements.length).toBe(0)
      const supplier = mockPrisma._store.suppliers.get('sup-adv-01')
      expect(supplier.outstandingBalance).toBe(5000.0) // Not incremented!
    })
  })

  // ═════════════════════════════════════════════════════════════
  // SECTION 3: Confirmation Barrier & Security Controls
  // ═════════════════════════════════════════════════════════════

  describe('Section 3: Confirmation Barrier & Security Controls', () => {
    const validHttpPayload = {
      branchId: 'branch-blr-adv',
      supplierId: 'sup-adv-01',
      invoiceNumber: 'INV-HTTP-SEC-01',
      invoiceDate: '2026-11-03',
      subtotal: 5000.0,
      totalAmount: 5000.0,
      items: [
        {
          productId: 'prod-azithro-500',
          batchNumber: 'SEC-B1',
          expiryDate: '2028-11-30',
          billedQuantity: 50,
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 5000.0,
        },
      ],
    }

    it('ADV-3.1: Rejects unauthenticated request with 401 Unauthorized', async () => {
      mockedPermission.mockRejectedValueOnce(new Error('Unauthorized'))

      const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validHttpPayload),
      })

      const res = await commitPOST(req)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('ADV-3.2: Rejects unauthorized user lacking purchases:create permission with 403 Forbidden', async () => {
      mockedPermission.mockRejectedValueOnce(
        new Error("Forbidden: requires permission 'purchases:create'")
      )

      const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validHttpPayload),
      })

      const res = await commitPOST(req)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('ADV-3.3: Rejects malformed JSON with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"tamperedJson: invalid',
      })

      const res = await commitPOST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('INVALID_JSON')
    })

    it('ADV-3.4a: Accepts small reconciliation variance within tolerance (<= Rs. 2.00)', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-TOLERANCE-PASS',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        totalAmount: 1001.8, // 1.80 variance from line total 1000.00
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'TOL-B1',
            expiryDate: '2028-11-30',
            billedQuantity: 10,
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1000.0,
          },
        ],
      }

      // Should not throw because |1000.0 - 1001.8| = 1.80 <= 2.0
      const result = await provisionPurchaseBill(payload, testUser, mockPrisma)
      expect(result.success).toBe(true)
    })

    it('ADV-3.4b: Rejects reconciliation divergence > Rs. 2.00 with UnreconciledTotalError (422)', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-TOLERANCE-FAIL',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        totalAmount: 1002.05, // 2.05 variance from line total 1000.00
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'TOL-B2',
            expiryDate: '2028-11-30',
            billedQuantity: 10,
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1000.0,
          },
        ],
      }

      await expect(provisionPurchaseBill(payload, testUser, mockPrisma)).rejects.toThrow(
        UnreconciledTotalError
      )
    })

    it('ADV-3.4c: Rejects negative total tampering with 422 Unreconciled Total', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-NEG-TOTAL',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        totalAmount: -1000.0, // Tampered negative total
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'NEG-B1',
            expiryDate: '2028-11-30',
            billedQuantity: 10,
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1000.0,
          },
        ],
      }

      await expect(provisionPurchaseBill(payload, testUser, mockPrisma)).rejects.toThrow(
        UnreconciledTotalError
      )
    })

    it('ADV-3.5: Rejects negative billed quantity with Zod validation error', async () => {
      const invalidPayload = {
        ...validHttpPayload,
        items: [
          {
            ...validHttpPayload.items[0],
            billedQuantity: -20, // Negative billed quantity
          },
        ],
      }

      const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      })

      const res = await commitPOST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('ADV-3.6: Rejects items with zero usable stock (billed: 0, free: 0) with ProvisioningValidationError', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-ZERO-USABLE',
        invoiceDate: '2026-11-03',
        subtotal: 0,
        totalAmount: 0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'ZERO-B1',
            expiryDate: '2028-11-30',
            billedQuantity: 0,
            freeQuantity: 0,
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 0,
          },
        ],
      }

      await expect(provisionPurchaseBill(payload, testUser, mockPrisma)).rejects.toThrow(
        ProvisioningValidationError
      )
    })
  })

  // ═════════════════════════════════════════════════════════════
  // SECTION 4: Free Goods Bonus Stock Arithmetic
  // ═════════════════════════════════════════════════════════════

  describe('Section 4: Free Quantity Bonus Stock Arithmetic', () => {
    it('ADV-4.1: Provisions 100 billed + 10 free bonus goods: Batch & Inv receive 110 units while Ledger is charged ONLY for 100 units', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-BONUS-100-10',
        invoiceDate: '2026-11-03',
        subtotal: 10000.0,
        totalAmount: 10000.0, // 100 units * 100.0, free units are NOT charged
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'BONUS-100-10',
            expiryDate: '2028-12-31',
            billedQuantity: 100,
            freeQuantity: 10,
            unitCost: 100.0,
            mrp: 145.0,
            totalAmount: 10000.0,
          },
        ],
      }

      const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

      expect(result.success).toBe(true)
      expect(result.totalUnitsAdded).toBe(110)
      expect(result.totalAmount).toBe(10000.0)

      // 1. Batch quantity must be 110
      const batch = mockPrisma._store.batches.get('prod-azithro-500_BONUS-100-10')
      expect(batch.quantity).toBe(110)

      // 2. Inventory total & available must have incremented by 110 (from 15 -> 125)
      const inv = mockPrisma._store.inventories.get('prod-azithro-500_branch-blr-adv')
      expect(inv.availableQuantity).toBe(15 + 110)
      expect(inv.totalQuantity).toBe(15 + 110)

      // 3. InventoryMovement quantity must be 110
      const movement = mockPrisma._store.inventoryMovements.find((m) => m.batchId === batch.id)
      expect(movement.quantity).toBe(110)
      expect(movement.type).toBe('IN')

      // 4. PurchaseItem received vs free quantities
      const purchaseItem = Array.from(mockPrisma._store.purchaseItems.values()).find(
        (pi) => pi.batchId === batch.id
      )
      expect(purchaseItem.receivedQuantity).toBe(100)
      expect(purchaseItem.freeQuantity).toBe(10)

      // 5. SupplierLedger payable must be strictly Rs. 10000.00 (not Rs. 11000.00)
      const ledger = mockPrisma._store.supplierLedgers[0]
      expect(ledger.amount).toBe(10000.0)
      expect(ledger.type).toBe('CREDIT')

      // 6. Supplier outstanding balance incremented by exactly Rs. 10000.00 (5000 -> 15000)
      const supplier = mockPrisma._store.suppliers.get('sup-adv-01')
      expect(supplier.outstandingBalance).toBe(15000.0)
    })

    it('ADV-4.2: Handles pure promotional / doctor sample stock (0 billed, 25 free, 0 total amount)', async () => {
      const payload: CommitPurchasePayload = {
        branchId: 'branch-blr-adv',
        supplierId: 'sup-adv-01',
        invoiceNumber: 'INV-ADV-SAMPLE-STOCK',
        invoiceDate: '2026-11-03',
        subtotal: 0.0,
        totalAmount: 0.0,
        items: [
          {
            productId: 'prod-azithro-500',
            batchNumber: 'SAMPLE-B1',
            expiryDate: '2028-12-31',
            billedQuantity: 0,
            freeQuantity: 25, // 25 sample units
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 0.0,
          },
        ],
      }

      const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

      expect(result.success).toBe(true)
      expect(result.totalUnitsAdded).toBe(25)
      expect(result.totalAmount).toBe(0.0)

      // Batch quantity must be 25
      const batch = mockPrisma._store.batches.get('prod-azithro-500_SAMPLE-B1')
      expect(batch.quantity).toBe(25)
      expect(batch.status).toBe('ACTIVE')

      // Supplier ledger amount is 0
      const ledger = mockPrisma._store.supplierLedgers[0]
      expect(ledger.amount).toBe(0.0)
    })
  })
})
