const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/vendor-inventory-view.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `<span>{b.rack || 'Unassigned'}</span>`;
const newBlock = `<span>{formatRack(b.rack) || 'Unassigned'}</span>`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/inventory/vendor-inventory-view.tsx', replaced, 'utf8');
  console.log('Fixed vendor-inventory-view.tsx');
} else {
  console.log('Target not found in vendor-inventory-view.tsx');
}

