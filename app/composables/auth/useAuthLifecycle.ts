// ========================================
// Auth Lifecycle Composable
// ========================================
// REACT layer for force-disconnect events fired from MSAB (admin block / sign out everywhere).
// Lives outside useAudioSocket so the socket layer stays infrastructure-only.



export interface ForceDisconnectPayload {
  reason: string
  blocked_until?: string | null
  blocked_reason?: string | null
}

export function useAuthLifecycle() {
  const { disconnect: disconnectSocket } = useAudioSocket()

  /**
   * Handle MSAB's auth:force_disconnect event, routed on `payload.reason`:
   *
   * - `'blocked'` → enterBlocked(): keeps the token, leaves the room, drops the
   *   socket and navigates to /blocked. Nothing else runs here.
   * - anything else (`'signed_out'` from "Sign out everywhere", or an unknown
   *   reason) → plain session end. The room is left and the socket dropped
   *   FIRST, before any network call: MSAB emits the
   *   event then server-disconnects, and with listeners still live the
   *   `io server disconnect` path would reconnect with a revoked token. Then the
   *   normal logout runs (leave room, reset stores, clear auth incl. blockInfo,
   *   navigate to /log-in). Block state is never stored on this path.
   */
  async function handleForceDisconnect(payload: ForceDisconnectPayload): Promise<void> {
    if (payload.reason === 'blocked') {
      useBlockedState().enterBlocked({
        kind: 'account',
        reason: payload.blocked_reason ?? null,
        until: payload.blocked_until ?? null,
      })
      return
    }

    // Leave the room before the logout's network round-trip (its POST
    // /auth/logout 401s on the revoked token and can take the full timeout
    // offline), so the room UI and audio stop at once.
    useRoomSession().leaveRoom()
    disconnectSocket()
    await useAuthActions().logout()
  }

  return { handleForceDisconnect }
}
