const fs = require('fs');

let code = fs.readFileSync('src/components/sales/sale-bill-detail-dialog.tsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Update interface
code = code.replace(
  `interface SaleBillDetailDialogProps {
  saleId: string | null
  initialRow?: SalesRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}`,
  `interface SaleBillDetailDialogProps {
  saleId: string | null
  initialRow?: SalesRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
  isAdmin?: boolean
}`
);

// 2. Update component signature
code = code.replace(
  `export function SaleBillDetailDialog({
  saleId,
  initialRow,
  open,
  onOpenChange,
  onUpdated,
}: SaleBillDetailDialogProps) {`,
  `export function SaleBillDetailDialog({
  saleId,
  initialRow,
  open,
  onOpenChange,
  onUpdated,
  isAdmin = false,
}: SaleBillDetailDialogProps) {`
);

// 3. Quick metrics strip: conditionally render profit cards
const oldQuickMetrics = `          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 text-xs">
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Invoiced
              </span>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(totalAmount.toString())}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Purchase Cost
              </span>
              <p className="text-lg font-bold tabular-nums text-foreground font-mono">
                {formatCurrency(purchaseCost.toString())}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Profit Earned
              </span>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(profitAmount.toString())}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                Profit Margin
              </span>
              <p className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {profitPct != null ? \`\${profitPct.toFixed(1)}%\` : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Amount Received
              </span>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(amountPaid.toString())}
              </p>
            </div>
          </div>`;

const newQuickMetrics = `          {/* Quick Metrics Strip */}
          <div className={\`grid \${isAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'} gap-2.5 mt-4 text-xs\`}>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Invoiced
              </span>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(totalAmount.toString())}
              </p>
            </div>
            {isAdmin && (
              <>
                <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Purchase Cost
                  </span>
                  <p className="text-lg font-bold tabular-nums text-foreground font-mono">
                    {formatCurrency(purchaseCost.toString())}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Profit Earned
                  </span>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(profitAmount.toString())}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                    Profit Margin
                  </span>
                  <p className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {profitPct != null ? \`\${profitPct.toFixed(1)}%\` : '—'}
                  </p>
                </div>
              </>
            )}
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Amount Received
              </span>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(amountPaid.toString())}
              </p>
            </div>
          </div>`;

code = code.replace(oldQuickMetrics, newQuickMetrics);

// 4. Tabs list: conditionally render Profit Intelligence tab
const oldTabsList = `            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="bill" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Line Items ({items.length || initialRow?.items?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="profit" className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <TrendingUp className="h-3.5 w-3.5" />
                Profit Intelligence
              </TabsTrigger>
              <TabsTrigger value="traceability" className="gap-1.5 text-xs">
                <Boxes className="h-3.5 w-3.5 text-primary" />
                Traceability ({movements.length || items.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 text-xs">
                <Coins className="h-3.5 w-3.5" />
                Payments ({payments.length || initialRow?.payments?.length || 1})
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit
              </TabsTrigger>
            </TabsList>`;

const newTabsList = `            <TabsList className={\`grid \${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} mb-4\`}>
              <TabsTrigger value="bill" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Line Items ({items.length || initialRow?.items?.length || 0})
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="profit" className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Profit Intelligence
                </TabsTrigger>
              )}
              <TabsTrigger value="traceability" className="gap-1.5 text-xs">
                <Boxes className="h-3.5 w-3.5 text-primary" />
                Traceability ({movements.length || items.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 text-xs">
                <Coins className="h-3.5 w-3.5" />
                Payments ({payments.length || initialRow?.payments?.length || 1})
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit
              </TabsTrigger>
            </TabsList>`;

code = code.replace(oldTabsList, newTabsList);

// 5. Bill totals footer: conditionally show purchase cost & profit
const oldFooterProfit = `                  <div className="flex justify-between text-muted-foreground">
                    <span>Purchase Cost (COGS):</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatCurrency(purchaseCost)}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Gross Profit Earned:</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(profitAmount)} ({profitPct != null ? \`\${profitPct.toFixed(1)}%\` : '0%'})
                    </span>
                  </div>`;

const newFooterProfit = `                  {isAdmin && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Purchase Cost (COGS):</span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatCurrency(purchaseCost)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Gross Profit Earned:</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(profitAmount)} ({profitPct != null ? \`\${profitPct.toFixed(1)}%\` : '0%'})
                        </span>
                      </div>
                    </>
                  )}`;

code = code.replace(oldFooterProfit, newFooterProfit);

fs.writeFileSync('src/components/sales/sale-bill-detail-dialog.tsx', code, 'utf8');
console.log('✅ Updated src/components/sales/sale-bill-detail-dialog.tsx');

