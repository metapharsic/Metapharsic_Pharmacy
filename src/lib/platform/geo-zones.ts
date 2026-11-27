import prisma from '@/lib/db/prisma'
import { TerritoryCode, getTerritory, TERRITORIES } from '@/lib/territory/territory-config'

export type GeoZoneName =
  | 'KSA - Central Region (Riyadh)'
  | 'KSA - Western Region (Makkah/Jeddah)'
  | 'KSA - Eastern Province (Dammam)'
  | 'Oman - Muscat Capital Region'
  | 'Oman - Dhofar & Regional'
  | 'Qatar - Doha & Al Rayyan'
  | 'Bahrain - Manama & Muharraq'
  | 'Maldives - Greater Malé'
  | 'India - South Zone'
  | 'India - West Zone'
  | 'India - North Zone'
  | 'India - East & Central'
  | 'On-Premises / LAN'
  | 'South Zone'
  | 'North Zone'
  | 'West Zone'
  | 'East Zone'
  | 'Central Zone'

export interface GeoPoliticalZoneData {
  zone: GeoZoneName
  displayName: string
  color: string
  countryCode: TerritoryCode
  flag: string
  currency: string
  decimals: 2 | 3
  regulatoryBody: string
  taxRegime: string
  states: string[]
  activeSessions: number
  totalLogins: number
  percentage: number
  organizationsCount: number
  branches: {
    id: string
    name: string
    shopName: string
    organizationId?: string
    organizationCode?: string | null
    city: string
    state: string
    country?: string
    address?: string | null
    phone?: string | null
    email?: string | null
    dlNumber?: string | null
    gstin?: string | null
    status?: string
    zone: GeoZoneName
    activeStaffCount: number
    lastLoginAt: string | null
    adminUser?: {
      id: string
      name: string
      email: string
      phone?: string | null
    } | null
    allUsers?: {
      id: string
      name: string
      email: string
      phone?: string | null
      isActive: boolean
      role?: string
    }[]
  }[]
}

