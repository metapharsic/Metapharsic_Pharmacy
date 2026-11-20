/* eslint-disable no-console */
/**
 * WhatsApp Messaging Service for PharmaCare
 *
 * Supports multiple delivery channels:
 * 1. Meta WhatsApp Business Cloud API (Direct Graph API per tenant)
 * 2. Twilio Programmable Messaging (WhatsApp)
 * 3. UltraMsg / Generic HTTP Webhook Gateway
 * 4. Browser/Desktop One-Click Link (wa.me / Web WhatsApp)
 * 5. Simulation & Audit Log (Dev / Offline fallback with tenant isolation)
 */

import { prisma } from '@/lib/db/prisma'

export interface WhatsAppSendOptions {
  toPhone: string
  message: string
  provider?: 'auto' | 'meta' | 'twilio' | 'ultramsg' | 'simulation' | 'simulation-and-wa-link'
  organizationId?: string
  senderName?: string
  apiToken?: string
  phoneNumberId?: string
}

export interface WhatsAppSendResult {
  success: boolean
  providerUsed: string
  toPhone: string
  messageId?: string
  status: 'DELIVERED' | 'SENT' | 'SIMULATED' | 'FAILED'
  waMeLink: string
  errorMessage?: string
  timestamp: string
  organizationId?: string
  senderName?: string
}

/**
 * Format phone number to international E.164 without '+' or symbols for wa.me link,
 * and with '+' for Twilio/Meta API.
 */
export function normalizePhoneNumber(rawPhone: string): { e164: string; cleanDigits: string } {
  // Remove non-digit characters except leading plus
  const digits = rawPhone.replace(/\D/g, '')

  // Default to India (+91) if 10 digits provided
  if (digits.length === 10) {
    return {
      e164: `+91${digits}`,
      cleanDigits: `91${digits}`,
    }
  }

  return {
    e164: `+${digits}`,
    cleanDigits: digits,
  }
}

/**
 * Generate a direct WhatsApp Web / App one-click send link
 */
export function generateWaMeLink(phone: string, text: string): string {
  const { cleanDigits } = normalizePhoneNumber(phone)
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`
}

export class WhatsAppService {
  /**
   * Send WhatsApp Message using tenant-isolated settings or configured provider
   */
  static async sendMessage(options: WhatsAppSendOptions): Promise<WhatsAppSendResult> {
    const { toPhone, message } = options
    const { e164, cleanDigits } = normalizePhoneNumber(toPhone)
    const waMeLink = generateWaMeLink(toPhone, message)
    const timestamp = new Date().toISOString()

    let chosenProvider = options.provider || process.env.WHATSAPP_PROVIDER || 'auto'
    let apiToken = options.apiToken || process.env.WHATSAPP_API_TOKEN
    let phoneNumberId = options.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
    let senderName = options.senderName

    // Load tenant-isolated configuration if organizationId is present
    if (options.organizationId) {
      try {
        const orgSettings = await prisma.organizationSetting.findMany({
          where: {
            organizationId: options.organizationId,
            key: {
              in: [
                'WHATSAPP_PROVIDER',
                'WHATSAPP_API_TOKEN',
                'WHATSAPP_PHONE_NUMBER_ID',
                'WHATSAPP_SENDER_NAME',
                'WHATSAPP_STORE_PHONE',
                'pharmacy_name',
              ],
            },
          },
        })

        const settingsMap = new Map(orgSettings.map((s) => [s.key, s.value]))

        if (!options.provider && settingsMap.get('WHATSAPP_PROVIDER')) {
          chosenProvider = settingsMap.get('WHATSAPP_PROVIDER') as typeof chosenProvider
        }

        const tenantToken = settingsMap.get('WHATSAPP_API_TOKEN')
        if (tenantToken && !tenantToken.startsWith('wa_tok_') && !options.apiToken) {
          apiToken = tenantToken
        }

        const tenantPhoneId = settingsMap.get('WHATSAPP_PHONE_NUMBER_ID')
        if (tenantPhoneId && !tenantPhoneId.startsWith('wa_id_') && !options.phoneNumberId) {
          phoneNumberId = tenantPhoneId
        }

        if (!senderName) {
          senderName =
            settingsMap.get('WHATSAPP_SENDER_NAME') ||
            settingsMap.get('pharmacy_name') ||
            undefined
        }
      } catch (err) {
        console.warn('[WhatsAppService] Could not load tenant settings:', err)
      }
    }

    // 1. Meta WhatsApp Business Cloud API
    if (
      (chosenProvider === 'meta' || chosenProvider === 'auto') &&
      apiToken &&
      phoneNumberId &&
      !apiToken.startsWith('wa_tok_')
    ) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanDigits,
              type: 'text',
              text: { body: message },
            }),
          }
        )

        const json = await response.json()
        if (response.ok && json.messages?.[0]?.id) {
          return {
            success: true,
            providerUsed: 'meta-cloud-api',
            toPhone: e164,
            messageId: json.messages[0].id,
            status: 'SENT',
            waMeLink,
            timestamp,
            organizationId: options.organizationId,
            senderName,
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[WhatsAppService] Meta API error, checking fallback...', msg)
      }
    }

    // 2. Twilio WhatsApp API
    if (
      (chosenProvider === 'twilio' || chosenProvider === 'auto') &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
    ) {
      try {
        const auth = Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')

        const params = new URLSearchParams()
        params.append('From', `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`)
        params.append('To', `whatsapp:${e164}`)
        params.append('Body', message)

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        )

        const json = await response.json()
        if (response.ok && json.sid) {
          return {
            success: true,
            providerUsed: 'twilio',
            toPhone: e164,
            messageId: json.sid,
            status: 'SENT',
            waMeLink,
            timestamp,
            organizationId: options.organizationId,
            senderName,
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[WhatsAppService] Twilio error, checking fallback...', msg)
      }
    }

    // 3. UltraMsg API
    if (
      (chosenProvider === 'ultramsg' || chosenProvider === 'auto') &&
      process.env.ULTRAMSG_INSTANCE_ID &&
      process.env.ULTRAMSG_TOKEN
    ) {
      try {
        const response = await fetch(
          `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: process.env.ULTRAMSG_TOKEN,
              to: cleanDigits,
              body: message,
            }),
          }
        )
        const json = (await response.json()) as { sent?: string; id?: string | number }
        if (json.sent === 'true' || json.id) {
          return {
            success: true,
            providerUsed: 'ultramsg',
            toPhone: e164,
            messageId: String(json.id),
            status: 'SENT',
            waMeLink,
            timestamp,
            organizationId: options.organizationId,
            senderName,
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[WhatsAppService] UltraMsg error, checking fallback...', msg)
      }
    }

    // 4. Default / Simulation Mode (Isolated per Tenant with wa.me link generation)
    console.log(`\n======================================================================`)
    console.log(`[WHATSAPP DISPATCH] Tenant: ${senderName || 'PharmaCare Sovereign'} (Org: ${options.organizationId || 'System'})`)
    console.log(`Recipient: ${e164}`)
    console.log(`Timestamp: ${timestamp}`)
    console.log(`One-Click Open Link: ${waMeLink}`)
    console.log(`----------------------------------------------------------------------`)
    console.log(message)
    console.log(`======================================================================\n`)

    return {
      success: true,
      providerUsed: 'simulation-and-wa-link',
      toPhone: e164,
      messageId: `sim_${Date.now()}`,
      status: 'SIMULATED',
      waMeLink,
      timestamp,
      organizationId: options.organizationId,
      senderName,
    }
  }
}
