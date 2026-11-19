import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import {
  getSpawnedJobStatus,
  listSpawnedJobs,
  runMultiThreadedExpirySweep,
  spawnExpirySweepProcess,
} from '@/lib/batches/batch-service'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { batchExpirySweepSchema } from '@/lib/validations/expiry'

// GET /api/batches/expire?jobId=...
// Retrieve status of background spawned batch expiry sweeps
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.BATCHES_READ)

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')

    if (jobId) {
      const job = getSpawnedJobStatus(jobId)
      if (!job) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: `Job ${jobId} not found` } },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, job })
    }

    const jobs = listSpawnedJobs()
    return NextResponse.json({ success: true, jobs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/batches/expire
// Trigger a multi-threaded or background spawned batch expiry sweep
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.BATCHES_UPDATE)

    let body = {}
    try {
      body = await req.json()
    } catch {
      // Empty body is acceptable; defaults will apply
    }

    const parsed = batchExpirySweepSchema.parse(body)
    const branchId = await resolveBranchScope(user, parsed.branchId)

    if (parsed.mode === 'spawn') {
      const handle = spawnExpirySweepProcess({
        ...parsed,
        branchId: branchId ?? undefined,
        initiatedById: user.id,
      })

      return NextResponse.json(
        {
          success: true,
          message: 'Batch expiry background process spawned',
          jobId: handle.jobId,
          pid: handle.pid,
          status: 'RUNNING',
        },
        { status: 202 }
      )
    }

    // Default or worker / sync execution
    const result = await runMultiThreadedExpirySweep({
      ...parsed,
      branchId: branchId ?? undefined,
      initiatedById: user.id,
    })

    return NextResponse.json({
      ...result,
    })
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
            : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
