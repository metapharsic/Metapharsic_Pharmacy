import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { createDoctor, listDoctors } from '@/lib/doctors/doctor-service'

const createDoctorSchema = z.object({
  name: z.string().min(1, 'Doctor name is required'),
  regNumber: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  clinicName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  commissionPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/doctors?search=&limit=
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const search = req.nextUrl.searchParams.get('search') || undefined
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)

    const doctors = await listDoctors({
      search,
      limit,
      organizationId: user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__',
    })
    return NextResponse.json({ success: true, data: doctors })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message: err.message || 'Failed to list doctors' } },
      { status: 500 }
    )
  }
}

// POST /api/doctors
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body: unknown = await req.json()
    const parsed = createDoctorSchema.parse(body)

    const doctor = await createDoctor({
      ...parsed,
      organizationId: user.isSuperAdmin ? undefined : user.organizationId || undefined,
    })
    return NextResponse.json(
      { success: true, data: doctor, message: `Doctor ${doctor.name} added successfully` },
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
      { success: false, error: { code: 'ERROR', message: err.message || 'Failed to create doctor' } },
      { status: 500 }
    )
  }
}
