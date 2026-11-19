/**
 * Metapharsic Rx — Sovereign Tenant & Geopolitical User Provisioner
 * Orchestrates the complete 5-Phase Provisioning Pipeline:
 *
 * - PHASE 1: Sovereign Drug Formulation Master (Bilingual Arabic/English, SFDA/CDSCO/MIRA classification)
 * - PHASE 2: In-Country Batches, Expiry Tracking & Inventory Lifecycle (Active stock, Rack allocation)
 * - PHASE 3: Sovereign Geopolitical Tax, Currency & Clearance Engine (ZATCA Phase 2 / ODP / NHRA / GST)
 * - PHASE 4: Role-Based IAM, Pharmacist Prescriptions & Sovereign Territory Matrix (Owner, Pharmacist, Cashier)
 * - PHASE 5: Dedicated Private Cloud Topology, HSM Key & Telemetry Binding (VPC Pod, DB Pool, 100% In-Country)
 */

import prisma from '@/lib/db/prisma'
import { TerritoryCode, TERRITORIES } from '@/lib/territory/territory-config'
import { getSovereignCloudTopology } from '@/lib/cloud/sovereign-cloud-topology'

export interface SovereignProvisioningOptions {
  organizationId: string
  branchId: string
  adminUserId: string
  territoryCode: TerritoryCode
  geoZoneName: string
  storeCode: string
  storeName: string
  privateCloudVpcId?: string
}

export interface SovereignProvisioningReport {
  success: boolean
  organizationId: string
  territoryCode: TerritoryCode
  phase1ProductsCreated: number
  phase2BatchesCreated: number
  phase3TaxRegime: string
  phase4UsersGoverned: number
  phase5VpcPod: string
  dataResidencyLaw: string
  timestamp: string
}

// Sovereign clinical medication templates by jurisdiction
const SOVEREIGN_DRUG_TEMPLATES: Record<
  'ARABIC_GCC' | 'INDIA_MALDIVES',
  Array<{
    name: string
    nameAr: string
    genericName: string
    genericNameAr: string
    dosageForm: string
    skuSuffix: string
    barcode: string
    mrpSar: number
    ptrSar: number
    mrpInr: number
    ptrInr: number
    category: 'Tablets' | 'Capsules' | 'Syrups' | 'Inhalers' | 'Antibiotics'
    isPrescription: boolean
    schedule: 'NONE' | 'H' | 'X'
    vatRate: number
  }>
