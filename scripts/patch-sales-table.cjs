const fs = require('fs');

let code = fs.readFileSync('src/components/sales/sales-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Update getSalesColumns signature
code = code.replace(
  'export function getSalesColumns(\n  onViewBill?: (row: SalesRow) => void,\n  onSettleBalance?: (row: SalesRow) => void\n): ColumnDef<SalesRow>[] {',
  'export function getSalesColumns(\n  onViewBill?: (row: SalesRow) => void,\n  onSettleBalance?: (row: SalesRow) => void,\n  isAdmin: boolean = false\n): ColumnDef<SalesRow>[] {'
);

// 2. Wrap the 3 profit columns inside conditional check
const profitColumnsBlock = `    {
      accessorKey: 'purchaseCost',
      header: 'Purchase Cost',
      meta: {
        align: 'right',
        className: 'w-[105px] text-right',
      },
      cell: ({ row }) => {
        const cost = row.original.purchaseCost ?? 0
        return (
          <div className="text-right">
            <span className="font-mono text-muted-foreground text-xs tabular-nums">
              {formatCurrency(cost)}
            </span>
            {row.original.purchaseCostComplete === false && (
              <div
                className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase"
                title={\`\${row.original.purchaseUnpricedUnits || 0} units unpriced\`}
              >
                {row.original.purchaseUnpricedUnits} unpriced
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'profitAmount',
      header: 'Profit Earned',
      meta: {
        align: 'right',
        className: 'w-[110px] text-right',
      },
      cell: ({ row }) => {
        const profit = row.original.profitAmount ?? 0
        const isPositive = profit >= 0
        return (
          <div className="text-right">
            <span
              className={\`font-bold tabular-nums text-xs \${
                isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }\`}
            >
              {formatCurrency(profit)}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'profitPct',
      header: 'Profit %',
      meta: {
        align: 'center',
        className: 'w-[95px] text-center',
      },
      cell: ({ row }) => {
        const pct = row.original.profitPct
        let badgeClasses = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        if (pct != null) {
          if (pct >= 20)
            badgeClasses =
              'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
          else if (pct >= 10)
            badgeClasses =
              'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
          else if (pct >= 0)
            badgeClasses =
              'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
          else
            badgeClasses =
              'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
        }
        return (
          <div className="flex justify-center">
            <span
              className={\`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums \${badgeClasses}\`}
            >
              {pct != null ? \`\${pct.toFixed(1)}%\` : '—'}
            </span>
          </div>
        )
      },
    },`;

const conditionalProfitBlock = `    ...(isAdmin
      ? [
${profitColumnsBlock}
        ]
      : []),`;

code = code.replace(profitColumnsBlock, conditionalProfitBlock);

// 3. Update SalesTableProps & SalesTable component
code = code.replace(
  `interface SalesTableProps {
  rows: SalesRow[]
  isLoading?: boolean
  total?: number
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onViewBill?: (row: SalesRow) => void
  onSettleBalance?: (row: SalesRow) => void
}`,
  `interface SalesTableProps {
  rows: SalesRow[]
  isLoading?: boolean
  total?: number
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onViewBill?: (row: SalesRow) => void
  onSettleBalance?: (row: SalesRow) => void
  isAdmin?: boolean
}`
);

code = code.replace(
  `export function SalesTable({
  rows,
  isLoading,
  total,
  page,
  totalPages,
  onPageChange,
  onViewBill,
  onSettleBalance,
}: SalesTableProps) {
  const tableColumns = getSalesColumns(onViewBill, onSettleBalance)`,
  `export function SalesTable({
  rows,
  isLoading,
  total,
  page,
  totalPages,
  onPageChange,
  onViewBill,
  onSettleBalance,
  isAdmin = false,
}: SalesTableProps) {
  const tableColumns = getSalesColumns(onViewBill, onSettleBalance, isAdmin)`
);

fs.writeFileSync('src/components/sales/sales-table.tsx', code, 'utf8');
console.log('✅ Updated src/components/sales/sales-table.tsx');

