const fs = require('fs');
let code = fs.readFileSync('src/app/(dashboard)/products/page.tsx', 'utf8');

const oldLine = `      rack: p.rack,`;
const newLine = `      rack: (p.rack && typeof p.rack === 'object' ? (p.rack.shelfNumber ? \`\${p.rack.code}-\${p.rack.shelfNumber}\` : p.rack.code) : (p.rack || null)),`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldLine.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newLine.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/app/(dashboard)/products/page.tsx', replaced, 'utf8');
  console.log('Fixed products/page.tsx');
} else {
  console.log('Target not found in products/page.tsx');
}

