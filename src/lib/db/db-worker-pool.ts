/**
 * Multi-Threaded Database Worker Pool
 * Manages persistent worker threads to execute parallel domain queries across PostgreSQL,
 * ensuring high throughput, thread isolation, and zero-downtime resilient fallbacks.
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { Worker } from 'worker_threads'

import prisma from '@/lib/db/prisma'

export type FetchDomain = 'INVENTORY' | 'COMMERCE' | 'FINANCE' | 'CLINICAL' | 'EXPIRY'

export interface DomainFetchTask {
  taskId: string
  domain: FetchDomain
  organizationId?: string
  branchId?: string
  filters?: Record<string, unknown>
}

export interface DomainFetchResult<T = Record<string, unknown>> {
  taskId: string
  domain: FetchDomain
  success: boolean
  data?: T
  error?: string
  durationMs: number
  threadId?: number
}

export interface MultiThreadFetchReport {
  executionMode: 'worker_threads' | 'in_process_fallback'
  totalDurationMs: number
  threadCount: number
  results: Record<FetchDomain, DomainFetchResult>
  allSuccessful: boolean
}

export interface SidebarStats {
  inventory: {
    totalProducts: number
    lowStockCount: number
    outOfStockCount: number
    activeBatches: number
  }
  commerce: {
    todaySalesCount: number
    pendingPrescriptions: number
    todayRevenue: number
  }
  finance: {
    receiptVouchersCount: number
    activeLedgersCount: number
    pendingPayablesCount: number
  }
  clinical: {
    totalDoctors: number
    pendingCommissions: number
    activeCustomers: number
  }
  expiry: {
    expiredCount: number
    expiring30Count: number
    expiring90Count: number
  }
  telemetry: {
    mode: 'worker_threads' | 'in_process_fallback'
    durationMs: number
    threadCount: number
    allSuccessful: boolean
  }
}

const DEFAULT_SIDEBAR_STATS: SidebarStats = {
  inventory: { totalProducts: 0, lowStockCount: 0, outOfStockCount: 0, activeBatches: 0 },
  commerce: { todaySalesCount: 0, pendingPrescriptions: 0, todayRevenue: 0 },
  finance: { receiptVouchersCount: 0, activeLedgersCount: 0, pendingPayablesCount: 0 },
  clinical: { totalDoctors: 0, pendingCommissions: 0, activeCustomers: 0 },
  expiry: { expiredCount: 0, expiring30Count: 0, expiring90Count: 0 },
  telemetry: { mode: 'in_process_fallback', durationMs: 0, threadCount: 0, allSuccessful: true },
}

interface WorkerHandle {
  id: number
  worker: Worker
  isBusy: boolean
  currentTaskId?: string
}

function resolveWorkerScriptPath(): string {
  const candidates = [
    resolve(__dirname, 'db-fetch-worker.js'),
    resolve(process.cwd(), 'src/lib/db/db-fetch-worker.js'),
    resolve(process.cwd(), '.next/server/chunks/db-fetch-worker.js'),
  ]

  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return candidates[1]
}

export class DbWorkerPool {
  private workers: WorkerHandle[] = []
  private poolSize: number
  private isInitialized = false
  private pendingTasks: Map<string, {
    resolve: (res: DomainFetchResult) => void
    reject: (err: Error) => void
    timer: NodeJS.Timeout
    domain: FetchDomain
    startTime: number
  }> = new Map()

  constructor(poolSize: number = 4) {
    this.poolSize = Math.max(1, Math.min(16, poolSize))
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return

    const scriptPath = resolveWorkerScriptPath()
    if (!existsSync(scriptPath)) {
      throw new Error(`Worker script not found at ${scriptPath}`)
    }

    const initPromises: Promise<void>[] = []

    for (let i = 0; i < this.poolSize; i++) {
      const p = new Promise<void>((resolve, reject) => {
        try {
          const worker = new Worker(scriptPath)
          const handle: WorkerHandle = {
            id: i + 1,
            worker,
            isBusy: false,
          }

          const onReady = (msg: { type: string }) => {
            if (msg.type === 'WORKER_READY') {
              worker.off('message', onReady)
              this.workers.push(handle)
              this.attachMessageHandlers(handle)
              resolve()
            }
          }

          worker.on('message', onReady)
          worker.on('error', (err) => {
            console.error(`[DbWorkerPool] Worker ${i + 1} initialization error:`, err)
            reject(err)
          })
        } catch (err) {
          reject(err)
        }
      })
      initPromises.push(p)
    }

    try {
      await Promise.all(initPromises)
      this.isInitialized = true
    } catch (err) {
      // Clean up any successfully started workers
      await this.terminate()
      throw err
    }
  }

  private attachMessageHandlers(handle: WorkerHandle): void {
    handle.worker.on('message', (msg: {
      type: string
      taskId: string
      domain: FetchDomain
      data?: Record<string, unknown>
      error?: string
      durationMs: number
    }) => {
      if (msg.type === 'DOMAIN_SUCCESS' || msg.type === 'DOMAIN_ERROR') {
        const pending = this.pendingTasks.get(msg.taskId)
        if (pending) {
          clearTimeout(pending.timer)
          this.pendingTasks.delete(msg.taskId)
          handle.isBusy = false
          handle.currentTaskId = undefined

          pending.resolve({
            taskId: msg.taskId,
            domain: msg.domain,
            success: msg.type === 'DOMAIN_SUCCESS',
            data: msg.data,
            error: msg.error,
            durationMs: msg.durationMs,
            threadId: handle.worker.threadId,
          })
        }
      }
    })

    handle.worker.on('error', (err) => {
      console.error(`[DbWorkerPool] Worker ${handle.id} error:`, err)
      if (handle.currentTaskId) {
        const pending = this.pendingTasks.get(handle.currentTaskId)
        if (pending) {
          clearTimeout(pending.timer)
          this.pendingTasks.delete(handle.currentTaskId)
          pending.resolve({
            taskId: handle.currentTaskId,
            domain: pending.domain,
            success: false,
            error: err.message,
            durationMs: Math.round(performance.now() - pending.startTime),
            threadId: handle.worker.threadId,
          })
        }
      }
      handle.isBusy = false
      handle.currentTaskId = undefined
    })
  }

  public async executeTask(task: DomainFetchTask, timeoutMs = 8000): Promise<DomainFetchResult> {
    if (!this.isInitialized || this.workers.length === 0) {
      return this.executeInProcessFallback(task)
    }

    const availableWorker = this.workers.find((w) => !w.isBusy)
    if (!availableWorker) {
      // All threads busy; execute via fallback to prevent deadlock
      return this.executeInProcessFallback(task)
    }

    availableWorker.isBusy = true
    availableWorker.currentTaskId = task.taskId
    const startTime = performance.now()

    return new Promise<DomainFetchResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTasks.delete(task.taskId)
        availableWorker.isBusy = false
        availableWorker.currentTaskId = undefined
        resolve({
          taskId: task.taskId,
          domain: task.domain,
          success: false,
          error: `Task timed out after ${timeoutMs}ms`,
          durationMs: Math.round(performance.now() - startTime),
        })
      }, timeoutMs)

      this.pendingTasks.set(task.taskId, {
        resolve,
        reject,
        timer,
        domain: task.domain,
        startTime,
      })

      availableWorker.worker.postMessage({
        type: 'EXECUTE_DOMAIN',
        taskId: task.taskId,
        domain: task.domain,
        organizationId: task.organizationId,
        branchId: task.branchId,
        filters: task.filters,
      })
    })
  }

  public async executeInProcessFallback(task: DomainFetchTask): Promise<DomainFetchResult> {
    const startTime = performance.now()
    try {
      let data: Record<string, unknown> = {}
      const now = new Date()
      const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const ninetyDaysAhead = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

      const orgId = task.organizationId
      const branchId = task.branchId

      let orgBranchIds: string[] = Array.isArray(task.filters?.orgBranchIds)
        ? (task.filters.orgBranchIds as string[])
        : []

      if (orgBranchIds.length === 0 && orgId && !branchId && (prisma as unknown as { branch?: { findMany: unknown } }).branch) {
        try {
          const orgBranches = await prisma.branch.findMany({
            where: { organizationId: orgId, isActive: true },
            select: { id: true },
          })
          orgBranchIds = orgBranches.map((b) => b.id)
        } catch {
          orgBranchIds = []
        }
      }

      const branchScope = branchId
        ? { branchId }
        : orgId
          ? { branch: { organizationId: orgId } }
          : {}

      const batchScope = branchId
        ? { branchId }
        : orgId
          ? (orgBranchIds.length > 0 ? { branchId: { in: orgBranchIds } } : { branchId: '__no_such_branch__' })
          : {}

      const prescriptionScope = branchId
        ? { branchId }
        : orgId
          ? (orgBranchIds.length > 0 ? { branchId: { in: orgBranchIds } } : { branchId: '__no_such_branch__' })
          : {}

      switch (task.domain) {
        case 'INVENTORY': {
          const [totalProducts, lowStockCount, outOfStockCount, activeBatches] = await Promise.all([
            prisma.product.count({
              where: {
                ...(orgId ? { organizationId: orgId } : {}),
                isActive: true,
              },
            }),
            prisma.inventory.count({
              where: {
                ...branchScope,
                availableQuantity: { lte: 10, gt: 0 },
              },
            }),
            prisma.inventory.count({
              where: {
                ...branchScope,
                availableQuantity: 0,
              },
            }),
            prisma.batch.count({
              where: {
                status: 'ACTIVE',
                ...batchScope,
                quantity: { gt: 0 },
              },
            }),
          ])
          data = { totalProducts, lowStockCount, outOfStockCount, activeBatches }
          break
        }

        case 'COMMERCE': {
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          const [todaySalesCount, pendingPrescriptions, totalSalesAgg] = await Promise.all([
            prisma.sale.count({
              where: {
                ...branchScope,
                saleDate: { gte: today },
                status: { not: 'CANCELLED' },
              },
            }),
            prisma.prescription.count({
              where: {
                status: 'PENDING',
                ...prescriptionScope,
              },
            }),
            prisma.sale.aggregate({
              where: {
                ...branchScope,
                saleDate: { gte: today },
                status: 'COMPLETED',
              },
              _sum: { totalAmount: true },
            }),
          ])
          data = {
            todaySalesCount,
            pendingPrescriptions,
            todayRevenue: Number(totalSalesAgg._sum.totalAmount || 0),
          }
          break
        }

        case 'FINANCE': {
          const [receiptVouchersCount, activeLedgersCount, pendingPayablesCount] = await Promise.all([
            (prisma as unknown as { voucher?: { count: (q?: unknown) => Promise<number> } }).voucher?.count?.({
              where: branchScope,
            }).catch(() => 0) ?? 0,
            orgId
              ? Promise.resolve(0)
              : ((prisma as unknown as { ledger?: { count: () => Promise<number> } }).ledger?.count?.().catch(() => 0) ?? 0),
            prisma.purchase.count({
              where: {
                balanceDue: { gt: 0 },
                ...branchScope,
              },
            }).catch(() => 0),
          ])
          data = { receiptVouchersCount, activeLedgersCount, pendingPayablesCount }
          break
        }

        case 'CLINICAL': {
          const [totalDoctors, pendingCommissions, activeCustomers] = await Promise.all([
            prisma.doctor.count({
              where: {
                ...(orgId ? { organizationId: orgId } : {}),
                isActive: true,
              },
            }).catch(() => 0),
            (prisma as unknown as { doctorCommission?: { count: (q: unknown) => Promise<number> } }).doctorCommission?.count?.({
              where: {
                ...(orgId ? { doctor: { organizationId: orgId } } : {}),
                isPaid: false,
              },
            }).catch(() => 0) ?? 0,
            prisma.customer.count({
              where: {
                ...(orgId ? { organizationId: orgId } : {}),
                isActive: true,
              },
            }).catch(() => 0),
          ])
          data = { totalDoctors, pendingCommissions, activeCustomers }
          break
        }

        case 'EXPIRY': {
          const [expiredCount, expiring30Count, expiring90Count] = await Promise.all([
            prisma.batch.count({
              where: {
                status: { in: ['EXPIRED', 'ACTIVE'] },
                expiryDate: { lte: now },
                ...batchScope,
              },
            }),
            prisma.batch.count({
              where: {
                status: 'ACTIVE',
                expiryDate: { gt: now, lte: thirtyDaysAhead },
                ...batchScope,
              },
            }),
            prisma.batch.count({
              where: {
                status: 'ACTIVE',
                expiryDate: { gt: now, lte: ninetyDaysAhead },
                ...batchScope,
              },
            }),
          ])
          data = { expiredCount, expiring30Count, expiring90Count }
          break
        }
      }

      const durationMs = Math.round((performance.now() - startTime) * 100) / 100
      return {
        taskId: task.taskId,
        domain: task.domain,
        success: true,
        data,
        durationMs,
      }
    } catch (err) {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100
      return {
        taskId: task.taskId,
        domain: task.domain,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      }
    }
  }

  public async executeParallelFetch(organizationId?: string, branchId?: string): Promise<MultiThreadFetchReport> {
    const domains: FetchDomain[] = ['INVENTORY', 'COMMERCE', 'FINANCE', 'CLINICAL', 'EXPIRY']
    const startTime = performance.now()

    let mode: 'worker_threads' | 'in_process_fallback' = 'worker_threads'
    if (!this.isInitialized) {
      try {
        await this.initialize()
      } catch {
        mode = 'in_process_fallback'
      }
    }

    let orgBranchIds: string[] | undefined = undefined
    if (organizationId && !branchId && (prisma as unknown as { branch?: { findMany: unknown } }).branch) {
      try {
        const orgBranches = await prisma.branch.findMany({
          where: { organizationId, isActive: true },
          select: { id: true },
        })
        orgBranchIds = orgBranches.map((b) => b.id)
      } catch {
        orgBranchIds = []
      }
    }

    const taskPromises = domains.map((domain) =>
      this.executeTask({
        taskId: `task_${domain}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        domain,
        organizationId,
        branchId,
        filters: orgBranchIds !== undefined ? { orgBranchIds } : undefined,
      })
    )

    const settledResults = await Promise.all(taskPromises)
    const resultsMap: Record<FetchDomain, DomainFetchResult> = {} as Record<FetchDomain, DomainFetchResult>

    let allSuccessful = true
    for (const r of settledResults) {
      resultsMap[r.domain] = r
      if (!r.success) allSuccessful = false
    }

    const totalDurationMs = Math.round((performance.now() - startTime) * 100) / 100

    return {
      executionMode: mode,
      totalDurationMs,
      threadCount: this.workers.length,
      results: resultsMap,
      allSuccessful,
    }
  }

  public async terminate(): Promise<void> {
    const termPromises = this.workers.map((w) => {
      w.worker.postMessage({ type: 'TERMINATE' })
      return w.worker.terminate()
    })
    await Promise.all(termPromises).catch(() => {})
    this.workers = []
    this.isInitialized = false
    this.pendingTasks.clear()
  }
}

// Global Singleton Instance attached to globalThis to survive Next.js HMR in dev
const globalForDbPool = globalThis as unknown as {
  dbWorkerPool: DbWorkerPool | undefined
}

export function getDbWorkerPool(poolSize = 2): DbWorkerPool {
  if (!globalForDbPool.dbWorkerPool) {
    globalForDbPool.dbWorkerPool = new DbWorkerPool(poolSize)
  }
  return globalForDbPool.dbWorkerPool
}

export async function fetchSidebarAggregates(
  organizationId?: string,
  branchId?: string
): Promise<SidebarStats> {
  try {
    const pool = getDbWorkerPool()
    const report: MultiThreadFetchReport = await pool.executeParallelFetch(organizationId, branchId)

    const invData = report.results.INVENTORY?.data as Partial<SidebarStats['inventory']> | undefined
    const comData = report.results.COMMERCE?.data as Partial<SidebarStats['commerce']> | undefined
    const finData = report.results.FINANCE?.data as Partial<SidebarStats['finance']> | undefined
    const cliData = report.results.CLINICAL?.data as Partial<SidebarStats['clinical']> | undefined
    const expData = report.results.EXPIRY?.data as Partial<SidebarStats['expiry']> | undefined

    return {
      inventory: {
        totalProducts: Number(invData?.totalProducts ?? 0),
        lowStockCount: Number(invData?.lowStockCount ?? 0),
        outOfStockCount: Number(invData?.outOfStockCount ?? 0),
        activeBatches: Number(invData?.activeBatches ?? 0),
      },
      commerce: {
        todaySalesCount: Number(comData?.todaySalesCount ?? 0),
        pendingPrescriptions: Number(comData?.pendingPrescriptions ?? 0),
        todayRevenue: Number(comData?.todayRevenue ?? 0),
      },
      finance: {
        receiptVouchersCount: Number(finData?.receiptVouchersCount ?? 0),
        activeLedgersCount: Number(finData?.activeLedgersCount ?? 0),
        pendingPayablesCount: Number(finData?.pendingPayablesCount ?? 0),
      },
      clinical: {
        totalDoctors: Number(cliData?.totalDoctors ?? 0),
        pendingCommissions: Number(cliData?.pendingCommissions ?? 0),
        activeCustomers: Number(cliData?.activeCustomers ?? 0),
      },
      expiry: {
        expiredCount: Number(expData?.expiredCount ?? 0),
        expiring30Count: Number(expData?.expiring30Count ?? 0),
        expiring90Count: Number(expData?.expiring90Count ?? 0),
      },
      telemetry: {
        mode: report.executionMode,
        durationMs: report.totalDurationMs,
        threadCount: report.threadCount,
        allSuccessful: report.allSuccessful,
      },
    }
  } catch (err) {
    console.error('[fetchSidebarAggregates] Unexpected error in multi-thread fetch:', err)
    return DEFAULT_SIDEBAR_STATS
  }
}
