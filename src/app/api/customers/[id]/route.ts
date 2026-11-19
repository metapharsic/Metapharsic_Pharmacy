import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { deleteCustomer, getCustomer, updateCustomer } from '@/lib/customers/customer-service'
import { updateCustomerSchema } from '@/lib/validations/customer'

type RouteParams = { params: { id: string } }

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Conflict')) return 409
  return 400
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/customers/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.CUSTOMERS_READ)
    const orgId = user.isSuperAdmin ? undefined : (user.organizationId || '__NO_ACCESS__')
    const customer = await getCustomer(params.id, orgId, user.isSuperAdmin)
    if (!customer || (!user.isSuperAdmin && user.organizationId && customer.organizationId !== user.organizationId)) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status: errStatus(message) })
  }
}

// PATCH /api/customers/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.CUSTOMERS_UPDATE)
    const orgId = user.isSuperAdmin ? undefined : (user.organizationId || '__NO_ACCESS__')
    const existing = await getCustomer(params.id, orgId, user.isSuperAdmin)
    if (!existing || (!user.isSuperAdmin && user.organizationId && existing.organizationId !== user.organizationId)) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        { status: 404 }
      )
    }
    const body: unknown = await req.json()
    const data = updateCustomerSchema.parse(body)
    const customer = await updateCustomer(params.id, data, orgId, user.isSuperAdmin)
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message ?? 'Invalid input', issues: err.flatten() } },
        { status: 400 }
      )
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status: errStatus(message) })
  }
}

// DELETE /api/customers/:id
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.CUSTOMERS_UPDATE)
    const orgId = user.isSuperAdmin ? undefined : (user.organizationId || '__NO_ACCESS__')
    const customer = await deleteCustomer(params.id, orgId, user.isSuperAdmin)
    return NextResponse.json({ success: true, data: customer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status: errStatus(message) })
  }
}
