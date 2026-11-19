'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

export interface SearchableSelectOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
  disabled?: boolean
  keywords?: string[]
}

export interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  triggerId?: string
  allowCustom?: boolean
  customLabelPrefix?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  disabled = false,
  className,
  contentClassName,
  triggerId,
  allowCustom = false,
  customLabelPrefix = 'Use custom:',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  // Find currently selected option by value or exact label match
  const selectedOption = useMemo(() => {
    if (!value) return undefined
    return (
      options.find((opt) => opt.value === value) ||
      options.find((opt) => opt.label.trim().toLowerCase() === value.trim().toLowerCase())
    )
  }, [options, value])

  // Filter options based on query
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options

    return options.filter((opt) => {
      if (opt.label.toLowerCase().includes(q)) return true
      if (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) return true
      if (opt.badge && opt.badge.toLowerCase().includes(q)) return true
      if (opt.keywords && opt.keywords.some((k) => k.toLowerCase().includes(q))) return true
      return false
    })
  }, [options, query])

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
  }

  const handleCustomAdd = () => {
    if (!query.trim()) return
    onChange(query.trim())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={triggerId}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-left transition-colors hover:border-primary/50',
            !selectedOption && !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate flex-1 font-medium text-foreground">
            {selectedOption ? (
              <span className="flex items-center gap-1.5 truncate">
                <span>{selectedOption.label}</span>
                {selectedOption.badge && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-primary/10 text-primary">
                    {selectedOption.badge}
                  </span>
                )}
              </span>
            ) : value ? (
              <span>{value}</span>
            ) : (
              <span className="text-muted-foreground font-normal">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          'z-[80] w-[min(calc(100vw-2rem),360px)] p-0 rounded-lg shadow-xl border border-border/80 bg-popover text-popover-foreground overflow-hidden',
          contentClassName
        )}
      >
        {/* Search header with input */}
        <div className="flex items-center border-b px-2.5 py-1.5 bg-muted/20">
          <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (filteredOptions.length > 0) {
                  handleSelect(filteredOptions[0].value)
                } else if (allowCustom && query.trim()) {
                  handleCustomAdd()
                }
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-0 h-7"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Options list */}
        <div className="max-h-64 overflow-y-auto p-1 text-xs divide-y divide-border/20">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'relative flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/60 text-foreground',
                    opt.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{opt.label}</span>
                      {opt.badge && (
                        <Badge
                          variant={opt.badgeVariant || 'outline'}
                          className="text-[9px] px-1 py-0 h-4 border-primary/30"
                        >
                          {opt.badge}
                        </Badge>
                      )}
                    </div>
                    {opt.sublabel && (
                      <div className="text-[10px] text-muted-foreground font-normal truncate mt-0.5">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  )}
                </button>
              )
            })
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">
              <p>{emptyMessage}</p>
              {allowCustom && query.trim() && (
                <button
                  type="button"
                  onClick={handleCustomAdd}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  {customLabelPrefix} "{query.trim()}"
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer info showing result count */}
        <div className="border-t bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>{filteredOptions.length} of {options.length} options</span>
          {query && <span>Filter: "{query}"</span>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
