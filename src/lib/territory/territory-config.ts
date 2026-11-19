/**
 * Metapharsic Rx — Sovereign Territory & Geopolitical Zone Configuration
 * Supports: Saudi Arabia (SA), Oman (OM), Qatar (QA), Bahrain (BH), Maldives (MV), India (IN).
 * Pure dynamic configuration — no hardcoded country rules in presentation or business logic.
 */

export type TerritoryCode = 'SA' | 'OM' | 'QA' | 'BH' | 'MV' | 'IN'
export type CurrencyCode = 'SAR' | 'OMR' | 'QAR' | 'BHD' | 'MVR' | 'INR'
export type SupportedLanguage = 'en' | 'ar'
export type DocumentDirection = 'ltr' | 'rtl'

export interface TerritoryCurrencyConfig {
  code: CurrencyCode
  symbolEn: string
  symbolAr: string
  decimals: 2 | 3
  subunitScale: 100 | 1000
  subunitNameEn: string
  subunitNameAr: string
}

export interface TerritoryTaxConfig {
  regime: 'ZATCA' | 'OTA' | 'NBR' | 'MOPH_ZERO' | 'MIRA_GGST' | 'GST'
  standardVatRate: number // Percentage: e.g. 15 for 15%
  zeroRatedMedicines: boolean // True for KSA, Oman, Bahrain where prescription drugs are 0%
  taxAuthorityNameEn: string
  taxAuthorityNameAr: string
  vatIdLabelEn: string
  vatIdLabelAr: string
  eInvoicingMandate: boolean
  qrStandard: 'ZATCA_TLV_BASE64' | 'GST_B2C_DYNAMIC' | 'MIRA_TAX_QR' | 'STANDARD_QR'
}

export interface TerritoryRegulatoryConfig {
  authorityNameEn: string
  authorityNameAr: string
  acronym: string
  controlledDrugRegisterEn: string
  controlledDrugRegisterAr: string
  trackAndTraceSystem?: string // e.g., 'SFDA Tatmeen / رصد تتبع', 'NHRA Munsha\'at'
}

export interface TerritoryDefinition {
  code: TerritoryCode
  iso2: string
  iso3: string
  nameEn: string
  nameAr: string
  flag: string
  dialCode: string
  timezone: string
  defaultLanguage: SupportedLanguage
  defaultDirection: DocumentDirection
  currency: TerritoryCurrencyConfig
  tax: TerritoryTaxConfig
  regulatory: TerritoryRegulatoryConfig
  supportsHijriCalendar: boolean
  businessHoursDefault: {
    start: string // '08:00'
    end: string   // '23:00'
    prayerTimePausesEnabled: boolean
  }
}

