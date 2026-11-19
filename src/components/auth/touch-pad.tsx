'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BatteryCharging,
  Check,
  Delete,
  Eye,
  EyeOff,
  Fingerprint,
  Keyboard,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldCheck,
  Store,
  User,
  Wifi,
  Sparkles,
  Zap,
  Globe,
  Building,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n/i18n-context'
import { cn } from '@/lib/utils/cn'
import { TerritoryCode } from '@/lib/territory/territory-config'

export interface QuickStaffProfile {
  id?: string
  name: string
  role: string
  email: string
  shopName?: string
  country?: string
  currency?: string
  defaultPin?: string
  avatarColor: string
  avatarIcon?: string
}

interface TouchPadProps {
  onMultiThreadSubmit: (email: string, pinOrPass: string) => Promise<void>
  isSubmitting: boolean
  onSwitchToDesktop?: () => void
  onOpenDiagnostics?: () => void
}

export interface SovereignNationItem {
  code: TerritoryCode | 'HQ'
  name: string
  nameAr: string
  flag: string
  currency: string
  regBadge: string
  regBadgeAr: string
  primaryEmail: string
  primaryPin: string
  primaryName: string
  primaryRole: string
  shopName: string
  avatarColor: string
}

export const SOVEREIGN_NATIONS: SovereignNationItem[] = [
  {
    code: 'SA',
    name: 'Saudi Arabia',
    nameAr: 'المملكة العربية السعودية',
    flag: '🇸🇦',
    currency: 'SAR (ر.س)',
    regBadge: 'ZATCA Phase 2 & SFDA',
    regBadgeAr: 'زكاة وضريبة وهيئة الغذاء والدواء',
    primaryEmail: 'saudi.admin@pharmacare.local',
    primaryPin: 'Ksa@123456',
    primaryName: 'د. خالد العتيبي',
    primaryRole: 'Chief Pharmacist (مدير الصيدلية)',
    shopName: 'Al-Nahdi & Metapharsic Central (الرياض)',
    avatarColor: 'from-emerald-600 to-teal-800',
  },
  {
    code: 'OM',
    name: 'Oman',
    nameAr: 'سلطنة عُمان',
    flag: '🇴🇲',
    currency: 'OMR (ر.ع. 3 Dec)',
    regBadge: 'MoH Oman & 5% OTA',
    regBadgeAr: 'وزارة الصحة وجهاز الضرائب (3 خانات)',
    primaryEmail: 'oman.admin@pharmacare.local',
    primaryPin: 'Oman@123456',
    primaryName: 'د. أحمد الحارثي',
    primaryRole: 'MoH Pharmacist (صيدلي معتمد)',
    shopName: 'Metapharsic Muscat Sovereign (مسقط)',
    avatarColor: 'from-red-600 to-rose-900',
  },
  {
    code: 'BH',
    name: 'Bahrain',
    nameAr: 'مملكة البحرين',
    flag: '🇧🇭',
    currency: 'BHD (د.ب 3 Dec)',
    regBadge: 'NHRA & 10% NBR',
    regBadgeAr: 'الهيئة الوطنية لتنظيم المهن والخدمات',
    primaryEmail: 'bahrain.admin@pharmacare.local',
    primaryPin: 'Bahrain@123456',
    primaryName: 'د. فاطمة آل خليفة',
    primaryRole: 'NHRA Licensed Pharmacist',
    shopName: 'Metapharsic Bahrain Healthcare (المنامة)',
    avatarColor: 'from-rose-600 to-amber-700',
  },
  {
    code: 'QA',
    name: 'Qatar',
    nameAr: 'دولة قطر',
    flag: '🇶🇦',
    currency: 'QAR (ر.ق)',
    regBadge: 'MoPH 0% Healthcare',
    regBadgeAr: 'وزارة الصحة العامة (0% ضريبة)',
    primaryEmail: 'qatar.admin@pharmacare.local',
    primaryPin: 'Qatar@123456',
    primaryName: 'د. ناصر الكواري',
    primaryRole: 'MoPH Clinical Director',
    shopName: 'Metapharsic Doha Pharmacy (الدوحة)',
    avatarColor: 'from-purple-700 to-indigo-950',
  },
  {
    code: 'MV',
    name: 'Maldives',
    nameAr: 'ދިވެހިރާއްޖެ',
    flag: '🇲🇻',
    currency: 'MVR (Rf)',
    regBadge: 'MFDA & MIRA Aasandha Scheme',
    regBadgeAr: 'Maldives Food & Drug Authority',
    primaryEmail: 'maldives.admin@pharmacare.local',
    primaryPin: 'Maldives@123456',
    primaryName: 'Dr. Ibrahim Naeem',
    primaryRole: 'MFDA Chief Pharmacist',
    shopName: 'Metapharsic Malé Pharmacy (Malé)',
    avatarColor: 'from-teal-600 to-cyan-800',
  },
  {
    code: 'IN',
    name: 'India',
    nameAr: 'الهند',
    flag: '🇮🇳',
    currency: 'INR (₹)',
    regBadge: 'CDSCO & Form 20/21 GST',
    regBadgeAr: 'Central Drugs Standard Control',
    primaryEmail: 'india.admin@pharmacare.local',
    primaryPin: 'India@123456',
    primaryName: 'Dr. Rajesh Sharma',
    primaryRole: 'Superintendent Pharmacist',
    shopName: 'Metapharsic Apex Pharmacy (Hyderabad)',
    avatarColor: 'from-orange-600 to-amber-800',
  },
  {
    code: 'HQ',
    name: 'SuperAdmin',
    nameAr: 'المدير العام',
    flag: '👑',
    currency: 'GLOBAL HQ',
    regBadge: 'Multi-Territory Governance',
    regBadgeAr: 'التحكم السيادي لجميع الدول',
    primaryEmail: 'superadmin@metapharsic.cloud',
    primaryPin: 'SuperAdmin@123',
    primaryName: 'Global Platform SuperAdmin',
    primaryRole: 'Sovereign Controller (المدير السيادي)',
    shopName: 'Metapharsic Global HQ Command',
    avatarColor: 'from-violet-700 to-sky-700',
  },
]

