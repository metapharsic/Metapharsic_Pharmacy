import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import path from 'path'
import prisma from '../src/lib/db/prisma'
import { ReportService } from '../src/lib/reports/report-service'

interface ThreadResult {
  threadId: number
  threadName: string
  success: boolean
  durationMs: number
  metrics: Record<string, any>
  error?: string
}

// ─────────────────────────────────────────────────────────────
// WORKER THREAD LOGIC
// ─────────────────────────────────────────────────────────────
if (!isMainThread) {
  const { threadId, threadName, branchId } = workerData as {
    threadId: number
    threadName: string
    branchId: string
  }

  async function runThreadTask() {
    const start = Date.now()
    try {
      let metrics: Record<string, any> = {}

      if (threadId === 1) {
        // ── Thread 1: Sales Financials & Aggregations ─────────────
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        const endDate = new Date()
        const financials = await ReportService.getSalesFinancials(branchId, startDate, endDate)

        if (typeof financials.totalRevenue !== 'number' || isNaN(financials.totalRevenue)) {
          throw new Error('Invalid totalRevenue returned from getSalesFinancials')
        }
        if (!Array.isArray(financials.dailyBreakdown)) {
          throw new Error('dailyBreakdown is not an array')
        }

        // Validate detailed sales query
        const detailedSales = await prisma.sale.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true } },
            prescription: {
              select: {
                id: true,
                doctorName: true,
                doctorRegNumber: true,
                doctor: { select: { id: true, name: true, regNumber: true } },
              },
            },
            payments: { select: { id: true, method: true, amount: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, drugSchedule: true } },
                itemBatches: { include: { batch: true } },
              },
            },
          },
        })

        metrics = {
          totalSalesCount: financials.totalSalesCount,
          totalRevenue: financials.totalRevenue,
          totalTax: financials.totalTax,
          totalDiscount: financials.totalDiscount,
          excludedSalesCount: financials.excludedSalesCount,
          dailyBucketsCount: financials.dailyBreakdown.length,
          detailedSalesSampleCount: detailedSales.length,
        }
      } else if (threadId === 2) {
        // ── Thread 2: Gross Profit & COGS Analytics ───────────────
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        const endDate = new Date()
        const grossProfit = await ReportService.getGrossProfitReport(branchId, {
          startDate,
          endDate,
        })

        if (!grossProfit.summary || typeof grossProfit.summary.grossProfit !== 'number') {
          throw new Error('Invalid grossProfit summary returned')
        }
        if (!Array.isArray(grossProfit.items)) {
          throw new Error('grossProfit items is not an array')
        }

        // Check arithmetic consistency
        const { totalRevenue, totalCogs, grossProfit: profit, profitMarginPercent } = grossProfit.summary
        const calculatedProfit = Math.round((totalRevenue - totalCogs) * 100) / 100
        if (Math.abs(calculatedProfit - profit) > 0.1) {
          throw new Error(`Gross profit mismatch: summary=${profit}, calculated=${calculatedProfit}`)
        }

        metrics = {
          totalRevenue,
          totalCogs,
          grossProfit: profit,
          profitMarginPercent,
          totalItemsSold: grossProfit.summary.totalItemsSold,
          categoriesCount: (grossProfit as any).categoryBreakdown?.length || 0,
          lineItemsCount: grossProfit.items.length,
        }
      } else if (threadId === 3) {
        // ── Thread 3: Statutory Schedule H/H1 & Narcotics Registers
        const scheduleReport = await ReportService.getScheduleHRegister(
          branchId,
          { scheduleType: 'ALL' },
          { page: 1, limit: 50 }
        )

        if (!Array.isArray(scheduleReport.data)) {
          throw new Error('Schedule H register data is not an array')
        }

        // Test Narcotic register
        const narcoticReport = await ReportService.getNarcoticRegister(branchId)

        metrics = {
          scheduleEntriesFound: scheduleReport.total,
          scheduleRowsReturned: scheduleReport.data.length,
          scheduleMetrics: (scheduleReport as any).metrics || null,
          narcoticEntriesFound: narcoticReport.total,
        }
      } else if (threadId === 4) {
        // ── Thread 4: Doctor Performance & Referrals Audit ───────
        const doctorReport = await ReportService.getDoctorPerformanceReport()

        if (!Array.isArray(doctorReport)) {
          throw new Error('Doctor performance report is not an array')
        }

        for (const doc of doctorReport) {
          if (typeof doc.totalSalesRevenue !== 'number' || typeof doc.totalCommission !== 'number') {
            throw new Error(`Invalid numeric values for doctor ${doc.name}`)
          }
          if (doc.paidCommission + doc.pendingCommission !== doc.totalCommission) {
            const sum = Math.round((doc.paidCommission + doc.pendingCommission) * 100) / 100
            if (Math.abs(sum - doc.totalCommission) > 0.05) {
              throw new Error(`Commission balance mismatch for ${doc.name}`)
            }
          }
        }

        const totalDoctors = doctorReport.length
        const totalReferrals = doctorReport.reduce((acc, d) => acc + d.prescriptionsCount, 0)
        const totalDoctorRevenue = doctorReport.reduce((acc, d) => acc + d.totalSalesRevenue, 0)
        const totalDoctorCommissions = doctorReport.reduce((acc, d) => acc + d.totalCommission, 0)

        metrics = {
          totalDoctors,
          totalReferrals,
          totalDoctorRevenue: Math.round(totalDoctorRevenue * 100) / 100,
          totalDoctorCommissions: Math.round(totalDoctorCommissions * 100) / 100,
        }
      }

      parentPort?.postMessage({
        threadId,
        threadName,
        success: true,
        durationMs: Date.now() - start,
        metrics,
      } as ThreadResult)
    } catch (err: any) {
      parentPort?.postMessage({
        threadId,
        threadName,
        success: false,
        durationMs: Date.now() - start,
        metrics: {},
        error: err.message || String(err),
      } as ThreadResult)
    } finally {
      await prisma.$disconnect()
    }
  }

  void runThreadTask()
}

