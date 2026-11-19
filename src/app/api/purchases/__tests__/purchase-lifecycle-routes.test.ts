/** @jest-environment node */
import { NextRequest } from 'next/server'

import { POST as advancedGrnPOST } from '@/app/api/purchases/[id]/advanced-grn/route'
import { POST as invoiceMatchPOST } from '@/app/api/purchases/[id]/invoice-match/route'
import { GET as pipelineGET } from '@/app/api/purchases/pipeline/route'
import { GET as quotationsGET, POST as quotationsPOST } from '@/app/api/purchases/quotations/route'
import { POST as approvePrPOST } from '@/app/api/purchases/requisitions/[id]/approve/route'
import { POST as consolidatePrPOST } from '@/app/api/purchases/requisitions/consolidate/route'
import { GET as requisitionsGET, POST as requisitionsPOST } from '@/app/api/purchases/requisitions/route'
import { GET as suggestionsGET } from '@/app/api/purchases/requisitions/suggestions/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  approvePurchaseRequisition,
  consolidateAndConvertPrsToPo,
  createPurchaseRequisition,
  getAutoReorderSuggestions,
  getPurchasePipelineAnalytics,
  listPurchaseRequisitions,
  listSupplierQuotations,
  processAdvancedGoodsReceipt,
  processThreeWayMatchAndInvoice,
  recordSupplierQuotation,
} from '@/lib/purchases/purchase-lifecycle-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  assertBranchAccess: jest.fn(),
}))

jest.mock('@/lib/purchases/purchase-lifecycle-service', () => ({
  getPurchasePipelineAnalytics: jest.fn(),
  getAutoReorderSuggestions: jest.fn(),
  createPurchaseRequisition: jest.fn(),
  listPurchaseRequisitions: jest.fn(),
  approvePurchaseRequisition: jest.fn(),
  consolidateAndConvertPrsToPo: jest.fn(),
  recordSupplierQuotation: jest.fn(),
  listSupplierQuotations: jest.fn(),
  processAdvancedGoodsReceipt: jest.fn(),
  processThreeWayMatchAndInvoice: jest.fn(),
}))

const mockedPermission = requirePermission as jest.Mock
const mockedBranchAccess = assertBranchAccess as jest.Mock
const mockedLifecycle = {
  getPurchasePipelineAnalytics: getPurchasePipelineAnalytics as jest.Mock,
  getAutoReorderSuggestions: getAutoReorderSuggestions as jest.Mock,
  createPurchaseRequisition: createPurchaseRequisition as jest.Mock,
  listPurchaseRequisitions: listPurchaseRequisitions as jest.Mock,
  approvePurchaseRequisition: approvePurchaseRequisition as jest.Mock,
  consolidateAndConvertPrsToPo: consolidateAndConvertPrsToPo as jest.Mock,
  recordSupplierQuotation: recordSupplierQuotation as jest.Mock,
  listSupplierQuotations: listSupplierQuotations as jest.Mock,
  processAdvancedGoodsReceipt: processAdvancedGoodsReceipt as jest.Mock,
  processThreeWayMatchAndInvoice: processThreeWayMatchAndInvoice as jest.Mock,
}

