/**
 * Unit tests for motionPauseRegistry (room-battery-perf issue 03).
 *
 * Covers: all registrants paused/resumed, late registrant inherits paused
 * state, unregister mid-pause excludes it from resume with no error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as registry from '~/services/motionPauseRegistry'

function makeRegistrant() {
  return { pause: vi.fn(), resume: vi.fn() }
}

describe('motionPauseRegistry', () => {
  beforeEach(() => {
    registry.__resetForTest()
  })

  it('pause() dispatches to every registrant, resume() dispatches to every registrant', () => {
    const a = makeRegistrant()
    const b = makeRegistrant()
    registry.register(a)
    registry.register(b)

    registry.pause()
    expect(a.pause).toHaveBeenCalledTimes(1)
    expect(b.pause).toHaveBeenCalledTimes(1)

    registry.resume()
    expect(a.resume).toHaveBeenCalledTimes(1)
    expect(b.resume).toHaveBeenCalledTimes(1)
  })

  it('a registrant that joins while paused immediately receives pause()', () => {
    registry.pause()

    const late = makeRegistrant()
    registry.register(late)

    expect(late.pause).toHaveBeenCalledTimes(1)
    expect(late.resume).not.toHaveBeenCalled()
  })

  it('a registrant that joins while not paused does not receive pause()', () => {
    const early = makeRegistrant()
    registry.register(early)

    expect(early.pause).not.toHaveBeenCalled()
  })

  it('unregistering mid-pause excludes it from future resume() calls with no error', () => {
    const a = makeRegistrant()
    const id = registry.register(a)

    registry.pause()
    expect(a.pause).toHaveBeenCalledTimes(1)

    expect(() => registry.unregister(id)).not.toThrow()

    expect(() => registry.resume()).not.toThrow()
    expect(a.resume).not.toHaveBeenCalled()
  })

  it('unregister is safe for an unknown id (no error)', () => {
    expect(() => registry.unregister('does-not-exist')).not.toThrow()
  })

  it('a registrant that throws does not prevent other registrants from being dispatched to', () => {
    const bad = { pause: vi.fn(() => { throw new Error('boom') }), resume: vi.fn() }
    const good = makeRegistrant()
    registry.register(bad)
    registry.register(good)

    expect(() => registry.pause()).not.toThrow()
    expect(good.pause).toHaveBeenCalledTimes(1)
  })

  it('isPaused() reflects current state', () => {
    expect(registry.isPaused()).toBe(false)
    registry.pause()
    expect(registry.isPaused()).toBe(true)
    registry.resume()
    expect(registry.isPaused()).toBe(false)
  })
})
