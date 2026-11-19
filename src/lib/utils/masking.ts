/**
 * Enterprise Data Security & Masking Utility
 *
 * Implements standard cryptographic & statutory data masking for sensitive fields:
 * - Phone numbers (e.g., +91 98****3210)
 * - PAN cards (e.g., ****1744D)
 * - GSTIN numbers (e.g., 36****1744D1Z1)
 * - Bank Account numbers (e.g., ********9012)
 * - Email addresses (e.g., r****h@krishnamed.com)
 * - Aadhaar numbers (e.g., ****-****-1234)
 */

export function maskPhone(phone?: string | null): string {
  if (!phone) return '—'
  const clean = phone.trim()
  if (clean.length < 6) return '****'
  const first2 = clean.slice(0, 2)
  const last4 = clean.slice(-4)
  return `${first2}****${last4}`
}

export function maskEmail(email?: string | null): string {
  if (!email) return '—'
  const clean = email.trim()
  const parts = clean.split('@')
  if (parts.length !== 2) return clean
  const [local, domain] = parts
  if (local.length <= 2) return `${local.slice(0, 1)}*@${domain}`
  const first = local.slice(0, 1)
  const last = local.slice(-1)
  return `${first}****${last}@${domain}`
}

export function maskPan(pan?: string | null): string {
  if (!pan) return '—'
  const clean = pan.trim().toUpperCase()
  if (clean.length < 5) return '****'
  return `****${clean.slice(-5)}`
}

export function maskGstin(gstin?: string | null): string {
  if (!gstin) return '—'
  const clean = gstin.trim().toUpperCase()
  if (clean.length < 6) return '****'
  const stateCode = clean.slice(0, 2)
  const last3 = clean.slice(-3)
  return `${stateCode}******${last3}`
}

export function maskBankAccount(account?: string | null): string {
  if (!account) return '—'
  const clean = account.trim()
  if (clean.length < 4) return '****'
  return `********${clean.slice(-4)}`
}

export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '—'
  const clean = aadhaar.trim().replace(/\D/g, '')
  if (clean.length < 4) return '****'
  return `****-****-${clean.slice(-4)}`
}

/**
 * Strips passwordHash, password, and sensitive internal fields from user/tenant records
 */
export function sanitizeUserRecord<T extends Record<string, any>>(user: T): Omit<T, 'password' | 'passwordHash'> {
  const { password, passwordHash, ...safe } = user
  return safe as Omit<T, 'password' | 'passwordHash'>
}

