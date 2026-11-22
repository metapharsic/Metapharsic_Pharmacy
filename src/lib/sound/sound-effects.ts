// ─────────────────────────────────────────────────────────────
// METAPHARSIC LIFESCIENCES — Web Audio Sound Effects Synthesizer
//
// Pure Web Audio API procedural sound synthesis for POS barcode
// scanning, invoice generation, checkout completion, and alerts.
// Zero external .mp3 downloads, ultra-low latency (<2ms).
// ─────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

const STORAGE_KEY = 'mpharm_sound_muted'

/**
 * Checks if sound effects are muted by user preference.
 */
export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Sets the sound mute preference.
 */
export function setSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('mpharm:sound-toggle', { detail: { muted } }))
  } catch {
    // ignore
  }
}

/**
 * Toggles the sound mute preference.
 */
export function toggleSound(): boolean {
  const current = isSoundMuted()
  setSoundMuted(!current)
  return !current
}

/**
 * Crisp high-pitch beep for barcode scan success (Standard POS Scanner Gun Sound).
 */
export function playBarcodeScanSound(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
  } catch {
    // Audio context may require user gesture on first interaction
  }
}

/**
 * Harmonious major chord chime for bill finalization / payment success.
 */
export function playSuccessCheckoutSound(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const chord = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    chord.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.05)

      const startTime = ctx.currentTime + index * 0.05
      gain.gain.setValueAtTime(0.12, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(startTime + 0.35)
    })
  } catch {
    // ignore
  }
}

/**
 * Warning / alert tone for inventory stockout, DPCO warning, or validation error.
 */
export function playWarningSound(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.22)
  } catch {
    // ignore
  }
}

/**
 * Subtle soft micro-click for keyboard shortcuts or number pad clicks.
 */
export function playClickSound(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)

    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.03)
  } catch {
    // ignore
  }
}

/**
 * Procedural two-tone bell chime for in-app notifications.
 */
export function playNotificationSound(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const notes = [659.25, 880] // E5 -> A5
    notes.forEach((freq, index) => {
      const startTime = ctx.currentTime + index * 0.08
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)

      gain.gain.setValueAtTime(0.08, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(startTime + 0.3)
    })
  } catch {
    // ignore
  }
}


