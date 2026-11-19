import {
  isSoundMuted,
  setSoundMuted,
  toggleSound,
  playBarcodeScanSound,
  playSuccessCheckoutSound,
  playWarningSound,
  playClickSound,
} from '@/lib/sound/sound-effects'

describe('Web Audio Sound Effects Engine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('manages mute preferences in localStorage', () => {
    expect(isSoundMuted()).toBe(false)
    setSoundMuted(true)
    expect(isSoundMuted()).toBe(true)
    const toggled = toggleSound()
    expect(toggled).toBe(false)
    expect(isSoundMuted()).toBe(false)
  })

  it('executes sound synthesizers gracefully without throwing errors in headless/jsdom', () => {
    expect(() => {
      playBarcodeScanSound()
      playSuccessCheckoutSound()
      playWarningSound()
      playClickSound()
    }).not.toThrow()
  })
})

