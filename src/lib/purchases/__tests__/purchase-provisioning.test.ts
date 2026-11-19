/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import {
  provisionPurchaseBill,
  UnreconciledTotalError,
  ProvisioningValidationError,
  type CommitPurchasePayload,
} from '../purchase-provisioning-service'

// ─── Test Store & Mock Prisma Client Factory ──────────────────

function createTestMockPrisma() {
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

  // Pre-seed an existing supplier
  store.suppliers.set('sup-mahaveer-01', {
    id: 'sup-mahaveer-01',
    name: 'Mahaveer Pharma Agencies',
    gstin: '29AABCM8921F1ZT',
    dlNumber: '20B/KA-B21/48911',
    outstandingBalance: 10000.0,
    isActive: true,
  })

  // Pre-seed an exhausted batch for collision & reactivation testing
  store.batches.set('prod-aug-625_BATCH2026A', {
    id: 'batch-aug-exhausted',
    productId: 'prod-aug-625',
    batchNumber: 'BATCH2026A',
    quantity: 0,
    status: 'EXHAUSTED',
    purchasePrice: 120.0,
    mrp: 180.0,
    expiryDate: new Date('2027-01-31'),
  })

  // Pre-seed existing branch inventory
  store.inventories.set('prod-aug-625_branch-blr-01', {
    id: 'inv-aug-blr',
    productId: 'prod-aug-625',
    branchId: 'branch-blr-01',
    totalQuantity: 20,
    availableQuantity: 20,
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
      return await callback(tx)
    }),
    _store: store,
  }

  return client
}

// ─── Unit Test Suite ──────────────────────────────────────────

