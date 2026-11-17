/**
 * Unit tests for useSeatReactionPlayer (ADR 0015 / seat-reactions slice 04 —
 * lifecycle hardening): fetch-failure no-op.
 *
 * On a Lottie `loadError`, the player must log, report `onDone` exactly
 * once (no error UI), and tear itself down — the caller (seat.vue) clears
 * the store entry from `onDone`, so a store-level assertion covers the
 * REACT-stage contract without a browser test.
 *
 * boot-and-asset-delivery/08: `init()` now resolves `dotlottie-web` via a
 * dynamic `import()` (lazy-load on first use, see useSeatReactionPlayer.ts),
 * so construction of the DotLottie instance happens after a microtask —
 * tests `await flush()` once after `init()` before asserting on it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

/**
 * Let the pending dynamic `import('@lottiefiles/dotlottie-web')` settle, then the
 * composable's continuation run. A bare `setTimeout(0)` was not enough under a
 * loaded full-suite run: the first import resolved after the assertion and the
 * late instance leaked into the next test.
 */
const flush = async (): Promise<void> => {
  await vi.dynamicImportSettled()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

// ============================================
// Fake DotLottie — captures listeners, lets tests fire events synchronously
// ============================================
class FakeDotLottie {
  listeners = new Map<string, Set<() => void>>()
  destroyed = false
  duration = 1 // seconds

  addEventListener(event: string, cb: () => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(cb)
  }

  removeEventListener(event: string, cb: () => void): void {
    this.listeners.get(event)?.delete(cb)
  }

  setLoop(_v: boolean): void {
    // no-op for this test
  }

  destroy(): void {
    this.destroyed = true
  }

  fire(event: string): void {
    this.listeners.get(event)?.forEach((cb) => cb())
  }
}

let lastInstance: FakeDotLottie | null = null

const { DotLottieMock, DotLottieWorkerMock } = vi.hoisted(() => ({
  DotLottieMock: vi.fn(),
  DotLottieWorkerMock: vi.fn(),
}))

vi.mock('@lottiefiles/dotlottie-web', () => ({
  DotLottie: DotLottieMock,
  DotLottieWorker: DotLottieWorkerMock,
}))

function resetPlayerMocks(): void {
  for (const ctor of [DotLottieMock, DotLottieWorkerMock]) {
    ctor.mockImplementation(() => {
      lastInstance = new FakeDotLottie()
      return lastInstance
    })
  }
}

describe('useSeatReactionPlayer — fetch failure no-op', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPlayerMocks()
    lastInstance = null
  })

  it('calls onDone exactly once on loadError, with no throw', async () => {
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const canvas = ref({} as HTMLCanvasElement)
    const onDone = vi.fn()

    const player = useSeatReactionPlayer(canvas, { code: '1f602', onDone })
    player.init()
    await flush()

    expect(lastInstance).not.toBeNull()

    lastInstance!.fire('loadError')
    lastInstance!.fire('loadError') // a second stray event must not double-call onDone

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('destroys the DotLottie instance on loadError (no dangling instance/listeners)', async () => {
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const canvas = ref({} as HTMLCanvasElement)
    const onDone = vi.fn()

    const player = useSeatReactionPlayer(canvas, { code: '1f602', onDone })
    player.init()
    await flush()
    lastInstance!.fire('loadError')

    expect(lastInstance!.destroyed).toBe(true)
  })

  it('reports done-issues exactly once even if destroy() is subsequently called again by the caller', async () => {
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const canvas = ref({} as HTMLCanvasElement)
    const onDone = vi.fn()

    const player = useSeatReactionPlayer(canvas, { code: '1f602', onDone })
    player.init()
    await flush()
    lastInstance!.fire('loadError')
    player.destroy() // caller-side redundant teardown (e.g. component unmount)

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('calls onDone immediately (fail-safe) when the canvas ref is not mounted', async () => {
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const canvas = ref<HTMLCanvasElement | null>(null)
    const onDone = vi.fn()

    const player = useSeatReactionPlayer(canvas, { code: '1f602', onDone })
    player.init()

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(lastInstance).toBeNull() // never constructed
  })

  it('does not construct a DotLottie instance if destroy() runs before the lazy chunk resolves', async () => {
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const canvas = ref({} as HTMLCanvasElement)
    const onDone = vi.fn()

    const player = useSeatReactionPlayer(canvas, { code: '1f602', onDone })
    player.init() // kicks off the dynamic import('@lottiefiles/dotlottie-web')
    player.destroy() // unmounted before the chunk settles (e.g. seat re-rendered fast)
    await flush()

    expect(lastInstance).toBeNull() // never constructed after teardown
  })
})

// android-client-performance/17 fix 2 — render off the main thread where the WebView can.
describe('useSeatReactionPlayer — player choice', () => {
  /** Node test env has no DOM: stub just enough canvas surface for the feature check. */
  function stubWorkerSupport(): void {
    vi.stubGlobal('OffscreenCanvas', function OffscreenCanvas() {})
    vi.stubGlobal('HTMLCanvasElement', class { transferControlToOffscreen(): unknown { return {} } })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetPlayerMocks()
    lastInstance = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('ref', ref)
  })

  it('uses the shared DotLottieWorker when OffscreenCanvas transfer is supported', async () => {
    stubWorkerSupport()
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const { REACTION_LOTTIE_WORKER_ID } = await import('../../app/constants/reactions')

    useSeatReactionPlayer(ref({} as HTMLCanvasElement), { code: '1f602', onDone: vi.fn() }).init()
    await flush()

    expect(DotLottieWorkerMock).toHaveBeenCalledTimes(1)
    expect(DotLottieWorkerMock.mock.calls[0]![0]).toMatchObject({ workerId: REACTION_LOTTIE_WORKER_ID, loop: true })
    expect(DotLottieMock).not.toHaveBeenCalled()
  })

  it('falls back to the main-thread DotLottie without OffscreenCanvas', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined)
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')

    useSeatReactionPlayer(ref({} as HTMLCanvasElement), { code: '1f602', onDone: vi.fn() }).init()
    await flush()

    expect(DotLottieMock).toHaveBeenCalledTimes(1)
    expect(DotLottieWorkerMock).not.toHaveBeenCalled()
  })

  it('still reports done exactly once when the worker player\'s async destroy rejects', async () => {
    stubWorkerSupport()
    DotLottieWorkerMock.mockImplementation(() => {
      const fake = new FakeDotLottie()
      // The worker player's destroy() is async; FakeDotLottie's is typed sync.
      Object.assign(fake, { destroy: () => Promise.reject(new Error('worker gone')) })
      lastInstance = fake
      return fake
    })
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const onDone = vi.fn()

    useSeatReactionPlayer(ref({} as HTMLCanvasElement), { code: '1f602', onDone }).init()
    await flush()
    lastInstance!.fire('complete')
    await flush()

    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('destroys a player again once it loads when teardown came before its async create finished', async () => {
    stubWorkerSupport()
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const destroySpy = vi.fn()

    const player = useSeatReactionPlayer(ref({} as HTMLCanvasElement), { code: '1f602', onDone: vi.fn() })
    player.init()
    await flush()
    const fake = lastInstance!
    fake.destroy = destroySpy
    player.destroy() // seat unmounted before the worker reported load
    fake.fire('load') // worker finishes create + load afterwards

    expect(destroySpy).toHaveBeenCalledTimes(2)
  })

  it('does not re-arm teardown when the player had already loaded', async () => {
    const { useSeatReactionPlayer } = await import('../../app/composables/room/useSeatReactionPlayer')
    const destroySpy = vi.fn()

    const player = useSeatReactionPlayer(ref({} as HTMLCanvasElement), { code: '1f602', onDone: vi.fn() })
    player.init()
    await flush()
    const fake = lastInstance!
    fake.destroy = destroySpy
    fake.fire('load')
    player.destroy()
    fake.fire('load')

    expect(destroySpy).toHaveBeenCalledTimes(1)
  })
})