export const TERRITORIES: Record<TerritoryCode, TerritoryDefinition> = {
  SA: {
    code: 'SA',
    iso2: 'SA',
    iso3: 'SAU',
    nameEn: 'Kingdom of Saudi Arabia',
    nameAr: 'المملكة العربية السعودية',
    flag: '🇸🇦',
    dialCode: '+966',
    timezone: 'Asia/Riyadh',
    defaultLanguage: 'ar',
    defaultDirection: 'rtl',
    currency: {
      code: 'SAR',
      symbolEn: 'SAR',
      symbolAr: 'ر.س',
      decimals: 2,
      subunitScale: 100,
      subunitNameEn: 'Halalas',
      subunitNameAr: 'هللة',
    },
    tax: {
      regime: 'ZATCA',
      standardVatRate: 15.0,
      zeroRatedMedicines: true, // SFDA registered prescription human drugs are 0% VAT
      taxAuthorityNameEn: 'Zakat, Tax and Customs Authority (ZATCA)',
      taxAuthorityNameAr: 'هيئة الزكاة والضريبة والجمارك (زاتكا)',
      vatIdLabelEn: 'VAT Registration No.',
      vatIdLabelAr: 'الرقم الضريبي',
      eInvoicingMandate: true,
      qrStandard: 'ZATCA_TLV_BASE64',
    },
    regulatory: {
      authorityNameEn: 'Saudi Food and Drug Authority (SFDA)',
      authorityNameAr: 'الهيئة العامة للغذاء والدواء',
      acronym: 'SFDA',
      controlledDrugRegisterEn: 'SFDA Narcotic & Psychotropic Registry',
      controlledDrugRegisterAr: 'سجل الأدوية المخدرة والمؤثرات العقلية',
      trackAndTraceSystem: 'RSD Tatmeen (رصد وتتبع)',
    },
    supportsHijriCalendar: true,
    businessHoursDefault: {
      start: '08:00',
      end: '00:00',
      prayerTimePausesEnabled: true,
    },
  },

  OM: {
    code: 'OM',
    iso2: 'OM',
    iso3: 'OMN',
    nameEn: 'Sultanate of Oman',
    nameAr: 'سلطنة عُمان',
    flag: '🇴🇲',
    dialCode: '+968',
    timezone: 'Asia/Muscat',
    defaultLanguage: 'ar',
    defaultDirection: 'rtl',
    currency: {
      code: 'OMR',
      symbolEn: 'OMR',
      symbolAr: 'ر.ع.',
      decimals: 3, // 3 decimal places (1 OMR = 1000 Baisa)
      subunitScale: 1000,
      subunitNameEn: 'Baisa',
      subunitNameAr: 'بيسة',
    },
    tax: {
      regime: 'OTA',
      standardVatRate: 5.0,
      zeroRatedMedicines: true, // MoH basic healthcare & registered medicines are 0% VAT
      taxAuthorityNameEn: 'Oman Tax Authority (OTA)',
      taxAuthorityNameAr: 'جهاز الضرائب سلطنة عمان',
      vatIdLabelEn: 'VAT Identification Number (TIN)',
      vatIdLabelAr: 'الرقم التعريفي لضريبة القيمة المضافة',
      eInvoicingMandate: true,
      qrStandard: 'STANDARD_QR',
    },
    regulatory: {
      authorityNameEn: 'Ministry of Health Oman (MoH)',
      authorityNameAr: 'وزارة الصحة سلطنة عُمان',
      acronym: 'MoH OMN',
      controlledDrugRegisterEn: 'MoH Controlled & Special Drugs Register',
      controlledDrugRegisterAr: 'سجل الأدوية المراقبة والخاصة',
      trackAndTraceSystem: 'MoH Pharmaceutical Tracking Registry',
    },
    supportsHijriCalendar: true,
    businessHoursDefault: {
      start: '08:30',
      end: '23:30',
      prayerTimePausesEnabled: true,
    },
  },

  QA: {
    code: 'QA',
    iso2: 'QA',
    iso3: 'QAT',
    nameEn: 'State of Qatar',
    nameAr: 'دولة قطر',
    flag: '🇶🇦',
    dialCode: '+974',
    timezone: 'Asia/Qatar',
    defaultLanguage: 'ar',
    defaultDirection: 'rtl',
    currency: {
      code: 'QAR',
      symbolEn: 'QAR',
      symbolAr: 'ر.ق',
      decimals: 2,
      subunitScale: 100,
      subunitNameEn: 'Dirhams',
      subunitNameAr: 'درهم',
    },
    tax: {
      regime: 'MOPH_ZERO',
      standardVatRate: 0.0, // Standard 0% rate in current clinical commerce
      zeroRatedMedicines: true,
      taxAuthorityNameEn: 'General Tax Authority (GTA)',
      taxAuthorityNameAr: 'الهيئة العامة للضرائب',
      vatIdLabelEn: 'Tax Identification Number (TIN)',
      vatIdLabelAr: 'الرقم الضريبي التعريفي',
      eInvoicingMandate: false,
      qrStandard: 'STANDARD_QR',
    },
    regulatory: {
      authorityNameEn: 'Ministry of Public Health (MoPH)',
      authorityNameAr: 'وزارة الصحة العامة',
      acronym: 'MoPH',
      controlledDrugRegisterEn: 'MoPH Controlled Drugs Administration Registry',
      controlledDrugRegisterAr: 'سجل إدارة الأدوية المراقبة',
      trackAndTraceSystem: 'Qatar Pharmacy Track & Trace',
    },
    supportsHijriCalendar: true,
    businessHoursDefault: {
      start: '08:00',
      end: '23:00',
      prayerTimePausesEnabled: true,
    },
  },

  BH: {
    code: 'BH',
    iso2: 'BH',
    iso3: 'BHR',
    nameEn: 'Kingdom of Bahrain',
    nameAr: 'مملكة البحرين',
    flag: '🇧🇭',
    dialCode: '+973',
    timezone: 'Asia/Bahrain',
    defaultLanguage: 'ar',
    defaultDirection: 'rtl',
    currency: {
      code: 'BHD',
      symbolEn: 'BHD',
      symbolAr: 'د.ب',
      decimals: 3, // 3 decimal places (1 BHD = 1000 Fils)
      subunitScale: 1000,
      subunitNameEn: 'Fils',
      subunitNameAr: 'فلس',
    },
    tax: {
      regime: 'NBR',
      standardVatRate: 10.0,
      zeroRatedMedicines: true, // NHRA registered human pharmaceuticals are 0% VAT
      taxAuthorityNameEn: 'National Bureau for Revenue (NBR)',
      taxAuthorityNameAr: 'الجهاز الوطني للإيرادات',
      vatIdLabelEn: 'VAT Account Number',
      vatIdLabelAr: 'رقم حساب ضريبة القيمة المضافة',
      eInvoicingMandate: true,
      qrStandard: 'STANDARD_QR',
    },
    regulatory: {
      authorityNameEn: 'National Health Regulatory Authority (NHRA)',
      authorityNameAr: 'الهيئة الوطنية لتنظيم المهن والخدمات الصحية',
      acronym: 'NHRA',
      controlledDrugRegisterEn: 'NHRA Narcotic & Controlled Substances Ledger',
      controlledDrugRegisterAr: 'سجل المواد المخدرة والمراقبة',
      trackAndTraceSystem: 'NHRA Munsha\'at Traceability',
    },
    supportsHijriCalendar: true,
    businessHoursDefault: {
      start: '08:00',
      end: '23:00',
      prayerTimePausesEnabled: false,
    },
  },

  MV: {
    code: 'MV',
    iso2: 'MV',
    iso3: 'MDV',
    nameEn: 'Republic of Maldives',
    nameAr: 'جمهورية المالديف',
    flag: '🇲🇻',
    dialCode: '+960',
    timezone: 'Indian/Maldives',
    defaultLanguage: 'en',
    defaultDirection: 'ltr',
    currency: {
      code: 'MVR',
      symbolEn: 'MVR',
      symbolAr: 'Rf',
      decimals: 2,
      subunitScale: 100,
      subunitNameEn: 'Laari',
      subunitNameAr: 'لاري',
    },
    tax: {
      regime: 'MIRA_GGST',
      standardVatRate: 8.0, // MIRA General Goods and Services Tax (GGST)
      zeroRatedMedicines: false, // Subject to statutory prescription co-pays and Aasandha scheme
      taxAuthorityNameEn: 'Maldives Inland Revenue Authority (MIRA)',
      taxAuthorityNameAr: 'هيئة الإيرادات الداخلية للمالديف',
      vatIdLabelEn: 'TIN / Business Registration No.',
      vatIdLabelAr: 'رقم السجل التجاري والضريبي',
      eInvoicingMandate: true,
      qrStandard: 'MIRA_TAX_QR',
    },
    regulatory: {
      authorityNameEn: 'Maldives Food and Drug Authority (MFDA)',
      authorityNameAr: 'هيئة الغذاء والدواء المالديفية',
      acronym: 'MFDA',
      controlledDrugRegisterEn: 'MFDA Controlled Pharmaceuticals Log',
      controlledDrugRegisterAr: 'سجل الأدوية المراقبة MFDA',
      trackAndTraceSystem: 'Aasandha National Pharmacy Integration',
    },
    supportsHijriCalendar: true,
    businessHoursDefault: {
      start: '08:30',
      end: '22:30',
      prayerTimePausesEnabled: false,
    },
  },

  IN: {
    code: 'IN',
    iso2: 'IN',
    iso3: 'IND',
    nameEn: 'Republic of India',
    nameAr: 'جمهورية الهند',
    flag: '🇮🇳',
    dialCode: '+91',
    timezone: 'Asia/Kolkata',
    defaultLanguage: 'en',
    defaultDirection: 'ltr',
    currency: {
      code: 'INR',
      symbolEn: '₹',
      symbolAr: 'ر.ه',
      decimals: 2,
      subunitScale: 100,
      subunitNameEn: 'Paise',
      subunitNameAr: 'بيزة',
    },
    tax: {
      regime: 'GST',
      standardVatRate: 12.0, // Common pharmaceutical GST slab (CGST 6% + SGST 6%)
      zeroRatedMedicines: false,
      taxAuthorityNameEn: 'Goods and Services Tax Network (GSTN)',
      taxAuthorityNameAr: 'شبكة ضريبة السلع والخدمات الهندية',
      vatIdLabelEn: 'GSTIN (GST Identification Number)',
      vatIdLabelAr: 'رقم التعريف الضريبي GSTIN',
      eInvoicingMandate: true,
      qrStandard: 'GST_B2C_DYNAMIC',
    },
    regulatory: {
      authorityNameEn: 'Central Drugs Standard Control Organisation (CDSCO)',
      authorityNameAr: 'المنظمة المركزية لمراقبة معايير الأدوية',
      acronym: 'CDSCO',
      controlledDrugRegisterEn: 'Schedule H1 & Narcotic Audit Registry',
      controlledDrugRegisterAr: 'سجل الأدوية المراقبة والجدول H1',
      trackAndTraceSystem: 'CDSCO Track & Trace / HSN Matrix',
    },
    supportsHijriCalendar: false,
    businessHoursDefault: {
      start: '09:00',
      end: '23:00',
      prayerTimePausesEnabled: false,
    },
  },
}

