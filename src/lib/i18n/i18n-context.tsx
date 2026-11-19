'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { useSession } from 'next-auth/react'
import enDict from './dictionaries/en.json'
import arDict from './dictionaries/ar.json'
import {
  TerritoryCode,
  TerritoryDefinition,
  getTerritory,
  detectTerritoryFromTimezone,
  SupportedLanguage,
  DocumentDirection,
} from '@/lib/territory/territory-config'
import {
  formatCurrency,
  FormatCurrencyOptions,
} from '@/lib/territory/currency-service'
import { TerritoryThreadTelemetry } from '@/lib/territory/multi-thread-territory-engine'
import {
  getLocalizedDrugName,
  getLocalizedGenericName,
  getLocalizedUnit,
  getLocalizedCategory,
  getLocalizedSchedule,
  getLocalizedStatus,
  getLocalizedLocation,
} from './drug-translator'

type Dictionary = typeof enDict

export type LanguageMode = 'ar-pure' | 'ar-bilingual' | 'en'

interface I18nContextType {
  locale: SupportedLanguage
  languageMode: LanguageMode
  isAr: boolean
  isPureArabic: boolean
  dir: DocumentDirection
  territory: TerritoryCode
  territoryDef: TerritoryDefinition
  setLocale: (locale: SupportedLanguage) => void
  setLanguageMode: (mode: LanguageMode) => void
  setTerritory: (territory: TerritoryCode) => void
  t: (keyPath: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string
  formatPrice: (amount: number | string, options?: FormatCurrencyOptions) => string
  threads: TerritoryThreadTelemetry[] | null
  isLoadingThreads: boolean
  runTerritoryPreflight: (overrideTerritory?: TerritoryCode) => Promise<void>
  translateDrug: (nameEn?: string | null, nameAr?: string | null) => string
  translateGeneric: (genericEn?: string | null, genericAr?: string | null) => string | null
  translateUnit: (unit?: string | null) => string
  translateCategory: (category?: string | null) => string
  translateSchedule: (schedule?: string | null) => string
  translateStatus: (status?: string | null) => string
  translateLocation: (rack?: string | null, shelf?: string | null, box?: string | null) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = {
  en: enDict,
  ar: arDict,
}

const STORAGE_LOCALE_KEY = 'mpharm_locale'
const STORAGE_LANG_MODE_KEY = 'mpharm_lang_mode'
const STORAGE_TERRITORY_KEY = 'mpharm_territory'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLanguage>('en')
  const [languageMode, setLanguageModeState] = useState<LanguageMode>('ar-pure')
  const [territory, setTerritoryState] = useState<TerritoryCode>('SA')
  const [threads, setThreads] = useState<TerritoryThreadTelemetry[] | null>(null)
  const [isLoadingThreads, setIsLoadingThreads] = useState<boolean>(false)

  // Initialize territory & locale from browser or stored preference
  useEffect(() => {
    let savedLocale: SupportedLanguage | null = null
    let savedMode: LanguageMode | null = null
    let savedTerritory: TerritoryCode | null = null

    try {
      savedLocale = (localStorage.getItem(STORAGE_LOCALE_KEY) as SupportedLanguage) || null
      savedMode = (localStorage.getItem(STORAGE_LANG_MODE_KEY) as LanguageMode) || null
      savedTerritory = (localStorage.getItem(STORAGE_TERRITORY_KEY) as TerritoryCode) || null
    } catch {
      // localStorage may fail in restricted sandboxes
    }

    if (!savedTerritory) {
      try {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        savedTerritory = detectTerritoryFromTimezone(browserTz)
      } catch {
        savedTerritory = 'SA'
      }
    }

    const initialTerritory = savedTerritory || 'SA'
    setTerritoryState(initialTerritory)

    let initialMode: LanguageMode = savedMode || (initialTerritory === 'IN' || initialTerritory === 'MV' ? 'en' : 'ar-pure')
    let initialLocale: SupportedLanguage = savedLocale || (initialMode === 'en' ? 'en' : 'ar')

    setLocaleState(initialLocale)
    setLanguageModeState(initialMode)

    // Synchronize document direction and lang attributes
    applyDocumentAttributes(initialLocale)
  }, [])

  const { data: session } = useSession()

  // Automatically adapt territory and language when a user logs into a sovereign store
  useEffect(() => {
    let savedMode: LanguageMode | null = null
    try {
      savedMode = (localStorage.getItem(STORAGE_LANG_MODE_KEY) as LanguageMode) || null
    } catch {}

    const userTerritory =
      (session?.user as any)?.territoryCode ||
      (session?.user as any)?.organization?.territoryCode

    if (userTerritory && ['SA', 'OM', 'BH', 'QA', 'MV', 'IN'].includes(userTerritory)) {
      const code = userTerritory as TerritoryCode
      setTerritoryState(code)
      try {
        localStorage.setItem(STORAGE_TERRITORY_KEY, code)
      } catch {}

      // Only adjust language if user has NOT explicitly selected their own language preference
      if (!savedMode) {
        if (['SA', 'OM', 'BH', 'QA'].includes(code)) {
          setLocaleState('ar')
          setLanguageModeState('ar-pure')
          applyDocumentAttributes('ar')
        } else if (['IN', 'MV'].includes(code)) {
          setLocaleState('en')
          setLanguageModeState('en')
          applyDocumentAttributes('en')
        }
      }
    }
  }, [session])

  const applyDocumentAttributes = (activeLocale: SupportedLanguage) => {
    if (typeof document !== 'undefined') {
      const dir: DocumentDirection = activeLocale === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = activeLocale
      document.documentElement.dir = dir

      if (dir === 'rtl') {
        document.documentElement.classList.add('rtl-active')
      } else {
        document.documentElement.classList.remove('rtl-active')
      }
    }
  }

  const isPureArabic = locale === 'ar' && languageMode === 'ar-pure'
  const isAr = locale === 'ar' || languageMode !== 'en'

  const setLanguageMode = useCallback((mode: LanguageMode) => {
    setLanguageModeState(mode)
    const nextLocale: SupportedLanguage = mode === 'en' ? 'en' : 'ar'
    setLocaleState(nextLocale)
    applyDocumentAttributes(nextLocale)
    try {
      localStorage.setItem(STORAGE_LANG_MODE_KEY, mode)
      localStorage.setItem(STORAGE_LOCALE_KEY, nextLocale)
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // ignore storage errors
    }
  }, [])

  const setLocale = useCallback((newLocale: SupportedLanguage) => {
    setLocaleState(newLocale)
    const newMode: LanguageMode = newLocale === 'en' ? 'en' : 'ar-pure'
    setLanguageModeState(newMode)
    applyDocumentAttributes(newLocale)
    try {
      localStorage.setItem(STORAGE_LOCALE_KEY, newLocale)
      localStorage.setItem(STORAGE_LANG_MODE_KEY, newMode)
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // ignore storage errors
    }
  }, [])

  const setTerritory = useCallback((newTerritory: TerritoryCode) => {
    setTerritoryState(newTerritory)
    try {
      localStorage.setItem(STORAGE_TERRITORY_KEY, newTerritory)
    } catch {
      // ignore storage errors
    }
  }, [])

  const territoryDef = useMemo(() => getTerritory(territory), [territory])
  const dir: DocumentDirection = locale === 'ar' ? 'rtl' : 'ltr'

  // Translation helpers
  const translateDrug = useCallback(
    (nameEn?: string | null, nameAr?: string | null) =>
      getLocalizedDrugName(nameEn, nameAr, locale, isPureArabic),
    [locale, isPureArabic]
  )

  const translateGeneric = useCallback(
    (genericEn?: string | null, genericAr?: string | null) =>
      getLocalizedGenericName(genericEn, genericAr, locale),
    [locale]
  )

  const translateUnit = useCallback(
    (unit?: string | null) => getLocalizedUnit(unit, locale),
    [locale]
  )

  const translateCategory = useCallback(
    (category?: string | null) => getLocalizedCategory(category, locale),
    [locale]
  )

  const translateSchedule = useCallback(
    (schedule?: string | null) => getLocalizedSchedule(schedule, locale),
    [locale]
  )

  const translateStatus = useCallback(
    (status?: string | null) => getLocalizedStatus(status, locale),
    [locale]
  )

  const translateLocation = useCallback(
    (rack?: string | null, shelf?: string | null, box?: string | null) =>
      getLocalizedLocation(rack, shelf, box, locale),
    [locale]
  )

  // Translation function navigating dot notation: e.g. "pos.fastBilling"
  const t = useCallback(
    (
      keyPath: string,
      fallbackOrParams?: string | Record<string, string | number>,
      params?: Record<string, string | number>
    ): string => {
      const activeDict = DICTIONARIES[locale] || DICTIONARIES.en
      const fallbackDict = DICTIONARIES.en

      let fallbackText = typeof fallbackOrParams === 'string' ? fallbackOrParams : keyPath
      let replacements = typeof fallbackOrParams === 'object' ? fallbackOrParams : params

      const keys = keyPath.split('.')
      let val: any = activeDict

      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k]
        } else {
          val = undefined
          break
        }
      }

