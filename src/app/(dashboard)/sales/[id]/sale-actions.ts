'use server'

import { revalidatePath } from 'next/cache'

import { getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { cancelSale, editSale, type EditSaleInput, type SaleDetail } from '@/lib/sales/sales-service'

export async function cancelSaleAction(saleId: string, reason: string) {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')

  const permissions = session.user.permissions ?? []
  const roles = session.user.roles ?? []
  const isAuthorized =
    permissions.includes(PERMISSIONS.SALES_VOID) ||
    roles.some((r: string) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

  if (!isAuthorized) {
    throw new Error('Forbidden: requires permission sales:void or Admin role to cancel sales')
  }

  await cancelSale(saleId, reason, {
    id: session.user.id,
    branchId: session.user.branchId,
    permissions: session.user.permissions,
    roles: session.user.roles,
  })

  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/sales')
}

export async function editSaleAction(input: EditSaleInput) {
  const session = await getSession()
  if (!session?.user) throw new Error('Unauthorized')

  const permissions = session.user.permissions ?? []
  const roles = session.user.roles ?? []
  const isAuthorized =
    permissions.includes(PERMISSIONS.SALES_VOID) ||
    roles.some((r: string) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

  if (!isAuthorized) {
    throw new Error('Forbidden: requires permission sales:void or Admin role to edit sales')
  }

  const updatedSale = await editSale(input, {
    id: session.user.id,
    branchId: session.user.branchId,
    permissions: session.user.permissions,
    roles: session.user.roles,
  })

  revalidatePath(`/sales/${input.saleId}`)
  revalidatePath('/sales')
  return JSON.parse(JSON.stringify(updatedSale)) as SaleDetail
}

