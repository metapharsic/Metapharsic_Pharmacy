/**
 * RFC 6238 Standard Time-based One-Time Password (TOTP) Service
 * 
 * Cryptographically sound, zero external dependencies (Node.js crypto built-in).
 * Fully compatible with Google Authenticator, Microsoft Authenticator, Authy, and 1Password.
 */

import crypto from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Decode a Base32 string into a Buffer
 */
export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '')
  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanInput[i])
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(output)
}

/**
 * Encode a Buffer into a Base32 string
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Generate a cryptographically secure Base32 secret for TOTP setup
 */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes))
}

/**
 * Generate a 6-digit TOTP code for a given secret and timestamp
 */
export function generateTotp(
  secret: string,
  timeStepSeconds = 30,
  time = Date.now(),
  digits = 6
): string {
  const key = base32Decode(secret)
  const counter = Math.floor(time / 1000 / timeStepSeconds)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const mod = 10 ** digits
  return (codeInt % mod).toString().padStart(digits, '0')
}

/**
 * Verify a 6-digit TOTP code against a secret with +/- window steps for clock drift
 */
export function verifyTotp(
  token: string,
  secret: string,
  windowSteps = 1,
  timeStepSeconds = 30
): boolean {
  if (!token || !secret) return false
  const cleanToken = token.trim().replace(/\s+/g, '')
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false

  const now = Date.now()
  const stepMs = timeStepSeconds * 1000

  for (let errorWindow = -windowSteps; errorWindow <= windowSteps; errorWindow++) {
    const expected = generateTotp(secret, timeStepSeconds, now + errorWindow * stepMs)
    if (expected === cleanToken) {
      return true
    }
  }

  return false
}

/**
 * Generate an otpauth:// URI for QR code generation in authenticator apps
 */
export function getTotpUri(email: string, secret: string, issuer = 'PharmaCare'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedLabel = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}
