/**
 * Metapharsic Rx — Sovereign Regional Tax & VAT Compliance Engine
 * Provides region-specific statutory tax return calculations, schedules, CSV/JSON exports,
 * and form schemas across:
 * - Oman (OM): Oman Tax Authority (OTA) Form 101 VAT Return (5% Standard, 0% Zero-Rated Medicines)
 * - Saudi Arabia (SA): ZATCA VAT Return & Fatoora Phase-2 Compliance (15% Standard, 0% SFDA Zero-Rated)
 * - Bahrain (BH): National Bureau for Revenue (NBR) VAT Return (10% Standard, 0% NHRA Zero-Rated)
 * - Qatar (QA): General Tax Authority (GTA) / MoPH Clinical 0% Healthcare Clearance
 * - Maldives (MV): Maldives Inland Revenue Authority (MIRA) Form 205 GGST Return (8%)
 * - India (IN): Goods & Services Tax (GSTN) GSTR-1, GSTR-2B, GSTR-3B
 */

import { format } from 'date-fns'
import { TerritoryCode } from '@/lib/territory/territory-config'
import type { SaleForTally, PurchaseForTally } from '@/lib/tally/tally-xml-builder'

export interface SovereignTaxProfile {
  territoryCode: TerritoryCode
  regime: 'OTA' | 'ZATCA' | 'NBR' | 'MOPH_ZERO' | 'MIRA_GGST' | 'GST'
  authorityNameEn: string
  authorityNameAr: string
  vatIdLabelEn: string
  vatIdLabelAr: string
  standardRate: number
  zeroRatedMedicines: boolean
  currency: string
  decimals: number
  formCode: string
  formTitleEn: string
  formTitleAr: string
  formDescriptionEn: string
  formDescriptionAr: string
  reportTabLabelEn: string
  reportTabLabelAr: string
  csvDownloadLabelEn: string
  csvDownloadLabelAr: string
  jsonDownloadLabelEn: string
  jsonDownloadLabelAr: string
  box1LabelEn: string
  box1LabelAr: string
  box2LabelEn: string
  box2LabelAr: string
  box3LabelEn: string
  box3LabelAr: string
  box4LabelEn: string
  box4LabelAr: string
  box5LabelEn: string
  box5LabelAr: string
  box6LabelEn: string
  box6LabelAr: string
}

