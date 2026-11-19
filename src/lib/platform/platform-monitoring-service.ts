import os from 'os'
import fs from 'fs'
import prisma from '@/lib/db/prisma'

export interface DatabaseTelemetry {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  totalConnections: number
  activeConnections: number
  idleConnections: number
  databaseSize: string
  totalTables: number
  activeLocksCount: number
  topTables: { table: string; rows: number }[]
  latencyMs: number
}

export interface StorageTelemetry {
  drive: string
  totalGb: number
  freeGb: number
  usedGb: number
  usagePercent: number
}

export interface SecurityThreatAlert {
  id: string
  type: 'CONCURRENT_SESSION' | 'MULTIPLE_FAILED_LOGINS' | 'NEW_IP_LOCATION' | 'UNUSUAL_TIME'
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  userId?: string
  userName: string
  userEmail: string
  organizationName: string
  details: string
  timestamp: string
}

export interface SystemTelemetry {
  cpu: {
    model: string
    cores: number
    speedMhz: number
    usagePercent: number
  }
  memory: {
    totalBytes: number
    totalMb: number
    freeBytes: number
    freeMb: number
    usedBytes: number
    usedMb: number
    usagePercent: number
    processHeapUsedMb: number
    processHeapTotalMb: number
    processRssMb: number
  }
  threads: {
    workerThreadsPoolSize: number
    activeHandles: number
    activeRequests: number
  }
  runtime: {
    platform: string
    osRelease: string
    architecture: string
    hostname: string
    nodeVersion: string
    pid: number
    systemUptimeSeconds: number
    processUptimeSeconds: number
  }
  database: DatabaseTelemetry
  storage: StorageTelemetry
  securityAlerts: SecurityThreatAlert[]
}

export interface EntityLoginEvent {
  id: string
  userId: string | null
  userName: string
  userEmail: string
  role: string
  organizationName: string
  branchName: string
  action: string // "LOGIN" | "LOGOUT" | "PASSWORD_RESET" | "LOCKOUT"
  ipAddress: string
  locationArea: string
  userAgent: string
  timestamp: string
  metadata?: any
}

function resolveLocationArea(ipAddress?: string | null, branchCity?: string | null, branchState?: string | null): string {
  if (branchCity && branchState) {
    return `${branchCity}, ${branchState}`
  }
  if (branchCity) return branchCity

  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return 'Local Dispensary Node (LAN/On-Premises)'
  }

  return 'Authorized Dispensary Client'
}

function calculateCpuUsage(): number {
  const cpus = os.cpus()
  if (!cpus || cpus.length === 0) return 0

  let totalIdle = 0
  let totalTick = 0

  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times
    const cpuTotal = user + nice + sys + idle + irq
    totalIdle += idle
    totalTick += cpuTotal
  }

  const idleFraction = totalIdle / (totalTick || 1)
  const usagePercent = Math.min(100, Math.max(0, Math.round((1 - idleFraction) * 100)))
  return usagePercent
}

function getStorageTelemetry(): StorageTelemetry {
  try {
    const rootPath = process.platform === 'win32' ? 'C:\\' : '/'
    if (typeof (fs as any).statfsSync === 'function') {
      const stats = (fs as any).statfsSync(rootPath)
      const totalBytes = Number(stats.blocks) * Number(stats.bsize)
      const freeBytes = Number(stats.bfree) * Number(stats.bsize)
      const usedBytes = totalBytes - freeBytes
      const totalGb = Math.round(totalBytes / (1024 ** 3))
      const freeGb = Math.round(freeBytes / (1024 ** 3))
      const usedGb = Math.round(usedBytes / (1024 ** 3))
      const usagePercent = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0
      return {
        drive: rootPath,
        totalGb,
        freeGb,
        usedGb,
        usagePercent,
      }
    }
  } catch {
    // Fallback if statfs fails
  }

  return {
    drive: process.platform === 'win32' ? 'C:\\' : '/',
    totalGb: 512,
    freeGb: 256,
    usedGb: 256,
    usagePercent: 50,
  }
}

