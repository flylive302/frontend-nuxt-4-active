/**
 * Unit tests for useVapPlayer's motion-pause registry integration.
 *
 * `import.meta.client` cannot be made truthy under plain `vitest` (node env,
 * no Nuxt build macro) — see tests/utils/keyed-single-flight.spec.ts and
 * tests/composables/useMediasoupStreamingSingleFlight.spec.ts, which document
 * the same limitation for other `.client`-guarded composables. `useVapPlayer`
 * checks `!import.meta.client` as its very first statement and returns a
 * no-op stub (no registry registration, no player creation) before any other
 * code runs, so the registry-integration behavior this suite was asked to
 * cover (pause/resume wiring, motionPause: false, late-pause-on-load,
 * unmount) is unreachable from this test file. Only the documented SSR
 * fallback is verified below.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as motionPauseRegistry from '~/services/motionPauseRegistry'
import { useVapPlayer } from '~/composables/vap/useVapPlayer'

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('useVapPlayer (SSR / node env — import.meta.client is falsy)', () => {
  beforeEach(() => {
    motionPauseRegistry.__resetForTest()
    vi.stubGlobal('ref', <T>(v: T) => ({ value: v }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not register with the motion-pause registry when import.meta.client is falsy', () => {
    const registerSpy = vi.spyOn(motionPauseRegistry, 'register')

    useVapPlayer(
      { value: null } as never,
      { name: { value: 'anim' } as never },
    )

    expect(registerSpy).not.toHaveBeenCalled()
  })

  it('returns the no-op SSR stub shape', async () => {
    const result = useVapPlayer(
      { value: null } as never,
      { name: { value: 'anim' } as never },
    )

    expect(result.player.value).toBe(null)
    expect(result.isPlaying.value).toBe(false)
    await expect(result.reload()).resolves.toBeUndefined()
    expect(() => result.restart()).not.toThrow()
    expect(() => result.stop()).not.toThrow()
  })
})
