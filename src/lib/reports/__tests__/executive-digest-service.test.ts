/** @jest-environment node */

import { formatWhatsAppInvoiceText } from '@/components/sales/whatsapp-invoice-dialog'
import { prisma } from '@/lib/db/prisma'
import {
  ExecutiveDigestService,
  generateDailyDigestText,
  generateExecutiveDigest,
  generateMonthlyDigestText,
  generateWeeklyDigestText,
  sendExecutiveDigest,
} from '@/lib/reports/executive-digest-service'
import {
  generateWaMeLink,
  normalizePhoneNumber,
  WhatsAppService,
} from '@/lib/whatsapp/whatsapp-service'

jest.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    branch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    sale: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    customer: {
      aggregate: jest.fn(),
    },
    supplier: {
      aggregate: jest.fn(),
    },
  }
  return {
    __esModule: true,
    prisma: mockPrisma,
    default: mockPrisma,
  }
})

describe('Executive Digest Service & WhatsApp Sharing Engine (Milestone 3 / Requirement R3)', () => {
  const mockedPrisma = prisma as unknown as {
    branch: { findUnique: jest.Mock; findFirst: jest.Mock }
    sale: { findMany: jest.Mock; findFirst: jest.Mock }
    customer: { aggregate: jest.Mock }
    supplier: { aggregate: jest.Mock }
  }

  const sampleBranch = {
    id: 'br-main',
    name: 'Metapharsic Central Dispensary',
    phone: '+919876543210',
    organization: {
      id: 'org-01',
      name: 'Metapharsic Pharmacare Ltd',
    },
  }

  const sampleSales = [
    {
      id: 'sale-01',
      invoiceNumber: 'INV-2026-101',
      saleDate: new Date('2026-11-02T10:30:00.000Z'),
      subtotal: 1000,
      taxAmount: 120,
      discountAmount: 40,
      totalAmount: 1080,
      prescriptionId: 'rx-01',
      payments: [
        { method: 'CASH', amount: 500 },
        { method: 'UPI', amount: 580 },
      ],
      items: [
        {
          productId: 'prod-01',
          productName: 'Paracetamol 650mg',
          quantity: 10,
          unitPrice: 30,
          totalAmount: 300,
          product: { drugSchedule: 'SCHEDULE_OTC', name: 'Paracetamol 650mg' },
          itemBatches: [{ batch: { purchasePrice: 20 }, quantity: 10 }],
        },
        {
          productId: 'prod-02',
          productName: 'Amoxicillin 500mg',
          quantity: 15,
          unitPrice: 52,
          totalAmount: 780,
          product: { drugSchedule: 'H', name: 'Amoxicillin 500mg' },
          itemBatches: [{ batch: { purchasePrice: 35 }, quantity: 15 }],
        },
      ],
    },
    {
      id: 'sale-02',
      invoiceNumber: 'INV-2026-102',
      saleDate: new Date('2026-11-02T14:15:00.000Z'),
      subtotal: 500,
      taxAmount: 60,
      discountAmount: 20,
      totalAmount: 540,
      prescriptionId: null,
      payments: [{ method: 'CARD', amount: 540 }],
      items: [
        {
          productId: 'prod-01',
          productName: 'Paracetamol 650mg',
          quantity: 5,
          unitPrice: 30,
          totalAmount: 150,
          product: { drugSchedule: 'SCHEDULE_OTC', name: 'Paracetamol 650mg' },
          itemBatches: [{ batch: { purchasePrice: 20 }, quantity: 5 }],
        },
        {
          productId: 'prod-03',
          productName: 'Cetirizine 10mg',
          quantity: 20,
          unitPrice: 19.5,
          totalAmount: 390,
          product: { drugSchedule: 'H1', name: 'Cetirizine 10mg' },
          itemBatches: [{ batch: { purchasePrice: 12 }, quantity: 20 }],
        },
      ],
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockedPrisma.branch.findUnique.mockResolvedValue(sampleBranch)
    mockedPrisma.branch.findFirst.mockResolvedValue(sampleBranch)
    mockedPrisma.sale.findMany.mockResolvedValue(sampleSales)
    mockedPrisma.customer.aggregate.mockResolvedValue({
      _sum: { outstandingBalance: 12450.0 },
    })
    mockedPrisma.supplier.aggregate.mockResolvedValue({
      _sum: { outstandingBalance: 34800.0 },
    })
  })

  // ─── 1. Phone Normalization ─────────────────────────────────
  describe('Phone Normalization & International Format Parsing', () => {
    it('normalizes 10-digit Indian mobile numbers to E.164 and clean digits', () => {
      const res = normalizePhoneNumber('9876543210')
      expect(res.e164).toBe('+919876543210')
      expect(res.cleanDigits).toBe('919876543210')
    })

    it('strips dashes, spaces, and brackets while preserving international country codes', () => {
      const res = normalizePhoneNumber('+91 (987) 654-3210')
      expect(res.e164).toBe('+919876543210')
      expect(res.cleanDigits).toBe('919876543210')

      const usNumber = normalizePhoneNumber('+1 (800) 555-0199')
      expect(usNumber.e164).toBe('+18005550199')
      expect(usNumber.cleanDigits).toBe('18005550199')
    })
  })

  // ─── 2. WhatsApp Deep Links ──────────────────────────────────
  describe('WhatsApp 1-Click Deep Links (wa.me)', () => {
    it('generates a valid wa.me URL with clean digits and URI-encoded message text', () => {
      const phone = '9876543210'
      const message = '🏥 *TAX INVOICE: INV-1001*\nNet Amount: ₹1,620.00\nDownload PDF: http://localhost/pdf'
      const link = generateWaMeLink(phone, message)

      expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true)
      expect(link).toContain(encodeURIComponent('🏥 *TAX INVOICE: INV-1001*'))
      expect(link).toContain(encodeURIComponent('₹1,620.00'))
    })
  })

  // ─── 3. WhatsApp Invoice Formatting ──────────────────────────
  describe('WhatsApp Invoice Markdown Summary Generator', () => {
    it('formats a patient invoice summary with header, date, items, totals, and direct PDF link', () => {
      const sampleSale = {
        id: 'sale-101',
        invoiceNumber: 'INV-2026-9001',
        saleDate: '2026-11-02T12:00:00.000Z',
        customer: { name: 'Aarav Sharma', phone: '9876543210' },
        totalAmount: 1620.0,
        payments: [{ method: 'UPI' }],
        items: [
          { productName: 'Augmentin 625 Duo', quantity: 2, totalAmount: 400.0 },
          { productName: 'Pan-D Capsule', quantity: 1, totalAmount: 195.0 },
        ],
      }

      const formatted = formatWhatsAppInvoiceText(sampleSale, 'https://pharmacy.metapharsic.com')

      expect(formatted).toContain('🏥 *METAPHARSIC PHARMACARE*')
      expect(formatted).toContain('🧾 *TAX INVOICE: INV-2026-9001*')
      expect(formatted).toContain('👤 Patient: Aarav Sharma')
      expect(formatted).toContain('• Augmentin 625 Duo (x2) - ₹400.00')
      expect(formatted).toContain('• Pan-D Capsule (x1) - ₹195.00')
      expect(formatted).toContain('💰 *Net Payable: ₹1,620.00*')
      expect(formatted).toContain('💳 Payment: UPI')
      expect(formatted).toContain('📄 *Download Official Tax Invoice PDF:*')
      expect(formatted).toContain('https://pharmacy.metapharsic.com/api/sales/sale-101/pdf')
      expect(formatted).toContain('Wishing you a speedy recovery!')
    })

    it('summarizes overflow line items beyond 5 items to keep URL size concise', () => {
      const manyItems = Array.from({ length: 8 }, (_, i) => ({
        productName: `Medicine Item ${i + 1}`,
        quantity: 1,
        totalAmount: 100,
      }))

      const sampleSale = {
        id: 'sale-102',
        invoiceNumber: 'INV-2026-9002',
        saleDate: '2026-11-02T12:00:00.000Z',
        customer: { name: 'Walk-in Patient' },
        totalAmount: 800,
        items: manyItems,
      }

      const formatted = formatWhatsAppInvoiceText(sampleSale)
      expect(formatted).toContain('• Medicine Item 1')
      expect(formatted).toContain('• Medicine Item 5')
      expect(formatted).toContain('_...and 3 more item(s)_')
    })
  })

  // ─── 4. Daily Executive Digest ───────────────────────────────
  describe('Daily Executive Digest Generation', () => {
    it('aggregates daily financial metrics, gross margin %, and payment method split', async () => {
      const digest = await generateExecutiveDigest('daily', 'br-main', new Date('2026-11-02'))

      expect(digest.period).toBe('daily')
      expect(digest.branchName).toBe('Metapharsic Central Dispensary')
      expect(digest.sales.totalRevenue).toBe(1620.0) // 1080 + 540
      expect(digest.sales.totalSalesCount).toBe(2)
      expect(digest.sales.averageBillValue).toBe(810.0) // 1620 / 2

      // Payment breakdown
      expect(digest.sales.paymentBreakdown.cash).toBe(500)
      expect(digest.sales.paymentBreakdown.upi).toBe(580)
      expect(digest.sales.paymentBreakdown.card).toBe(540)

      // Top medicines
      expect(digest.topMedicines.length).toBeGreaterThanOrEqual(2)
      // Paracetamol has quantity 10 + 5 = 15; Cetirizine has 20; Amoxicillin has 15
      const topMed = digest.topMedicines[0]
      expect(topMed).toBeDefined()

      // Khata & Payables
      expect(digest.creditAndPayables.totalCustomerKhataOutstanding).toBe(12450.0)
      expect(digest.creditAndPayables.totalSupplierPayables).toBe(34800.0)

      // WhatsApp text structure
      expect(digest.formattedWhatsAppText).toContain('DAILY EXECUTIVE DIGEST')
      expect(digest.formattedWhatsAppText).toContain('₹1,620.00 (2 bills)')
      expect(digest.formattedWhatsAppText).toContain('TOP 5 MEDICINES DISPENSED')
      expect(digest.waMeLink).toContain('https://wa.me/919876543210?text=')
    })

    it('generateDailyDigestText returns clean WhatsApp-ready formatted text', async () => {
      const text = await generateDailyDigestText('br-main', new Date('2026-11-02'))
      expect(typeof text).toBe('string')
      expect(text).toContain('DAILY EXECUTIVE DIGEST')
      expect(text).toContain('FINANCIAL SUMMARY')
      expect(text).toContain('REGULATORY COMPLIANCE')
    })
  })

  // ─── 5. Weekly Executive Digest ──────────────────────────────
  describe('Weekly Executive Digest Generation', () => {
    it('aggregates 7-day weekly metrics with average daily revenue and collections split', async () => {
      const digest = await ExecutiveDigestService.generateExecutiveDigest('weekly', 'br-main', new Date('2026-11-02'))

      expect(digest.period).toBe('weekly')
      expect(digest.sales.totalRevenue).toBe(1620.0)
      expect(digest.formattedWhatsAppText).toContain('WEEKLY EXECUTIVE DIGEST')
      expect(digest.formattedWhatsAppText).toContain('Last 7 Days')
      expect(digest.formattedWhatsAppText).toContain('Avg Daily Revenue')
      expect(digest.formattedWhatsAppText).toContain('TOP 5 MEDICINES THIS WEEK')
    })

    it('generateWeeklyDigestText returns weekly summary text with 7-day period label', async () => {
      const text = await generateWeeklyDigestText('br-main', new Date('2026-11-02'))
      expect(text).toContain('WEEKLY EXECUTIVE DIGEST')
      expect(text).toContain('REGULATORY & CLINICAL OVERVIEW')
    })
  })

  // ─── 6. Monthly Executive Digest ─────────────────────────────
  describe('Monthly Executive Digest Generation', () => {
    it('aggregates month-to-date financial audit with COGS, gross margins, and vendor dues', async () => {
      const digest = await ExecutiveDigestService.generateExecutiveDigest('monthly', 'br-main', new Date('2026-11-02'))

      expect(digest.period).toBe('monthly')
      expect(digest.sales.totalRevenue).toBe(1620.0)
      expect(digest.formattedWhatsAppText).toContain('MONTHLY EXECUTIVE DIGEST')
      expect(digest.formattedWhatsAppText).toContain('MONTHLY FINANCIAL AUDIT')
      expect(digest.formattedWhatsAppText).toContain('COGS (Inventory Cost)')
      expect(digest.formattedWhatsAppText).toContain('BALANCE SHEET & VENDOR AUDIT')
      expect(digest.formattedWhatsAppText).toContain('₹12,450.00')
      expect(digest.formattedWhatsAppText).toContain('₹34,800.00')
    })

    it('generateMonthlyDigestText returns month-to-date formatted audit summary', async () => {
      const text = await generateMonthlyDigestText('br-main', new Date('2026-11-02'))
      expect(text).toContain('MONTHLY EXECUTIVE DIGEST')
      expect(text).toContain('STATUTORY COMPLIANCE & AUDIT READINESS')
    })
  })

  // ─── 7. Automated Dispatch ───────────────────────────────────
  describe('Automated WhatsApp Dispatch Service', () => {
    it('dispatches the executive digest via WhatsAppService and returns sendResult', async () => {
      const spy = jest.spyOn(WhatsAppService, 'sendMessage').mockResolvedValueOnce({
        success: true,
        providerUsed: 'simulation-and-wa-link',
        toPhone: '+919876543210',
        messageId: 'sim_123',
        status: 'SIMULATED',
        waMeLink: 'https://wa.me/919876543210',
        timestamp: new Date().toISOString(),
      })

      const { digest, sendResult } = await sendExecutiveDigest({
        period: 'daily',
        branchId: 'br-main',
        recipientPhone: '+919876543210',
        date: new Date('2026-11-02'),
      })

      expect(spy).toHaveBeenCalledTimes(1)
      expect(sendResult.success).toBe(true)
      expect(sendResult.status).toBe('SIMULATED')
      expect(digest.sales.totalRevenue).toBe(1620.0)
    })
  })
})
