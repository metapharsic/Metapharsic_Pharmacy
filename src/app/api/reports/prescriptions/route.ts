import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRESCRIPTIONS_READ)
    const tenant = await getTenantContext(req)

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const doctorId = searchParams.get('doctorId') || ''
    const requestedBranchId = searchParams.get('branchId') || undefined

    const where: any = {}

    // Strict Multi-Tenant Isolation:
    if (!user.isSuperAdmin) {
      if (!tenant || (!tenant.organizationId && !tenant.branchId)) {
        return NextResponse.json({ success: true, data: [] })
      }

      if (requestedBranchId) {
        const resolved = await resolveBranchScope(user, requestedBranchId)
        if (!resolved) {
          return NextResponse.json({ success: true, data: [] })
        }
        where.branchId = resolved
      } else if (tenant.branchId) {
        where.branchId = tenant.branchId
      } else if (tenant.orgBranchIds && tenant.orgBranchIds.length > 0) {
        where.branchId = { in: tenant.orgBranchIds }
      } else if (tenant.organizationId) {
        where.branch = { organizationId: tenant.organizationId }
      } else {
        return NextResponse.json({ success: true, data: [] })
      }
    } else if (requestedBranchId) {
      where.branchId = requestedBranchId
    }

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (doctorId && doctorId !== 'ALL') {
      where.doctorId = doctorId
    }

    if (search.trim()) {
      where.OR = [
        { prescriptionNumber: { contains: search.trim(), mode: 'insensitive' } },
        { patientName: { contains: search.trim(), mode: 'insensitive' } },
        { patientPhone: { contains: search.trim(), mode: 'insensitive' } },
        { doctorName: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    const prescriptions = await prisma.prescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            regNumber: true,
            clinicName: true,
            specialization: true,
            phone: true,
          },
        },
        sales: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    })

    const transformed = prescriptions.map((p) => ({
      id: p.id,
      rxNumber: p.prescriptionNumber || `RX-${p.id.slice(-6).toUpperCase()}`,
      patientName: p.patientName,
      patientPhone: p.patientPhone || '—',
      patientAge: p.patientAge,
      doctorName: p.doctor?.name || p.doctorName || 'Unassigned',
      doctorRegNumber: p.doctor?.regNumber || p.doctorRegNumber || '—',
      doctorClinic: p.doctor?.clinicName || 'Clinic',
      doctorSpecialization: p.doctor?.specialization || 'Practitioner',
      notes: p.notes,
      status: p.status,
      createdAt: p.createdAt,
      sale: p.sales && p.sales.length > 0 ? p.sales[0] : null,
    }))

    return NextResponse.json({ success: true, data: transformed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