export const SOVEREIGN_TAX_PROFILES: Record<TerritoryCode, SovereignTaxProfile> = {
  OM: {
    territoryCode: 'OM',
    regime: 'OTA',
    authorityNameEn: 'Oman Tax Authority (OTA)',
    authorityNameAr: 'جهاز الضرائب سلطنة عمان',
    vatIdLabelEn: 'VAT Identification Number (TIN)',
    vatIdLabelAr: 'الرقم التعريفي لضريبة القيمة المضافة',
    standardRate: 5.0,
    zeroRatedMedicines: true,
    currency: 'OMR',
    decimals: 3,
    formCode: 'OTA Form 101',
    formTitleEn: 'Oman Tax Authority (OTA) — VAT Return (Form 101)',
    formTitleAr: 'إقرار ضريبة القيمة المضافة - جهاز الضرائب (نموذج 101)',
    formDescriptionEn:
      'Statutory Oman VAT Form 101 compliance report: Box 1 (5% Standard Supplies), Box 2 (0% Zero-Rated Human Medicines & Medical Goods), Box 3 (Exempt Supplies), and Net Tax Payable in OMR.',
    formDescriptionAr:
      'تقرير الإقرار الضريبي الرسمي لجهاز الضرائب العماني (نموذج 101): البند 1 (توريدات 5% أساسية)، البند 2 (توريدات الأدوية والمستلزمات الصيدلانية الخاضعة لنسبة الصفر 0%)، وصافي الضريبة الواجبة السداد بالريال العماني.',
    reportTabLabelEn: 'OTA VAT Return (Form 101)',
    reportTabLabelAr: 'إقرار ضريبة القيمة المضافة (101)',
    csvDownloadLabelEn: 'Download OTA VAT Return CSV',
    csvDownloadLabelAr: 'تحميل إقرار القيمة المضافة CSV',
    jsonDownloadLabelEn: 'Export OTA Audit File JSON',
    jsonDownloadLabelAr: 'تصدير ملف التدقيق الضريبي JSON',
    box1LabelEn: 'Box 1: Standard Rated Supplies (5%)',
    box1LabelAr: 'البند 1: التوريدات الخاضعة للنسبة الأساسية (5%)',
    box2LabelEn: 'Box 2: Zero-Rated Human Medicines (0%)',
    box2LabelAr: 'البند 2: توريدات الأدوية البشرية المعتمدة (نسبة الصفر 0%)',
    box3LabelEn: 'Box 3: Exempt Supplies',
    box3LabelAr: 'البند 3: التوريدات المعفاة',
    box4LabelEn: 'Box 4: Total Outward Supplies & Output VAT',
    box4LabelAr: 'البند 4: إجمالي التوريدات وضريبة المخرجات',
    box5LabelEn: 'Box 5: Standard Rated Purchases & Input VAT',
    box5LabelAr: 'البند 5: المشتريات الخاضعة للنسبة الأساسية وضريبة المدخلات',
    box6LabelEn: 'Box 6: Net VAT Payable / (Refundable) to OTA',
    box6LabelAr: 'البند 6: صافي ضريبة القيمة المضافة الواجبة السداد لجهاز الضرائب',
  },

  SA: {
    territoryCode: 'SA',
    regime: 'ZATCA',
    authorityNameEn: 'Zakat, Tax and Customs Authority (ZATCA)',
    authorityNameAr: 'هيئة الزكاة والضريبة والجمارك (زاتكا)',
    vatIdLabelEn: 'VAT Registration No.',
    vatIdLabelAr: 'الرقم الضريبي',
    standardRate: 15.0,
    zeroRatedMedicines: true,
    currency: 'SAR',
    decimals: 2,
    formCode: 'ZATCA VAT Return',
    formTitleEn: 'ZATCA VAT Return & Fatoora Phase-2 Compliance',
    formTitleAr: 'إقرار ضريبة القيمة المضافة - زاتكا والفوترة الإلكترونية (المرحلة 2)',
    formDescriptionEn:
      'Statutory ZATCA 15% VAT filing, 0% SFDA registered zero-rated prescription pharmaceutical supplies, and cryptographic invoice audit registry in SAR.',
    formDescriptionAr:
      'إقرار ضريبة القيمة المضافة لهيئة الزكاة والضريبة والجمارك (15%)، توريدات الأدوية البشرية المسجلة لدى هيئة الغذاء والدواء بنسبة الصفر (0%)، وسجل الفوترة الإلكترونية بالريال السعودي.',
    reportTabLabelEn: 'ZATCA VAT Return',
    reportTabLabelAr: 'إقرار ضريبة القيمة المضافة (زاتكا)',
    csvDownloadLabelEn: 'Download ZATCA VAT CSV',
    csvDownloadLabelAr: 'تحميل إقرار زاتكا CSV',
    jsonDownloadLabelEn: 'Export ZATCA Fatoora JSON',
    jsonDownloadLabelAr: 'تصدير فوترة زاتكا JSON',
    box1LabelEn: 'Standard Rated Supplies (15%)',
    box1LabelAr: 'التوريدات الخاضعة للنسبة الأساسية (15%)',
    box2LabelEn: 'Zero-Rated SFDA Medicines (0%)',
    box2LabelAr: 'أدوية الغذاء والدواء المسجلة الخاضعة لنسبة الصفر (0%)',
    box3LabelEn: 'Exempt Supplies',
    box3LabelAr: 'التوريدات المعفاة من الضريبة',
    box4LabelEn: 'Total Sales & Output VAT',
    box4LabelAr: 'إجمالي المبيعات وضريبة المخرجات',
    box5LabelEn: 'Purchases Subject to 15% & Input VAT',
    box5LabelAr: 'المشتريات الخاضعة لنسبة 15% وضريبة المدخلات القابلة للخصم',
    box6LabelEn: 'Net VAT Payable / (Refundable) to ZATCA',
    box6LabelAr: 'صافي الضريبة الواجبة السداد لهيئة الزكاة والضريبة والجمارك',
  },

  BH: {
    territoryCode: 'BH',
    regime: 'NBR',
    authorityNameEn: 'National Bureau for Revenue (NBR)',
    authorityNameAr: 'الجهاز الوطني للإيرادات',
    vatIdLabelEn: 'VAT Account Number',
    vatIdLabelAr: 'رقم حساب ضريبة القيمة المضافة',
    standardRate: 10.0,
    zeroRatedMedicines: true,
    currency: 'BHD',
    decimals: 3,
    formCode: 'NBR VAT Return',
    formTitleEn: 'National Bureau for Revenue (NBR) — VAT Return',
    formTitleAr: 'إقرار ضريبة القيمة المضافة - الجهاز الوطني للإيرادات',
    formDescriptionEn:
      'Statutory Bahrain NBR 10% VAT return, NHRA zero-rated human pharmaceuticals (0%), and BHD net tax liability (3 decimal places).',
    formDescriptionAr:
      'إقرار ضريبة القيمة المضافة للجهاز الوطني للإيرادات في البحرين (10%)، وتوريدات أدوية الهيئة الوطنية لتنظيم المهن الصحية (0%)، بالدينار البحريني.',
    reportTabLabelEn: 'NBR VAT Return',
    reportTabLabelAr: 'إقرار ضريبة القيمة المضافة (NBR)',
    csvDownloadLabelEn: 'Download NBR VAT CSV',
    csvDownloadLabelAr: 'تحميل إقرار NBR CSV',
    jsonDownloadLabelEn: 'Export NBR Audit JSON',
    jsonDownloadLabelAr: 'تصدير سجل التدقيق JSON',
    box1LabelEn: 'Standard Rated Supplies (10%)',
    box1LabelAr: 'التوريدات الخاضعة للنسبة الأساسية (10%)',
    box2LabelEn: 'Zero-Rated NHRA Medicines (0%)',
    box2LabelAr: 'أدوية NHRA الخاضعة لنسبة الصفر (0%)',
    box3LabelEn: 'Exempt Supplies',
    box3LabelAr: 'التوريدات المعفاة',
    box4LabelEn: 'Total Supplies & Output VAT',
    box4LabelAr: 'إجمالي التوريدات وضريبة المخرجات',
    box5LabelEn: 'Taxable Purchases & Deductible Input VAT',
    box5LabelAr: 'المشتريات الخاضعة للضريبة وضريبة المدخلات',
    box6LabelEn: 'Net VAT Payable / (Refundable) to NBR',
    box6LabelAr: 'صافي الضريبة المستحقة للجهاز الوطني للإيرادات',
  },

  QA: {
    territoryCode: 'QA',
    regime: 'MOPH_ZERO',
    authorityNameEn: 'General Tax Authority (GTA) & MoPH',
    authorityNameAr: 'الهيئة العامة للضرائب ووزارة الصحة العامة',
    vatIdLabelEn: 'Tax Identification Number (TIN)',
    vatIdLabelAr: 'الرقم الضريبي التعريفي',
    standardRate: 0.0,
    zeroRatedMedicines: true,
    currency: 'QAR',
    decimals: 2,
    formCode: 'GTA Healthcare Clearance',
    formTitleEn: 'Qatar GTA Healthcare Tax & Statutory Statement',
    formTitleAr: 'بيان الضرائب والامتثال الصحي - الهيئة العامة للضرائب قطر',
    formDescriptionEn:
      'Statutory MoPH healthcare zero-rate compliance and GTA outbound audit statement in QAR.',
    formDescriptionAr:
      'تقرير الامتثال الصيدلاني لوزارة الصحة العامة وهيئة الضرائب القطرية بالريال القطري.',
    reportTabLabelEn: 'GTA Tax Statement',
    reportTabLabelAr: 'بيان الضرائب (GTA)',
    csvDownloadLabelEn: 'Download GTA Tax CSV',
    csvDownloadLabelAr: 'تحميل بيان GTA CSV',
    jsonDownloadLabelEn: 'Export GTA Audit JSON',
    jsonDownloadLabelAr: 'تصدير سجل التدقيق JSON',
    box1LabelEn: 'Clinical Healthcare & Pharmacy Supplies (0%)',
    box1LabelAr: 'التوريدات الصيدلانية والصحية المعتمدة (0%)',
    box2LabelEn: 'Specialized Prescription Formulations (0%)',
    box2LabelAr: 'التركيبات والوصفات الطبية الخاصة (0%)',
    box3LabelEn: 'Exempt Healthcare Services',
    box3LabelAr: 'الخدمات الصحية المعفاة',
    box4LabelEn: 'Total Clinical Outward Supplies',
    box4LabelAr: 'إجمالي التوريدات الصيدلانية الإكلينيكية',
    box5LabelEn: 'Standard Procurements & Import Records',
    box5LabelAr: 'سجلات المشتريات والتوريدات',
    box6LabelEn: 'Net Statutory Tax Liability (0.00 QAR)',
    box6LabelAr: 'صافي الالتزام الضريبي القانوني (0.00 ر.ق)',
  },

  MV: {
    territoryCode: 'MV',
    regime: 'MIRA_GGST',
    authorityNameEn: 'Maldives Inland Revenue Authority (MIRA)',
    authorityNameAr: 'هيئة الإيرادات الداخلية للمالديف',
    vatIdLabelEn: 'TIN / Business Registration No.',
    vatIdLabelAr: 'رقم السجل التجاري والضريبي',
    standardRate: 8.0,
    zeroRatedMedicines: false,
    currency: 'MVR',
    decimals: 2,
    formCode: 'MIRA Form 205',
    formTitleEn: 'MIRA Form 205 — General Goods and Services Tax (GGST) Return',
    formTitleAr: 'إقرار ضريبة السلع والخدمات العامة (MIRA 205)',
    formDescriptionEn:
      'Maldives MIRA GGST (8%), statutory prescription sales, Aasandha health insurance co-pay tax deductions in MVR.',
    formDescriptionAr:
      'إقرار ضريبة السلع والخدمات (8%) لهيئة الإيرادات المالديفية، مبيعات الوصفات الطبية، وخصومات التأمين الصحي أسندا بالروفية المالديفية.',
    reportTabLabelEn: 'MIRA 205 GST Return',
    reportTabLabelAr: 'إقرار MIRA 205',
    csvDownloadLabelEn: 'Download MIRA 205 CSV',
    csvDownloadLabelAr: 'تحميل إقرار MIRA 205 CSV',
    jsonDownloadLabelEn: 'Export MIRA 205 JSON',
    jsonDownloadLabelAr: 'تصدير إقرار MIRA 205 JSON',
    box1LabelEn: 'Standard Supplies Subject to GGST (8%)',
    box1LabelAr: 'التوريدات الخاضعة لضريبة GGST (8%)',
    box2LabelEn: 'Aasandha & Zero-Rated Prescription Co-pays',
    box2LabelAr: 'الوصفات الطبية والمشاركات الخاضعة لنسبة الصفر أو التأمين',
    box3LabelEn: 'Exempt Supplies',
    box3LabelAr: 'التوريدات المعفاة',
    box4LabelEn: 'Total Supplies & Output GGST',
    box4LabelAr: 'إجمالي التوريدات وضريبة GGST للمخرجات',
    box5LabelEn: 'Procurement Input Tax Deductions',
    box5LabelAr: 'خصومات ضريبة المدخلات على المشتريات',
    box6LabelEn: 'Net GGST Payable to MIRA',
    box6LabelAr: 'صافي ضريبة GGST المستحقة لهيئة الإيرادات المالديفية',
  },

  IN: {
    territoryCode: 'IN',
    regime: 'GST',
    authorityNameEn: 'Goods and Services Tax Network (GSTN)',
    authorityNameAr: 'شبكة ضريبة السلع والخدمات (الهند)',
    vatIdLabelEn: 'GSTIN',
    vatIdLabelAr: 'رقم تعريف ضريبة السلع والخدمات (GSTIN)',
    standardRate: 12.0,
    zeroRatedMedicines: false,
    currency: 'INR',
    decimals: 2,
    formCode: 'GSTR-1 / GSTR-3B',
    formTitleEn: 'GSTR-1 GST Portal & TallyPrime Ready',
    formTitleAr: 'تقرير GSTR-1 لبوابة الضرائب الهندية وتالي برايم',
    formDescriptionEn:
      'Outward supplies categorized by Table 4 (B2B registered), Table 7 (B2C consumers), and Table 12 (HSN summary).',
    formDescriptionAr:
      'التوريدات الخارجية مصنفة حسب الجدول 4 (مبيعات الشركات B2B)، والجدول 7 (مبيعات الأفراد B2C)، والجدول 12 (ملخص أكواد HSN).',
    reportTabLabelEn: 'GSTR-1 Reports',
    reportTabLabelAr: 'تقارير GSTR-1',
    csvDownloadLabelEn: 'Download GSTR-1 CSV',
    csvDownloadLabelAr: 'تحميل GSTR-1 CSV',
    jsonDownloadLabelEn: 'Export Offline JSON',
    jsonDownloadLabelAr: 'تصدير JSON أوفلاين',
    box1LabelEn: 'Table 4: B2B Invoices (Registered)',
    box1LabelAr: 'الجدول 4: فواتير B2B المسجلة',
    box2LabelEn: 'Table 7: B2C Invoices (Consumers)',
    box2LabelAr: 'الجدول 7: فواتير المستهلكين B2C',
    box3LabelEn: 'Table 12: HSN Summary',
    box3LabelAr: 'الجدول 12: ملخص أكواد HSN',
    box4LabelEn: 'Total Taxable & Output GST',
    box4LabelAr: 'إجمالي القيمة الخاضعة وضريبة GST',
    box5LabelEn: 'Inward Purchases & Input Tax Credit (ITC)',
    box5LabelAr: 'المشتريات ورصيد ضريبة المدخلات (ITC)',
    box6LabelEn: 'Net GST Liability',
    box6LabelAr: 'صافي الالتزام الضريبي GST',
  },
}

