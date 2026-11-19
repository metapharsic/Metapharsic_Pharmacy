/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET, POST } from '@/app/api/batches/expire/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import {
  getSpawnedJobStatus,
  listSpawnedJobs,
  runMultiThreadedExpirySweep,
  spawnExpirySweepProcess,
} from '@/lib/batches/batch-service'
import { resolveBranchScope } from '@/lib/inventory/branch-access'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/batches/batch-service', () => ({
  runMultiThreadedExpirySweep: jest.fn(),
  spawnExpirySweepProcess: jest.fn(),
  getSpawnedJobStatus: jest.fn(),
  listSpawnedJobs: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedRunSweep = runMultiThreadedExpirySweep as jest.Mock
const mockedSpawnProcess = spawnExpirySweepProcess as jest.Mock
const mockedGetJob = getSpawnedJobStatus as jest.Mock
const mockedListJobs = listSpawnedJobs as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock

function makeReq(url: string, options?: RequestInit): NextRequest {
  return new Request(url, options) as unknown as NextRequest
}

describe('/api/batches/expire', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequirePermission.mockResolvedValue({ id: 'user-1', branchId: null })
    mockedResolveBranchScope.mockImplementation((_, branchId) => branchId ?? null)
  })

  describe('GET', () => {
    it('returns 403 when user lacks read permission', async () => {
      mockedRequirePermission.mockRejectedValueOnce(new Error('Forbidden: missing permission'))
      const res = await GET(makeReq('http://localhost/api/batches/expire'))
      expect(res.status).toBe(403)
    })

    it('returns list of spawned jobs when no jobId specified', async () => {
      mockedListJobs.mockReturnValueOnce([
        { jobId: 'job-1', pid: 1234, status: 'COMPLETED', startedAt: '2026-01-01' },
      ])

      const res = await GET(makeReq('http://localhost/api/batches/expire'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.jobs).toHaveLength(1)
    })

    it('returns single job status when jobId query param is provided', async () => {
      mockedGetJob.mockReturnValueOnce({
        jobId: 'job-123',
        pid: 5678,
        status: 'RUNNING',
        startedAt: '2026-01-01',
      })

      const res = await GET(makeReq('http://localhost/api/batches/expire?jobId=job-123'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.job.jobId).toBe('job-123')
    })

    it('returns 404 when requested jobId is not found', async () => {
      mockedGetJob.mockReturnValueOnce(undefined)

      const res = await GET(makeReq('http://localhost/api/batches/expire?jobId=unknown'))
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('POST', () => {
    it('returns 403 when user lacks update permission', async () => {
      mockedRequirePermission.mockRejectedValueOnce(new Error('Forbidden: missing permission'))
      const res = await POST(
        makeReq('http://localhost/api/batches/expire', {
          method: 'POST',
          body: JSON.stringify({ mode: 'worker' }),
        })
      )
      expect(res.status).toBe(403)
    })

    it('executes worker mode and returns 200 with sweep metrics', async () => {
      mockedRunSweep.mockResolvedValueOnce({
        success: true,
        totalDue: 5,
        expiredCount: 5,
        skippedCount: 0,
        errorCount: 0,
        durationMs: 42,
        modeUsed: 'worker',
        workersUsed: 2,
        chunksCount: 1,
      })

      const res = await POST(
        makeReq('http://localhost/api/batches/expire', {
          method: 'POST',
          body: JSON.stringify({ mode: 'worker', chunkSize: 50 }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.expiredCount).toBe(5)
      expect(data.modeUsed).toBe('worker')
    })

    it('spawns background process and returns 202 Accepted when mode is spawn', async () => {
      mockedSpawnProcess.mockReturnValueOnce({
        jobId: 'expiry-job-abc',
        pid: 7777,
        promise: Promise.resolve({}),
        cancel: jest.fn(),
      })

      const res = await POST(
        makeReq('http://localhost/api/batches/expire', {
          method: 'POST',
          body: JSON.stringify({ mode: 'spawn', branchId: 'br-1' }),
        })
      )

      expect(res.status).toBe(202)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('expiry-job-abc')
      expect(data.pid).toBe(7777)
      expect(data.status).toBe('RUNNING')
    })

    it('returns 400 when body fails schema validation', async () => {
      const res = await POST(
        makeReq('http://localhost/api/batches/expire', {
          method: 'POST',
          body: JSON.stringify({ chunkSize: -10 }), // invalid chunk size
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION')
    })
  })
})
