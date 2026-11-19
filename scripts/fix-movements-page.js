const fs = require('fs');
let code = fs.readFileSync('src/app/(dashboard)/inventory/movements/page.tsx', 'utf8');

const oldLine = `    rack: m.rack || m.inventory.product.rack,
    shelf: m.shelf || m.inventory.product.shelf,`;

const newLine = `    rack: (m.rack && typeof m.rack === 'object' ? m.rack.code : (m.rack || (m.inventory?.product?.rack && typeof m.inventory.product.rack === 'object' ? m.inventory.product.rack.code : (m.inventory?.product?.rack || null)))),
    shelf: (m.shelf && typeof m.shelf === 'object' ? m.shelf.shelfNumber : (m.shelf || (m.inventory?.product?.rack && typeof m.inventory.product.rack === 'object' ? m.inventory.product.rack.shelfNumber : (m.inventory?.product?.shelf || null)))),`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldLine.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newLine.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/app/(dashboard)/inventory/movements/page.tsx', replaced, 'utf8');
  console.log('Fixed inventory/movements/page.tsx');
} else {
  console.log('Target not found in inventory/movements/page.tsx');
}