export function getTerritoryTaxProfile(territoryCode?: string | null): SovereignTaxProfile {
  const code = (territoryCode?.toUpperCase() || 'SA') as TerritoryCode
  return SOVEREIGN_TAX_PROFILES[code] || SOVEREIGN_TAX_PROFILES.SA
}

export interface SovereignTaxBreakdown {
  profile: SovereignTaxProfile
  period: { startDate?: string; endDate?: string }
  totalInvoices: number
  totalGrossSales: number
  box1StandardTaxable: number
  box1StandardTax: number
  box2ZeroRatedTaxable: number
  box2ZeroRatedTax: number
  box3ExemptTaxable: number
  box3ExemptTax: number
  totalOutputTax: number
  purchasesCount: number
  box5PurchasesTaxable: number
  box5InputTax: number
  netTaxPayable: number
  invoices: {
    invoiceNumber: string
    date: string
    customerName: string
    customerTaxId: string
    isB2b: boolean
    grossAmount: number
    taxableAmount: number
    taxRate: number
    taxAmount: number
    isZeroRated: boolean
  }[]
}

/**
 * Computes sovereign statutory tax breakdown from sales and purchases.
 */
export function processSovereignTaxData(
  sales: SaleForTally[],
  purchases: PurchaseForTally[] = [],
  territoryCode?: string | null
): SovereignTaxBreakdown {
  const profile = getTerritoryTaxProfile(territoryCode)
  const isZeroRateMedicineCountry = profile.zeroRatedMedicines

  let totalInvoices = 0
  let totalGrossSales = 0
  let box1StandardTaxable = 0
  let box1StandardTax = 0
  let box2ZeroRatedTaxable = 0
  let box2ZeroRatedTax = 0
  let box3ExemptTaxable = 0
  let box3ExemptTax = 0
  let totalOutputTax = 0

  const invoicesBreakdown: SovereignTaxBreakdown['invoices'] = []

  for (const sale of sales) {
    totalInvoices++
    const gross = Number(sale.totalAmount || 0)
    totalGrossSales += gross

    let saleTaxable = 0
    let saleTax = 0
    let hasTaxableItem = false
    let hasZeroRatedItem = false

    for (const item of sale.items || []) {
      const itemTotal = Number(item.totalAmount || 0)
      const itemTax = Number(item.taxAmount || 0)
      const taxable = itemTotal - itemTax
      saleTaxable += taxable
      saleTax += itemTax

      // In GCC countries (OM, SA, BH), human prescription drugs are 0% zero-rated.
      // If itemTax == 0 and country supports zero-rated medicines:
      if (itemTax === 0 && isZeroRateMedicineCountry) {
        hasZeroRatedItem = true
        box2ZeroRatedTaxable += taxable
      } else {
        hasTaxableItem = true
        box1StandardTaxable += taxable
        box1StandardTax += itemTax
      }
    }

    totalOutputTax += saleTax

    const isB2b = Boolean(sale.customer?.gstin && sale.customer.gstin.trim().length > 4)
    const saleDateObj = typeof sale.saleDate === 'string' ? new Date(sale.saleDate) : sale.saleDate

    invoicesBreakdown.push({
      invoiceNumber: sale.invoiceNumber,
      date: format(saleDateObj, 'yyyy-MM-dd'),
      customerName: sale.customer?.name || 'Walk-in Consumer',
      customerTaxId: sale.customer?.gstin || 'N/A',
      isB2b,
      grossAmount: gross,
      taxableAmount: saleTaxable,
      taxRate: saleTaxable > 0 ? Number(((saleTax / saleTaxable) * 100).toFixed(1)) : 0,
      taxAmount: saleTax,
      isZeroRated: !hasTaxableItem && hasZeroRatedItem,
    })
  }

  // Purchases / Input Tax
  let purchasesCount = 0
  let box5PurchasesTaxable = 0
  let box5InputTax = 0

  for (const purchase of purchases) {
    purchasesCount++
    const gross = Number(purchase.totalAmount || 0)
    const tax = Number(purchase.taxAmount || 0)
    const taxable = gross - tax
    box5PurchasesTaxable += taxable
    box5InputTax += tax
  }

  const netTaxPayable = Number((totalOutputTax - box5InputTax).toFixed(profile.decimals))

  return {
    profile,
    period: {},
    totalInvoices,
    totalGrossSales: Number(totalGrossSales.toFixed(profile.decimals)),
    box1StandardTaxable: Number(box1StandardTaxable.toFixed(profile.decimals)),
    box1StandardTax: Number(box1StandardTax.toFixed(profile.decimals)),
    box2ZeroRatedTaxable: Number(box2ZeroRatedTaxable.toFixed(profile.decimals)),
    box2ZeroRatedTax: 0,
    box3ExemptTaxable: 0,
    box3ExemptTax: 0,
    totalOutputTax: Number(totalOutputTax.toFixed(profile.decimals)),
    purchasesCount,
    box5PurchasesTaxable: Number(box5PurchasesTaxable.toFixed(profile.decimals)),
    box5InputTax: Number(box5InputTax.toFixed(profile.decimals)),
    netTaxPayable,
    invoices: invoicesBreakdown,
  }
}

