// ========================================
// useInboxReconcile Composable Tests
// ========================================
// Covers issue 03 (dm-realtime-platform):
//   - refetches threads (+ tail when a thread is open)
//   - overlapping triggers coalesce into a single in-flight fetch

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock useInboxStore (Pinia auto-import) ────────────────
const store: { activeThreadId: string | null } = { activeThreadId: null }
vi.stubGlobal('useInboxStore', () => store)

// ── Mock useInboxActions (Nuxt auto-import) ───────────────
const fetchThreads = vi.fn().mockResolvedValue(undefined)
const loadMessages = vi.fn().mockResolvedValue(undefined)
vi.stubGlobal('useInboxActions', () => ({ fetchThreads, loadMessages }))

describe('useInboxReconcile', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    store.activeThreadId = null
  })

  it('refetches thread list + unread counts, and no tail when no thread is open', async () => {
    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    await reconcileInbox('bootstrap')

    expect(fetchThreads).toHaveBeenCalledTimes(1)
    expect(loadMessages).not.toHaveBeenCalled()
  })

  it('also refetches the open thread tail when a thread is active', async () => {
    store.activeThreadId = 'thread-42'

    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    await reconcileInbox('thread-open')

    expect(fetchThreads).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenCalledWith('thread-42')
  })

  it('each trigger independently causes exactly one reconcile call', async () => {
    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    await reconcileInbox('bootstrap')
    await reconcileInbox('socket-reconnect')
    await reconcileInbox('thread-open')

    expect(fetchThreads).toHaveBeenCalledTimes(3)
  })

  it('coalesces two triggers firing while a reconcile is in flight into one fetch', async () => {
    let resolveFetch!: () => void
    fetchThreads.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFetch = resolve
      }),
    )

    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    // Two overlapping triggers before the first fetch resolves.
    const first = reconcileInbox('bootstrap')
    const second = reconcileInbox('socket-reconnect')

    expect(fetchThreads).toHaveBeenCalledTimes(1)

    resolveFetch()
    await Promise.all([first, second])

    // Still only one underlying fetch — the second call joined the in-flight promise.
    expect(fetchThreads).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh fetch for a trigger that arrives after the previous one completed', async () => {
    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    await reconcileInbox('bootstrap')
    await reconcileInbox('bootstrap')

    expect(fetchThreads).toHaveBeenCalledTimes(2)
  })
})
