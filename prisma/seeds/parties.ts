import type { PrismaClient } from '@prisma/client'

export async function seedParties(prisma: PrismaClient) {
  // Seed sample suppliers
  const suppliers = [
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
  ]

  for (const s of suppliers) {
    const existing = await prisma.supplier.findFirst({
      where: {
        name: s.name,
        OR: [{ organizationId: 'default-org' }, { organizationId: null }],
      },
    })
    if (!existing) {
      await prisma.supplier.create({ data: { ...s, organizationId: 'default-org' } })
    } else {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: { ...s, organizationId: 'default-org' },
      })
    }
  }

  // Seed sample customers
  const customers = [
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
  ]

  for (const c of customers) {
    const existing = await prisma.customer.findFirst({
      where: {
        phone: c.phone,
        OR: [{ organizationId: 'default-org' }, { organizationId: null }],
      },
    })
    if (!existing) {
      await prisma.customer.create({ data: { ...c, organizationId: 'default-org' } })
    } else {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { ...c, organizationId: 'default-org' },
      })
    }
  }

  console.log(`  ✓ Seeded ${suppliers.length} suppliers and ${customers.length} customers`)
}
