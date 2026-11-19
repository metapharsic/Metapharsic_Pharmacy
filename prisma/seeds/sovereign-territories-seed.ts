import bcrypt from 'bcryptjs'
import { PrismaClient, DrugSchedule } from '@prisma/client'

const prisma = new PrismaClient()

export interface SovereignOrgData {
  id: string
  code: string
  slug: string
  name: string
  legalName: string
  country: string
  territoryCode: 'SA' | 'OM' | 'BH' | 'QA' | 'MV' | 'IN'
  city: string
  state: string
  currency: string
  timezone: string
  vatNumber: string
  drugLicense: string
  address: string
  branchId: string
  branchName: string
  branchCode: string
  invoicePrefix: string
  users: Array<{
    name: string
    email: string
    passwordPlain: string
    roleName: 'owner' | 'manager' | 'pharmacist' | 'cashier'
    phone?: string
  }>
  priceScale: number // Multiplier relative to USD base
  decimals: number
}

export const SOVEREIGN_PROVISIONS: SovereignOrgData[] = [
  {
    id: 'org-sa-central',
    code: 'SA_DISPENSARY',
    slug: 'sa-riyadh-flagship',
    name: 'Al-Nahdi & Metapharsic Central Pharmacy',
    legalName: 'Al-Nahdi & Metapharsic Pharmacy Co. LLC (صيدلية النهدي وميتافارسيك)',
    country: 'Saudi Arabia',
    territoryCode: 'SA',
    city: 'Riyadh',
    state: 'Riyadh Province',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    vatNumber: '310123456700003', // 15-digit ZATCA VAT
    drugLicense: 'SFDA-DISP-1445-9012',
    address: 'King Fahd Road, Olaya District, Riyadh 12211, Kingdom of Saudi Arabia',
    branchId: 'branch-sa-olaya',
    branchName: 'Riyadh Olaya Flagship Dispensary (فرع العليا المركزي)',
    branchCode: 'SA-RUH-01',
    invoicePrefix: 'ZTC',
    priceScale: 3.75, // 1 USD = 3.75 SAR
    decimals: 2,
    users: [
      {
        name: 'د. خالد العتيبي (Dr. Khaled Al-Otaibi)',
        email: 'saudi.admin@pharmacare.local',
        passwordPlain: 'Ksa@123456',
        roleName: 'owner',
        phone: '+966-50-1234567',
      },
      {
        name: 'د. سارة الغامدي (Dr. Sarah Al-Ghamdi)',
        email: 'saudi.pharmacist@pharmacare.local',
        passwordPlain: 'Pharma@123',
        roleName: 'pharmacist',
        phone: '+966-55-9876543',
      },
      {
        name: 'عمر باوزير (Omar Bawazir)',
        email: 'saudi.cashier@pharmacare.local',
        passwordPlain: 'Cashier@123',
        roleName: 'cashier',
        phone: '+966-54-1122334',
      },
    ],
  },
  {
    id: 'org-om-sovereign',
    code: 'OM_DISPENSARY',
    slug: 'om-muscat-central',
    name: 'Metapharsic Muscat Sovereign Pharmacy',
    legalName: 'Metapharsic Sovereign Pharmacy Oman LLC (صيدلية ميتافارسيك مسقط السيادية)',
    country: 'Oman',
    territoryCode: 'OM',
    city: 'Muscat',
    state: 'Muscat Governorate',
    currency: 'OMR',
    timezone: 'Asia/Muscat',
    vatNumber: 'OM12345678', // 5% OTA VAT
    drugLicense: 'MOH-OMN-2024-8812',
    address: 'Ruwi High Street, Ruwi Business District, Muscat 112, Sultanate of Oman',
    branchId: 'branch-om-ruwi',
    branchName: 'Muscat Ruwi Central Dispensary (فرع روي المركزي)',
    branchCode: 'OM-MCT-01',
    invoicePrefix: 'OTA',
    priceScale: 0.385, // 1 USD = 0.385 OMR
    decimals: 3,
    users: [
      {
        name: 'د. أحمد الحارثي (Dr. Ahmed Al-Harthy)',
        email: 'oman.admin@pharmacare.local',
        passwordPlain: 'Oman@123456',
        roleName: 'owner',
        phone: '+968-9123-4567',
      },
      {
        name: 'د. مريم البلوشي (Dr. Maryam Al-Balushi)',
        email: 'oman.pharmacist@pharmacare.local',
        passwordPlain: 'Pharma@123',
        roleName: 'pharmacist',
        phone: '+968-9876-5432',
      },
    ],
  },
  {
    id: 'org-bh-healthcare',
    code: 'BH_DISPENSARY',
    slug: 'bh-manama-central',
    name: 'Metapharsic Bahrain Healthcare Dispensary',
    legalName: 'Metapharsic Healthcare WLL Bahrain (صيدلية البحرين للرعاية الصحية)',
    country: 'Bahrain',
    territoryCode: 'BH',
    city: 'Manama',
    state: 'Capital Governorate',
    currency: 'BHD',
    timezone: 'Asia/Bahrain',
    vatNumber: 'BH200001234', // 10% NBR VAT
    drugLicense: 'NHRA-BH-2024-5541',
    address: 'Government Avenue, Diplomatic Area, Manama 316, Kingdom of Bahrain',
    branchId: 'branch-bh-manama',
    branchName: 'Manama Diplomatic Area Dispensary (فرع المنطقة الدبلوماسية)',
    branchCode: 'BH-BAH-01',
    invoicePrefix: 'NBR',
    priceScale: 0.376, // 1 USD = 0.376 BHD
    decimals: 3,
    users: [
      {
        name: 'د. فاطمة آل خليفة (Dr. Fatima Al-Khalifa)',
        email: 'bahrain.admin@pharmacare.local',
        passwordPlain: 'Bahrain@123456',
        roleName: 'owner',
        phone: '+973-3912-3456',
      },
      {
        name: 'علي الجمري (Ali Al-Jamri)',
        email: 'bahrain.pharmacist@pharmacare.local',
        passwordPlain: 'Pharma@123',
        roleName: 'pharmacist',
        phone: '+973-3654-7890',
      },
    ],
  },
  {
    id: 'org-qa-clinical',
    code: 'QA_DISPENSARY',
    slug: 'qa-doha-westbay',
    name: 'Metapharsic Doha Clinical Pharmacy',
    legalName: 'Metapharsic Clinical Pharmacy LLC Qatar (صيدلية الدوحة الإكلينيكية)',
    country: 'Qatar',
    territoryCode: 'QA',
    city: 'Doha',
    state: 'Ad Dawhah',
    currency: 'QAR',
    timezone: 'Asia/Qatar',
    vatNumber: 'QA-HEALTH-001', // 0% MoPH
    drugLicense: 'MOPH-QA-2024-3321',
    address: 'Corniche Road, West Bay Financial District, Doha, State of Qatar',
    branchId: 'branch-qa-westbay',
    branchName: 'Doha West Bay Dispensary (فرع الخليج الغربي - الدوحة)',
    branchCode: 'QA-DOH-01',
    invoicePrefix: 'QAT',
    priceScale: 3.64, // 1 USD = 3.64 QAR
    decimals: 2,
    users: [
      {
        name: 'د. ناصر الكواري (Dr. Nasser Al-Kuwari)',
        email: 'qatar.admin@pharmacare.local',
        passwordPlain: 'Qatar@123456',
        roleName: 'owner',
        phone: '+974-5512-3456',
      },
      {
        name: 'حمد المري (Hamad Al-Marri)',
        email: 'qatar.pharmacist@pharmacare.local',
        passwordPlain: 'Pharma@123',
        roleName: 'pharmacist',
        phone: '+974-6654-3210',
      },
    ],
  },
  {
    id: 'org-mv-marine',
    code: 'MV_DISPENSARY',
    slug: 'mv-male-flagship',
    name: 'Metapharsic Malé Marine Pharmacy',
    legalName: 'Metapharsic Healthcare Maldives Pvt Ltd (މެޓަފާސިކް މާލެ ފާމަސީ)',
    country: 'Maldives',
    territoryCode: 'MV',
    city: 'Malé',
    state: 'Kaafu Atoll',
    currency: 'MVR',
    timezone: 'Indian/Maldives',
    vatNumber: 'MIRA-1002934-GST', // 8% GGST
    drugLicense: 'MFDA-DISP-2024-1109',
    address: 'Ameenee Magu, Henveiru, Malé 20094, Republic of Maldives',
    branchId: 'branch-mv-ameenee',
    branchName: 'Greater Malé Ameenee Magu Dispensary',
    branchCode: 'MV-MLE-01',
    invoicePrefix: 'MV',
    priceScale: 15.42, // 1 USD = 15.42 MVR
    decimals: 2,
    users: [
      {
        name: 'Dr. Ibrahim Naeem (Chief Pharmacist)',
        email: 'maldives.admin@pharmacare.local',
        passwordPlain: 'Maldives@123456',
        roleName: 'owner',
        phone: '+960-771-2345',
      },
      {
        name: 'Aishath Shifa (Dispensary Pharmacist)',
        email: 'maldives.pharmacist@pharmacare.local',
        passwordPlain: 'Pharma@123',
        roleName: 'pharmacist',
        phone: '+960-998-7654',
      },
    ],
  },
  {
    id: 'org-in-apex',
    code: 'IN_DISPENSARY',
    slug: 'in-hyderabad-apex',
    name: 'Metapharsic Apex Pharmacy India',
    legalName: 'Metapharsic Healthcare India Private Limited',
    country: 'India',
    territoryCode: 'IN',
    city: 'Hyderabad',
    state: 'Telangana',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    vatNumber: '36METAP1234A1Z9',
    drugLicense: 'TS/HYD/2026/9021',
    address: 'Plot 42, Road 1, Banjara Hills, Hyderabad 500034, Telangana, India',
    branchId: 'branch-in-banjara',
    branchName: 'Banjara Hills Central Dispensary',
    branchCode: 'IN-HYD-01',
    invoicePrefix: 'IND',
    priceScale: 84.0, // 1 USD = 84.0 INR
    decimals: 2,
    users: [
      {
        name: 'Dr. Rajesh Sharma (Superintendent Pharmacist)',
        email: 'india.admin@pharmacare.local',
        passwordPlain: 'India@123456',
        roleName: 'owner',
        phone: '+91-9123456780',
      },
      {
        name: 'Priya Reddy (Staff Pharmacist)',
        email: 'india.pharmacist@pharmacare.local',
        passwordPlain: 'Pharma@123',
        roleName: 'pharmacist',
        phone: '+91-9876543210',
      },
    ],
  },
]

