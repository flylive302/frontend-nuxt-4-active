/**
 * useRoomCovered
 *
 * Thin composable wrapper around `motionPauseOrchestrator`'s covered-signal
 * mechanism (room-battery-perf issue 03) for full-screen overlays/drawers/
 * sheets that obscure the room. Call `cover()` when the overlay opens and
 * `uncover()` when it closes; both are idempotent (a second `cover()` without
 * an intervening `uncover()` is a no-op — one token per composable instance).
 * Auto-releases on unmount so a component that forgets to call `uncover()`
 * before closing never leaves the room stuck paused.
 */
import { onUnmounted } from 'vue'
import { acquireCovered, releaseCovered } from '~/services/motionPauseOrchestrator'

export interface UseRoomCovered {
  /** Mark the room as covered (e.g. a full-screen drawer just opened). */
  cover: () => void
  /** Clear this instance's covered signal (e.g. the drawer closed). */
  uncover: () => void
}

export function useRoomCovered(): UseRoomCovered {
  let token: string | null = null

  function cover(): void {
    if (token !== null) return
    token = acquireCovered()
  }

  function uncover(): void {
    if (token === null) return
    releaseCovered(token)
    token = null
  }

  onUnmounted(() => uncover())

  return { cover, uncover }
}