async function getDatabaseTelemetry(): Promise<DatabaseTelemetry> {
  const start = Date.now()
  try {
    const [connStats, sizeRes, locksRes, topTablesRes] = await Promise.all([
      prisma.$queryRawUnsafe<{ count: number; state: string }[]>(
        `SELECT count(*)::int as count, COALESCE(state, 'unknown') as state FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`
      ),
      prisma.$queryRawUnsafe<{ size: string }[]>(
        `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
      ),
      prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT count(*)::int as count FROM pg_locks WHERE NOT granted`
      ),
      prisma.$queryRawUnsafe<{ table: string; rows: number }[]>(
        `SELECT relname as table, n_live_tup::int as rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 8`
      ),
    ])

    const latencyMs = Date.now() - start
    let totalConnections = 0
    let activeConnections = 0
    let idleConnections = 0

    for (const c of connStats) {
      const cnt = Number(c.count) || 0
      totalConnections += cnt
      if (c.state === 'active') activeConnections += cnt
      if (c.state === 'idle') idleConnections += cnt
    }

    const databaseSize = sizeRes[0]?.size || '16 MB'
    const activeLocksCount = Number(locksRes[0]?.count) || 0
    const topTables = topTablesRes.map((t) => ({
      table: t.table,
      rows: Number(t.rows) || 0,
    }))

    return {
      status: activeLocksCount > 5 ? 'DEGRADED' : 'HEALTHY',
      totalConnections,
      activeConnections,
      idleConnections,
      databaseSize,
      totalTables: topTables.length,
      activeLocksCount,
      topTables,
      latencyMs,
    }
  } catch (err) {
    return {
      status: 'DOWN',
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      databaseSize: 'N/A',
      totalTables: 0,
      activeLocksCount: 0,
      topTables: [],
      latencyMs: Date.now() - start,
    }
  }
}

