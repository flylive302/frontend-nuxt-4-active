/**
 * Unit tests for motionPauseOrchestrator (room-battery-perf issue 03).
 *
 * Covers: registrants paused on background, resumed on foreground; overlapping
 * signals (background + covered) don't cause a premature resume when only one
 * clears; the covered signal is reference-counted across concurrent acquires.
 *
 * Capacitor's `App.addListener` is mocked to capture the `appStateChange`
 * callback directly (mirrors `usePushSubscription.spec.ts`'s Capacitor mock
 * pattern), since there's no real native bridge under Vitest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import * as registry from '~/services/motionPauseRegistry'
import * as orchestrator from '~/services/motionPauseOrchestrator'

const { mockIsNativePlatform, mockAddListener } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => true),
  mockAddListener: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: mockAddListener },
}))

let appStateCallback: ((state: { isActive: boolean }) => void) | null = null

/** Minimal fake `document`: mutable visibilityState + a real listener registry. */
function makeFakeDocument() {
  const listeners = new Set<() => void>()
  return {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.add(cb)
    }),
    removeEventListener: vi.fn((_event: string, cb: () => void) => {
      listeners.delete(cb)
    }),
    fireVisibilityChange(state: 'visible' | 'hidden') {
      this.visibilityState = state
      for (const cb of listeners) cb()
    },
  }
}

function makeRegistrant() {
  return { pause: vi.fn(), resume: vi.fn() }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('motionPauseOrchestrator', () => {
  let fakeDocument: ReturnType<typeof makeFakeDocument>

  beforeEach(() => {
    registry.__resetForTest()
    orchestrator.__resetForTest()
    appStateCallback = null
    mockIsNativePlatform.mockReset().mockReturnValue(true)
    mockAddListener.mockReset()
    mockAddListener.mockImplementation(
      async (_event: string, callback: (state: { isActive: boolean }) => void) => {
        appStateCallback = callback
        return { remove: vi.fn() }
      },
    )

    fakeDocument = makeFakeDocument()
    vi.stubGlobal('document', fakeDocument)
  })

  afterEach(() => {
    orchestrator.__resetForTest()
    registry.__resetForTest()
    vi.unstubAllGlobals()
  })

  it('backgrounding via Capacitor app-state pauses all registrants; foregrounding resumes them', async () => {
    orchestrator.init()
    await flushMicrotasks()

    const a = makeRegistrant()
    registry.register(a)

    appStateCallback?.({ isActive: false })
    expect(a.pause).toHaveBeenCalledTimes(1)
    expect(a.resume).not.toHaveBeenCalled()

    appStateCallback?.({ isActive: true })
    expect(a.resume).toHaveBeenCalledTimes(1)
  })

  it('page visibility hidden pauses; visible resumes', async () => {
    orchestrator.init()
    await flushMicrotasks()

    const a = makeRegistrant()
    registry.register(a)

    fakeDocument.fireVisibilityChange('hidden')
    expect(a.pause).toHaveBeenCalledTimes(1)

    fakeDocument.fireVisibilityChange('visible')
    expect(a.resume).toHaveBeenCalledTimes(1)
  })

  it('a late registrant while backgrounded immediately inherits the paused state', async () => {
    orchestrator.init()
    await flushMicrotasks()

    appStateCallback?.({ isActive: false })

    const late = makeRegistrant()
    registry.register(late)

    expect(late.pause).toHaveBeenCalledTimes(1)
  })

  it('overlapping signals: background + covered — clearing only one does not resume', async () => {
    orchestrator.init()
    await flushMicrotasks()

    const a = makeRegistrant()
    registry.register(a)

    appStateCallback?.({ isActive: false }) // background pauses
    const token = orchestrator.acquireCovered() // covered also active
    expect(a.pause).toHaveBeenCalledTimes(1)

    // Clear only the covered signal — background is still active, must stay paused.
    orchestrator.releaseCovered(token)
    expect(a.resume).not.toHaveBeenCalled()
    expect(registry.isPaused()).toBe(true)

    // Now clear the remaining signal — should resume.
    appStateCallback?.({ isActive: true })
    expect(a.resume).toHaveBeenCalledTimes(1)
  })

  it('covered signal is reference-counted: releasing one of two concurrent covers does not resume', () => {
    orchestrator.init()

    const a = makeRegistrant()
    registry.register(a)

    const tokenOne = orchestrator.acquireCovered()
    orchestrator.acquireCovered()
    expect(a.pause).toHaveBeenCalledTimes(1)

    orchestrator.releaseCovered(tokenOne)
    expect(a.resume).not.toHaveBeenCalled()
    expect(registry.isPaused()).toBe(true)
  })

  it('acquireCovered alone pauses and releaseCovered alone resumes', () => {
    orchestrator.init()

    const a = makeRegistrant()
    registry.register(a)

    const token = orchestrator.acquireCovered()
    expect(a.pause).toHaveBeenCalledTimes(1)

    orchestrator.releaseCovered(token)
    expect(a.resume).toHaveBeenCalledTimes(1)
  })

  it('init() is idempotent — calling twice does not attach duplicate listeners', async () => {
    orchestrator.init()
    orchestrator.init()
    await flushMicrotasks()

    expect(mockAddListener).toHaveBeenCalledTimes(1)
  })
})
