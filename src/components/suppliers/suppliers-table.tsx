'use client'

// ─────────────────────────────────────────────────────────────
// Component — SuppliersTable
// Lists suppliers with outstanding balance and status.
// Edit action opens the SupplierFormDialog directly in the table.
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'

import { SupplierFormDialog } from '@/components/suppliers/supplier-form'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'

// ─── Types ───────────────────────────────────────────────────

export interface SupplierRow {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  creditDays: number
  outstandingBalance: string
  isActive: boolean
}

// ─── Column factory (receives onRefresh for edit dialog) ──────

function buildColumns(onRefresh?: () => void): ColumnDef<SupplierRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Supplier Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'contactPerson',
      header: 'Contact',
      cell: ({ row }) =>
        row.original.contactPerson ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) =>
        row.original.phone ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'gstin',
      header: 'GSTIN',
      cell: ({ row }) =>
        row.original.gstin ? (
          <span className="font-mono text-xs">{row.original.gstin}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: 'creditDays',
      header: 'Credit Days',
      cell: ({ row }) => <span>{row.original.creditDays}d</span>,
    },
    {
      accessorKey: 'outstandingBalance',
      header: 'Outstanding',
      cell: ({ row }) => {
        const amount = parseFloat(row.original.outstandingBalance)
        return (
          <span
            className={`font-medium tabular-nums ${
              amount > 0 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {formatCurrency(row.original.outstandingBalance)}
          </span>
        )
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <SupplierFormDialog
          mode="edit"
          defaultValues={{
            id: row.original.id,
            name: row.original.name,
            contactPerson: row.original.contactPerson,
            phone: row.original.phone,
            email: row.original.email,
            gstin: row.original.gstin,
          }}
          onSuccess={onRefresh}
        />
      ),
    },
  ]
}

// ─── Component ───────────────────────────────────────────────

interface SuppliersTableProps {
  rows: SupplierRow[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function SuppliersTable({ rows, isLoading, onRefresh }: SuppliersTableProps) {
  const columns = buildColumns(onRefresh)
  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No suppliers found. Add your first supplier to get started."
    />
  )
}