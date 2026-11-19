const fs = require('fs');
let code = fs.readFileSync('src/components/inventory/dead-stock-view.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack, formatShelf } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `                      <span className="font-bold text-foreground">
                        {item.rack || 'Unassigned'}
                      </span>
                      {item.shelf && <span className="text-muted-foreground">&gt; {item.shelf}</span>}`;

const newBlock = `                      <span className="font-bold text-foreground">
                        {formatRack(item.rack) || 'Unassigned'}
                      </span>
                      {formatShelf(item.shelf) && <span className="text-muted-foreground">&gt; {formatShelf(item.shelf)}</span>}`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/inventory/dead-stock-view.tsx', replaced, 'utf8');
  console.log('Fixed dead-stock-view.tsx');
} else {
  console.log('Target not found in dead-stock-view.tsx');
}

