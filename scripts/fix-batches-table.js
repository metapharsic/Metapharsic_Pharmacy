const fs = require('fs');
let code = fs.readFileSync('src/components/batches/batches-table.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack, formatShelf } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `        const rack = row.original.rack || row.original.product.rack
        const shelf = row.original.shelf || row.original.product.shelf
        const box = row.original.box || row.original.product.box`;

const newBlock = `        const rack = formatRack(row.original.rack || row.original.product?.rack)
        const shelf = formatShelf(row.original.shelf || row.original.product?.shelf)
        const rawBox = row.original.box || row.original.product?.box
        const box = typeof rawBox === 'object' ? '' : rawBox`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/batches/batches-table.tsx', replaced, 'utf8');
  console.log('Fixed batches-table.tsx');
} else {
  console.log('Target not found in batches-table.tsx');
}

