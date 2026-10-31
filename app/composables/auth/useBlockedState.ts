// ========================================
// Blocked State Composable (account-bans 03)
// ========================================
// Owns the "you are blocked" flow: entering /blocked from an API reply, and the
// three ways out of it (Try again, Sign out, Back to login).
//
// ⚠️ The token is KEPT on entry. A block ends on its own (`blocked_until`), and
// "Try again" must resume the session with no re-login. Only Sign out drops it.
//
// The store holds the state (`authStore.blockInfo`, persisted); this file holds
// every decision about it. The 401 branch in useApi calls `enterBlocked()`.

import type { BlockInfo } from '~/types/user/block'
import { createLogger } from '~/utils/logger'
import { parseBlockReply } from '~/utils/api/parseBlockReply'
import { BLOCKED_PATH } from '~/constants/blocked'

const log = createLogger('[Blocked]')

export function useBlockedState() {
  const authStore = useAuthStore()

  const blockInfo = computed<BlockInfo | null>(() => authStore.blockInfo)
  const isSignedIn = computed(() => !!authStore.token)
  const isRetrying = ref(false)

  /**
   * EXECUTE + REACT: store the block and land on /blocked. Idempotent — every
   * request made while blocked comes back with the same reply, and each one
   * refreshes the stored block (its end date may have changed) without
   * stacking history entries.
   */
  function enterBlocked(info: BlockInfo): void {
    const wasBlocked = authStore.blockInfo !== null
    authStore.setBlockInfo(info)

    // First entry only: leave the room and drop the live connection, the way
    // the socket force-disconnect does. The token is kept, so nothing else
    // (room-minimize, the socket plugin's auth watcher) would — a block reply
    // received in a room would otherwise minimize it with the mic still up.
    // Navigation first, teardown guarded: this runs inside an ofetch hook, and
    // a throw from the teardown must never keep the user off /blocked.
    if (useRoute().path.replace(/\/+$/, '') !== BLOCKED_PATH) {
      void navigateTo(BLOCKED_PATH, { replace: true })
    }

    if (!wasBlocked) {
      try {
        useRoomSession().leaveRoom()
        useAudioSocket().disconnect()
      } catch (error) {
        log.warn('Leaving the room / socket on block failed', error)
      }
    }
  }

  /**
   * EXECUTE + REACT: the server answered a signed-in request normally while a
   * block is stored, so the block is over (ended, lifted, or the IP changed).
   * Resume the session with the same token. Idempotent — a no-op when nothing
   * is stored. Called by useApi on a 2xx `/auth/user` and by Try again.
   */
  function resumeAfterBlock(): void {
    // GATE
    if (authStore.blockInfo === null) return
    // EXECUTE
    authStore.setBlockInfo(null)
    // REACT — /bootstrap and the MSAB token refresh 401'd while blocked, so the
    // session's data and live connection never came up. `init()` is safe to
    // re-run (the bootstrap plugin's token watcher does the same); the socket
    // plugin only connects on an isAuthenticated false → true change, which a
    // kept token never makes.
    void useBootstrapInit().init()
    const socket = useAudioSocket()
    if (!socket.isConnected.value) void socket.connect()
    if (useRoute().path.replace(/\/+$/, '') === BLOCKED_PATH) {
      void navigateTo('/', { replace: true })
    }
  }

  /**
   * "Try again" (shown only once the block has ended). Re-asks the server; on
   * success the session resumes where it is, with the same token. When the
   * block is still in force, useApi's 401 branch has already re-stored it, so
   * the page simply re-renders with the new end date.
   */
  async function tryAgain(): Promise<void> {
    // GATE
    if (isRetrying.value || !isSignedIn.value) return
    isRetrying.value = true
    try {
      // EXECUTE
      const { api } = useApi()
      await api('/auth/user')
      // useApi's 2xx hook has normally resumed already; this covers the rest.
      resumeAfterBlock()
    } catch (error) {
      const response = (error as { response?: { status?: number; _data?: unknown } } | undefined)?.response
      // A plain 401 (no block code): the token itself is gone — e.g. the block
      // came with "Sign out everywhere". `/auth/user` is exempt from useApi's
      // generic logout, so end the session here instead of leaving the user on
      // a Try again that can never work.
      if (response?.status === 401) {
        // Still blocked: useApi already re-stored the block and the page shows
        // the new end date — no connectivity warning on top of it.
        if (parseBlockReply(response.status, response._data)) return
        await useAuthActions().logout()
        return
      }
      log.warn('Try again did not resume the session', error)
      try {
        useToast().add({
          title: 'Could not reach FlyLive',
          description: 'Check your connection and try again.',
          color: 'warning',
        })
      } catch {
        // No toast outside a Vue context — the button simply stays.
      }
    } finally {
      isRetrying.value = false
    }
  }

  /** Sign out from /blocked: the normal logout, which also clears blockInfo. */
  async function signOut(): Promise<void> {
    await useAuthActions().logout()
  }

  /**
   * Refused while signed out (login / register reply): nothing to resume, so
   * forget the block and go back to the login screen.
   */
  async function backToLogin(): Promise<void> {
    authStore.setBlockInfo(null)
    await navigateTo('/log-in', { replace: true })
  }

  return { blockInfo, isSignedIn, isRetrying, enterBlocked, resumeAfterBlock, tryAgain, signOut, backToLogin }
}
