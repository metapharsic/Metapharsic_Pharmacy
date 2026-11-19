import prisma from '@/lib/db/prisma'

export type GeoZoneName =
  | 'South Zone'
  | 'North Zone'
  | 'West Zone'
  | 'East Zone'
  | 'Central Zone'
  | 'On-Premises / LAN'

export interface GeoPoliticalZoneData {
  zone: GeoZoneName
  displayName: string
  color: string
  states: string[]
  activeSessions: number
  totalLogins: number
  percentage: number
  organizationsCount: number
  branches: {
    id: string
    name: string
    shopName: string
    city: string
    state: string
    activeStaffCount: number
    lastLoginAt: string | null
  }[]
}

const ZONE_MAPPINGS: Record<string, GeoZoneName> = {
  // South Zone
  telangana: 'South Zone',
  'andhra pradesh': 'South Zone',
  karnataka: 'South Zone',
  'tamil nadu': 'South Zone',
  kerala: 'South Zone',
  puducherry: 'South Zone',
  hyderabad: 'South Zone',
  bengaluru: 'South Zone',
  bangalore: 'South Zone',
  chennai: 'South Zone',

  // West Zone
  maharashtra: 'West Zone',
  gujarat: 'West Zone',
  goa: 'West Zone',
  mumbai: 'West Zone',
  pune: 'West Zone',
  ahmedabad: 'West Zone',

  // North Zone
  delhi: 'North Zone',
  'new delhi': 'North Zone',
  haryana: 'North Zone',
  punjab: 'North Zone',
  rajasthan: 'North Zone',
  'uttar pradesh': 'North Zone',
  uttarakhand: 'North Zone',
  'himachal pradesh': 'North Zone',
  'jammu and kashmir': 'North Zone',
  jaipur: 'North Zone',
  lucknow: 'North Zone',

  // East Zone
  'west bengal': 'East Zone',
  bihar: 'East Zone',
  jharkhand: 'East Zone',
  odisha: 'East Zone',
  assam: 'East Zone',
  kolkata: 'East Zone',
  patna: 'East Zone',

  // Central Zone
  'madhya pradesh': 'Central Zone',
  chhattisgarh: 'Central Zone',
  bhopal: 'Central Zone',
  indore: 'Central Zone',
}

export function resolveGeoZone(state?: string | null, city?: string | null, ipAddress?: string | null): GeoZoneName {
  if (state) {
    const cleanState = state.trim().toLowerCase()
    if (ZONE_MAPPINGS[cleanState]) return ZONE_MAPPINGS[cleanState]
  }

  if (city) {
    const cleanCity = city.trim().toLowerCase()
    if (ZONE_MAPPINGS[cleanCity]) return ZONE_MAPPINGS[cleanCity]
  }

  // Check if IP is local/internal network
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return 'On-Premises / LAN'
  }

  return 'South Zone' // Default platform origin
}