export const BILINGUAL_SOVEREIGN_PRODUCTS = [
  {
    name: 'Augmentin 1g Tab (14s)',
    nameAr: 'أوجمنتين 1 جم أقراص (14 قرص)',
    genericName: 'Amoxicillin + Clavulanic Acid 1000mg',
    genericNameAr: 'أموكسيسيلين + حمض الكلافولانيك 1000 ملغ',
    sku: 'MED-AUG-1000',
    barcode: '06285000000012',
    baseUsdPrice: 14.5,
    drugSchedule: DrugSchedule.NONE,
    isPrescriptionRequired: true,
    isGstExempt: true, // Zero-rated human pharmaceutical
    gstRate: 0.0,
    tabsPerStrip: 14,
    packSize: '14 tablets',
    unitOfMeasure: 'Box',
    batches: [
      {
        batchNumber: 'LOT-AUG-2026A',
        daysToExpiry: 365,
        quantity: 150,
      },
    ],
  },
  {
    name: 'Panadol Extra Paracetamol 500mg (24s)',
    nameAr: 'بنادول إكسترا باراسيتامول 500 ملغ (24 قرص)',
    genericName: 'Paracetamol 500mg + Caffeine 65mg',
    genericNameAr: 'باراسيتامول 500 ملغ + كافيين 65 ملغ',
    sku: 'OTC-PAN-500',
    barcode: '06285000000029',
    baseUsdPrice: 3.5,
    drugSchedule: DrugSchedule.NONE,
    isPrescriptionRequired: false,
    isGstExempt: false, // Standard VAT
    gstRate: 15.0,
    tabsPerStrip: 24,
    packSize: '24 tablets',
    unitOfMeasure: 'Box',
    batches: [
      {
        batchNumber: 'LOT-PAN-2026B',
        daysToExpiry: 540,
        quantity: 300,
      },
    ],
  },
  {
    name: 'Lipitor 20mg Atorvastatin (30s)',
    nameAr: 'ليبيتور 20 ملغ أتورفاستاتين (30 قرص)',
    genericName: 'Atorvastatin Calcium 20mg',
    genericNameAr: 'أتورفاستاتين كالسيوم 20 ملغ خافض للكوليسترول',
    sku: 'MED-LIP-020',
    barcode: '06285000000036',
    baseUsdPrice: 22.0,
    drugSchedule: DrugSchedule.SCHEDULE_H,
    isPrescriptionRequired: true,
    isGstExempt: true,
    gstRate: 0.0,
    tabsPerStrip: 30,
    packSize: '30 tablets',
    unitOfMeasure: 'Box',
    batches: [
      {
        batchNumber: 'LOT-LIP-2026C',
        daysToExpiry: 420,
        quantity: 120,
      },
    ],
  },
  {
    name: 'Nexium 40mg Esomeprazole (28s)',
    nameAr: 'نيكسيوم 40 ملغ إيزوميبرازول (28 قرص)',
    genericName: 'Esomeprazole Magnesium 40mg',
    genericNameAr: 'إيزوميبرازول مغنيسيوم 40 ملغ مضاد للحموضة',
    sku: 'MED-NEX-040',
    barcode: '06285000000043',
    baseUsdPrice: 19.5,
    drugSchedule: DrugSchedule.SCHEDULE_H,
    isPrescriptionRequired: true,
    isGstExempt: true,
    gstRate: 0.0,
    tabsPerStrip: 28,
    packSize: '28 tablets',
    unitOfMeasure: 'Box',
    batches: [
      {
        batchNumber: 'LOT-NEX-2026D',
        daysToExpiry: 300,
        quantity: 90,
      },
    ],
  },
  {
    name: 'Morphine Sulfate 10mg Controlled Injection (10 Ampoules)',
    nameAr: 'كبريتات المورفين 10 ملغ أمبولات حقن مخدرة مقيدة (10 أمبولات)',
    genericName: 'Morphine Sulfate 10mg/ml',
    genericNameAr: 'كبريتات المورفين 10 ملغ/مل (جدول المواد المخدرة والمؤثرات العقلية)',
    sku: 'NAR-MOR-010',
    barcode: '06285000000050',
    baseUsdPrice: 32.0,
    drugSchedule: DrugSchedule.NARCOTIC,
    isPrescriptionRequired: true,
    isGstExempt: true,
    gstRate: 0.0,
    tabsPerStrip: 10,
    packSize: '10 ampoules',
    unitOfMeasure: 'Pack',
    batches: [
      {
        batchNumber: 'LOT-MOR-2026E',
        daysToExpiry: 720,
        quantity: 50,
      },
    ],
  },
  {
    name: 'Dermocosmetic Sunscreen SPF 50+ Invisible Shield (50ml)',
    nameAr: 'واقي شمس طبي حماية قصوى 50+ شفاف (50 مل)',
    genericName: 'Broad Spectrum UV Medical Photoprotection',
    genericNameAr: 'حماية طبية متطورة واسعة النطاق من أشعة الشمس',
    sku: 'COS-SUN-050',
    barcode: '06285000000067',
    baseUsdPrice: 16.0,
    drugSchedule: DrugSchedule.NONE,
    isPrescriptionRequired: false,
    isGstExempt: false,
    gstRate: 15.0,
    packSize: '50ml',
    unitOfMeasure: 'Bottle',
    batches: [
      {
        batchNumber: 'LOT-SUN-2026F',
        daysToExpiry: 600,
        quantity: 80,
      },
    ],
  },
]

