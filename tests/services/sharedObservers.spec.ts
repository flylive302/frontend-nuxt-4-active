import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetForTest, observeResize, observeVisibility } from '~/services/sharedObservers'

// Minimal observer fakes: record every instance and its targets, and let the
// test fire the callback with chosen entries. Vitest runs in plain `node`.
class FakeObserver {
  static instances: FakeObserver[] = []
  targets = new Set<Element>()
  constructor(public callback: (entries: unknown[]) => void) {
    FakeObserver.instances.push(this)
  }

  observe(el: Element): void { this.targets.add(el) }
  unobserve(el: Element): void { this.targets.delete(el) }
  disconnect(): void { this.targets.clear() }
}

const el = (): Element => ({}) as Element

let frames: Array<() => void> = []

beforeEach(() => {
  FakeObserver.instances = []
  frames = []
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  vi.stubGlobal('ResizeObserver', FakeObserver)
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb))
})

afterEach(() => {
  __resetForTest()
  vi.unstubAllGlobals()
})

describe('observeVisibility', () => {
  it('shares ONE observer across every element', () => {
    observeVisibility(el(), () => {})
    observeVisibility(el(), () => {})
    observeVisibility(el(), () => {})
    expect(FakeObserver.instances).toHaveLength(1)
    expect(FakeObserver.instances[0]!.targets.size).toBe(3)
  })

  it('routes each entry to its own element listener', () => {
    const a = el()
    const b = el()
    const seenA: boolean[] = []
    const seenB: boolean[] = []
    observeVisibility(a, v => seenA.push(v))
    observeVisibility(b, v => seenB.push(v))

    FakeObserver.instances[0]!.callback([
      { target: a, isIntersecting: true },
      { target: b, isIntersecting: false },
    ])

    expect(seenA).toEqual([true])
    expect(seenB).toEqual([false])
  })

  it('stop() unobserves and silences the listener', () => {
    const a = el()
    const seen: boolean[] = []
    const stop = observeVisibility(a, v => seen.push(v))
    stop()

    const io = FakeObserver.instances[0]!
    expect(io.targets.has(a)).toBe(false)
    io.callback([{ target: a, isIntersecting: true }])
    expect(seen).toEqual([])
  })

  it('a stale stop() does not remove a newer listener for the same element', () => {
    const a = el()
    const seen: string[] = []
    const stopOld = observeVisibility(a, () => seen.push('old'))
    observeVisibility(a, () => seen.push('new'))
    stopOld()

    const io = FakeObserver.instances[0]!
    expect(io.targets.has(a)).toBe(true)
    io.callback([{ target: a, isIntersecting: true }])
    expect(seen).toEqual(['new'])
  })
})

describe('observeResize', () => {
  it('batches every resized element into ONE frame, never inside the observer callback', () => {
    const a = el()
    const b = el()
    const calls: string[] = []
    observeResize(a, () => calls.push('a'))
    observeResize(b, () => calls.push('b'))

    const ro = FakeObserver.instances[0]!
    ro.callback([{ target: a }])
    ro.callback([{ target: a }, { target: b }])

    expect(calls).toEqual([])
    expect(frames).toHaveLength(1)

    frames[0]!()
    expect(calls).toEqual(['a', 'b'])
  })

  it('drops a pending delivery when the element is unobserved before the frame', () => {
    const a = el()
    const calls: string[] = []
    const stop = observeResize(a, () => calls.push('a'))

    FakeObserver.instances[0]!.callback([{ target: a }])
    stop()
    frames[0]!()

    expect(calls).toEqual([])
  })

  it('schedules a fresh frame after the previous one flushed', () => {
    const a = el()
    observeResize(a, () => {})
    const ro = FakeObserver.instances[0]!

    ro.callback([{ target: a }])
    frames[0]!()
    ro.callback([{ target: a }])

    expect(frames).toHaveLength(2)
  })
})