export async function getGeoPoliticalZoneMetrics() {
  const [branches, loginAuditLogs, activeUsers, orgSettings] = await Promise.all([
    prisma.branch.findMany({
      include: {
        organization: { select: { id: true, name: true, city: true, state: true } },
        users: {
          select: { id: true, name: true, email: true, lastLoginAt: true, isActive: true },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: 'LOGIN' },
      include: {
        user: {
          include: {
            organization: { select: { id: true, name: true, city: true, state: true } },
            branch: { select: { name: true, city: true, state: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.user.findMany({
      where: {
        lastLoginAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // 30 min active window
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastLoginAt: true,
        organizationId: true,
        branchId: true,
      },
    }),
    prisma.organizationSetting.findMany({
      where: { key: 'GEO_ZONE' },
      select: { organizationId: true, value: true },
    }),
  ])

  // Map organization ID -> explicitly assigned GEO_ZONE
  const orgZoneMap = new Map<string, GeoZoneName>()
  for (const s of orgSettings) {
    if (s.value) {
      orgZoneMap.set(s.organizationId, s.value as GeoZoneName)
    }
  }

  const zoneConfigs: Record<
    GeoZoneName,
    {
      displayName: string
      color: string
      states: string[]
      branches: any[]
      totalLogins: number
      activeSessions: number
      orgIds: Set<string>
    }
  > = {
    'South Zone': {
      displayName: 'South Zone (Telangana, Karnataka, AP, Tamil Nadu, Kerala)',
      color: 'teal',
      states: ['Telangana', 'Karnataka', 'Andhra Pradesh', 'Tamil Nadu', 'Kerala'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'West Zone': {
      displayName: 'West Zone (Maharashtra, Gujarat, Goa)',
      color: 'indigo',
      states: ['Maharashtra', 'Gujarat', 'Goa'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'North Zone': {
      displayName: 'North Zone (Delhi NCR, Haryana, Punjab, UP, Rajasthan)',
      color: 'amber',
      states: ['Delhi', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'East Zone': {
      displayName: 'East Zone (West Bengal, Bihar, Odisha, Assam)',
      color: 'emerald',
      states: ['West Bengal', 'Bihar', 'Odisha', 'Assam'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Central Zone': {
      displayName: 'Central Zone (Madhya Pradesh, Chhattisgarh)',
      color: 'cyan',
      states: ['Madhya Pradesh', 'Chhattisgarh'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'On-Premises / LAN': {
      displayName: 'On-Premises / Dispensary LAN (Internal Dispensary Terminals)',
      color: 'slate',
      states: ['Local Network', 'Dispensary Terminals'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
  }

  // 1. Group branches into zones
  for (const b of branches) {
    const explicitZone = b.organization?.id ? orgZoneMap.get(b.organization.id) : undefined
    const state = b.state || b.organization?.state || 'Telangana'
    const city = b.city || b.organization?.city || 'Hyderabad'
    const zoneName = (explicitZone && zoneConfigs[explicitZone]) ? explicitZone : resolveGeoZone(state, city)

    const activeStaffInBranch = b.users.filter((u) => activeUsers.some((au) => au.id === u.id)).length
    const mostRecentLogin = b.users.reduce<Date | null>((acc, cur) => {
      if (!cur.lastLoginAt) return acc
      if (!acc) return cur.lastLoginAt
      return cur.lastLoginAt > acc ? cur.lastLoginAt : acc
    }, null)

    zoneConfigs[zoneName].branches.push({
      id: b.id,
      name: b.name,
      shopName: b.organization?.name || 'Metapharsic Core',
      city,
      state,
      activeStaffCount: activeStaffInBranch,
      lastLoginAt: mostRecentLogin ? mostRecentLogin.toISOString() : null,
    })

    zoneConfigs[zoneName].activeSessions += activeStaffInBranch
    if (b.organization?.id) {
      zoneConfigs[zoneName].orgIds.add(b.organization.id)
    }
  }

  // 2. Count logins from audit trail
  for (const log of loginAuditLogs) {
    const user = log.user
    const explicitZone = user?.organization?.id ? orgZoneMap.get(user.organization.id) : undefined
    const state = user?.branch?.state || user?.organization?.state
    const city = user?.branch?.city || user?.organization?.city
    const zoneName = (explicitZone && zoneConfigs[explicitZone]) ? explicitZone : resolveGeoZone(state, city, log.ipAddress)
    zoneConfigs[zoneName].totalLogins += 1
  }

  const grandTotalLogins = loginAuditLogs.length || 1

  const results: GeoPoliticalZoneData[] = (Object.keys(zoneConfigs) as GeoZoneName[]).map((key) => {
    const z = zoneConfigs[key]
    const pct = Math.round((z.totalLogins / grandTotalLogins) * 100)
    return {
      zone: key,
      displayName: z.displayName,
      color: z.color,
      states: z.states,
      activeSessions: z.activeSessions,
      totalLogins: z.totalLogins,
      percentage: pct,
      organizationsCount: z.orgIds.size,
      branches: z.branches,
    }
  })

  return {
    zones: results,
    totalLoginsRecorded: loginAuditLogs.length,
    activeSessionsTotal: activeUsers.length,
  }
}
