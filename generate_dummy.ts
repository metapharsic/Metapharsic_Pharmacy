import fs from "fs";
import path from "path";

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#\s]+?)=(.*)$/);
        if (match) {
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            process.env[match[1].trim()] = val;
        }
    });
}
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');
    envLocalContent.split('\n').forEach(line => {
        const match = line.match(/^([^#\s]+?)=(.*)$/);
        if (match) {
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            process.env[match[1].trim()] = val;
        }
    });
}

import { PaymentMethod, PrescriptionStatus, PrismaClient, PurchaseStatus } from "@prisma/client";
const prisma = new PrismaClient();

function randomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDateToRxNumber(date: Date, index: number) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = String(1000 + index).slice(-4);
    return `RX-${y}${m}${d}-${suffix}`;
}

async function main() {
    console.log("🚀 Starting comprehensive database data generation & binding...\n");

    const admin = await prisma.user.findFirst({ where: { email: 'admin@pharmacare.local' } }) || await prisma.user.findFirst();
    const pharmacist = await prisma.user.findFirst({ where: { email: 'pharmacist@pharmacare.local' } }) || admin;
    const branch = await prisma.branch.findFirst({ where: { isHeadOffice: true } }) || await prisma.branch.findFirst();

    if (!admin || !branch) {
        throw new Error("Missing required Admin user or Branch in database. Please run npm run db:seed first.");
    }

    console.log(`👤 Using Admin: ${admin.name} (${admin.email})`);
    console.log(`🏢 Using Branch: ${branch.name}`);

    // ─────────────────────────────────────────────────────────────
    // 1. DOCTORS
    // ─────────────────────────────────────────────────────────────
    console.log("\n👨‍⚕️  Verifying & Seeding Doctors...");
    const sampleDoctors = [
        {
            name: 'Dr. Rajesh Sharma',
            regNumber: 'MCI-48291',
            qualification: 'MBBS, MD (General Medicine)',
            specialization: 'General Physician',
            clinicName: 'City Care Clinic & Diagnostics',
            phone: '9820145678',
            email: 'dr.sharma@citycare.local',
            commissionPercent: 5.0,
            isActive: true,
            notes: 'Primary referral physician for hypertension & diabetes',
        },
        {
            name: 'Dr. Priya Nair',
            regNumber: 'KMC-39102',
            qualification: 'MBBS, DGO, MS (Obstetrics & Gynaecology)',
            specialization: 'Gynecologist',
            clinicName: 'Mother & Child Healthcare Clinic',
            phone: '9845012345',
            email: 'dr.priya@motherchild.local',
            commissionPercent: 7.5,
            isActive: true,
            notes: 'Prescribes prenatal vitamins, iron supplements & pediatric care',
        },
        {
            name: 'Dr. Amitav Banerjee',
            regNumber: 'WBMC-55210',
            qualification: 'MBBS, MD, DM (Cardiology)',
            specialization: 'Cardiologist',
            clinicName: 'Heartline Cardiac Centre',
            phone: '9831098765',
            email: 'dr.banerjee@heartline.local',
            commissionPercent: 5.0,
            isActive: true,
            notes: 'Cardiac and lipid management prescriber',
        },
        {
            name: 'Dr. Sunita Deshmukh',
            regNumber: 'MMC-67890',
            qualification: 'MBBS, DNB (Pediatrics)',
            specialization: 'Pediatrician',
            clinicName: 'Little Smiles Pediatric Clinic',
            phone: '9822054321',
            email: 'dr.sunita@littlesmiles.local',
            commissionPercent: 6.0,
            isActive: true,
            notes: 'Pediatric antibiotic and vaccine prescriber',
        },
        {
            name: 'Dr. Vikramaditya Rao',
            regNumber: 'APMC-22441',
            qualification: 'MBBS, MS (Orthopaedics)',
            specialization: 'Orthopedic Surgeon',
            clinicName: 'Spine & Bone Ortho Center',
            phone: '9849033445',
            email: 'dr.rao@orthocenter.local',
            commissionPercent: 8.0,
            isActive: true,
            notes: 'NSAIDs, analgesics, and calcium supplement prescriber',
        },
    ];

    const doctors = [];
    for (const d of sampleDoctors) {
        let doc = await prisma.doctor.findFirst({
            where: { OR: [{ name: d.name }, { regNumber: d.regNumber }] }
        });
        if (!doc) {
            doc = await prisma.doctor.create({ data: d });
        }
        doctors.push(doc);
    }
    console.log(`  ✓ ${doctors.length} doctors ready.`);

    // ─────────────────────────────────────────────────────────────
    // 2. CUSTOMERS / PATIENTS
    // ─────────────────────────────────────────────────────────────
    console.log("\n👥 Verifying & Seeding Customers / Patients...");
    const samplePatients = [
        { name: "Rahul Verma", age: 34, phone: "9819234567", email: "rahul.verma@example.com", address: "Flat 402, Green Valley Apartments", city: "Mumbai" },
        { name: "Ananya Sengupta", age: 28, phone: "9820345678", email: "ananya.s@example.com", address: "12 Lake View Road", city: "Kolkata" },
        { name: "Vikram Malhotra", age: 52, phone: "9831456789", email: "v.malhotra@example.com", address: "78 Park Street", city: "Delhi" },
        { name: "Meenakshi Sundaram", age: 61, phone: "9840567890", email: "meenakshi.s@example.com", address: "23 Temple Street", city: "Chennai" },
        { name: "Mohammed Farhan", age: 45, phone: "9849678901", email: "farhan.m@example.com", address: "Plot 15, Banjara Hills", city: "Hyderabad" },
        { name: "Deepa Kulkarni", age: 39, phone: "9822789012", email: "deepa.k@example.com", address: "44 Shivaji Nagar", city: "Pune" },
        { name: "Arjun Mehta", age: 24, phone: "9876890123", email: "arjun.m@example.com", address: "502 Satellite Road", city: "Ahmedabad" },
        { name: "Kavita Reddy", age: 48, phone: "9885901234", email: "kavita.r@example.com", address: "88 Indiranagar 100ft Road", city: "Bangalore" },
        { name: "Suresh Narang", age: 57, phone: "9896012345", email: "suresh.n@example.com", address: "10 Rajendra Place", city: "Delhi" },
        { name: "Pooja Hegde", age: 31, phone: "9845123456", email: "pooja.h@example.com", address: "67 Koramangala 4th Block", city: "Bangalore" },
    ];

    const customers = [];
    for (const p of samplePatients) {
        let cust = await prisma.customer.findFirst({ where: { phone: p.phone } });
        if (!cust) {
            cust = await prisma.customer.create({
                data: {
                    name: p.name,
                    phone: p.phone,
                    email: p.email,
                    address: p.address,
                    city: p.city,
                    state: "Karnataka",
                    pincode: "560001",
                    creditLimit: 5000,
                    creditDays: 30,
                }
            });
        }
        customers.push({ ...cust, age: p.age });
    }
    console.log(`  ✓ ${customers.length} patient profiles ready.`);

    // ─────────────────────────────────────────────────────────────
    // 3. INVENTORY & BATCHES
    // ─────────────────────────────────────────────────────────────
    console.log("\n📦 Ensuring Products, Batches & Inventory...");
    const products = await prisma.product.findMany({ take: 50 });
    if (products.length === 0) {
        throw new Error("No products found! Please seed products first.");
    }

    const batches = [];
    for (const p of products) {
        let batch = await prisma.batch.findFirst({ where: { productId: p.id, branchId: branch.id } });
        if (!batch) {
            const batchNumber = `B-${Date.now().toString().slice(-5)}-${Math.floor(100 + Math.random() * 900)}`;
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 2);
            batch = await prisma.batch.create({
                data: {
                    productId: p.id,
                    batchNumber,
                    expiryDate,
                    purchasePrice: Number(p.costPrice || 45),
                    mrp: Number(p.mrp || 100),
                    quantity: 150,
                    branchId: branch.id,
                    status: 'ACTIVE'
                }
            });

            const inv = await prisma.inventory.upsert({
                where: { productId_branchId: { productId: p.id, branchId: branch.id } },
                update: {
                    totalQuantity: { increment: 150 },
                    availableQuantity: { increment: 150 },
                },
                create: {
                    productId: p.id,
                    branchId: branch.id,
                    totalQuantity: 150,
                    availableQuantity: 150,
                }
            });

            await prisma.inventoryMovement.create({
                data: {
                    inventoryId: inv.id,
                    type: 'IN',
                    quantity: 150,
                    quantityBefore: inv.availableQuantity - 150,
                    quantityAfter: inv.availableQuantity,
                    createdById: admin.id,
                    batchId: batch.id
                }
            });
        }
        batches.push(batch);
    }
    console.log(`  ✓ ${batches.length} product batches active in inventory.`);

    // ─────────────────────────────────────────────────────────────
    // 4. SUPPLIERS & PURCHASES
    // ─────────────────────────────────────────────────────────────
    console.log("\n🚚 Checking Suppliers & Purchase Orders...");
    let supplier = await prisma.supplier.findFirst();
    if (!supplier) {
        supplier = await prisma.supplier.create({
            data: {
                name: 'MedLife Healthcare Distributors',
                contactPerson: 'Vikram Patel',
                phone: '9876500001',
                email: 'orders@medlife-dist.com',
                gstin: '29ABCDE1234F1Z1',
                dlNumber: 'DL-KA-SUP-01',
                city: 'Bangalore',
                state: 'Karnataka',
                pincode: '560099',
            }
        });
    }

    const purchaseCount = await prisma.purchase.count();
    if (purchaseCount === 0) {
        console.log("  Generating sample purchase orders...");
        for (let i = 1; i <= 3; i++) {
            const prod = products[i];
            const purchaseDate = new Date();
            purchaseDate.setDate(purchaseDate.getDate() - (i * 10));
            const subtotal = 4500.00;
            const taxAmount = 540.00;
            const totalAmount = 5040.00;

            await prisma.purchase.create({
                data: {
                    purchaseNumber: `PO-${purchaseDate.getFullYear()}-${String(i).padStart(4, '0')}`,
                    branchId: branch.id,
                    supplierId: supplier.id,
                    invoiceNumber: `SUP-INV-2026-${i * 142}`,
                    invoiceDate: purchaseDate,
                    purchaseDate,
                    status: PurchaseStatus.RECEIVED,
                    subtotal,
                    taxAmount,
                    totalAmount,
                    amountPaid: totalAmount,
                    balanceDue: 0,
                    createdById: admin.id,
                    items: {
                        create: [
                            {
                                productId: prod.id,
                                orderedQuantity: 100,
                                receivedQuantity: 100,
                                unitCost: 45.00,
                                mrp: 100.00,
                                taxPercent: 12.00,
                                taxAmount: 540.00,
                                totalAmount: 5040.00,
                                batchNumber: `B-PUR-${Date.now().toString().slice(-4)}-${i}`,
                                expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
                            }
                        ]
                    }
                }
            });
        }
        console.log("  ✓ Seeded 3 verified purchase orders.");
    }

    // ─────────────────────────────────────────────────────────────
    // 5. PRESCRIPTIONS (Properly Bound & Validated)
    // ─────────────────────────────────────────────────────────────
    console.log("\n💊 Generating & Binding Prescriptions...");

    const clinicalPrescriptionsData = [
        // ── PENDING REVIEW (8 prescriptions) ──
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 0,
            doctorIdx: 0,
            daysAgo: 1,
            notes: "Rx: Tab Augmentin 625mg (Amoxicillin + Potassium Clavulanate) TDS x 5 days.\nTab Pantoprazole 40mg OD before breakfast x 5 days.\nTab Paracetamol 650mg SOS for body ache/fever.\nAdvice: Hydration, review after 5 days if cough persists.",
            images: [
                { fileName: "rx_scan_rahul_augmentin.jpg", fileUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 1,
            doctorIdx: 1,
            daysAgo: 2,
            notes: "Rx: Cap Folvite 5mg OD x 30 days.\nTab Orofer XT (Ferrous Ascorbate + Folic Acid) OD post-dinner x 30 days.\nTab Shelcal 500mg (Calcium + Vit D3) OD afternoon.\nAdvice: Follow up in ANC clinic in 4 weeks with CBC report.",
            images: [
                { fileName: "anc_prescription_dr_priya.pdf", fileUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 2,
            doctorIdx: 2,
            daysAgo: 1,
            notes: "Rx: Tab Telmisartan 40mg + Amlodipine 5mg OD morning after breakfast.\nTab Atorvastatin 20mg OD at bedtime.\nTab Ecosprin 75mg OD after lunch.\nAdvice: BP charting weekly, low sodium diet, avoid strenuous exertion.",
            images: [
                { fileName: "cardiac_rx_malhotra.jpg", fileUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 3,
            doctorIdx: 0,
            daysAgo: 3,
            notes: "Rx: Tab Metformin 500mg SR BD after meals.\nTab Glimepiride 1mg OD before breakfast.\nCap Evion 400mg OD x 15 days.\nAdvice: Fasting & PP blood sugar tracking, diabetic foot care.",
            images: [
                { fileName: "rx_dr_sharma_diabetes.jpg", fileUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 4,
            doctorIdx: 3,
            daysAgo: 2,
            notes: "Rx: Syr Meftal-P 5ml SOS fever > 100°F (Max 3 times a day).\nSyr Ascoril-LS 2.5ml TDS x 5 days.\nSaline nasal drops 2 drops in each nostril TID.\nAdvice: Steam inhalation, plenty of fluids.",
            images: [
                { fileName: "pediatric_rx_farhan.jpg", fileUrl: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 5,
            doctorIdx: 4,
            daysAgo: 1,
            notes: "Rx: Tab Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg BD x 5 days.\nCap Rabeprazole 20mg OD before breakfast x 5 days.\nVolini gel local application BD.\nAdvice: Knee brace support, avoid squatting.",
            images: [
                { fileName: "ortho_rx_kulkarni.jpg", fileUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 6,
            doctorIdx: 0,
            daysAgo: 4,
            notes: "Rx: Tab Montelukast 10mg + Levocetirizine 5mg OD at night x 10 days.\nBudesonide + Formoterol inhaler 200mcg 1 puff BD x 1 month.\nAdvice: Gargle with warm water after inhaler use.",
            images: [
                { fileName: "asthma_rx_mehta.jpg", fileUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.PENDING,
            patientIdx: 7,
            doctorIdx: 1,
            daysAgo: 2,
            notes: "Rx: Tab Tranexamic Acid 500mg + Mefenamic Acid 250mg TDS during heavy flow x 3 days.\nTab Dydrogesterone 10mg BD from day 16 to 25 of cycle.\nAdvice: Pelvic ultrasound review.",
            images: [
                { fileName: "gynae_rx_reddy.jpg", fileUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=60" }
            ],
        },

        // ── APPROVED (8 prescriptions) ──
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 8,
            doctorIdx: 2,
            daysAgo: 5,
            notes: "Rx: Tab Rosuvastatin 10mg OD HS.\nTab Metoprolol Succinate 25mg OD morning.\nTab Aspirin 75mg OD post lunch.\nPharmacist Note: Verified Schedule H compliance. Prescriber MCI reg verified.",
            images: [
                { fileName: "rx_cardiac_narang.jpg", fileUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 9,
            doctorIdx: 0,
            daysAgo: 6,
            notes: "Rx: Tab Cefixime 200mg BD x 7 days.\nTab Linezolid 600mg BD x 5 days.\nSyr Di-Gel 10ml TDS after meals.\nPharmacist Note: Schedule H1 antibiotic register entry recorded.",
            images: [
                { fileName: "rx_cefixime_hegde.pdf", fileUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 0,
            doctorIdx: 4,
            daysAgo: 7,
            notes: "Rx: Tab Etoricoxib 90mg OD x 5 days.\nTab Thiocolchicoside 4mg BD x 5 days.\nPharmacist Note: Approved for acute lumbago dispensing.",
            images: [
                { fileName: "ortho_rx_verma_etoricoxib.jpg", fileUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 1,
            doctorIdx: 0,
            daysAgo: 8,
            notes: "Rx: Tab Azithromycin 500mg OD x 3 days.\nTab Levocetirizine 5mg OD HS x 5 days.\nPharmacist Note: Validated. Prescribed duration verified.",
            images: [
                { fileName: "rx_azithro_sengupta.jpg", fileUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 2,
            doctorIdx: 3,
            daysAgo: 9,
            notes: "Rx: Syr Cefpodoxime 50mg/5ml - 5ml BD x 5 days.\nSyr Levolin 2.5ml BD x 5 days.\nPharmacist Note: Paediatric dosage re-checked by body weight.",
            images: [
                { fileName: "rx_ped_cefpodoxime.jpg", fileUrl: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 3,
            doctorIdx: 1,
            daysAgo: 10,
            notes: "Rx: Cap Doxycycline 100mg BD post-meal x 7 days.\nTab Metronidazole 400mg TDS x 5 days.\nPharmacist Note: Checked contraindications with patient profile.",
            images: [
                { fileName: "rx_gyn_doxy.jpg", fileUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 4,
            doctorIdx: 2,
            daysAgo: 11,
            notes: "Rx: Tab Clopidogrel 75mg OD.\nTab Atorvastatin 40mg OD HS.\nTab Pantoprazole 40mg OD.\nPharmacist Note: Regular refill approved.",
            images: [
                { fileName: "rx_clopidogrel_refill.jpg", fileUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.APPROVED,
            patientIdx: 5,
            doctorIdx: 0,
            daysAgo: 12,
            notes: "Rx: Tab Ofloxacin 200mg + Ornidazole 500mg BD x 5 days.\nElectral ORS sachets - 2 packets in 1L water daily.\nPharmacist Note: Gastro consultation verified.",
            images: [
                { fileName: "rx_oflox_ornidazole.jpg", fileUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&auto=format&fit=crop&q=60" }
            ],
        },

        // ── DISPENSED (7 prescriptions, linked to Sales) ──
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 6,
            doctorIdx: 0,
            daysAgo: 14,
            notes: "Rx: Tab Amoxicillin 500mg TDS x 5 days.\nTab Paracetamol 650mg SOS.\nDispensing Note: Full course dispensed with batch tracking and invoice issued.",
            images: [
                { fileName: "dispensed_rx_amox.jpg", fileUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 7,
            doctorIdx: 4,
            daysAgo: 15,
            notes: "Rx: Tab Diclofenac Sodium 50mg + Paracetamol 325mg BD x 3 days.\nDispensing Note: Patient counselled regarding food intake with NSAIDs.",
            images: [
                { fileName: "dispensed_rx_diclo.jpg", fileUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 8,
            doctorIdx: 2,
            daysAgo: 16,
            notes: "Rx: Tab Telmisartan 40mg OD x 30 days.\nDispensing Note: 1 month supply dispensed. Refill permitted in 28 days.",
            images: [
                { fileName: "dispensed_rx_telmisartan.jpg", fileUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 9,
            doctorIdx: 1,
            daysAgo: 18,
            notes: "Rx: Tab Calcium Carbonate 1250mg + Vit D3 OD x 60 days.\nDispensing Note: Dispensed 2 boxes.",
            images: [
                { fileName: "dispensed_rx_calcium.jpg", fileUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 0,
            doctorIdx: 0,
            daysAgo: 20,
            notes: "Rx: Tab Pantoprazole DSR OD before food x 15 days.\nDispensing Note: Generic substitution explained and accepted by patient.",
            images: [
                { fileName: "dispensed_rx_pantodsr.jpg", fileUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 1,
            doctorIdx: 3,
            daysAgo: 22,
            notes: "Rx: Syr Paracetamol 250mg/5ml SOS.\nDispensing Note: Measured dispensing syringe provided to guardian.",
            images: [
                { fileName: "dispensed_rx_pcm_syr.jpg", fileUrl: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.DISPENSED,
            patientIdx: 2,
            doctorIdx: 2,
            daysAgo: 25,
            notes: "Rx: Tab Atorvastatin 10mg OD HS x 30 days.\nDispensing Note: Chronic medication refill logged in patient profile.",
            images: [
                { fileName: "dispensed_rx_atorva.jpg", fileUrl: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=800&auto=format&fit=crop&q=60" }
            ],
        },

        // ── REJECTED (3 prescriptions with regulatory/clinical reasons) ──
        {
            status: PrescriptionStatus.REJECTED,
            patientIdx: 3,
            doctorIdx: 0,
            daysAgo: 7,
            notes: "Rx: Tab Alprazolam 0.5mg OD at night x 15 days.",
            rejectionReason: "Schedule H1 / X narcotic prescription missing physical doctor signature and clinic seal. Digital printout without tamper-evident verification is not permissible under Pharmacy Act.",
            images: [
                { fileName: "rejected_rx_alprazolam.jpg", fileUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.REJECTED,
            patientIdx: 4,
            doctorIdx: 4,
            daysAgo: 13,
            notes: "Rx: Tab Tramadol 50mg SOS for backache.",
            rejectionReason: "Prescription date exceeds permissible 15-day validity window for Schedule H opioid analgesics. Patient advised to obtain a refreshed consult.",
            images: [
                { fileName: "rejected_rx_expired_tramadol.jpg", fileUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&auto=format&fit=crop&q=60" }
            ],
        },
        {
            status: PrescriptionStatus.REJECTED,
            patientIdx: 5,
            doctorIdx: 1,
            daysAgo: 19,
            notes: "Rx: Tab Doxycycline 100mg BD x 14 days.",
            rejectionReason: "Prescribing physician medical council registration number (MCI/SMC) is missing on the prescription slip. Regulatory compliance requires mandatory registration display.",
            images: [
                { fileName: "rejected_rx_missing_reg.pdf", fileUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=60" }
            ],
        },
    ];

    let createdCount = 0;
    for (let i = 0; i < clinicalPrescriptionsData.length; i++) {
        const item = clinicalPrescriptionsData[i];
        const cust = customers[item.patientIdx];
        const doc = doctors[item.doctorIdx];

        const rxDate = new Date();
        rxDate.setDate(rxDate.getDate() - item.daysAgo);
        const rxNumber = formatDateToRxNumber(rxDate, i + 1);

        // Check if prescription already exists by prescriptionNumber
        const existing = await prisma.prescription.findFirst({
            where: { prescriptionNumber: rxNumber }
        });
        if (existing) continue;

        const isApprovedOrDispensed = item.status === PrescriptionStatus.APPROVED || item.status === PrescriptionStatus.DISPENSED;
        const approvedAt = isApprovedOrDispensed ? new Date(rxDate.getTime() + 1000 * 60 * 45) : null;
        const approvedById = isApprovedOrDispensed ? (pharmacist?.id || admin.id) : null;

        const prescription = await prisma.prescription.create({
            data: {
                prescriptionNumber: rxNumber,
                patientName: cust.name,
                patientAge: cust.age,
                patientPhone: cust.phone,
                doctorName: doc.name,
                doctorRegNumber: doc.regNumber,
                doctorId: doc.id,
                customerId: cust.id,
                branchId: branch.id,
                prescriptionDate: rxDate,
                status: item.status,
                notes: item.notes,
                approvedById,
                approvedAt,
                rejectionReason: item.rejectionReason ?? null,
                createdAt: rxDate,
                updatedAt: approvedAt || rxDate,
                images: {
                    create: item.images.map(img => ({
                        fileName: img.fileName,
                        fileUrl: img.fileUrl,
                        fileSize: Math.floor(180000 + Math.random() * 250000),
                        mimeType: img.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                    }))
                }
            }
        });

        // If DISPENSED, bind to an actual Sale record
        if (item.status === PrescriptionStatus.DISPENSED) {
            const prod = products[i % products.length];
            const batch = batches[i % batches.length];
            const qty = 2;
            const price = Number(batch.mrp || 100);
            const totalAmount = qty * price;
            const saleDate = new Date(rxDate.getTime() + 1000 * 60 * 90);

            const sale = await prisma.sale.create({
                data: {
                    invoiceNumber: `INV-RX-${rxDate.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
                    branchId: branch.id,
                    customerId: cust.id,
                    doctorId: doc.id,
                    prescriptionId: prescription.id,
                    saleDate,
                    subtotal: totalAmount,
                    totalAmount,
                    amountPaid: totalAmount,
                    status: 'COMPLETED',
                    paymentStatus: 'PAID',
                    createdById: pharmacist?.id || admin.id,
                    createdAt: saleDate,
                    items: {
                        create: [
                            {
                                productId: prod.id,
                                productName: prod.name,
                                productSku: prod.sku,
                                quantity: qty,
                                unitPrice: price,
                                mrp: price,
                                totalAmount,
                                itemBatches: {
                                    create: [{ batchId: batch.id, quantity: qty, unitPrice: price }]
                                }
                            }
                        ]
                    }
                }
            });

            // Add payment
            await prisma.payment.create({
                data: {
                    saleId: sale.id,
                    customerId: cust.id,
                    method: PaymentMethod.UPI,
                    amount: totalAmount,
                    reference: `UPI-RX-REF-${prescription.id.slice(-6)}`,
                    paymentDate: saleDate,
                    createdAt: saleDate
                }
            });

            // Add doctor commission
            if (doc.commissionPercent && Number(doc.commissionPercent) > 0) {
                const commissionAmount = (totalAmount * Number(doc.commissionPercent)) / 100;
                await prisma.doctorCommission.create({
                    data: {
                        doctorId: doc.id,
                        saleId: sale.id,
                        saleAmount: totalAmount,
                        commissionPercent: Number(doc.commissionPercent),
                        commissionAmount,
                        isPaid: false
                    }
                });
            }
        }

        createdCount++;
    }

    console.log(`  ✓ Created & bound ${createdCount} realistic prescriptions.`);

    // ─────────────────────────────────────────────────────────────
    // 6. SUMMARY REPORT
    // ─────────────────────────────────────────────────────────────
    const totalRx = await prisma.prescription.count();
    const pendingRx = await prisma.prescription.count({ where: { status: 'PENDING' } });
    const approvedRx = await prisma.prescription.count({ where: { status: 'APPROVED' } });
    const dispensedRx = await prisma.prescription.count({ where: { status: 'DISPENSED' } });
    const rejectedRx = await prisma.prescription.count({ where: { status: 'REJECTED' } });

    console.log("\n=========================================");
    console.log("📊 DATABASE STATS SUMMARY");
    console.log("=========================================");
    console.log(`Total Prescriptions : ${totalRx}`);
    console.log(`- Pending Review    : ${pendingRx}`);
    console.log(`- Approved          : ${approvedRx}`);
    console.log(`- Dispensed         : ${dispensedRx}`);
    console.log(`- Rejected          : ${rejectedRx}`);
    console.log(`Total Doctors       : ${await prisma.doctor.count()}`);
    console.log(`Total Customers     : ${await prisma.customer.count()}`);
    console.log(`Total Sales         : ${await prisma.sale.count()}`);
    console.log(`Total Batches       : ${await prisma.batch.count()}`);
    console.log(`Total Purchases     : ${await prisma.purchase.count()}`);
    console.log("=========================================\n");

    console.log("✅ All data successfully generated, validated, and bound to the database!");
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Error generating dummy data:", err);
    process.exit(1);
});
