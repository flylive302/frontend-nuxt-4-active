/**
 * Realtime composable for Recharge Activity mission updates.
 *
 * Watches the `mission.progress.updated` MSAB signal (app/events/mission.events.ts)
 * and calls `onUpdate` — what to re-fetch on event.
 *
 * Call subscribe() once after the page mounts; unsubscribe() on unmount.
 */

import { lastMissionProgressUpdate } from '~/events/mission.events'
import { createLogger } from '~/utils/logger'

const log = createLogger('[MissionEcho]')

export function useMissionEcho(onUpdate: () => void | Promise<void>) {
  let stopWatch: (() => void) | null = null

  function subscribe(): void {
    stopWatch = watch(lastMissionProgressUpdate, (payload) => {
      if (!payload) return
      Promise.resolve(onUpdate()).catch((err: unknown) =>
        log.warn('Failed to refresh mission progress', err),
      )
    }, { flush: 'sync' })
  }

  function unsubscribe(): void {
    stopWatch?.()
    stopWatch = null
  }

  return { subscribe, unsubscribe }
}
