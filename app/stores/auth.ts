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
  const token = ref<string | null>(null)
  const msabToken = ref<string | null>(null)
  const status = ref<'idle' | 'loading' | 'authenticated' | 'unauthenticated'>('idle')

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
   * Set authentication token and sync with cookie.
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
    setUser(null)
    setToken(null)
    setMsabToken(null)
    status.value = 'unauthenticated'
  }

  // ========================================
  // Return
  // ========================================

  return {
    user,
    token,
    msabToken,
    status,
    isAuthenticated,
    setUser,
    setToken,
    setMsabToken,
    logout,
  }
}, {
  persist: {
    pick: ['token', 'msabToken'],
  },
})
