// ========================================
// DM Presence Composable (dm-realtime-platform/07)
// ========================================
// Orchestrator that keeps `presence:subscribe`/`presence:unsubscribe` in
// sync with the contacts actually visible in the open inbox (the open
// thread's peer + the loaded thread list participants), never a global
// fan-out (ADR 0021). GATE/EXECUTE/REACT:
//
// GATE:    derive the "wanted" contact set (capped) and diff it against
//          the currently-subscribed set — nothing to do if unchanged, or
//          if the socket isn't connected.
// EXECUTE: emit presence:subscribe/unsubscribe for the diff; apply the
//          subscribe ack's snapshot to the store.
// REACT:   none beyond the store mutation above — no toasts/logging side
//          effects warranted for a background sync.
//
// Re-subscribes with a fresh snapshot on socket reconnect (self-heals any
// pushes missed while disconnected, matching the at-most-once/no-replay
// realtime model used elsewhere in inbox — see useInboxReconcile).

import { PRESENCE_SUBSCRIBE_MAX } from '~/constants/inbox'
import { createEmitAsync } from '~/utils/socket'
import { useAudioSocket } from '../room/useAudioSocket'

interface PresenceAckResponse {
  success: boolean
  error?: string
  data?: Record<number, boolean>
}

export interface UseDmPresenceOptions {
  /**
   * Extra candidate ids to keep subscribed even though they aren't a thread
   * participant — e.g. the inbox page's online-contacts strip. Priority
   * order is: open-thread peer, then these, then the thread list (see
   * computeWantedUserIds). Reactive so the strip can populate async.
   */
  stripUserIds?: Ref<number[]> | ComputedRef<number[]>
}

export function useDmPresence(options: UseDmPresenceOptions = {}) {
  const { socket, status } = useAudioSocket()
  const inboxStore = useInboxStore()
  const presenceStore = usePresenceStore()
  const emitAsync = createEmitAsync(socket)

  // ── GATE ──────────────────────────────────────────────
  /**
   * The contacts currently visible, priority-ordered and capped: open
   * thread peer, then the strip's candidate ids, then loaded thread list
   * participants.
   */
  function computeWantedUserIds(): number[] {
    const ids = new Set<number>()

    const activeThread = inboxStore.activeThreadId ? inboxStore.threadById(inboxStore.activeThreadId) : undefined
    if (activeThread) {
      const peerId = Number(activeThread.participant.id)
      if (!Number.isNaN(peerId)) ids.add(peerId)
    }

    for (const stripId of options.stripUserIds?.value ?? []) {
      if (ids.size >= PRESENCE_SUBSCRIBE_MAX) break
      const id = Number(stripId)
      if (!Number.isNaN(id)) ids.add(id)
    }

    for (const thread of [...inboxStore.dmThreads, ...inboxStore.requestThreads]) {
      if (ids.size >= PRESENCE_SUBSCRIBE_MAX) break
      const participantId = Number(thread.participant.id)
      if (!Number.isNaN(participantId)) ids.add(participantId)
    }

    return Array.from(ids).slice(0, PRESENCE_SUBSCRIBE_MAX)
  }

  // ── EXECUTE ───────────────────────────────────────────
  async function subscribe(userIds: number[]): Promise<void> {
    if (userIds.length === 0) return
    const res = await emitAsync<{ userIds: number[] }, PresenceAckResponse>('presence:subscribe', { userIds })
    if (res?.success && res.data) {
      presenceStore.applySnapshot(res.data)
    }
  }

  function unsubscribe(userIds: number[]): void {
    if (userIds.length === 0 || !socket.value) return
    socket.value.emit('presence:unsubscribe', { userIds })
  }

  /** Diff the wanted set against the current subscription set and sync the socket. */
  async function sync(): Promise<void> {
    if (!socket.value?.connected) return

    const wanted = computeWantedUserIds()
    const wantedSet = new Set(wanted)
    const current = presenceStore.subscribedUserIds

    const toSubscribe = wanted.filter(id => !current.has(id))
    const toUnsubscribe = Array.from(current).filter(id => !wantedSet.has(id))

    unsubscribe(toUnsubscribe)
    presenceStore.setSubscriptions(wanted)
    await subscribe(toSubscribe)
  }

  /**
   * Re-subscribe to the full wanted set with a fresh snapshot (reconnect
   * self-heal). Recomputed from the store rather than trusting the
   * previously-subscribed set, which stays empty if the composable mounted
   * while the socket was disconnected (sync() no-ops until connected).
   */
  async function resubscribeAll(): Promise<void> {
    const wanted = computeWantedUserIds()
    presenceStore.setSubscriptions(wanted)
    await subscribe(wanted)
  }

  const stopWantedWatch = watch(
    () => [
      inboxStore.activeThreadId,
      inboxStore.dmThreads,
      inboxStore.requestThreads,
      options.stripUserIds?.value,
    ] as const,
    () => { void sync() },
    { deep: true, immediate: true },
  )

  const stopStatusWatch = watch(status, (next, prev) => {
    if (next === 'connected' && prev && prev !== 'connected') {
      void resubscribeAll()
    }
  })

  /** Unsubscribe from every currently-subscribed contact and tear down watchers. */
  function stop(): void {
    stopWantedWatch()
    stopStatusWatch()
    const ids = Array.from(presenceStore.subscribedUserIds)
    unsubscribe(ids)
    presenceStore.setSubscriptions([])
  }

  return { sync, stop }
}
