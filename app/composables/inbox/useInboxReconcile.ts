// ========================================
// Inbox Reconcile Composable
// ========================================
// Realtime delivery for DM/inbox events is best-effort, at-most-once,
// no-replay (ADR 0021). `reconcileInbox(reason)` is the single refetch
// path every trigger (app foreground/bootstrap, socket reconnect, thread
// open) funnels through to reconcile truth, instead of each feature
// inventing its own refetch logic.
//
// Behavior:
// - Always refetches the thread list + unread counts.
// - If a thread is currently open (store.activeThreadId), also refetches
//   that thread's tail.
// - `reason` is informational/logging only — never branches behavior.
// - Coalescing: a trigger firing while a reconcile is already in flight
//   joins the SAME in-flight promise rather than starting a second fetch.

import { createLogger } from '~/utils/logger'

const log = createLogger('[useInboxReconcile]')

// Module-level (singleton) in-flight promise — shared across every caller
// of useInboxReconcile(), regardless of which composable instance
// triggered it. This is what makes overlapping triggers coalesce.
let inFlight: Promise<void> | null = null

export function useInboxReconcile() {
  const store = useInboxStore()
  const { fetchThreads, loadMessages } = useInboxActions()

  /**
   * Reconcile inbox state against the server.
   *
   * GATE:    none — always safe to call; coalesces with any in-flight run.
   * EXECUTE: fetch thread list + unread counts, and the open thread's tail.
   * REACT:   none — callers don't need to react to the result, the stores
   *          are updated in place.
   */
  async function reconcileInbox(reason: string): Promise<void> {
    if (inFlight) {
      log.debug('Reconcile already in flight, joining', { reason })
      return inFlight
    }

    log.debug('Reconciling inbox', { reason })
    inFlight = run()
    try {
      await inFlight
    } finally {
      inFlight = null
    }
  }

  async function run(): Promise<void> {
    await fetchThreads()

    const openThreadId = store.activeThreadId
    if (openThreadId) {
      await loadMessages(openThreadId)
    }
  }

  return { reconcileInbox }
}
