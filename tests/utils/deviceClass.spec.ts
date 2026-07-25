import { describe, expect, it } from 'vitest'
import { classifyDeviceClass } from '../../app/utils/device-class'

// ============================================================
// client-session-stability 02 — device correlation
//
// The open question this feeds is "are reloads skewed to low-end Android?".
// Answering it needs a coarse tier on every record: three buckets are
// queryable, a raw GB/core figure is not.
// ============================================================

describe('classifyDeviceClass', () => {
  it.each([
    [0.5, 'low'],
    [1, 'low'],
    [2, 'low'],
    [4, 'mid'],
    [8, 'high'],
  ])('classifies %sGB of device memory as %s', (deviceMemory, expected) => {
    expect(classifyDeviceClass({ deviceMemory })).toBe(expected)
  })

  it.each([
    [2, 'low'],
    [4, 'low'],
    [6, 'mid'],
    [8, 'high'],
  ])('falls back to %s cores as %s when memory is unreported', (hardwareConcurrency, expected) => {
    expect(classifyDeviceClass({ hardwareConcurrency })).toBe(expected)
  })

  it('prefers device memory over core count', () => {
    // RAM pressure is what actually drives a WebView renderer kill — a low-RAM
    // phone with many weak cores must not read as high-end.
    expect(classifyDeviceClass({ deviceMemory: 1, hardwareConcurrency: 8 })).toBe('low')
  })

  it('returns unknown rather than guessing when the engine reports neither', () => {
    expect(classifyDeviceClass({})).toBe('unknown')
  })

  it('ignores a zeroed reading instead of classifying it as low-end', () => {
    expect(classifyDeviceClass({ deviceMemory: 0, hardwareConcurrency: 0 })).toBe('unknown')
  })
})
