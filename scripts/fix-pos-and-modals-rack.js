const fs = require('fs');

const posFiles = [
  'src/components/pos/formats/format-1-inline-grid.tsx',
  'src/components/pos/formats/format-2-split-screen.tsx',
  'src/components/pos2/formats/format-1-inline-grid.tsx',
  'src/components/pos2/formats/format-2-split-screen.tsx',
  'src/components/pos/pos-client.tsx',
  'src/components/pos2/pos2-client.tsx',
  'src/components/products/product-batch-dialog.tsx',
  'src/components/products/product-detail-modal.tsx',
  'src/components/products/product-substitutes-dialog.tsx',
  'src/components/scanner/barcode-scanner-modal.tsx',
  'src/components/inventory/fefo-expiry-radar.tsx',
];

for (const file of posFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  let updated = false;

  // Add import if not present
  if (!code.includes('formatRack') && /Rack:\s*\{|\.rack\b/.test(code)) {
    code = `import { formatRack } from '@/lib/utils/rack'\n` + code;
    updated = true;
  }

  // Replace Rack: {prod.rack} -> Rack: {formatRack(prod.rack)}
  if (code.includes('Rack: {prod.rack}')) {
    code = code.replace(/Rack:\s*\{prod\.rack\}/g, 'Rack: {formatRack(prod.rack)}');
    updated = true;
  }
  // Replace Rack: {item.rack} -> Rack: {formatRack(item.rack)}
  if (code.includes('Rack: {item.rack}')) {
    code = code.replace(/Rack:\s*\{item\.rack\}/g, 'Rack: {formatRack(item.rack)}');
    updated = true;
  }
  // Replace Rack: {sub.rack} -> Rack: {formatRack(sub.rack)}
  if (code.includes('Rack: {sub.rack}')) {
    code = code.replace(/Rack:\s*\{sub\.rack\}/g, 'Rack: {formatRack(sub.rack)}');
    updated = true;
  }
  // Replace {sub.rack} standalone
  if (code.includes('{sub.rack}')) {
    code = code.replace(/\{sub\.rack\}/g, '{formatRack(sub.rack)}');
    updated = true;
  }
  // Replace {p.rack} standalone in pos-client
  if (code.includes('{p.rack}')) {
    code = code.replace(/\{p\.rack\}/g, '{formatRack(p.rack)}');
    updated = true;
  }
  // Replace {product.rack && ` • Rack ${product.rack}`}
  if (code.includes('• Rack ${product.rack}')) {
    code = code.replace(/• Rack \$\{product\.rack\}/g, '• Rack ${formatRack(product.rack)}');
    updated = true;
  }
  // Replace {product.rack ? `Rack ${product.rack}`
  if (code.includes('`Rack ${product.rack}`')) {
    code = code.replace(/`Rack \$\{product\.rack\}`/g, '`Rack ${formatRack(product.rack)}`');
    updated = true;
  }
  // Replace Rack: {scannedData.product.rack}
  if (code.includes('Rack: {scannedData.product.rack}')) {
    code = code.replace(/Rack:\s*\{scannedData\.product\.rack\}/g, 'Rack: {formatRack(scannedData.product.rack)}');
    updated = true;
  }
  // Replace · Rack {b.product.rack}
  if (code.includes('· Rack {b.product.rack}')) {
    code = code.replace(/· Rack \{b\.product\.rack\}/g, '· Rack {formatRack(b.product.rack)}');
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(file, code, 'utf8');
    console.log(`Updated ${file}`);
  }
}

