const fs = require('fs');
let code = fs.readFileSync('src/components/products/product-catalog.tsx', 'utf8');

const oldLine = `              manufacturer: p.manufacturer,
              rack: p.rack,`;
const newLine = `              manufacturer: p.manufacturer,
              rack: (p.rack && typeof p.rack === 'object' ? (p.rack.shelfNumber ? \`\${p.rack.code}-\${p.rack.shelfNumber}\` : p.rack.code) : (p.rack || null)),`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldLine.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newLine.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/products/product-catalog.tsx', replaced, 'utf8');
  console.log('Fixed product-catalog.tsx');
} else {
  console.log('Target not found in product-catalog.tsx');
}