describe('Purchase Lifecycle Routes', () => {
  const dummyUser = { id: 'usr_1', email: 'purchaser@pharmacy.com', branchId: 'br_1', roles: ['ADMIN'] }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedPermission.mockResolvedValue(dummyUser)
    mockedBranchAccess.mockResolvedValue(undefined)
  })

  describe('GET /api/purchases/pipeline', () => {
    it('returns purchase pipeline analytics and payables ageing', async () => {
      mockedLifecycle.getPurchasePipelineAnalytics.mockResolvedValue({
        metrics: { totalOrders: 5, totalCommitment: 50000 },
        payables: { totalOutstanding: 15000, dueWithin7Days: 5000, overdue: 2000 },
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/pipeline?branchId=br_1')
      const res = await pipelineGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.payables.totalOutstanding).toBe(15000)
    })

    it('returns 403 Forbidden when requested branch does not belong to organization', async () => {
      mockedBranchAccess.mockRejectedValueOnce(
        new Error("Forbidden: Branch 'foreign_branch' does not belong to organization 'org_1'")
      )

      const req = new NextRequest('http://localhost:3000/api/purchases/pipeline?branchId=foreign_branch')
      const res = await pipelineGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })
  })

  describe('Purchase Requisitions (PR) Routes', () => {
    it('GET /api/purchases/requisitions returns requisition list', async () => {
      mockedLifecycle.listPurchaseRequisitions.mockResolvedValue([
        { id: 'pr_1', prNumber: 'PR-2026-001', requiredQuantity: 100, status: 'SUBMITTED' },
      ])

      const req = new NextRequest('http://localhost:3000/api/purchases/requisitions?status=SUBMITTED')
      const res = await requisitionsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].prNumber).toBe('PR-2026-001')
    })

    it('POST /api/purchases/requisitions creates new internal PR', async () => {
      mockedLifecycle.createPurchaseRequisition.mockResolvedValue({
        id: 'pr_new',
        prNumber: 'PR-2026-002',
        productId: 'prod_1',
        requiredQuantity: 60,
        status: 'SUBMITTED',
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/requisitions', {
        method: 'POST',
        body: JSON.stringify({
          branchId: 'br_1',
          productId: 'prod_1',
          requiredQuantity: 60,
          requiredByDate: '2026-11-05T00:00:00.000Z',
          priority: 'URGENT',
        }),
      })

      const res = await requisitionsPOST(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.requiredQuantity).toBe(60)
    })

    it('GET /api/purchases/requisitions/suggestions calculates reorder replenishment', async () => {
      mockedLifecycle.getAutoReorderSuggestions.mockResolvedValue({
        totalSuggestions: 2,
        totalEstimatedCost: 4500,
        suggestions: [
          { productId: 'prod_1', productName: 'Paracetamol 500mg', suggestedOrder: 80, urgency: 'CRITICAL' },
        ],
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/requisitions/suggestions?branchId=br_1&targetDays=15')
      const res = await suggestionsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.suggestions[0].suggestedOrder).toBe(80)
    })

    it('GET /api/purchases/requisitions/suggestions returns 403 on foreign branch', async () => {
      mockedBranchAccess.mockRejectedValueOnce(
        new Error("Forbidden: no access to branch 'br_foreign'")
      )

      const req = new NextRequest('http://localhost:3000/api/purchases/requisitions/suggestions?branchId=br_foreign&targetDays=15')
      const res = await suggestionsGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('POST /api/purchases/requisitions/[id]/approve approves PR', async () => {
      mockedLifecycle.approvePurchaseRequisition.mockResolvedValue({
        success: true,
        message: 'Purchase requisition approved',
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/requisitions/pr_1/approve', {
        method: 'POST',
      })
      const res = await approvePrPOST(req, { params: { id: 'pr_1' } })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('POST /api/purchases/requisitions/consolidate converts PRs to PO', async () => {
      mockedLifecycle.consolidateAndConvertPrsToPo.mockResolvedValue({
        purchaseId: 'po_123',
        purchaseNumber: 'PO-2026-00125',
        itemCount: 2,
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/requisitions/consolidate', {
        method: 'POST',
        body: JSON.stringify({
          prIds: ['pr_1', 'pr_2'],
          supplierId: 'sup_1',
          branchId: 'br_1',
          notes: 'Combined order for bulk discount',
        }),
      })

      const res = await consolidatePrPOST(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.purchaseNumber).toBe('PO-2026-00125')
    })
  })

  describe('Supplier Quotation Matrix Routes', () => {
    it('GET /api/purchases/quotations returns quotation matrix', async () => {
      mockedLifecycle.listSupplierQuotations.mockResolvedValue([
        {
          id: 'q_1',
          supplierName: 'ABC Pharma',
          effectiveLandedCost: 75.5,
          riskRating: 'LOW',
        },
      ])

      const req = new NextRequest('http://localhost:3000/api/purchases/quotations?rfqNumber=RFQ-101')
      const res = await quotationsGET(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data[0].supplierName).toBe('ABC Pharma')
    })

    it('GET /api/purchases/quotations returns 403 Forbidden when requested branch does not belong to organization', async () => {
      mockedBranchAccess.mockRejectedValueOnce(
        new Error("Forbidden: Branch 'foreign_branch' does not belong to organization 'org_1'")
      )

      const req = new NextRequest('http://localhost:3000/api/purchases/quotations?branchId=foreign_branch')
      const res = await quotationsGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('POST /api/purchases/quotations records quotation with landed cost calculation', async () => {
      mockedLifecycle.recordSupplierQuotation.mockResolvedValue({
        id: 'q_2',
        supplierId: 'sup_1',
        effectiveLandedCost: 68.2,
        commercialRiskScore: 92,
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/quotations', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: 'sup_1',
          productId: 'prod_1',
          paidQuantity: 100,
          freeQuantity: 10,
          basicRate: 80,
          discountPercent: 10,
          taxPercent: 12,
        }),
      })

      const res = await quotationsPOST(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.effectiveLandedCost).toBe(68.2)
    })
  })

  describe('Invoice 3-Way Matching & Advanced GRN', () => {
    it('POST /api/purchases/[id]/invoice-match records supplier liability on match', async () => {
      mockedLifecycle.processThreeWayMatchAndInvoice.mockResolvedValue({
        success: true,
        matchStatus: 'MATCHED',
        discrepancies: [],
        invoiceTotal: 14000,
        supplierLedgerEntryId: 'ledg_1',
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/po_1/invoice-match', {
        method: 'POST',
        body: JSON.stringify({
          supplierInvoiceNumber: 'INV-2026-999',
          supplierInvoiceDate: '2026-10-27T00:00:00.000Z',
          billedSubtotal: 12500,
          billedTaxAmount: 1500,
          billedTotalAmount: 14000,
          tolerancePercent: 1,
          items: [
            { purchaseItemId: 'pi_1', billedQuantity: 100, billedRate: 80, billedAmount: 8000 },
          ],
        }),
      })

      const res = await invoiceMatchPOST(req, { params: { id: 'po_1' } })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.matchStatus).toBe('MATCHED')
    })

    it('POST /api/purchases/[id]/advanced-grn processes receipt with QC and cold chain', async () => {
      mockedLifecycle.processAdvancedGoodsReceipt.mockResolvedValue({
        success: true,
        grnNumber: 'GRN-2026-004',
        totalAccepted: 95,
        totalRejected: 5,
      })

      const req = new NextRequest('http://localhost:3000/api/purchases/po_1/advanced-grn', {
        method: 'POST',
        body: JSON.stringify({
          branchId: 'br_1',
          grnNumber: 'GRN-2026-004',
          coldChainChecked: true,
          receivedTemperature: 4.5,
          temperatureExcursion: false,
          items: [
            {
              purchaseItemId: 'pi_1',
              batchNumber: 'BCH-2026-X1',
              expiryDate: '2028-10-27T00:00:00.000Z',
              deliveredQuantity: 100,
              acceptedQuantity: 95,
              rejectedQuantity: 5,
              purchasePrice: 80,
              mrp: 120,
              qualityCheckPassed: true,
              rejectionReason: 'Damaged packaging on 5 strips',
            },
          ],
        }),
      })

      const res = await advancedGrnPOST(req, { params: { id: 'po_1' } })
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.totalAccepted).toBe(95)
      expect(data.data.totalRejected).toBe(5)
    })
  })
})