const ZONE_MAPPINGS: Record<string, GeoZoneName> = {
  // ─── Kingdom of Saudi Arabia ───
  riyadh: 'KSA - Central Region (Riyadh)',
  'al riyadh': 'KSA - Central Region (Riyadh)',
  'central region': 'KSA - Central Region (Riyadh)',
  saudi: 'KSA - Central Region (Riyadh)',
  'saudi arabia': 'KSA - Central Region (Riyadh)',
  ksa: 'KSA - Central Region (Riyadh)',
  jeddah: 'KSA - Western Region (Makkah/Jeddah)',
  makkah: 'KSA - Western Region (Makkah/Jeddah)',
  mecca: 'KSA - Western Region (Makkah/Jeddah)',
  medina: 'KSA - Western Region (Makkah/Jeddah)',
  madinah: 'KSA - Western Region (Makkah/Jeddah)',
  taif: 'KSA - Western Region (Makkah/Jeddah)',
  dammam: 'KSA - Eastern Province (Dammam)',
  khobar: 'KSA - Eastern Province (Dammam)',
  dhahran: 'KSA - Eastern Province (Dammam)',
  jubail: 'KSA - Eastern Province (Dammam)',
  'al ahsa': 'KSA - Eastern Province (Dammam)',

  // ─── Sultanate of Oman ───
  muscat: 'Oman - Muscat Capital Region',
  matrah: 'Oman - Muscat Capital Region',
  seeb: 'Oman - Muscat Capital Region',
  bawshar: 'Oman - Muscat Capital Region',
  oman: 'Oman - Muscat Capital Region',
  'sultanate of oman': 'Oman - Muscat Capital Region',
  salalah: 'Oman - Dhofar & Regional',
  dhofar: 'Oman - Dhofar & Regional',
  sohar: 'Oman - Dhofar & Regional',
  batinah: 'Oman - Dhofar & Regional',
  nizwa: 'Oman - Dhofar & Regional',

  // ─── State of Qatar ───
  doha: 'Qatar - Doha & Al Rayyan',
  'al rayyan': 'Qatar - Doha & Al Rayyan',
  'al wakrah': 'Qatar - Doha & Al Rayyan',
  qatar: 'Qatar - Doha & Al Rayyan',

  // ─── Kingdom of Bahrain ───
  manama: 'Bahrain - Manama & Muharraq',
  muharraq: 'Bahrain - Manama & Muharraq',
  riffa: 'Bahrain - Manama & Muharraq',
  bahrain: 'Bahrain - Manama & Muharraq',

  // ─── Republic of Maldives ───
  male: 'Maldives - Greater Malé',
  'malé': 'Maldives - Greater Malé',
  hulhumale: 'Maldives - Greater Malé',
  'hulhumalé': 'Maldives - Greater Malé',
  vilimale: 'Maldives - Greater Malé',
  addu: 'Maldives - Greater Malé',
  maldives: 'Maldives - Greater Malé',

  // ─── Republic of India ───
  telangana: 'India - South Zone',
  'andhra pradesh': 'India - South Zone',
  karnataka: 'India - South Zone',
  'tamil nadu': 'India - South Zone',
  kerala: 'India - South Zone',
  puducherry: 'India - South Zone',
  hyderabad: 'India - South Zone',
  bengaluru: 'India - South Zone',
  bangalore: 'India - South Zone',
  chennai: 'India - South Zone',

  maharashtra: 'India - West Zone',
  gujarat: 'India - West Zone',
  goa: 'India - West Zone',
  mumbai: 'India - West Zone',
  pune: 'India - West Zone',
  ahmedabad: 'India - West Zone',

  delhi: 'India - North Zone',
  'new delhi': 'India - North Zone',
  haryana: 'India - North Zone',
  punjab: 'India - North Zone',
  rajasthan: 'India - North Zone',
  'uttar pradesh': 'India - North Zone',
  uttarakhand: 'India - North Zone',
  'himachal pradesh': 'India - North Zone',
  jaipur: 'India - North Zone',
  lucknow: 'India - North Zone',

  'west bengal': 'India - East & Central',
  bihar: 'India - East & Central',
  jharkhand: 'India - East & Central',
  odisha: 'India - East & Central',
  assam: 'India - East & Central',
  'madhya pradesh': 'India - East & Central',
  chhattisgarh: 'India - East & Central',
  kolkata: 'India - East & Central',
  patna: 'India - East & Central',
  bhopal: 'India - East & Central',
}

export function resolveGeoZone(
  state?: string | null,
  city?: string | null,
  ipAddress?: string | null,
  country?: string | null,
  timezone?: string | null
): GeoZoneName {
  if (country) {
    const c = country.trim().toUpperCase()
    if (['SA', 'KSA', 'SAUDI', 'SAUDI ARABIA'].includes(c)) return 'KSA - Central Region (Riyadh)'
    if (['OM', 'OMAN', 'OMN'].includes(c)) return 'Oman - Muscat Capital Region'
    if (['QA', 'QATAR', 'QAT'].includes(c)) return 'Qatar - Doha & Al Rayyan'
    if (['BH', 'BAHRAIN', 'BHR'].includes(c)) return 'Bahrain - Manama & Muharraq'
    if (['MV', 'MALDIVES', 'MDV'].includes(c)) return 'Maldives - Greater Malé'
    if (['IN', 'INDIA', 'IND'].includes(c)) return 'India - South Zone'
  }

  if (timezone) {
    const tz = timezone.toLowerCase()
    if (tz.includes('riyadh')) return 'KSA - Central Region (Riyadh)'
    if (tz.includes('muscat')) return 'Oman - Muscat Capital Region'
    if (tz.includes('qatar')) return 'Qatar - Doha & Al Rayyan'
    if (tz.includes('bahrain')) return 'Bahrain - Manama & Muharraq'
    if (tz.includes('maldives') || tz.includes('male')) return 'Maldives - Greater Malé'
  }

  if (state) {
    const cleanState = state.trim().toLowerCase()
    if (ZONE_MAPPINGS[cleanState]) return ZONE_MAPPINGS[cleanState]
  }

  if (city) {
    const cleanCity = city.trim().toLowerCase()
    if (ZONE_MAPPINGS[cleanCity]) return ZONE_MAPPINGS[cleanCity]
  }

  // Check if IP is local/internal network
  if (
    !ipAddress ||
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.')
  ) {
    return 'On-Premises / LAN'
  }

  return 'KSA - Central Region (Riyadh)' // Default GCC-first expansion origin
}

