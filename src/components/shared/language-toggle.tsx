'use client'

import React, { useState } from 'react'
import { Globe, Check, Layers, Cpu, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/i18n-context'
import {
  getAllTerritories,
  TerritoryCode,
  TerritoryDefinition,
} from '@/lib/territory/territory-config'
import { playClickSound } from '@/lib/sound/sound-effects'
import { cn } from '@/lib/utils/cn'

export function LanguageToggle({ className }: { className?: string }) {
  const {
    locale,
    languageMode,
    isPureArabic,
    dir,
    territory,
    territoryDef,
    setLocale,
    setLanguageMode,
    setTerritory,
    t,
    threads,
    isLoadingThreads,
    runTerritoryPreflight,
  } = useI18n()

  const [showTelemetryModal, setShowTelemetryModal] = useState(false)
  const territories = getAllTerritories()

  const handleSelectLanguageMode = (mode: 'ar-pure' | 'ar-bilingual' | 'en') => {
    try {
      playClickSound()
    } catch {
      // sound optional
    }
    setLanguageMode(mode)
  }

  const handleSelectTerritory = (tDef: TerritoryDefinition) => {
    try {
      playClickSound()
    } catch {
      // sound optional
    }
    setTerritory(tDef.code)
    runTerritoryPreflight(tDef.code)
  }

  const handleOpenTelemetry = () => {
    runTerritoryPreflight()
    setShowTelemetryModal(true)
  }

  return (
    <>
      <div className={cn('flex items-center gap-1', className)}>
        {/* Language Selection Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 px-2.5 rounded-lg border-border/70 text-xs font-semibold hover:border-teal-500/50 hover:bg-teal-500/10 transition-colors gap-1.5"
              title={
                languageMode === 'ar-pure'
                  ? 'العربية بالكامل (100% بدون إنجليزية)'
                  : languageMode === 'ar-bilingual'
                    ? 'ثنائي اللغة (عربي / إنجليزي)'
                    : 'English Interface'
              }
            >
              <span className="text-sm">{territoryDef.flag}</span>
              <span className="font-bold text-foreground">
                {languageMode === 'ar-pure'
                  ? 'العربية بالكامل'
                  : languageMode === 'ar-bilingual'
                    ? 'ثنائي اللغة'
                    : 'English'}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 font-mono uppercase bg-muted border-border/60"
              >
                {languageMode === 'ar-pure' ? 'عربي 100%' : languageMode === 'ar-bilingual' ? 'AR/EN' : 'EN'}
              </Badge>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-2">
            <DropdownMenuLabel className="text-xs font-bold text-foreground/80">
              {locale === 'ar' ? 'اختر وضع لغة النظام' : 'Select System Language Mode'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* 100% Pure Arabic Option */}
            <DropdownMenuItem
              onClick={() => handleSelectLanguageMode('ar-pure')}
              className={cn(
                'flex items-center justify-between cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors',
                languageMode === 'ar-pure'
                  ? 'bg-teal-500/10 text-teal-900 dark:text-teal-200 font-semibold border border-teal-500/30'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <div className="flex flex-col">
                <span className="font-bold flex items-center gap-1.5">
                  <span>🇸🇦</span>
                  <span>العربية بالكامل (Pure Arabic)</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  تعريب كامل للمخزون ونقطة البيع بدون إنجليزية
                </span>
              </div>
              {languageMode === 'ar-pure' && <Check className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
            </DropdownMenuItem>

            {/* Bilingual Option */}
            <DropdownMenuItem
              onClick={() => handleSelectLanguageMode('ar-bilingual')}
              className={cn(
                'flex items-center justify-between cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors',
                languageMode === 'ar-bilingual'
                  ? 'bg-teal-500/10 text-teal-900 dark:text-teal-200 font-semibold border border-teal-500/30'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <div className="flex flex-col">
                <span className="font-bold flex items-center gap-1.5">
                  <span>🌐</span>
                  <span>ثنائي اللغة (Bilingual AR / EN)</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  عرض الأسماء بالأصلية والمترجمة معاً
                </span>
              </div>
              {languageMode === 'ar-bilingual' && <Check className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
            </DropdownMenuItem>

            {/* English Option */}
            <DropdownMenuItem
              onClick={() => handleSelectLanguageMode('en')}
              className={cn(
                'flex items-center justify-between cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors',
                languageMode === 'en'
                  ? 'bg-teal-500/10 text-teal-900 dark:text-teal-200 font-semibold border border-teal-500/30'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <div className="flex flex-col">
                <span className="font-bold flex items-center gap-1.5">
                  <span>🇬🇧</span>
                  <span>English (Full English)</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Standard International LTR interface
                </span>
              </div>
              {languageMode === 'en' && <Check className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Territory & Precision Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8.5 w-8.5 rounded-lg border-border/70 hover:border-teal-500/50"
              title="Select Geopolitical Sovereign Zone & Precision"
            >
              <Globe className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72 p-2">
            <DropdownMenuLabel className="text-xs font-bold text-foreground/80 flex items-center justify-between">
              <span>{t('territory.title', 'Sovereign Geopolitical Zone')}</span>
              <Badge variant="teal" className="text-[10px] uppercase font-mono">
                {territoryDef.currency.code} ({territoryDef.currency.decimals} Dec)
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* List of Sovereign Countries */}
            <div className="space-y-1 py-1">
              {territories.map((item) => {
                const isSelected = item.code === territory
                return (
                  <DropdownMenuItem
                    key={item.code}
                    onClick={() => handleSelectTerritory(item)}
                    className={cn(
                      'flex items-center justify-between cursor-pointer rounded-md px-2.5 py-2 text-xs transition-colors',
                      isSelected
                        ? 'bg-teal-500/10 text-teal-900 dark:text-teal-200 font-semibold border border-teal-500/30'
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.flag}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {locale === 'ar' ? item.nameAr : item.nameEn}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {item.currency.code} ({item.currency.symbolAr}) • {item.tax.regime}{' '}
                          {item.tax.standardVatRate}% VAT
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
                  </DropdownMenuItem>
                )
              })}
            </div>

            <DropdownMenuSeparator />

            {/* Multi-Thread Wire Preflight Trigger */}
            <DropdownMenuItem
              onClick={handleOpenTelemetry}
              className="flex items-center gap-2 cursor-pointer rounded-md p-2 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-500/10"
            >
              <Cpu className="h-4 w-4" />
              <span>{t('auth.diagnostics', 'Territory Multi-Thread Telemetry')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 5-Thread Territory Telemetry Modal */}
      <Dialog open={showTelemetryModal} onOpenChange={setShowTelemetryModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{territoryDef.flag}</span>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Sovereign Territory Multi-Thread Engine</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {territoryDef.code} • {territoryDef.currency.code}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Concurrent thread execution telemetry for {territoryDef.nameEn} (
                  {territoryDef.nameAr})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Territory Highlights Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Currency Precision
                </span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {territoryDef.currency.decimals} Decimals
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  1 {territoryDef.currency.code} = {territoryDef.currency.subunitScale}{' '}
                  {territoryDef.currency.subunitNameEn}
                </span>
              </div>

              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Tax Regime
                </span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {territoryDef.tax.regime}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {territoryDef.tax.standardVatRate}% Standard VAT
                </span>
              </div>

              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Medicine Tax
                </span>
                <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {territoryDef.tax.zeroRatedMedicines ? '0% Zero-Rated' : 'Standard Rate'}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {territoryDef.regulatory.acronym} Registered
                </span>
              </div>

              <div className="rounded-lg border bg-muted/40 p-2.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Direction & Script
                </span>
                <span className="font-mono font-bold text-sm text-foreground uppercase">
                  {dir} • {locale}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {locale === 'ar' ? 'Cairo / IBM Plex' : 'Plus Jakarta'}
                </span>
              </div>
            </div>

            {/* Live Thread List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-teal-600" />
                  <span>Parallel Worker Threads Telemetry</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runTerritoryPreflight()}
                  disabled={isLoadingThreads}
                  className="h-6 text-[11px] px-2 text-teal-600 hover:text-teal-700"
                >
                  {isLoadingThreads ? 'Re-executing...' : 'Re-run Preflight'}
                </Button>
              </div>

              {threads ? (
                threads.map((thread) => (
                  <div
                    key={thread.id}
                    className="rounded-lg border border-border/80 bg-card p-3 shadow-xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20 text-[10px] font-bold text-teal-700 dark:text-teal-300 font-mono">
                          {thread.id}
                        </span>
                        <span className="font-semibold text-foreground">{thread.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-mono"
                        >
                          {thread.status}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {thread.durationMs}ms
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-[11px] pl-7">{thread.details}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Cpu className="h-6 w-6 mx-auto mb-2 text-teal-600 animate-pulse" />
                  <span>Click "Re-run Preflight" to execute the 5 parallel worker threads.</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
