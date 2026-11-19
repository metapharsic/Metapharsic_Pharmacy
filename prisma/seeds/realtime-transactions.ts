import { PrismaClient, MovementType, AdjustmentType, AdjustmentStatus, PurchaseStatus, SaleStatus, PaymentStatus, PaymentMethod, PrescriptionStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting Real-Time Interconnected Pharmaceutical Data Seed...\n')

  const branch = (await prisma.branch.findFirst({ where: { isHeadOffice: true, organizationId: 'default-org' } }))
    || (await prisma.branch.findFirst({ where: { organizationId: 'default-org' } }))
  if (!branch) throw new Error('Main branch for default-org not found')

  const user = (await prisma.user.findFirst({ where: { email: 'admin@pharmacare.local', organizationId: 'default-org' } }))
    || (await prisma.user.findFirst({ where: { organizationId: 'default-org' } }))
  if (!user) throw new Error('Admin/user for default-org not found')

  const now = new Date() // Current system clock: 2026-09-24

  // ─────────────────────────────────────────────────────────────
  // 1. SUPPLIERS
  // ─────────────────────────────────────────────────────────────
  console.log('📦 Ensuring Suppliers...')
  const supplierDefs = [
    {
      name: 'Sun Pharma Regional Wholesalers',
      contactPerson: 'Anand Roy',
      phone: '9876500002',
      email: 'wholesale@sunpharma-rep.com',
      gstin: '29BCDEF2345G2Z2',
      dlNumber: 'DL-KA-SUP-02',
      address: '14/B, Wholesale Medicine Market',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560002',
      creditDays: 45,
    },
    {
      name: 'MedLife Healthcare Distributors',
      contactPerson: 'Vikram Patel',
      phone: '9876500001',
      email: 'orders@medlife-dist.com',
      gstin: '29ABCDE1234F1Z1',
      dlNumber: 'DL-KA-SUP-01',
      address: 'Plot 42, Pharma Industrial Estate',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560099',
      creditDays: 30,
    },
    {
      name: 'Cipla Healthcare Distribution Ltd',
      contactPerson: 'Rajeev Menon',
      phone: '9876500003',
      email: 'supply@cipla-dist.com',
      gstin: '29CDEFG3456H3Z3',
      dlNumber: 'DL-KA-SUP-03',
      address: '22, Peenya Industrial Area, Phase 1',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560058',
      creditDays: 30,
    },
    {
      name: 'Abbott Healthcare Agency',
      contactPerson: 'Kavita Nair',
      phone: '9876500004',
      email: 'orders@abbott-rep.com',
      gstin: '29DEFGH4567I4Z4',
      dlNumber: 'DL-KA-SUP-04',
      address: '7th Cross, Gandhinagar Medical Hub',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560009',
      creditDays: 45,
    },
  ]

  const suppliers: Record<string, any> = {}
  for (const s of supplierDefs) {
    let sup = await prisma.supplier.findFirst({
      where: {
        name: s.name,
        OR: [{ organizationId: 'default-org' }, { organizationId: null }],
      },
    })
    if (!sup) {
      sup = await prisma.supplier.create({ data: { ...s, organizationId: 'default-org' } })
    } else {
      sup = await prisma.supplier.update({
        where: { id: sup.id },
        data: { ...s, organizationId: 'default-org' },
      })
    }
    suppliers[s.name] = sup
  }
  console.log(`  ✓ ${Object.keys(suppliers).length} suppliers ready`)

  // ─────────────────────────────────────────────────────────────
  // 2. CUSTOMERS
  // ─────────────────────────────────────────────────────────────
  console.log('👥 Ensuring Customers...')
  const customerDefs = [
    {
      name: 'Walk-in Customer',
      phone: '9000000000',
      creditLimit: 0,
      creditDays: 0,
    },
    {
      name: 'Ramesh Kumar',
      phone: '9845012345',
      email: 'ramesh.k@example.com',
      address: '45, Palm Grove Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      creditLimit: 5000,
      creditDays: 15,
    },
    {
      name: 'Sunita Sharma',
      phone: '9845054321',
      email: 'sunita.s@example.com',
      address: '12, Sunrise Residency',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      creditLimit: 2000,
      creditDays: 7,
    },
    {
      name: 'Rajesh Varma',
      phone: '9845088990',
      email: 'rajesh.varma@example.com',
      address: '88, 4th Block, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      creditLimit: 4000,
      creditDays: 14,
    },
    {
      name: 'Anita Desai',
      phone: '9845077221',
      email: 'anita.desai@example.com',
      address: '19, Green Meadows, Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      creditLimit: 3000,
      creditDays: 10,
    },
    {
      name: 'Mohammed Farooq',
      phone: '9845033445',
      email: 'm.farooq@example.com',
      address: '102, Crescent Towers, Jayanagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560011',
      creditLimit: 2500,
      creditDays: 15,
    },
  ]

  const customers: Record<string, any> = {}
  for (const c of customerDefs) {
    let cust = await prisma.customer.findFirst({
      where: {
        phone: c.phone,
        OR: [{ organizationId: 'default-org' }, { organizationId: null }],
      },
    })
    if (!cust) {
      cust = await prisma.customer.create({ data: { ...c, organizationId: 'default-org' } })
    } else {
      cust = await prisma.customer.update({
        where: { id: cust.id },
        data: { ...c, organizationId: 'default-org' },
      })
    }
    customers[c.name] = cust
  }
  console.log(`  ✓ ${Object.keys(customers).length} customers ready`)

  // ─────────────────────────────────────────────────────────────
  // 3. DOCTORS
  // ─────────────────────────────────────────────────────────────
  console.log('🩺 Ensuring Doctors...')
  const doctorDefs = [
    {
      name: 'Dr. Rajesh Sharma',
      regNumber: 'KMC-45892',
      qualification: 'MBBS, MD (General Medicine)',
      specialization: 'General Physician',
      clinicName: 'Apollo Clinic Indiranagar',
      phone: '9845011111',
      email: 'dr.sharma@apolloclinic.com',
      commissionPercent: 5.0,
    },
    {
      name: 'Dr. Arvind Kumar',
      regNumber: 'KMC-31204',
      qualification: 'MBBS, MD, DM (Cardiology)',
      specialization: 'Cardiologist',
      clinicName: 'Bangalore Heart Care Centre',
      phone: '9845022222',
      email: 'dr.arvind@heartcare.com',
      commissionPercent: 5.0,
    },
    {
      name: 'Dr. Priya Patel',
      regNumber: 'KMC-52190',
      qualification: 'MBBS, DNB (Pediatrics)',
      specialization: 'Pediatrician',
      clinicName: 'Rainbow Children Clinic',
      phone: '9845033333',
      email: 'dr.priya@rainbowkids.com',
      commissionPercent: 5.0,
    },
    {
      name: 'Dr. Sneha Kulkarni',
      regNumber: 'KMC-48712',
      qualification: 'MBBS, MD (Endocrinology)',
      specialization: 'Diabetologist',
      clinicName: 'Diabetes & Metabolism Centre',
      phone: '9845044444',
      email: 'dr.sneha@diabetescare.com',
      commissionPercent: 5.0,
    },
    {
      name: 'Dr. Suresh Menon',
      regNumber: 'KMC-29401',
      qualification: 'MBBS, MS (ENT)',
      specialization: 'ENT Specialist',
      clinicName: 'City ENT & Allergy Care',
      phone: '9845055555',
      email: 'dr.menon@cityent.com',
      commissionPercent: 5.0,
    },
  ]

  const doctors: Record<string, any> = {}
  for (const d of doctorDefs) {
    let doc = await prisma.doctor.findFirst({
      where: {
        name: d.name,
        OR: [{ organizationId: 'default-org' }, { organizationId: null }],
      },
    })
    if (!doc) {
      doc = await prisma.doctor.create({ data: { ...d, organizationId: 'default-org' } })
    } else {
      doc = await prisma.doctor.update({
        where: { id: doc.id },
        data: { ...d, organizationId: 'default-org' },
      })
    }
    doctors[d.name] = doc
  }
  console.log(`  ✓ ${Object.keys(doctors).length} doctors ready`)

  // ─────────────────────────────────────────────────────────────
  // 4. FETCH PRODUCTS & INVENTORY MAP
  // ─────────────────────────────────────────────────────────────
  console.log('💊 Loading Products, Batches & Inventory...')
  const productList = await prisma.product.findMany({
    where: { organizationId: 'default-org' },
    include: {
      batches: { where: { branchId: branch.id } },
      inventory: { where: { branchId: branch.id } },
    },
  })

  const prodBySku: Record<string, any> = {}
  for (const p of productList) {
    prodBySku[p.sku] = p
  }

  // ─────────────────────────────────────────────────────────────
  // 5. PRESCRIPTIONS
  // ─────────────────────────────────────────────────────────────
  console.log('📋 Ensuring Prescriptions...')
  const rxDefs = [
    {
      prescriptionNumber: 'RX-2026-081',
      patientName: 'Anita Desai',
      patientAge: 38,
      patientPhone: '9845077221',
      doctorName: 'Dr. Rajesh Sharma',
      doctorRegNumber: 'KMC-45892',
      doctorId: doctors['Dr. Rajesh Sharma'].id,
      customerId: customers['Anita Desai'].id,
      branchId: branch.id,
      status: PrescriptionStatus.DISPENSED,
      prescriptionDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      notes: 'Cap. Amoxicillin 500mg 1 TDS x 5 days, Tab. Dolo 650 1 SOS for fever, Betadine Ointment for minor cut.',
    },
    {
      prescriptionNumber: 'RX-2026-082',
      patientName: 'Rajesh Varma',
      patientAge: 52,
      patientPhone: '9845088990',
      doctorName: 'Dr. Arvind Kumar',
      doctorRegNumber: 'KMC-31204',
      doctorId: doctors['Dr. Arvind Kumar'].id,
      customerId: customers['Rajesh Varma'].id,
      branchId: branch.id,
      status: PrescriptionStatus.DISPENSED,
      prescriptionDate: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      notes: 'Tab. P-650 1 SOS for knee pain and mild fever. Regular cardiac review scheduled.',
    },
    {
      prescriptionNumber: 'RX-2026-083',
      patientName: 'Ramesh Kumar',
      patientAge: 47,
      patientPhone: '9845012345',
      doctorName: 'Dr. Sneha Kulkarni',
      doctorRegNumber: 'KMC-48712',
      doctorId: doctors['Dr. Sneha Kulkarni'].id,
      customerId: customers['Ramesh Kumar'].id,
      branchId: branch.id,
      status: PrescriptionStatus.DISPENSED,
      prescriptionDate: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      notes: 'Tab. Dolo 650 1 SOS, Tab. Vitamin C 500mg 1 OD for immunity and metabolic health.',
    },
    {
      prescriptionNumber: 'RX-2026-084',
      patientName: 'Aarav Sharma (Child of Sunita)',
      patientAge: 5,
      patientPhone: '9845054321',
      doctorName: 'Dr. Priya Patel',
      doctorRegNumber: 'KMC-52190',
      doctorId: doctors['Dr. Priya Patel'].id,
      customerId: customers['Sunita Sharma'].id,
      branchId: branch.id,
      status: PrescriptionStatus.PENDING,
      prescriptionDate: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      notes: 'Calpol Pead 120mg Susp 5ml TDS x 3 days, lukewarm sponging, check temperature TDS.',
    },
    {
      prescriptionNumber: 'RX-2026-085',
      patientName: 'Mohammed Farooq',
      patientAge: 61,
      patientPhone: '9845033445',
      doctorName: 'Dr. Suresh Menon',
      doctorRegNumber: 'KMC-29401',
      doctorId: doctors['Dr. Suresh Menon'].id,
      customerId: customers['Mohammed Farooq'].id,
      branchId: branch.id,
      status: PrescriptionStatus.PENDING,
      prescriptionDate: new Date(now.getTime() - 30 * 60 * 1000),
      notes: 'Cough Syrup 100ml 10ml BD after meals x 5 days, warm saline gargling.',
    },
  ]

  const rxMap: Record<string, any> = {}
  for (const rx of rxDefs) {
    let existing = await prisma.prescription.findFirst({ where: { prescriptionNumber: rx.prescriptionNumber } })
    if (!existing) {
      existing = await prisma.prescription.create({ data: rx })
    }
    rxMap[rx.prescriptionNumber] = existing
  }
  console.log(`  ✓ ${Object.keys(rxMap).length} prescriptions ready`)

  // ─────────────────────────────────────────────────────────────
  // 6. CLEAN PREVIOUS SALES BEFORE RE-CREATING
  // ─────────────────────────────────────────────────────────────
  console.log('🧹 Cleaning previous sales and sales movements for fresh start...')
  await prisma.doctorCommission.deleteMany({ where: { sale: { branchId: branch.id } } })
  await prisma.payment.deleteMany({ where: { sale: { branchId: branch.id } } })
  await prisma.inventoryMovement.deleteMany({ where: { inventory: { branchId: branch.id } } })
  await prisma.saleItemBatch.deleteMany({ where: { saleItem: { sale: { branchId: branch.id } } } })
  await prisma.saleItem.deleteMany({ where: { sale: { branchId: branch.id } } })
  await prisma.sale.deleteMany({ where: { branchId: branch.id } })

  // ─────────────────────────────────────────────────────────────
  // 7. REAL-TIME SALES & COUNTER TRANSACTIONS
  // ─────────────────────────────────────────────────────────────
  console.log('💳 Seeding Real-Time Sales & Counter Transactions...')
  const pDolo650 = prodBySku['DLO-650'] || productList[0]
  const pDolo500 = prodBySku['DLO-500'] || productList[1]
  const pCal650 = prodBySku['CAL-650'] || productList[3]
  const pP650 = prodBySku['P650-TAB'] || productList[4]
  const pAmx = prodBySku['AMX-500'] || productList[2]
  const pCfs = prodBySku['CFS-100'] || productList[5]
  const pVtc = prodBySku['VTC-500'] || productList[6]
  const pBet = prodBySku['BET-OIN-20'] || productList[7]

  const salesSchedule = [
    // ── TODAY (2026-09-24) ──
    {
      invoiceNumber: 'INV-2026-0101',
      customer: customers['Ramesh Kumar'],
      doctor: doctors['Dr. Sneha Kulkarni'],
      prescription: rxMap['RX-2026-083'],
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15),
      paymentMethod: PaymentMethod.UPI,
      paymentRef: 'UPI/20260924/842109/GPay',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pDolo650, qty: 2, price: 33.6, taxRate: 12.0 },
        { prod: pVtc, qty: 1, price: 120.0, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0102',
      customer: customers['Walk-in Customer'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30),
      paymentMethod: PaymentMethod.CASH,
      paymentRef: null,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pDolo650, qty: 1, price: 33.6, taxRate: 12.0 },
        { prod: pCfs, qty: 1, price: 65.0, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0103',
      customer: customers['Anita Desai'],
      doctor: doctors['Dr. Rajesh Sharma'],
      prescription: rxMap['RX-2026-081'],
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 45),
      paymentMethod: PaymentMethod.CARD,
      paymentRef: 'CARD-VISA-4821',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pAmx, qty: 2, price: 85.0, taxRate: 12.0 },
        { prod: pBet, qty: 1, price: 55.0, taxRate: 12.0 },
        { prod: pDolo650, qty: 1, price: 33.6, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0104',
      customer: customers['Sunita Sharma'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 10),
      paymentMethod: PaymentMethod.UPI,
      paymentRef: 'UPI/20260924/774912/PhonePe',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pCal650, qty: 2, price: 32.8, taxRate: 12.0 },
        { prod: pVtc, qty: 1, price: 120.0, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0105',
      customer: customers['Rajesh Varma'],
      doctor: doctors['Dr. Arvind Kumar'],
      prescription: rxMap['RX-2026-082'],
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 40),
      paymentMethod: PaymentMethod.CASH,
      paymentRef: null,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pP650, qty: 3, price: 30.5, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0106',
      customer: customers['Walk-in Customer'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 15),
      paymentMethod: PaymentMethod.UPI,
      paymentRef: 'UPI/20260924/110934/Paytm',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pDolo500, qty: 1, price: 16.2, taxRate: 12.0 },
        { prod: pCfs, qty: 1, price: 65.0, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0107',
      customer: customers['Mohammed Farooq'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 30),
      paymentMethod: PaymentMethod.CASH,
      paymentRef: null,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pCal650, qty: 2, price: 32.8, taxRate: 12.0 },
        { prod: pAmx, qty: 1, price: 85.0, taxRate: 12.0 },
      ],
    },

    // ── YESTERDAY (2026-09-23) ──
    {
      invoiceNumber: 'INV-2026-0098',
      customer: customers['Anita Desai'],
      doctor: doctors['Dr. Rajesh Sharma'],
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 11, 0),
      paymentMethod: PaymentMethod.CREDIT,
      paymentRef: 'PARTIAL-CASH-300',
      paymentStatus: PaymentStatus.PARTIAL,
      partialPaid: 300.0,
      items: [
        { prod: pAmx, qty: 3, price: 85.0, taxRate: 12.0 },
        { prod: pVtc, qty: 2, price: 120.0, taxRate: 12.0 },
        { prod: pDolo650, qty: 2, price: 33.6, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0099',
      customer: customers['Rajesh Varma'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 30),
      paymentMethod: PaymentMethod.CASH,
      paymentRef: null,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pP650, qty: 4, price: 30.5, taxRate: 12.0 },
        { prod: pCal650, qty: 2, price: 32.8, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0100',
      customer: customers['Walk-in Customer'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 16, 45),
      paymentMethod: PaymentMethod.UPI,
      paymentRef: 'UPI/20260923/991204',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pDolo650, qty: 2, price: 33.6, taxRate: 12.0 },
        { prod: pVtc, qty: 1, price: 120.0, taxRate: 12.0 },
      ],
    },

    // ── 2 DAYS AGO (2026-09-22) ──
    {
      invoiceNumber: 'INV-2026-0095',
      customer: customers['Ramesh Kumar'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 10, 15),
      paymentMethod: PaymentMethod.UPI,
      paymentRef: 'UPI/20260922/551029',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pVtc, qty: 2, price: 120.0, taxRate: 12.0 },
        { prod: pDolo650, qty: 2, price: 33.6, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0096',
      customer: customers['Sunita Sharma'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 13, 45),
      paymentMethod: PaymentMethod.CARD,
      paymentRef: 'CARD-VISA-1102',
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pAmx, qty: 2, price: 85.0, taxRate: 12.0 },
        { prod: pCfs, qty: 2, price: 65.0, taxRate: 12.0 },
        { prod: pBet, qty: 1, price: 55.0, taxRate: 12.0 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-0097',
      customer: customers['Walk-in Customer'],
      doctor: null,
      prescription: null,
      saleDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 17, 20),
      paymentMethod: PaymentMethod.CASH,
      paymentRef: null,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { prod: pDolo500, qty: 2, price: 16.2, taxRate: 12.0 },
        { prod: pCfs, qty: 1, price: 65.0, taxRate: 12.0 },
      ],
    },
  ]

  for (const s of salesSchedule) {
    let subtotal = 0
    let totalTax = 0

    const saleItemCreates: any[] = []
    const movementCreates: any[] = []

    for (const item of s.items) {
      const lineSubtotal = Math.round(item.qty * item.price * 100) / 100
      const lineTax = Math.round((lineSubtotal * item.taxRate) / 100 * 100) / 100
      const lineTotal = lineSubtotal + lineTax
      const cgstPercent = item.taxRate / 2
      const sgstPercent = item.taxRate / 2

      subtotal += lineSubtotal
      totalTax += lineTax

      const batch = item.prod.batches[0]
      const inv = item.prod.inventory[0]

      saleItemCreates.push({
        productId: item.prod.id,
        productName: item.prod.name,
        productSku: item.prod.sku,
        quantity: item.qty,
        unitPrice: item.price,
        mrp: item.prod.mrp,
        discountPercent: 0,
        discountAmount: 0,
        taxPercent: item.taxRate,
        cgstPercent,
        sgstPercent,
        igstPercent: 0,
        taxAmount: lineTax,
        totalAmount: lineTotal,
        hsnCode: item.prod.hsnCode ?? '3004',
        itemBatches: batch
          ? {
              create: [
                {
                  batchId: batch.id,
                  quantity: item.qty,
                  unitPrice: item.price,
                },
              ],
            }
          : undefined,
      })

      if (inv) {
        movementCreates.push({
          inv,
          batch,
          qty: item.qty,
          prodName: item.prod.name,
        })
      }
    }

    const gross = subtotal + totalTax
    const netTotal = Math.round(gross)
    const roundOff = Math.round((netTotal - gross) * 100) / 100
    const cgstAmount = Math.round((totalTax / 2) * 100) / 100
    const sgstAmount = totalTax - cgstAmount

    const amountPaid = s.partialPaid !== undefined ? s.partialPaid : netTotal
    const balanceDue = netTotal - amountPaid

    const doctorCommissionPercent = s.doctor ? 5.0 : null
    const doctorCommissionAmount = s.doctor ? Math.round((subtotal * 0.05) * 100) / 100 : null

    const createdSale = await prisma.sale.create({
      data: {
        invoiceNumber: s.invoiceNumber,
        branchId: branch.id,
        customerId: s.customer?.id,
        prescriptionId: s.prescription?.id,
        doctorId: s.doctor?.id,
        doctorName: s.doctor?.name,
        doctorCommissionPercent,
        doctorCommissionAmount,
        saleDate: s.saleDate,
        subtotal,
        discountAmount: 0,
        discountPercent: 0,
        roundOff,
        taxAmount: totalTax,
        cgstAmount,
        sgstAmount,
        igstAmount: 0,
        totalAmount: netTotal,
        amountPaid,
        balanceDue,
        status: SaleStatus.COMPLETED,
        paymentStatus: s.paymentStatus,
        createdById: user.id,
        createdAt: s.saleDate,
        items: {
          create: saleItemCreates,
        },
        payments: {
          create: [
            {
              customerId: s.customer?.id,
              method: s.paymentMethod,
              amount: amountPaid,
              reference: s.paymentRef,
              paymentDate: s.saleDate,
              createdAt: s.saleDate,
            },
          ],
        },
      },
    })

    // Record Doctor Commission with all required fields
    if (s.doctor && doctorCommissionAmount) {
      await prisma.doctorCommission.create({
        data: {
          doctorId: s.doctor.id,
          saleId: createdSale.id,
          saleAmount: subtotal,
          commissionAmount: doctorCommissionAmount,
          commissionPercent: 5.0,
          isPaid: false,
          createdAt: s.saleDate,
        },
      })
    }

    // Record Outward Inventory Movements for Sale
    for (const m of movementCreates) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryId: m.inv.id,
          type: MovementType.OUT,
          quantity: m.qty,
          quantityBefore: m.inv.totalQuantity,
          quantityAfter: Math.max(0, m.inv.totalQuantity - m.qty),
          referenceType: 'SALE',
          referenceId: createdSale.id,
          batchId: m.batch?.id,
          notes: `Counter sale dispensed under invoice ${s.invoiceNumber}`,
          createdById: user.id,
          createdAt: s.saleDate,
        },
      })

      // Update Batch sold quantity & Inventory available quantity
      if (m.batch) {
        await prisma.batch.update({
          where: { id: m.batch.id },
          data: {
            soldQuantity: { increment: m.qty },
          },
        })
      }
      await prisma.inventory.update({
        where: { id: m.inv.id },
        data: {
          totalQuantity: { decrement: m.qty },
          availableQuantity: { decrement: m.qty },
        },
      })
    }
  }

  console.log(`  ✓ Successfully created ${salesSchedule.length} real sales transactions (7 today, 6 historical)`)

  // Update Branch invoice counter
  await prisma.branch.update({
    where: { id: branch.id },
    data: { invoiceCounter: 108 },
  })

  console.log('\n✨ All Real-Time Interconnected Pharmaceutical Data Successfully Seeded!')
}

main()
  .catch((e) => {
    console.error('❌ Real-time seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
