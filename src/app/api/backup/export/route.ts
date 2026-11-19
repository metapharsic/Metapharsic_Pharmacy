import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'
import { generateDatabaseBackup } from '@/lib/backup/multi-thread-backup-service'
import { sendEmail } from '@/lib/auth/email-service'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'download'
    const targetOrgId = searchParams.get('organizationId')

    const isSuperAdmin = Boolean(session.user.isSuperAdmin)
    const organizationId = isSuperAdmin && targetOrgId ? targetOrgId : (session.user.organizationId ?? undefined)

    const backupResult = await generateDatabaseBackup({
      organizationId,
      isSuperAdmin: isSuperAdmin && !targetOrgId,
      shopName: session.user.organization?.name || undefined,
    })

    // Log the download action
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'EXPORT',
          entity: 'DatabaseBackup',
          entityId: organizationId || 'GLOBAL',
          metadata: JSON.parse(
            JSON.stringify({
              type: 'EXCEL_DOWNLOAD',
              filename: backupResult.filename,
              stats: backupResult.stats,
            })
          ),
        },
      })
    } catch (auditErr) {
      console.warn('[Backup] Audit log creation warning:', auditErr)
    }

    if (action === 'stats') {
      return NextResponse.json({
        success: true,
        filename: backupResult.filename,
        stats: backupResult.stats,
      })
    }

    // Return binary .xlsx attachment as Uint8Array
    return new NextResponse(new Uint8Array(backupResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${backupResult.filename}"`,
        'X-Backup-Threads': String(backupResult.stats.threadCount),
        'X-Backup-Duration-Ms': String(backupResult.stats.totalDurationMs),
        'X-Backup-Total-Rows': String(backupResult.stats.totalRows),
        'X-Backup-File-Size': String(backupResult.stats.fileSizeBytes),
      },
    })
  } catch (error: any) {
    console.error('[Backup API GET Error]:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate backup' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { action = 'download', email, organizationId: targetOrgId } = body

    const isSuperAdmin = Boolean(session.user.isSuperAdmin)
    const organizationId = isSuperAdmin && targetOrgId ? targetOrgId : (session.user.organizationId ?? undefined)

    const backupResult = await generateDatabaseBackup({
      organizationId,
      isSuperAdmin: isSuperAdmin && !targetOrgId,
      shopName: session.user.organization?.name || undefined,
    })

    if (action === 'email') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'Please provide a valid recipient email address' }, { status: 400 })
      }

      const emailSubject = `[Database Backup] ${backupResult.stats.organizationName} — Complete Multi-Domain Snapshot`
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px;">
            <h1 style="color: #0f172a; margin: 0; font-size: 20px;">📦 Enterprise Database Backup</h1>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Automated Excel (.xlsx) Multi-Threaded Data Snapshot</p>
          </div>
          
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            Hello <strong>${session.user.name || 'Dispensary Administrator'}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            The complete database backup file for <strong>${backupResult.stats.organizationName}</strong> has been extracted and compiled via our parallel 5-thread engine.
          </p>

          <div style="background-color: #f8fafc; border-radius: 6px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 15px;">📊 Multi-Thread Execution Telemetry:</h3>
            <ul style="color: #475569; font-size: 13px; line-height: 1.6; margin-bottom: 0; padding-left: 20px;">
              <li><strong>Parallel Threads:</strong> ${backupResult.stats.threadCount} concurrent domain pipelines</li>
              <li><strong>Total Execution Time:</strong> ${backupResult.stats.totalDurationMs} ms</li>
              <li><strong>Total Data Records:</strong> ${backupResult.stats.totalRows.toLocaleString()} rows exported</li>
              <li><strong>Multi-Sheet Count:</strong> ${backupResult.stats.sheetsCount} domains & tabs</li>
              <li><strong>Compressed File Size:</strong> ${(backupResult.stats.fileSizeBytes / 1024).toFixed(1)} KB</li>
              <li><strong>Generated File:</strong> <code>${backupResult.filename}</code></li>
            </ul>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1;">Domain Pipeline</th>
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1;">Exported Records</th>
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1;">Duration</th>
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1;">Thread Status</th>
              </tr>
            </thead>
            <tbody>
              ${backupResult.stats.workerReports
                .map(
                  (w) => `
                <tr>
                  <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${w.label}</td>
                  <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 600;">${w.rowCount}</td>
                  <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${w.durationMs}ms</td>
                  <td style="padding: 8px 12px; border: 1px solid #cbd5e1; color: #16a34a; font-weight: 600;">✔ DONE</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            Generated securely by PharmaCare Cloud Database Engine on ${new Date().toLocaleString('en-IN')}. The requested <code>.xlsx</code> workbook is attached to this email.
          </p>
        </div>
      `

      const emailResult = await sendEmail({
        to: email,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: backupResult.filename,
            content: backupResult.buffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      })

      // Log email audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'EXPORT',
            entity: 'DatabaseBackup',
            entityId: organizationId || 'GLOBAL',
            metadata: JSON.parse(
              JSON.stringify({
                type: 'EXCEL_EMAIL_DISPATCH',
                recipientEmail: email,
                filename: backupResult.filename,
                simulated: emailResult.simulated ?? false,
                stats: backupResult.stats,
              })
            ),
          },
        })
      } catch (auditErr) {
        console.warn('[Backup] Audit log email warning:', auditErr)
      }

      if (!emailResult.success) {
        return NextResponse.json(
          { error: emailResult.error || 'Failed to dispatch email' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        simulated: emailResult.simulated ?? false,
        message: emailResult.simulated
          ? `Backup file "${backupResult.filename}" (${(backupResult.stats.fileSizeBytes / 1024).toFixed(1)} KB) successfully compiled via 5 parallel threads. Dispatched in simulation mode to ${email} (check server logs).`
          : `Database backup file "${backupResult.filename}" successfully dispatched to ${email}.`,
        filename: backupResult.filename,
        stats: backupResult.stats,
      })
    }

    // Default POST action: return binary stream as Uint8Array
    return new NextResponse(new Uint8Array(backupResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${backupResult.filename}"`,
        'X-Backup-Threads': String(backupResult.stats.threadCount),
        'X-Backup-Duration-Ms': String(backupResult.stats.totalDurationMs),
        'X-Backup-Total-Rows': String(backupResult.stats.totalRows),
        'X-Backup-File-Size': String(backupResult.stats.fileSizeBytes),
      },
    })
  } catch (error: any) {
    console.error('[Backup API POST Error]:', error)
    return NextResponse.json({ error: error.message || 'Backup generation failed' }, { status: 500 })
  }
}
