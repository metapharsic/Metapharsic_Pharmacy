import type { PrismaClient } from '@prisma/client'

export const SAMPLE_DOCTORS = [
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
]

export async function seedDoctors(prisma: PrismaClient) {
  for (const doc of SAMPLE_DOCTORS) {
    const existing = await prisma.doctor.findFirst({
      where: {
        OR: [
          { name: doc.name, organizationId: 'default-org' },
          { name: doc.name, organizationId: null },
          ...(doc.regNumber
            ? [
                { regNumber: doc.regNumber, organizationId: 'default-org' },
                { regNumber: doc.regNumber, organizationId: null },
              ]
            : []),
        ],
      },
    })

    if (!existing) {
      await prisma.doctor.create({
        data: {
          name: doc.name,
          regNumber: doc.regNumber,
          qualification: doc.qualification,
          specialization: doc.specialization,
          clinicName: doc.clinicName,
          phone: doc.phone,
          email: doc.email,
          commissionPercent: doc.commissionPercent,
          isActive: doc.isActive,
          notes: doc.notes,
          organizationId: 'default-org',
        },
      })
    } else {
      await prisma.doctor.update({
        where: { id: existing.id },
        data: {
          name: doc.name,
          regNumber: doc.regNumber,
          qualification: doc.qualification,
          specialization: doc.specialization,
          clinicName: doc.clinicName,
          phone: doc.phone,
          email: doc.email,
          commissionPercent: doc.commissionPercent,
          isActive: doc.isActive,
          notes: doc.notes,
          organizationId: 'default-org',
        },
      })
    }
  }

  console.log(`  ✓ ${SAMPLE_DOCTORS.length} prescribing doctors seeded`)
}
