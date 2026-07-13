import { describe, it, expect } from 'vitest'
import { fitSlideText, type TextMeasurer } from '~/utils/slide-text-fit'

// Fake measurer: every character is 0.6 × fontSize wide.
const measure: TextMeasurer = (text, fontSize) => text.length * fontSize * 0.6

const options = {
  maxWidth: 376, // 400 canvas − 2×12 padding
  maxHeight: 80,
  maxFontSize: 32,
  minFontSize: 16,
  maxLines: 2,
  lineHeight: 1.2,
}

describe('fitSlideText', () => {
  it('keeps short text on one line at max font size', () => {
    const fit = fitSlideText('Welcome!', options, measure)
    expect(fit).toEqual({ fontSize: 32, lines: ['Welcome!'] })
  })

  it('returns no lines for empty/whitespace text', () => {
    expect(fitSlideText('   ', options, measure).lines).toEqual([])
  })

  it('collapses repeated whitespace', () => {
    const fit = fitSlideText('  hello   world  ', options, measure)
    expect(fit.lines).toEqual(['hello world'])
  })

  it('shrinks the font to keep medium text on a single line', () => {
    // 24 chars: needs ≤ 376 / (24 × 0.6) ≈ 26.1px → 26px single line.
    const text = 'a'.repeat(24)
    const fit = fitSlideText(text, options, measure)
    expect(fit.lines).toEqual([text])
    expect(fit.fontSize).toBe(26)
    expect(fit.fontSize).toBeLessThan(options.maxFontSize)
  })

  it('wraps to two lines when no single-line size fits', () => {
    // 47 chars: single line needs ≤ 13.3px (< min 16) → must wrap.
    const text = 'averylongwordxx averylongwordxx averylongwordxx'
    const fit = fitSlideText(text, options, measure)
    expect(fit.lines.length).toBe(2)
    expect(fit.fontSize).toBeGreaterThanOrEqual(options.minFontSize)
    for (const line of fit.lines) {
      expect(measure(line, fit.fontSize)).toBeLessThanOrEqual(options.maxWidth)
    }
  })

  it('prefers the largest wrapped size that fits within maxHeight', () => {
    const fit = fitSlideText('averylongwordxx averylongwordxx averylongwordxx', options, measure)
    // 2 lines × size × 1.2 must fit 80px → size ≤ 33; width caps it lower.
    expect(fit.fontSize * options.lineHeight * fit.lines.length).toBeLessThanOrEqual(
      options.maxHeight,
    )
  })

  it('breaks an overlong single word by characters', () => {
    const text = 'x'.repeat(90)
    const fit = fitSlideText(text, options, measure)
    expect(fit.lines.length).toBeLessThanOrEqual(options.maxLines)
    for (const line of fit.lines) {
      expect(measure(line, fit.fontSize)).toBeLessThanOrEqual(options.maxWidth)
    }
  })

  it('ellipsizes text that cannot fit even at min size and max lines', () => {
    const text = 'word '.repeat(50).trim()
    const fit = fitSlideText(text, options, measure)
    expect(fit.fontSize).toBe(options.minFontSize)
    expect(fit.lines.length).toBe(options.maxLines)
    expect(fit.lines[options.maxLines - 1]!.endsWith('…')).toBe(true)
    for (const line of fit.lines) {
      expect(measure(line, fit.fontSize)).toBeLessThanOrEqual(options.maxWidth)
    }
  })
})