export async function seedSovereignTerritories() {
  console.log('\n======================================================================')
  console.log('🌍 SEEDING SOVEREIGN GCC & SOUTH ASIA TERRITORIES (SA, OM, BH, QA, MV, IN)')
  console.log('======================================================================\n')

  const ownerRole = await prisma.role.findUnique({ where: { name: 'owner' } })
  const managerRole = await prisma.role.findUnique({ where: { name: 'manager' } })
  const pharmacistRole = await prisma.role.findUnique({ where: { name: 'pharmacist' } })
  const cashierRole = await prisma.role.findUnique({ where: { name: 'cashier' } })

  const roleMap: Record<string, any> = {
    owner: ownerRole,
    manager: managerRole,
    pharmacist: pharmacistRole,
    cashier: cashierRole,
  }

  // 1. Ensure Global SuperAdmin Exists
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@metapharsic.cloud' },
    update: {
      name: 'Global Platform SuperAdmin (المدير السيادي العام)',
      isSuperAdmin: true,
      isActive: true,
    },
    create: {
      name: 'Global Platform SuperAdmin (المدير السيادي العام)',
      email: 'superadmin@metapharsic.cloud',
      password: superAdminPassword,
      isSuperAdmin: true,
      isActive: true,
    },
  })

  if (ownerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: superAdmin.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: superAdmin.id, roleId: ownerRole.id },
    })
  }
  console.log('👑 Global SuperAdmin: superadmin@metapharsic.cloud / SuperAdmin@123 [PROVISIONED]')

  // 2. Loop through all 6 sovereign territories
  for (const prov of SOVEREIGN_PROVISIONS) {
    console.log(`\n🏛️  Provisioning [${prov.territoryCode}] ${prov.name} (${prov.country})...`)

    // Upsert Organization
    const org = await prisma.organization.upsert({
      where: { id: prov.id },
      update: {
        code: prov.code,
        slug: prov.slug,
        name: prov.name,
        legalName: prov.legalName,
        country: prov.country,
        city: prov.city,
        state: prov.state,
        currency: prov.currency,
        timezone: prov.timezone,
        gstin: prov.vatNumber,
        dlNumber: prov.drugLicense,
        address: prov.address,
        status: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE',
      },
      create: {
        id: prov.id,
        code: prov.code,
        slug: prov.slug,
        name: prov.name,
        legalName: prov.legalName,
        country: prov.country,
        city: prov.city,
        state: prov.state,
        currency: prov.currency,
        timezone: prov.timezone,
        gstin: prov.vatNumber,
        dlNumber: prov.drugLicense,
        address: prov.address,
        status: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE',
      },
    })

    // Upsert Flagship Branch
    const branch = await prisma.branch.upsert({
      where: { id: prov.branchId },
      update: {
        organizationId: org.id,
        name: prov.branchName,
        code: prov.branchCode,
        gstin: prov.vatNumber,
        dlNumber: prov.drugLicense,
        address: prov.address,
        city: prov.city,
        state: prov.state,
        isHeadOffice: true,
        isActive: true,
        invoicePrefix: prov.invoicePrefix,
      },
      create: {
        id: prov.branchId,
        organizationId: org.id,
        name: prov.branchName,
        code: prov.branchCode,
        gstin: prov.vatNumber,
        dlNumber: prov.drugLicense,
        address: prov.address,
        city: prov.city,
        state: prov.state,
        isHeadOffice: true,
        isActive: true,
        invoicePrefix: prov.invoicePrefix,
        invoiceCounter: 1,
      },
    })
    console.log(`   ✓ Branch: ${branch.name} [Code: ${branch.code}, Prefix: ${branch.invoicePrefix}]`)

    // Upsert Staff Users
    let firstUser: any = null
    for (const u of prov.users) {
      const hashed = await bcrypt.hash(u.passwordPlain, 12)
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          organizationId: org.id,
          branchId: branch.id,
          phone: u.phone,
          isActive: true,
          password: hashed,
        },
        create: {
          name: u.name,
          email: u.email,
          password: hashed,
          organizationId: org.id,
          branchId: branch.id,
          phone: u.phone,
          isActive: true,
        },
      })

      if (!firstUser) firstUser = user

      const assignedRole = roleMap[u.roleName] || pharmacistRole
      if (assignedRole) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: assignedRole.id } },
          update: {},
          create: { userId: user.id, roleId: assignedRole.id },
        })
      }
      console.log(`   ✓ User: ${u.email} (${u.roleName}) / PIN: ${u.passwordPlain}`)
    }

    // Upsert Products & Batches for this Organization & Branch
    for (const prod of BILINGUAL_SOVEREIGN_PRODUCTS) {
      const localMrpRaw = prod.baseUsdPrice * prov.priceScale
      const factor = Math.pow(10, prov.decimals)
      const localMrp = Math.round((localMrpRaw + Number.EPSILON) * factor) / factor
      const costPrice = Math.round((localMrp * 0.7 + Number.EPSILON) * factor) / factor

      const prodSku = `${prod.sku}-${prov.territoryCode}`
      const prodBarcode = `${prod.barcode}-${prov.territoryCode}`
      const product = await prisma.product.upsert({
        where: { id: `prod-${prod.sku}-${prov.territoryCode}` },
        update: {
          organizationId: org.id,
          name: prod.name,
          nameAr: prod.nameAr,
          genericName: prod.genericName,
          genericNameAr: prod.genericNameAr,
          barcode: prodBarcode,
          mrp: localMrp,
          costPrice: costPrice,
          isGstExempt: prod.isGstExempt,
          gstRate: prod.isGstExempt ? 0 : prod.gstRate,
          drugSchedule: prod.drugSchedule,
          isPrescriptionRequired: prod.isPrescriptionRequired,
          packSize: prod.packSize,
          unitOfMeasure: prod.unitOfMeasure,
          tabsPerStrip: prod.tabsPerStrip,
          isActive: true,
        },
        create: {
          id: `prod-${prod.sku}-${prov.territoryCode}`,
          organizationId: org.id,
          name: prod.name,
          nameAr: prod.nameAr,
          genericName: prod.genericName,
          genericNameAr: prod.genericNameAr,
          sku: prodSku,
          barcode: prodBarcode,
          mrp: localMrp,
          costPrice: costPrice,
          isGstExempt: prod.isGstExempt,
          gstRate: prod.isGstExempt ? 0 : prod.gstRate,
          drugSchedule: prod.drugSchedule,
          isPrescriptionRequired: prod.isPrescriptionRequired,
          packSize: prod.packSize,
          unitOfMeasure: prod.unitOfMeasure,
          tabsPerStrip: prod.tabsPerStrip,
          isActive: true,
          createdById: firstUser.id,
        },
      })

      // Batches
      for (const b of prod.batches) {
        const batchNum = `${b.batchNumber}-${prov.territoryCode}`
        const expiryDate = new Date(Date.now() + b.daysToExpiry * 86400000)

        await prisma.batch.upsert({
          where: {
            productId_batchNumber: {
              productId: product.id,
              batchNumber: batchNum,
            },
          },
          update: {
            quantity: b.quantity,
            expiryDate,
            purchasePrice: costPrice,
            mrp: localMrp,
            branchId: branch.id,
          },
          create: {
            productId: product.id,
            batchNumber: batchNum,
            quantity: b.quantity,
            expiryDate,
            purchasePrice: costPrice,
            mrp: localMrp,
            branchId: branch.id,
          },
        })
      }
    }
    console.log(`   ✓ Provisioned ${BILINGUAL_SOVEREIGN_PRODUCTS.length} bilingual medicines with active batches in ${prov.currency}`)
  }

  console.log('\n======================================================================')
  console.log('🎉 ALL 6 SOVEREIGN TERRITORIES PROVISIONED IN DATABASE SUCCESSFULLY!')
  console.log('======================================================================\n')
}

// Allow direct CLI execution
if (require.main === module) {
  seedSovereignTerritories()
    .catch((e) => {
      console.error('❌ Provisioning failed:', e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
