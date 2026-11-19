import { Prisma } from '@prisma/client'

import prisma from '@/lib/db/prisma'
import { cancelSale, editSale, type SaleActor } from '@/lib/sales/sales-service'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    sale: { findUnique: jest.fn(), update: jest.fn() },
    inventory: { findUnique: jest.fn(), update: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    batch: { findUnique: jest.fn(), update: jest.fn() },
    batchStatusLog: { create: jest.fn() },
    customer: { findUnique: jest.fn(), update: jest.fn() },
    customerLedger: { create: jest.fn() },
    gstTransaction: { deleteMany: jest.fn() },
    doctorCommission: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

jest.mock('@/lib/settings/settings-service', () => ({
  __esModule: true,
  getPosSettings: jest.fn(),
  DEFAULT_POS_SETTINGS: {
    autoPrintInvoice: false,
    invoiceType: 'thermal',
    maxDiscountPercent: 20,
    allowCreditSales: true,
    requireCustomerForCredit: true,
    roundOffTotal: true,
    fefoEnabled: true,
    negativeStock: false,
    taxInclusive: false,
  },
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  __esModule: true,
  assertBranchAccess: jest.fn().mockResolvedValue(undefined),
  resolveBranchScope: jest.fn(),
  getAccessibleBranches: jest.fn(),
}))

jest.mock('@/lib/finance/gst-service', () => ({
  __esModule: true,
  postGstTransactionForSale: jest.fn().mockResolvedValue(undefined),
}))

const mockedPrisma = prisma as unknown as {
  $transaction: jest.Mock
}

describe('Empirical Adversarial Stress Suite: Admin Bill Ops, Inventory Reversal, and Audit Logs', () => {
  const cashierActor: SaleActor = {
    id: 'cashier-001',
    branchId: 'branch-ka-01',
    permissions: ['sales:create', 'sales:read'],
    roles: ['cashier'],
  }

  const pharmacistActor: SaleActor = {
    id: 'pharma-001',
    branchId: 'branch-ka-01',
    permissions: ['sales:create', 'sales:read', 'sales:discount'],
    roles: ['pharmacist'],
  }

  const adminActor: SaleActor = {
    id: 'admin-001',
    branchId: 'branch-ka-01',
    permissions: ['sales:void'],
    roles: ['admin'],
  }

  const ownerActor: SaleActor = {
    id: 'owner-001',
    branchId: 'branch-ka-01',
    permissions: [],
    roles: ['owner'],
  }

  const managerActor: SaleActor = {
    id: 'manager-001',
    branchId: 'branch-ka-01',
    permissions: [],
    roles: ['manager'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // =========================================================================
  // 1. Core Service Direct RBAC Rejection
  // =========================================================================
  describe('Direct Service RBAC Lockdown', () => {
    it('blocks Cashier calling editSale with Forbidden error', async () => {
      await expect(
        editSale(
          {
            saleId: 'sale-001',
            items: [{ saleItemId: 'item-001', quantity: 1 }],
          },
          cashierActor
        )
      ).rejects.toThrow('Forbidden: requires permission sales:void or Admin role to edit sales')
    })

    it('blocks Pharmacist without sales:void calling editSale with Forbidden error', async () => {
      await expect(
        editSale(
          {
            saleId: 'sale-001',
            items: [{ saleItemId: 'item-001', quantity: 1 }],
          },
          pharmacistActor
        )
      ).rejects.toThrow('Forbidden: requires permission sales:void or Admin role to edit sales')
    })

    it('blocks Cashier calling cancelSale with Forbidden error', async () => {
      await expect(cancelSale('sale-001', 'Cashier void attempt', cashierActor)).rejects.toThrow(
        'Forbidden: requires permission sales:void or Admin role to cancel sales'
      )
    })

    it('blocks Pharmacist without sales:void calling cancelSale with Forbidden error', async () => {
      await expect(cancelSale('sale-001', 'Pharma void attempt', pharmacistActor)).rejects.toThrow(
        'Forbidden: requires permission sales:void or Admin role to cancel sales'
      )
    })

    it('blocks unauthenticated / empty actor from editSale and cancelSale', async () => {
      const emptyActor: SaleActor = { id: 'anon', branchId: 'branch-ka-01' }
      await expect(
        editSale({ saleId: 'sale-001', items: [{ saleItemId: 'item-001', quantity: 1 }] }, emptyActor)
      ).rejects.toThrow(/Forbidden/i)
      await expect(cancelSale('sale-001', 'Anon attempt', emptyActor)).rejects.toThrow(/Forbidden/i)
    })
  })

  // =========================================================================
  // 2. Inventory Reversal & Partial Return Protection Stress Testing
  // =========================================================================
  describe('Inventory Reversal with Partial Return Guard', () => {
    it('restores net quantity Math.max(0, quantity - returnedQuantity) when 2 of 10 units already returned', async () => {
      const mockSale = {
        id: 'sale-partial-10',
        invoiceNumber: 'INV-PARTIAL-001',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(1000),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-part-1',
            productId: 'prod-amox-500',
            productName: 'Amoxicillin 500mg',
            quantity: 10,
            returnedQuantity: 2, // 2 units returned prior
            unitPrice: new Prisma.Decimal(100),
            totalAmount: new Prisma.Decimal(1000),
            itemBatches: [
              {
                id: 'ib-part-1',
                batchId: 'batch-amox-01',
                quantity: 10,
              },
            ],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({ ...mockSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-amox-01',
            availableQuantity: 40,
            totalQuantity: 40,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-amox-01',
            quantity: 100,
            soldQuantity: 50,
            status: 'ACTIVE',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-partial-10', 'Prescription cancelled by physician', adminActor)

      // Net restore quantity MUST be exactly 10 - 2 = 8, NOT 10!
      expect(txMock.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-amox-01' },
          data: {
            totalQuantity: { increment: 8 },
            availableQuantity: { increment: 8 },
          },
        })
      )

      expect(txMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RETURN_IN',
            quantity: 8,
            quantityBefore: 40,
            quantityAfter: 48,
          }),
        })
      )

      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-amox-01' },
          data: {
            soldQuantity: 42, // 50 - 8 = 42
            status: 'ACTIVE',
          },
        })
      )
    })

    it('bypasses inventory update completely when all units were already returned (netRestoreQty = 0)', async () => {
      const mockSaleFullyReturned = {
        id: 'sale-fully-returned',
        invoiceNumber: 'INV-RETURNED-001',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(500),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-full-ret',
            productId: 'prod-para-650',
            productName: 'Paracetamol 650mg',
            quantity: 5,
            returnedQuantity: 5, // All 5 returned previously!
            itemBatches: [{ id: 'ib-full', batchId: 'batch-para-01', quantity: 5 }],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSaleFullyReturned),
          update: jest.fn().mockResolvedValue({ ...mockSaleFullyReturned, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn(), update: jest.fn() },
        inventoryMovement: { create: jest.fn() },
        batch: { findUnique: jest.fn(), update: jest.fn() },
        auditLog: { create: jest.fn() },
        gstTransaction: { deleteMany: jest.fn() },
        doctorCommission: { deleteMany: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-fully-returned', 'Cancel bill that had all items returned', adminActor)

      // Zero units restored -> inventory & batch find/update must NOT be called for this item
      expect(txMock.inventory.findUnique).not.toHaveBeenCalled()
      expect(txMock.inventory.update).not.toHaveBeenCalled()
      expect(txMock.inventoryMovement.create).not.toHaveBeenCalled()
      expect(txMock.batch.findUnique).not.toHaveBeenCalled()
      expect(txMock.batch.update).not.toHaveBeenCalled()

      // Sale status and audit log must still be written
      expect(txMock.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-fully-returned' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      )
    })

    it('safely handles over-returned anomalous state (returnedQuantity > quantity) without negative stock restore', async () => {
      const mockAnomalySale = {
        id: 'sale-anomaly',
        invoiceNumber: 'INV-ANOMALY-001',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(300),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-anom',
            productId: 'prod-anom',
            productName: 'Test Item',
            quantity: 5,
            returnedQuantity: 7, // Anomalous state: 7 > 5
            itemBatches: [{ id: 'ib-anom', batchId: 'batch-anom', quantity: 5 }],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockAnomalySale),
          update: jest.fn().mockResolvedValue({ ...mockAnomalySale, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn(), update: jest.fn() },
        inventoryMovement: { create: jest.fn() },
        batch: { findUnique: jest.fn(), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-anomaly', 'Void anomalous sale', adminActor)

      expect(txMock.inventory.update).not.toHaveBeenCalled()
      expect(txMock.inventoryMovement.create).not.toHaveBeenCalled()
      expect(txMock.batch.update).not.toHaveBeenCalled()
    })

    it('correctly handles multi-item invoice with mixed return ratios', async () => {
      const mockMultiItemSale = {
        id: 'sale-multi-mixed',
        invoiceNumber: 'INV-MIXED-001',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(2500),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Item 1',
            quantity: 10,
            returnedQuantity: 3, // Net restore: 7
            itemBatches: [{ id: 'ib-1', batchId: 'batch-1', quantity: 10 }],
          },
          {
            id: 'item-2',
            productId: 'prod-2',
            productName: 'Item 2',
            quantity: 4,
            returnedQuantity: 4, // Net restore: 0
            itemBatches: [{ id: 'ib-2', batchId: 'batch-2', quantity: 4 }],
          },
          {
            id: 'item-3',
            productId: 'prod-3',
            productName: 'Item 3',
            quantity: 6,
            returnedQuantity: 0, // Net restore: 6
            itemBatches: [{ id: 'ib-3', batchId: 'batch-3', quantity: 6 }],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockMultiItemSale),
          update: jest.fn().mockResolvedValue({ ...mockMultiItemSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.productId_branchId.productId === 'prod-1') {
              return { id: 'inv-1', availableQuantity: 20, totalQuantity: 20 }
            }
            if (where.productId_branchId.productId === 'prod-3') {
              return { id: 'inv-3', availableQuantity: 15, totalQuantity: 15 }
            }
            return null
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'batch-1') return { id: 'batch-1', quantity: 50, soldQuantity: 20, status: 'ACTIVE' }
            if (where.id === 'batch-3') return { id: 'batch-3', quantity: 30, soldQuantity: 10, status: 'ACTIVE' }
            return null
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn() },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-multi-mixed', 'Mixed return bill cancellation', adminActor)

      // prod-1: +7
      expect(txMock.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { totalQuantity: { increment: 7 }, availableQuantity: { increment: 7 } },
        })
      )
      // prod-3: +6
      expect(txMock.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-3' },
          data: { totalQuantity: { increment: 6 }, availableQuantity: { increment: 6 } },
        })
      )
      // Only 2 inventory movements created (for prod-1 and prod-3, none for prod-2)
      expect(txMock.inventoryMovement.create).toHaveBeenCalledTimes(2)
    })
  })

  // =========================================================================
  // 3. Batch Reactivation from EXHAUSTED to ACTIVE & BatchStatusLog Stress Testing
  // =========================================================================
  describe('Batch Reactivation & BatchStatusLog Creation', () => {
    it('reactivates EXHAUSTED batch to ACTIVE and writes BatchStatusLog entry', async () => {
      const mockSale = {
        id: 'sale-exhausted-01',
        invoiceNumber: 'INV-EXHAUST-01',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(2000),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-ex-1',
            productId: 'prod-insulin',
            productName: 'Insulin Glargine 100IU',
            quantity: 20,
            returnedQuantity: 0,
            itemBatches: [{ id: 'ib-ex-1', batchId: 'batch-insulin-01', quantity: 20 }],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({ ...mockSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-ins-01', availableQuantity: 0, totalQuantity: 0 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-insulin-01',
            quantity: 20,
            soldQuantity: 20,
            status: 'EXHAUSTED', // Exactly exhausted!
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-exhausted-01', 'Cold chain compromised on delivery', adminActor)

      // soldQuantity becomes 0, status transitions to ACTIVE
      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-insulin-01' },
          data: {
            soldQuantity: 0,
            status: 'ACTIVE',
          },
        })
      )

      // BatchStatusLog MUST be created with detailed transition
      expect(txMock.batchStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: 'batch-insulin-01',
            fromStatus: 'EXHAUSTED',
            toStatus: 'ACTIVE',
            reason: expect.stringContaining('INV-EXHAUST-01'),
            changedById: adminActor.id,
          }),
        })
      )
    })

    it('does NOT write BatchStatusLog when batch was already ACTIVE', async () => {
      const mockSale = {
        id: 'sale-active-batch',
        invoiceNumber: 'INV-ACTIVE-01',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(500),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-act-1',
            productId: 'prod-act',
            productName: 'Vitamin D3',
            quantity: 10,
            returnedQuantity: 0,
            itemBatches: [{ id: 'ib-act-1', batchId: 'batch-act-01', quantity: 10 }],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({ ...mockSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-act', availableQuantity: 90, totalQuantity: 90 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-act-01',
            quantity: 100,
            soldQuantity: 60,
            status: 'ACTIVE', // Already ACTIVE
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn() },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-active-batch', 'Routine cancellation', managerActor)

      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-act-01' },
          data: {
            soldQuantity: 50,
            status: 'ACTIVE',
          },
        })
      )
      // No BatchStatusLog created because status did not change
      expect(txMock.batchStatusLog.create).not.toHaveBeenCalled()
    })

    it('correctly restores multi-batch line item split where both batches were EXHAUSTED', async () => {
      const mockSplitSale = {
        id: 'sale-split-01',
        invoiceNumber: 'INV-SPLIT-01',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(1500),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-split-1',
            productId: 'prod-split',
            productName: 'Split Product',
            quantity: 15,
            returnedQuantity: 0,
            itemBatches: [
              { id: 'ib-1', batchId: 'batch-split-A', quantity: 10 },
              { id: 'ib-2', batchId: 'batch-split-B', quantity: 5 },
            ],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSplitSale),
          update: jest.fn().mockResolvedValue({ ...mockSplitSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-split', availableQuantity: 0, totalQuantity: 0 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'batch-split-A') {
              return { id: 'batch-split-A', quantity: 10, soldQuantity: 10, status: 'EXHAUSTED' }
            }
            if (where.id === 'batch-split-B') {
              return { id: 'batch-split-B', quantity: 10, soldQuantity: 10, status: 'EXHAUSTED' }
            }
            return null
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-split-01', 'Multi batch void', ownerActor)

      // Batch A: soldQuantity 10 -> 0 (ACTIVE)
      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-split-A' },
          data: { soldQuantity: 0, status: 'ACTIVE' },
        })
      )
      // Batch B: soldQuantity 10 -> 5 (ACTIVE)
      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-split-B' },
          data: { soldQuantity: 5, status: 'ACTIVE' },
        })
      )
      // Both batches logged transition
      expect(txMock.batchStatusLog.create).toHaveBeenCalledTimes(2)
    })
  })

  // =========================================================================
  // 4. Customer Credit Ledger Reversal Stress Testing
  // =========================================================================
  describe('Customer Credit Ledger Reversals', () => {
    it('reduces outstanding balance by full balanceDue and creates CREDIT ledger entry', async () => {
      const mockCreditSale = {
        id: 'sale-credit-full',
        invoiceNumber: 'INV-CREDIT-01',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        customerId: 'cust-sharma-01',
        totalAmount: new Prisma.Decimal(1200),
        amountPaid: new Prisma.Decimal(0),
        balanceDue: new Prisma.Decimal(1200), // Entire bill is credit
        items: [],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockCreditSale),
          update: jest.fn().mockResolvedValue({ ...mockCreditSale, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn(), update: jest.fn() },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cust-sharma-01',
            outstandingBalance: new Prisma.Decimal(2500),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        customerLedger: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-credit-full', 'Credit sale cancelled upon customer request', adminActor)

      // Balance reduced from 2500 by 1200 -> 1300
      expect(txMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-sharma-01' },
          data: { outstandingBalance: new Prisma.Decimal(1300) },
        })
      )

      // Ledger entry type: 'CREDIT'
      expect(txMock.customerLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-sharma-01',
            type: 'CREDIT',
            amount: new Prisma.Decimal(1200),
            balance: new Prisma.Decimal(1300),
            referenceType: 'SALE',
            referenceId: 'sale-credit-full',
          }),
        })
      )
    })

    it('reduces outstanding balance by ONLY balanceDue on partial payment credit sale', async () => {
      const mockPartialCreditSale = {
        id: 'sale-credit-part',
        invoiceNumber: 'INV-CREDIT-02',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        customerId: 'cust-verma-02',
        totalAmount: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(400),
        balanceDue: new Prisma.Decimal(600), // Only 600 remaining
        items: [],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockPartialCreditSale),
          update: jest.fn().mockResolvedValue({ ...mockPartialCreditSale, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn(), update: jest.fn() },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cust-verma-02',
            outstandingBalance: new Prisma.Decimal(3000),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        customerLedger: { create: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-credit-part', 'Partial credit bill cancelled', adminActor)

      // Balance reduced from 3000 by 600 -> 2400 (NOT by 1000)
      expect(txMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-verma-02' },
          data: { outstandingBalance: new Prisma.Decimal(2400) },
        })
      )

      expect(txMock.customerLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-verma-02',
            type: 'CREDIT',
            amount: new Prisma.Decimal(600),
            balance: new Prisma.Decimal(2400),
          }),
        })
      )
    })

    it('does NOT modify customer balance or ledger if bill was fully paid (balanceDue = 0)', async () => {
      const mockCashSaleWithCustomer = {
        id: 'sale-cash-cust',
        invoiceNumber: 'INV-CASH-CUST',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        customerId: 'cust-patel-03',
        totalAmount: new Prisma.Decimal(800),
        amountPaid: new Prisma.Decimal(800),
        balanceDue: new Prisma.Decimal(0), // Fully paid!
        items: [],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockCashSaleWithCustomer),
          update: jest.fn().mockResolvedValue({ ...mockCashSaleWithCustomer, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn(), update: jest.fn() },
        customer: { findUnique: jest.fn(), update: jest.fn() },
        customerLedger: { create: jest.fn() },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-cash-cust', 'Paid bill cancelled', adminActor)

      expect(txMock.customer.findUnique).not.toHaveBeenCalled()
      expect(txMock.customer.update).not.toHaveBeenCalled()
      expect(txMock.customerLedger.create).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 5. Idempotency & Error Paths
  // =========================================================================
  describe('Idempotency & Boundary Error Paths', () => {
    it('strictly rejects double-cancellation attempt with "Sale is already cancelled"', async () => {
      const mockAlreadyCancelledSale = {
        id: 'sale-already-cancelled',
        invoiceNumber: 'INV-CANCELLED-01',
        branchId: 'branch-ka-01',
        status: 'CANCELLED', // Already cancelled!
        items: [],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockAlreadyCancelledSale),
          update: jest.fn(),
        },
        inventory: { update: jest.fn() },
        batch: { update: jest.fn() },
        customer: { update: jest.fn() },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await expect(
        cancelSale('sale-already-cancelled', 'Attempting second void', adminActor)
      ).rejects.toThrow('Sale is already cancelled')

      // Ensure no mutations occurred
      expect(txMock.sale.update).not.toHaveBeenCalled()
      expect(txMock.inventory.update).not.toHaveBeenCalled()
      expect(txMock.batch.update).not.toHaveBeenCalled()
      expect(txMock.customer.update).not.toHaveBeenCalled()
      expect(txMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('rejects cancellation for non-existent sale ID with "Not Found: sale"', async () => {
      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await expect(
        cancelSale('sale-ghost-id', 'Voiding ghost', adminActor)
      ).rejects.toThrow('Not Found: sale')
    })

    it('rejects editSale on a sale that is already CANCELLED', async () => {
      const mockCancelledSale = {
        id: 'sale-edit-cancelled',
        status: 'CANCELLED',
        branchId: 'branch-ka-01',
        items: [],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockCancelledSale),
        },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await expect(
        editSale(
          {
            saleId: 'sale-edit-cancelled',
            items: [{ saleItemId: 'it-1', quantity: 2 }],
          },
          adminActor
        )
      ).rejects.toThrow("Cannot edit sale with status 'CANCELLED'")
    })
  })

  // =========================================================================
  // 6. AuditLog Validation: oldData and newData Snapshots
  // =========================================================================
  describe('AuditLog Records Validation (SALE_CANCEL & SALE_UPDATE)', () => {
    it('writes enriched AuditLog on SALE_CANCEL with comprehensive oldData and newData snapshots', async () => {
      const mockSale = {
        id: 'sale-audit-test',
        invoiceNumber: 'INV-AUDIT-001',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(750),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'it-audit-1',
            productId: 'prod-audit-1',
            productName: 'Azithromycin 500mg',
            quantity: 3,
            returnedQuantity: 1,
            unitPrice: new Prisma.Decimal(250),
            totalAmount: new Prisma.Decimal(750),
            itemBatches: [{ id: 'ib-a-1', batchId: 'batch-a-1', quantity: 3 }],
          },
        ],
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({ ...mockSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-aud', availableQuantity: 10, totalQuantity: 10 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockResolvedValue({ id: 'batch-a-1', quantity: 20, soldQuantity: 5, status: 'ACTIVE' }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn() },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        doctorCommission: { deleteMany: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-audit-test', 'Audit log verification cancellation', adminActor)

      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminActor.id,
            action: 'SALE_CANCEL',
            entity: 'Sale',
            entityId: 'sale-audit-test',
            oldData: expect.objectContaining({
              status: 'COMPLETED',
              totalAmount: 750,
              items: expect.arrayContaining([
                expect.objectContaining({
                  id: 'it-audit-1',
                  productId: 'prod-audit-1',
                  productName: 'Azithromycin 500mg',
                  quantity: 3,
                  returnedQuantity: 1,
                }),
              ]),
            }),
            newData: expect.objectContaining({
              status: 'CANCELLED',
              cancelledReason: 'Audit log verification cancellation',
              cancelledAt: expect.any(String),
            }),
            metadata: expect.objectContaining({
              invoiceNumber: 'INV-AUDIT-001',
              totalAmount: 750,
              cancelledBy: adminActor.id,
              reason: 'Audit log verification cancellation',
            }),
          }),
        })
      )
    })

    it('writes enriched AuditLog on SALE_UPDATE with oldData and newData financial snapshots', async () => {
      const mockSale = {
        id: 'sale-edit-audit',
        invoiceNumber: 'INV-EDIT-AUDIT',
        branchId: 'branch-ka-01',
        status: 'COMPLETED',
        subtotal: new Prisma.Decimal(200),
        discountAmount: new Prisma.Decimal(0),
        discountPercent: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(24),
        cgstAmount: new Prisma.Decimal(12),
        sgstAmount: new Prisma.Decimal(12),
        igstAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(224),
        amountPaid: new Prisma.Decimal(224),
        balanceDue: new Prisma.Decimal(0),
        notes: null,
        items: [
          {
            id: 'it-edit-1',
            productId: 'prod-edit-1',
            productName: 'Paracetamol 500mg',
            productSku: 'P-500',
            quantity: 2,
            unitPrice: new Prisma.Decimal(100),
            discountPercent: new Prisma.Decimal(0),
            discountAmount: new Prisma.Decimal(0),
            taxPercent: new Prisma.Decimal(12),
            cgstPercent: new Prisma.Decimal(6),
            sgstPercent: new Prisma.Decimal(6),
            igstPercent: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(24),
            totalAmount: new Prisma.Decimal(224),
            returnedQuantity: 0,
            product: {
              gstRate: new Prisma.Decimal(12),
              cgstRate: new Prisma.Decimal(6),
              sgstRate: new Prisma.Decimal(6),
              igstRate: new Prisma.Decimal(0),
              isGstExempt: false,
            },
            itemBatches: [{ id: 'ib-e-1', batchId: 'batch-e-1', quantity: 2 }],
          },
        ],
        payments: [{ id: 'pmt-1', method: 'CASH', amount: new Prisma.Decimal(224) }],
        branch: { id: 'branch-ka-01', code: 'BR-KA' },
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({ ...mockSale, totalAmount: new Prisma.Decimal(112) }),
        },
        saleItem: {
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'it-edit-1',
              productId: 'prod-edit-1',
              productName: 'Paracetamol 500mg',
              quantity: 1,
              unitPrice: new Prisma.Decimal(100),
              discountAmount: new Prisma.Decimal(0),
              discountPercent: new Prisma.Decimal(0),
              taxPercent: new Prisma.Decimal(12),
              cgstPercent: new Prisma.Decimal(6),
              sgstPercent: new Prisma.Decimal(6),
              igstPercent: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(12),
              totalAmount: new Prisma.Decimal(112),
              product: mockSale.items[0].product,
            },
          ]),
        },
        saleItemBatch: { update: jest.fn().mockResolvedValue({}) },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-e-1',
            quantity: 10,
            soldQuantity: 10,
            status: 'EXHAUSTED',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn().mockResolvedValue({}) },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-e-1', availableQuantity: 0, totalQuantity: 0 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
        payment: { create: jest.fn().mockResolvedValue({}) },
        gstTransaction: { deleteMany: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await editSale(
        {
          saleId: 'sale-edit-audit',
          items: [{ saleItemId: 'it-edit-1', quantity: 1 }],
          reason: 'Corrected quantity from 2 to 1',
          refundCashDifference: true,
        },
        adminActor
      )

      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminActor.id,
            action: 'SALE_UPDATE',
            entity: 'Sale',
            entityId: 'sale-edit-audit',
            oldData: expect.objectContaining({
              totalAmount: 224,
              subtotal: 200,
            }),
            newData: expect.objectContaining({
              totalAmount: 112,
              reason: 'Corrected quantity from 2 to 1',
            }),
            metadata: expect.objectContaining({
              invoiceNumber: 'INV-EDIT-AUDIT',
              oldTotal: 224,
              newTotal: 112,
              reason: 'Corrected quantity from 2 to 1',
            }),
          }),
        })
      )
    })
  })
})
