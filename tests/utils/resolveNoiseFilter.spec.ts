import { describe, it, expect, afterEach, vi } from 'vitest'
import { resolveNoiseFilter, isAudioWorkletSupported } from '../../app/utils/audio/resolve-noise-filter'

describe('resolveNoiseFilter', () => {
  it('off is always false, regardless of support or device tier', () => {
    expect(resolveNoiseFilter('off', 'high', true)).toBe(false)
    expect(resolveNoiseFilter('off', 'low', false)).toBe(false)
  })

  it('on follows support only, ignoring device tier', () => {
    expect(resolveNoiseFilter('on', 'low', true)).toBe(true)
    expect(resolveNoiseFilter('on', 'unknown', true)).toBe(true)
    expect(resolveNoiseFilter('on', 'high', false)).toBe(false)
  })

  it('auto is true only when supported AND device is mid/high', () => {
    expect(resolveNoiseFilter('auto', 'mid', true)).toBe(true)
    expect(resolveNoiseFilter('auto', 'high', true)).toBe(true)
    expect(resolveNoiseFilter('auto', 'low', true)).toBe(false)
    expect(resolveNoiseFilter('auto', 'unknown', true)).toBe(false)
    expect(resolveNoiseFilter('auto', 'high', false)).toBe(false)
  })
})

describe('isAudioWorkletSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function fakeWorkletCtor() {
    return function FakeAudioWorkletNode() { /* noop stub */ }
  }

  function fakeContextCtor(withAudioWorklet: boolean) {
    function FakeAudioContext() { /* noop stub */ }
    if (withAudioWorklet) {
      Object.defineProperty(FakeAudioContext.prototype, 'audioWorklet', { get: () => ({}) })
    }
    return FakeAudioContext
  }

  it('false when AudioWorkletNode is undefined', () => {
    vi.stubGlobal('AudioWorkletNode', undefined)
    expect(isAudioWorkletSupported()).toBe(false)
  })

  it('true when AudioWorkletNode exists and AudioContext exposes audioWorklet', () => {
    vi.stubGlobal('AudioWorkletNode', fakeWorkletCtor())
    vi.stubGlobal('AudioContext', fakeContextCtor(true))
    expect(isAudioWorkletSupported()).toBe(true)
  })

  it('false when AudioContext prototype has no audioWorklet', () => {
    vi.stubGlobal('AudioWorkletNode', fakeWorkletCtor())
    vi.stubGlobal('AudioContext', fakeContextCtor(false))
    expect(isAudioWorkletSupported()).toBe(false)
  })
})
