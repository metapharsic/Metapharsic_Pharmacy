const fs = require('fs');

let code = fs.readFileSync('src/app/(dashboard)/sales/[id]/page.tsx', 'utf8').replace(/\r\n/g, '\n');

// Update isAdmin definition
code = code.replace(
  `  const userRoles = session?.user?.roles ?? []
  const isAdminOrManager = userRoles.some((r: string) =>
    ['admin', 'owner', 'manager'].includes(r.toLowerCase())
  )`,
  `  const userRoles = session?.user?.roles ?? []
  const isAdmin = userRoles.some((r: string) =>
    ['admin', 'owner', 'super_admin'].includes(r.toLowerCase())
  )
  const isAdminOrManager = userRoles.some((r: string) =>
    ['admin', 'owner', 'manager'].includes(r.toLowerCase())
  )`
);

// Gated summary rows
const oldSummaryRows = `            <InfoRow label="GST" value={formatCurrency(sale.taxAmount.toString())} />
            <InfoRow label="Purchase Cost" value={formatCurrency((sale.purchaseCost ?? 0).toString())} />
            <InfoRow
              label="Profit Earned"
              value={\`\${formatCurrency((sale.profitAmount ?? 0).toString())} (\${sale.profitPct != null ? \`\${sale.profitPct.toFixed(1)}%\` : '0%'})\`}
            />
            <InfoRow label="Amount Paid" value={formatCurrency(sale.amountPaid.toString())} />`;

const newSummaryRows = `            <InfoRow label="GST" value={formatCurrency(sale.taxAmount.toString())} />
            {isAdmin && (
              <>
                <InfoRow label="Purchase Cost" value={formatCurrency((sale.purchaseCost ?? 0).toString())} />
                <InfoRow
                  label="Profit Earned"
                  value={\`\${formatCurrency((sale.profitAmount ?? 0).toString())} (\${sale.profitPct != null ? \`\${sale.profitPct.toFixed(1)}%\` : '0%'})\`}
                />
              </>
            )}
            <InfoRow label="Amount Paid" value={formatCurrency(sale.amountPaid.toString())} />`;

code = code.replace(oldSummaryRows, newSummaryRows);

fs.writeFileSync('src/app/(dashboard)/sales/[id]/page.tsx', code, 'utf8');
console.log('✅ Updated src/app/(dashboard)/sales/[id]/page.tsx');

