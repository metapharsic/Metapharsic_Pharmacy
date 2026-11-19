const fs = require('fs');

const files = [
  'src/components/inventory/adjustment-form.tsx',
  'src/components/inventory/assign-medicine-dialog.tsx',
  'src/components/inventory/edit-box-dialog.tsx',
  'src/components/inventory/edit-adjustment-dialog.tsx',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  let updated = false;

  if (!code.includes('formatRack')) {
    code = `import { formatRack, formatShelf } from '@/lib/utils/rack'\n` + code;
    updated = true;
  }

  // in adjustment-form.tsx
  if (code.includes('contextData.product.rack ? `Rack ${contextData.product.rack}`')) {
    code = code.replace(
      'contextData.product.rack ? `Rack ${contextData.product.rack}`',
      'contextData.product.rack ? `Rack ${formatRack(contextData.product.rack)}`'
    );
    updated = true;
  }
  if (code.includes('contextData.product.shelf ? ` › ${contextData.product.shelf}`')) {
    code = code.replace(
      'contextData.product.shelf ? ` › ${contextData.product.shelf}`',
      'contextData.product.shelf ? ` › ${formatShelf(contextData.product.shelf)}`'
    );
    updated = true;
  }
  if (code.includes('b.rack ? `Rack ${b.rack}`')) {
    code = code.replace('b.rack ? `Rack ${b.rack}`', 'b.rack ? `Rack ${formatRack(b.rack)}`');
    updated = true;
  }
  if (code.includes('item.rack ? `Rack ${item.rack}`')) {
    code = code.replace('item.rack ? `Rack ${item.rack}`', 'item.rack ? `Rack ${formatRack(item.rack)}`');
    updated = true;
  }
  if (code.includes('p.rack ? `Rack ${p.rack}`')) {
    code = code.replace('p.rack ? `Rack ${p.rack}`', 'p.rack ? `Rack ${formatRack(p.rack)}`');
    updated = true;
  }

  // in assign-medicine-dialog.tsx
  if (code.includes('{targetLocation.rack} &gt; {targetLocation.shelf}')) {
    code = code.replace(
      '{targetLocation.rack} &gt; {targetLocation.shelf}',
      '{formatRack(targetLocation.rack)} &gt; {formatShelf(targetLocation.shelf)}'
    );
    updated = true;
  }
  if (code.includes('{p.rack} &gt; {p.shelf || \'No Shelf\'}')) {
    code = code.replace(
      '{p.rack} &gt; {p.shelf || \'No Shelf\'}',
      '{formatRack(p.rack)} &gt; {formatShelf(p.shelf) || \'No Shelf\'}'
    );
    updated = true;
  }

  // in edit-box-dialog.tsx
  if (code.includes('{location.rack} &gt; {location.shelf}')) {
    code = code.replace(
      '{location.rack} &gt; {location.shelf}',
      '{formatRack(location.rack)} &gt; {formatShelf(location.shelf)}'
    );
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(file, code, 'utf8');
    console.log(`Updated ${file}`);
  }
}