      // Fallback to English dictionary if key not found in Arabic
      if (val === undefined) {
        let fVal: any = fallbackDict
        for (const k of keys) {
          if (fVal && typeof fVal === 'object' && k in fVal) {
            fVal = fVal[k]
          } else {
            fVal = undefined
            break
          }
        }
        val = fVal !== undefined ? fVal : fallbackText
      }

      let result = typeof val === 'string' ? val : fallbackText

      // Parameter replacement: {{param}}
      if (replacements) {
        for (const [key, replacement] of Object.entries(replacements)) {
          result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(replacement))
        }
      }

      return result
    },
    [locale]
  )

  // Price formatting helper bound to active territory & locale
  const formatPrice = useCallback(
    (amount: number | string, options?: FormatCurrencyOptions): string => {
      return formatCurrency(amount, {
        territory,
        locale,
        ...options,
      })
    },
    [territory, locale]
  )

  // Run the 5-thread territory engine preflight
  const runTerritoryPreflight = useCallback(
    async (overrideTerritory?: TerritoryCode) => {
      setIsLoadingThreads(true)
      try {
        const target = overrideTerritory || territory
        const res = await fetch(`/api/territory?country=${target}&lang=${locale}`)
        if (res.ok) {
          const data = await res.json()
          if (data.threads) {
            setThreads(data.threads)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch territory threads preflight:', err)
      } finally {
        setIsLoadingThreads(false)
      }
    },
    [territory, locale]
  )

  const value = useMemo(
    () => ({
      locale,
      languageMode,
      isAr,
      isPureArabic,
      dir,
      territory,
      territoryDef,
      setLocale,
      setLanguageMode,
      setTerritory,
      t,
      formatPrice,
      threads,
      isLoadingThreads,
      runTerritoryPreflight,
      translateDrug,
      translateGeneric,
      translateUnit,
      translateCategory,
      translateSchedule,
      translateStatus,
      translateLocation,
    }),
    [
      locale,
      languageMode,
      isAr,
      isPureArabic,
      dir,
      territory,
      territoryDef,
      setLocale,
      setLanguageMode,
      setTerritory,
      t,
      formatPrice,
      threads,
      isLoadingThreads,
      runTerritoryPreflight,
      translateDrug,
      translateGeneric,
      translateUnit,
      translateCategory,
      translateSchedule,
      translateStatus,
      translateLocation,
    ]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
