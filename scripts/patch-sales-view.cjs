const fs = require('fs');
let code = fs.readFileSync('src/components/sales/sales-view.tsx', 'utf8');

// 1. Add Sparkles and TrendingUp to lucide-react import
code = code.replace(
  "Table as TableIcon,",
  "Table as TableIcon,\r\n  Sparkles,\r\n  TrendingUp,"
);
code = code.replace(
  "Table as TableIcon,\n",
  "Table as TableIcon,\n  Sparkles,\n  TrendingUp,\n"
);

// 2. Update SummaryMetrics interface
const oldSummaryMetrics = `interface SummaryMetrics {
  billsCount: number
  salesValue: number
  amountReceived: number
  outstanding: number
}`;

const newSummaryMetrics = `interface SummaryMetrics {
  billsCount: number
  salesValue: number
  amountReceived: number
  outstanding: number
  totalPurchaseCost?: number
  totalProfit?: number
  profitMarginPct?: number
  purchaseCostComplete?: boolean
  unpricedUnits?: number
}`;

code = code.replace(oldSummaryMetrics, newSummaryMetrics);
code = code.replace(oldSummaryMetrics.replace(/\n/g, '\r\n'), newSummaryMetrics.replace(/\n/g, '\r\n'));

// 3. Update summary initial state
const oldInitSummary = `  const [summary, setSummary] = useState<SummaryMetrics>(
    initialSummary || {
      billsCount: initialPagination.total,
      salesValue: initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
      amountReceived: initialRows.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0),
      outstanding: initialRows.reduce((sum, r) => sum + Number(r.balanceDue || 0), 0),
    }
  )`;

const newInitSummary = `  const [summary, setSummary] = useState<SummaryMetrics>(
    initialSummary || {
      billsCount: initialPagination.total,
      salesValue: initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
      amountReceived: initialRows.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0),
      outstanding: initialRows.reduce((sum, r) => sum + Number(r.balanceDue || 0), 0),
      totalPurchaseCost: initialRows.reduce((sum, r) => sum + Number(r.purchaseCost || 0), 0),
      totalProfit: initialRows.reduce((sum, r) => sum + Number(r.profitAmount || 0), 0),
      profitMarginPct:
        initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0) > 0
          ? Math.round(
              (initialRows.reduce((sum, r) => sum + Number(r.profitAmount || 0), 0) /
                initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0)) *
                10000
            ) / 100
          : 0,
      purchaseCostComplete: !initialRows.some((r) => r.purchaseCostComplete === false),
      unpricedUnits: initialRows.reduce((sum, r) => sum + Number(r.purchaseUnpricedUnits || 0), 0),
    }
  )

  const marginGrade = useMemo(() => {
    const rev = summary.salesValue
    const profit = summary.totalProfit ?? (rev - (summary.totalPurchaseCost ?? 0))
    if (rev <= 0) {
      return { label: 'NO DATA', color: 'bg-muted text-muted-foreground border-border' }
    }
    const pct = summary.profitMarginPct != null ? summary.profitMarginPct : (profit / rev) * 100
    if (pct >= 25) {
      return {
        label: 'OPTIMAL MARGIN',
        color:
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      }
    }
    if (pct >= 15) {
      return {
        label: 'HEALTHY COMMERCIAL',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      }
    }
    if (pct >= 5) {
      return {
        label: 'ACCEPTABLE',
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      }
    }
    return {
      label: 'LOW MARGIN / AT RISK',
      color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    }
  }, [summary])`;

code = code.replace(oldInitSummary, newInitSummary);
code = code.replace(oldInitSummary.replace(/\n/g, '\r\n'), newInitSummary.replace(/\n/g, '\r\n'));

// 4. Update buildCsvContent
const oldCsvHeaders = `    const headers = [
      'Invoice',
      'Date',
      'Customer',
      'Phone',
      'Medicines Sold',
      'Total Amount',
      'Amount Received',
      'Balance Due',
      'Payment Status',
      'Sale Status',
      'Cashier',
    ]`;

