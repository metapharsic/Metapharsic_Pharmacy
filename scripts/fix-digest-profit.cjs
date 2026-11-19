const fs = require('fs');

let code = fs.readFileSync('src/lib/reports/daily-closing-digest-service.ts', 'utf8').replace(/\r\n/g, '\n');

const oldCOGS = `    for (const sale of effectiveSales) {
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

const newCOGS = `    for (const sale of effectiveSales) {
      for (const item of sale.items) {
        itemsSold += item.quantity
        const profitInfo = computeItemProfit({
          totalAmount: item.totalAmount,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemBatches: item.itemBatches,
          product: item.product,
        })
        totalCogs = roundCurrency(totalCogs + (profitInfo.lineCost || 0))
      }
    }`;

code = code.replace(oldCOGS, newCOGS);

fs.writeFileSync('src/lib/reports/daily-closing-digest-service.ts', code, 'utf8');
console.log('✅ Corrected computeItemProfit inputs in src/lib/reports/daily-closing-digest-service.ts');

