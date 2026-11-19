import { EventEmitter } from 'node:events'
import { fork } from 'node:child_process'

import {
  getSpawnedJobStatus,
  listSpawnedJobs,
  spawnExpirySweepProcess,
} from './expiry-spawner'

jest.mock('node:child_process', () => ({
  fork: jest.fn(),
}))

const forkMock = fork as unknown as jest.Mock

describe('expiry-spawner', () => {
  let mockChild: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockChild = new EventEmitter()
    mockChild.pid = 99999
    mockChild.kill = jest.fn()
    mockChild.stdout = new EventEmitter()
    mockChild.stderr = new EventEmitter()
    forkMock.mockReturnValue(mockChild)
  })

  it('spawns child process with appropriate arguments and registers job', async () => {
    const handle = spawnExpirySweepProcess({
      branchId: 'br-123',
      chunkSize: 100,
      concurrency: 4,
      dryRun: true,
    })

    expect(forkMock).toHaveBeenCalledWith(
      expect.stringContaining('expiry-sweep-runner.js'),
      expect.arrayContaining([
        expect.stringContaining('--jobId='),
        '--chunkSize=100',
        '--concurrency=4',
        '--dryRun=true',
        '--branchId=br-123',
      ]),
      expect.any(Object)
    )

    expect(handle.jobId).toBeDefined()
    expect(handle.pid).toBe(99999)

    const job = getSpawnedJobStatus(handle.jobId)
    expect(job).toBeDefined()
    expect(job?.status).toBe('RUNNING')
    expect(job?.pid).toBe(99999)
  })

  it('resolves promise and marks job COMPLETED when child finishes successfully', async () => {
    const handle = spawnExpirySweepProcess()

    const mockSweepResult = {
      success: true,
      totalDue: 10,
      expiredCount: 10,
      skippedCount: 0,
      errorCount: 0,
      durationMs: 150,
      modeUsed: 'spawn',
      workersUsed: 2,
      chunksCount: 1,
    }

    // Simulate child sending message and exiting with code 0
    setTimeout(() => {
      mockChild.emit('message', {
        type: 'SWEEP_COMPLETE',
        result: mockSweepResult,
      })
      mockChild.emit('exit', 0)
    }, 10)

    const result = await handle.promise
    expect(result.expiredCount).toBe(10)
    expect(result.modeUsed).toBe('spawn')

    const job = getSpawnedJobStatus(handle.jobId)
    expect(job?.status).toBe('COMPLETED')
    expect(job?.result).toBeDefined()
  })

  it('cancels a running job and sends SIGTERM', () => {
    const handle = spawnExpirySweepProcess()
    const cancelled = handle.cancel()

    expect(cancelled).toBe(true)
    expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM')

    const job = getSpawnedJobStatus(handle.jobId)
    expect(job?.status).toBe('FAILED')
    expect(job?.error).toContain('Cancelled')
  })

  it('lists all registered spawned jobs', () => {
    const handle1 = spawnExpirySweepProcess()
    const handle2 = spawnExpirySweepProcess()

    const jobs = listSpawnedJobs()
    expect(jobs.length).toBeGreaterThanOrEqual(2)
    expect(jobs.some((j) => j.jobId === handle1.jobId)).toBe(true)
    expect(jobs.some((j) => j.jobId === handle2.jobId)).toBe(true)
  })
})
