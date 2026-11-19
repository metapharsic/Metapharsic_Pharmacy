import { z } from 'zod'

export const customerDiscountTierEnum = z.enum([
  'REGULAR',
  'CHRONIC_PATIENT',
  'SENIOR_CITIZEN',
  'WHOLESALE',
  'STAFF',
])

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(100),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  city: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  state: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  pincode: z
    .string()
    .trim()
    .max(10)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative').default(0),
  creditDays: z.coerce.number().int().min(0).max(365, 'Credit days cannot exceed 365').default(0),
  discountTier: z.string().trim().default('REGULAR'),
  patientDiscountPercent: z.coerce
    .number()
    .min(0, 'Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .default(0),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  isActive: z.boolean().default(true),
})

export const updateCustomerSchema = createCustomerSchema.partial()

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
  discountTier: z.string().trim().optional(),
  sortBy: z.enum(['name', 'createdAt', 'outstandingBalance']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>
