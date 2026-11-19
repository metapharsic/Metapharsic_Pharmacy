import prisma from '../src/lib/db/prisma'

async function migrateInventoryAuditTables() {
  console.log('🔄 Provisioning Inventory Audit tables in PostgreSQL...')

  // 1. Create inventory_audits table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "public"."inventory_audits" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "auditNumber" TEXT NOT NULL UNIQUE,
      "branchId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "auditType" TEXT NOT NULL DEFAULT 'FULL_PHYSICAL',
      "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      "totalProductsScanned" INTEGER NOT NULL DEFAULT 0,
      "totalBatchesScanned" INTEGER NOT NULL DEFAULT 0,
      "discrepantBatchesCount" INTEGER NOT NULL DEFAULT 0,
      "systemTotalQty" INTEGER NOT NULL DEFAULT 0,
      "physicalTotalQty" INTEGER NOT NULL DEFAULT 0,
      "varianceQty" INTEGER NOT NULL DEFAULT 0,
      "varianceCostValue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
      "varianceMrpValue" DECIMAL(14, 2) NOT NULL DEFAULT 0,
      "integrityHash" TEXT,
      "threadStats" JSONB,
      "conductedById" TEXT NOT NULL,
      "approvedById" TEXT,
      "reconciledAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('  ✓ Table "inventory_audits" created / verified.')

  // 2. Create inventory_audit_lines table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "public"."inventory_audit_lines" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "auditId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "batchId" TEXT,
      "productName" TEXT NOT NULL,
      "sku" TEXT NOT NULL,
      "batchNumber" TEXT,
      "rackLocation" TEXT,
      "systemQty" INTEGER NOT NULL DEFAULT 0,
      "physicalQty" INTEGER NOT NULL DEFAULT 0,
      "varianceQty" INTEGER NOT NULL DEFAULT 0,
      "unitCost" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "unitMrp" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "varianceCost" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "varianceMrp" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "scheduleType" TEXT DEFAULT 'NONE',
      "expiryDate" TIMESTAMP(3),
      "isReconciled" BOOLEAN NOT NULL DEFAULT false,
      "discrepancyReason" TEXT,
      "threadWorkerId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "fk_inventory_audit_lines_audit" FOREIGN KEY ("auditId") REFERENCES "public"."inventory_audits"("id") ON DELETE CASCADE
    );
  `)
  console.log('  ✓ Table "inventory_audit_lines" created / verified.')

  // 3. Create indices for performance
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_inventory_audits_branch_status" ON "public"."inventory_audits"("branchId", "status");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_inventory_audits_created_at" ON "public"."inventory_audits"("createdAt");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_inventory_audit_lines_audit" ON "public"."inventory_audit_lines"("auditId");`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_inventory_audit_lines_product" ON "public"."inventory_audit_lines"("productId");`)
  console.log('  ✓ Indexes created.')

  console.log('✅ Inventory Audit database tables provisioned successfully!')
}

migrateInventoryAuditTables()
  .catch((err) => {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
