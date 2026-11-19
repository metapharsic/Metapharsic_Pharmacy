import {
  repairCorruptedDotMatrixText,
  detectSpecularGlareRatio,
  applyAluAluSpecularFilter,
} from '@/lib/scanner/anti-glare-pipeline'

describe('Alu-Alu Specular Glare & Anti-Reflective Pipeline', () => {
  describe('repairCorruptedDotMatrixText', () => {
    it('repairs broken batch labels with dot-matrix glare dropouts', () => {
      const corrupted = 'B:N0. 26D044\n8XP. 08/2028\nM:R:P 204.50'
      const repaired = repairCorruptedDotMatrixText(corrupted)

      expect(repaired).toContain('B.No. 26D044')
      expect(repaired).toContain('EXP. 08/2028')
      expect(repaired).toContain('M.R.P. 204.50')
    })

    it('repairs debossed pin-stamped labels like "E)(P" and "USE BEF0RE"', () => {
      const corrupted = 'E)(P 03/2028\nUSE BEF0RE 03/2028'
      const repaired = repairCorruptedDotMatrixText(corrupted)

      expect(repaired).toContain('EXP. 03/2028')
    })
  })

  describe('detectSpecularGlareRatio', () => {
    it('detects severe metallic glare on blown-out white pixels', () => {
      // 100 pixels, all pure white glare (255, 255, 255, 255)
      const pixels = new Uint8ClampedArray(100 * 4).fill(255)
      const result = detectSpecularGlareRatio(pixels, 10, 10)

      expect(result.glarePercentage).toBe(100)
      expect(result.isSevereGlare).toBe(true)
      expect(result.recommendedTiltDegrees).toBe(40)
    })

    it('detects zero glare on normal colored text pixels', () => {
      const pixels = new Uint8ClampedArray(100 * 4)
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 40 // Dark grey
        pixels[i + 1] = 40
        pixels[i + 2] = 40
        pixels[i + 3] = 255
      }
      const result = detectSpecularGlareRatio(pixels, 10, 10)

      expect(result.glarePercentage).toBe(0)
      expect(result.isSevereGlare).toBe(false)
      expect(result.recommendedTiltDegrees).toBe(15)
    })
  })

  describe('applyAluAluSpecularFilter', () => {
    it('dampens specular hotspots by attenuation factor', () => {
      const input = new Uint8ClampedArray([255, 255, 255, 255])
      const output = applyAluAluSpecularFilter(input, 1, 1, 'EXTREME')

      // White highlight should be attenuated to < 180 to restore ink
      expect(output[0]).toBeLessThan(180)
      expect(output[1]).toBeLessThan(180)
      expect(output[2]).toBeLessThan(180)
    })
  })
})
