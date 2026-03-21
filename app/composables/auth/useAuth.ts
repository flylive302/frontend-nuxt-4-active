// ========================================
// Auth Actions Composable
// ========================================
// Handles authentication actions: login, register, logout, social redirect, MSAB token refresh.
// Profile management is in useProfileActions.ts.

import type { AuthResponse, LoginPayload, RegisterPayload } from '~/types/user/auth'
import { createLogger } from '~/utils/logger'

const log = createLogger('[Auth]')

export function useAuthActions() {
  // ========================================
  // Dependencies
  // ========================================

  const authStore = useAuthStore()
  const { api, fetchCsrfToken } = useApi()
  const toast = useToast()

  // ========================================
  // Actions
  // ========================================

  /**
   * Authenticates a user with the provided credentials.
   *
   * GATE:    Fetch CSRF token
   * EXECUTE: POST /auth/login → update store
   * REACT:   Show success toast
   */
  async function login(credentials: LoginPayload): Promise<AuthResponse> {
    // GATE
    await fetchCsrfToken()

    // EXECUTE
    const { data } = await api<{ data: AuthResponse }>('/auth/login', {
      method: 'POST',
      body: credentials,
    })

    authStore.setToken(data.token)
    authStore.setUser(data.user)
    authStore.setMsabToken(data.msab_token)

    // Note: fetchBootstrap is NOT called here because the cookie isn't
    // immediately available to the API client in the same request cycle.
    // The bootstrap.client.ts plugin will fetch data after navigation.

    // REACT
    toast.add({ title: 'Welcome back!', color: 'success' })
    return data
  }

  /**
   * Registers a new user with the provided payload.
   *
   * GATE:    Fetch CSRF token
   * EXECUTE: POST /auth/register → update store
   * REACT:   Show success toast
   */
  async function register(payload: RegisterPayload): Promise<AuthResponse> {
    // GATE
    await fetchCsrfToken()

    // EXECUTE
    const { data } = await api<{ data: AuthResponse }>('/auth/register', {
      method: 'POST',
      body: payload,
    })

    authStore.setToken(data.token)
    authStore.setUser(data.user)
    authStore.setMsabToken(data.msab_token)

    // Note: fetchBootstrap is NOT called here because the cookie isn't
    // immediately available to the API client in the same request cycle.
    // The bootstrap.client.ts plugin will fetch data after navigation.

    // REACT
    toast.add({ title: 'Account created!', color: 'success' })
    return data
  }

  /**
   * Logs out the current user.
   * Calls the logout API, clears the store, and redirects to log in.
   * Ignores API errors during logout to ensure local cleanup always happens.
   *
   * EXECUTE: POST /auth/logout → clear store
   * REACT:   Navigate to login page
   */
  async function logout(): Promise<void> {
    try {
      // EXECUTE
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      // Ignore logout errors from API, we still want to clear local state
      log.warn('Logout API error (ignored):', error)
    } finally {
      authStore.logout()
      // REACT
      await navigateTo('/log-in')
    }
  }

  /**
   * Refresh the MSAB JWT to ensure the audio server gets fresh user data.
   * Called before socket pre-connect so the JWT payload matches current DB state.
   * Silent failure — falls back to existing (potentially stale) token.
   *
   * EXECUTE: POST /auth/msab-token/refresh → update store
   */
  async function refreshMsabToken(): Promise<void> {
    try {
      const { data } = await api<{ data: { msab_token: string } }>('/auth/msab-token/refresh', {
        method: 'POST',
      })
      authStore.setMsabToken(data.msab_token)
      log.debug('MSAB token refreshed')
    } catch (err) {
      // Non-blocking — stale JWT is better than no JWT
      log.warn('Failed to refresh MSAB token:', err)
    }
  }

  /**
   * Gets the OAuth redirect URL for a social provider.
   * The frontend should redirect the user to this URL to start the OAuth flow.
   *
   * EXECUTE: GET /auth/social/{provider}/redirect
   */
  async function getSocialRedirectUrl(provider: string): Promise<string> {
    const { data } = await api<{ data: { redirect_url: string } }>(`/auth/social/${provider}/redirect`)
    return data.redirect_url
  }

  // ========================================
  // Return
  // ========================================

  return {
    login,
    register,
    logout,
    refreshMsabToken,
    getSocialRedirectUrl,
  }
}

/**
 * @deprecated Use `useAuthActions()` instead. This alias exists for backward compatibility.
 */
export const useAuth = useAuthActions
