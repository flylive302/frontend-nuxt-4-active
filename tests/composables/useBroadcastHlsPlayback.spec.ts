/**
 * Unit tests for the broadcast HLS player's cold-start retry policy
 * (realtime-17b). The full start/play/error control flow is browser-verified
 * (per the team's "don't self-test UI" policy); this locks the one piece with no
 * other safety net — the hls.js load-policy override, which silently breaks if
 * hls.js changes its config shape on a version bump.
 */
import { describe, it, expect } from 'vitest'
import {
  withColdStartRetry,
  COLD_START_MAX_RETRY,
} from '~/composables/room/audio/useBroadcastHlsPlayback'

// Mirrors hls.js 1.6 DefaultConfig.manifestLoadPolicy.default shape.
function defaultPolicy() {
  return {
    default: {
      maxTimeToFirstByteMs: null,
      maxLoadTimeMs: 20000,
      timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 },
      errorRetry: { maxNumRetry: 1, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
    },
  }
}

describe('withColdStartRetry', () => {
  it('raises errorRetry to ride the cold-start 404 window with capped backoff', () => {
    const out = withColdStartRetry(defaultPolicy())
    expect(out.default.errorRetry).toEqual({
      maxNumRetry: COLD_START_MAX_RETRY,
      retryDelayMs: 1000,
      maxRetryDelayMs: 8000,
    })
    expect(COLD_START_MAX_RETRY).toBeGreaterThanOrEqual(20) // ≈2–3 min of riding
  })

  it('preserves timeoutRetry and the other load-time fields untouched', () => {
    const src = defaultPolicy()
    const out = withColdStartRetry(src)
    expect(out.default.timeoutRetry).toEqual(src.default.timeoutRetry)
    expect(out.default.maxLoadTimeMs).toBe(20000)
    expect(out.default.maxTimeToFirstByteMs).toBeNull()
  })

  it('does not mutate the input policy (pure)', () => {
    const src = defaultPolicy()
    withColdStartRetry(src)
    expect(src.default.errorRetry.maxNumRetry).toBe(1)
  })
})
