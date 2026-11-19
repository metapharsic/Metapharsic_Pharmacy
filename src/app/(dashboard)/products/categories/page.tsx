import type { Metadata } from 'next'

import { CategoryManager } from '@/components/categories/category-manager'
import { can } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = {
  title: 'Product Categories & Therapeutic Groups | PharmaCare',
  description: 'Manage dosage forms, therapeutic classifications, and product category trees',
}

export default async function ProductCategoriesPage() {
  const [canRead, canManage] = await Promise.all([
    can(PERMISSIONS.PRODUCTS_READ),
    can(PERMISSIONS.CATEGORIES_MANAGE),
  ])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Product Categories &amp; Therapeutic Classifications
        </h1>
        <p className="text-xs text-muted-foreground">
          Organize medicines by dosage forms (Tablets, Syrups, Injections) and therapeutic groups for inventory tracking and catalog discovery
        </p>
      </div>

      {canRead || canManage ? (
        <CategoryManager canManage={canManage} />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view categories.</p>
        </div>
      )}
    </div>
  )
}
