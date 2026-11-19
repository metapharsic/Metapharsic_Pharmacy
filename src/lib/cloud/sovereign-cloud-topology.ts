/**
 * Metapharsic Rx — Sovereign Cloud Topologies & Data Residency Compliance Engine
 * Enforces compliance with strict sovereign data protection acts:
 * - Saudi Arabia: NDMO (National Data Management Office) & PDPL (Personal Data Protection Law)
 * - Oman: Royal Decree 6/2022 (Personal Data Protection) & Oman Data Park (ODP)
 * - Bahrain: Personal Data Protection Law (Law No. 30 of 2018) & NHRA Cloud Security
 * - Qatar: Law No. 13 of 2016 (Personal Data Privacy) & MoPH Healthcare Cloud
 * - Maldives: National Health Data Regulations (MIRA / Aasandha Data Mandate)
 * - India: Digital Personal Data Protection Act (DPDPA 2023) & CDSCO Compliance
 */

import { TerritoryCode, TERRITORIES } from '@/lib/territory/territory-config'

export interface SovereignCloudNode {
  territoryCode: TerritoryCode
  countryNameEn: string
  countryNameAr: string
  flag: string
  cloudRegionCode: string
  cloudProvider: 'Oracle Cloud (OCI)' | 'AWS Middle East' | 'Oman Data Park' | 'Dhiraagu Edge' | 'AWS India'
  datacenterCity: string
  datacenterCityAr: string
  primaryNodeHost: string
  secondaryFailoverHost: string
  dataResidencyLaw: string
  encryptionStandard: 'AES-256-GCM Sovereign KMS' | 'Hardware HSM FIPS 140-2 Level 3'
  status: 'ONLINE' | 'STANDBY' | 'MAINTENANCE'
  latencyMs: number
  replicationLagMs: number
  inCountryStorageGuaranteed: boolean
}

export const SOVEREIGN_CLOUD_TOPOLOGIES: Record<TerritoryCode, SovereignCloudNode> = {
  SA: {
    territoryCode: 'SA',
    countryNameEn: 'Saudi Arabia',
    countryNameAr: 'المملكة العربية السعودية',
    flag: '🇸🇦',
    cloudRegionCode: 'me-central-1 (Riyadh / Jeddah)',
    cloudProvider: 'Oracle Cloud (OCI)',
    datacenterCity: 'Riyadh & Jeddah Local Zone',
    datacenterCityAr: 'الرياض وجدة',
    primaryNodeHost: 'sa-central-node-01.metapharsic.cloud',
    secondaryFailoverHost: 'sa-west-node-02.metapharsic.cloud',
    dataResidencyLaw: 'Saudi NDMO & PDPL (In-Kingdom Health Data Residency)',
    encryptionStandard: 'Hardware HSM FIPS 140-2 Level 3',
    status: 'ONLINE',
    latencyMs: 14.2,
    replicationLagMs: 2.1,
    inCountryStorageGuaranteed: true,
  },
  OM: {
    territoryCode: 'OM',
    countryNameEn: 'Sultanate of Oman',
    countryNameAr: 'سلطنة عُمان',
    flag: '🇴🇲',
    cloudRegionCode: 'om-muscat-1 (Oman Data Park)',
    cloudProvider: 'Oman Data Park',
    datacenterCity: 'Muscat & Dhofar Zone',
    datacenterCityAr: 'مسقط وظفار',
    primaryNodeHost: 'om-muscat-node-01.metapharsic.cloud',
    secondaryFailoverHost: 'om-salalah-node-02.metapharsic.cloud',
    dataResidencyLaw: 'Oman Royal Decree 6/2022 (ODP Sovereign Data Core)',
    encryptionStandard: 'AES-256-GCM Sovereign KMS',
    status: 'ONLINE',
    latencyMs: 18.5,
    replicationLagMs: 3.4,
    inCountryStorageGuaranteed: true,
  },
  BH: {
    territoryCode: 'BH',
    countryNameEn: 'Kingdom of Bahrain',
    countryNameAr: 'مملكة البحرين',
    flag: '🇧🇭',
    cloudRegionCode: 'me-south-1 (Bahrain)',
    cloudProvider: 'AWS Middle East',
    datacenterCity: 'Manama',
    datacenterCityAr: 'المنامة',
    primaryNodeHost: 'bh-manama-node-01.metapharsic.cloud',
    secondaryFailoverHost: 'bh-muharraq-node-02.metapharsic.cloud',
    dataResidencyLaw: 'Bahrain Law No. 30 of 2018 (NHRA Cloud Standard)',
    encryptionStandard: 'Hardware HSM FIPS 140-2 Level 3',
    status: 'ONLINE',
    latencyMs: 12.8,
    replicationLagMs: 1.8,
    inCountryStorageGuaranteed: true,
  },
  QA: {
    territoryCode: 'QA',
    countryNameEn: 'State of Qatar',
    countryNameAr: 'دولة قطر',
    flag: '🇶🇦',
    cloudRegionCode: 'me-central-2 (Doha)',
    cloudProvider: 'AWS Middle East',
    datacenterCity: 'Doha',
    datacenterCityAr: 'الدوحة',
    primaryNodeHost: 'qa-doha-node-01.metapharsic.cloud',
    secondaryFailoverHost: 'qa-alrayyan-node-02.metapharsic.cloud',
    dataResidencyLaw: 'Qatar Law No. 13 of 2016 (MoPH Healthcare Gateway)',
    encryptionStandard: 'AES-256-GCM Sovereign KMS',
    status: 'ONLINE',
    latencyMs: 16.1,
    replicationLagMs: 2.5,
    inCountryStorageGuaranteed: true,
  },
  MV: {
    territoryCode: 'MV',
    countryNameEn: 'Republic of Maldives',
    countryNameAr: 'جمهورية المالديف',
    flag: '🇲🇻',
    cloudRegionCode: 'mv-male-1 (Greater Malé Hub)',
    cloudProvider: 'Dhiraagu Edge',
    datacenterCity: 'Malé & Hulhumalé',
    datacenterCityAr: 'ماليه وهولهوماليه',
    primaryNodeHost: 'mv-male-node-01.metapharsic.cloud',
    secondaryFailoverHost: 'mv-edge-node-02.metapharsic.cloud',
    dataResidencyLaw: 'Maldives Aasandha & MIRA Sovereign Health Protocol',
    encryptionStandard: 'AES-256-GCM Sovereign KMS',
    status: 'ONLINE',
    latencyMs: 28.4,
    replicationLagMs: 5.2,
    inCountryStorageGuaranteed: true,
  },
  IN: {
    territoryCode: 'IN',
    countryNameEn: 'Republic of India',
    countryNameAr: 'جمهورية الهند',
    flag: '🇮🇳',
    cloudRegionCode: 'ap-south-1 (Mumbai / Hyderabad)',
    cloudProvider: 'AWS India',
    datacenterCity: 'Mumbai & Bangalore Zone',
    datacenterCityAr: 'مومباي وبنغالور',
    primaryNodeHost: 'in-mumbai-node-01.metapharsic.cloud',
    secondaryFailoverHost: 'in-blr-node-02.metapharsic.cloud',
    dataResidencyLaw: 'India DPDPA 2023 & CDSCO Pharmaceutical Mandate',
    encryptionStandard: 'Hardware HSM FIPS 140-2 Level 3',
    status: 'ONLINE',
    latencyMs: 8.6,
    replicationLagMs: 1.1,
    inCountryStorageGuaranteed: true,
  },
}

