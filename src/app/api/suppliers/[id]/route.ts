import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getSupplier, updateSupplier } from '@/lib/purchases/purchase-service'
import { updateSupplierSchema } from '@/lib/validations/purchase'

type RouteParams = { params: { id: string } }

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Conflict')) return 409
  return 400
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.SUPPLIERS_READ)
    const { searchParams } = req.nextUrl

    if (searchParams.get('view') === 'profile') {
      const { getSupplierProfile } = await import('@/lib/suppliers/supplier-management-service')
      const profile = await getSupplierProfile(
        params.id,
        user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'
      )
      if (!profile) {
        return NextResponse.json({ success: false, error: { message: 'Supplier profile not found' } }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: profile })
    }

    const supplier = await getSupplier(params.id, user)
    if (!supplier)
      return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Not Found: supplier' } }, { status: 404 })
    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status: errStatus(message) })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.SUPPLIERS_UPDATE)
    const body: unknown = await req.json()
    const data = updateSupplierSchema.parse(body)
    const supplier = await updateSupplier(params.id, data, user)
    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message ?? 'Invalid input', issues: err.flatten() } }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status: errStatus(message) })
  }
}