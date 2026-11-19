import prisma from '@/lib/db/prisma'
import {
  getLowStockCandidates,
  generateLowStockPurchaseOrders,
} from './auto-po-service'

jest.mock('@/lib/db/prisma', () => {
  const inventory = { findMany: jest.fn() }
  const supplier = { findMany: jest.fn() }
  const purchase = { findMany: jest.fn(), create: jest.fn() }
  const purchaseItem = { findMany: jest.fn() }
  const product = { findMany: jest.fn() }
  const branch = { findMany: jest.fn() }
  const auditLog = { create: jest.fn() }
  const client: Record<string, unknown> = {
    inventory,
    supplier,
    purchase,
    purchaseItem,
    product,
    branch,
    auditLog,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(client)),
  }
  return {
    __esModule: true,
    default: client,
    prisma: client,
  }
})

jest.mock('@/lib/inventory/branch-access', () => ({
  assertBranchAccess: jest.fn().mockResolvedValue(true),
}))

describe('auto-po-service Unit Tests', () => {
  const mockActor = {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@pharmacare.local',
    branchId: 'branch-1',
    roles: ['owner'],
    permissions: ['purchases:create', 'purchases:read'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getLowStockCandidates', () => {
    it('identifies products at or below reorder level and computes suggested order quantities', async () => {
      // 1 low-stock item, 1 healthy item
      ;(prisma.inventory.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'inv-1',
          productId: 'prod-dolo',
          branchId: 'branch-1',
          availableQuantity: 5,
          totalQuantity: 5,
          product: {
            id: 'prod-dolo',
            name: 'Dolo 650mg',
            sku: 'DOLO-650',
            barcode: '123456',
            unitOfMeasure: 'Strip',
            reorderLevel: 20,
            minStockLevel: 10,
            maxStockLevel: 50,
            costPrice: 25,
            ptr: 28,
            mrp: 35,
            gstRate: 12,
          },
          branch: { id: 'branch-1', name: 'Main Branch' },
        },
        {
          id: 'inv-2',
          productId: 'prod-paracetamol',
          branchId: 'branch-1',
          availableQuantity: 100,
          totalQuantity: 100,
          product: {
            id: 'prod-paracetamol',
            name: 'Paracetamol 500mg',
            sku: 'PCM-500',
            reorderLevel: 20,
            minStockLevel: 10,
            maxStockLevel: null,
            costPrice: 15,
            ptr: null,
            mrp: 20,
            gstRate: 12,
          },
          branch: { id: 'branch-1', name: 'Main Branch' },
        },
      ])

      ;(prisma.supplier.findMany as jest.Mock).mockResolvedValue([
        { id: 'sup-1', name: 'MedLife Distributors' },
      ])

      // No open POs
      ;(prisma.purchase.findMany as jest.Mock).mockResolvedValue([])

      // Purchase history exists from sup-1
      ;(prisma.purchaseItem.findMany as jest.Mock).mockResolvedValue([
        {
          productId: 'prod-dolo',
          unitCost: 24,
          purchase: {
            supplier: { id: 'sup-1', name: 'MedLife Distributors', isActive: true },
          },
        },
      ])

      const candidates = await getLowStockCandidates('branch-1')

      expect(candidates).toHaveLength(1)
      const dolo = candidates[0]
      expect(dolo.productId).toBe('prod-dolo')
      expect(dolo.availableQuantity).toBe(5)
      expect(dolo.reorderLevel).toBe(20)
      // Target is maxStockLevel (50); suggested qty = 50 - 5 = 45
      expect(dolo.suggestedQuantity).toBe(45)
      expect(dolo.suggestedSupplierId).toBe('sup-1')
      expect(dolo.suggestedSupplierName).toBe('MedLife Distributors')
      expect(dolo.estimatedUnitCost).toBe(24)
      expect(dolo.hasPendingPo).toBe(false)
      expect(dolo.pendingPoNumber).toBeNull()
    })

    it('flags items with existing open DRAFT or ORDERED PO as hasPendingPo', async () => {
      ;(prisma.inventory.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'inv-1',
          productId: 'prod-amox',
          branchId: 'branch-1',
          availableQuantity: 2,
          totalQuantity: 2,
          product: {
            id: 'prod-amox',
            name: 'Amoxicillin 500mg',
            sku: 'AMOX-500',
            barcode: null,
            unitOfMeasure: 'Strip',
            reorderLevel: 15,
            minStockLevel: 10,
            maxStockLevel: null,
            costPrice: 40,
            ptr: null,
            mrp: 60,
            gstRate: 12,
          },
          branch: { id: 'branch-1', name: 'Main Branch' },
        },
      ])

      ;(prisma.supplier.findMany as jest.Mock).mockResolvedValue([
        { id: 'sup-1', name: 'MedLife Distributors' },
      ])

      // Existing open PO found
      ;(prisma.purchase.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'po-open-1',
          purchaseNumber: 'PO-2026-099',
          branchId: 'branch-1',
          items: [{ productId: 'prod-amox' }],
        },
      ])

      ;(prisma.purchaseItem.findMany as jest.Mock).mockResolvedValue([])

      const candidates = await getLowStockCandidates('branch-1')

      expect(candidates).toHaveLength(1)
      expect(candidates[0].hasPendingPo).toBe(true)
      expect(candidates[0].pendingPoNumber).toBe('PO-2026-099')
    })
  })

  describe('generateLowStockPurchaseOrders', () => {
    it('groups low-stock items by supplier and creates draft POs', async () => {
      // Mock pre-fetch queries
      ;(prisma.product.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'p1',
          name: 'Med 1',
          sku: 'M1',
          mrp: 100,
          ptr: 80,
          costPrice: 70,
          gstRate: 12,
        },
        {
          id: 'p2',
          name: 'Med 2',
          sku: 'M2',
          mrp: 50,
          ptr: 40,
          costPrice: 35,
          gstRate: 12,
        },
      ])

      ;(prisma.supplier.findMany as jest.Mock).mockResolvedValue([
        { id: 'sup-sun', name: 'Sun Pharma Ltd' },
      ])

      ;(prisma.branch.findMany as jest.Mock).mockResolvedValue([
        { id: 'b1', name: 'Main Branch' },
      ])

      // No open POs exist
      ;(prisma.purchase.findMany as jest.Mock).mockResolvedValue([])

      const mockCreatedPo = {
        id: 'new-po-123',
        purchaseNumber: 'PO-AUTO-20260924-001',
        branchId: 'b1',
        supplierId: 'sup-sun',
        status: 'DRAFT',
      }
      ;(prisma.purchase.create as jest.Mock).mockResolvedValue(mockCreatedPo)

      const result = await generateLowStockPurchaseOrders(
        {
          branchId: 'b1',
          items: [
            {
              productId: 'p1',
              branchId: 'b1',
              supplierId: 'sup-sun',
              orderedQuantity: 20,
              unitCost: 70,
            },
            {
              productId: 'p2',
              branchId: 'b1',
              supplierId: 'sup-sun',
              orderedQuantity: 30,
              unitCost: 35,
            },
          ],
        },
        mockActor
      )

      expect(result.success).toBe(true)
      expect(result.purchases).toHaveLength(1)
      const po = result.purchases[0]
      expect(po.supplierId).toBe('sup-sun')
      expect(po.itemCount).toBe(2)
      expect(po.totalQuantity).toBe(50)
      // p1: 20 * 70 = 1400 subtotal, 12% tax = 168, total = 1568
      // p2: 30 * 35 = 1050 subtotal, 12% tax = 126, total = 1176
      // groupSubtotal = 2450, groupTax = 294, groupTotal = 2744
      expect(po.subtotal).toBe(2450)
      expect(po.taxAmount).toBe(294)
      expect(po.totalAmount).toBe(2744)

      expect(prisma.purchase.create).toHaveBeenCalledTimes(1)
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PURCHASE_AUTO_CREATE',
            userId: 'user-admin',
          }),
        })
      )
    })

    it('skips items if an open PO already exists (anti-duplication)', async () => {
      ;(prisma.product.findMany as jest.Mock).mockResolvedValue([
        { id: 'p1', name: 'Med 1', sku: 'M1', mrp: 100, costPrice: 70, gstRate: 12 },
      ])
      ;(prisma.supplier.findMany as jest.Mock).mockResolvedValue([
        { id: 'sup-sun', name: 'Sun Pharma Ltd' },
      ])
      ;(prisma.branch.findMany as jest.Mock).mockResolvedValue([
        { id: 'b1', name: 'Main Branch' },
      ])

      // Open PO already exists for p1 in b1
      ;(prisma.purchase.findMany as jest.Mock).mockResolvedValue([
        {
          branchId: 'b1',
          items: [{ productId: 'p1' }],
        },
      ])

      const result = await generateLowStockPurchaseOrders(
        {
          branchId: 'b1',
          items: [
            {
              productId: 'p1',
              branchId: 'b1',
              supplierId: 'sup-sun',
              orderedQuantity: 20,
              unitCost: 70,
            },
          ],
        },
        mockActor
      )

      expect(result.success).toBe(true)
      expect(result.purchases).toHaveLength(0)
      expect(result.message).toContain('already have pending purchase orders')
      expect(prisma.purchase.create).not.toHaveBeenCalled()
    })
  })
})
