/**
 * Realtime composable for Recharge Activity mission updates.
 *
 * Subscribes to the user's private channel and listens for
 * `mission.progress.updated` broadcasts (emitted after a successful claim).
 * The caller provides `onUpdate` — what to re-fetch on event.
 *
 * Call subscribe() once after the page mounts; unsubscribe() on unmount.
 */

import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionEcho]')

export function useMissionEcho(onUpdate: () => void | Promise<void>) {
  const { $echo } = useNuxtApp()
  const authStore = useAuthStore()

  function subscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return

    const channel = $echo.private(`user.${userId}`)
    if (!channel) return

    channel.listen('.mission.progress.updated', () => {
      Promise.resolve(onUpdate()).catch((err: unknown) =>
        log.warn('Failed to refresh mission progress', err),
      )
    })
  }

  function unsubscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return
    $echo.leave(`user.${userId}`)
  }

  return { subscribe, unsubscribe }
}
