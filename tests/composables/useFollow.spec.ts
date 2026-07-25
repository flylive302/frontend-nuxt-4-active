// ========================================
// useFollow Composable Tests
// ========================================
// Covers docs/issues/follows-fanout/01-batch-follow-status.md (frontend slice):
// - Seeded useFollow (list rows) must skip the per-user `/follow-status` fetch.
// - Unseeded useFollow (seat-drawer.vue, [UserSignature].vue) must be unaffected
//   and still fetch on mount.
// - The seed is initialize-only: once state has loaded, a later re-evaluation
//   of the seed getter must never clobber optimistic state from toggleFollow.
// - buttonLabel derivation ('Follow Back' vs 'Following').

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, watch, readonly, toValue, nextTick } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('watch', watch)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('toValue', toValue)

let apiMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  apiMock = vi.fn().mockResolvedValue({})
  ;(globalThis as Record<string, unknown>).useApi = () => ({
    api: (...args: unknown[]) => apiMock(...args),
    normalizeError: (e: unknown) => ({ message: String(e) }),
  })
  ;(globalThis as Record<string, unknown>).useAuthStore = () => ({
    user: { id: 999 },
    incrementFollowing: vi.fn(),
    decrementFollowing: vi.fn(),
  })
  ;(globalThis as Record<string, unknown>).useToast = () => ({ add: vi.fn() })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'useApi')
  Reflect.deleteProperty(globalThis, 'useAuthStore')
  Reflect.deleteProperty(globalThis, 'useToast')
})

/** Flush pending promise microtasks. Multiple rounds cover chains of awaits. */
async function flushMicrotasks(rounds = 4) {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}

describe('useFollow — seeded vs unseeded fetch', () => {
  it('performs no /follow-status fetch when seeded', async () => {
    const { useFollow } = await import('~/composables/user/useFollow')
    const { isFollowing, isFollowedBy, statusLoaded } = useFollow(() => 5, undefined, {
      initialStatus: () => ({ is_following: true, is_followed_by: false }),
    })

    await flushMicrotasks()

    expect(apiMock).not.toHaveBeenCalled()
    expect(isFollowing.value).toBe(true)
    expect(isFollowedBy.value).toBe(false)
    expect(statusLoaded.value).toBe(true)
  })

  it('falls back to fetching when the seed carries undefined flags (FE deployed ahead of Laravel)', async () => {
    apiMock.mockResolvedValueOnce({
      status: 'success',
      data: { is_following: true, is_followed_by: false, followed_at: null },
    })

    const { useFollow } = await import('~/composables/user/useFollow')
    // A list row built from a response that predates the backend change: the seed
    // object is truthy, but both flags are undefined.
    const { isFollowing, statusLoaded } = useFollow(() => 5, undefined, {
      initialStatus: () => ({
        is_following: undefined as unknown as boolean,
        is_followed_by: undefined as unknown as boolean,
      }),
    })

    await flushMicrotasks()

    expect(apiMock).toHaveBeenCalledWith('/users/5/follow-status')
    expect(isFollowing.value).toBe(true)
    expect(statusLoaded.value).toBe(true)
  })

  it('still fetches /follow-status on mount when unseeded (seat-drawer.vue / [UserSignature].vue path)', async () => {
    apiMock.mockResolvedValueOnce({
      status: 'success',
      data: { is_following: true, is_followed_by: false, followed_at: null },
    })

    const { useFollow } = await import('~/composables/user/useFollow')
    const { isFollowing, statusLoaded } = useFollow(() => 5)

    await flushMicrotasks()

    expect(apiMock).toHaveBeenCalledWith('/users/5/follow-status')
    expect(isFollowing.value).toBe(true)
    expect(statusLoaded.value).toBe(true)
  })
})

describe('useFollow — initialize-only seed precedence', () => {
  it('optimistic toggle survives a later re-evaluation of the seed getter', async () => {
    const seed = ref({ is_following: false, is_followed_by: false })

    const { useFollow } = await import('~/composables/user/useFollow')
    const { isFollowing, toggleFollow } = useFollow(() => 5, undefined, {
      initialStatus: () => seed.value,
    })

    await flushMicrotasks()
    expect(apiMock).not.toHaveBeenCalled()
    expect(isFollowing.value).toBe(false)

    // toggleFollow flips optimistically, then the (mocked) API call succeeds.
    await toggleFollow()
    expect(isFollowing.value).toBe(true)

    // Re-evaluate the seed getter with a different (stale) value — must be a no-op.
    seed.value = { is_following: false, is_followed_by: true }
    await nextTick()
    await flushMicrotasks()

    expect(isFollowing.value).toBe(true)
  })

  it('resets and refetches when the id genuinely changes with no seed for the new id', async () => {
    const currentId = ref<number | null>(5)
    const { useFollow } = await import('~/composables/user/useFollow')
    const { isFollowing, statusLoaded } = useFollow(() => currentId.value, undefined, {
      initialStatus: () => (currentId.value === 5 ? { is_following: true, is_followed_by: false } : null),
    })

    await flushMicrotasks()
    expect(apiMock).not.toHaveBeenCalled()
    expect(isFollowing.value).toBe(true)

    // The new id's fetch response deliberately disagrees with id 5's seed
    // (false vs. true) so this assertion can only pass if the fetch path
    // actually ran — a leftover stale seed would read true, not false.
    apiMock.mockResolvedValueOnce({
      status: 'success',
      data: { is_following: false, is_followed_by: false, followed_at: null },
    })

    // Switch to an id the seed doesn't cover — must reset then fetch.
    currentId.value = 6
    await nextTick()
    await flushMicrotasks()

    expect(apiMock).toHaveBeenCalledWith('/users/6/follow-status')
    expect(isFollowing.value).toBe(false)
    expect(statusLoaded.value).toBe(true)
  })
})

describe('useFollow — buttonLabel', () => {
  it('returns "Follow Back" when is_followed_by is true and is_following is false', async () => {
    const { useFollow } = await import('~/composables/user/useFollow')
    const { buttonLabel } = useFollow(() => 5, undefined, {
      initialStatus: () => ({ is_following: false, is_followed_by: true }),
    })

    await flushMicrotasks()
    expect(buttonLabel.value).toBe('Follow Back')
  })

  it('returns "Following" when is_following is true', async () => {
    const { useFollow } = await import('~/composables/user/useFollow')
    const { buttonLabel } = useFollow(() => 5, undefined, {
      initialStatus: () => ({ is_following: true, is_followed_by: false }),
    })

    await flushMicrotasks()
    expect(buttonLabel.value).toBe('Following')
  })
})
