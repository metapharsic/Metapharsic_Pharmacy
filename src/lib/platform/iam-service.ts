import prisma from '@/lib/db/prisma'

export interface PlatformIAMPolicy {
  // Password security
  minPasswordLength: number
  requireUppercase: boolean
  requireSpecialChar: boolean
  requireNumber: boolean
  passwordExpiryDays: number

  // Login & Lockout protection
  maxFailedAttempts: number
  lockoutDurationMinutes: number
  sessionInactivityTimeoutMinutes: number

  // Two-Factor & Privileged Access
  enforceMfaForSuperAdmin: boolean
  enforceMfaForStoreOwners: boolean
  ipWhitelistEnabled: boolean
  allowedIpRanges: string[]

  // Geo-fencing & Shift Control
  geoFencingEnforced: boolean
  allowedZones: string[]
  allowDispensaryAfterHours: boolean // If false, normal staff cannot log in outside 06:00 - 23:00

  // Session limits
  allowConcurrentLogins: boolean // If false, logging in on terminal B terminates terminal A
}

export const DEFAULT_IAM_POLICY: PlatformIAMPolicy = {
  minPasswordLength: 8,
  requireUppercase: true,
  requireSpecialChar: true,
  requireNumber: true,
  passwordExpiryDays: 90,

  maxFailedAttempts: 5,
  lockoutDurationMinutes: 15,
  sessionInactivityTimeoutMinutes: 60,

  enforceMfaForSuperAdmin: true,
  enforceMfaForStoreOwners: false,
  ipWhitelistEnabled: false,
  allowedIpRanges: ['127.0.0.1', '::1', '192.168.0.0/16', '10.0.0.0/8'],

  geoFencingEnforced: false,
  allowedZones: ['South Zone', 'North Zone', 'West Zone', 'East Zone', 'Central Zone', 'On-Premises / LAN'],
  allowDispensaryAfterHours: true,

  allowConcurrentLogins: true,
}

const IAM_CATEGORY = 'SECURITY'
const IAM_SETTING_KEY = 'PLATFORM_IAM_RULES_POLICY'

export async function getPlatformIAMPolicy(): Promise<PlatformIAMPolicy> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: {
        category_key: {
          category: IAM_CATEGORY,
          key: IAM_SETTING_KEY,
        },
      },
    })

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value)
      return { ...DEFAULT_IAM_POLICY, ...parsed }
    }
  } catch {
    // Fallback to default
  }

  return DEFAULT_IAM_POLICY
}

export async function updatePlatformIAMPolicy(newPolicy: Partial<PlatformIAMPolicy>): Promise<PlatformIAMPolicy> {
  const current = await getPlatformIAMPolicy()
  const updated: PlatformIAMPolicy = { ...current, ...newPolicy }

  await prisma.systemSetting.upsert({
    where: {
      category_key: {
        category: IAM_CATEGORY,
        key: IAM_SETTING_KEY,
      },
    },
    create: {
      category: IAM_CATEGORY,
      key: IAM_SETTING_KEY,
      value: JSON.stringify(updated),
      dataType: 'json',
      label: 'Platform SuperAdmin IAM Security and Governance Rules Policy',
    },
    update: {
      value: JSON.stringify(updated),
    },
  })

  return updated
}

/**
 * Validates a plaintext password against the active IAM password rules
 */
export async function validatePasswordIAMRules(password: string): Promise<{ valid: boolean; errors: string[] }> {
  const policy = await getPlatformIAMPolicy()
  const errors: string[] = []

  if (password.length < policy.minPasswordLength) {
    errors.push(`Password must be at least ${policy.minPasswordLength} characters long.`)
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).')
  }

  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numeric digit (0-9).')
  }

  if (policy.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.).')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
