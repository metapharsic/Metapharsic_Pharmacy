import { NextRequest, NextResponse } from 'next/server'
import { executeMultiThreadLogin } from '@/lib/auth/multi-thread-login-service'
import prisma from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, password, deviceFingerprint } = body

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
    const userAgent = req.headers.get('user-agent') || 'Dispensary Touch Terminal'

    const result = await executeMultiThreadLogin({
      email,
      password,
      deviceFingerprint: deviceFingerprint || 'Touch Mobile Keypad Terminal',
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
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    // Action: Return live onboarded chemist staff (excluding superadmins)
    if (action === 'staff') {
      const territory = searchParams.get('territory')
      let orgCountryFilter: any = undefined
      if (territory) {
        const t = territory.toUpperCase()
        if (t === 'SA') orgCountryFilter = { contains: 'Saudi', mode: 'insensitive' }
        else if (t === 'OM') orgCountryFilter = { contains: 'Oman', mode: 'insensitive' }
        else if (t === 'BH') orgCountryFilter = { contains: 'Bahrain', mode: 'insensitive' }
        else if (t === 'QA') orgCountryFilter = { contains: 'Qatar', mode: 'insensitive' }
        else if (t === 'MV') orgCountryFilter = { contains: 'Maldives', mode: 'insensitive' }
        else if (t === 'IN') orgCountryFilter = { contains: 'India', mode: 'insensitive' }
      }

      const whereClause: any = {
        isActive: true,
        isSuperAdmin: false,
      }
      if (orgCountryFilter) {
        whereClause.organization = { country: orgCountryFilter }
      }

      const staffUsers = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          organization: { select: { name: true, code: true, country: true, currency: true } },
          branch: { select: { name: true, code: true } },
          userRoles: {
            include: {
              role: { select: { id: true, name: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 12,
      })

      const formattedStaff = staffUsers.map((u) => {
        const primaryRole =
          u.userRoles?.[0]?.role?.displayName ||
          u.userRoles?.[0]?.role?.name ||
          'Dispensary Chemist'

        const isOwner = u.userRoles?.some(
          (r) => r.role.name === 'owner' || r.role.name === 'admin'
        )
        const isManager = u.userRoles?.some((r) => r.role.name === 'manager')

        let defaultPin = 'Admin@123'
        if (u.email.startsWith('saudi.admin')) defaultPin = 'Ksa@123456'
        else if (u.email.startsWith('saudi.cashier')) defaultPin = 'Cashier@123'
        else if (u.email.startsWith('saudi.')) defaultPin = 'Pharma@123'
        else if (u.email.startsWith('oman.admin')) defaultPin = 'Oman@123456'
        else if (u.email.startsWith('oman.')) defaultPin = 'Pharma@123'
        else if (u.email.startsWith('bahrain.admin')) defaultPin = 'Bahrain@123456'
        else if (u.email.startsWith('bahrain.')) defaultPin = 'Pharma@123'
        else if (u.email.startsWith('qatar.admin')) defaultPin = 'Qatar@123456'
        else if (u.email.startsWith('qatar.')) defaultPin = 'Pharma@123'
        else if (u.email.startsWith('maldives.admin')) defaultPin = 'Maldives@123456'
        else if (u.email.startsWith('maldives.')) defaultPin = 'Pharma@123'
        else if (u.email.startsWith('india.admin')) defaultPin = 'India@123456'
        else if (u.email.startsWith('india.')) defaultPin = 'Pharma@123'
        else if (isOwner) defaultPin = 'Admin@123'
        else if (isManager) defaultPin = 'Manager@123'
        else defaultPin = 'Staff@123'

        return {
          id: u.id,
          name: u.name || u.email.split('@')[0],
          email: u.email,
          role: primaryRole,
          shopName: u.organization?.name || u.branch?.name || 'Metapharsic Pharmacy',
          country: u.organization?.country || 'Saudi Arabia',
          currency: u.organization?.currency || 'SAR',
          defaultPin,
          avatarIcon: isOwner ? '🏪' : isManager ? '📋' : '💊',
          avatarColor: isOwner
            ? 'from-teal-600 to-teal-800'
            : isManager
            ? 'from-emerald-600 to-emerald-800'
            : 'from-cyan-600 to-blue-800',
        }
      })

      return NextResponse.json({
        success: true,
        staff: formattedStaff,
      })
    }

    // Default: Diagnostic thread topology inspection
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
