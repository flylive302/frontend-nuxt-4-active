import { describe, expect, it } from 'vitest'
import { glintColour, glintPhaseDelayMs } from '~/utils/vip-glint'

// Relative luminance (WCAG) — an independent yardstick for "lighter", so the
// test doesn't just re-run the OKLCH maths it is checking.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Hue angle (degrees) from plain sRGB — again independent of OKLab.
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

// sRGB saturation (HSL-style) — rises when chroma is boosted.
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
}

describe('glintColour', () => {
  const L = 0.65
  const C = 0.16
  // Real backend `vip_levels.color` values (seeders/data/catalog/vip_levels.json).
  const DARK = ['#1b4c57', '#5a441a', '#2d1757', '#7e1e07', '#562913']

  it('lifts near-black VIP colours to a clearly visible shade', () => {
    for (const hex of DARK) {
      const out = glintColour(hex, L, C)
      expect(out).toMatch(/^#[0-9a-f]{6}$/)
      // OKLCH L 0.65 ≈ WCAG luminance 0.2+; the originals sit near 0.02–0.06.
      expect(luminance(out)).toBeGreaterThan(0.2)
      expect(luminance(out)).toBeGreaterThan(luminance(hex))
    }
  })

  it('saturates dull colours so the band never reads as near-white', () => {
    // Lightness-only lift of #1b4c57 gives a greyish #77a8b4; the chroma floor
    // must push it well past that.
    expect(saturation(glintColour('#1b4c57', L, C))).toBeGreaterThan(saturation('#77a8b4') + 0.3)
    for (const hex of DARK) expect(saturation(glintColour(hex, L, C))).toBeGreaterThan(0.5)
  })

  it('keeps the hue family', () => {
    for (const hex of DARK) {
      const delta = Math.abs(hue(glintColour(hex, L, C)) - hue(hex))
      expect(Math.min(delta, 360 - delta)).toBeLessThan(20)
    }
  })

  it('leaves colours already past both floors untouched (normalised)', () => {
    expect(glintColour('#00bc6f', L, C)).toBe('#00bc6f')
    expect(glintColour('#00BC6F', L, C)).toBe('#00bc6f')
  })

  it('keeps greys grey (no hue to saturate)', () => {
    for (const hex of ['#000000', '#333333']) {
      const out = glintColour(hex, L, C)
      expect(out.slice(1, 3)).toBe(out.slice(3, 5))
      expect(out.slice(3, 5)).toBe(out.slice(5, 7))
    }
    expect(glintColour('#ffffff', L, C)).toBe('#ffffff')
  })

  it('expands 3-digit hex', () => {
    expect(glintColour('#fff', L, C)).toBe('#ffffff')
  })

  it('returns unparseable input unchanged', () => {
    expect(glintColour('not-a-colour', L, C)).toBe('not-a-colour')
    expect(glintColour('', L, C)).toBe('')
  })

  it('always produces a valid in-gamut colour, even for extreme inputs', () => {
    for (const hex of ['#0000ff', '#ff0000', '#2d1757', '#010203']) {
      expect(glintColour(hex, L, C)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('glintPhaseDelayMs', () => {
  it('returns the negative offset into the current period', () => {
    expect(glintPhaseDelayMs(0, 3000)).toBe(-0)
    expect(glintPhaseDelayMs(1000, 3000)).toBe(-1000)
    expect(glintPhaseDelayMs(7500, 3000)).toBe(-1500)
  })

  it('puts glints mounted at different times on the same phase', () => {
    // Phase at time t = (t - mountTime - delay) mod period must not depend on mountTime.
    const period = 3000
    const phaseAt = (t: number, mountedAt: number): number =>
      (((t - mountedAt - glintPhaseDelayMs(mountedAt, period)) % period) + period) % period
    expect(phaseAt(10_000, 1234)).toBeCloseTo(phaseAt(10_000, 8765))
  })

  it('guards a non-positive period', () => {
    expect(glintPhaseDelayMs(1234, 0)).toBe(0)
  })
})