/**
 * Generate official CSV file according to sovereign territory standards.
 */
export function generateSovereignTaxCsv(
  data: SovereignTaxBreakdown,
  options?: { startDate?: string; endDate?: string }
): string {
  const { profile } = data
  const d = profile.decimals
  const dateSuffix = format(new Date(), 'dd-MMM-yyyy HH:mm')

  const rows: string[] = []
  rows.push(`# ─────────────────────────────────────────────────────────────────────────────`)
  rows.push(`# ${profile.authorityNameEn} — ${profile.formTitleEn}`)
  rows.push(`# Sovereign Territory: ${profile.territoryCode} | Currency: ${profile.currency} (${d} Decimals)`)
  rows.push(`# Reporting Period: ${options?.startDate || 'All-Time'} to ${options?.endDate || 'Latest'}`)
  rows.push(`# Exported On: ${dateSuffix}`)
  rows.push(`# ─────────────────────────────────────────────────────────────────────────────`)
  rows.push('')

  // 1. STATUTORY SUMMARY BOXES
  rows.push(`# ─── PART 1: STATUTORY RETURN BOXES ──────────────────────────────────────────`)
  rows.push('Box / Schedule,Description,Taxable Value (' + profile.currency + '),Tax Rate %,Tax Amount (' + profile.currency + ')')
  rows.push(
    `"${profile.box1LabelEn}","Standard supplies subject to statutory rate",${data.box1StandardTaxable.toFixed(d)},${profile.standardRate.toFixed(1)}%,${data.box1StandardTax.toFixed(d)}`
  )
  rows.push(
    `"${profile.box2LabelEn}","Registered pharmaceuticals & essential health items",${data.box2ZeroRatedTaxable.toFixed(d)},0.0%,0.000`
  )
  rows.push(`"${profile.box3LabelEn}","Exempt health services and consultations",0.000,0.0%,0.000`)
  rows.push(
    `"${profile.box4LabelEn}","Total taxable supplies & output tax liability",${(data.box1StandardTaxable + data.box2ZeroRatedTaxable).toFixed(d)},-,${data.totalOutputTax.toFixed(d)}`
  )
  rows.push(
    `"${profile.box5LabelEn}","Taxable purchases & recoverable input tax",${data.box5PurchasesTaxable.toFixed(d)},${profile.standardRate.toFixed(1)}%,${data.box5InputTax.toFixed(d)}`
  )
  rows.push(
    `"${profile.box6LabelEn}","Net statutory liability payable/(refundable) to authority",-,-,${data.netTaxPayable.toFixed(d)}`
  )
  rows.push('')

  // 2. DETAILED INVOICE AUDIT REGISTER
  rows.push(`# ─── PART 2: DETAILED TAX INVOICE AUDIT REGISTER ────────────────────────────`)
  rows.push(
    'Invoice Number,Invoice Date,Customer Name,Customer Tax ID,Supply Type,Gross Amount (' +
      profile.currency +
      '),Net Taxable (' +
      profile.currency +
      '),Tax Rate %,Tax Amount (' +
      profile.currency +
      ')'
  )

  for (const inv of data.invoices) {
    const supplyType = inv.isZeroRated
      ? '0% Zero-Rated Medicine'
      : inv.isB2b
        ? 'B2B Commercial Supply'
        : 'B2C Retail Supply'

    rows.push(
      `"${inv.invoiceNumber}","${inv.date}","${inv.customerName.replace(/"/g, '""')}","${inv.customerTaxId}","${supplyType}",${inv.grossAmount.toFixed(d)},${inv.taxableAmount.toFixed(d)},${inv.taxRate.toFixed(1)}%,${inv.taxAmount.toFixed(d)}`
    )
  }

  return rows.join('\r\n')
}

