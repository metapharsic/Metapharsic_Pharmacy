import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'

const quickCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(5, 'Valid phone number is required'),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  discountTier: z.string().optional().nullable(),
  patientDiscountPercent: z.coerce.number().min(0).max(100).default(0),
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/customers/lookup?phone=&search=
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const phone = req.nextUrl.searchParams.get('phone')?.trim()
    const search = req.nextUrl.searchParams.get('search')?.trim()

    if (!phone && !search) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Phone or search query is required' } },
        { status: 400 }
      )
    }

    const where: any = { isActive: true }
    if (phone) {
      where.phone = { contains: phone }
    } else if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const customer = await prisma.customer.findFirst({
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
            doctorName: true,
            items: {
              take: 5,
              select: {
                productName: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ success: true, data: null })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        discountTier: (customer as any).discountTier || 'REGULAR',
        patientDiscountPercent: Number((customer as any).patientDiscountPercent || 0),
        outstandingBalance: Number(customer.outstandingBalance),
        creditLimit: Number(customer.creditLimit),
        creditDays: customer.creditDays,
        recentPurchases: customer.sales.map((s) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber,
          date: s.saleDate,
          totalAmount: Number(s.totalAmount),
          doctorName: s.doctorName,
          items: s.items.map((it) => ({
            name: it.productName,
            quantity: it.quantity,
            rate: Number(it.unitPrice),
          })),
        })),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message: err.message || 'Lookup failed' } },
      { status: 500 }
    )
  }
}

// POST /api/customers/lookup (Quick inline add)
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body: unknown = await req.json()
    const parsed = quickCustomerSchema.parse(body)

    // Check if phone already exists
    let existing = await prisma.customer.findFirst({
      where: { phone: parsed.phone.trim() },
    })

    if (existing) {
      // Update existing customer discount tier if provided
      existing = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: parsed.name.trim(),
        },
      })
      return NextResponse.json({
        success: true,
        data: {
          ...existing,
          discountTier: parsed.discountTier?.trim() || 'REGULAR',
          outstandingBalance: Number(existing.outstandingBalance),
          creditLimit: Number(existing.creditLimit),
          patientDiscountPercent: Number(parsed.patientDiscountPercent ?? 0),
          recentPurchases: [],
        },
        message: 'Customer profile updated',
      })
    }

    const created = await prisma.customer.create({
      data: {
        name: parsed.name.trim(),
        phone: parsed.phone.trim(),
        email: parsed.email?.trim() || null,
        address: parsed.address?.trim() || null,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...created,
          discountTier: parsed.discountTier?.trim() || 'REGULAR',
          outstandingBalance: 0,
          creditLimit: 0,
          patientDiscountPercent: Number(parsed.patientDiscountPercent || 0),
          recentPurchases: [],
        },
        message: 'New customer profile created',
      },
      { status: 201 }
    )
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message } },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message: err.message || 'Failed to save customer' } },
      { status: 500 }
    )
  }
}
