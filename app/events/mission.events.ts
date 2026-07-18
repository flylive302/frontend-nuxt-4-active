// ========================================
// Mission Events (Recharge Activity)
// ========================================

import { ref } from 'vue'
import type { Socket } from 'socket.io-client'
import type {
  MissionProgressUpdatedPayload,
  MissionFinaleReadyPayload,
} from '~/types/room/socket-events'

/**
 * Reactive signal for the latest `mission.progress.updated` push.
 * Composables watching this ref refetch progress for the affected timeframe.
 */
export const lastMissionProgressUpdate = ref<MissionProgressUpdatedPayload | null>(null)

/**
 * Reactive signal for the latest `mission.finale.ready` push.
 * Composables watching this ref stop polling and fetch the honor-wall snapshot.
 */
export const lastMissionFinaleReady = ref<MissionFinaleReadyPayload | null>(null)

/**
 * Composable to register mission-related socket event handlers.
 * REACT only: writes the payload into a reactive signal — no business logic,
 * no API calls. Composables (`useMissionEcho`, `useRechargeLeaderboard`) watch
 * these signals and decide what to refetch.
 */
export function useMissionEvents() {
  return function registerMissionEvents(socket: Socket): void {
    socket.on('mission.progress.updated', (payload: MissionProgressUpdatedPayload) => {
      lastMissionProgressUpdate.value = payload
    })

    socket.on('mission.finale.ready', (payload: MissionFinaleReadyPayload) => {
      lastMissionFinaleReady.value = payload
    })
  }
}
