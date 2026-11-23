import { NextRequest, NextResponse } from 'next/server'
import { executeMultiThreadLogin } from '@/lib/auth/multi-thread-login-service'
import prisma from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, password, mfaCode, deviceFingerprint } = body

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
          threads: [],
        },
        { status: 400 }
      )
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || 'Dispensary Terminal'

    const result = await executeMultiThreadLogin({
      email,
      password,
      mfaCode,
      deviceFingerprint: deviceFingerprint || 'Standard-Dispensary-Browser',
      userAgent,
      ipAddress,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 401 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('[Multi-Thread Login API Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Multi-thread execution error',
        threads: [],
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    // Default: Diagnostic thread topology inspection (No sensitive staff or credential exposure)
    const [userCount, prodCount, batchCount, auditCount] = await Promise.all([
      prisma.user.count({ where: { isSuperAdmin: false } }),
      prisma.product.count(),
      prisma.batch.count(),
      prisma.auditLog.count(),
    ])

    return NextResponse.json({
      status: 'ONLINE',
      engine: 'Metapharsic Multi-Thread Pipeline v2.4',
      scope: 'Chemist Retail Counter Operating System',
      configuredThreads: [
        {
          id: 1,
          code: 'THREAD_AUTH',
          name: 'Worker Thread #1: Cryptographic Authentication',
          target: 'BCrypt & Salt Verification Engine',
          state: 'STANDBY_READY',
        },
        {
          id: 2,
          code: 'THREAD_RBAC',
          name: 'Worker Thread #2: Regulatory RBAC & Form 20/21 Matrix',
          target: 'Schedule H1 Narcotic Governance & Roles',
          state: 'STANDBY_READY',
        },
        {
          id: 3,
          code: 'THREAD_BACKUP',
          name: 'Worker Thread #3: Automated Database Backup Sync',
          target: 'Multi-Domain Excel & DB Snapshot',
          state: 'BACKUP_ENABLED_ON_LOGIN',
        },
        {
          id: 4,
          code: 'THREAD_AUDIT',
          name: 'Worker Thread #4: Session Audit & Device Security Registry',
          target: 'FDA/CDSCO Audit Trail & Touch Telemetry',
          state: 'STANDBY_READY',
        },
        {
          id: 5,
          code: 'THREAD_CACHE',
          name: 'Worker Thread #5: POS Formulation & Stock Cache Preload',
          target: 'Fast-Dispensing In-Memory Cache',
          state: 'STANDBY_READY',
        },
      ],
      systemMetrics: {
        activeChemistStaff: userCount,
        activeFormulations: prodCount,
        batchesTracked: batchCount,
        totalAuditLogs: auditCount,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to inspect thread topology' },
      { status: 500 }
    )
  }
}
