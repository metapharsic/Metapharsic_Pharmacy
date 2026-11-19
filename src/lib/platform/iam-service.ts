import prisma from '@/lib/db/prisma'
import { TerritoryCode, getTerritory } from '@/lib/territory/territory-config'
import { resolveGeoZone } from './geo-zones'

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

  // Sovereign Geofencing & Cross-Border Governance
  geoFencingEnforced: boolean
  allowedTerritories: TerritoryCode[]
  allowedZones: string[]
  blockCrossBorderLogins: boolean
  
  // Shift & Operating Hours Control
  allowDispensaryAfterHours: boolean
  shiftStartHour: number // e.g. 7 for 07:00
  shiftEndHour: number   // e.g. 24 for 00:00 midnight
  enableRamadanHours: boolean
  enablePrayerTimePauses: boolean

  // Session limits & Auditing
  allowConcurrentLogins: boolean
  strictAuditLogging: boolean
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
  allowedTerritories: ['SA', 'OM', 'QA', 'BH', 'MV', 'IN'],
  allowedZones: [
    'KSA - Central Region (Riyadh)',
    'KSA - Western Region (Makkah/Jeddah)',
    'KSA - Eastern Province (Dammam)',
    'Oman - Muscat Capital Region',
    'Oman - Dhofar & Regional',
    'Qatar - Doha & Al Rayyan',
    'Bahrain - Manama & Muharraq',
    'Maldives - Greater Malé',
    'India - South Zone',
    'India - West Zone',
    'India - North Zone',
    'India - East & Central',
    'On-Premises / LAN',
  ],
  blockCrossBorderLogins: true,

  allowDispensaryAfterHours: true,
  shiftStartHour: 7,
  shiftEndHour: 24,
  enableRamadanHours: false,
  enablePrayerTimePauses: true,

  allowConcurrentLogins: true,
  strictAuditLogging: true,
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

/**
 * Sovereign Geopolitical and IAM Security Gate Evaluation
 */
export async function evaluateGeopoliticalIAMGate({
  user,
  ipAddress,
  clientTimezone,
  isSuperAdmin,
}: {
  user: {
    id: string
    email: string
    organization?: { country?: string | null; state?: string | null; city?: string | null } | null
    branch?: { state?: string | null; city?: string | null } | null
  }
  ipAddress?: string
  clientTimezone?: string
  isSuperAdmin: boolean
}): Promise<{
  allowed: boolean
  crossBorderViolation: boolean
  afterHoursViolation: boolean
  resolvedZone: string
  reason?: string
}> {
  const policy = await getPlatformIAMPolicy()

  // Root SuperAdmin bypasses geofencing & shift limits for 24/7 global incident response
  if (isSuperAdmin) {
    return {
      allowed: true,
      crossBorderViolation: false,
      afterHoursViolation: false,
      resolvedZone: 'Global HQ Command Console',
    }
  }

  const registeredCountry = (user.organization?.country || 'SA').toUpperCase() as TerritoryCode
  const registeredState = user.branch?.state || user.organization?.state || ''
  const registeredCity = user.branch?.city || user.organization?.city || ''

  // Resolve active zone from client context
  const resolvedZone = resolveGeoZone(
    registeredState,
    registeredCity,
    ipAddress,
    registeredCountry,
    clientTimezone
  )

  // 1. Cross-Border Sovereign Geofencing Gate
  let crossBorderViolation = false
  if (policy.geoFencingEnforced && policy.blockCrossBorderLogins) {
    const territoryDef = getTerritory(registeredCountry)
    if (!policy.allowedTerritories.includes(registeredCountry)) {
      crossBorderViolation = true
      return {
        allowed: false,
        crossBorderViolation: true,
        afterHoursViolation: false,
        resolvedZone,
        reason: `Dispensary login blocked: Account is bound to sovereign territory ${territoryDef.flag} ${territoryDef.nameEn}. Access from unregistered zone is restricted by IAM policy.`,
      }
    }
  }

  // 2. Dispensary Operating Hours Shift Gate
  let afterHoursViolation = false
  if (!policy.allowDispensaryAfterHours) {
    const tz = getTerritory(registeredCountry).timezone
    try {
      const localTimeString = new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
        hour12: false,
        hour: '2-digit',
      })
      const currentHour = parseInt(localTimeString, 10)
      if (currentHour < policy.shiftStartHour || currentHour >= policy.shiftEndHour) {
        afterHoursViolation = true
        return {
          allowed: false,
          crossBorderViolation: false,
          afterHoursViolation: true,
          resolvedZone,
          reason: `Dispensary terminal locked: Operating hours in ${registeredCountry} are ${policy.shiftStartHour}:00 to ${policy.shiftEndHour}:00. Counter logins outside shift hours require Manager override.`,
        }
      }
    } catch {
      // ignore timezone calculation failure
    }
  }

  return {
    allowed: true,
    crossBorderViolation,
    afterHoursViolation,
    resolvedZone,
  }
}