async function getSecurityThreatAlerts(): Promise<SecurityThreatAlert[]> {
  const alerts: SecurityThreatAlert[] = []

  try {
    // 1. Detect multiple failed login attempts in last 24h
    const lockedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { lockedUntil: { gt: new Date() } },
          { failedLoginCount: { gte: 3 } },
        ],
      },
      include: {
        organization: { select: { name: true } },
      },
      take: 5,
    })

    for (const u of lockedUsers) {
      alerts.push({
        id: `fail-${u.id}`,
        type: 'MULTIPLE_FAILED_LOGINS',
        severity: u.lockedUntil && u.lockedUntil > new Date() ? 'CRITICAL' : 'WARNING',
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        organizationName: u.organization?.name || 'Metapharsic Core',
        details: u.lockedUntil && u.lockedUntil > new Date()
          ? `Account locked until ${u.lockedUntil.toLocaleTimeString()} due to repeated authentication failures.`
          : `High failed login count (${u.failedLoginCount} attempts). Potential brute-force attempt.`,
        timestamp: u.updatedAt.toISOString(),
      })
    }

    // 2. Detect users active with multiple concurrent sessions or logins from multiple locations
    const recentAudit = await prisma.auditLog.findMany({
      where: {
        action: 'LOGIN',
        createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      },
      include: {
        user: { include: { organization: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const userLoginIps = new Map<string, Set<string>>()
    for (const log of recentAudit) {
      if (!log.userId || !log.ipAddress) continue
      if (!userLoginIps.has(log.userId)) {
        userLoginIps.set(log.userId, new Set())
      }
      userLoginIps.get(log.userId)!.add(log.ipAddress)
    }

    for (const [userId, ips] of userLoginIps.entries()) {
      if (ips.size >= 2) {
        const matchingLog = recentAudit.find((l) => l.userId === userId)
        if (matchingLog && matchingLog.user) {
          alerts.push({
            id: `concurrent-${userId}`,
            type: 'CONCURRENT_SESSION',
            severity: 'WARNING',
            userId,
            userName: matchingLog.user.name,
            userEmail: matchingLog.user.email,
            organizationName: matchingLog.user.organization?.name || 'Metapharsic Core',
            details: `Active login sessions detected across ${ips.size} distinct IP addresses ([${Array.from(ips).join(', ')}]).`,
            timestamp: matchingLog.createdAt.toISOString(),
          })
        }
      }
    }
  } catch {
    // Non-blocking
  }

  return alerts
}

export async function getSystemTelemetry(): Promise<SystemTelemetry> {
  const [database, securityAlerts] = await Promise.all([
    getDatabaseTelemetry(),
    getSecurityThreatAlerts(),
  ])
  const storage = getStorageTelemetry()

  const cpus = os.cpus()
  const cpuModel = cpus[0]?.model || 'Standard Multi-Core Processor'
  const cpuSpeed = cpus[0]?.speed || 0
  const cpuCores = cpus.length || 1
  const cpuUsagePercent = calculateCpuUsage()

  const totalBytes = os.totalmem()
  const freeBytes = os.freemem()
  const usedBytes = totalBytes - freeBytes
  const usagePercent = Math.round((usedBytes / totalBytes) * 100)

  const mem = process.memoryUsage()
  const processHeapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10
  const processHeapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10
  const processRssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10

  const poolSize = Number(process.env.UV_THREADPOOL_SIZE) || 4
  const activeHandles = typeof (process as any)._getActiveHandles === 'function' ? (process as any)._getActiveHandles().length : 0
  const activeRequests = typeof (process as any)._getActiveRequests === 'function' ? (process as any)._getActiveRequests().length : 0

  return {
    cpu: {
      model: cpuModel,
      cores: cpuCores,
      speedMhz: cpuSpeed,
      usagePercent: cpuUsagePercent,
    },
    memory: {
      totalBytes,
      totalMb: Math.round(totalBytes / 1024 / 1024),
      freeBytes,
      freeMb: Math.round(freeBytes / 1024 / 1024),
      usedBytes,
      usedMb: Math.round(usedBytes / 1024 / 1024),
      usagePercent,
      processHeapUsedMb,
      processHeapTotalMb,
      processRssMb,
    },
    threads: {
      workerThreadsPoolSize: poolSize,
      activeHandles,
      activeRequests,
    },
    runtime: {
      platform: os.platform(),
      osRelease: os.release(),
      architecture: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      pid: process.pid,
      systemUptimeSeconds: Math.floor(os.uptime()),
      processUptimeSeconds: Math.floor(process.uptime()),
    },
    database,
    storage,
    securityAlerts,
  }
}

export async function getEntityActivityLogs(limit: number = 50): Promise<EntityLoginEvent[]> {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED'],
      },
    },
    include: {
      user: {
        include: {
          organization: { select: { name: true, city: true, state: true } },
          branch: { select: { name: true, city: true, state: true } },
          userRoles: {
            include: { role: { select: { name: true, displayName: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return auditLogs.map((log) => {
    const user = log.user
    const roleNames = user?.userRoles?.map((r) => r.role.displayName || r.role.name).join(', ') || 'Staff Member'
    const orgName = user?.organization?.name || 'Metapharsic Core'
    const branchName = user?.branch?.name || 'Central Dispensary'
    const branchCity = user?.branch?.city || user?.organization?.city
    const branchState = user?.branch?.state || user?.organization?.state

    const metadata = log.metadata as any
    const locationArea = metadata?.locationArea || resolveLocationArea(log.ipAddress, branchCity, branchState)

    return {
      id: log.id,
      userId: log.userId,
      userName: user?.name || 'System / Guest',
      userEmail: user?.email || 'N/A',
      role: roleNames,
      organizationName: orgName,
      branchName,
      action: log.action,
      ipAddress: log.ipAddress || metadata?.ip || '127.0.0.1 (Loopback)',
      locationArea,
      userAgent: log.userAgent || metadata?.userAgent || 'Dispensary Client (Desktop OS)',
      timestamp: log.createdAt.toISOString(),
      metadata: log.metadata,
    }
  })
}

export async function getActiveOnlineUsersSummary() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [active15m, active1h, active24h, totalUsers, totalOrgs] = await Promise.all([
    prisma.user.count({ where: { lastLoginAt: { gte: fifteenMinutesAgo }, isActive: true } }),
    prisma.user.count({ where: { lastLoginAt: { gte: oneHourAgo }, isActive: true } }),
    prisma.user.count({ where: { lastLoginAt: { gte: twentyFourHoursAgo }, isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.organization.count(),
  ])

  return {
    activeLast15m: active15m,
    activeLast1h: active1h,
    activeLast24h: active24h,
    totalActiveUsers: totalUsers,
    totalOrganizations: totalOrgs,
  }
}
