const fs = require('fs');
let code = fs.readFileSync('src/components/products/product-table.tsx', 'utf8');

if (!code.includes('formatRack')) {
  code = `import { formatRack } from '@/lib/utils/rack'\n` + code;
}

const oldBlock = `    {
      accessorKey: 'rack',
      header: 'Rack',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onQuickUpdateRack?.(row.original)}
          className="text-left group/rack cursor-pointer hover:scale-105 transition-transform focus:outline-none"
          title="Click to relocate shelf/godown location"
        >
          {row.original.rack ? (
            <Badge variant="secondary" className="font-mono text-[11px] gap-1 py-0 px-1.5 group-hover/rack:border-primary">
              <MapPin className="h-2.5 w-2.5 text-muted-foreground group-hover/rack:text-primary" />
              {row.original.rack}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-[11px] italic group-hover/rack:text-primary underline-offset-2 hover:underline">
              + Set Rack
            </span>
          )}
        </button>
      ),
    },`;

const newBlock = `    {
      id: 'rack',
      accessorFn: (row) => formatRack(row.rack),
      header: 'Rack',
      cell: ({ row }) => {
        const displayRack = formatRack(row.original.rack)
        return (
          <button
            type="button"
            onClick={() => onQuickUpdateRack?.(row.original)}
            className="text-left group/rack cursor-pointer hover:scale-105 transition-transform focus:outline-none"
            title="Click to relocate shelf/godown location"
          >
            {displayRack ? (
              <Badge variant="secondary" className="font-mono text-[11px] gap-1 py-0 px-1.5 group-hover/rack:border-primary">
                <MapPin className="h-2.5 w-2.5 text-muted-foreground group-hover/rack:text-primary" />
                {displayRack}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-[11px] italic group-hover/rack:text-primary underline-offset-2 hover:underline">
                + Set Rack
              </span>
            )}
          </button>
        )
      },
    },`;

const normCode = code.replace(/\r\n/g, '\n');
const normOld = oldBlock.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  const replaced = normCode.replace(normOld, newBlock.replace(/\r\n/g, '\n'));
  fs.writeFileSync('src/components/products/product-table.tsx', replaced, 'utf8');
  console.log('Fixed product-table.tsx');
} else {
  console.log('Target not found in product-table.tsx');
}

