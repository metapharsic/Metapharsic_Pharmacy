import { BillRefType, EntryType, LedgerType, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client'
import { format } from 'date-fns'

import prisma from '@/lib/db/prisma'
import { ensureDefaultLedgers } from '@/lib/finance/coa-seed'
import { escapeXml, formatNum, formatTallyDate } from '@/lib/tally/tally-xml-builder'
import type { CreateReceiptVoucherInput, InstrumentType, ReceiptVoucherQuery } from './voucher-validations'

export interface VoucherActor {
  id: string
  name?: string | null
}

function mapInstrumentToPaymentMethod(instrument: InstrumentType): PaymentMethod {
  switch (instrument) {
    case 'CASH':
      return PaymentMethod.CASH
    case 'CHEQUE':
      return PaymentMethod.CHEQUE
    case 'UPI':
      return PaymentMethod.UPI
    case 'NEFT_RTGS':
      return PaymentMethod.NETBANKING
    case 'CARD':
      return PaymentMethod.CARD
    default:
      return PaymentMethod.CASH
  }
}

/**
 * Generates a unique sequential receipt voucher number: RC-YYYY-XXXX
 */
async function generateReceiptVoucherNumber(tx: Prisma.TransactionClient): Promise<string> {
  const currentYear = new Date().getFullYear()
  const prefix = `RC-${currentYear}-`

  const latestVoucher = await tx.voucher.findFirst({
    where: {
      voucherNumber: { startsWith: prefix },
    },
    orderBy: { voucherNumber: 'desc' },
    select: { voucherNumber: true },
  })

  let nextSeq = 1
  if (latestVoucher?.voucherNumber) {
    const parts = latestVoucher.voucherNumber.split('-')
    const seq = parseInt(parts[2], 10)
    if (!isNaN(seq)) {
      nextSeq = seq + 1
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

/**
 * Fetch eligible Debit accounts (Cash-in-Hand and Bank Accounts).
 */
export async function getEligibleReceiptLedgers(_branchId?: string) {
  let ledgers = await prisma.ledger.findMany({
    where: {
      OR: [
        { group: { in: ['Cash-in-Hand', 'Bank Accounts'] } },
        { code: { in: ['1010', '1011', '1020', '1021', '1022'] } },
        { type: LedgerType.ASSET, name: { contains: 'Cash', mode: 'insensitive' } },
        { type: LedgerType.ASSET, name: { contains: 'Bank', mode: 'insensitive' } },
      ],
    },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      group: true,
      type: true,
      balance: true,
    },
  })

  if (ledgers.length === 0) {
    await ensureDefaultLedgers()
    ledgers = await prisma.ledger.findMany({
      where: {
        OR: [
          { group: { in: ['Cash-in-Hand', 'Bank Accounts'] } },
          { code: { in: ['1010', '1011', '1020', '1021', '1022'] } },
        ],
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        group: true,
        type: true,
        balance: true,
      },
    })
  }

  return ledgers
}

/**
 * Fetch all outstanding (unpaid or partially paid) sales invoices for a customer in FIFO order.
 */
export async function getUnpaidInvoicesForCustomer(customerId: string) {
  if (!customerId) return []

  const sales = await prisma.sale.findMany({
    where: {
      customerId,
      status: { not: 'CANCELLED' },
      balanceDue: { gt: 0 },
    },
    orderBy: {
      saleDate: 'asc', // FIFO default
    },
    select: {
      id: true,
      invoiceNumber: true,
      saleDate: true,
      totalAmount: true,
      amountPaid: true,
      balanceDue: true,
      paymentStatus: true,
    },
  })

  return sales.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate,
    totalAmount: Number(sale.totalAmount),
    amountPaid: Number(sale.amountPaid),
    balanceDue: Number(sale.balanceDue),
    paymentStatus: sale.paymentStatus,
  }))
}

/**
 * Real-time balance and bill stats for a customer.
 */
export async function getCustomerBalanceSummary(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      outstandingBalance: true,
      creditLimit: true,
      creditDays: true,
      sales: {
        where: {
          status: { not: 'CANCELLED' },
          balanceDue: { gt: 0 },
        },
        select: {
          id: true,
          balanceDue: true,
        },
      },
    },
  })

  if (!customer) {
    throw new Error('Customer not found')
  }

  const unpaidBillsTotal = customer.sales.reduce((sum, s) => sum + Number(s.balanceDue), 0)

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    outstandingBalance: Number(customer.outstandingBalance),
    creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
    creditDays: customer.creditDays,
    unpaidBillsCount: customer.sales.length,
    unpaidBillsTotal: Math.round(unpaidBillsTotal * 100) / 100,
  }
}