const newCsvHeaders = `    const headers = [
      'Invoice',
      'Date',
      'Customer',
      'Phone',
      'Medicines Sold',
      'Total Amount',
      'Purchase Cost',
      'Profit Earned',
      'Profit Margin %',
      'Amount Received',
      'Balance Due',
      'Payment Status',
      'Sale Status',
      'Cashier',
    ]`;

code = code.replace(oldCsvHeaders, newCsvHeaders);
code = code.replace(oldCsvHeaders.replace(/\n/g, '\r\n'), newCsvHeaders.replace(/\n/g, '\r\n'));

const oldCsvLine = `      const line = [
        \`"\${r.invoiceNumber}"\`,
        \`"\${formatDateTime(r.saleDate)}"\`,
        \`"\${r.customer?.name || 'Walk-in Customer'}"\`,
        \`"\${r.customer?.phone || ''}"\`,
        \`"\${medicines.replace(/"/g, '""')}"\`,
        r.totalAmount,
        r.amountPaid,
        r.balanceDue,
        \`"\${r.paymentStatus}"\`,
        \`"\${r.status}"\`,
        \`"\${r.createdBy?.name || ''}"\`,
      ]`;

const newCsvLine = `      const line = [
        \`"\${r.invoiceNumber}"\`,
        \`"\${formatDateTime(r.saleDate)}"\`,
        \`"\${r.customer?.name || 'Walk-in Customer'}"\`,
        \`"\${r.customer?.phone || ''}"\`,
        \`"\${medicines.replace(/"/g, '""')}"\`,
        r.totalAmount,
        r.purchaseCost ?? 0,
        r.profitAmount ?? 0,
        r.profitPct != null ? \`\${r.profitPct.toFixed(1)}%\` : '0%',
        r.amountPaid,
        r.balanceDue,
        \`"\${r.paymentStatus}"\`,
        \`"\${r.status}"\`,
        \`"\${r.createdBy?.name || ''}"\`,
      ]`;

code = code.replace(oldCsvLine, newCsvLine);
code = code.replace(oldCsvLine.replace(/\n/g, '\r\n'), newCsvLine.replace(/\n/g, '\r\n'));

// 5. Update Top KPI Cards
const oldMetricCards = `        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Bills found */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-muted/30">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary/60" />
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Bills found</span>
                <Receipt className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                {summary.billsCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Filtered bills in selection</p>
            </CardContent>
          </Card>

          {/* Metric 2: Sales value */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-muted/30">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/80" />
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Sales value</span>
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">₹</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                {formatCurrency(summary.salesValue.toString())}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Gross bill receivables</p>
            </CardContent>
          </Card>

          {/* Metric 3: Amount received */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-emerald-500/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>Amount received</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.amountReceived.toString())}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Cash, UPI & Card collected</p>
            </CardContent>
          </Card>

          {/* Metric 4: Outstanding */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-amber-500/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span>Outstanding</span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(summary.outstanding.toString())}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Unsettled credit / part balance</p>
            </CardContent>
          </Card>
        </div>`;

