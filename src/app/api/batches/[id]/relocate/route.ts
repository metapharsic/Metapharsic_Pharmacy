import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { relocateBatchProductStorage } from '@/lib/batches/batch-service'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { relocateBatchStorageSchema } from '@/lib/validations/batch'

type RouteParams = { params: { id: string } }

// POST /api/batches/:id/relocate — Update batch product storage (Rack, Shelf, Box)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.BATCHES_UPDATE)

    const body = await req.json()
    const data = relocateBatchStorageSchema.parse({
      ...body,
      batchId: params.id,
    })

    const result = await relocateBatchProductStorage(data, user)

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'BatchStorage',
        entityId: params.id,
        metadata: {
          rack: data.rack,
          shelf: data.shelf,
          box: data.box,
          reason: data.reason,
        },
      },
    }).catch(() => {
      // Ignore if audit log table fails in mock
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid input',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message.startsWith('Forbidden')
          ? 403
          : message.startsWith('Not Found')
            ? 404
            : message.startsWith('Conflict')
              ? 409
              : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
