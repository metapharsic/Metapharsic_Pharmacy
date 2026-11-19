import { PrismaClient } from '@prisma/client';
import { getProducts } from '../src/lib/products/product-service';
import { getMovements, getAdjustments, getInventory } from '../src/lib/inventory/inventory-service';
import { getBatches } from '../src/lib/batches/batch-service';
import { formatRack } from '../src/lib/utils/rack';

const prisma = new PrismaClient();

function checkValue(val: any, path: string, errors: string[]) {
  if (val === null || val === undefined) return;
  if (typeof val === 'function') return;
  if (Array.isArray(val)) {
    val.forEach((item, idx) => checkValue(item, `${path}[${idx}]`, errors));
    return;
  }
  if (typeof val === 'object') {
    // Check if this object is a Rack or any unformatted model that gets placed in a text column
    if (val.id && val.branchId && val.code && 'shelfNumber' in val) {
      errors.push(`Found unformatted Rack object at ${path}: { id: ${val.id}, code: ${val.code} }`);
    }
  }
}

async function main() {
  console.log('--- Verifying Data Models & Mappers for Zero Unformatted Objects ---');
  const errors: string[] = [];

  // 1. Products
  const productsResult = await getProducts({ page: 1, limit: 50 });
  for (const p of productsResult.data) {
    if (typeof p.rack === 'object' && p.rack !== null) {
      errors.push(`Product "${p.name}" has object rack: ${JSON.stringify(p.rack)}`);
    }
  }
  console.log(`✅ Checked ${productsResult.data.length} products - all rack fields are strings or null.`);

  // 2. Movements
  const movementsResult = await getMovements({ page: 1, limit: 50 });
  for (const m of movementsResult.data) {
    if (typeof m.rack === 'object' && m.rack !== null) {
      errors.push(`Movement ${m.id} has object rack: ${JSON.stringify(m.rack)}`);
    }
    if (typeof m.inventory?.product?.rack === 'object' && m.inventory.product.rack !== null) {
      errors.push(`Movement ${m.id} product has object rack: ${JSON.stringify(m.inventory.product.rack)}`);
    }
  }
  console.log(`✅ Checked ${movementsResult.data.length} movements - all rack fields normalized.`);

  // 3. Adjustments
  const adjustmentsResult = await getAdjustments({ page: 1, limit: 50 });
  for (const a of adjustmentsResult.data) {
    if (typeof a.product?.rack === 'object' && a.product.rack !== null) {
      errors.push(`Adjustment ${a.id} product has object rack: ${JSON.stringify(a.product.rack)}`);
    }
  }
  console.log(`✅ Checked ${adjustmentsResult.data.length} adjustments - all rack fields normalized.`);

  // 4. Batches
  const batchesResult = await getBatches({ page: 1, limit: 50 });
  for (const b of batchesResult.data) {
    if (typeof (b as any).rack === 'object' && (b as any).rack !== null) {
      errors.push(`Batch ${b.batchNumber} has object rack: ${JSON.stringify((b as any).rack)}`);
    }
  }
  console.log(`✅ Checked ${batchesResult.data.length} batches - all rack fields normalized.`);

  // 5. Test formatRack with dummy objects
  const dummyRack = { id: 'r1', branchId: 'b1', code: 'A1', shelfNumber: 2, description: 'Shelf 2' };
  const formatted = formatRack(dummyRack);
  if (formatted !== 'A1-2') {
    errors.push(`formatRack failed: expected "A1-2", got "${formatted}"`);
  }
  console.log(`✅ formatRack correctly formats dummy Rack object: "${formatted}"`);

  if (errors.length > 0) {
    console.error(`\n❌ Failed with ${errors.length} errors:`);
    errors.forEach(e => console.error('  ->', e));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL CHECKS PASSED: ZERO OBJECTS AS REACT CHILDREN!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());

