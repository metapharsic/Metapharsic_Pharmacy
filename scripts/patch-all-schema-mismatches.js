const fs = require('fs');
const path = require('path');

const roots = [
  'c:/metapharsic-pharmacy-complete',
  'c:/Meta_Pharma/pharmacy-management-system'
];

for (const root of roots) {
  console.log(`\n================ Processing ${root} ================`);

  // 1. product-service.ts
  const prodServicePath = path.join(root, 'src/lib/products/product-service.ts');
  if (fs.existsSync(prodServicePath)) {
    let content = fs.readFileSync(prodServicePath, 'utf8');
    const before = content;
    content = content.replace(/\s*supplierId:\s*true,?\r?\n/g, '\n');
    if (content !== before) {
      fs.writeFileSync(prodServicePath, content, 'utf8');
      console.log('✓ Patched product-service.ts (removed invalid supplierId from Batch select)');
    } else {
      console.log('• product-service.ts already up to date');
    }
  }

  // 2. batch-service.ts
  const batchServicePath = path.join(root, 'src/lib/batches/batch-service.ts');
  if (fs.existsSync(batchServicePath)) {
    let content = fs.readFileSync(batchServicePath, 'utf8');
    const before = content;

    content = content.replace(
      /productInclude\s*=\s*\{\s*product:\s*true,\s*supplier:\s*true\s*\}/g,
      'productInclude = { product: true, purchase: { include: { supplier: true } } }'
    );

    content = content.replace(
      /detailInclude\s*=\s*\{\s*product:\s*true,\s*supplier:\s*true,/g,
      'detailInclude = { product: true, purchase: { include: { supplier: true } },'
    );

    content = content.replace(
      /batch\.supplier\?\.name/g,
      '(batch.purchase?.supplier?.name || batch.supplier?.name)'
    );

    content = content.replace(
      /const supplierId = batch\.supplier\?\.id \|\| batch\.supplierId \|\| null/g,
      'const supplierId = batch.purchase?.supplier?.id || batch.supplier?.id || null'
    );

    content = content.replace(
      /if \(supplierId\) where\.supplierId = supplierId/g,
      'if (supplierId) where.purchase = { supplierId }'
    );

    if (content !== before) {
      fs.writeFileSync(batchServicePath, content, 'utf8');
      console.log('✓ Patched batch-service.ts (linked Batch to Supplier via Purchase relation)');
    } else {
      console.log('• batch-service.ts already up to date');
    }
  }

  // 3. inventory-service.ts
  const invServicePath = path.join(root, 'src/lib/inventory/inventory-service.ts');
  if (fs.existsSync(invServicePath)) {
    let content = fs.readFileSync(invServicePath, 'utf8');
    const before = content;

    // Remove shelf: true and box: true from Product selects
    content = content.replace(/\s*shelf:\s*true,?\r?\n/g, '\n');
    content = content.replace(/\s*box:\s*true,?\r?\n/g, '\n');

    // Replace invalid batch.supplierId and batch.supplier
    content = content.replace(
      /supplierId:\s*true,\s*supplier:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true\s*\}\s*\},?/g,
      'supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },'
    );

    content = content.replace(
      /supplier:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true\s*\}\s*\},?/g,
      'supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },'
    );

    if (content !== before) {
      fs.writeFileSync(invServicePath, content, 'utf8');
      console.log('✓ Patched inventory-service.ts (removed non-existent Product shelf/box and Batch supplier)');
    } else {
      console.log('• inventory-service.ts already up to date');
    }
  }

  // 4. sales-service.ts
  const salesServicePath = path.join(root, 'src/lib/sales/sales-service.ts');
  if (fs.existsSync(salesServicePath)) {
    let content = fs.readFileSync(salesServicePath, 'utf8');
    const before = content;

    // Replace doctor in saleListItemInclude with commissions
    content = content.replace(
      /doctor:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*regNumber:\s*true\s*\}\s*\},?/g,
      'commissions: { select: { doctor: { select: { id: true, name: true, regNumber: true } } } },'
    );

    // Replace doctor in saleDetailInclude
    content = content.replace(
      /doctor:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*regNumber:\s*true,\s*qualification:\s*true,\s*clinicName:\s*true,\s*phone:\s*true,?\s*\}\s*\},?/g,
      'commissions: { select: { doctor: { select: { id: true, name: true, regNumber: true, qualification: true, clinicName: true, phone: true } } } },'
    );

    if (content !== before) {
      fs.writeFileSync(salesServicePath, content, 'utf8');
      console.log('✓ Patched sales-service.ts (replaced invalid Sale.doctor with commissions)');
    } else {
      console.log('• sales-service.ts already up to date');
    }
  }

  // 5. adjustments context & id routes
  const ctxRoute = path.join(root, 'src/app/api/inventory/adjustments/context/route.ts');
  if (fs.existsSync(ctxRoute)) {
    let content = fs.readFileSync(ctxRoute, 'utf8');
    const before = content;
    content = content.replace(/\s*shelf:\s*true,?\r?\n/g, '\n');
    content = content.replace(/\s*box:\s*true,?\r?\n/g, '\n');
    content = content.replace(
      /supplier:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*phone:\s*true,\s*email:\s*true,?\s*\}\s*\},?/g,
      'supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true, phone: true, email: true } } } },'
    );
    content = content.replace(/b\.supplier\b/g, '(b.purchase?.supplier || null)');
    content = content.replace(/product\.shelf/g, '(product.rack?.shelfNumber || null)');
    content = content.replace(/product\.box/g, 'null');
    if (content !== before) {
      fs.writeFileSync(ctxRoute, content, 'utf8');
      console.log('✓ Patched adjustments/context/route.ts');
    }
  }

  const adjIdRoute = path.join(root, 'src/app/api/inventory/adjustments/[id]/route.ts');
  if (fs.existsSync(adjIdRoute)) {
    let content = fs.readFileSync(adjIdRoute, 'utf8');
    const before = content;
    content = content.replace(/\s*shelf:\s*true,?\r?\n/g, '\n');
    content = content.replace(/\s*box:\s*true,?\r?\n/g, '\n');
    content = content.replace(
      /supplier:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*phone:\s*true,?\s*\}\s*\},?/g,
      'supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true, phone: true } } } },'
    );
    if (content !== before) {
      fs.writeFileSync(adjIdRoute, content, 'utf8');
      console.log('✓ Patched adjustments/[id]/route.ts');
    }
  }

  // 6. inventory-analytics-service.ts
  const invAnalyticsPath = path.join(root, 'src/lib/inventory/inventory-analytics-service.ts');
  if (fs.existsSync(invAnalyticsPath)) {
    let content = fs.readFileSync(invAnalyticsPath, 'utf8');
    const before = content;
    content = content.replace(/\s*shelf:\s*true,?\r?\n/g, '\n');
    content = content.replace(/\s*box:\s*true,?\r?\n/g, '\n');
    content = content.replace(
      /supplier:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true\s*\}\s*\},?/g,
      'supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },'
    );
    content = content.replace(
      /if \(supplierId\) batchWhere\.supplierId = supplierId/g,
      'if (supplierId) batchWhere.purchase = { supplierId }'
    );
    content = content.replace(/orderBy:\s*\[\{\s*rack:\s*'asc'\s*\},\s*\{\s*shelf:\s*'asc'\s*\},\s*\{\s*box:\s*'asc'\s*\}\]/g, "orderBy: { name: 'asc' }");
    if (content !== before) {
      fs.writeFileSync(invAnalyticsPath, content, 'utf8');
      console.log('✓ Patched inventory-analytics-service.ts');
    }
  }

  // 7. Pages: inventory/page.tsx, batches/page.tsx, inventory/adjustments/page.tsx, inventory/movements/page.tsx
  const pages = [
    'src/app/(dashboard)/inventory/page.tsx',
    'src/app/(dashboard)/batches/page.tsx',
    'src/app/(dashboard)/inventory/adjustments/page.tsx',
    'src/app/(dashboard)/inventory/movements/page.tsx'
  ];

  for (const p of pages) {
    const full = path.join(root, p);
    if (fs.existsSync(full)) {
      let content = fs.readFileSync(full, 'utf8');
      const before = content;

      content = content.replace(
        /shelf:\s*([a-zA-Z0-9_.]+)\.shelf,?\r?\n/g,
        'shelf: ($1.rack && typeof $1.rack === "object" ? $1.rack.shelfNumber : null),\n'
      );

      content = content.replace(
        /box:\s*([a-zA-Z0-9_.]+)\.box,?\r?\n/g,
        'box: null,\n'
      );

      content = content.replace(
        /rack:\s*([a-zA-Z0-9_.]+)\.rack,?\r?\n/g,
        'rack: ($1.rack && typeof $1.rack === "object" ? $1.rack.code : ($1.rack || null)),\n'
      );

      content = content.replace(
        /supplierId:\s*([a-zA-Z0-9_.]+)\.batch\?\.supplierId,?\r?\n/g,
        'supplierId: ($1.batch?.purchase?.supplier?.id || null),\n'
      );

      content = content.replace(
        /supplierId:\s*([a-zA-Z0-9_.]+)\.supplierId,?\r?\n/g,
        'supplierId: ($1.supplierId || null),\n'
      );

      if (content !== before) {
        fs.writeFileSync(full, content, 'utf8');
        console.log(`✓ Patched ${p}`);
      }
    }
  }
}

console.log('\nAll patches applied successfully!');

