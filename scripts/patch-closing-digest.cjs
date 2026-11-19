const fs = require('fs');

let code = fs.readFileSync('src/lib/reports/daily-closing-digest-service.ts', 'utf8').replace(/\r\n/g, '\n');

// 1. Add import
if (!code.includes("import { computeItemProfit } from '@/lib/sales/pricing'")) {
  code = code.replace(
    "import { roundCurrency } from '@/lib/utils/currency'",
    "import { computeItemProfit } from '@/lib/sales/pricing'\nimport { roundCurrency } from '@/lib/utils/currency'"
  );
}

// 2. Update COGS loop
const oldLoop = `    for (const sale of effectiveSales) {
      for (const item of sale.items) {
        itemsSold += item.quantity
        const purchaseCost = Number(
          item.itemBatches[0]?.batch?.purchasePrice || Number(item.unitPrice) * 0.7
        )
        totalCogs = roundCurrency(totalCogs + purchaseCost * item.quantity)
      }
    }`;

const newLoop = `    for (const sale of effectiveSales) {
      for (const item of sale.items) {
        itemsSold += item.quantity
        const profitInfo = computeItemProfit({
          totalAmount: item.totalAmount,
          quantity: item.quantity,
          batches: item.itemBatches.map((ib) => ({
            quantity: ib.quantity,
            purchasePrice: ib.batch.purchasePrice,
          })),
          productCostPrice: item.product.costPrice,
          productPtr: item.product.ptr,
          productMrp: item.product.mrp,
        })
        totalCogs = roundCurrency(totalCogs + profitInfo.purchaseCost)
      }
    }`;

code = code.replace(oldLoop, newLoop);

fs.writeFileSync('src/lib/reports/daily-closing-digest-service.ts', code, 'utf8');
console.log('✅ Updated src/lib/reports/daily-closing-digest-service.ts');