describe('Purchase Provisioning Service — Transactional Engine', () => {
  let mockPrisma: ReturnType<typeof createTestMockPrisma>
  const testUser = {
    id: 'user-pharmacist-01',
    name: 'Lead Pharmacist',
    role: 'pharmacist',
    permissions: ['purchases:create', 'purchases:read'],
  }

  beforeEach(() => {
    mockPrisma = createTestMockPrisma()
  })

  it('F11 & F12: Successfully provisions a complete purchase bill with status RECEIVED and items', async () => {
    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV/2026/001',
      invoiceDate: '2026-11-03',
      subtotal: 15000.0,
      discountAmount: 500.0,
      taxAmount: 1740.0,
      roundOff: 0.0,
      totalAmount: 16240.0,
      items: [
        {
          productId: 'prod-dollo-650',
          batchNumber: 'DL650B01',
          expiryDate: '2028-06-30',
          billedQuantity: 100,
          freeQuantity: 10,
          unitCost: 25.0,
          mrp: 35.0,
          ptr: 25.0,
          discountPercent: 3.33,
          taxPercent: 12.0,
          taxAmount: 289.92,
          totalAmount: 2705.92,
        },
        {
          productId: 'prod-pan-d',
          batchNumber: 'PAND990',
          expiryDate: '2028-09-30',
          billedQuantity: 500,
          freeQuantity: 0,
          unitCost: 25.0,
          mrp: 35.0,
          ptr: 25.0,
          discountPercent: 0,
          taxPercent: 12.0,
          taxAmount: 1500.0,
          totalAmount: 13534.08,
        },
      ],
    }

    const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

    expect(result.success).toBe(true)
    expect(result.status).toBe('RECEIVED')
    expect(result.totalItemsProvisioned).toBe(2)
    expect(result.totalUnitsAdded).toBe(110 + 500) // 610 units (including 10 free)
    expect(result.totalAmount).toBe(16240.0)

    // Verify Purchase record
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'RECEIVED',
          invoiceNumber: 'INV/2026/001',
          branchId: 'branch-blr-01',
          supplierId: 'sup-mahaveer-01',
          balanceDue: 16240.0,
          createdById: 'user-pharmacist-01',
        }),
      })
    )

    // Verify PurchaseItem records
    expect(mockPrisma.purchaseItem.create).toHaveBeenCalledTimes(2)
  })

  it('F13: Collision-Safe Batch Upsert reactivates EXHAUSTED batch to ACTIVE with incremented stock', async () => {
    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-BATCH-REACTIVATE',
      invoiceDate: '2026-11-03',
      subtotal: 7362.0,
      totalAmount: 7362.0,
      items: [
        {
          productId: 'prod-aug-625',
          batchNumber: 'BATCH2026A', // matches pre-seeded exhausted batch
          expiryDate: '2028-08-31',
          billedQuantity: 50,
          freeQuantity: 5,
          unitCost: 147.24,
          mrp: 204.5,
          totalAmount: 7362.0,
        },
      ],
    }

    const preBatch = mockPrisma._store.batches.get('prod-aug-625_BATCH2026A')
    expect(preBatch.quantity).toBe(0)
    expect(preBatch.status).toBe('EXHAUSTED')

    await provisionPurchaseBill(payload, testUser, mockPrisma)

    const postBatch = mockPrisma._store.batches.get('prod-aug-625_BATCH2026A')
    expect(postBatch.quantity).toBe(55) // 50 billed + 5 free
    expect(postBatch.status).toBe('ACTIVE') // Reactivated!
    expect(postBatch.purchasePrice).toBe(147.24)
    expect(postBatch.mrp).toBe(204.5)
  })

  it('F14: Provisions free goods bonus stock (10+1 free) into usable inventory without inflating financial payable', async () => {
    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-BONUS-SCHEME',
      invoiceDate: '2026-11-03',
      subtotal: 1000.0,
      totalAmount: 1000.0, // Financial total is based only on billed units
      items: [
        {
          productId: 'prod-bonus-test',
          batchNumber: 'BONUS99',
          expiryDate: '2028-12-31',
          billedQuantity: 10,
          freeQuantity: 1, // 10 + 1 free goods scheme
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 1000.0,
        },
      ],
    }

    const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

    // Usable stock added must be 11 units
    expect(result.totalUnitsAdded).toBe(11)

    // Financial ledger credit must be exactly Rs. 1000.00
    const ledgerEntry = mockPrisma._store.supplierLedgers.find(
      (l) => l.referenceType === 'PURCHASE'
    )
    expect(ledgerEntry.amount).toBe(1000.0)

    // Batch quantity must be 11
    const batch = mockPrisma._store.batches.get('prod-bonus-test_BONUS99')
    expect(batch.quantity).toBe(11)
  })

  it('F15: CAS Branch Inventory Increments updates existing inventory and creates missing inventory', async () => {
    // Existing inventory for prod-aug-625 in branch-blr-01 had 20 units
    const existingInv = mockPrisma._store.inventories.get('prod-aug-625_branch-blr-01')
    expect(existingInv.availableQuantity).toBe(20)

    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-CAS-TEST',
      invoiceDate: '2026-11-03',
      subtotal: 5000.0,
      totalAmount: 5000.0,
      items: [
        {
          productId: 'prod-aug-625',
          batchNumber: 'NEWBATCH01',
          expiryDate: '2028-10-31',
          billedQuantity: 30,
          freeQuantity: 0,
          unitCost: 100.0,
          mrp: 150.0,
          totalAmount: 3000.0,
        },
        {
          productId: 'prod-brand-new-999', // Non-existing inventory row
          batchNumber: 'FIRSTBATCH',
          expiryDate: '2028-10-31',
          billedQuantity: 20,
          freeQuantity: 0,
          unitCost: 100.0,
          mrp: 150.0,
          totalAmount: 2000.0,
        },
      ],
    }

    await provisionPurchaseBill(payload, testUser, mockPrisma)

    // Existing inventory should be updated from 20 -> 50
    expect(existingInv.availableQuantity).toBe(50)
    expect(existingInv.totalQuantity).toBe(50)

    // New inventory row must have been created with 20 units
    const newInv = mockPrisma._store.inventories.get('prod-brand-new-999_branch-blr-01')
    expect(newInv).toBeDefined()
    expect(newInv.availableQuantity).toBe(20)
    expect(newInv.totalQuantity).toBe(20)
  })

  it('F16: Logs InventoryMovement audit trail with type: IN, quantityBefore, and quantityAfter', async () => {
    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-MOV-TEST',
      invoiceDate: '2026-11-03',
      subtotal: 1472.4,
      totalAmount: 1472.4,
      items: [
        {
          productId: 'prod-aug-625',
          batchNumber: 'MOV-BATCH-1',
          expiryDate: '2028-05-31',
          billedQuantity: 10,
          freeQuantity: 2, // 12 units
          unitCost: 147.24,
          mrp: 204.5,
          totalAmount: 1472.4,
        },
      ],
    }

    await provisionPurchaseBill(payload, testUser, mockPrisma)

    const movements = mockPrisma._store.inventoryMovements
    expect(movements.length).toBe(1)
    expect(movements[0].type).toBe('IN')
    expect(movements[0].quantity).toBe(12)
    expect(movements[0].quantityBefore).toBe(20) // Pre-seeded inventory availableQuantity was 20
    expect(movements[0].quantityAfter).toBe(32)
    expect(movements[0].referenceType).toBe('PURCHASE')
    expect(movements[0].createdById).toBe('user-pharmacist-01')
  })

  it('F17: Posts Accounts Payable credit liability and increments Supplier outstandingBalance', async () => {
    const initialBalance = mockPrisma._store.suppliers.get('sup-mahaveer-01').outstandingBalance
    expect(initialBalance).toBe(10000.0)

    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-AP-TEST-44',
      invoiceDate: '2026-11-03',
      subtotal: 5000.0,
      totalAmount: 5000.0,
      items: [
        {
          productId: 'prod-aug-625',
          batchNumber: 'AP-B1',
          expiryDate: '2028-01-31',
          billedQuantity: 50,
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 5000.0,
        },
      ],
    }

    await provisionPurchaseBill(payload, testUser, mockPrisma)

    // Outstanding balance incremented
    const updatedSupplier = mockPrisma._store.suppliers.get('sup-mahaveer-01')
    expect(updatedSupplier.outstandingBalance).toBe(15000.0)

    // Supplier ledger entry
    const ledger = mockPrisma._store.supplierLedgers[0]
    expect(ledger).toBeDefined()
    expect(ledger.supplierId).toBe('sup-mahaveer-01')
    expect(ledger.type).toBe('CREDIT')
    expect(ledger.amount).toBe(5000.0)
    expect(ledger.referenceType).toBe('PURCHASE')
    expect(ledger.description).toContain('INV-AP-TEST-44')
  })

  it('Creates new supplier on-the-fly when newSupplier is provided instead of supplierId', async () => {
    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      newSupplier: {
        name: 'Vardhaman Healthcare Distributors',
        gstin: '29ABCDE1234F1Z5',
        dlNumber: '20B/KA-V21/99001',
        phone: '9876543210',
        email: 'sales@vardhamanpharma.com',
        address: '42 BVK Iyengar Road, Bengaluru',
      },
      invoiceNumber: 'VARD/2026/8812',
      invoiceDate: '2026-11-03',
      subtotal: 8000.0,
      totalAmount: 8000.0,
      items: [
        {
          productId: 'prod-dollo-650',
          batchNumber: 'VARD-B1',
          expiryDate: '2028-11-30',
          billedQuantity: 80,
          unitCost: 100.0,
          mrp: 130.0,
          totalAmount: 8000.0,
        },
      ],
    }

    const result = await provisionPurchaseBill(payload, testUser, mockPrisma)

    expect(result.success).toBe(true)

    // Verify supplier was created
    const createdSupplier = Array.from(mockPrisma._store.suppliers.values()).find(
      (s) => s.name === 'Vardhaman Healthcare Distributors'
    )
    expect(createdSupplier).toBeDefined()
    expect(createdSupplier.gstin).toBe('29ABCDE1234F1Z5')
    expect(createdSupplier.dlNumber).toBe('20B/KA-V21/99001')
    expect(createdSupplier.outstandingBalance).toBe(8000.0)
  })

  it('F18 & AuditLog: Posts GST ITC transaction and creates AuditLog entry', async () => {
    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-GST-AUDIT',
      invoiceDate: '2026-11-03',
      subtotal: 10000.0,
      taxAmount: 1200.0,
      totalAmount: 11200.0,
      items: [
        {
          productId: 'prod-aug-625',
          batchNumber: 'GST-B1',
          expiryDate: '2028-12-31',
          billedQuantity: 100,
          unitCost: 100.0,
          mrp: 150.0,
          taxAmount: 1200.0,
          totalAmount: 11200.0,
        },
      ],
    }

    await provisionPurchaseBill(payload, testUser, mockPrisma)

    // GST transaction check
    expect(mockPrisma.gstTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'INPUT',
          taxAmount: 1200.0,
          invoiceNumber: 'INV-GST-AUDIT',
        }),
      })
    )

    // AuditLog check
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PURCHASE_BILL_SCAN_CONFIRM',
          entity: 'Purchase',
          userId: 'user-pharmacist-01',
          branchId: 'branch-blr-01',
        }),
      })
    )
  })

  it('Confirmation Barrier: Throws UnreconciledTotalError (422) if line item sum diverges from totalAmount', async () => {
    const temperedPayload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-TEMPERED',
      invoiceDate: '2026-11-03',
      subtotal: 1000.0,
      totalAmount: 99999.0, // Drastically differs from line total 1000.0
      items: [
        {
          productId: 'prod-dollo-650',
          batchNumber: 'TEMPER-B1',
          expiryDate: '2028-11-30',
          billedQuantity: 10,
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 1000.0,
        },
      ],
    }

    await expect(provisionPurchaseBill(temperedPayload, testUser, mockPrisma)).rejects.toThrow(
      UnreconciledTotalError
    )
  })

  it('Admin Risk Override: Allows provisioning when adminRiskAccepted is true despite large arithmetic variance', async () => {
    const adminRiskPayload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-ADMIN-OVERRIDE-1',
      invoiceDate: '2026-11-03',
      subtotal: 1000.0,
      totalAmount: 99999.0, // Large variance: 99999 vs 1000
      allowVarianceOverride: true,
      adminRiskAccepted: true,
      adminOverrideReason: 'Administrator manual reconciliation accepted at admin risk',
      items: [
        {
          productId: 'prod-dollo-650',
          batchNumber: 'OVERRIDE-B1',
          expiryDate: '2028-11-30',
          billedQuantity: 10,
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 1000.0,
        },
      ],
    }

    const result = await provisionPurchaseBill(adminRiskPayload, testUser, mockPrisma)
    expect(result.success).toBe(true)
    expect(result.totalAmount).toBe(99999.0)
    expect((result.purchase as any).notes).toContain('ADMIN RISK OVERRIDE')

    // Verify audit log has recorded the override action
    const overrideLog = mockPrisma._store.auditLogs.find(
      (log: any) => log.action === 'PURCHASE_BILL_ADMIN_RISK_OVERRIDE'
    )
    expect(overrideLog).toBeDefined()
    expect(overrideLog.metadata.adminRiskAccepted).toBe(true)
    expect(overrideLog.metadata.totalAmount).toBe(99999.0)
  })

  it('Quantitative Validation: Throws ProvisioningValidationError (400) if line item has 0 usable quantity', async () => {
    const invalidPayload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-ZERO-QTY',
      invoiceDate: '2026-11-03',
      subtotal: 0,
      totalAmount: 0,
      items: [
        {
          productId: 'prod-dollo-650',
          batchNumber: 'ZERO-B1',
          expiryDate: '2028-11-30',
          billedQuantity: 0,
          freeQuantity: 0, // No usable quantity
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 0,
        },
      ],
    }

    await expect(provisionPurchaseBill(invalidPayload, testUser, mockPrisma)).rejects.toThrow(
      ProvisioningValidationError
    )
  })

  it('Atomic Rollback: Rejects and halts when a transaction step fails', async () => {
    mockPrisma.inventory.update.mockRejectedValueOnce(new Error('Simulated Database Conflict Error'))

    const payload: CommitPurchasePayload = {
      branchId: 'branch-blr-01',
      supplierId: 'sup-mahaveer-01',
      invoiceNumber: 'INV-FAIL-ROLLBACK',
      invoiceDate: '2026-11-03',
      subtotal: 1000.0,
      totalAmount: 1000.0,
      items: [
        {
          productId: 'prod-aug-625',
          batchNumber: 'FAIL-B1',
          expiryDate: '2028-05-31',
          billedQuantity: 10,
          unitCost: 100.0,
          mrp: 140.0,
          totalAmount: 1000.0,
        },
      ],
    }

    await expect(provisionPurchaseBill(payload, testUser, mockPrisma)).rejects.toThrow(
      'Simulated Database Conflict Error'
    )
  })
})
