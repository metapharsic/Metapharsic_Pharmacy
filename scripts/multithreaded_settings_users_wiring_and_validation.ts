import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import path from 'path'
import prisma from '../src/lib/db/prisma'
import { ensureProvisionedDbSettings } from '../src/lib/settings/settings-provisioning-service'
import {
  getSystemSettingsMap,
  getAllSystemSettingsGrouped,
  getPosSettings,
} from '../src/lib/settings/settings-service'
import { runSettingsUsersWorker } from '../src/lib/settings/settings-users-bridge'

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
  const { threadId, threadName } = workerData as {
    threadId: number
    threadName: string
  }

  async function runThreadTask() {
    const start = Date.now()
    try {
      let metrics: Record<string, any> = {}

      if (threadId === 1) {
        // ── Thread 1: DB Settings Provisioning & Zero Hardcoding ───
        const provisioning = await ensureProvisionedDbSettings()

        const [systemRows, orgSettings, org] = await Promise.all([
          prisma.systemSetting.findMany(),
          prisma.organizationSetting.findMany(),
          prisma.organization.findFirst(),
        ])

        if (!org) {
          throw new Error('Organization not provisioned in database')
        }
        if (systemRows.length < 20) {
          throw new Error(`Insufficient system settings provisioned: ${systemRows.length}`)
        }
        if (orgSettings.length < 4) {
          throw new Error(`Insufficient organization settings provisioned: ${orgSettings.length}`)
        }

        // Verify that POS settings read directly from provisioned DB rows
        const posSettings = await getPosSettings()
        const settingsMap = await getSystemSettingsMap()

        metrics = {
          totalSystemSettingsInDb: systemRows.length,
          totalOrgSettingsInDb: orgSettings.length,
          organizationName: org.name,
          organizationGstin: org.gstin,
          organizationPan: org.pan,
          organizationDlNumber: org.dlNumber,
          posSettingsRetrievedFromDb: {
            invoiceType: posSettings.invoiceType,
            maxDiscountPercent: posSettings.maxDiscountPercent,
            fefoEnabled: posSettings.fefoEnabled,
            taxInclusive: posSettings.taxInclusive,
          },
          provisioningCreatedCount: provisioning.systemSettingsCreated + provisioning.orgSettingsCreated,
        }
      } else if (threadId === 2) {
        // ── Thread 2: Multi-Threaded Settings & Statutory Integrity ─
        const [systemSettings, orgSettings, organization] = await Promise.all([
          prisma.systemSetting.findMany({
            select: { id: true, category: true, key: true, value: true, dataType: true, label: true, updatedAt: true },
          }),
          prisma.organizationSetting.findMany(),
          prisma.organization.findFirst(),
        ])

        const audit = await runSettingsUsersWorker<
          {
            systemSettings: typeof systemSettings
            orgSettings: typeof orgSettings
            organization: typeof organization
          },
          {
            totalSettingsChecked: number
            validSettingsCount: number
            issues: Array<{ category: string; key: string; type: string; message: string }>
            gstComplianceValid: boolean
            status: string
          }
        >('AUDIT_SETTINGS_INTEGRITY', {
          systemSettings,
          orgSettings,
          organization,
        })

        if (!audit.gstComplianceValid) {
          throw new Error('GST statutory compliance audit failed')
        }

        metrics = {
          totalSettingsChecked: audit.totalSettingsChecked,
          validSettingsCount: audit.validSettingsCount,
          gstComplianceValid: audit.gstComplianceValid,
          auditStatus: audit.status,
          issuesCount: audit.issues.length,
        }
      } else if (threadId === 3) {
        // ── Thread 3: User Security Compliance & Branch Assignment ─
        const [users, roles, branches] = await Promise.all([
          prisma.user.findMany({
            include: {
              userRoles: { include: { role: true } },
              branch: { select: { id: true, name: true, code: true } },
            },
          }),
          prisma.role.findMany({
            include: { rolePermissions: { include: { permission: true } } },
          }),
          prisma.branch.findMany(),
        ])

        const userAudit = await runSettingsUsersWorker<
          {
            users: typeof users
            roles: typeof roles
            branches: typeof branches
          },
          {
            totalUsers: number
            activeUsers: number
            inactiveUsers: number
            activeOwnersCount: number
            orphanedUsersCount: number
            roleDistribution: Record<string, number>
            branchDistribution: Record<string, number>
            securityWarnings: Array<{ type: string; message: string }>
            securityStatus: string
          }
        >('AUDIT_USER_SECURITY_COMPLIANCE', {
          users,
          roles,
          branches,
        })

        if (userAudit.activeOwnersCount < 1) {
          throw new Error('Security failure: Zero active owners in database')
        }
        if (userAudit.orphanedUsersCount > 0) {
          throw new Error(`Security failure: Found ${userAudit.orphanedUsersCount} orphaned accounts`)
        }

        metrics = {
          totalUsers: userAudit.totalUsers,
          activeUsers: userAudit.activeUsers,
          activeOwnersCount: userAudit.activeOwnersCount,
          orphanedUsersCount: userAudit.orphanedUsersCount,
          securityStatus: userAudit.securityStatus,
          roleDistribution: userAudit.roleDistribution,
          branchDistribution: userAudit.branchDistribution,
        }
      } else if (threadId === 4) {
        // ── Thread 4: Multi-Branch & Organization Reconciliation ──
        const [branches, organization, orgSettings] = await Promise.all([
          prisma.branch.findMany({
            orderBy: { isHeadOffice: 'desc' },
          }),
          prisma.organization.findFirst(),
          prisma.organizationSetting.findMany(),
        ])

        const reconciliation = await runSettingsUsersWorker<
          {
            branches: typeof branches
            organization: typeof organization
            orgSettings: typeof orgSettings
          },
          {
            totalBranches: number
            headOfficeConfigured: boolean
            branchPrefixes: Record<string, string>
            discrepancies: Array<{ message: string }>
            reconciliationStatus: string
          }
        >('RECONCILE_BRANCH_AND_ORG_SETTINGS', {
          branches,
          organization,
          orgSettings,
        })

        if (!reconciliation.headOfficeConfigured) {
          throw new Error('Reconciliation failure: No head office branch configured')
        }
        if (reconciliation.reconciliationStatus !== 'SYNCHRONIZED') {
          throw new Error(`Reconciliation drift detected: ${JSON.stringify(reconciliation.discrepancies)}`)
        }

        metrics = {
          totalBranches: reconciliation.totalBranches,
          headOfficeConfigured: reconciliation.headOfficeConfigured,
          branchPrefixes: reconciliation.branchPrefixes,
          reconciliationStatus: reconciliation.reconciliationStatus,
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
    console.log('   Multi-Threaded Settings & Users Wiring & Validation Engine')
    console.log('======================================================================')

    console.log('Spawning 4 concurrent worker threads...\n')

    const threads = [
      { id: 1, name: 'DB Settings Provisioning & Zero-Hardcoding' },
      { id: 2, name: 'Multi-Threaded Settings & Statutory Integrity' },
      { id: 3, name: 'User Security Compliance & Branch Assignment' },
      { id: 4, name: 'Multi-Branch & Organization Reconciliation' },
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
      console.log('SUMMARY: ALL 4 SETTINGS & USERS THREADS PASSED WITH 100% SUCCESS RATE')
      console.log('All settings and users logic accurately wired and provisioned in DB.')
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

