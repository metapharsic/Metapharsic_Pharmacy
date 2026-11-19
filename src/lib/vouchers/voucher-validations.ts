import { z } from 'zod'

export const BillRefTypeEnum = z.enum(['AGST_REF', 'ADVANCE', 'ON_ACCOUNT', 'NEW_REF'])
export type BillRefType = z.infer<typeof BillRefTypeEnum>

export const InstrumentTypeEnum = z.enum(['CASH', 'CHEQUE', 'UPI', 'NEFT_RTGS', 'CARD'])
export type InstrumentType = z.infer<typeof InstrumentTypeEnum>

export const billAllocationInputSchema = z
  .object({
    refType: BillRefTypeEnum,
    invoiceId: z.string().optional().nullable(),
    refNumber: z.string().optional().nullable(),
    allocatedAmount: z.coerce.number().positive('Allocated amount must be greater than 0'),
  })
  .refine(
    (data) => {
      if (data.refType === 'AGST_REF') {
        return !!data.invoiceId && data.invoiceId.trim().length > 0
      }
      return true
    },
    {
      message: 'Invoice ID is required for Against Reference (Agst Ref) allocations',
      path: ['invoiceId'],
    }
  )

export type BillAllocationInput = z.infer<typeof billAllocationInputSchema>

export const createReceiptVoucherSchema = z
  .object({
    voucherNumber: z.string().optional(),
    date: z.coerce.date().default(() => new Date()),
    narration: z.string().optional().nullable(),
    branchId: z.string().min(1, 'Branch is required'),
    debitLedgerId: z.string().min(1, 'Debit Account (Cash/Bank) is required'),
    customerId: z.string().min(1, 'Party (Customer) is required'),
    amount: z.coerce.number().positive('Voucher amount must be greater than 0'),
    instrumentType: InstrumentTypeEnum.default('CASH'),
    instrumentNumber: z.string().optional().nullable(),
    instrumentDate: z.coerce.date().optional().nullable(),
    bankName: z.string().optional().nullable(),
    allocations: z.array(billAllocationInputSchema).min(1, 'At least one bill allocation is required'),
  })
  .refine(
    (data) => {
      const sumAllocated = data.allocations.reduce((acc, curr) => acc + curr.allocatedAmount, 0)
      return Math.abs(sumAllocated - data.amount) < 0.01
    },
    {
      message: 'Sum of bill allocations must strictly equal the total receipt voucher amount',
      path: ['allocations'],
    }
  )

export type CreateReceiptVoucherInput = z.infer<typeof createReceiptVoucherSchema>

export const receiptVoucherQuerySchema = z.object({
  branchId: z.string().optional(),
  customerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(20),
})

export type ReceiptVoucherQuery = z.infer<typeof receiptVoucherQuerySchema>
