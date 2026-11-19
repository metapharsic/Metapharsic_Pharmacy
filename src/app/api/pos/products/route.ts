import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { searchPosProducts } from '@/lib/sales/sales-service'
import { posProductsQuerySchema } from '@/lib/validations/sale'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/pos/products?search=&branchId=&limit=
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    let organizationId = user.organizationId || undefined

    try {
      const { getTenantContext } = await import('@/lib/auth/tenant-context')
      const tenant = await getTenantContext(req)
      if (tenant?.organizationId) {
        organizationId = tenant.organizationId
      }
    } catch {
      // In mocked test environment fallback
    }

    const canAccess =
      user.permissions.includes(PERMISSIONS.PRODUCTS_READ) ||
      user.permissions.includes(PERMISSIONS.SALES_CREATE) ||
      user.permissions.includes(PERMISSIONS.SALES_READ)
    if (!canAccess) {
      throw new Error(`Forbidden: requires permission '${PERMISSIONS.SALES_CREATE}' or '${PERMISSIONS.PRODUCTS_READ}'`)
    }
    const query = posProductsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams))

    const scope = await resolveBranchScope(user, query.branchId)
    if (!scope) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION', message: 'A branch is required for POS search' },
        },
        { status: 400 }
      )
    }

    const args: [string | undefined, string, number, string?] = [query.search, scope, query.limit]
    if (organizationId) {
      args.push(organizationId)
    }
    const products = await searchPosProducts(...args)

    return NextResponse.json({ success: true, data: products })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION', message: err.errors[0]?.message ?? 'Invalid input' },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : 400,
      }
    )
  }
}
