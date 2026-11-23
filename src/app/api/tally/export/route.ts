import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/auth-helpers'
import { generateTallyExport, getBatchWiseStockSummary } from '@/lib/tally/tally-service'
import type { TallyExportFormat, TallyExportType } from '@/lib/tally/tally-types'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const type = (searchParams.get('type') ?? 'sales') as TallyExportType
    const format = (searchParams.get('format') ?? 'csv') as TallyExportFormat
    const startDate = searchParams.get('startDate') ?? undefined
    const endDate = searchParams.get('endDate') ?? undefined
    const branchId = searchParams.get('branchId') ?? undefined
    const territory = searchParams.get('territory') ?? undefined
    const isPreview = searchParams.get('preview') === 'true'

    const exportResult = await generateTallyExport(
      {
        type,
        format,
        startDate,
        endDate,
        branchId,
        territory,
        preview: isPreview,
      },
      session.user
    )

    if (isPreview) {
      const batchSummaryItems =
        type === 'batch_summary'
          ? await getBatchWiseStockSummary(branchId, session.user)
          : undefined

      return NextResponse.json({
        success: true,
        summary: exportResult.summary,
        filename: exportResult.filename,
        xmlPreview: exportResult.content.slice(0, 4000),
        fullXmlLength: exportResult.content.length,
        contentType: exportResult.contentType,
        gstr1Summary: exportResult.gstr1Summary,
        sovereignTax: exportResult.sovereignTax,
        batchSummaryItems,
      })
    }

    // Stream download
    return new NextResponse(exportResult.content, {
      status: 200,
      headers: {
        'Content-Type': exportResult.contentType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate Tally export'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