/**
 * Creates an atomic double-entry Receipt Voucher (F6).
 *
 * Accounting Rules:
 * 1. Balance Constraint: DR == CR == Total Amount.
 * 2. Debit: Increase Cash or Bank Asset account.
 * 3. Credit: Decrease Customer Sundry Debtors account.
 * 4. Bill Allocations: Settle selected invoices (FIFO / Manual Agst Ref), reduce balanceDue,
 *    update payment status (PAID / PARTIAL), record POS audit payment.
 */
export async function createReceiptVoucher(input: CreateReceiptVoucherInput, actor: VoucherActor) {
  // 1. Double-entry validation
  const sumAllocations = input.allocations.reduce((acc, curr) => acc + curr.allocatedAmount, 0)
  if (Math.abs(sumAllocations - input.amount) >= 0.01) {
    throw new Error(
      `Double-entry balance constraint violated: Allocated total (₹${sumAllocations.toFixed(2)}) must equal Receipt amount (₹${input.amount.toFixed(2)})`
    )
  }

  // 2. Fetch Customer and Debit Ledger
  const [customer, debitLedger] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.ledger.findUnique({ where: { id: input.debitLedgerId } }),
  ])

  if (!customer) throw new Error('Selected party (Customer) was not found')
  if (!debitLedger) throw new Error('Selected debit account (Cash/Bank Ledger) was not found')

  // 3. Verify Agst Ref invoices exist and belong to customer
  const agstRefAllocations = input.allocations.filter((a) => a.refType === 'AGST_REF')
  const invoiceIds = agstRefAllocations.map((a) => a.invoiceId!).filter(Boolean)

  if (invoiceIds.length > 0) {
    const invoices = await prisma.sale.findMany({
      where: {
        id: { in: invoiceIds },
        customerId: input.customerId,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        invoiceNumber: true,
        balanceDue: true,
      },
    })

    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]))

    for (const alloc of agstRefAllocations) {
      const inv = invoiceMap.get(alloc.invoiceId!)
      if (!inv) {
        throw new Error(`Invoice ${alloc.invoiceId} not found or does not belong to this customer`)
      }
      if (alloc.allocatedAmount > Number(inv.balanceDue) + 0.01) {
        throw new Error(
          `Allocated amount ₹${alloc.allocatedAmount.toFixed(2)} exceeds invoice ${inv.invoiceNumber} balance due of ₹${Number(inv.balanceDue).toFixed(2)}`
        )
      }
    }
  }

  // 4. Atomic processing inside a single database transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate voucher number
    const voucherNumber = input.voucherNumber?.trim() || (await generateReceiptVoucherNumber(tx))

    // Build descriptive narration
    const narrationDetails = [
      input.narration?.trim(),
      `Party: ${customer.name}`,
      `Instrument: ${input.instrumentType}${input.instrumentNumber ? ` Ref# ${input.instrumentNumber}` : ''}`,
      input.bankName ? `Bank: ${input.bankName}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    // A. Create Voucher Header
    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'RECEIPT',
        date: input.date,
        narration: narrationDetails,
        branchId: input.branchId,
        createdById: actor.id,
      },
    })

    // B. Create DR VoucherEntry (Debit Cash/Bank Asset Account)
    await tx.voucherEntry.create({
      data: {
        voucherId: voucher.id,
        ledgerId: debitLedger.id,
        entryType: EntryType.DR,
        amount: input.amount,
      },
    })

    // Update Debit Ledger running balance
    const updatedDebitLedger = await tx.ledger.update({
      where: { id: debitLedger.id },
      data: {
        balance: { increment: input.amount },
      },
    })

    // Insert Debit Ledger Entry
    await tx.ledgerEntry.create({
      data: {
        ledgerId: debitLedger.id,
        type: 'DEBIT',
        amount: input.amount,
        balance: updatedDebitLedger.balance,
        description: `Receipt Voucher ${voucherNumber} - Party: ${customer.name}`,
        referenceType: 'VOUCHER',
        referenceId: voucher.id,
        entryDate: input.date,
      },
    })

    // C. Create CR VoucherEntry (Credit Customer Sundry Debtors)
    const crVoucherEntry = await tx.voucherEntry.create({
      data: {
        voucherId: voucher.id,
        customerId: customer.id,
        entryType: EntryType.CR,
        amount: input.amount,
      },
    })

    // Update Customer outstanding balance (Credit decreases receivable balance)
    const updatedCustomer = await tx.customer.update({
      where: { id: customer.id },
      data: {
        outstandingBalance: { decrement: input.amount },
      },
    })

    // Insert Customer Ledger Entry
    await tx.customerLedger.create({
      data: {
        customerId: customer.id,
        type: 'CREDIT',
        amount: input.amount,
        balance: updatedCustomer.outstandingBalance,
        referenceType: 'VOUCHER',
        referenceId: voucher.id,
        description: `Receipt Voucher ${voucherNumber} (${input.instrumentType}${input.instrumentNumber ? ` #${input.instrumentNumber}` : ''})`,
        entryDate: input.date,
      },
    })

    // D. Process Bill Allocations & Invoice Settlement
    const createdAllocations = []

    for (const alloc of input.allocations) {
      let refNumber = alloc.refNumber?.trim() || null

      if (alloc.refType === 'AGST_REF' && alloc.invoiceId) {
        const sale = await tx.sale.findUniqueOrThrow({
          where: { id: alloc.invoiceId },
          select: { id: true, invoiceNumber: true, balanceDue: true, amountPaid: true },
        })

        if (!refNumber) {
          refNumber = sale.invoiceNumber
        }

        const prevBalanceDue = Number(sale.balanceDue)
        const prevAmountPaid = Number(sale.amountPaid)
        const newBalanceDue = Math.max(0, Math.round((prevBalanceDue - alloc.allocatedAmount) * 100) / 100)
        const newAmountPaid = Math.round((prevAmountPaid + alloc.allocatedAmount) * 100) / 100
        const newPaymentStatus = newBalanceDue <= 0.001 ? PaymentStatus.PAID : PaymentStatus.PARTIAL

        // Update Sale invoice
        await tx.sale.update({
          where: { id: alloc.invoiceId },
          data: {
            balanceDue: newBalanceDue,
            amountPaid: newAmountPaid,
            paymentStatus: newPaymentStatus,
          },
        })

        // Create Payment record for POS audit consistency
        await tx.payment.create({
          data: {
            saleId: alloc.invoiceId,
            customerId: customer.id,
            method: mapInstrumentToPaymentMethod(input.instrumentType),
            amount: alloc.allocatedAmount,
            reference: input.instrumentNumber || voucherNumber,
            notes: `Settled via Receipt Voucher ${voucherNumber}`,
            paymentDate: input.date,
          },
        })
      }

      const createdAlloc = await tx.billAllocation.create({
        data: {
          voucherEntryId: crVoucherEntry.id,
          refType: alloc.refType as BillRefType,
          invoiceId: alloc.refType === 'AGST_REF' ? alloc.invoiceId : null,
          refNumber: refNumber || (alloc.refType === 'ADVANCE' ? 'ADVANCE' : 'ON-ACCOUNT'),
          allocatedAmount: alloc.allocatedAmount,
        },
      })

      createdAllocations.push(createdAlloc)
    }

    return {
      voucher,
      crVoucherEntry,
      createdAllocations,
      customerName: customer.name,
      debitLedgerName: debitLedger.name,
    }
  })

  return getReceiptVoucherById(result.voucher.id)
}

/**
 * Fetch a single receipt voucher with full nested details.
 */
export async function getReceiptVoucherById(voucherId: string) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      entries: {
        include: {
          ledger: { select: { id: true, code: true, name: true, group: true, type: true } },
          customer: { select: { id: true, name: true, phone: true, email: true, gstin: true, state: true } },
          allocations: {
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  saleDate: true,
                  totalAmount: true,
                  balanceDue: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!voucher) return null

  // Extract DR entry (Bank/Cash) and CR entry (Party/Customer)
  const drEntry = voucher.entries.find((e) => e.entryType === EntryType.DR)
  const crEntry = voucher.entries.find((e) => e.entryType === EntryType.CR)

  return {
    id: voucher.id,
    voucherNumber: voucher.voucherNumber,
    voucherType: voucher.voucherType,
    date: voucher.date,
    narration: voucher.narration,
    branch: voucher.branch,
    createdBy: voucher.createdBy,
    createdAt: voucher.createdAt,
    amount: crEntry ? Number(crEntry.amount) : drEntry ? Number(drEntry.amount) : 0,
    debitAccount: drEntry?.ledger
      ? {
          id: drEntry.ledger.id,
          code: drEntry.ledger.code,
          name: drEntry.ledger.name,
          group: drEntry.ledger.group,
        }
      : null,
    customer: crEntry?.customer
      ? {
          id: crEntry.customer.id,
          name: crEntry.customer.name,
          phone: crEntry.customer.phone,
          email: crEntry.customer.email,
          gstin: crEntry.customer.gstin,
          state: crEntry.customer.state,
        }
      : null,
    allocations:
      crEntry?.allocations.map((alloc) => ({
        id: alloc.id,
        refType: alloc.refType,
        refNumber: alloc.refNumber,
        allocatedAmount: Number(alloc.allocatedAmount),
        invoice: alloc.invoice
          ? {
              id: alloc.invoice.id,
              invoiceNumber: alloc.invoice.invoiceNumber,
              saleDate: alloc.invoice.saleDate,
              totalAmount: Number(alloc.invoice.totalAmount),
              balanceDue: Number(alloc.invoice.balanceDue),
            }
          : null,
      })) || [],
  }
}

/**
 * Query list of receipt vouchers with pagination and filters.
 */
export async function getReceiptVouchers(query: Partial<ReceiptVoucherQuery> = {}) {
  const page = query.page || 1
  const limit = query.limit || 20
  const skip = (page - 1) * limit

  const where: Prisma.VoucherWhereInput = {
    voucherType: 'RECEIPT',
  }

  if (query.branchId) {
    where.branchId = query.branchId
  }

  if (query.customerId) {
    where.entries = {
      some: {
        customerId: query.customerId,
        entryType: EntryType.CR,
      },
    }
  }

  if (query.startDate || query.endDate) {
    where.date = {}
    if (query.startDate) {
      where.date.gte = new Date(query.startDate)
    }
    if (query.endDate) {
      where.date.lte = new Date(query.endDate)
    }
  }

  const [total, vouchers] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        entries: {
          include: {
            ledger: { select: { id: true, name: true, code: true, group: true } },
            customer: { select: { id: true, name: true, phone: true } },
            allocations: true,
          },
        },
      },
    }),
  ])

  const items = vouchers.map((v) => {
    const dr = v.entries.find((e) => e.entryType === EntryType.DR)
    const cr = v.entries.find((e) => e.entryType === EntryType.CR)
    const totalAllocations = cr?.allocations.length || 0
    return {
      id: v.id,
      voucherNumber: v.voucherNumber,
      date: v.date,
      narration: v.narration,
      amount: cr ? Number(cr.amount) : 0,
      debitLedgerName: dr?.ledger?.name || 'Cash/Bank',
      customerName: cr?.customer?.name || 'Customer',
      customerPhone: cr?.customer?.phone || null,
      allocationsCount: totalAllocations,
      branchName: v.branch?.name,
      createdByName: v.createdBy?.name,
      createdAt: v.createdAt,
    }
  })

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * Generate Tally XML export for a Receipt Voucher.
 */
export async function buildReceiptVoucherTallyXml(voucherId: string): Promise<string> {
  const vch = await getReceiptVoucherById(voucherId)
  if (!vch) {
    throw new Error('Voucher not found')
  }

  const tallyDate = formatTallyDate(vch.date)
  const vchNum = escapeXml(vch.voucherNumber)
  const narration = escapeXml(vch.narration || `Receipt Voucher ${vch.voucherNumber}`)
  const partyName = escapeXml(vch.customer?.name || 'Sundry Debtors')
  const debitName = escapeXml(vch.debitAccount?.name || 'Cash on Hand')

  // Allocations XML inside party credit entry
  const allocationsXml = vch.allocations
    .map((alloc) => {
      const refName = escapeXml(alloc.refNumber || alloc.invoice?.invoiceNumber || 'On Account')
      let tallyBillType = 'Agst Ref'
      if (alloc.refType === 'ADVANCE') tallyBillType = 'Advance'
      else if (alloc.refType === 'ON_ACCOUNT') tallyBillType = 'On Account'
      else if (alloc.refType === 'NEW_REF') tallyBillType = 'New Ref'

      return `            <BILLALLOCATIONS.LIST>
              <NAME>${refName}</NAME>
              <BILLTYPE>${tallyBillType}</BILLTYPE>
              <AMOUNT>${formatNum(alloc.allocatedAmount)}</AMOUNT>
            </BILLALLOCATIONS.LIST>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>PharmaCare</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${vchNum}</VOUCHERNUMBER>
            <NARRATION>${narration}</NARRATION>
            <!-- Credit Party Ledger (Sundry Debtors) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${formatNum(vch.amount)}</AMOUNT>
${allocationsXml}
            </ALLLEDGERENTRIES.LIST>
            <!-- Debit Bank/Cash Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${debitName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${formatNum(vch.amount)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`

  return xml
}