export const DEFAULT_CHEMIST_PROFILES: QuickStaffProfile[] = SOVEREIGN_NATIONS.map((n) => ({
  name: n.primaryName,
  role: n.primaryRole,
  email: n.primaryEmail,
  shopName: n.shopName,
  country: n.name,
  currency: n.currency,
  defaultPin: n.primaryPin,
  avatarColor: n.avatarColor,
  avatarIcon: n.flag,
}))

export function TouchPad({
  onMultiThreadSubmit,
  isSubmitting,
  onSwitchToDesktop,
  onOpenDiagnostics,
}: TouchPadProps) {
  const { t, locale, dir, territory, setTerritory, setLocale } = useI18n()

  const [activeNationCode, setActiveNationCode] = useState<string>(territory || 'SA')
  const [staffList, setStaffList] = useState<QuickStaffProfile[]>(DEFAULT_CHEMIST_PROFILES)
  const [selectedProfile, setSelectedProfile] = useState<QuickStaffProfile>(DEFAULT_CHEMIST_PROFILES[0])
  const [pinValue, setPinValue] = useState<string>(DEFAULT_CHEMIST_PROFILES[0].defaultPin || 'Ksa@123456')
  const [showPin, setShowPin] = useState<boolean>(false)
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false)
  const [customEmail, setCustomEmail] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false)

  // Play subtle haptic audio feedback
  const playHapticTap = () => {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.frequency.setValueAtTime(650, audioCtx.currentTime)
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.04)
      }
    } catch {
      // Ignore audio restrictions
    }
  }

  // Load staff for specific territory
  const loadStaffForNation = useCallback(async (nationCode: string) => {
    if (nationCode === 'HQ') {
      const hqProfile = DEFAULT_CHEMIST_PROFILES.find((p) => p.email === 'superadmin@metapharsic.cloud')!
      setStaffList([hqProfile])
      setSelectedProfile(hqProfile)
      setPinValue(hqProfile.defaultPin || 'SuperAdmin@123')
      return
    }

    try {
      setIsLoadingStaff(true)
      const res = await fetch(`/api/login-threads?action=staff&territory=${nationCode}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.staff) && data.staff.length > 0) {
        setStaffList(data.staff)
        setSelectedProfile(data.staff[0])
        setPinValue(data.staff[0].defaultPin || 'Admin@123')
      } else {
        // Fallback to initial nation definition
        const fallback = DEFAULT_CHEMIST_PROFILES.find((p) =>
          p.email.includes(nationCode.toLowerCase())
        ) || DEFAULT_CHEMIST_PROFILES[0]
        setStaffList([fallback])
        setSelectedProfile(fallback)
        setPinValue(fallback.defaultPin || 'Admin@123')
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingStaff(false)
    }
  }, [])

  // Switch Sovereign Nation & Territory
  const handleSelectNation = (nation: SovereignNationItem) => {
    playHapticTap()
    setActiveNationCode(nation.code)

    if (nation.code !== 'HQ') {
      setTerritory(nation.code as TerritoryCode)
      // Automatically toggle Arabic for GCC nations, English for India/Maldives
      if (['SA', 'OM', 'BH', 'QA'].includes(nation.code)) {
        setLocale('ar')
      } else {
        setLocale('en')
      }
    }

    loadStaffForNation(nation.code)
    setCustomEmail('')
  }

  useEffect(() => {
    loadStaffForNation(activeNationCode)
  }, [activeNationCode, loadStaffForNation])

  // Live digital clock for mobile status bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleKeyPress = (char: string) => {
    playHapticTap()
    setPinValue((prev) => prev + char)
  }

  const handleBackspace = () => {
    playHapticTap()
    setPinValue((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    playHapticTap()
    setPinValue('')
  }

  const handleAutoFillDefault = () => {
    playHapticTap()
    if (selectedProfile.defaultPin) {
      setPinValue(selectedProfile.defaultPin)
    } else {
      setPinValue('Admin@123')
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pinValue || isSubmitting) return
    const emailToUse = customEmail.trim() || selectedProfile.email
    onMultiThreadSubmit(emailToUse, pinValue)
  }

  const activeNation = SOVEREIGN_NATIONS.find((n) => n.code === activeNationCode) || SOVEREIGN_NATIONS[0]

  return (
    <div className="w-full max-w-[430px] mx-auto rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-950 p-4 shadow-2xl text-white select-none">
      {/* Mobile Top Status Bar */}
      <div className="flex items-center justify-between px-3 pt-1 pb-2.5 text-[11px] text-slate-400 border-b border-slate-900">
        <span className="font-mono font-semibold text-slate-200">{currentTime || '12:00'}</span>
        <div className="h-4 px-2.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
          <span className="text-[9px] font-bold text-teal-300">
            {activeNation.code === 'HQ' ? 'GLOBAL SUPERADMIN' : `${activeNation.code} SOVEREIGN NODE`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 text-teal-400" />
          <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      </div>

      {/* Sovereign Territory & Nation Selector Pills */}
      <div className="py-2.5 border-b border-slate-900">
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pb-1.5 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1 text-teal-400">
            <Globe className="h-3 w-3" />
            <span>{locale === 'ar' ? 'اختر الدولة / النطاق السيادي:' : 'Select Sovereign Territory:'}</span>
          </span>
          <span className="font-mono text-slate-400">{activeNation.currency}</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
          {SOVEREIGN_NATIONS.map((nation) => {
            const isSelected = activeNationCode === nation.code
            return (
              <button
                key={nation.code}
                type="button"
                onClick={() => handleSelectNation(nation)}
                className={cn(
                  'flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-center transition-all',
                  isSelected
                    ? 'border-teal-400 bg-teal-950/80 shadow-md ring-1 ring-teal-400 text-white'
                    : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 text-slate-400'
                )}
                title={`${nation.name} (${nation.currency})`}
              >
                <span className="text-base leading-none mb-0.5">{nation.flag}</span>
                <span className="text-[10px] font-bold tracking-tight">
                  {locale === 'ar' ? nation.nameAr.split(' ')[0] : nation.code}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Dispensary Header & Regulatory Authority Badge */}
      <div className="py-2.5 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-0.5 text-[10px] font-bold text-teal-300 uppercase tracking-wider mb-1">
          <Store className="h-3 w-3" />
          <span>{selectedProfile.shopName || activeNation.shopName}</span>
        </div>

        <div className="text-[10px] text-emerald-400 font-medium flex items-center justify-center gap-1 mt-0.5">
          <ShieldCheck className="h-3 w-3" />
          <span>{locale === 'ar' ? activeNation.regBadgeAr : activeNation.regBadge}</span>
        </div>
      </div>

      {/* Dynamic Onboarded Chemist Staff Selector */}
      <div className="space-y-1.5 mb-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wider">
          <span>{locale === 'ar' ? 'طاقم الصيدلية المصرح لهم:' : 'Authorized Dispensary Staff:'}</span>
          {isLoadingStaff && (
            <span className="flex items-center gap-1 text-teal-400 font-normal">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              <span>{locale === 'ar' ? 'جاري التحميل...' : 'Syncing...'}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {staffList.slice(0, 3).map((profile) => {
            const isSelected = selectedProfile.email === profile.email && !customEmail

            return (
              <button
                key={profile.email}
                type="button"
                onClick={() => {
                  playHapticTap()
                  setSelectedProfile(profile)
                  setCustomEmail('')
                  setPinValue(profile.defaultPin || 'Admin@123')
                }}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all',
                  isSelected
                    ? 'border-teal-400 bg-teal-950/60 shadow-lg shadow-teal-900/40 ring-1 ring-teal-400'
                    : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-400'
                )}
              >
                <div
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs shadow-inner mb-1 bg-gradient-to-tr text-white',
                    profile.avatarColor || 'from-teal-600 to-teal-800'
                  )}
                >
                  {profile.avatarIcon || '💊'}
                </div>
                <span className="text-[11px] font-bold text-slate-200 truncate w-full">
                  {profile.name}
                </span>
                <span className="text-[9px] text-teal-400 truncate w-full font-medium">
                  {profile.role.split('(')[0]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Chemist Account Info Bar */}
      <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 mb-2.5 text-xs">
        <div className="flex items-center gap-2 truncate">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-mono text-[11px] truncate">
            {customEmail || selectedProfile.email}
          </span>
        </div>
        <button
          type="button"
          onClick={handleAutoFillDefault}
          className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 shrink-0 underline"
        >
          {locale === 'ar' ? 'كلمة المرور التجريبية' : 'Demo Password'}
        </button>
      </div>

      {/* PIN / Password Display */}
      <div className="relative mb-2.5">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 shadow-inner">
          <div className="flex items-center gap-2 overflow-x-auto pr-2 max-w-[280px]">
            <Lock className="h-4 w-4 text-teal-400 shrink-0" />
            {pinValue.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono">
                {locale === 'ar' ? 'المس لوحة الأرقام...' : 'Touch numpad or keyboard...'}
              </span>
            ) : showPin || isKeyboardMode ? (
              <span className="text-sm font-mono tracking-wider text-teal-200">
                {pinValue}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                {pinValue.split('').map((_, idx) => (
                  <span
                    key={idx}
                    className="h-2.5 w-2.5 rounded-full bg-teal-400 animate-in zoom-in-75 duration-100 shadow-sm shadow-teal-400/50"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="text-slate-400 hover:text-white transition-colors"
              title={showPin ? 'Mask Password' : 'Show Password'}
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsKeyboardMode(!isKeyboardMode)}
              className={cn(
                'text-slate-400 hover:text-white transition-colors',
                isKeyboardMode && 'text-teal-400 font-bold'
              )}
              title="Toggle Full Keyboard Input"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <Check className="h-3 w-3" />
            <span>{locale === 'ar' ? 'متصل بقاعدة البيانات السيادية' : 'Synced with Sovereign Database'}</span>
          </span>
          <span className="font-mono text-slate-500">{pinValue.length} chars</span>
        </div>
      </div>

      {/* Input Mode: Virtual Touch Numpad vs Text Keyboard */}
      {isKeyboardMode ? (
        <div className="space-y-2 mb-2.5 animate-in fade-in">
          <input
            type={showPin ? 'text' : 'password'}
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value)}
            placeholder="Enter chemist password..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-400 font-mono"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setIsKeyboardMode(false)}
            className="w-full py-1 text-center text-[11px] text-teal-400 hover:text-teal-300 font-medium"
          >
            ← {locale === 'ar' ? 'الرجوع إلى لوحة اللمس الرقمية' : 'Switch to Touch Numeric Pad'}
          </button>
        </div>
      ) : (
        /* ── NUMERIC TOUCH KEYPAD ── */
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleKeyPress(digit)}
              className="h-11 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-900 active:scale-95 text-lg font-bold font-mono text-white shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
            >
              {digit}
            </button>
          ))}

          {/* Bottom Row: Clear, 0, Backspace */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClear}
            className="h-11 rounded-xl bg-slate-900/40 hover:bg-rose-950/60 active:scale-95 text-xs font-bold uppercase tracking-wider text-rose-300 shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
          >
            CLR
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleKeyPress('0')}
            className="h-11 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-900 active:scale-95 text-lg font-bold font-mono text-white shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
          >
            0
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-slate-900/40 hover:bg-slate-800 active:scale-95 text-slate-300 shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Submit Counter Access Button */}
      <Button
        type="button"
        disabled={isSubmitting || pinValue.length === 0}
        onClick={() => handleSubmit()}
        className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white font-bold text-sm shadow-lg shadow-teal-900/50 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            <span>{locale === 'ar' ? 'جاري التحقق عبر 5 خيوط معالجة...' : 'Verifying 5 Chemist Threads...'}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>
              {activeNationCode === 'HQ'
                ? locale === 'ar'
                  ? 'دخول لوحة القيادة السيادية المركزية'
                  : 'Access Global SuperAdmin Command'
                : locale === 'ar'
                ? `دخول صيدلية ${activeNation.nameAr} (${activeNation.currency})`
                : `Sign In to ${activeNation.name} Counter (${activeNation.currency})`}
            </span>
          </span>
        )}
      </Button>

      {/* Auxiliary Footer Navigation */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1 border-t border-slate-900 pt-2">
        {onSwitchToDesktop && (
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1"
          >
            <span>{locale === 'ar' ? 'عرض النماذج المتقدمة' : 'Desktop Input View'}</span>
          </button>
        )}

        {onOpenDiagnostics && (
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono text-[10px]"
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>{locale === 'ar' ? 'فحص الخيوط' : 'Thread Diagnostics'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
