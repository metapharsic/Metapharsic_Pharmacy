'use client'

import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

export interface QuickStaffProfile {
  id?: string
  name: string
  role: string
  email: string
  shopName?: string
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

// Chemist-Only Initial Staff Profiles (Zero SuperAdmin exposure)
export const DEFAULT_CHEMIST_PROFILES: QuickStaffProfile[] = [
  {
    name: 'Chemist Admin',
    role: 'Dispensary Owner',
    email: 'admin@pharmacare.local',
    shopName: 'Metapharsic Pharmacy',
    defaultPin: 'Admin@123',
    avatarColor: 'from-teal-600 to-teal-800',
    avatarIcon: '🏪',
  },
  {
    name: 'Store Manager',
    role: 'Inventory Manager',
    email: 'manager@pharmacare.local',
    shopName: 'Metapharsic Pharmacy',
    defaultPin: 'Manager@123',
    avatarColor: 'from-emerald-600 to-emerald-800',
    avatarIcon: '📋',
  },
  {
    name: 'Staff Pharmacist',
    role: 'Counter Operator',
    email: 'staff@pharmacare.local',
    shopName: 'Metapharsic Pharmacy',
    defaultPin: 'Staff@123',
    avatarColor: 'from-cyan-600 to-blue-800',
    avatarIcon: '💊',
  },
]

export function TouchPad({
  onMultiThreadSubmit,
  isSubmitting,
  onSwitchToDesktop,
  onOpenDiagnostics,
}: TouchPadProps) {
  const [staffList, setStaffList] = useState<QuickStaffProfile[]>(DEFAULT_CHEMIST_PROFILES)
  const [selectedProfile, setSelectedProfile] = useState<QuickStaffProfile>(DEFAULT_CHEMIST_PROFILES[0])
  const [pinValue, setPinValue] = useState<string>('')
  const [showPin, setShowPin] = useState<boolean>(false)
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false)
  const [customEmail, setCustomEmail] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false)

  // Fetch onboarded chemist staff dynamically from the database
  useEffect(() => {
    let isMounted = true
    const loadOnboardedStaff = async () => {
      try {
        setIsLoadingStaff(true)
        const res = await fetch('/api/login-threads?action=staff')
        const data = await res.json()
        if (data.success && Array.isArray(data.staff) && data.staff.length > 0 && isMounted) {
          setStaffList(data.staff)
          setSelectedProfile(data.staff[0])
        }
      } catch {
        // Fallback to DEFAULT_CHEMIST_PROFILES if fetch fails
      } finally {
        if (isMounted) setIsLoadingStaff(false)
      }
    }
    loadOnboardedStaff()
    return () => {
      isMounted = false
    }
  }, [])

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

  // Tactile audio feedback on touch keypress
  const playHapticTap = () => {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(800, audioCtx.currentTime)
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05)
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.start()
        osc.stop(audioCtx.currentTime + 0.05)
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20)
      }
    } catch {
      // Ignore audio restrictions
    }
  }

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
      // Standard default fallback
      setPinValue('Admin@123')
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pinValue || isSubmitting) return
    const emailToUse = customEmail.trim() || selectedProfile.email
    onMultiThreadSubmit(emailToUse, pinValue)
  }

  return (
    <div className="w-full max-w-[410px] mx-auto rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-950 p-4 shadow-2xl text-white select-none">
      {/* Mobile Top Status Bar */}
      <div className="flex items-center justify-between px-3 pt-1 pb-3 text-[11px] text-slate-400 border-b border-slate-900">
        <span className="font-mono font-semibold text-slate-200">{currentTime || '12:00'}</span>
        <div className="h-4 px-2.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
          <span className="text-[9px] font-bold text-teal-300">CHEMIST POS NODE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 text-teal-400" />
          <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      </div>

      {/* Dispensary Header */}
      <div className="py-3 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-0.5 text-[10px] font-bold text-teal-300 uppercase tracking-wider mb-1">
          <Store className="h-3 w-3" />
          {selectedProfile.shopName || 'Retail Dispensary Counter'}
        </div>
        <h2 className="text-base font-extrabold text-white tracking-tight">
          Chemist Counter Sign-In
        </h2>
        <p className="text-[11px] text-slate-400">
          Select onboarded staff profile & enter authorized password
        </p>
      </div>

      {/* Dynamic Onboarded Chemist Staff Selector */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wider">
          <span>Onboarded Chemist Staff:</span>
          {isLoadingStaff && (
            <span className="flex items-center gap-1 text-teal-400 font-normal">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              <span>Syncing...</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
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
                  setPinValue('')
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
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm shadow-inner mb-1 bg-gradient-to-tr',
                    profile.avatarColor
                  )}
                >
                  {profile.avatarIcon || '💊'}
                </div>
                <span className="text-[11px] font-bold text-slate-200 truncate w-full">
                  {profile.name}
                </span>
                <span className="text-[9px] text-teal-400 truncate w-full font-medium">
                  {profile.role}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Chemist Account Info Bar */}
      <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 mb-3 text-xs">
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
          Demo Password
        </button>
      </div>

      {/* PIN / Password Display */}
      <div className="relative mb-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 shadow-inner">
          <div className="flex items-center gap-2 overflow-x-auto pr-2 max-w-[280px]">
            <Lock className="h-4 w-4 text-teal-400 shrink-0" />
            {pinValue.length === 0 ? (
              <span className="text-xs text-slate-500 font-mono">Touch numpad or keyboard...</span>
            ) : showPin || isKeyboardMode ? (
              <span className="text-sm font-mono tracking-wider text-teal-200">
                {pinValue}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                {pinValue.split('').map((_, idx) => (
                  <span
                    key={idx}
                    className="h-3 w-3 rounded-full bg-teal-400 animate-in zoom-in-75 duration-100 shadow-sm shadow-teal-400/50"
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
            <span>Synced with Database Password</span>
          </span>
          <span className="font-mono text-slate-500">{pinValue.length} chars</span>
        </div>
      </div>

      {/* Input Mode: Virtual Touch Numpad vs Text Keyboard */}
      {isKeyboardMode ? (
        <div className="space-y-3 mb-3 animate-in fade-in">
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
            className="w-full py-1.5 text-center text-[11px] text-teal-400 hover:text-teal-300 font-medium"
          >
            ← Switch to Touch Numeric Pad
          </button>
        </div>
      ) : (
        /* ── NUMERIC TOUCH KEYPAD ── */
        <div className="grid grid-cols-3 gap-2 mb-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleKeyPress(digit)}
              className="h-12 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-900 active:scale-95 text-lg font-bold font-mono text-white shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
            >
              {digit}
            </button>
          ))}

          {/* Bottom Row: Clear, 0, Backspace */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClear}
            className="h-12 rounded-2xl bg-slate-900/40 hover:bg-rose-950/60 active:scale-95 text-xs font-bold uppercase tracking-wider text-rose-300 shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
          >
            CLR
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleKeyPress('0')}
            className="h-12 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-900 active:scale-95 text-lg font-bold font-mono text-white shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
          >
            0
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleBackspace}
            className="h-12 rounded-2xl bg-slate-900/40 hover:bg-slate-800 active:scale-95 text-slate-300 shadow-sm border border-slate-800/80 transition-all flex items-center justify-center focus:outline-none"
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
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white font-bold text-sm shadow-lg shadow-teal-900/50 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            <span>Verifying 5 Chemist Threads...</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Access Dispensary Counter</span>
          </span>
        )}
      </Button>

      {/* Auxiliary Footer Navigation */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1 border-t border-slate-900 pt-2.5">
        {onSwitchToDesktop && (
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1"
          >
            <span>Standard Desktop View</span>
          </button>
        )}

        {onOpenDiagnostics && (
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono text-[10px]"
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Thread Diagnostics</span>
          </button>
        )}
      </div>
    </div>
  )
}
