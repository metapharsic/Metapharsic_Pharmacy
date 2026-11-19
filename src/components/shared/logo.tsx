import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface LogoProps {
  className?: string
  iconOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'white' | 'dark'
  subtitle?: string
}

export function Logo({
  className,
  iconOnly = false,
  size = 'md',
  variant = 'default',
  subtitle = 'Lifesciences',
}: LogoProps) {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  }

  const textSizes = {
    sm: { title: 'text-sm', sub: 'text-[9px]' },
    md: { title: 'text-base', sub: 'text-[10px]' },
    lg: { title: 'text-xl', sub: 'text-xs' },
  }

  const isWhite = variant === 'white'

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Metapharsic Brand Emblem */}
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 transition-transform hover:scale-105',
          iconSizes[size]
        )}
      >
        <Image
          src="/logo.png"
          alt="Metapharsic Logo"
          width={48}
          height={48}
          className="h-full w-full rounded-full object-cover"
          priority
        />
      </div>

      {/* Brand Typography */}
      {!iconOnly && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-bold tracking-tight',
                textSizes[size].title,
                isWhite ? 'text-white' : 'text-slate-900 dark:text-slate-100'
              )}
            >
              Meta<span className="text-teal-600 dark:text-teal-400">pharsic</span>
            </span>
            <span
              className={cn(
                'rounded px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider',
                isWhite
                  ? 'bg-teal-500/20 text-teal-200 border border-teal-400/30'
                  : 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/50'
              )}
            >
              Rx
            </span>
          </div>
          {subtitle && (
            <span
              className={cn(
                'font-medium tracking-wide uppercase',
                textSizes[size].sub,
                isWhite ? 'text-teal-200/70' : 'text-muted-foreground'
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
