const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/adjustments-table.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack, formatShelf } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `                  {p.rack ? \`\${p.rack}\` : ''}
                  {p.shelf ? \` › \${p.shelf}\` : ''}`;

const newBlock = `                  {formatRack(p.rack) ? \`\${formatRack(p.rack)}\` : ''}
                  {formatShelf(p.shelf) ? \` › \${formatShelf(p.shelf)}\` : ''}`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/inventory/adjustments-table.tsx', replaced, 'utf8');
  console.log('Fixed adjustments-table.tsx');
} else {
  console.log('Target not found in adjustments-table.tsx');
}

