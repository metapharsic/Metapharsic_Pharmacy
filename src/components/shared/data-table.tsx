'use client'

// ─────────────────────────────────────────────────────────────
// Shared Component — DataTable
// Built on TanStack Table v8 with shadcn Table primitives
// ─────────────────────────────────────────────────────────────
import type {
  ColumnDef,
  ColumnFiltersState,
  RowData,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

import { EmptyState } from './empty-state'
import { LoadingSpinner } from './loading-spinner'

// ─── Module Augmentation for Table Metadata ───────────────────

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string
    headerClassName?: string
    cellClassName?: string
    align?: 'left' | 'center' | 'right'
  }
}

// ─── Types ───────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  searchKey?: string
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  emptyMessage?: string
  pageSize?: number
  // Manual / server-side pagination props
  manualPagination?: boolean
  pageCount?: number
  pageIndex?: number
  totalRows?: number
  onPageChange?: (page: number) => void
  hidePagination?: boolean
}

// ─── Component ───────────────────────────────────────────────

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchKey,
  searchPlaceholder = 'Search…',
  toolbar,
  emptyMessage = 'No records found.',
  pageSize = 20,
  manualPagination = false,
  pageCount: externalPageCount,
  pageIndex: externalPageIndex,
  totalRows: externalTotalRows,
  onPageChange,
  hidePagination = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: { pagination: { pageSize } },
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  })

  // Pagination calculation
  const totalRowsCount = manualPagination && externalTotalRows !== undefined
    ? externalTotalRows
    : table.getFilteredRowModel().rows.length

  const currentPage = totalRowsCount === 0
    ? 0
    : manualPagination && externalPageIndex !== undefined
      ? externalPageIndex
      : table.getState().pagination.pageIndex + 1

  const totalPages = totalRowsCount === 0
    ? 0
    : manualPagination && externalPageCount !== undefined
      ? externalPageCount
      : table.getPageCount()

  const canPrevious = manualPagination
    ? (externalPageIndex ?? 1) > 1 && !isLoading && totalRowsCount > 0
    : table.getCanPreviousPage() && totalRowsCount > 0

  const canNext = manualPagination
    ? (externalPageIndex ?? 1) < (externalPageCount ?? 1) && !isLoading && totalRowsCount > 0
    : table.getCanNextPage() && totalRowsCount > 0

  const handleFirstPage = () => {
    if (manualPagination) {
      if (canPrevious && onPageChange) onPageChange(1)
    } else {
      table.setPageIndex(0)
    }
  }

  const handlePreviousPage = () => {
    if (manualPagination) {
      if (canPrevious && onPageChange && externalPageIndex) {
        onPageChange(externalPageIndex - 1)
      }
    } else {
      table.previousPage()
    }
  }

  const handleNextPage = () => {
    if (manualPagination) {
      if (canNext && onPageChange && externalPageIndex) {
        onPageChange(externalPageIndex + 1)
      }
    } else {
      table.nextPage()
    }
  }

  const handleLastPage = () => {
    if (manualPagination) {
      if (canNext && onPageChange && externalPageCount) {
        onPageChange(externalPageCount)
      }
    } else {
      table.setPageIndex(Math.max(0, table.getPageCount() - 1))
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {searchKey && (
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
              onChange={(e) => table.getColumn(searchKey)?.setFilterValue(e.target.value)}
              className="pl-8"
            />
          </div>
        )}
        {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <colgroup>
            {table.getVisibleFlatColumns().map((col) => {
              const meta = col.columnDef.meta
              return (
                <col
                  key={col.id}
                  className={meta?.headerClassName || meta?.className}
                />
              )
            })}
          </colgroup>
          <thead className="bg-muted/50 border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const align =
                    meta?.align ||
                    (meta?.headerClassName?.includes('text-right') || meta?.className?.includes('text-right')
                      ? 'right'
                      : meta?.headerClassName?.includes('text-center') || meta?.className?.includes('text-center')
                        ? 'center'
                        : 'left')
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-4 py-3 font-semibold text-xs tracking-wider uppercase text-muted-foreground select-none',
                        align === 'right' && 'text-right',
                        align === 'center' && 'text-center',
                        align === 'left' && 'text-left',
                        meta?.headerClassName,
                        meta?.className
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <LoadingSpinner size="md" className="mx-auto" label="Loading data…" />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8">
                  <EmptyState title="No results" description={emptyMessage} />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'transition-colors hover:bg-muted/30',
                    row.getIsSelected() && 'bg-muted/50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta
                    const align =
                      meta?.align ||
                      (meta?.cellClassName?.includes('text-right') || meta?.className?.includes('text-right')
                        ? 'right'
                        : meta?.cellClassName?.includes('text-center') || meta?.className?.includes('text-center')
                          ? 'center'
                          : 'left')
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-4 py-3 align-middle',
                          align === 'right' && 'text-right',
                          align === 'center' && 'text-center',
                          align === 'left' && 'text-left',
                          meta?.cellClassName,
                          meta?.className
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!hidePagination && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {totalRowsCount} row(s)
            {table.getFilteredSelectedRowModel().rows.length > 0 &&
              ` • ${table.getFilteredSelectedRowModel().rows.length} selected`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleFirstPage}
              disabled={!canPrevious}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePreviousPage}
              disabled={!canPrevious}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums text-foreground font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextPage}
              disabled={!canNext}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleLastPage}
              disabled={!canNext}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
