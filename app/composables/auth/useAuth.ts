// ========================================
// Auth Actions Composable
// ========================================
// Handles authentication actions: login, register, logout, social redirect, MSAB token refresh.
// Profile management is in useProfileActions.ts.

import type { AuthResponse, LoginPayload, RegisterPayload } from '~/types/user/auth'
import { createLogger } from '~/utils/logger'

const log = createLogger('[Auth]')

/** Module-level promise for MSAB token refresh deduplication.
 *  Multiple watchers may call refreshMsabToken() simultaneously (visibility + reconnect);
 *  this ensures only one HTTP request is in-flight at a time. */
let _refreshPromise: Promise<boolean> | null = null

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
   * SETUP:   Fetch CSRF token
   * EXECUTE: POST /auth/login → update store
   * REACT:   Show success toast, navigate if redirectTo provided
   */
  async function login(credentials: LoginPayload, redirectTo?: string): Promise<AuthResponse> {
    // SETUP — infrastructure prerequisite, not a validation gate
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
    if (redirectTo) {
      await navigateTo(redirectTo)
    }
    return data
  }

  /**
   * Registers a new user with the provided payload.
   *
   * SETUP:   Fetch CSRF token
   * EXECUTE: POST /auth/register → update store
   * REACT:   Show success toast, navigate if redirectTo provided
   */
  async function register(payload: RegisterPayload, redirectTo?: string): Promise<AuthResponse> {
    // SETUP — infrastructure prerequisite, not a validation gate
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
    if (redirectTo) {
      await navigateTo(redirectTo)
    }
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
   *
   * Returns true on success, false on failure.
   * Deduplicated: concurrent calls share the same in-flight promise.
   * Silent failure — falls back to existing (potentially stale) token.
   *
   * EXECUTE: POST /auth/msab-token/refresh → update store
   */
  async function refreshMsabToken(): Promise<boolean> {
    // Dedup: if a refresh is already in-flight, piggyback on it
    if (_refreshPromise) return _refreshPromise

    _refreshPromise = (async () => {
      try {
        const { data } = await api<{ data: { msab_token: string } }>('/auth/msab-token/refresh', {
          method: 'POST',
        })
        authStore.setMsabToken(data.msab_token)
        log.debug('MSAB token refreshed')
        return true
      } catch (err) {
        // Non-blocking — stale JWT (now 30-day lifetime) is better than no JWT
        log.warn('Failed to refresh MSAB token:', err)
        return false
      } finally {
        _refreshPromise = null
      }
    })()

    return _refreshPromise
  }

  /**
   * Starts the social login flow by fetching the OAuth redirect URL
   * and redirecting the user to the provider.
   *
   * EXECUTE: GET /auth/social/{provider}/redirect → window redirect
   * REACT:   Show error toast if redirect fails
   */
  async function startSocialLogin(provider: string): Promise<void> {
    try {
      const { data } = await api<{ data: { redirect_url: string } }>(`/auth/social/${provider}/redirect`)
      window.location.href = data.redirect_url
    } catch {
      toast.add({ title: `Failed to connect with ${provider}`, color: 'error' })
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    login,
    register,
    logout,
    refreshMsabToken,
    startSocialLogin,
  }
}

/**
 * @deprecated Use `useAuthActions()` instead. This alias exists for backward compatibility.
 */
export const useAuth = useAuthActions
