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

  it('joiner re-runs once when the active thread changed while the run was in flight', async () => {
    store.activeThreadId = 'thread-X'
    let resolveLoad!: () => void
    loadMessages.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLoad = resolve
      }),
    )

    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    const first = reconcileInbox('thread-open') // picks up tail for thread-X, hangs on loadMessages

    // Let fetchThreads resolve and loadMessages('thread-X') get invoked (captures
    // lastTailThreadId = 'thread-X') before the user switches chats.
    await Promise.resolve()
    await Promise.resolve()

    // User switches chats while the first run's tail fetch is still in flight.
    store.activeThreadId = 'thread-Y'
    const joiner = reconcileInbox('thread-open') // joins the in-flight run

    resolveLoad()
    await Promise.all([first, joiner])

    expect(fetchThreads).toHaveBeenCalledTimes(2)
    expect(loadMessages).toHaveBeenCalledTimes(2)
    expect(loadMessages).toHaveBeenNthCalledWith(1, 'thread-X')
    expect(loadMessages).toHaveBeenNthCalledWith(2, 'thread-Y')
  })

  it('joiner does not re-run when the active thread is unchanged', async () => {
    store.activeThreadId = 'thread-X'
    let resolveFetch!: () => void
    fetchThreads.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFetch = resolve
      }),
    )

    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    const first = reconcileInbox('thread-open')
    const joiner = reconcileInbox('thread-open')

    resolveFetch()
    await Promise.all([first, joiner])

    expect(fetchThreads).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenCalledWith('thread-X')
  })

  it('joiner does not re-run when the active thread became null', async () => {
    store.activeThreadId = 'thread-X'
    let resolveLoad!: () => void
    loadMessages.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLoad = resolve
      }),
    )

    const { useInboxReconcile } = await import('../../app/composables/inbox/useInboxReconcile')
    const { reconcileInbox } = useInboxReconcile()

    const first = reconcileInbox('thread-open')

    // Let fetchThreads resolve and loadMessages('thread-X') get invoked before
    // the user closes the thread.
    await Promise.resolve()
    await Promise.resolve()

    store.activeThreadId = null
    const joiner = reconcileInbox('thread-open')

    resolveLoad()
    await Promise.all([first, joiner])

    expect(fetchThreads).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenCalledTimes(1)
  })
})
