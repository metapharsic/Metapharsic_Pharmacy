import { Building2, Plus, ShieldAlert, Sparkles, UploadCloud } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { PurchaseBillScannerView } from '@/components/purchases/bill-scanner/purchase-bill-scanner-view'
import type {
  MasterBranch,
  MasterProduct,
  MasterSupplier,
} from '@/components/purchases/bill-scanner/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'

export const metadata: Metadata = {
  title: 'AI Purchase Bill Scanner & Multi-Strip Inwarding — PharmaCare',
  description:
    'OCR and Vision parser for distributor invoices, batch extraction, FEFO ingestion, and direct goods received note generation.',
}

export default async function PurchaseBillScanPage() {
  const [canRead, canCreate, session, tenant] = await Promise.all([
    can(PERMISSIONS.PURCHASES_READ),
    can(PERMISSIONS.PURCHASES_CREATE),
    getSession(),
    getTenantContext(),
  ])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Purchase Bill Scanner</h1>
          <p className="text-muted-foreground">Automated OCR and Goods Inwarding</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">
            You do not have permission to access the purchase bill scanning workstation.
          </p>
        </div>
      </div>
    )
  }

  // Pre-seed master tables for fast server-side hydration
  let initialSuppliers: MasterSupplier[] = []
  let initialProducts: MasterProduct[] = []
  let initialBranches: MasterBranch[] = []
  let defaultBranchId = ''

  const organizationId = tenant?.organizationId ?? session.user.organizationId ?? undefined

  try {
    const [supplierRecords, productRecords, branchRecords] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          ...(organizationId ? { organizationId } : {}),
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          gstin: true,
          dlNumber: true,
          phone: true,
          email: true,
          address: true,
        },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      prisma.product.findMany({
        where: {
          ...(organizationId ? { organizationId } : {}),
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          mrp: true,
          costPrice: true,
          ptr: true,
          unitOfMeasure: true,
          gstRate: true,
        },
        orderBy: { name: 'asc' },
        take: 150,
      }),
      prisma.branch.findMany({
        where: {
          ...(organizationId ? { organizationId } : {}),
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          isHeadOffice: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    initialSuppliers = supplierRecords.map((s) => ({
      id: s.id,
      name: s.name,
      gstin: s.gstin,
      dlNumber: s.dlNumber,
      phone: s.phone,
      email: s.email,
      address: s.address,
    }))

    initialProducts = productRecords.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      mrp: Number(p.mrp),
      costPrice: p.costPrice ? Number(p.costPrice) : undefined,
      ptr: p.ptr ? Number(p.ptr) : undefined,
      unitOfMeasure: p.unitOfMeasure,
      gstRate: p.gstRate ? Number(p.gstRate) : undefined,
    }))

    initialBranches = branchRecords.map((b) => ({
      id: b.id,
      name: b.name,
      isHeadOffice: b.isHeadOffice,
    }))

    defaultBranchId =
      (session.user.branchId && initialBranches.some((b) => b.id === session.user.branchId))
        ? session.user.branchId
        : initialBranches.find((b) => b.isHeadOffice)?.id ||
          initialBranches[0]?.id ||
          ''
  } catch {
    // If DB is offline or in mock test environment, fallback gracefully to empty arrays
  }

  return (
    <div className="space-y-4">
      {!canCreate && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            You have read-only access to the Bill Scanner. Committing purchase bills requires &apos;purchases:create&apos; permission.
          </span>
        </div>
      )}

      <PurchaseBillScannerView
        initialSuppliers={initialSuppliers}
        initialProducts={initialProducts}
        initialBranches={initialBranches}
        defaultBranchId={defaultBranchId}
      />
    </div>
  )
}
