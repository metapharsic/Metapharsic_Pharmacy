const fs = require('fs');

const files = [
  'c:/metapharsic-pharmacy-complete/src/lib/inventory/inventory-service.ts',
  'c:/Meta_Pharma/pharmacy-management-system/src/lib/inventory/inventory-service.ts'
];

for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(
      /supplierRef:\s*true,\s*purchase:\s*\{\s*select:\s*\{\s*supplierRef:\s*true,\s*purchase:\s*\{\s*select:\s*\{\s*supplier:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true\s*\}\s*\}\s*\}\s*\},?\s*\}\s*\},?/g,
      'supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },'
    );
    fs.writeFileSync(f, content, 'utf8');
    console.log('Cleaned:', f);
  }
}

