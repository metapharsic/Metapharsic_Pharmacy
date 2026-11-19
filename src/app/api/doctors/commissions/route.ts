import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { getDoctorCommissions, settleDoctorCommission } from '@/lib/doctors/doctor-service'

const settleSchema = z.object({
  commissionId: z.string().min(1, 'Commission ID is required'),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
})

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 500
}

// GET /api/doctors/commissions?doctorId=&isPaid=&startDate=&endDate=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = req.nextUrl
    const doctorId = searchParams.get('doctorId') || undefined
    const branchId = searchParams.get('branchId') || undefined
    if (branchId && branchId !== 'all') {
      await assertBranchAccess(user, branchId)
    }
    const isPaidParam = searchParams.get('isPaid')
    const isPaid = isPaidParam === 'true' ? true : isPaidParam === 'false' ? false : undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '25', 10)

    const result = await getDoctorCommissions({
      doctorId,
      branchId,
      isPaid,
      startDate,
      endDate,
      page,
      limit,
      organizationId: user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__',
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    const message = err.message || 'Failed to fetch commissions'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}

// POST /api/doctors/commissions (Settle commission)
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body: unknown = await req.json()
    const { commissionId, paymentReference, notes } = settleSchema.parse(body)

    const updated = await settleDoctorCommission(commissionId, { paymentReference, notes }, user)
    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Commission marked as settled',
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message } },
        { status: 400 }
      )
    }
    const message = err.message || 'Failed to settle commission'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}
