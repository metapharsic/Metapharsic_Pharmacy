/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises */
/**
 * PharmaCare — Multi-Tenant Automated End-of-Day (11:30 PM) WhatsApp Report Sender
 *
 * Usage:
 *  1. Immediate trigger for all sovereign organizations:
 *     npx tsx scripts/send-eod-whatsapp-report.ts --now
 *
 *  2. Immediate trigger for specific organization:
 *     npx tsx scripts/send-eod-whatsapp-report.ts --now --org=cmwnr97a0000ec005aagqq8ov
 *
 *  3. Running as continuous 11:30 PM scheduler:
 *     npx tsx scripts/send-eod-whatsapp-report.ts --watch
 */

import { prisma } from '../src/lib/db/prisma'
import { DailyClosingDigestService } from '../src/lib/reports/daily-closing-digest-service'

async function triggerSingleOrgReport(org: { id: string; name: string }, customPhone?: string) {
  console.log(`\n------------------------------------------------------------`)
  console.log(`[EOD-SCHEDULER] 🏥 Generating 11:30 PM Closing Digest for: ${org.name} (${org.id})`)
  try {
    const { digest, sendResult } = await DailyClosingDigestService.sendClosingDigest(
      undefined,
      customPhone,
      undefined,
      org.id
    )
    console.log(`[EOD-SCHEDULER] ✅ Report successfully generated for ${digest.reportDate}`)
    console.log(`[EOD-SCHEDULER] Status: ${sendResult.status} via ${sendResult.providerUsed}`)
    console.log(`[EOD-SCHEDULER] Recipient: ${sendResult.toPhone}`)
    console.log(`[EOD-SCHEDULER] One-Click Web WhatsApp: ${sendResult.waMeLink}`)
    console.log(`--- PREVIEW OF WHATSAPP MESSAGE ---`)
    console.log(digest.formattedWhatsAppText)
    console.log(`-----------------------------------`)
  } catch (err: any) {
    console.error(`[EOD-SCHEDULER] ❌ Error generating EOD report for ${org.name}:`, err)
  }
}

async function triggerAllReports(customPhone?: string, targetOrgId?: string) {
  console.log(`[EOD-SCHEDULER] Initiating 11:30 PM Multi-Tenant Closing Digest run...`)

  if (targetOrgId) {
    const org = await prisma.organization.findUnique({ where: { id: targetOrgId } })
    if (!org) {
      console.error(`[EOD-SCHEDULER] Organization ${targetOrgId} not found`)
      return
    }
    await triggerSingleOrgReport(org, customPhone)
    return
  }

  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  console.log(`[EOD-SCHEDULER] Found ${organizations.length} sovereign organizations to report.`)

  for (const org of organizations) {
    await triggerSingleOrgReport(org, customPhone)
  }
}

/**
 * Calculates milliseconds until next 23:30 (11:30 PM) IST
 */
function msUntilNext1130PM(): number {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)

  const curHour = getPart('hour')
  const curMinute = getPart('minute')
  const curSecond = getPart('second')

  const targetHour = 23
  const targetMinute = 30

  let minutesRemaining = (targetHour - curHour) * 60 + (targetMinute - curMinute)
  if (minutesRemaining <= 0) {
    minutesRemaining += 24 * 60
  }

  const msRemaining = minutesRemaining * 60 * 1000 - curSecond * 1000
  return Math.max(1000, msRemaining)
}

async function main() {
  const isWatchMode = process.argv.includes('--watch')
  const phoneArg = process.argv.find((a) => a.startsWith('--phone='))?.split('=')[1]
  const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]

  if (!isWatchMode) {
    await triggerAllReports(phoneArg, orgArg)
    process.exit(0)
  }

  console.log(`[EOD-SCHEDULER] 🟢 PharmaCare 11:30 PM Multi-Tenant WhatsApp Daemon Started.`)
  const scheduleNext = () => {
    const delay = msUntilNext1130PM()
    const hours = (delay / (1000 * 3600)).toFixed(2)
    console.log(`[EOD-SCHEDULER] ⏳ Next report batch scheduled in ${hours} hours (at 23:30 IST)...`)

    setTimeout(() => {
      void triggerAllReports(phoneArg, orgArg).then(() => {
        scheduleNext()
      })
    }, delay)
  }

  scheduleNext()
}

void main()
