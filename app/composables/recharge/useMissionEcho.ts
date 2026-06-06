/**
 * Realtime composable for Recharge Activity mission updates.
 *
 * Subscribes to the user's private channel and listens for
 * `mission.progress.updated` broadcasts (emitted after a successful claim).
 * On event: re-fetches the daily progress to sync authoritative state.
 *
 * Call subscribe() once after the page mounts; unsubscribe() on unmount.
 */

import { useRechargeMissionData } from '~/composables/recharge/useRechargeMissionData'
import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionEcho]')

export function useMissionEcho() {
  const { $echo } = useNuxtApp()
  const authStore = useAuthStore()
  const { fetchDaily } = useRechargeMissionData()

  function subscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return

    const channel = $echo.private(`user.${userId}`)
    if (!channel) return

    channel.listen('.mission.progress.updated', () => {
      fetchDaily().catch((err: unknown) => log.warn('Failed to refresh mission progress', err))
    })
  }

  function unsubscribe(): void {
    const userId = authStore.user?.id
    if (!userId) return
    $echo.leave(`user.${userId}`)
  }

  return { subscribe, unsubscribe }
}