/**
 * Generate official JSON audit file according to sovereign territory standards.
 */
export function generateSovereignTaxJson(
  data: SovereignTaxBreakdown,
  options?: { startDate?: string; endDate?: string }
): string {
  const { profile } = data

  const payload = {
    metadata: {
      regime: profile.regime,
      territory: profile.territoryCode,
      authority: profile.authorityNameEn,
      authorityArabic: profile.authorityNameAr,
      formCode: profile.formCode,
      currency: profile.currency,
      decimals: profile.decimals,
      reportingPeriod: {
        startDate: options?.startDate || null,
        endDate: options?.endDate || null,
      },
      exportedAt: new Date().toISOString(),
      generator: 'Metapharsic Rx Sovereign Tax Compliance Engine v2.4',
    },
    statutoryReturnSummary: {
      totalInvoices: data.totalInvoices,
      totalGrossSales: data.totalGrossSales,
      box1StandardRatedTaxable: data.box1StandardTaxable,
      box1StandardRatedTax: data.box1StandardTax,
      box2ZeroRatedMedicinesTaxable: data.box2ZeroRatedTaxable,
      box2ZeroRatedMedicinesTax: 0,
      box3ExemptTaxable: 0,
      box4TotalOutputTax: data.totalOutputTax,
      box5PurchasesTaxable: data.box5PurchasesTaxable,
      box5InputTaxRecoverable: data.box5InputTax,
      box6NetTaxPayable: data.netTaxPayable,
    },
    taxInvoiceRegister: data.invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.date,
      customerName: inv.customerName,
      customerTaxId: inv.customerTaxId,
      classification: inv.isZeroRated ? 'ZERO_RATED_HEALTHCARE' : inv.isB2b ? 'B2B_REGISTERED' : 'B2C_RETAIL',
      grossAmount: inv.grossAmount,
      taxableAmount: inv.taxableAmount,
      taxRatePercent: inv.taxRate,
      taxAmount: inv.taxAmount,
    })),
  }

  return JSON.stringify(payload, null, 2)
}
