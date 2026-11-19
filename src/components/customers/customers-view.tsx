'use client'

// ─────────────────────────────────────────────────────────────
// Component — CustomersView
// Client container for the Customer Management list page.
// ─────────────────────────────────────────────────────────────
import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { CustomerFormDialog } from '@/components/customers/customer-form'
import { CustomersTable, type CustomerRow } from '@/components/customers/customers-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

interface CustomersViewProps {
  initialRows: CustomerRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
}

export function CustomersView({ initialRows, initialPagination }: CustomersViewProps) {
  const toast = useToast()

  const [rows, setRows] = useState<CustomerRow[]>(initialRows)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [tierFilter, setTierFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statusFilter !== 'ALL') params.set('status', statusFilter)
        if (tierFilter !== 'ALL') params.set('discountTier', tierFilter)

        const res = await fetch(`/api/customers?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: CustomerRow[]
          pagination?: { page: number; total: number; pages: number }
        }
        if (json.success) {
          setRows(json.data ?? [])
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
        } else {
          toast.error('Failed to load customers')
        }
      } catch {
        toast.error('Failed to load customers')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, statusFilter, tierFilter, toast]
  )

  useEffect(() => {
    void load({ reset: true })
  }, [debouncedSearch, statusFilter, tierFilter]) // eslint-disable-line react-hooks/exhaustive-deps, @typescript-eslint/no-floating-promises

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name, phone, or email…"
            className="pl-8"
          />
        </div>

        {/* Tier filter */}
        <div className="w-44">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="REGULAR">Regular Patients</SelectItem>
              <SelectItem value="CHRONIC_PATIENT">Chronic Care</SelectItem>
              <SelectItem value="SENIOR_CITIZEN">Senior Citizens</SelectItem>
              <SelectItem value="WHOLESALE">Wholesale</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-md border p-1">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>

        <CustomerFormDialog mode="create" onSuccess={() => void load({ reset: true })} />
      </div>

      {/* Record count + pagination */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">
          {loading ? '…' : rows.length} customer records
        </Badge>
        <span className="ml-auto">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => load({ page: page - 1 })}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || loading}
          onClick={() => load({ page: page + 1 })}
        >
          Next
        </Button>
      </div>

      <CustomersTable rows={rows} isLoading={loading} onRefresh={() => void load({ reset: true })} />
    </div>
  )
}
