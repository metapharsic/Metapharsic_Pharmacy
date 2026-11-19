import type { Metadata } from 'next'

import { ProductCatalog } from '@/components/products/product-catalog'
import { ProductsPageHeader } from '@/components/products/products-page-header'
import type { ProductRow } from '@/components/products/product-table'
import { can } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getProducts } from '@/lib/products/product-service'

export const metadata: Metadata = { title: 'Product Catalog' }

export default async function ProductCatalogPage({
  searchParams,
}: {
  searchParams?: { categoryId?: string; search?: string; page?: string }
}) {
  const [canRead, canCreate, canUpdate, canImport, tenant] = await Promise.all([
    can(PERMISSIONS.PRODUCTS_READ),
    can(PERMISSIONS.PRODUCTS_CREATE),
    can(PERMISSIONS.PRODUCTS_UPDATE),
    can(PERMISSIONS.PRODUCTS_IMPORT),
    getTenantContext(),
  ])

  if (!canRead) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-muted-foreground">
            Manage your pharmaceutical product master database
          </p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view products.</p>
        </div>
      </div>
    )
  }

  const categoryId = searchParams?.categoryId
  const firstPage = await getProducts({
    page: searchParams?.page ? parseInt(searchParams.page, 10) : 1,
    limit: 20,
    categoryId: categoryId || undefined,
    search: searchParams?.search || undefined,
    organizationId: tenant?.isSuperAdmin ? undefined : (tenant?.organizationId || '__NO_ACCESS__'),
  })

  const ninetyDays = new Date()
  ninetyDays.setDate(ninetyDays.getDate() + 90)

  const initialProducts: ProductRow[] = firstPage.data.map((p) => {
    const batches = p.batches ?? []
    let totalStock = 0
    let earliestExpiry: string | null = null
    let isNearExpiry = false

    const batchSummaries = batches.map((b) => {
      const avail = Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity)
      totalStock += avail
      if (avail > 0 && !earliestExpiry && b.expiryDate) {
        earliestExpiry = new Date(b.expiryDate).toISOString()
      }
      if (avail > 0 && b.expiryDate && new Date(b.expiryDate) <= ninetyDays) {
        isNearExpiry = true
      }
      return {
        id: b.id,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        availableQuantity: avail,
        expiryDate: b.expiryDate,
        mrp: b.mrp ? b.mrp.toString() : p.mrp.toString(),
      }
    })

    return {
      id: p.id,
      name: p.name,
      nameAr: (p as any).nameAr || null,
      genericName: p.genericName,
      genericNameAr: (p as any).genericNameAr || null,
      sku: p.sku,
      barcode: p.barcode,
      manufacturer: p.manufacturer,
      rack: (p.rack && typeof p.rack === 'object' ? (p.rack.shelfNumber ? `${p.rack.code}-${p.rack.shelfNumber}` : p.rack.code) : (p.rack || null)),
      mrp: p.mrp.toString(),
      costPrice: p.costPrice ? p.costPrice.toString() : null,
      gstRate: p.gstRate ? Number(p.gstRate) : 12,
      minStockLevel: p.minStockLevel ?? 10,
      unitOfMeasure: p.unitOfMeasure,
      tabsPerStrip: p.tabsPerStrip ?? null,
      isActive: p.isActive,
      isPrescriptionRequired: p.isPrescriptionRequired,
      drugSchedule: p.drugSchedule,
      hsnCode: p.hsnCode,
      createdAt: p.createdAt,
      categories: Array.isArray(p.categories)
        ? p.categories.map((c) => ({
            category: { id: c.category?.id || '', name: c.category?.name || 'General' },
          }))
        : [],
      totalStock,
      batchCount: batches.length,
      earliestExpiry,
      isNearExpiry,
      batches: batchSummaries,
    }
  })

  return (
    <div className="space-y-4">
      <ProductsPageHeader />
      <ProductCatalog
        initialProducts={initialProducts}
        initialPagination={firstPage.pagination}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canImport={canImport}
        initialCategoryId={categoryId}
      />
    </div>
  )
}
