import { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import type { AuthUser } from '@/lib/inventory/branch-access'

export interface CreateDoctorInput {
  name: string
  regNumber?: string | null
  qualification?: string | null
  specialization?: string | null
  clinicName?: string | null
  phone?: string | null
  email?: string | null
  commissionPercent?: number
  notes?: string | null
  organizationId?: string | null
}

export interface DoctorQueryFilter {
  search?: string
  limit?: number
  isActive?: boolean
  organizationId?: string
}

export interface CommissionFilter {
  doctorId?: string
  branchId?: string
  startDate?: string | Date
  endDate?: string | Date
  isPaid?: boolean
  page?: number
  limit?: number
  organizationId?: string
}

/**
 * List doctors with optional search by name, phone, or clinic.
 */
export async function listDoctors(filter: DoctorQueryFilter = {}) {
  const { search, limit = 50, isActive = true, organizationId } = filter

  const where: Prisma.DoctorWhereInput = {
    ...(isActive !== undefined ? { isActive } : {}),
    ...(organizationId ? { organizationId } : {}),
  }

  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { regNumber: { contains: q, mode: 'insensitive' } },
      { clinicName: { contains: q, mode: 'insensitive' } },
      { specialization: { contains: q, mode: 'insensitive' } },
    ]
  }

  const doctors = await prisma.doctor.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          prescriptions: true,
          commissions: { where: { isPaid: false } },
        },
      },
    },
  })

  return doctors.map((doc) => ({
    id: doc.id,
    name: doc.name,
    regNumber: doc.regNumber,
    qualification: doc.qualification,
    specialization: doc.specialization,
    clinicName: doc.clinicName,
    phone: doc.phone,
    email: doc.email,
    commissionPercent: Number(doc.commissionPercent),
    isActive: doc.isActive,
    notes: doc.notes,
    totalReferrals: doc._count.prescriptions,
    unpaidCommissionsCount: doc._count.commissions,
    createdAt: doc.createdAt,
  }))
}

/**
 * Create a new Doctor record (supports fast inline-add from POS).
 */
export async function createDoctor(input: CreateDoctorInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Doctor name is required')
  }

  const doctor = await prisma.doctor.create({
    data: {
      name: input.name.trim(),
      regNumber: input.regNumber?.trim() || null,
      qualification: input.qualification?.trim() || null,
      specialization: input.specialization?.trim() || null,
      clinicName: input.clinicName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      commissionPercent: input.commissionPercent !== undefined ? input.commissionPercent : 0,
      notes: input.notes?.trim() || null,
      organizationId: input.organizationId || null,
    },
  })

  return {
    ...doctor,
    commissionPercent: Number(doctor.commissionPercent),
  }
}

/**
 * Fetch commissions breakdown per doctor with pagination and total earnings summary.
 */
export async function getDoctorCommissions(filter: CommissionFilter = {}) {
  const page = filter.page || 1
  const limit = filter.limit || 25
  const skip = (page - 1) * limit

  const where: Prisma.DoctorCommissionWhereInput = {}

  if (filter.organizationId) {
    where.doctor = { organizationId: filter.organizationId }
  }

  if (filter.doctorId) {
    where.doctorId = filter.doctorId
  }

  if (filter.isPaid !== undefined) {
    where.isPaid = filter.isPaid
  }

  if (filter.startDate || filter.endDate) {
    where.createdAt = {}
    if (filter.startDate) where.createdAt.gte = new Date(filter.startDate)
    if (filter.endDate) where.createdAt.lte = new Date(filter.endDate)
  }

  if (filter.branchId) {
    where.sale = {
      branchId: filter.branchId,
      ...(filter.organizationId ? { branch: { organizationId: filter.organizationId } } : {}),
    }
  }

  const [total, commissions, aggregate] = await Promise.all([
    prisma.doctorCommission.count({ where }),
    prisma.doctorCommission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            regNumber: true,
            clinicName: true,
            phone: true,
          },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            saleDate: true,
            totalAmount: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    }),
    prisma.doctorCommission.aggregate({
      where,
      _sum: {
        saleAmount: true,
        commissionAmount: true,
      },
    }),
  ])

  return {
    items: commissions.map((c) => ({
      id: c.id,
      doctorId: c.doctorId,
      doctorName: c.doctor.name,
      doctorRegNumber: c.doctor.regNumber,
      clinicName: c.doctor.clinicName,
      doctorPhone: c.doctor.phone,
      saleId: c.saleId,
      invoiceNumber: c.sale.invoiceNumber,
      saleDate: c.sale.saleDate,
      customerName: c.sale.customer?.name || 'Walk-in Patient',
      saleAmount: Number(c.saleAmount),
      commissionPercent: Number(c.commissionPercent),
      commissionAmount: Number(c.commissionAmount),
      isPaid: c.isPaid,
      paidAt: c.paidAt,
      paymentReference: c.paymentReference,
      notes: c.notes,
      createdAt: c.createdAt,
    })),
    summary: {
      totalSalesVolume: Number(aggregate._sum.saleAmount || 0),
      totalCommissionEarned: Number(aggregate._sum.commissionAmount || 0),
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Mark doctor commission as settled / paid.
 */
export async function settleDoctorCommission(
  commissionId: string,
  data: { paymentReference?: string; notes?: string },
  actor?: AuthUser
) {
  const existing = await prisma.doctorCommission.findUnique({
    where: { id: commissionId },
    include: { doctor: true },
  })
  if (!existing) {
    throw new Error('Not Found: doctor commission')
  }
  if (actor && !actor.isSuperAdmin) {
    if (!actor.organizationId || existing.doctor.organizationId !== actor.organizationId) {
      throw new Error('Forbidden: doctor commission belongs to another organization')
    }
  }

  const updated = await prisma.doctorCommission.update({
    where: { id: commissionId },
    data: {
      isPaid: true,
      paidAt: new Date(),
      paymentReference: data.paymentReference?.trim() || 'CASH_SETTLED',
      notes: data.notes?.trim() || null,
    },
  })

  return {
    ...updated,
    saleAmount: Number(updated.saleAmount),
    commissionAmount: Number(updated.commissionAmount),
    commissionPercent: Number(updated.commissionPercent),
  }
}
