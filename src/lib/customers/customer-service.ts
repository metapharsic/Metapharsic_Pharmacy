import type { Prisma } from '@prisma/client'

import prisma from '@/lib/db/prisma'
import type {
  CreateCustomerInput,
  CustomerListQuery,
  UpdateCustomerInput,
} from '@/lib/validations/customer'

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  creditLimit: number
  outstandingBalance: number
  creditDays: number
  isActive: boolean
  notes: string | null
  discountTier: string | null
  patientDiscountPercent: number
  createdAt: string
  updatedAt: string
}

export interface CustomerListOptions extends Partial<CustomerListQuery> {
  organizationId?: string
  isSuperAdmin?: boolean
}

export async function listCustomers(query: CustomerListOptions = {}) {
  const {
    page = 1,
    limit = 20,
    search,
    status = 'ALL',
    sortBy = 'name',
    sortOrder = 'asc',
  } = query

  const where: Prisma.CustomerWhereInput = {}

  if ((query as any).organizationId !== undefined) {
    where.organizationId = (query as any).organizationId
  } else if (!(query as any).isSuperAdmin) {
    where.organizationId = '__NO_ACCESS__'
  }

  if (status === 'ACTIVE') {
    where.isActive = true
  } else if (status === 'INACTIVE') {
    where.isActive = false
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
  ])

  const data: CustomerRow[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    gstin: c.gstin,
    address: c.address,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    creditLimit: Number(c.creditLimit),
    outstandingBalance: Number(c.outstandingBalance),
    creditDays: c.creditDays,
    isActive: c.isActive,
    notes: c.notes,
    discountTier: (c as any).discountTier || 'REGULAR',
    patientDiscountPercent: Number((c as any).patientDiscountPercent ?? 0),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  }
}

export async function getCustomer(
  id: string,
  organizationId?: string,
  isSuperAdmin?: boolean
) {
  const where: Prisma.CustomerWhereInput = { id }
  if (organizationId !== undefined) {
    where.organizationId = organizationId
  } else if (!isSuperAdmin) {
    where.organizationId = '__NO_ACCESS__'
  }
  const c = await prisma.customer.findFirst({
    where,
    include: {
      sales: {
        take: 5,
        orderBy: { saleDate: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          totalAmount: true,
          amountPaid: true,
          balanceDue: true,
          status: true,
          paymentStatus: true,
        },
      },
      creditNotes: {
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!c) return null

  return {
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    gstin: c.gstin,
    address: c.address,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    creditLimit: Number(c.creditLimit),
    outstandingBalance: Number(c.outstandingBalance),
    creditDays: c.creditDays,
    isActive: c.isActive,
    notes: c.notes,
    discountTier: (c as any).discountTier || 'REGULAR',
    patientDiscountPercent: Number((c as any).patientDiscountPercent ?? 0),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    sales: c.sales.map((s) => ({
      ...s,
      totalAmount: Number(s.totalAmount),
      amountPaid: Number(s.amountPaid),
      balanceDue: Number(s.balanceDue),
      saleDate: s.saleDate.toISOString(),
    })),
    creditNotes: c.creditNotes.map((cn) => ({
      ...cn,
      amount: Number(cn.amount),
      balanceUsed: Number(cn.balanceUsed),
      createdAt: cn.createdAt.toISOString(),
    })),
  }
}

export async function createCustomer(data: CreateCustomerInput & { organizationId?: string }) {
  const c = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      gstin: data.gstin,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      creditLimit: data.creditLimit,
      creditDays: data.creditDays,
      notes: data.notes,
      isActive: data.isActive,
      organizationId: data.organizationId || null,
    },
  })

  return {
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    outstandingBalance: Number(c.outstandingBalance),
  }
}

export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput,
  organizationId?: string,
  isSuperAdmin?: boolean
) {
  const where: Prisma.CustomerWhereInput = { id }
  if (organizationId !== undefined) {
    where.organizationId = organizationId
  } else if (!isSuperAdmin) {
    where.organizationId = '__NO_ACCESS__'
  }

  const existing = await prisma.customer.findFirst({
    where,
    select: { id: true },
  })
  if (!existing) throw new Error('Not Found: customer')

  const c = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.gstin !== undefined ? { gstin: data.gstin } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
      ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit } : {}),
      ...(data.creditDays !== undefined ? { creditDays: data.creditDays } : {}),
      ...(data.discountTier !== undefined ? { discountTier: data.discountTier } : {}),
      ...(data.patientDiscountPercent !== undefined
        ? { patientDiscountPercent: data.patientDiscountPercent }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  return {
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    outstandingBalance: Number(c.outstandingBalance),
  }
}

export async function deleteCustomer(
  id: string,
  organizationId?: string,
  isSuperAdmin?: boolean
) {
  const where: Prisma.CustomerWhereInput = { id }
  if (organizationId !== undefined) {
    where.organizationId = organizationId
  } else if (!isSuperAdmin) {
    where.organizationId = '__NO_ACCESS__'
  }

  const existing = await prisma.customer.findFirst({
    where,
    select: { id: true },
  })
  if (!existing) throw new Error('Not Found: customer')

  const c = await prisma.customer.delete({
    where: { id },
  })

  return {
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
  }
}
