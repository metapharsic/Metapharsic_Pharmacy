import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'

// GET /api/vouchers/receipt/customers?search=...
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ)
    const search = req.nextUrl.searchParams.get('search')?.trim() || ''

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: 50,
      orderBy: [{ outstandingBalance: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        outstandingBalance: true,
        creditLimit: true,
        creditDays: true,
        _count: {
          select: {
            sales: {
              where: {
                status: { not: 'CANCELLED' },
                balanceDue: { gt: 0 },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        outstandingBalance: Number(c.outstandingBalance),
        creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
        creditDays: c.creditDays,
        unpaidInvoicesCount: c._count.sales,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERROR', message },
      },
      { status: 500 }
    )
  }
}
