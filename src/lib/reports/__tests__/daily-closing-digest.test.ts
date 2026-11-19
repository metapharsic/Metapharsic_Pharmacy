import { normalizePhoneNumber, generateWaMeLink } from '@/lib/whatsapp/whatsapp-service'

describe('WhatsApp Formatting and Phone Normalization', () => {
  it('normalizes 10-digit Indian phone numbers to E.164 and clean digits', () => {
    const { e164, cleanDigits } = normalizePhoneNumber('9876543210')
    expect(e164).toBe('+919876543210')
    expect(cleanDigits).toBe('919876543210')
  })

  it('preserves existing country code and trims whitespace/symbols', () => {
    const { e164, cleanDigits } = normalizePhoneNumber('+91 98765-43210')
    expect(e164).toBe('+919876543210')
    expect(cleanDigits).toBe('919876543210')
  })

  it('generates a valid wa.me link with encoded text', () => {
    const link = generateWaMeLink('9876543210', 'Test EOD Digest 11:30 PM')
    expect(link).toContain('https://wa.me/919876543210?text=')
    expect(link).toContain('Test%20EOD%20Digest')
  })
})
