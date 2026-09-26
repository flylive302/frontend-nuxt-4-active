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
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

/** Let the pending dynamic `import('@lottiefiles/dotlottie-web')` settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

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

vi.mock('@lottiefiles/dotlottie-web', () => ({
  DotLottie: vi.fn().mockImplementation(() => {
    lastInstance = new FakeDotLottie()
    return lastInstance
  }),
}))

describe('useSeatReactionPlayer — fetch failure no-op', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
