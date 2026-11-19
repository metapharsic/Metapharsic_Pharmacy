import type { BatchStatus, PrismaClient } from '@prisma/client'

import { chunkArray, processDueBatchChunk } from './expiry-engine'
import type { DueBatchItem } from './expiry-types'

describe('expiry-engine', () => {
  describe('chunkArray', () => {
    it('splits an array into chunks of the given size', () => {
      const items = [1, 2, 3, 4, 5, 6, 7]
      const chunks = chunkArray(items, 3)
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    })

    it('handles empty arrays', () => {
      expect(chunkArray([], 5)).toEqual([])
    })

    it('defaults to chunk size 50 if <= 0 provided', () => {
      const items = Array.from({ length: 60 }, (_, i) => i)
      const chunks = chunkArray(items, 0)
      expect(chunks).toHaveLength(2)
      expect(chunks[0]).toHaveLength(50)
      expect(chunks[1]).toHaveLength(10)
    })
  })

  describe('processDueBatchChunk', () => {
    const mockTx = {
      batch: {
        updateMany: jest.fn(),
      },
      batchStatusLog: {
        create: jest.fn(),
      },
    }

    const mockPrisma = {
      $transaction: jest.fn(async (cb) => cb(mockTx)),
    } as unknown as PrismaClient

    const sampleBatches: DueBatchItem[] = [
      {
        id: 'b1',
        batchNumber: 'BN001',
        status: 'ACTIVE' as BatchStatus,
        expiryDate: new Date('2025-01-01'),
        productId: 'p1',
        branchId: 'br1',
      },
      {
        id: 'b2',
        batchNumber: 'BN002',
        status: 'BLOCKED' as BatchStatus,
        expiryDate: new Date('2025-01-02'),
        productId: 'p1',
        branchId: 'br1',
      },
    ]

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('returns empty metrics when batches array is empty', async () => {
      const res = await processDueBatchChunk([], mockPrisma)
      expect(res.totalInChunk).toBe(0)
      expect(res.expiredCount).toBe(0)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('simulates expiry without modifying DB in dryRun mode', async () => {
      const res = await processDueBatchChunk(sampleBatches, mockPrisma, { dryRun: true })
      expect(res.totalInChunk).toBe(2)
      expect(res.expiredCount).toBe(2)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('applies CAS updates and creates status logs for matched batches', async () => {
      mockTx.batch.updateMany.mockResolvedValue({ count: 1 })
      mockTx.batchStatusLog.create.mockResolvedValue({ id: 'log-1' })

      const res = await processDueBatchChunk(sampleBatches, mockPrisma, {
        workerId: 1,
        chunkIndex: 0,
        initiatedById: 'usr-admin',
      })

      expect(res.totalInChunk).toBe(2)
      expect(res.expiredCount).toBe(2)
      expect(res.skippedCount).toBe(0)
      expect(res.errorCount).toBe(0)

      expect(mockTx.batch.updateMany).toHaveBeenCalledWith({
        where: { id: 'b1', status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      })
      expect(mockTx.batchStatusLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          batchId: 'b1',
          fromStatus: 'ACTIVE',
          toStatus: 'EXPIRED',
          reason: 'Batch expired',
          changedById: 'usr-admin',
        }),
      })
    })

    it('records skipped count when CAS returns count 0 (concurrent modification)', async () => {
      // First batch succeeds, second batch fails CAS match (e.g. concurrent sale or disposal)
      mockTx.batch.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
      mockTx.batchStatusLog.create.mockResolvedValue({ id: 'log-1' })

      const res = await processDueBatchChunk(sampleBatches, mockPrisma)

      expect(res.totalInChunk).toBe(2)
      expect(res.expiredCount).toBe(1)
      expect(res.skippedCount).toBe(1)
      expect(res.errorCount).toBe(0)
      // Only 1 log should be created since the second batch was skipped
      expect(mockTx.batchStatusLog.create).toHaveBeenCalledTimes(1)
    })

    it('catches and records errors per batch without breaking entire chunk', async () => {
      mockTx.batch.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockRejectedValueOnce(new Error('DB Connection Timeout'))

      const res = await processDueBatchChunk(sampleBatches, mockPrisma)

      expect(res.totalInChunk).toBe(2)
      expect(res.expiredCount).toBe(1)
      expect(res.errorCount).toBe(1)
      expect(res.errors).toHaveLength(1)
      expect(res.errors[0]).toEqual({
        batchId: 'b2',
        error: 'DB Connection Timeout',
      })
    })
  })
})
