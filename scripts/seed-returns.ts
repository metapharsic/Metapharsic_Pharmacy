import { PrismaClient, SaleReturnStatus, CreditNoteStatus, PaymentMethod, RestockDecision } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Seeding Sales Returns & Credit Notes...')

  const admin = await prisma.user.findFirst({ where: { email: 'admin@pharmacare.local' } }) || await prisma.user.findFirst()
  if (!admin) throw new Error('No user found to attribute return processing to')

  // Find sales that have items
  const sales = await prisma.sale.findMany({
    where: {
      status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      items: { some: {} },
    },
    take: 12,
    include: {
      items: {
        include: {
          itemBatches: true,
        },
      },
      customer: true,
    },
  })

  if (sales.length === 0) {
    console.log('No eligible sales found to create returns for.')
    return
  }

  const reasons = [
    'Patient experienced mild dizziness - Doctor altered prescription to lower dose',
    'Customer accidentally purchased duplicate cough syrup bottle - Unopened seal verified',
    'Physician switched oral suspension to chewable tablets for child',
    'Wrong strength dispensed (650mg instead of 500mg) - Exchanged for credit',
    'Patient discharged early from hospital - Unused sealed strips returned',
    'Allergic rash reaction reported - Doctor advised immediate cessation',
    'Doctor changed antibiotic course after pathology culture report',
    'Family member had already purchased medicine from another pharmacy',
  ]

  let returnsCreated = 0
  let creditNotesCreated = 0

  for (let i = 0; i < Math.min(8, sales.length); i++) {
    const sale = sales[i]
    const itemToReturn = sale.items[0]
    if (!itemToReturn) continue

    const returnQty = Math.max(1, Math.min(itemToReturn.quantity, 1 + (i % 2)))
    const unitPrice = Number(itemToReturn.unitPrice)
    const returnTotal = returnQty * unitPrice
    const reason = reasons[i % reasons.length]

    const isCredit = i % 2 === 0
    const status: SaleReturnStatus = isCredit
      ? SaleReturnStatus.CREDITED
      : i === 3
        ? SaleReturnStatus.APPROVED
        : SaleReturnStatus.REFUNDED

    const refundMethod: PaymentMethod | null = isCredit
      ? null
      : i % 2 === 1
        ? PaymentMethod.UPI
        : PaymentMethod.CASH

    // Valid date offset by hours
    const returnDate = new Date(Date.now() - (i + 1) * 3600 * 1000 * 5)
    const y = returnDate.getFullYear()
    const m = String(returnDate.getMonth() + 1).padStart(2, '0')
    const d = String(returnDate.getDate()).padStart(2, '0')
    const returnNumber = `SR-${y}${m}${d}-${String(1001 + i).slice(-4)}`

    // Check if return already exists
    const existing = await prisma.saleReturn.findUnique({ where: { returnNumber } })
    if (existing) continue

    const saleReturn = await prisma.saleReturn.create({
      data: {
        returnNumber,
        saleId: sale.id,
        customerId: sale.customerId,
        returnDate,
        reason,
        totalAmount: returnTotal,
        status,
        refundMethod,
        refundRef: refundMethod === PaymentMethod.UPI ? `UPI-REF-${String(900000 + i)}` : null,
        notes: `Inspected by pharmacist. Pack seal intact. Batch condition verified.`,
        processedById: admin.id,
        createdAt: returnDate,
        items: {
          create: [
            {
              saleItemId: itemToReturn.id,
              quantity: returnQty,
              unitPrice: unitPrice,
              totalAmount: returnTotal,
              restockDecision: i === 5 ? RestockDecision.DAMAGE_WRITE_OFF : RestockDecision.RESTOCK,
              batchId: itemToReturn.itemBatches[0]?.batchId,
            },
          ],
        },
      },
    })

    // Update returnedQuantity on saleItem
    await prisma.saleItem.update({
      where: { id: itemToReturn.id },
      data: {
        returnedQuantity: { increment: returnQty },
      },
    })

    // Update sale status
    await prisma.sale.update({
      where: { id: sale.id },
      data: { status: 'PARTIALLY_RETURNED' },
    })

    // If CREDITED, create CreditNote
    if (isCredit) {
      const noteNumber = `CN-${y}${m}${d}-${String(2001 + i).slice(-4)}`
      const expiresAt = new Date(returnDate)
      expiresAt.setMonth(expiresAt.getMonth() + 6)

      const balanceUsed = i === 2 ? Math.round(returnTotal * 0.4) : 0
      const cnStatus: CreditNoteStatus = balanceUsed > 0 ? CreditNoteStatus.PARTIALLY_USED : CreditNoteStatus.ACTIVE

      await prisma.creditNote.create({
        data: {
          noteNumber,
          saleReturnId: saleReturn.id,
          customerId: sale.customerId,
          amount: returnTotal,
          balanceUsed,
          status: cnStatus,
          expiresAt,
          createdAt: returnDate,
        },
      })

      creditNotesCreated++
    }

    // Log Audit entry
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'CREATE',
        entity: 'SaleReturn',
        entityId: saleReturn.id,
        newData: {
          returnNumber,
          saleId: sale.id,
          amount: returnTotal,
          reason,
          status,
        },
        createdAt: returnDate,
      },
    })

    returnsCreated++
  }

  console.log(`✅ Successfully seeded:`)
  console.log(`   - ${returnsCreated} Sales Returns`)
  console.log(`   - ${creditNotesCreated} Credit Notes`)
  console.log(`   - Audit trail updated`)
}

main()
  .catch((e) => {
    console.error('❌ Error seeding returns:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
