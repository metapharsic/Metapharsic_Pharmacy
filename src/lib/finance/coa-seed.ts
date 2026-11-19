import { LedgerType } from '@prisma/client'

import prisma from '@/lib/db/prisma'

export const DEFAULT_CHART_OF_ACCOUNTS = [
  // Assets (1000s)
  { code: '1010', name: 'Cash on Hand', type: LedgerType.ASSET, group: 'Cash-in-Hand', isSystem: true },
  { code: '1011', name: 'Petty Cash', type: LedgerType.ASSET, group: 'Cash-in-Hand', isSystem: true },
  { code: '1020', name: 'Main Bank Account', type: LedgerType.ASSET, group: 'Bank Accounts', isSystem: true },
  { code: '1021', name: 'HDFC Bank Current A/c', type: LedgerType.ASSET, group: 'Bank Accounts', isSystem: false },
  { code: '1022', name: 'SBI Current A/c', type: LedgerType.ASSET, group: 'Bank Accounts', isSystem: false },
  { code: '1030', name: 'Accounts Receivable', type: LedgerType.ASSET, group: 'Sundry Debtors', isSystem: true },
  { code: '1040', name: 'Inventory Asset', type: LedgerType.ASSET, group: 'Stock-in-Hand', isSystem: true },
  { code: '1051', name: 'Input CGST', type: LedgerType.ASSET, group: 'Duties & Taxes', isSystem: true },
  { code: '1052', name: 'Input SGST', type: LedgerType.ASSET, group: 'Duties & Taxes', isSystem: true },
  { code: '1053', name: 'Input IGST', type: LedgerType.ASSET, group: 'Duties & Taxes', isSystem: true },

  // Liabilities (2000s)
  { code: '2010', name: 'Accounts Payable', type: LedgerType.LIABILITY, group: 'Sundry Creditors', isSystem: true },
  { code: '2021', name: 'Output CGST', type: LedgerType.LIABILITY, group: 'Duties & Taxes', isSystem: true },
  { code: '2022', name: 'Output SGST', type: LedgerType.LIABILITY, group: 'Duties & Taxes', isSystem: true },
  { code: '2023', name: 'Output IGST', type: LedgerType.LIABILITY, group: 'Duties & Taxes', isSystem: true },

  // Equity (3000s)
  { code: '3010', name: "Owner's Capital", type: LedgerType.EQUITY, group: 'Capital Account', isSystem: true },
  { code: '3020', name: 'Retained Earnings', type: LedgerType.EQUITY, group: 'Reserves & Surplus', isSystem: true },

  // Income (4000s)
  { code: '4010', name: 'Pharmacy Sales Revenue', type: LedgerType.INCOME, group: 'Sales Accounts', isSystem: true },
  { code: '4020', name: 'Discounts Received', type: LedgerType.INCOME, group: 'Indirect Incomes', isSystem: true },

  // Expenses (5000s)
  { code: '5010', name: 'Cost of Goods Sold', type: LedgerType.EXPENSE, group: 'Direct Expenses', isSystem: true },
  { code: '5020', name: 'Store Rent & Premises', type: LedgerType.EXPENSE, group: 'Indirect Expenses', isSystem: true },
  { code: '5030', name: 'Staff Salaries & Wages', type: LedgerType.EXPENSE, group: 'Indirect Expenses', isSystem: true },
  { code: '5040', name: 'Utilities & Office Expenses', type: LedgerType.EXPENSE, group: 'Indirect Expenses', isSystem: true },
] as const

export async function ensureDefaultLedgers(): Promise<number> {
  let created = 0
  for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
    await prisma.ledger.upsert({
      where: { code: account.code },
      update: {
        group: account.group,
        name: account.name,
      },
      create: {
        code: account.code,
        name: account.name,
        type: account.type,
        group: account.group,
        isSystem: account.isSystem,
        balance: 0,
      },
    })
    created++
  }
  return created
}
