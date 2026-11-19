const fs = require('fs');

// 1. Fix src/app/api/sales/route.ts
let salesRoute = fs.readFileSync('src/app/api/sales/route.ts', 'utf8').replace(/\r\n/g, '\n');

const oldSalesSanitize = `    let data = result.data
    let summary = result.summary

    if (!isAdmin) {
      data = data.map((s) => ({
        ...s,
        purchaseCost: undefined,
        profitAmount: undefined,
        profitPct: undefined,
        purchaseCostComplete: undefined,
        purchaseUnpricedUnits: undefined,
        items: s.items?.map((it) => ({
          ...it,
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          costBasis: undefined,
          itemBatches: it.itemBatches?.map((ib) => ({
            ...ib,
            batch: {
              ...ib.batch,
              purchasePrice: undefined,
            },
          })),
        })),
      }))

      summary = {
        billsCount: summary.billsCount,
        salesValue: summary.salesValue,
        amountReceived: summary.amountReceived,
        outstanding: summary.outstanding,
        totalPurchaseCost: undefined,
        totalProfit: undefined,
        profitMarginPct: undefined,
        purchaseCostComplete: undefined,
        unpricedUnits: undefined,
      }
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: result.pagination,
      summary,
    })`;

const newSalesSanitize = `    const data = !isAdmin
      ? (result.data as any[]).map((s) => ({
          ...s,
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          purchaseCostComplete: undefined,
          purchaseUnpricedUnits: undefined,
          items: s.items?.map((it: any) => ({
            ...it,
            purchaseCost: undefined,
            profitAmount: undefined,
            profitPct: undefined,
            costBasis: undefined,
            itemBatches: it.itemBatches?.map((ib: any) => ({
              ...ib,
              batch: {
                ...ib.batch,
                purchasePrice: undefined,
              },
            })),
          })),
        }))
      : result.data

    const summary = !isAdmin
      ? {
          billsCount: result.summary.billsCount,
          salesValue: result.summary.salesValue,
          amountReceived: result.summary.amountReceived,
          outstanding: result.summary.outstanding,
        }
      : result.summary

    return NextResponse.json({
      success: true,
      data,
      pagination: result.pagination,
      summary,
    })`;

salesRoute = salesRoute.replace(oldSalesSanitize, newSalesSanitize);
fs.writeFileSync('src/app/api/sales/route.ts', salesRoute, 'utf8');
console.log('✅ Updated src/app/api/sales/route.ts');

// 2. Fix src/app/api/sales/[id]/route.ts
let detailRoute = fs.readFileSync('src/app/api/sales/[id]/route.ts', 'utf8').replace(/\r\n/g, '\n');

const oldDetailSanitize = `    let sale = await getSaleById(params.id, scope)

    if (!isAdmin && sale) {
      sale = {
        ...sale,
        purchaseCost: undefined,
        profitAmount: undefined,
        profitPct: undefined,
        purchaseCostComplete: undefined,
        purchaseUnpricedUnits: undefined,
        items: sale.items?.map((it) => ({
          ...it,
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          costBasis: undefined,
          itemBatches: it.itemBatches?.map((ib) => ({
            ...ib,
            batch: {
              ...ib.batch,
              purchasePrice: undefined,
            },
          })),
        })),
      }
    }

    return NextResponse.json({ success: true, data: sale })`;

const newDetailSanitize = `    const rawSale = await getSaleById(params.id, scope)

    const sale = !isAdmin && rawSale
      ? {
          ...(rawSale as any),
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          purchaseCostComplete: undefined,
          purchaseUnpricedUnits: undefined,
          items: rawSale.items?.map((it: any) => ({
            ...it,
            purchaseCost: undefined,
            profitAmount: undefined,
            profitPct: undefined,
            costBasis: undefined,
            itemBatches: it.itemBatches?.map((ib: any) => ({
              ...ib,
              batch: {
                ...ib.batch,
                purchasePrice: undefined,
              },
            })),
          })),
        }
      : rawSale

    return NextResponse.json({ success: true, data: sale })`;

detailRoute = detailRoute.replace(oldDetailSanitize, newDetailSanitize);
fs.writeFileSync('src/app/api/sales/[id]/route.ts', detailRoute, 'utf8');
console.log('✅ Updated src/app/api/sales/[id]/route.ts');

// 3. Fix scripts/multithreaded_wire_sales_profit_and_whatsapp_eod.ts
let wireScript = fs.readFileSync('scripts/multithreaded_wire_sales_profit_and_whatsapp_eod.ts', 'utf8').replace(/\r\n/g, '\n');

const oldWirePricing = `        for (const sale of sales) {
          const itemProfits = sale.items.map((it) =>
            computeItemProfit({
              totalAmount: it.totalAmount,
              quantity: it.quantity,
              batches: it.itemBatches.map((ib) => ({
                quantity: ib.quantity,
                purchasePrice: ib.batch.purchasePrice,
              })),
              productCostPrice: it.product.costPrice,
              productPtr: it.product.ptr,
              productMrp: it.product.mrp,
            })
          )

          const saleProfit = computeSaleProfit({
            totalAmount: sale.totalAmount,
            items: itemProfits,
          })

          totalCalculatedCost += saleProfit.purchaseCost
          totalCalculatedProfit += saleProfit.profitAmount
          totalInvoicedRevenue += Number(sale.totalAmount)
        }`;

const newWirePricing = `        for (const sale of sales) {
          const itemProfits = sale.items.map((it) =>
            computeItemProfit({
              totalAmount: it.totalAmount,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              itemBatches: it.itemBatches,
              product: it.product,
            })
          )

          const saleProfit = computeSaleProfit({
            totalAmount: sale.totalAmount,
            items: sale.items.map((it) => ({
              totalAmount: it.totalAmount,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              itemBatches: it.itemBatches,
              product: it.product,
            })),
          })

          totalCalculatedCost += saleProfit.purchaseCost
          totalCalculatedProfit += saleProfit.profitAmount
          totalInvoicedRevenue += Number(sale.totalAmount)
        }`;

wireScript = wireScript.replace(oldWirePricing, newWirePricing);
fs.writeFileSync('scripts/multithreaded_wire_sales_profit_and_whatsapp_eod.ts', wireScript, 'utf8');
console.log('✅ Updated scripts/multithreaded_wire_sales_profit_and_whatsapp_eod.ts');

