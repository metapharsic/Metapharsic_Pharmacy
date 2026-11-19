import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding pharmaceutical sub-categories...')

  // 1. Fetch root categories
  const roots = await prisma.category.findMany({
    where: { parentId: null, OR: [{ organizationId: 'default-org' }, { organizationId: null }] },
  })
  const rootMap = new Map(roots.map((r) => [r.slug, r.id]))

  const subCategories = [
    // Under Tablets
    {
      name: 'Antibiotics & Anti-Infectives',
      slug: 'tablets-antibiotics',
      parentSlug: 'tablets',
      description: 'Oral antibiotic formulations and antibacterial agents',
      sortOrder: 1,
    },
    {
      name: 'Analgesics & Pain Relief',
      slug: 'tablets-analgesics',
      parentSlug: 'tablets',
      description: 'NSAIDs, antipyretics, and headache formulations',
      sortOrder: 2,
    },
    {
      name: 'Cardiovascular & Hypertensives',
      slug: 'tablets-cardiac',
      parentSlug: 'tablets',
      description: 'Beta-blockers, statins, and blood pressure regulators',
      sortOrder: 3,
    },
    {
      name: 'Antidiabetic Oral Formulations',
      slug: 'tablets-antidiabetic',
      parentSlug: 'tablets',
      description: 'Metformin, sulfonylureas, and DPP-4 inhibitors',
      sortOrder: 4,
    },
    {
      name: 'Gastrointestinal & Antacids',
      slug: 'tablets-antacids',
      parentSlug: 'tablets',
      description: 'Proton-pump inhibitors (PPIs) and digestive enzymes',
      sortOrder: 5,
    },

    // Under Syrups & Liquids
    {
      name: 'Cough, Cold & Expectorants',
      slug: 'syrups-cough-cold',
      parentSlug: 'syrups-liquids',
      description: 'Cough syrups, expectorants, and antihistamines',
      sortOrder: 1,
    },
    {
      name: 'Antacid & Digestive Suspensions',
      slug: 'syrups-antacids',
      parentSlug: 'syrups-liquids',
      description: 'Gelusil, digene, and liquid laxatives',
      sortOrder: 2,
    },
    {
      name: 'Pediatric Oral Drops & Syrups',
      slug: 'syrups-pediatric',
      parentSlug: 'syrups-liquids',
      description: 'Pediatric suspension formulations',
      sortOrder: 3,
    },

    // Under Injections
    {
      name: 'Antibiotic & Critical Injections',
      slug: 'injections-antibiotics',
      parentSlug: 'injections',
      description: 'IV/IM antibiotic vials and ampoules (Ceftriaxone, Meropenem)',
      sortOrder: 1,
    },
    {
      name: 'Insulins & Biologicals (Cold Chain)',
      slug: 'injections-insulins',
      parentSlug: 'injections',
      description: 'Subcutaneous insulin pens, cartridges, and vials',
      sortOrder: 2,
    },
    {
      name: 'IV Fluids & Large Volume Parenterals',
      slug: 'injections-iv-fluids',
      parentSlug: 'injections',
      description: 'Normal Saline (0.9%), Dextrose, and Ringer Lactate',
      sortOrder: 3,
    },

    // Under Topical / Ointments
    {
      name: 'Antifungal & Antibacterial Creams',
      slug: 'topical-antifungal',
      parentSlug: 'topical-ointments',
      description: 'Topical skin formulations (Clotrimazole, Betamethasone)',
      sortOrder: 1,
    },
    {
      name: 'Pain Relief Ointments & Sprays',
      slug: 'topical-pain-relief',
      parentSlug: 'topical-ointments',
      description: 'Volini, Moov, and joint pain liniments',
      sortOrder: 2,
    },
  ]

  let createdCount = 0
  const createdSubMap = new Map<string, string>()

  for (const sub of subCategories) {
    const parentId = rootMap.get(sub.parentSlug)
    if (!parentId) {
      console.warn(`Parent slug ${sub.parentSlug} not found, skipping ${sub.name}`)
      continue
    }

    const created = await prisma.category.upsert({
      where: { slug: sub.slug },
      update: {
        parentId,
        description: sub.description,
        sortOrder: sub.sortOrder,
        organizationId: 'default-org',
      },
      create: {
        name: sub.name,
        slug: sub.slug,
        parentId,
        description: sub.description,
        sortOrder: sub.sortOrder,
        organizationId: 'default-org',
        isActive: true,
      },
    })
    createdSubMap.set(sub.slug, created.id)
    createdCount++
  }

  console.log(`✓ Seeded ${createdCount} pharmaceutical sub-categories!`)

  // 2. Map existing products into matching subcategories
  console.log('Mapping products into sub-categories...')
  const products = await prisma.product.findMany({
    where: { organizationId: 'default-org' },
    select: { id: true, name: true, genericName: true },
  })

  let mappedCount = 0
  for (const prod of products) {
    const text = `${prod.name} ${prod.genericName || ''}`.toLowerCase()

    let targetSubSlug: string | null = null

    if (text.includes('paracetamol') || text.includes('ibuprofen') || text.includes('dolo') || text.includes('crocin')) {
      targetSubSlug = 'tablets-analgesics'
    } else if (text.includes('amoxicillin') || text.includes('azithromycin') || text.includes('cefixime') || text.includes('cipro')) {
      targetSubSlug = 'tablets-antibiotics'
    } else if (text.includes('telmisartan') || text.includes('amlodipine') || text.includes('atorvastatin')) {
      targetSubSlug = 'tablets-cardiac'
    } else if (text.includes('metformin') || text.includes('glimepiride')) {
      targetSubSlug = 'tablets-antidiabetic'
    } else if (text.includes('pantoprazole') || text.includes('omeprazole') || text.includes('rabeprazole')) {
      targetSubSlug = 'tablets-antacids'
    } else if (text.includes('cough') || text.includes('benadryl') || text.includes('ascoril') || text.includes('syrup')) {
      targetSubSlug = 'syrups-cough-cold'
    } else if (text.includes('insulin') || text.includes('humalog') || text.includes('lantus')) {
      targetSubSlug = 'injections-insulins'
    } else if (text.includes('gel') || text.includes('ointment') || text.includes('cream')) {
      targetSubSlug = 'topical-pain-relief'
    }

    if (targetSubSlug && createdSubMap.has(targetSubSlug)) {
      const subCategoryId = createdSubMap.get(targetSubSlug)!
      await prisma.productCategory.upsert({
        where: {
          productId_categoryId: {
            productId: prod.id,
            categoryId: subCategoryId,
          },
        },
        update: {},
        create: {
          productId: prod.id,
          categoryId: subCategoryId,
        },
      })
      mappedCount++
    }
  }

  console.log(`✓ Mapped ${mappedCount} products into specific sub-categories!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
