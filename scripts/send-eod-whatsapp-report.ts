/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises */
/**
 * PharmaCare — Automated End-of-Day (11:30 PM) WhatsApp Report Sender
 *
 * Usage:
 *  1. One-time immediate trigger:
 *     npx tsx scripts/send-eod-whatsapp-report.ts --now
 *
 *  2. Running as continuous 11:30 PM scheduler:
 *     npx tsx scripts/send-eod-whatsapp-report.ts --watch
 */

import { DailyClosingDigestService } from '../src/lib/reports/daily-closing-digest-service'

async function triggerReport(phone?: string) {
  console.log(`[EOD-SCHEDULER] Initiating 11:30 PM Closing Digest generation...`)
  try {
    const { digest, sendResult } = await DailyClosingDigestService.sendClosingDigest(
      undefined,
      phone
    )
    console.log(`[EOD-SCHEDULER] ✅ Report successfully generated for ${digest.reportDate}`)
    console.log(`[EOD-SCHEDULER] Status: ${sendResult.status} via ${sendResult.providerUsed}`)
    console.log(`[EOD-SCHEDULER] Recipient: ${sendResult.toPhone}`)
    console.log(`[EOD-SCHEDULER] One-Click Web WhatsApp: ${sendResult.waMeLink}\n`)
    console.log(`--- PREVIEW OF WHATSAPP MESSAGE ---`)
    console.log(digest.formattedWhatsAppText)
    console.log(`-----------------------------------`)
  } catch (err: any) {
    console.error(`[EOD-SCHEDULER] ❌ Error generating EOD report:`, err)
  }
}

/**
 * Calculates milliseconds until next 23:30 (11:30 PM) IST
 */
function msUntilNext1130PM(): number {
  const now = new Date()
  // Format current time in Asia/Kolkata
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
    // Already past 23:30 today in IST, schedule for tomorrow's 23:30
    minutesRemaining += 24 * 60
  }

  const msRemaining = minutesRemaining * 60 * 1000 - curSecond * 1000
  return Math.max(1000, msRemaining)
}

async function main() {
  const isWatchMode = process.argv.includes('--watch')
  const phoneArg = process.argv.find((a) => a.startsWith('--phone='))?.split('=')[1]

  if (!isWatchMode) {
    await triggerReport(phoneArg)
    process.exit(0)
  }

  console.log(`[EOD-SCHEDULER] 🟢 PharmaCare 11:30 PM WhatsApp Daemon Started.`)
  const scheduleNext = () => {
    const delay = msUntilNext1130PM()
    const hours = (delay / (1000 * 3600)).toFixed(2)
    console.log(`[EOD-SCHEDULER] ⏳ Next report scheduled in ${hours} hours (at 23:30 IST)...`)

    setTimeout(() => {
      void triggerReport(phoneArg).then(() => {
        scheduleNext()
      })
    }, delay)
  }

  scheduleNext()
}

void main()
