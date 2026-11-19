const fs = require('fs');

// 1. Patch src/app/api/sales/route.ts
let salesRoute = fs.readFileSync('src/app/api/sales/route.ts', 'utf8').replace(/\r\n/g, '\n');

const targetSales = `    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const query = saleListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))

    const scope = await resolveBranchScope(user, query.branchId)
    const result = await listSales(query, scope)

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
    })`;

const replSales = `    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const userRoles = (user as { roles?: string[] }).roles ?? []
    const isAdmin = userRoles.some((r: string) =>
      ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
    )

    const query = saleListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))

    const scope = await resolveBranchScope(user, query.branchId)
    const result = await listSales(query, scope)

    let data = result.data
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

if (salesRoute.includes(targetSales)) {
  salesRoute = salesRoute.replace(targetSales, replSales);
  fs.writeFileSync('src/app/api/sales/route.ts', salesRoute, 'utf8');
  console.log('✅ Patched src/app/api/sales/route.ts');
} else {
  console.log('⚠️ Target not found in src/app/api/sales/route.ts (might already be patched)');
}

// 2. Patch src/app/api/sales/[id]/route.ts
let saleDetailRoute = fs.readFileSync('src/app/api/sales/[id]/route.ts', 'utf8').replace(/\r\n/g, '\n');

const targetDetail = `    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const scope = await resolveBranchScope(user)

    const sale = await getSaleById(params.id, scope)

    return NextResponse.json({ success: true, data: sale })`;

const replDetail = `    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const userRoles = (user as { roles?: string[] }).roles ?? []
    const isAdmin = userRoles.some((r: string) =>
      ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
    )

    const scope = await resolveBranchScope(user)

    let sale = await getSaleById(params.id, scope)

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

if (saleDetailRoute.includes(targetDetail)) {
  saleDetailRoute = saleDetailRoute.replace(targetDetail, replDetail);
  fs.writeFileSync('src/app/api/sales/[id]/route.ts', saleDetailRoute, 'utf8');
  console.log('✅ Patched src/app/api/sales/[id]/route.ts');
} else {
  console.log('⚠️ Target not found in src/app/api/sales/[id]/route.ts (might already be patched)');
}