/**
 * Returns sovereign cloud node metadata for a specified territory.
 */
export function getSovereignCloudTopology(territoryCode?: TerritoryCode | string | null): SovereignCloudNode {
  if (!territoryCode) return SOVEREIGN_CLOUD_TOPOLOGIES.SA
  const upper = territoryCode.toUpperCase() as TerritoryCode
  return SOVEREIGN_CLOUD_TOPOLOGIES[upper] || SOVEREIGN_CLOUD_TOPOLOGIES.SA
}

/**
 * Returns all active sovereign cloud nodes for the SuperAdmin Command Center.
 */
export function listAllSovereignCloudNodes(): SovereignCloudNode[] {
  return Object.values(SOVEREIGN_CLOUD_TOPOLOGIES)
}

/**
 * Validates data residency compliance before writing or syncing across borders.
 * Strictly prevents unencrypted cross-border exfiltration of patient health records.
 */
export function verifyDataResidencyCompliance(
  originTerritory: TerritoryCode,
  targetHost: string
): { compliant: boolean; legalFramework: string; reason?: string } {
  const node = getSovereignCloudTopology(originTerritory)
  const terrLower = originTerritory.toLowerCase()
  const hostLower = targetHost.toLowerCase()

  // Authorized if matches designated primary or secondary sovereign node host
  const isDesignatedNode =
    hostLower === node.primaryNodeHost.toLowerCase() ||
    hostLower === node.secondaryFailoverHost.toLowerCase()

  // Authorized if host is a dedicated sovereign subdomain of metapharsic.cloud (e.g., sa-*, om-*, bh-*, etc.)
  const isSovereignSubdomain =
    hostLower.endsWith('.metapharsic.cloud') &&
    (hostLower.startsWith(`${terrLower}-`) || hostLower.startsWith(`${terrLower}.`))

  const isCompliant = isDesignatedNode || isSovereignSubdomain

  if (!isCompliant) {
    return {
      compliant: false,
      legalFramework: node.dataResidencyLaw,
      reason: `Routing to non-sovereign host "${targetHost}" violates ${node.dataResidencyLaw}. Health data must remain stored within ${node.countryNameEn}.`,
    }
  }

  return {
    compliant: true,
    legalFramework: node.dataResidencyLaw,
  }
}