/**
 * Returns territory details by code, falling back to 'SA' for GCC-first operations.
 */
export function getTerritory(code?: string | null): TerritoryDefinition {
  if (!code) return TERRITORIES.SA
  const normalized = code.trim().toUpperCase() as TerritoryCode
  return TERRITORIES[normalized] ?? TERRITORIES.SA
}

/**
 * Returns list of all supported sovereign territories.
 */
export function getAllTerritories(): TerritoryDefinition[] {
  return Object.values(TERRITORIES)
}

/**
 * Detects sovereign territory from browser or organization timezone.
 */
export function detectTerritoryFromTimezone(timezone?: string | null): TerritoryCode {
  if (!timezone) return 'SA'
  const tz = timezone.toLowerCase()
  if (tz.includes('riyadh')) return 'SA'
  if (tz.includes('muscat')) return 'OM'
  if (tz.includes('qatar')) return 'QA'
  if (tz.includes('bahrain')) return 'BH'
  if (tz.includes('maldives') || tz.includes('male')) return 'MV'
  if (tz.includes('kolkata') || tz.includes('calcutta') || tz.includes('india')) return 'IN'
  return 'SA'
}

/**
 * Detects territory from country string or ISO code.
 */
export function detectTerritoryFromCountry(country?: string | null): TerritoryCode {
  if (!country) return 'SA'
  const c = country.trim().toUpperCase()
  if (['SA', 'KSA', 'SAUDI', 'SAUDI ARABIA', 'SAU'].includes(c)) return 'SA'
  if (['OM', 'OMN', 'OMAN', 'SULTANATE OF OMAN'].includes(c)) return 'OM'
  if (['QA', 'QAT', 'QATAR', 'STATE OF QATAR'].includes(c)) return 'QA'
  if (['BH', 'BHR', 'BAHRAIN', 'KINGDOM OF BAHRAIN'].includes(c)) return 'BH'
  if (['MV', 'MDV', 'MALDIVES', 'REPUBLIC OF MALDIVES'].includes(c)) return 'MV'
  if (['IN', 'IND', 'INDIA', 'REPUBLIC OF INDIA', 'BHARAT'].includes(c)) return 'IN'
  return 'SA'
}
