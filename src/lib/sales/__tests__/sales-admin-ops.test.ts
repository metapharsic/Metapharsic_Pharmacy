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

describe('Sales Admin Operations & RBAC Lockdown (Requirement R4)', () => {
  const cashierActor: SaleActor = {
    id: 'cashier-1',
    branchId: 'branch-A',
    permissions: ['sales:create', 'sales:read', 'invoices:print'],
    roles: ['cashier'],
  }

  const pharmacistActor: SaleActor = {
    id: 'pharma-1',
    branchId: 'branch-A',
    permissions: ['sales:create', 'sales:read', 'sales:discount'],
    roles: ['pharmacist'],
  }

  const adminActor: SaleActor = {
    id: 'admin-1',
    branchId: 'branch-A',
    permissions: ['sales:void'],
    roles: ['admin'],
  }

  const managerActor: SaleActor = {
    id: 'mgr-1',
    branchId: 'branch-A',
    permissions: ['sales:create', 'sales:read'],
    roles: ['manager'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('RBAC Authorization Enforcement', () => {
    it('blocks Cashier with sales:create from editing sales (403 Forbidden)', async () => {
      await expect(
        editSale(
          {
            saleId: 'sale-1',
            items: [{ saleItemId: 'item-1', quantity: 1 }],
            reason: 'Cashier attempt',
          },
          cashierActor
        )
      ).rejects.toThrow('Forbidden: requires permission sales:void or Admin role to edit sales')
    })

    it('blocks Pharmacist without sales:void from editing sales (403 Forbidden)', async () => {
      await expect(
        editSale(
          {
            saleId: 'sale-1',
            items: [{ saleItemId: 'item-1', quantity: 1 }],
            reason: 'Pharmacist attempt',
          },
          pharmacistActor
        )
      ).rejects.toThrow('Forbidden: requires permission sales:void or Admin role to edit sales')
    })

    it('blocks Cashier with sales:create from cancelling sales (403 Forbidden)', async () => {
      await expect(cancelSale('sale-1', 'Cashier cancel attempt', cashierActor)).rejects.toThrow(
        'Forbidden: requires permission sales:void or Admin role to cancel sales'
      )
    })

    it('blocks Pharmacist without sales:void from cancelling sales (403 Forbidden)', async () => {
      await expect(cancelSale('sale-1', 'Pharma cancel attempt', pharmacistActor)).rejects.toThrow(
        'Forbidden: requires permission sales:void or Admin role to cancel sales'
      )
    })
  })

  describe('Admin Bill Modification (editSale)', () => {
    it('allows Admin to edit sale, restores stock diff, and records enriched AuditLog with snapshots', async () => {
      const mockSale = {
        id: 'sale-1',
        invoiceNumber: 'INV-A-0001',
        branchId: 'branch-A',
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
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Paracetamol 500mg',
            productSku: 'P-001',
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
            itemBatches: [
              {
                id: 'ib-1',
                batchId: 'batch-1',
                quantity: 2,
              },
            ],
          },
        ],
        payments: [{ id: 'pmt-1', method: 'CASH', amount: new Prisma.Decimal(224) }],
        branch: { id: 'branch-A', code: 'BR-A' },
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
              id: 'item-1',
              productId: 'prod-1',
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
        saleItemBatch: {
          update: jest.fn().mockResolvedValue({}),
        },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-1',
            quantity: 10,
            soldQuantity: 10,
            status: 'EXHAUSTED',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: {
          create: jest.fn().mockResolvedValue({}),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            availableQuantity: 0,
            totalQuantity: 0,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        payment: {
          create: jest.fn().mockResolvedValue({}),
        },
        gstTransaction: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await editSale(
        {
          saleId: 'sale-1',
          items: [{ saleItemId: 'item-1', quantity: 1 }],
          reason: 'Customer only purchased 1 strip',
          refundCashDifference: true,
        },
        adminActor
      )

      // 1. Stock restoration to batch and inventory
      expect(txMock.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            totalQuantity: { increment: 1 },
            availableQuantity: { increment: 1 },
          }),
        })
      )
      expect(txMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RETURN_IN',
            quantity: 1,
            referenceType: 'SALE',
            referenceId: 'sale-1',
          }),
        })
      )

      // 2. Batch status reactivated from EXHAUSTED to ACTIVE
      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-1' },
          data: expect.objectContaining({
            soldQuantity: 9,
            status: 'ACTIVE',
          }),
        })
      )
      expect(txMock.batchStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'EXHAUSTED',
            toStatus: 'ACTIVE',
          }),
        })
      )

      // 3. Enriched AuditLog snapshot recorded
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SALE_UPDATE',
            entity: 'Sale',
            entityId: 'sale-1',
            oldData: expect.objectContaining({
              totalAmount: 224,
            }),
            newData: expect.objectContaining({
              reason: 'Customer only purchased 1 strip',
            }),
          }),
        })
      )
    })
  })

  describe('Admin Bill Cancellation & Inventory Reversal (cancelSale)', () => {
    it('cancels sale, restores inventory & batch, reactivates EXHAUSTED batch, and records SALE_CANCEL audit log', async () => {
      const mockSale = {
        id: 'sale-100',
        invoiceNumber: 'INV-A-0100',
        branchId: 'branch-A',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(500),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-100',
            productId: 'prod-100',
            productName: 'Amoxicillin 500mg',
            quantity: 5,
            returnedQuantity: 0,
            itemBatches: [
              {
                id: 'ib-100',
                batchId: 'batch-100',
                quantity: 5,
              },
            ],
          },
        ],
        customer: null,
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({}),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-100',
            availableQuantity: 10,
            totalQuantity: 10,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-100',
            quantity: 5,
            soldQuantity: 5,
            status: 'EXHAUSTED',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: {
          create: jest.fn().mockResolvedValue({}),
        },
        gstTransaction: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        doctorCommission: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-100', 'Entered under wrong doctor prescription', adminActor)

      // 1. Soft delete update
      expect(txMock.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-100' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledReason: 'Entered under wrong doctor prescription',
          }),
        })
      )

      // 2. Inventory total & available incremented
      expect(txMock.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-100' },
          data: {
            totalQuantity: { increment: 5 },
            availableQuantity: { increment: 5 },
          },
        })
      )

      // 3. Movement RETURN_IN recorded
      expect(txMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RETURN_IN',
            quantity: 5,
            referenceType: 'SALE',
            referenceId: 'sale-100',
          }),
        })
      )

      // 4. Batch soldQuantity decremented and reactivated to ACTIVE
      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-100' },
          data: {
            soldQuantity: 0,
            status: 'ACTIVE',
          },
        })
      )
      expect(txMock.batchStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: 'batch-100',
            fromStatus: 'EXHAUSTED',
            toStatus: 'ACTIVE',
          }),
        })
      )

      // 5. AuditLog SALE_CANCEL recorded
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SALE_CANCEL',
            entity: 'Sale',
            entityId: 'sale-100',
            metadata: expect.objectContaining({
              invoiceNumber: 'INV-A-0100',
              reason: 'Entered under wrong doctor prescription',
            }),
          }),
        })
      )
    })

    it('protects against phantom stock on partial returns (only restores net unreturned quantity)', async () => {
      // Sale had 10 tablets billed, but 2 were previously returned via customer return
      const mockSale = {
        id: 'sale-200',
        invoiceNumber: 'INV-A-0200',
        branchId: 'branch-A',
        status: 'PARTIALLY_RETURNED',
        totalAmount: new Prisma.Decimal(1000),
        balanceDue: new Prisma.Decimal(0),
        items: [
          {
            id: 'item-200',
            productId: 'prod-200',
            productName: 'Ciprofloxacin 500mg',
            quantity: 10,
            returnedQuantity: 2, // 2 already returned to stock earlier!
            itemBatches: [
              {
                id: 'ib-200',
                batchId: 'batch-200',
                quantity: 10,
              },
            ],
          },
        ],
        customer: null,
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({}),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-200',
            availableQuantity: 2,
            totalQuantity: 2,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        batch: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'batch-200',
            quantity: 10,
            soldQuantity: 10,
            status: 'EXHAUSTED',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: {
          create: jest.fn().mockResolvedValue({}),
        },
        gstTransaction: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        doctorCommission: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-200', 'Void remaining bill', managerActor)

      // Only net quantity 8 must be restored, NOT 10!
      expect(txMock.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            totalQuantity: { increment: 8 },
            availableQuantity: { increment: 8 },
          },
        })
      )
      expect(txMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 8,
          }),
        })
      )
      expect(txMock.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            soldQuantity: 2, // 10 - 8 = 2
            status: 'ACTIVE',
          },
        })
      )
    })

    it('reverses customer ledger and credit balance when cancelling a credit sale with balanceDue', async () => {
      const mockSale = {
        id: 'sale-300',
        invoiceNumber: 'INV-A-0300',
        branchId: 'branch-A',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(800),
        balanceDue: new Prisma.Decimal(800),
        customerId: 'cust-1',
        items: [],
        customer: { id: 'cust-1' },
      }

      const txMock = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(mockSale),
          update: jest.fn().mockResolvedValue({}),
        },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cust-1',
            outstandingBalance: new Prisma.Decimal(800),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        customerLedger: {
          create: jest.fn().mockResolvedValue({}),
        },
        gstTransaction: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        doctorCommission: {
          deleteMany: jest.fn().mockResolvedValue({}),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({}),
        },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(txMock))

      await cancelSale('sale-300', 'Customer cancelled order before pickup', adminActor)

      expect(txMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: {
            outstandingBalance: new Prisma.Decimal(0),
          },
        })
      )
      expect(txMock.customerLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            type: 'CREDIT',
            amount: new Prisma.Decimal(800),
            balance: new Prisma.Decimal(0),
            referenceType: 'SALE',
            referenceId: 'sale-300',
          }),
        })
      )
    })
  })
})
