import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createCustomer, listCustomers } from '@/lib/customers/customer-service'
import { createCustomerSchema, customerListQuerySchema } from '@/lib/validations/customer'

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Conflict')) return 409
  return 400
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/customers
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.CUSTOMERS_READ)
    const query = customerListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const orgFilter = user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'
    const result = await listCustomers({ ...query, organizationId: orgFilter } as any)
    return NextResponse.json({ success: true, data: result.data, pagination: result.pagination })
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

// POST /api/customers
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.CUSTOMERS_CREATE)
    const body: unknown = await req.json()
    const data = createCustomerSchema.parse(body)
    const customer = await createCustomer({ ...data, organizationId: user.organizationId || undefined } as any)
    return NextResponse.json({ success: true, data: customer }, { status: 201 })
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
