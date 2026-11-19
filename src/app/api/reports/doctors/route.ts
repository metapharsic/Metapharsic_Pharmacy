import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { ReportService } from '@/lib/reports/report-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.REPORTS_SALES)

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const orgFilter = user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'

    const data = await ReportService.getDoctorPerformanceReport(search, orgFilter)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
