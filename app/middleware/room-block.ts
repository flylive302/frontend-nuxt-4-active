// ========================================
// Room Block Middleware
// ========================================
import { resolveHttpBlockedMessage } from '~/utils/socket/socketErrorMessages'

/**
 * GATE for direct navigations to /room/:id (typed URL, back button, refresh).
 *
 * Entries via useRoomEntry already pass the HTTP join gate before navigating
 * (and set currentRoom first), so those are skipped here. Everything else
 * verifies with the backend join endpoint before the page mounts, so a
 * blocked user (ADR 0017) never sees the room flash — they get the
 * "Cannot Enter the Room" toast and stay where they were.
 *
 * Only the blocked case redirects. Any other failure (password, network)
 * falls through — the in-room socket gate + lifecycle handling covers it.
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return

  const roomStore = useRoomStore()
  const roomId = Number(to.params.id)
  if (!Number.isFinite(roomId)) return

  // Already verified by the entry flow — don't double-POST the join.
  if (roomStore.currentRoom?.id === roomId) return

  const { api } = useApi()
  try {
    await api(`/rooms/${roomId}/join`, { method: 'POST', body: {} })
  } catch (error: unknown) {
    const err = error as Record<string, unknown>
    const response = err?.response as Record<string, unknown> | undefined
    const status = (response?.status as number | undefined) ?? err?.statusCode ?? err?.status
    const data = response?._data as { meta?: { error_code?: string, remaining_seconds?: number | 'permanent' } } | undefined
    if (status === 403 && data?.meta?.error_code === 'user_blocked') {
      useToast().add({
        title: 'Cannot Enter the Room',
        description: resolveHttpBlockedMessage(data?.meta?.remaining_seconds),
        color: 'error',
      })
      // In-app navigation (back button, room link): cancel the navigation so
      // the user stays exactly where they are — no room-page mount, no view
      // transition, no flash. Only a cold load directly on /room/:id has no
      // page to stay on, so that one redirects home.
      if (from.fullPath !== to.fullPath) {
        return abortNavigation()
      }
      return navigateTo('/', { replace: true })
    }
  }
})
