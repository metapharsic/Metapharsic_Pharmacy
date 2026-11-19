'use client'

import type { ColumnDef } from '@tanstack/react-table'

import { CustomerFormDialog } from '@/components/customers/customer-form'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/currency'

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  creditLimit: number
  outstandingBalance: number
  creditDays: number
  isActive: boolean
  notes: string | null
  discountTier: string | null
  patientDiscountPercent: number
  createdAt: string
  updatedAt: string
}

function tierBadge(tier: string | null) {
  switch (tier) {
    case 'CHRONIC_PATIENT':
      return <Badge variant="info">Chronic Care</Badge>
    case 'SENIOR_CITIZEN':
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Senior (60+)</Badge>
    case 'WHOLESALE':
      return <Badge variant="warning">Wholesale</Badge>
    case 'STAFF':
      return <Badge variant="outline" className="border-teal-500 text-teal-600">Staff</Badge>
    default:
      return <Badge variant="secondary">Regular</Badge>
  }
}

function buildColumns(onRefresh?: () => void): ColumnDef<CustomerRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Customer / Patient',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.original.name}</span>
          <div className="mt-0.5">{tierBadge(row.original.discountTier)}</div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">{row.original.phone ?? '—'}</span>
          {row.original.email && (
            <span className="text-muted-foreground truncate max-w-[140px]">{row.original.email}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.city ? `${row.original.city}, ${row.original.state ?? ''}` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'patientDiscountPercent',
      header: 'Special Discount',
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums text-xs">
          {row.original.patientDiscountPercent > 0 ? (
            <span className="text-teal-600 dark:text-teal-400 font-bold">
              {row.original.patientDiscountPercent}% OFF
            </span>
          ) : (
            <span className="text-muted-foreground">0%</span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'outstandingBalance',
      header: 'Ledger Balance',
      cell: ({ row }) => {
        const balance = row.original.outstandingBalance
        return (
          <div className="flex flex-col text-xs">
            <span
              className={`font-bold tabular-nums ${
                balance > 0 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {formatCurrency(balance)}
            </span>
            {row.original.creditLimit > 0 && (
              <span className="text-[10px] text-muted-foreground">
                Limit: {formatCurrency(row.original.creditLimit)} ({row.original.creditDays}d)
              </span>
            )}
          </div>
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
        <CustomerFormDialog
          mode="edit"
          defaultValues={{
            id: row.original.id,
            name: row.original.name,
            phone: row.original.phone,
            email: row.original.email,
            gstin: row.original.gstin,
            address: row.original.address,
            city: row.original.city,
            state: row.original.state,
            pincode: row.original.pincode,
            creditLimit: row.original.creditLimit,
            creditDays: row.original.creditDays,
            discountTier: row.original.discountTier,
            patientDiscountPercent: row.original.patientDiscountPercent,
            notes: row.original.notes,
            isActive: row.original.isActive,
          }}
          onSuccess={onRefresh}
        />
      ),
    },
  ]
}

interface CustomersTableProps {
  rows: CustomerRow[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function CustomersTable({ rows, isLoading, onRefresh }: CustomersTableProps) {
  const columns = buildColumns(onRefresh)
  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No customers found. Register your first customer to get started."
    />
  )
}
