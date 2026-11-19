/**
 * POST /api/purchases/scan/commit
 *
 * Confirms an ingested purchase bill and executes atomic inventory provisioning:
 * - Requires authentication & RBAC permission 'purchases:create'
 * - Validates bill structure and math integrity with commitPurchasePayloadSchema
 * - Executes atomic transaction via provisionPurchaseBill
 * - Provisions batches, updates inventory, logs movements, posts AP ledger, and records audit trail
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  commitPurchasePayloadSchema,
  ProvisioningValidationError,
  provisionPurchaseBill,
  type ProvisioningSessionUser,
  UnreconciledTotalError,
} from '@/lib/purchases/purchase-provisioning-service'

function getErrorStatus(message: string): number {
  if (message === 'Unauthorized') return 401
  if (message.startsWith('Forbidden') || message.includes('permission')) return 403
  if (message.startsWith('Not Found')) return 404
  return 400
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication & RBAC Authorization Check
    let user: ProvisioningSessionUser
    let sessionUser: Awaited<ReturnType<typeof requirePermission>>
    try {
      sessionUser = await requirePermission(PERMISSIONS.PURCHASES_CREATE)
      user = {
        id: sessionUser.id,
        name: sessionUser.name ?? undefined,
        roles: sessionUser.roles,
        permissions: sessionUser.permissions,
      }
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : 'Unauthorized'
      const status = getErrorStatus(msg)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
            message: msg,
          },
        },
        { status }
      )
    }

    // 2. Parse JSON Payload
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Failed to parse JSON body from request',
          },
        },
        { status: 400 }
      )
    }

    // 3. Strict Schema Validation
    const validationResult = commitPurchasePayloadSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.errors[0]?.message || 'Validation Error: Invalid bill payload',
            issues: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const payload = validationResult.data

    if (payload.branchId && payload.branchId !== 'all') {
      await assertBranchAccess(sessionUser as any, payload.branchId)
    }

    // 4. Provision Purchase Bill inside Atomic Transaction
    const result = await provisionPurchaseBill(payload, user)

    // 5. Return 201 Created Response
    return NextResponse.json(
      {
        success: true,
        purchaseId: result.purchaseId,
        purchaseNumber: result.purchaseNumber,
        totalItemsProvisioned: result.totalItemsProvisioned,
        totalUnitsAdded: result.totalUnitsAdded,
        totalAmount: result.totalAmount,
        status: result.status,
        data: {
          purchaseId: result.purchaseId,
          purchaseNumber: result.purchaseNumber,
          totalAmount: result.totalAmount,
          totalItemsProvisioned: result.totalItemsProvisioned,
          totalUnitsAdded: result.totalUnitsAdded,
          status: result.status,
        },
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.errors[0]?.message || 'Validation Error: Invalid bill payload',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }

    if (err instanceof UnreconciledTotalError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNRECONCILED_TOTAL',
            message: err.message,
            canAdminOverride: true,
          },
        },
        { status: 422 }
      )
    }

    if (err instanceof ProvisioningValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
          },
        },
        { status: 400 }
      )
    }

    const hasStatusCode =
      err !== null &&
      typeof err === 'object' &&
      'statusCode' in err &&
      typeof (err as { statusCode: unknown }).statusCode === 'number'

    const statusCode = hasStatusCode ? (err as { statusCode: number }).statusCode : 500

    const message = err instanceof Error ? err.message : 'Internal Server Error'

    if (statusCode === 422) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNRECONCILED_TOTAL',
            message,
          },
        },
        { status: 422 }
      )
    }

    const status = getErrorStatus(message)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'PROVISIONING_FAILED',
          message,
        },
      },
      { status: status === 400 ? 500 : status }
    )
  }
}
