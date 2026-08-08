// ========================================
// Flag resolution tests (ADR 0027)
// ========================================

import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { DEFAULT_FLAG_ICON, getFlagSrc, normalizeCountryCode } from '~/utils/flag-icon'

const ROOT = resolve(__dirname, '../..')

describe('getFlagSrc', () => {
  it('resolves a plain country code to a static file', () => {
    expect(getFlagSrc('pk')).toBe('/flags/pk.svg')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(getFlagSrc('  PK ')).toBe('/flags/pk.svg')
  })

  it('remaps uk -> gb (the country data and the flag set disagree)', () => {
    expect(getFlagSrc('uk')).toBe('/flags/gb.svg')
  })

  it('returns null for `an`, which has no flag', () => {
    expect(getFlagSrc('an')).toBeNull()
  })

  it.each([null, undefined, '', '   ', 'undefined', 'null'])(
    'returns null for %p so the caller renders the fallback icon',
    (code) => {
      expect(getFlagSrc(code)).toBeNull()
    },
  )
})

describe('normalizeCountryCode', () => {
  it('applies the same remap as getFlagSrc', () => {
    expect(normalizeCountryCode('UK')).toBe('gb')
  })

  it('returns null rather than a blank string for unusable input', () => {
    expect(normalizeCountryCode('')).toBeNull()
  })
})

describe('the generated flag files', () => {
  // ⛔ This is the test that stops `provider: 'none'` from turning a missing
  // country into a silent broken image: every code the app can ask for must
  // exist on disk.
  const countries = JSON.parse(
    readFileSync(resolve(ROOT, 'public/countries.json'), 'utf8'),
  ) as Array<{ code: string, name: string }>

  it('covers every country in countries.json', () => {
    const missing = countries
      .map((c) => ({ ...c, src: getFlagSrc(c.code) }))
      .filter((c) => c.src !== null)
      .filter((c) => !existsSync(resolve(ROOT, 'public', c.src!.replace(/^\//, ''))))
      .map((c) => `${c.name} (${c.code})`)

    expect(missing).toEqual([])
  })

  it('keeps the fallback a real bundled icon name, not a flag file', () => {
    // The fallback stays a <UIcon>; CountryFlag's two render paths depend on it.
    expect(DEFAULT_FLAG_ICON.startsWith('i-')).toBe(true)
    expect(DEFAULT_FLAG_ICON).not.toContain('flag')
  })
})
