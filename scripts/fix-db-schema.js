const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Inspecting and synchronizing database schema...')

  // 1. Add missing column 'group' to ledgers
  await prisma.$executeRawUnsafe('ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS "group" TEXT;')
  console.log('✓ Added column "group" to ledgers table')

  // Check vouchers and voucher_entries tables
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      "voucherNumber" TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "referenceNumber" TEXT,
      narration TEXT,
      "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
      "branchId" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✓ Ensured vouchers table exists')

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS voucher_entries (
      id TEXT PRIMARY KEY,
      "voucherId" TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
      "ledgerId" TEXT NOT NULL REFERENCES ledgers(id),
      type TEXT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      narration TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✓ Ensured voucher_entries table exists')

  // Check product storage fields (rack, shelf, box)
  await prisma.$executeRawUnsafe('ALTER TABLE products ADD COLUMN IF NOT EXISTS rack TEXT;')
  await prisma.$executeRawUnsafe('ALTER TABLE products ADD COLUMN IF NOT EXISTS shelf TEXT;')
  await prisma.$executeRawUnsafe('ALTER TABLE products ADD COLUMN IF NOT EXISTS box TEXT;')
  await prisma.$executeRawUnsafe('ALTER TABLE products ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(10,2);')
  console.log('✓ Ensured rack, shelf, box, costPrice on products table')

  // Check batch fields
  await prisma.$executeRawUnsafe('ALTER TABLE batches ADD COLUMN IF NOT EXISTS "supplierId" TEXT;')
  await prisma.$executeRawUnsafe('ALTER TABLE batches ADD COLUMN IF NOT EXISTS "supplierRef" TEXT;')
  console.log('✓ Ensured supplierId, supplierRef on batches table')

  // Test executing ensureDefaultLedgers
  const ledgersCount = await prisma.ledger.count()
  console.log('Current ledgers count:', ledgersCount)

  console.log('Database schema synchronized successfully.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Schema sync error:', err)
  process.exit(1)
})