> = {
  ARABIC_GCC: [
    {
      name: 'Amoxicillin 500mg Capsules',
      nameAr: 'أموكسيسيلين 500 ملغ كبسولات',
      genericName: 'Amoxicillin Trihydrate',
      genericNameAr: 'أموكسيسيلين ثلاثي الهيدرات',
      dosageForm: 'Capsule',
      skuSuffix: 'AMX-500',
      barcode: '6281001230011',
      mrpSar: 38.5,
      ptrSar: 29.0,
      mrpInr: 120.0,
      ptrInr: 90.0,
      category: 'Antibiotics',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Augmentin 1g Tablets',
      nameAr: 'أوجمنتين 1 غرام أقراص',
      genericName: 'Amoxicillin + Clavulanic Acid',
      genericNameAr: 'أموكسيسيلين وحمض الكلافولانيك',
      dosageForm: 'Tablet',
      skuSuffix: 'AUG-1000',
      barcode: '6281001230028',
      mrpSar: 72.0,
      ptrSar: 55.0,
      mrpInr: 220.0,
      ptrInr: 170.0,
      category: 'Antibiotics',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Panadol Extra 500mg/65mg Tablets',
      nameAr: 'بانادول إكسترا 500 ملغ أقراص',
      genericName: 'Paracetamol + Caffeine',
      genericNameAr: 'باراسيتامول وكافيين',
      dosageForm: 'Tablet',
      skuSuffix: 'PAN-EXT',
      barcode: '6281001230035',
      mrpSar: 16.5,
      ptrSar: 12.0,
      mrpInr: 45.0,
      ptrInr: 35.0,
      category: 'Tablets',
      isPrescription: false,
      schedule: 'NONE',
      vatRate: 15.0,
    },
    {
      name: 'Paracetamol 500mg Tablets',
      nameAr: 'باراسيتامول 500 ملغ أقراص',
      genericName: 'Paracetamol',
      genericNameAr: 'باراسيتامول',
      dosageForm: 'Tablet',
      skuSuffix: 'PCM-500',
      barcode: '6281001230042',
      mrpSar: 11.0,
      ptrSar: 8.0,
      mrpInr: 25.0,
      ptrInr: 18.0,
      category: 'Tablets',
      isPrescription: false,
      schedule: 'NONE',
      vatRate: 15.0,
    },
    {
      name: 'Lipitor 20mg Tablets',
      nameAr: 'ليبيتور 20 ملغ أقراص',
      genericName: 'Atorvastatin Calcium',
      genericNameAr: 'أتورفاستاتين الكالسيوم',
      dosageForm: 'Tablet',
      skuSuffix: 'LIP-020',
      barcode: '6281001230059',
      mrpSar: 89.0,
      ptrSar: 70.0,
      mrpInr: 280.0,
      ptrInr: 215.0,
      category: 'Tablets',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Omeprazole 20mg Capsules',
      nameAr: 'أوميبرازول 20 ملغ كبسولات',
      genericName: 'Omeprazole',
      genericNameAr: 'أوميبرازول',
      dosageForm: 'Capsule',
      skuSuffix: 'OMP-020',
      barcode: '6281001230066',
      mrpSar: 34.0,
      ptrSar: 26.0,
      mrpInr: 95.0,
      ptrInr: 72.0,
      category: 'Capsules',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Ventolin Inhaler 100mcg',
      nameAr: 'بخاخ فنتولين 100 ميكروغرام',
      genericName: 'Salbutamol Sulphate',
      genericNameAr: 'كبريتات السالبوتامول',
      dosageForm: 'Inhaler',
      skuSuffix: 'VEN-100',
      barcode: '6281001230073',
      mrpSar: 27.5,
      ptrSar: 21.0,
      mrpInr: 165.0,
      ptrInr: 125.0,
      category: 'Inhalers',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Glucophage 500mg Tablets',
      nameAr: 'جلوكوفاج 500 ملغ أقراص',
      genericName: 'Metformin Hydrochloride',
      genericNameAr: 'ميتفورمين هيدروكلوريد',
      dosageForm: 'Tablet',
      skuSuffix: 'GLU-500',
      barcode: '6281001230080',
      mrpSar: 22.0,
      ptrSar: 17.0,
      mrpInr: 65.0,
      ptrInr: 48.0,
      category: 'Tablets',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Concor 5mg Tablets',
      nameAr: 'كونكور 5 ملغ أقراص',
      genericName: 'Bisoprolol Fumarate',
      genericNameAr: 'بيسوبرولول فومارات',
      dosageForm: 'Tablet',
      skuSuffix: 'CNC-005',
      barcode: '6281001230097',
      mrpSar: 31.5,
      ptrSar: 24.0,
      mrpInr: 140.0,
      ptrInr: 105.0,
      category: 'Tablets',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Azithromycin 500mg Tablets',
      nameAr: 'أزيثرومايسين 500 ملغ أقراص',
      genericName: 'Azithromycin Dihydrate',
      genericNameAr: 'أزيثرومايسين ثنائي الهيدرات',
      dosageForm: 'Tablet',
      skuSuffix: 'AZT-500',
      barcode: '6281001230103',
      mrpSar: 42.0,
      ptrSar: 32.0,
      mrpInr: 135.0,
      ptrInr: 102.0,
      category: 'Antibiotics',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Cataflam 50mg Tablets',
      nameAr: 'كاتافلام 50 ملغ أقراص',
      genericName: 'Diclofenac Potassium',
      genericNameAr: 'ديكلوفيناك البوتاسيوم',
      dosageForm: 'Tablet',
      skuSuffix: 'CAT-050',
      barcode: '6281001230110',
      mrpSar: 28.0,
      ptrSar: 22.0,
      mrpInr: 85.0,
      ptrInr: 64.0,
      category: 'Tablets',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
    {
      name: 'Brufen 400mg Tablets',
      nameAr: 'بروفين 400 ملغ أقراص',
      genericName: 'Ibuprofen',
      genericNameAr: 'إيبوبروفين',
      dosageForm: 'Tablet',
      skuSuffix: 'BRU-400',
      barcode: '6281001230127',
      mrpSar: 18.5,
      ptrSar: 14.0,
      mrpInr: 40.0,
      ptrInr: 30.0,
      category: 'Tablets',
      isPrescription: false,
      schedule: 'NONE',
      vatRate: 15.0,
    },
    {
      name: 'Voltaren Emulgel 50g',
      nameAr: 'فولتارين إيمولجل 50 غرام',
      genericName: 'Diclofenac Diethylamine',
      genericNameAr: 'ديكلوفيناك ثنائي إيثيل أمين',
      dosageForm: 'Gel',
      skuSuffix: 'VOL-GEL',
      barcode: '6281001230134',
      mrpSar: 26.0,
      ptrSar: 20.0,
      mrpInr: 145.0,
      ptrInr: 110.0,
      category: 'Tablets',
      isPrescription: false,
      schedule: 'NONE',
      vatRate: 15.0,
    },
    {
      name: 'Septazole Suspension 100ml',
      nameAr: 'سيبتازول شراب معلق 100 مل',
      genericName: 'Trimethoprim + Sulfamethoxazole',
      genericNameAr: 'تريميثوبريم وسلفاميثوكسازول',
      dosageForm: 'Syrup',
      skuSuffix: 'SEP-SUS',
      barcode: '6281001230141',
      mrpSar: 15.0,
      ptrSar: 11.5,
      mrpInr: 55.0,
      ptrInr: 41.0,
      category: 'Syrups',
      isPrescription: true,
      schedule: 'H',
      vatRate: 0.0,
    },
  ],
  INDIA_MALDIVES: [
    {
      name: 'Dolo 650 Tablets',
      nameAr: 'دولو 650 أقراص',
      genericName: 'Paracetamol 650mg',
      genericNameAr: 'باراسيتامول 650 ملغ',
      dosageForm: 'Tablet',
      skuSuffix: 'DOLO-650',
      barcode: '8901234500018',
      mrpSar: 12.0,
      ptrSar: 9.0,
      mrpInr: 34.0,
      ptrInr: 26.0,
      category: 'Tablets',
      isPrescription: false,
      schedule: 'NONE',
      vatRate: 12.0,
    },
    {
      name: 'Augmentin 625 Duo Tablets',
      nameAr: 'أوجمنتين 625 ثنائي أقراص',
      genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
      genericNameAr: 'أموكسيسيلين وحمض الكلافولانيك',
      dosageForm: 'Tablet',
      skuSuffix: 'AUG-625',
      barcode: '8901234500025',
      mrpSar: 65.0,
      ptrSar: 50.0,
      mrpInr: 205.0,
      ptrInr: 158.0,
      category: 'Antibiotics',
      isPrescription: true,
      schedule: 'H',
      vatRate: 12.0,
    },
    {
      name: 'Pan-D Capsules',
      nameAr: 'بان-دي كبسولات',
      genericName: 'Pantoprazole 40mg + Domperidone 30mg',
      genericNameAr: 'بانتوبرازول ودومبيريدون',
      dosageForm: 'Capsule',
      skuSuffix: 'PAN-D',
      barcode: '8901234500032',
      mrpSar: 45.0,
      ptrSar: 35.0,
      mrpInr: 145.0,
      ptrInr: 110.0,
      category: 'Capsules',
      isPrescription: true,
      schedule: 'H',
      vatRate: 12.0,
    },
    {
      name: 'Azithral 500mg Tablets',
      nameAr: 'أزيثرومايسين 500 ملغ',
      genericName: 'Azithromycin 500mg',
      genericNameAr: 'أزيثرومايسين',
      dosageForm: 'Tablet',
      skuSuffix: 'AZI-500',
      barcode: '8901234500049',
      mrpSar: 42.0,
      ptrSar: 32.0,
      mrpInr: 132.0,
      ptrInr: 98.0,
      category: 'Antibiotics',
      isPrescription: true,
      schedule: 'H',
      vatRate: 12.0,
    },
    {
      name: 'Glycomet 500mg Tablets',
      nameAr: 'جلايكوميت 500 ملغ أقراص',
      genericName: 'Metformin Hydrochloride 500mg',
      genericNameAr: 'ميتفورمين',
      dosageForm: 'Tablet',
      skuSuffix: 'GLY-500',
      barcode: '8901234500056',
      mrpSar: 18.0,
      ptrSar: 14.0,
      mrpInr: 45.0,
      ptrInr: 33.0,
      category: 'Tablets',
      isPrescription: true,
      schedule: 'H',
      vatRate: 12.0,
    },
    {
      name: 'Asthalin Inhaler 100mcg',
      nameAr: 'بخاخ أستالين 100 ميكروغرام',
      genericName: 'Salbutamol Inhaler',
      genericNameAr: 'سالبوتامول بخاخ',
      dosageForm: 'Inhaler',
      skuSuffix: 'AST-100',
      barcode: '8901234500063',
      mrpSar: 25.0,
      ptrSar: 19.0,
      mrpInr: 155.0,
      ptrInr: 118.0,
      category: 'Inhalers',
      isPrescription: true,
      schedule: 'H',
      vatRate: 12.0,
    },
  ],
}

/**
 * Resolves territory code from zone or explicit choice
 */
export function resolveTerritoryFromZone(zone: string): TerritoryCode {
  const z = zone.toLowerCase()
  if (z.includes('ksa') || z.includes('riyadh') || z.includes('jeddah') || z.includes('dammam') || z.includes('saudi')) {
    return 'SA'
  }
  if (z.includes('oman') || z.includes('muscat') || z.includes('dhofar')) {
    return 'OM'
  }
  if (z.includes('bahrain') || z.includes('manama')) {
    return 'BH'
  }
  if (z.includes('qatar') || z.includes('doha')) {
    return 'QA'
  }
  if (z.includes('maldives') || z.includes('male') || z.includes('malé')) {
    return 'MV'
  }
  return 'IN'
}

/**
 * Executes the complete 5-Phase Sovereign Provisioning Pipeline
 */
export async function provisionSovereignTenant(
  opts: SovereignProvisioningOptions
): Promise<SovereignProvisioningReport> {
  const { organizationId, branchId, adminUserId, territoryCode, geoZoneName, storeCode, storeName, privateCloudVpcId } = opts
  const terr = TERRITORIES[territoryCode] || TERRITORIES.SA
  const topology = getSovereignCloudTopology(territoryCode)

  // ─────────────────────────────────────────────────────────────
  // PHASE 3 (FIRST): SOVEREIGN GEOPOLITICAL TAX, CURRENCY & TIMEZONE
  // ─────────────────────────────────────────────────────────────
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      country: terr.nameEn,
      currency: terr.currency.code,
      timezone: terr.timezone,
    },
  })

  // Branch sovereign alignment
  await prisma.branch.update({
    where: { id: branchId },
    data: {
      state: geoZoneName,
    },
  })

  // Provision Sovereign Racks (Idempotent upsert)
  const rackA = await prisma.rack.upsert({
    where: {
      branchId_code_shelfNumber: {
        branchId,
        code: `${storeCode}-RA`,
        shelfNumber: 'Rack A-01',
      },
    },
    create: {
      branchId,
      code: `${storeCode}-RA`,
      shelfNumber: 'Rack A-01',
      description: 'Oral Solid Formulations & Essential Medicines (أقراص عامة)',
    },
    update: {
      description: 'Oral Solid Formulations & Essential Medicines (أقراص عامة)',
    },
  })

  const rackB = await prisma.rack.upsert({
    where: {
      branchId_code_shelfNumber: {
        branchId,
        code: `${storeCode}-RB`,
        shelfNumber: 'Rack B-01',
      },
    },
    create: {
      branchId,
      code: `${storeCode}-RB`,
      shelfNumber: 'Rack B-01',
      description: 'Antibiotics & Critical Prescription Care (مضادات حيوية)',
    },
    update: {
      description: 'Antibiotics & Critical Prescription Care (مضادات حيوية)',
    },
  })

  const rackCold = await prisma.rack.upsert({
    where: {
      branchId_code_shelfNumber: {
        branchId,
        code: `${storeCode}-RC`,
        shelfNumber: 'Cold Storage 01',
      },
    },
    create: {
      branchId,
      code: `${storeCode}-RC`,
      shelfNumber: 'Cold Storage 01',
      description: 'Biologicals, Vaccines & Insulin 2-8°C (ثلاجة الأدوية)',
    },
    update: {
      description: 'Biologicals, Vaccines & Insulin 2-8°C (ثلاجة الأدوية)',
    },
  })

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: SOVEREIGN MEDICINE CATALOG (BILINGUAL ARABIC/ENGLISH)
  // ─────────────────────────────────────────────────────────────
  const isGcc = ['SA', 'OM', 'BH', 'QA'].includes(territoryCode)
  const drugTemplates = isGcc ? SOVEREIGN_DRUG_TEMPLATES.ARABIC_GCC : SOVEREIGN_DRUG_TEMPLATES.INDIA_MALDIVES

  const createdProducts: Array<{ id: string; category: string; mrp: number; ptr: number }> = []

  for (const drug of drugTemplates) {
    const isArabicTerritory = isGcc
    const finalMrp = isArabicTerritory ? drug.mrpSar : drug.mrpInr
    const finalPtr = isArabicTerritory ? drug.ptrSar : drug.ptrInr
    const finalCost = finalPtr * 0.85

    const sku = `${storeCode}-${drug.skuSuffix}`
    const assignedRack = drug.category === 'Antibiotics' ? rackB.id : drug.category === 'Inhalers' ? rackCold.id : rackA.id

    const existingProduct = await prisma.product.findFirst({
      where: {
        organizationId,
        OR: [{ barcode: drug.barcode }, { sku }, { name: drug.name }],
      },
    })

    let product
    if (existingProduct) {
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          nameAr: drug.nameAr,
          genericNameAr: drug.genericNameAr,
          mrp: finalMrp,
          ptr: finalPtr,
          costPrice: finalCost,
          gstRate: drug.vatRate,
          cgstRate: drug.vatRate / 2,
          sgstRate: drug.vatRate / 2,
          igstRate: drug.vatRate,
          isGstExempt: drug.vatRate === 0,
          rackId: assignedRack,
        },
      })
    } else {
      product = await prisma.product.create({
        data: {
          organizationId,
          name: drug.name,
          nameAr: drug.nameAr,
          genericName: drug.genericName,
          genericNameAr: drug.genericNameAr,
          sku,
          barcode: drug.barcode,
          manufacturer: isArabicTerritory ? 'SPIMACO / Tabuk Pharmaceuticals' : 'Sun Pharma / Cipla Ltd',
          composition: `${drug.genericName} (${drug.genericNameAr})`,
          drugSchedule: drug.schedule,
          isPrescriptionRequired: drug.isPrescription,
          unitOfMeasure: 'Strip',
          tabsPerStrip: 10,
          hsnCode: '3004',
          gstRate: drug.vatRate,
          cgstRate: drug.vatRate / 2,
          sgstRate: drug.vatRate / 2,
          igstRate: drug.vatRate,
          isGstExempt: drug.vatRate === 0,
          mrp: finalMrp,
          ptr: finalPtr,
          costPrice: finalCost,
          rackId: assignedRack,
          minStockLevel: 20,
          reorderLevel: 50,
          createdById: adminUserId,
        },
      })
    }

    createdProducts.push({
      id: product.id,
      category: drug.category,
      mrp: finalMrp,
      ptr: finalPtr,
    })
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: IN-COUNTRY BATCHES, EXPIRY TRACKING & INVENTORY
  // ─────────────────────────────────────────────────────────────
  let batchesCount = 0
  const now = new Date()

  for (let i = 0; i < createdProducts.length; i++) {
    const prod = createdProducts[i]
    const batchNum = `${territoryCode}-2026-B${101 + i}`
    const mfgDate = new Date(now.getTime() - (90 + i * 10) * 24 * 60 * 60 * 1000)
    const expDate = new Date(now.getTime() + (720 + i * 15) * 24 * 60 * 60 * 1000) // ~2 years out
    const batchQty = 150 + (i % 5) * 25 // 150 - 250 units

    await prisma.batch.upsert({
      where: {
        productId_batchNumber: {
          productId: prod.id,
          batchNumber: batchNum,
        },
      },
      create: {
        productId: prod.id,
        batchNumber: batchNum,
        manufacturingDate: mfgDate,
        expiryDate: expDate,
        purchasePrice: prod.ptr,
        ptr: prod.ptr,
        mrp: prod.mrp,
        quantity: batchQty,
        status: 'ACTIVE',
        branchId,
      },
      update: {
        quantity: batchQty,
        expiryDate: expDate,
        status: 'ACTIVE',
        mrp: prod.mrp,
        ptr: prod.ptr,
        branchId,
      },
    })

    // Synchronize available quantity in inventory table
    await prisma.inventory.upsert({
      where: {
        productId_branchId: {
          productId: prod.id,
          branchId,
        },
      },
      create: {
        productId: prod.id,
        branchId,
        totalQuantity: batchQty,
        availableQuantity: batchQty,
      },
      update: {
        totalQuantity: batchQty,
        availableQuantity: batchQty,
      },
    })

    batchesCount++
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 3 (SETTINGS): TAX REGIME & SOVEREIGN CLEARANCE GATES
  // ─────────────────────────────────────────────────────────────
  const taxRegimeName = terr.tax.regime
  const sovereignSettings: Record<string, string> = {
    GEO_ZONE: geoZoneName,
    SOVEREIGN_TERRITORY: territoryCode,
    SOVEREIGN_CURRENCY: terr.currency.code,
    CURRENCY_SYMBOL_EN: terr.currency.symbolEn,
    CURRENCY_SYMBOL_AR: terr.currency.symbolAr,
    TAX_REGIME: taxRegimeName,
    STANDARD_VAT_RATE: String(terr.tax.standardVatRate),
    ZERO_RATED_MEDICINES: terr.tax.zeroRatedMedicines ? 'true' : 'false',
    TAX_AUTHORITY_NAME_EN: terr.tax.taxAuthorityNameEn,
    TAX_AUTHORITY_NAME_AR: terr.tax.taxAuthorityNameAr,
    QR_STANDARD: terr.tax.qrStandard,
    ZATCA_SIMULATION_ENABLED: territoryCode === 'SA' ? 'true' : 'false',
    INVOICE_CLEARANCE_STANDARD: 'STRICT_SOVEREIGN_PREFLIGHT',
    THERMAL_PAPER_WIDTH: '80mm',
    INVOICE_HEADER_AR: `${storeName} — صيدلية معتمدة`,
    INVOICE_FOOTER_AR: 'شكراً لتعاملكم معنا. نتمنى لكم دوام الصحة والعافية',
  }

  // Upsert settings in database
  await Promise.all(
    Object.entries(sovereignSettings).map(([key, value]) =>
      prisma.organizationSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        update: { value },
        create: { organizationId, key, value },
      })
    )
  )

  // ─────────────────────────────────────────────────────────────
  // PHASE 4: ROLE-BASED IAM & SOVEREIGN TERRITORY MATRIX
  // ─────────────────────────────────────────────────────────────
  // Find all users belonging to this organization
  const orgUsers = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true, email: true },
  })

  for (const u of orgUsers) {
    const govPayload = {
      territories: [territoryCode],
      assignedPrivateNode: territoryCode,
      ipRestrictionEnabled: false,
      mfaEnabled: u.id === adminUserId,
      assignedBy: 'SuperAdmin Sovereign Provisioner',
      assignedAt: new Date().toISOString(),
    }

    await prisma.systemSetting.upsert({
      where: {
        category_key: {
          category: 'USER_GOVERNANCE',
          key: u.id,
        },
      },
      create: {
        category: 'USER_GOVERNANCE',
        key: u.id,
        value: JSON.stringify(govPayload),
        dataType: 'json',
        label: `Sovereign Matrix for ${u.email}`,
      },
      update: {
        value: JSON.stringify(govPayload),
        updatedAt: new Date(),
      },
    })
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE 5: DEDICATED PRIVATE CLOUD TOPOLOGY & TELEMETRY
  // ─────────────────────────────────────────────────────────────
  const vpcPodId = privateCloudVpcId || topology.vpcId
  const cloudSettings: Record<string, string> = {
    PRIVATE_CLOUD_VPC: vpcPodId,
    PRIVATE_SUBNET_CIDR: topology.privateSubnetCidr,
    DEDICATED_DB_ENDPOINT: topology.dedicatedDbEndpoint,
    HSM_KEY_ARN: topology.hsmKeyArn,
    DATA_RESIDENCY_STATUS: 'STRICT_IN_COUNTRY_ENFORCED',
    SOVEREIGN_NODE_HOST: topology.primaryNodeHost,
    DATA_RESIDENCY_LAW: topology.dataResidencyLaw,
  }

  await Promise.all(
    Object.entries(cloudSettings).map(([key, value]) =>
      prisma.organizationSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        update: { value },
        create: { organizationId, key, value },
      })
    )
  )

  // Record Audit Trail
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: 'SOVEREIGN_TENANT_5_PHASES_PROVISIONED',
      entity: 'Organization',
      entityId: organizationId,
      newData: {
        territoryCode,
        storeCode,
        storeName,
        phase1ProductsCount: createdProducts.length,
        phase2BatchesCount: batchesCount,
        phase3TaxRegime: taxRegimeName,
        phase4UsersCount: orgUsers.length,
        phase5VpcPod: vpcPodId,
        dataResidencyLaw: topology.dataResidencyLaw,
        timestamp: new Date().toISOString(),
      },
    },
  })

  return {
    success: true,
    organizationId,
    territoryCode,
    phase1ProductsCreated: createdProducts.length,
    phase2BatchesCreated: batchesCount,
    phase3TaxRegime: taxRegimeName,
    phase4UsersGoverned: orgUsers.length,
    phase5VpcPod: vpcPodId,
    dataResidencyLaw: topology.dataResidencyLaw,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Maps territory code to a default geo-zone label
 */
export function getTerritoryGeoZoneName(code: TerritoryCode): string {
  switch (code) {
    case 'SA':
      return 'KSA - Central Region (Riyadh)'
    case 'OM':
      return 'Sultanate of Oman (Muscat)'
    case 'BH':
      return 'Kingdom of Bahrain (Manama)'
    case 'QA':
      return 'State of Qatar (Doha)'
    case 'MV':
      return 'Republic of Maldives (Greater Malé)'
    case 'IN':
      return 'South Zone (Bangalore/Hyderabad)'
    default:
      return 'KSA - Central Region (Riyadh)'
  }
}

/**
 * Provisions "the main" Organization & Branch (PharmaCare Medical Store / Main Branch)
 * to a designated sovereign geopolitical territory with the complete 5-phase pipeline.
 */
export async function provisionMainDispensary(
  territoryCode: TerritoryCode = 'SA',
  privateCloudVpcId?: string
): Promise<SovereignProvisioningReport> {
  // 1. Find main organization (code 'DEFAULT' or slug 'default' or id 'default-org')
  let mainOrg = await prisma.organization.findFirst({
    where: {
      OR: [{ code: 'DEFAULT' }, { slug: 'default' }, { id: 'default-org' }],
    },
  })

  if (!mainOrg) {
    mainOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!mainOrg) {
    throw new Error('No main organization found on the platform.')
  }

  // 2. Find main branch
  let mainBranch = await prisma.branch.findFirst({
    where: {
      organizationId: mainOrg.id,
      OR: [{ isHeadOffice: true }, { code: 'HO' }, { id: 'default-branch' }],
    },
  })

  if (!mainBranch) {
    mainBranch = await prisma.branch.findFirst({
      where: { organizationId: mainOrg.id },
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!mainBranch) {
    throw new Error(`No dispensary branch found for main organization ${mainOrg.name}.`)
  }

  // 3. Find admin user
  let adminUser = await prisma.user.findFirst({
    where: {
      organizationId: mainOrg.id,
      OR: [{ isSuperAdmin: true }, { email: 'superadmin@pharmacare.local' }, { email: 'admin@pharmacare.local' }],
    },
  })

  if (!adminUser) {
    adminUser = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
    })
  }

  if (!adminUser) {
    adminUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!adminUser) {
    throw new Error('No administrator user found to bind sovereign main dispensary.')
  }

  const geoZone = getTerritoryGeoZoneName(territoryCode)

  return provisionSovereignTenant({
    organizationId: mainOrg.id,
    branchId: mainBranch.id,
    adminUserId: adminUser.id,
    territoryCode,
    geoZoneName: geoZone,
    storeCode: mainOrg.code || 'DEFAULT',
    storeName: mainOrg.name,
    privateCloudVpcId,
  })
}
