import type { BatchStatus } from '@prisma/client'

export type ExpiryExecutionMode = 'auto' | 'worker' | 'spawn' | 'sync'

export interface ExpirySweepProgress {
  chunksCompleted: number
  totalChunks: number
  batchesExpired: number
  batchesSkipped: number
  batchesFailed: number
  percentComplete: number
  elapsedMs: number
  currentThroughput: number // batches per sec
}

export interface BatchExpiryOptions {
  /** Optional branch filter for multi-tenant / branch scoped sweeps */
  branchId?: string | null
  /** Number of batches processed in each transactional chunk (default: 50) */
  chunkSize?: number
  /** Maximum parallel worker threads / concurrency (default: os.cpus().length, capped at 8) */
  concurrency?: number
  /** Cutoff date for expiry check (default: current Date) */
  asOfDate?: Date | string
  /** If true, calculates and returns batches that would expire without modifying DB */
  dryRun?: boolean
  /** Execution mode: 'auto' (worker with fallback), 'worker', 'spawn', or 'sync' */
  mode?: ExpiryExecutionMode
  /** Timeout in milliseconds before terminating workers (default: 60000ms) */
  timeoutMs?: number
  /** Optional user identifier initiating the sweep (for audit logging) */
  initiatedById?: string | null
  /** Optional streaming progress callback */
  onProgress?: (progress: ExpirySweepProgress) => void
}

export interface DueBatchItem {
  id: string
  batchNumber: string
  status: BatchStatus
  expiryDate: Date | string
  productId: string
  branchId: string | null
}

export interface ChunkProcessResult {
  workerId: number
  chunkIndex: number
  totalInChunk: number
  expiredCount: number
  skippedCount: number
  errorCount: number
  errors: Array<{ batchId: string; error: string }>
  durationMs: number
}

export interface BatchExpirySweepResult {
  success: boolean
  totalDue: number
  expiredCount: number
  skippedCount: number
  errorCount: number
  durationMs: number
  modeUsed: 'worker' | 'spawn' | 'sync'
  workersUsed: number
  chunksCount: number
  pid?: number
  jobId?: string
  throughput?: number
  errors?: Array<{ batchId?: string; error: string }>
}

export interface WorkerTaskPayload {
  workerId: number
  chunkIndex: number
  batches: DueBatchItem[]
  dryRun: boolean
  initiatedById: string | null
}

export interface WorkerReadyMessage {
  type: 'WORKER_READY'
  workerId: number
}

export interface WorkerResultMessage {
  type: 'CHUNK_COMPLETE'
  result: ChunkProcessResult
}

export interface WorkerErrorMessage {
  type: 'ERROR'
  workerId: number
  chunkIndex?: number
  error: string
}

export type WorkerMessage = WorkerReadyMessage | WorkerResultMessage | WorkerErrorMessage

export interface SpawnedJobStatus {
  jobId: string
  pid: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  startedAt: string
  completedAt?: string
  updatedAt?: string
  progress?: ExpirySweepProgress
  result?: BatchExpirySweepResult
  error?: string
}
