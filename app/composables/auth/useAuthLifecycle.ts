// ========================================
// Auth Lifecycle Composable
// ========================================
// REACT layer for force-disconnect (admin block) events fired from MSAB.
// Lives outside useAudioSocket so the socket layer stays infrastructure-only.

import { createLogger } from '~/utils/logger'

const log = createLogger('[AuthLifecycle]')

export interface ForceDisconnectPayload {
  reason: string
  blocked_until?: string | null
  blocked_reason?: string | null
}

export function useAuthLifecycle() {
  const authStore = useAuthStore()
  const { disconnect: disconnectSocket } = useAudioSocket()

  /**
   * Handle MSAB's auth:force_disconnect event.
   * Stores suspension info → kills the socket → clears auth → redirects.
   */
  async function handleForceDisconnect(payload: ForceDisconnectPayload): Promise<void> {
    log.warn('Force-disconnected by server:', payload.reason)

    authStore.setSuspensionInfo({
      reason: payload.blocked_reason ?? 'Your account has been suspended.',
      until: payload.blocked_until ?? null,
    })

    disconnectSocket()
    authStore.logout()
    await navigateTo('/blocked')
  }

  return { handleForceDisconnect }
}
