const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/inventory-table.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack, formatShelf } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `                            <MapPin className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                            <span>{row.product.rack || 'No Rack'}</span>
                            {row.product.shelf && <span>&gt; {row.product.shelf}</span>}`;

const newBlock = `                            <MapPin className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                            <span>{formatRack(row.product.rack) || 'No Rack'}</span>
                            {formatShelf(row.product.shelf) && <span>&gt; {formatShelf(row.product.shelf)}</span>}`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/inventory/inventory-table.tsx', replaced, 'utf8');
  console.log('Fixed inventory-table.tsx');
} else {
  console.log('Target not found in inventory-table.tsx');
}