const newMetricCards = `        {/* Executive Commercial Oversight Header Banner (similar to Trend_MR Admin Control Center) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-1 border border-indigo-400/30">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              ADMIN COMMERCIAL OVERSIGHT
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Descriptive Profit Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 max-w-2xl">
              Real-time invoice profit and purchase cost economics calculated on-the-fly with 0 DB mutations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={\`px-3 py-1.5 rounded-xl border text-xs font-bold tracking-wider \${marginGrade.color}\`}>
              {marginGrade.label}
            </div>
          </div>
        </div>

        {/* 5 KPI Cards: Bills, Revenue, Purchase Cost, Profit Earned, Net Margin */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Bills found */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-muted/30">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary/60" />
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Bills found</span>
                <Receipt className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3.5 px-4">
              <div className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                {summary.billsCount}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Selection bill count</p>
            </CardContent>
          </Card>

          {/* Card 2: Sales value (Revenue) */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-muted/30">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/80" />
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Gross Revenue</span>
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">₹</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3.5 px-4">
              <div className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                {formatCurrency(summary.salesValue.toString())}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total invoiced value</p>
            </CardContent>
          </Card>

          {/* Card 3: Purchase Cost (COGS) */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-muted/30">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-500" />
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Purchase Cost</span>
                <Layers className="h-4 w-4 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3.5 px-4">
              <div className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground font-mono">
                {formatCurrency((summary.totalPurchaseCost ?? 0).toString())}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Cost of goods sold (COGS)</p>
            </CardContent>
          </Card>

          {/* Card 4: Profit Earned */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-emerald-500/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>Profit Earned</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3.5 px-4">
              <div className={\`text-2xl font-extrabold tracking-tight tabular-nums \${(summary.totalProfit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}\`}>
                {formatCurrency((summary.totalProfit ?? 0).toString())}
              </div>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 flex items-center gap-1">
                <span>Gross profit earned</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 5: Net Profit Margin % */}
          <Card className="border-border/70 shadow-sm relative overflow-hidden bg-gradient-to-br from-background to-indigo-500/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardTitle className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                <span>Profit Margin</span>
                <Coins className="h-4 w-4 text-indigo-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3.5 px-4">
              <div className="text-2xl font-extrabold tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400">
                {summary.profitMarginPct != null
                  ? \`\${summary.profitMarginPct.toFixed(1)}%\`
                  : summary.salesValue > 0
                  ? \`\${(((summary.totalProfit ?? 0) / summary.salesValue) * 100).toFixed(1)}%\`
                  : '—'}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Weighted avg margin</p>
            </CardContent>
          </Card>
        </div>

        {summary.purchaseCostComplete === false && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="font-semibold">
              {summary.unpricedUnits ?? 0} units have no purchase rate on file — profit for those units is computed with zero cost basis.
            </span>
          </div>
        )}

        {/* Secondary Cash Collection & Outstanding Summary */}
        <div className="flex flex-wrap items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Collected:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(summary.amountReceived.toString())}
              </strong>
            </span>
            <span>•</span>
            <span>
              Outstanding Credit:{' '}
              <strong className="text-amber-600 dark:text-amber-400 tabular-nums">
                {formatCurrency(summary.outstanding.toString())}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Ledger Reconciled (0 DB writes)
            </span>
          </div>
        </div>`;

code = code.replace(oldMetricCards, newMetricCards);
code = code.replace(oldMetricCards.replace(/\n/g, '\r\n'), newMetricCards.replace(/\n/g, '\r\n'));

// 6. Update Feed Mode invoice card right column
const oldRightCol = `                        {/* Right: Bill Total, Payment Status Badge, Actions */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/50">
                          <div className="text-right">
                            <div className="font-bold text-base text-foreground tabular-nums">
                              {formatCurrency(row.totalAmount)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                              <Badge variant={paymentMeta.variant} className="text-[10px] px-1.5 py-0">
                                {paymentMeta.label}
                              </Badge>
                              {row.status !== 'COMPLETED' && (
                                <Badge variant={saleMeta.variant} className="text-[10px] px-1.5 py-0">
                                  {saleMeta.label}
                                </Badge>
                              )}
                            </div>
                          </div>`;

