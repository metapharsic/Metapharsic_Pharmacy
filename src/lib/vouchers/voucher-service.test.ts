import {
  createReceiptVoucherSchema,
  billAllocationInputSchema,
} from './voucher-validations'
import {
  buildReceiptVoucherTallyXml,
  createReceiptVoucher,
} from './voucher-service'
import prisma from '@/lib/db/prisma'

// Mock prisma client
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ledger: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sale: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    voucher: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    voucherEntry: {
      create: jest.fn(),
    },
    billAllocation: {
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
    },
    customerLedger: {
      create: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}))

describe('Receipt Voucher & Bill Allocations Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Zod Validations', () => {
    it('validates that sum of bill allocations strictly equals receipt amount', () => {
      const validPayload = {
        branchId: 'br-1',
        debitLedgerId: 'led-1',
        customerId: 'cust-1',
        amount: 1500,
        instrumentType: 'CASH' as const,
        allocations: [
          { refType: 'AGST_REF' as const, invoiceId: 'inv-1', refNumber: 'INV-001', allocatedAmount: 1000 },
          { refType: 'AGST_REF' as const, invoiceId: 'inv-2', refNumber: 'INV-002', allocatedAmount: 500 },
        ],
      }

      const result = createReceiptVoucherSchema.safeParse(validPayload)
      expect(result.success).toBe(true)
    })

    it('rejects payload when allocations sum does not match voucher amount', () => {
      const invalidPayload = {
        branchId: 'br-1',
        debitLedgerId: 'led-1',
        customerId: 'cust-1',
        amount: 1500,
        instrumentType: 'CASH' as const,
        allocations: [
          { refType: 'AGST_REF' as const, invoiceId: 'inv-1', refNumber: 'INV-001', allocatedAmount: 1000 },
          // Total is 1000 != 1500
        ],
      }

      const result = createReceiptVoucherSchema.safeParse(invalidPayload)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('Sum of bill allocations must strictly equal')
      }
    })

    it('enforces that AGST_REF requires an invoiceId', () => {
      const invalidAgstRef = {
        refType: 'AGST_REF' as const,
        invoiceId: '',
        allocatedAmount: 500,
      }

      const result = billAllocationInputSchema.safeParse(invalidAgstRef)
      expect(result.success).toBe(false)
    })

    it('allows ADVANCE and ON_ACCOUNT without invoiceId', () => {
      const validAdvance = {
        refType: 'ADVANCE' as const,
        refNumber: 'ADV-001',
        allocatedAmount: 1200,
      }

      const result = billAllocationInputSchema.safeParse(validAdvance)
      expect(result.success).toBe(true)
    })
  })

  describe('Accounting Service Logic (Double-Entry & Settlement)', () => {
    it('executes atomic double-entry transaction and settles invoices', async () => {
      // Setup mock data
      const mockCustomer = {
        id: 'cust-1',
        name: 'John Doe Clinic',
        outstandingBalance: 5000,
      }

      const mockDebitLedger = {
        id: 'led-cash',
        name: 'Cash on Hand',
        balance: 10000,
      }

      const mockInvoices = [
        { id: 'inv-1', invoiceNumber: 'INV-2026-001', balanceDue: 1000 },
        { id: 'inv-2', invoiceNumber: 'INV-2026-002', balanceDue: 2000 },
      ]

      ;(prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer)
      ;(prisma.ledger.findUnique as jest.Mock).mockResolvedValue(mockDebitLedger)
      ;(prisma.sale.findMany as jest.Mock).mockResolvedValue(mockInvoices)

      ;(prisma.voucher.findFirst as jest.Mock).mockResolvedValue(null) // First voucher of year
      ;(prisma.voucher.create as jest.Mock).mockResolvedValue({
        id: 'vch-123',
        voucherNumber: 'RC-2026-0001',
      })
      ;(prisma.voucherEntry.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'dr-entry-id', entryType: 'DR' })
        .mockResolvedValueOnce({ id: 'cr-entry-id', entryType: 'CR' })

      ;(prisma.ledger.update as jest.Mock).mockResolvedValue({ balance: 11500 })
      ;(prisma.customer.update as jest.Mock).mockResolvedValue({ outstandingBalance: 3500 })

      // Mock individual sale checks during settlement
      ;(prisma.sale.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({
          id: 'inv-1',
          invoiceNumber: 'INV-2026-001',
          balanceDue: 1000,
          amountPaid: 0,
        })
        .mockResolvedValueOnce({
          id: 'inv-2',
          invoiceNumber: 'INV-2026-002',
          balanceDue: 2000,
          amountPaid: 500,
        })

      ;(prisma.voucher.findUnique as jest.Mock).mockResolvedValue({
        id: 'vch-123',
        voucherNumber: 'RC-2026-0001',
        voucherType: 'RECEIPT',
        date: new Date(),
        narration: 'Receipt test',
        entries: [
          {
            entryType: 'DR',
            amount: 1500,
            ledger: { id: 'led-cash', name: 'Cash on Hand', group: 'Cash-in-Hand' },
          },
          {
            entryType: 'CR',
            amount: 1500,
            customer: { id: 'cust-1', name: 'John Doe Clinic' },
            allocations: [
              {
                id: 'alloc-1',
                refType: 'AGST_REF',
                refNumber: 'INV-2026-001',
                allocatedAmount: 1000,
                invoice: { id: 'inv-1', invoiceNumber: 'INV-2026-001', totalAmount: 1000, balanceDue: 0 },
              },
              {
                id: 'alloc-2',
                refType: 'AGST_REF',
                refNumber: 'INV-2026-002',
                allocatedAmount: 500,
                invoice: { id: 'inv-2', invoiceNumber: 'INV-2026-002', totalAmount: 2500, balanceDue: 1500 },
              },
            ],
          },
        ],
      })

      const input = {
        branchId: 'br-1',
        debitLedgerId: 'led-cash',
        customerId: 'cust-1',
        amount: 1500,
        instrumentType: 'CASH' as const,
        date: new Date('2026-09-17'),
        allocations: [
          { refType: 'AGST_REF' as const, invoiceId: 'inv-1', allocatedAmount: 1000 },
          { refType: 'AGST_REF' as const, invoiceId: 'inv-2', allocatedAmount: 500 },
        ],
      }

      const result = await createReceiptVoucher(input, { id: 'usr-1', name: 'Admin' })

      // Verify DR Entry (Debit Cash on Hand +1500)
      expect(prisma.ledger.update).toHaveBeenCalledWith({
        where: { id: 'led-cash' },
        data: { balance: { increment: 1500 } },
      })
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DEBIT',
          amount: 1500,
        }),
      })

      // Verify CR Entry (Credit Customer -1500)
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { outstandingBalance: { decrement: 1500 } },
      })
      expect(prisma.customerLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CREDIT',
          amount: 1500,
        }),
      })

      // Verify Invoice Settlement status
      // Inv 1: fully paid (balanceDue = 0 -> PAID)
      expect(prisma.sale.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: {
          balanceDue: 0,
          amountPaid: 1000,
          paymentStatus: 'PAID',
        },
      })

      // Inv 2: partially paid (balanceDue 2000 - 500 = 1500 -> PARTIAL)
      expect(prisma.sale.update).toHaveBeenCalledWith({
        where: { id: 'inv-2' },
        data: {
          balanceDue: 1500,
          amountPaid: 1000,
          paymentStatus: 'PARTIAL',
        },
      })

      // Verify POS Payment audit records created
      expect(prisma.payment.create).toHaveBeenCalledTimes(2)

      expect(result).toBeDefined()
      expect(result?.voucherNumber).toBe('RC-2026-0001')
    })
  })

  describe('Tally XML Generation', () => {
    it('generates valid Tally ERP XML structure for receipt vouchers', async () => {
      ;(prisma.voucher.findUnique as jest.Mock).mockResolvedValue({
        id: 'vch-123',
        voucherNumber: 'RC-2026-0001',
        voucherType: 'RECEIPT',
        date: new Date('2026-09-17T10:00:00Z'),
        narration: 'Settlement from John Doe Clinic',
        entries: [
          {
            entryType: 'DR',
            amount: 2500,
            ledger: { id: 'led-1', name: 'HDFC Bank Current A/c', group: 'Bank Accounts' },
          },
          {
            entryType: 'CR',
            amount: 2500,
            customer: { id: 'cust-1', name: 'John Doe Clinic' },
            allocations: [
              {
                id: 'al-1',
                refType: 'AGST_REF',
                refNumber: 'INV-2026-001',
                allocatedAmount: 2000,
                invoice: { id: 'i-1', invoiceNumber: 'INV-2026-001' },
              },
              {
                id: 'al-2',
                refType: 'ADVANCE',
                refNumber: 'ADVANCE',
                allocatedAmount: 500,
              },
            ],
          },
        ],
      })

      const xml = await buildReceiptVoucherTallyXml('vch-123')

      expect(xml).toContain('<VOUCHER VCHTYPE="Receipt" ACTION="Create">')
      expect(xml).toContain('<VOUCHERNUMBER>RC-2026-0001</VOUCHERNUMBER>')
      expect(xml).toContain('<LEDGERNAME>John Doe Clinic</LEDGERNAME>')
      expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>')
      expect(xml).toContain('<BILLTYPE>Agst Ref</BILLTYPE>')
      expect(xml).toContain('<NAME>INV-2026-001</NAME>')
      expect(xml).toContain('<BILLTYPE>Advance</BILLTYPE>')
      expect(xml).toContain('<LEDGERNAME>HDFC Bank Current A/c</LEDGERNAME>')
      expect(xml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>')
      expect(xml).toContain('<AMOUNT>-2500.00</AMOUNT>')
    })
  })
})
