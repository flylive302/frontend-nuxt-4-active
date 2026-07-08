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

  function updateBalance(balance: {
    coins: string
    diamonds: string
    wealth_xp: string
    charm_xp: string
  }) {
    if (user.value) {
      user.value = { ...user.value, coins: balance.coins, diamonds: balance.diamonds, wealth_xp: balance.wealth_xp, charm_xp: balance.charm_xp }
    }
  }

  function patchBalance(partial: Partial<Pick<BootstrapUser, 'coins' | 'diamonds' | 'wealth_xp' | 'charm_xp'>>) {
    if (user.value) {
      user.value = { ...user.value, ...partial }
    }
  }

  function patchVip(vip: { vip_level: number; vip_level_id: number | null; vip_expires_at: string | null }) {
    if (user.value) {
      user.value = { ...user.value, vip_level: vip.vip_level, vip_level_id: vip.vip_level_id, vip_expires_at: vip.vip_expires_at }
    }
  }

  function patchProfile(partial: Partial<BootstrapUser>) {
    if (user.value) {
      user.value = { ...user.value, ...partial }
    }
  }

  function incrementFollowers() {
    if (user.value) {
      user.value = { ...user.value, followers_count: user.value.followers_count + 1 }
    }
  }

  function decrementFollowers() {
    if (user.value && user.value.followers_count > 0) {
      user.value = { ...user.value, followers_count: user.value.followers_count - 1 }
    }
  }

  function incrementFollowing() {
    if (user.value) {
      user.value = { ...user.value, following_count: user.value.following_count + 1 }
    }
  }

  function decrementFollowing() {
    if (user.value && user.value.following_count > 0) {
      user.value = { ...user.value, following_count: user.value.following_count - 1 }
    }
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
    updateBalance,
    patchBalance,
    patchVip,
    patchProfile,
    incrementFollowers,
    decrementFollowers,
    incrementFollowing,
    decrementFollowing,
  }
}, {
  // token → durable cookie (90-day, matches backend Sanctum expiration). The
  // module's default cookie storage sets no maxAge, so token persisted as a
  // SESSION cookie that is dropped when the browser closes. A returning user
  // then had authStore.token === null, and the `auth` route middleware bounced
  // them to /welcome — even though the separate durable `sanctum_token` cookie
  // (read by useApi) was still valid. Persisting token durably keeps the route
  // gate and bootstrap rehydration in sync with the API-layer auth.
  //
  // user → localStorage: durable across restarts without the ~4KB cookie size
  // limit or per-request overhead of shipping the full user object on every
  // call. useUserSync().syncUser() re-fetches it on each boot (and on socket
  // reconnect), so a miss self-heals.
  //
  // F-69: msabToken stays on per-tab sessionStorage so a logout / user-switch
  // in one tab can't clear another tab's in-use MSAB session. A fresh tab with
  // empty sessionStorage transparently re-fetches its own msabToken on first
  // connect (useAudioSocket.connect → refreshMsabToken, using the shared token).
  persist: [
    {
      pick: ['token'],
      storage: piniaPluginPersistedstate.cookies({
        maxAge: 90 * 24 * 60 * 60,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }),
    },
    { pick: ['user'], storage: piniaPluginPersistedstate.localStorage() },
    { pick: ['msabToken'], storage: piniaPluginPersistedstate.sessionStorage() },
  ],
})
