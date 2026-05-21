// ========================================
// Auth Store
// ========================================

import { defineStore } from 'pinia'
import type { BootstrapUser } from '~/types/user/bootstrap'

export const useAuthStore = defineStore('auth', () => {
  // ========================================
  // State
  // ========================================

  const user = ref<BootstrapUser | null>(null)
  const token = ref<string | null>(null) // Sanctum Laravel token
  const msabToken = ref<string | null>(null) // MSAB token
  const status = ref<'idle' | 'loading' | 'authenticated' | 'unauthenticated'>('idle')
  /** Populated by force-disconnect event; consumed by /blocked page */
  const suspensionInfo = ref<{ reason: string; until: string | null } | null>(null)

  // ========================================
  // Getters
  // ========================================

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // ========================================
  // Actions
  // ========================================

  /**
   * Update the authenticated user.
   */
  function setUser(newUser: BootstrapUser | null) {
    user.value = newUser
    status.value = newUser ? 'authenticated' : 'unauthenticated'
  }

  /**
   * Set an authentication token and sync with the cookie.
   */
  function setToken(newToken: string | null) {
    token.value = newToken
    const cookie = useCookie('sanctum_token', {
      maxAge: 90 * 24 * 60 * 60, // 90 days — matches backend Sanctum expiration
      secure: true,
      sameSite: 'lax',
      path: '/',
    })
    cookie.value = newToken
  }

  /**
   * Set the MSAB audio server JWT.
   */
  function setMsabToken(newToken: string | null) {
    msabToken.value = newToken
  }

  /**
   * Log out the current user.
   * State-only — navigation belongs in the composable REACT stage.
   */
  function logout() {
    user.value = null;
    setToken(null)
    setMsabToken(null)
    status.value = 'unauthenticated'
    suspensionInfo.value = null
  }

  /**
   * Store suspension details from a force-disconnect event.
   * The /blocked page reads this to display reason and countdown.
   */
  function setSuspensionInfo(info: { reason: string; until: string | null }) {
    suspensionInfo.value = info
  }

  // ========================================
  // Return
  // ========================================

  return {
    user,
    token,
    msabToken,
    status,
    suspensionInfo,
    isAuthenticated,
    setUser,
    setToken,
    setMsabToken,
    logout,
    setSuspensionInfo,
  }
}, {
  // F-69: keep token + user on the default SSR-safe cookie storage (shared
  // login across tabs), but isolate msabToken to per-tab sessionStorage so a
  // logout / user-switch in one tab can't clear another tab's in-use MSAB
  // session. A fresh tab with empty sessionStorage transparently re-fetches its
  // own msabToken on first connect (useAudioSocket.connect → refreshMsabToken,
  // which uses the shared Sanctum token).
  persist: [
    { pick: ['token', 'user'] },
    { pick: ['msabToken'], storage: piniaPluginPersistedstate.sessionStorage() },
  ],
})
