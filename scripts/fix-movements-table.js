const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/movements-table.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack, formatShelf } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `        const prod = row.original.inventory.product
        const rack = row.original.rack || prod.rack
        const shelf = row.original.shelf || prod.shelf
        const box = row.original.box || prod.box`;

const newBlock = `        const prod = row.original.inventory.product
        const rack = formatRack(row.original.rack || prod.rack)
        const shelf = formatShelf(row.original.shelf || prod.shelf)
        const rawBox = row.original.box || prod.box
        const box = typeof rawBox === 'object' ? '' : rawBox`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/inventory/movements-table.tsx', replaced, 'utf8');
  console.log('Fixed movements-table.tsx');
} else {
  console.log('Target not found in movements-table.tsx');
}