export async function getGeoPoliticalZoneMetrics() {
  const [branches, loginAuditLogs, activeUsers, orgSettings] = await Promise.all([
    prisma.branch.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            state: true,
            country: true,
            address: true,
            phone: true,
            email: true,
            status: true,
            dlNumber: true,
            gstin: true,
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                isActive: true,
                userRoles: {
                  include: { role: { select: { name: true, displayName: true } } },
                },
              },
            },
          },
        },
        users: {
          select: { id: true, name: true, email: true, phone: true, lastLoginAt: true, isActive: true },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: 'LOGIN' },
      include: {
        user: {
          include: {
            organization: { select: { id: true, name: true, city: true, state: true, country: true } },
            branch: { select: { name: true, city: true, state: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
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
      countryCode: TerritoryCode
      flag: string
      currency: string
      decimals: 2 | 3
      regulatoryBody: string
      taxRegime: string
      states: string[]
      branches: any[]
      totalLogins: number
      activeSessions: number
      orgIds: Set<string>
    }
  > = {
    'KSA - Central Region (Riyadh)': {
      displayName: 'KSA — Central Region (Riyadh Capital Hub)',
      color: 'emerald',
      countryCode: 'SA',
      flag: '🇸🇦',
      currency: 'SAR',
      decimals: 2,
      regulatoryBody: 'SFDA (الهيئة العامة للغذاء والدواء)',
      taxRegime: 'ZATCA 15% (0% SFDA Meds)',
      states: ['Riyadh', 'Al Kharj', 'Diriyah'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'KSA - Western Region (Makkah/Jeddah)': {
      displayName: 'KSA — Western Region (Makkah, Jeddah, Madinah)',
      color: 'teal',
      countryCode: 'SA',
      flag: '🇸🇦',
      currency: 'SAR',
      decimals: 2,
      regulatoryBody: 'SFDA Regional Office',
      taxRegime: 'ZATCA 15% (0% SFDA Meds)',
      states: ['Makkah', 'Jeddah', 'Madinah', 'Taif'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'KSA - Eastern Province (Dammam)': {
      displayName: 'KSA — Eastern Province (Dammam, Khobar, Jubail)',
      color: 'cyan',
      countryCode: 'SA',
      flag: '🇸🇦',
      currency: 'SAR',
      decimals: 2,
      regulatoryBody: 'SFDA Eastern Sector',
      taxRegime: 'ZATCA 15% (0% SFDA Meds)',
      states: ['Dammam', 'Khobar', 'Jubail', 'Al Ahsa'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Oman - Muscat Capital Region': {
      displayName: 'Oman — Muscat Capital Region (Muscat, Seeb, Matrah)',
      color: 'rose',
      countryCode: 'OM',
      flag: '🇴🇲',
      currency: 'OMR',
      decimals: 3,
      regulatoryBody: 'Ministry of Health Oman (MoH)',
      taxRegime: 'OTA 5% (0% MoH Meds)',
      states: ['Muscat', 'Seeb', 'Matrah', 'Bawshar'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Oman - Dhofar & Regional': {
      displayName: 'Oman — Dhofar & Regional Governorates (Salalah, Sohar)',
      color: 'amber',
      countryCode: 'OM',
      flag: '🇴🇲',
      currency: 'OMR',
      decimals: 3,
      regulatoryBody: 'MoH Directorate of Pharmacy',
      taxRegime: 'OTA 5% (0% MoH Meds)',
      states: ['Dhofar', 'Salalah', 'Sohar', 'Nizwa'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Qatar - Doha & Al Rayyan': {
      displayName: 'Qatar — Doha & Al Rayyan (MoPH Jurisdiction)',
      color: 'purple',
      countryCode: 'QA',
      flag: '🇶🇦',
      currency: 'QAR',
      decimals: 2,
      regulatoryBody: 'Ministry of Public Health (MoPH)',
      taxRegime: 'MoPH 0% Regime',
      states: ['Doha', 'Al Rayyan', 'Al Wakrah'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Bahrain - Manama & Muharraq': {
      displayName: 'Bahrain — Capital & Muharraq (NHRA Jurisdiction)',
      color: 'red',
      countryCode: 'BH',
      flag: '🇧🇭',
      currency: 'BHD',
      decimals: 3,
      regulatoryBody: 'NHRA (الهيئة الوطنية لتنظيم المهن والخدمات)',
      taxRegime: 'NBR 10% (0% NHRA Meds)',
      states: ['Manama', 'Muharraq', 'Riffa'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Maldives - Greater Malé': {
      displayName: 'Maldives — Greater Malé & Island Atolls',
      color: 'blue',
      countryCode: 'MV',
      flag: '🇲🇻',
      currency: 'MVR',
      decimals: 2,
      regulatoryBody: 'Maldives Food & Drug Authority (MFDA)',
      taxRegime: 'MIRA 8% GGST + Aasandha',
      states: ['Malé', 'Hulhumalé', 'Vilimalé', 'Addu City'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'India - South Zone': {
      displayName: 'India — South Zone (Telangana, Karnataka, AP, TN, KL)',
      color: 'indigo',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO Southern Zone',
      taxRegime: 'GST 12% (CGST/SGST)',
      states: ['Telangana', 'Karnataka', 'Andhra Pradesh', 'Tamil Nadu', 'Kerala'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'India - West Zone': {
      displayName: 'India — West Zone (Maharashtra, Gujarat, Goa)',
      color: 'sky',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO Western Zone',
      taxRegime: 'GST 12% (CGST/SGST)',
      states: ['Maharashtra', 'Gujarat', 'Goa'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'India - North Zone': {
      displayName: 'India — North Zone (Delhi NCR, Haryana, Punjab, UP)',
      color: 'yellow',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO Northern Zone',
      taxRegime: 'GST 12% (CGST/SGST)',
      states: ['Delhi', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'India - East & Central': {
      displayName: 'India — East & Central (WB, Bihar, Odisha, MP)',
      color: 'lime',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO Eastern/Central',
      taxRegime: 'GST 12% (CGST/SGST)',
      states: ['West Bengal', 'Bihar', 'Odisha', 'Madhya Pradesh'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'On-Premises / LAN': {
      displayName: 'On-Premises / Dispensary LAN Dedicated Terminals',
      color: 'slate',
      countryCode: 'SA',
      flag: '🏢',
      currency: 'SAR',
      decimals: 2,
      regulatoryBody: 'Local Dispensary Hardware Isolated',
      taxRegime: 'Air-Gapped / LAN Safe',
      states: ['Internal Subnet', 'Hardware POS POS01/02'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },

    // Legacy Fallbacks
    'South Zone': {
      displayName: 'South Zone (Legacy)',
      color: 'indigo',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO',
      taxRegime: 'GST 12%',
      states: ['Telangana', 'Karnataka'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'North Zone': {
      displayName: 'North Zone (Legacy)',
      color: 'yellow',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO',
      taxRegime: 'GST 12%',
      states: ['Delhi'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'West Zone': {
      displayName: 'West Zone (Legacy)',
      color: 'sky',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO',
      taxRegime: 'GST 12%',
      states: ['Maharashtra'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'East Zone': {
      displayName: 'East Zone (Legacy)',
      color: 'lime',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO',
      taxRegime: 'GST 12%',
      states: ['West Bengal'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
    'Central Zone': {
      displayName: 'Central Zone (Legacy)',
      color: 'cyan',
      countryCode: 'IN',
      flag: '🇮🇳',
      currency: 'INR',
      decimals: 2,
      regulatoryBody: 'CDSCO',
      taxRegime: 'GST 12%',
      states: ['Madhya Pradesh'],
      branches: [],
      totalLogins: 0,
      activeSessions: 0,
      orgIds: new Set(),
    },
  }

  // 1. Group branches into sovereign zones
  for (const b of branches) {
    const explicitZone = b.organization?.id ? orgZoneMap.get(b.organization.id) : undefined
    const state = b.state || b.organization?.state || 'Riyadh'
    const city = b.city || b.organization?.city || 'Riyadh'
    const country = b.organization?.country || 'SA'
    const zoneName = (explicitZone && zoneConfigs[explicitZone]) ? explicitZone : resolveGeoZone(state, city, null, country)

    const activeStaffInBranch = b.users.filter((u) => activeUsers.some((au) => au.id === u.id)).length
    const mostRecentLogin = b.users.reduce<Date | null>((acc, cur) => {
      if (!cur.lastLoginAt) return acc
      if (!acc) return cur.lastLoginAt
      return cur.lastLoginAt > acc ? cur.lastLoginAt : acc
    }, null)

    const org = b.organization
    const allOrgUsers = org?.users || []
    const adminUser = allOrgUsers.find((u) => u.isActive) || allOrgUsers[0] || null
    const mappedUsers = allOrgUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      role: u.userRoles[0]?.role?.displayName || u.userRoles[0]?.role?.name || 'Staff',
    }))

    zoneConfigs[zoneName].branches.push({
      id: b.id,
      name: b.name,
      shopName: org?.name || 'Metapharsic Core Dispensary',
      organizationId: org?.id,
      organizationCode: org?.code || null,
      city,
      state,
      country,
      address: b.address || org?.address || null,
      phone: b.phone || org?.phone || null,
      email: org?.email || null,
      dlNumber: b.dlNumber || org?.dlNumber || null,
      gstin: b.gstin || org?.gstin || null,
      status: org?.status || 'ACTIVE',
      zone: zoneName,
      activeStaffCount: activeStaffInBranch,
      lastLoginAt: mostRecentLogin ? mostRecentLogin.toISOString() : null,
      adminUser: adminUser
        ? {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
            phone: adminUser.phone,
          }
        : null,
      allUsers: mappedUsers,
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
    const country = user?.organization?.country
    const zoneName = (explicitZone && zoneConfigs[explicitZone]) ? explicitZone : resolveGeoZone(state, city, log.ipAddress, country)
    zoneConfigs[zoneName].totalLogins += 1
  }

  const grandTotalLogins = loginAuditLogs.length || 1

  // Filter out empty legacy zones for a pristine international presentation
  const activeKeys = (Object.keys(zoneConfigs) as GeoZoneName[]).filter(
    (key) => !['South Zone', 'North Zone', 'West Zone', 'East Zone', 'Central Zone'].includes(key) || zoneConfigs[key].totalLogins > 0
  )

  const results: GeoPoliticalZoneData[] = activeKeys.map((key) => {
    const z = zoneConfigs[key]
    const pct = Math.round((z.totalLogins / grandTotalLogins) * 100)
    return {
      zone: key,
      displayName: z.displayName,
      color: z.color,
      countryCode: z.countryCode,
      flag: z.flag,
      currency: z.currency,
      decimals: z.decimals,
      regulatoryBody: z.regulatoryBody,
      taxRegime: z.taxRegime,
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
