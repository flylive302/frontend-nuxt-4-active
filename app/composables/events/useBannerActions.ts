// ========================================
// Event Banner Actions Composable
// ========================================
//
// Opens the destination an admin configured on an event banner.
//
// The defect this fixes: banner targets are free-text router paths typed in the
// Filament panel. Content paths like `/recharge` navigate fine as plain links,
// but `/room/:id` is NOT a route-driven page — `app/pages/room/[id].vue` renders
// `roomStore.currentRoom`, which only `useRoomEntry` populates. A bare
// `<NuxtLink to="/room/182">` therefore mounted an empty room page (blank
// screen) and its guard immediately redirected home.
//
// Rehydration is deliberately NOT the fix: `useRoomRehydration` requires a fresh
// `activeRoom` marker precisely so a cold link cannot auto-join a live audio
// room. A banner click is an explicit user action, so it goes through the same
// verified entry path a room card uses — password gate, block gate and all.
// ========================================

import type { BootstrapRoom } from '~/types/user/bootstrap'

/** Matches an internal room destination, capturing the room id. */
const ROOM_PATH_PATTERN = /^\/room\/(\d+)\/?$/

/**
 * Resolve a banner's configured path into an action.
 *
 * `enterRoom` is injected so the caller's `useRoomEntry()` instance — and the
 * password-prompt state it owns — stays co-located with the component that
 * renders the prompt modal. Same contract as `useTrackUser`.
 */
export function useBannerActions(enterRoomFn: (room: BootstrapRoom) => Promise<void>) {
  const roomStore = useRoomStore()
  const roomSession = useRoomSession()
  const { api } = useApi()
  const toast = useToast()

  const opening = ref(false)

  /**
   * Handle a banner click.
   *
   * `navigate` is RouterLink's own handler, obtained from its `custom` slot. The
   * link MUST be rendered with `custom`: RouterLink otherwise puts
   * `onClick: link.navigate` on its own `<a>`, and Vue merges a fallthrough
   * `@click` AFTER it — so the router would already have pushed `/room/:id`
   * (blank screen → redirect home) before this handler ever ran. Owning the
   * click outright is what makes the interception reliable.
   *
   * Non-room paths are handed straight back to `navigate`, which keeps
   * modifier-click / new-tab behaviour intact. Exactly one navigation happens
   * on either branch.
   */
  async function openBanner(path: string, event: MouseEvent, navigate: (event: MouseEvent) => void): Promise<void> {
    // GATE — only room destinations need special handling. A modifier-click is
    // the browser's own "open elsewhere" gesture; intercepting it would swallow
    // the new tab AND enter the room in this one, so it is left to the browser
    // (vue-router's `guardEvent` bails on the same conditions).
    const roomId = roomIdFromPath(path)
    if (roomId === null || isBrowserHandledClick(event)) {
      navigate(event)
      return
    }

    // This click is ours now; the link must not navigate to the room page
    // directly, because arriving there without a populated store is the bug.
    event.preventDefault()

    if (opening.value) return
    opening.value = true

    // EXECUTE
    try {
      // Already inside this room — just restore it, no leave/rejoin cycle.
      if (roomStore.currentRoom?.id === roomId) {
        roomSession.maximizeRoom()
        await navigateTo(`/room/${roomId}`)
        return
      }

      const response = await api<{ status: string; data: BootstrapRoom }>(`/rooms/${roomId}`)

      if (response.status !== 'success' || !response.data) {
        onUnavailable()
        return
      }

      await enterRoomFn(response.data)
    } catch {
      onUnavailable()
    } finally {
      opening.value = false
    }
  }

  // ========================================
  // Helpers
  // ========================================

  /** Modifier / non-primary clicks the browser should handle itself. */
  function isBrowserHandledClick(event: MouseEvent): boolean {
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return true
    return event.button !== undefined && event.button !== 0
  }

  function roomIdFromPath(path: string): number | null {
    const match = ROOM_PATH_PATTERN.exec(path?.trim() ?? '')
    if (!match?.[1]) return null

    const roomId = Number(match[1])
    return Number.isFinite(roomId) && roomId > 0 ? roomId : null
  }

  // ========================================
  // REACT
  // ========================================

  /**
   * A banner pointing at a deleted or closed room must say so. Silence here is
   * indistinguishable from the blank-screen defect being fixed.
   */
  function onUnavailable(): void {
    toast.add({
      title: 'Room unavailable',
      description: 'This event room may have been closed.',
      color: 'error',
    })
  }

  return {
    /** Click handler for a banner link — pass the configured path and the event. */
    openBanner,
    /** Whether a room entry triggered by a banner is in flight. */
    opening,
  }
}
