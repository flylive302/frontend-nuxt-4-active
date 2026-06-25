// ========================================
// Auth Lifecycle Composable
// ========================================
// REACT layer for force-disconnect (admin block) events fired from MSAB.
// Lives outside useAudioSocket so the socket layer stays infrastructure-only.



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

    authStore.setSuspensionInfo({
      reason: payload.blocked_reason ?? 'Your account has been suspended.',
      until: payload.blocked_until ?? null,
    })

    // Clear room session state before logout so the persisted `minimizedRoom`
    // snapshot doesn't outlive the block and resurrect the mini-player bubble
    // on a later re-login.
    useRoomStore().leaveRoom()
    disconnectSocket()
    authStore.logout()
    await navigateTo('/blocked')
  }

  return { handleForceDisconnect }
}