// ─────────────────────────────────────────────────────────────
// MAIN THREAD CONTROLLER
// ─────────────────────────────────────────────────────────────
if (isMainThread) {
  async function runController() {
    console.log('======================================================================')
    console.log('   Multi-Threaded Reporting Wiring & Verification Engine')
    console.log('======================================================================')

    const defaultBranch = await prisma.branch.findFirst({ select: { id: true, name: true } })
    if (!defaultBranch) {
      console.error('No branch found in database to execute reports against.')
      process.exit(1)
    }

    console.log(`Target Branch: ${defaultBranch.name} (${defaultBranch.id})`)
    console.log('Spawning 4 concurrent worker threads...\n')

    const threads = [
      { id: 1, name: 'Sales Financials & Daily Aggregations' },
      { id: 2, name: 'Gross Profit & COGS Margin Analytics' },
      { id: 3, name: 'Statutory Schedule H/H1 & Narcotics Registers' },
      { id: 4, name: 'Doctor Performance & Commissions Audit' },
    ]

    const startTime = Date.now()

    const results = await Promise.all(
      threads.map(
        (t) =>
          new Promise<ThreadResult>((resolve) => {
            const worker = new Worker(__filename, {
              workerData: {
                threadId: t.id,
                threadName: t.name,
                branchId: defaultBranch.id,
              },
            })

            worker.on('message', (msg: ThreadResult) => {
              resolve(msg)
            })

            worker.on('error', (err) => {
              resolve({
                threadId: t.id,
                threadName: t.name,
                success: false,
                durationMs: 0,
                metrics: {},
                error: err.message,
              })
            })
          })
      )
    )

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('----------------------------------------------------------------------')
    console.log(`Execution Completed in ${totalDuration}s`)
    console.log('----------------------------------------------------------------------')

    let allPassed = true
    for (const r of results) {
      const statusIcon = r.success ? 'PASS [OK]' : 'FAIL [X]'
      console.log(`\nThread #${r.threadId}: ${r.threadName} -> ${statusIcon} in ${r.durationMs}ms`)
      if (r.success) {
        console.log('  Metrics:', JSON.stringify(r.metrics, null, 2))
      } else {
        allPassed = false
        console.error('  Error:', r.error)
      }
    }

    console.log('\n======================================================================')
    if (allPassed) {
      console.log('SUMMARY: ALL 4 REPORTING THREADS PASSED WITH 100% SUCCESS RATE')
      console.log('Reporting services, database queries, and worker logic fully wired.')
      console.log('======================================================================')
      process.exit(0)
    } else {
      console.error('SUMMARY: ONE OR MORE THREADS FAILED')
      console.log('======================================================================')
      process.exit(1)
    }
  }

  runController()
    .catch((err) => {
      console.error('Controller fatal error:', err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}