const newRightCol = `                        {/* Right: Bill Total, Profit, Payment Status Badge, Actions */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/50">
                          <div className="text-right">
                            <div className="font-bold text-base text-foreground tabular-nums">
                              {formatCurrency(row.totalAmount)}
                            </div>
                            <div className="text-[11px] font-semibold flex items-center justify-end gap-1.5 mt-0.5">
                              <span className="text-muted-foreground text-[10px]">Profit:</span>
                              <span
                                className={\`tabular-nums font-bold \${
                                  Number(row.profitAmount ?? 0) >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }\`}
                              >
                                {formatCurrency(row.profitAmount ?? 0)}
                              </span>
                              <span
                                className={\`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold \${
                                  row.profitPct == null
                                    ? 'bg-muted text-muted-foreground'
                                    : row.profitPct >= 20
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : row.profitPct >= 10
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                    : row.profitPct >= 0
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                }\`}
                              >
                                {row.profitPct != null ? \`\${row.profitPct.toFixed(1)}%\` : '—'}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                              <span>Cost: {formatCurrency(row.purchaseCost ?? 0)}</span>
                              {row.purchaseCostComplete === false && (
                                <span
                                  className="text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase"
                                  title={\`\${row.purchaseUnpricedUnits || 0} units unpriced\`}
                                >
                                  (⚠ {row.purchaseUnpricedUnits} unpriced)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                              <Badge variant={paymentMeta.variant} className="text-[10px] px-1.5 py-0">
                                {paymentMeta.label}
                              </Badge>
                              {row.status !== 'COMPLETED' && (
                                <Badge variant={saleMeta.variant} className="text-[10px] px-1.5 py-0">
                                  {saleMeta.label}
                                </Badge>
                              )}
                            </div>
                          </div>`;

code = code.replace(oldRightCol, newRightCol);
code = code.replace(oldRightCol.replace(/\n/g, '\r\n'), newRightCol.replace(/\n/g, '\r\n'));

// 7. Update drawer table columns and rows in Feed Mode
const oldDrawerThead = `                                  <tr>
                                    <th className="py-2 px-3 text-left">Medicine</th>
                                    <th className="py-2 px-3 text-left">Batch Number</th>
                                    <th className="py-2 px-3 text-center">Qty Sold</th>
                                    <th className="py-2 px-3 text-right">Unit Price</th>
                                    <th className="py-2 px-3 text-right">Line Total</th>
                                    <th className="py-2 px-3 text-center">Stock Trace</th>
                                  </tr>`;

const newDrawerThead = `                                  <tr>
                                    <th className="py-2 px-3 text-left">Medicine</th>
                                    <th className="py-2 px-3 text-left">Batch Number</th>
                                    <th className="py-2 px-3 text-center">Qty Sold</th>
                                    <th className="py-2 px-3 text-right">Unit Price</th>
                                    <th className="py-2 px-3 text-right">Purchase Cost</th>
                                    <th className="py-2 px-3 text-right">Profit Earned</th>
                                    <th className="py-2 px-3 text-center">Margin %</th>
                                    <th className="py-2 px-3 text-center">Stock Trace</th>
                                  </tr>`;

code = code.replace(oldDrawerThead, newDrawerThead);
code = code.replace(oldDrawerThead.replace(/\n/g, '\r\n'), newDrawerThead.replace(/\n/g, '\r\n'));

const oldDrawerTbody = `                                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                                        {it.unitPrice ? formatCurrency(it.unitPrice) : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-foreground tabular-nums">
                                        {it.totalAmount ? formatCurrency(it.totalAmount) : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                          <CheckCircle2 className="h-3 w-3" /> Deducted
                                        </span>
                                      </td>`;

const newDrawerTbody = `                                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                                        {it.unitPrice ? formatCurrency(it.unitPrice) : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground tabular-nums">
                                        {formatCurrency(it.purchaseCost ?? 0)}
                                      </td>
                                      <td className={\`py-2.5 px-3 text-right font-bold tabular-nums \${Number(it.profitAmount ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}\`}>
                                        {formatCurrency(it.profitAmount ?? 0)}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className={\`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold \${
                                          it.profitPct == null
                                            ? 'bg-muted text-muted-foreground'
                                            : it.profitPct >= 20
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                            : it.profitPct >= 10
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                            : it.profitPct >= 0
                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                        }\`}>
                                          {it.profitPct != null ? \`\${it.profitPct.toFixed(1)}%\` : '—'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                          <CheckCircle2 className="h-3 w-3" /> Deducted
                                        </span>
                                      </td>`;

code = code.replace(oldDrawerTbody, newDrawerTbody);
code = code.replace(oldDrawerTbody.replace(/\n/g, '\r\n'), newDrawerTbody.replace(/\n/g, '\r\n'));

fs.writeFileSync('src/components/sales/sales-view.tsx', code, 'utf8');
console.log('Successfully patched sales-view.tsx');

