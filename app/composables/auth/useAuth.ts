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

// ============================================
// Cached Dependencies (Module-level)
// ============================================
let _authStore: ReturnType<typeof useAuthStore> | null = null
let _api: ReturnType<typeof useApi> | null = null
let _toast: ReturnType<typeof useToast> | null = null

export function useAuthActions() {
  // ========================================
  // Dependencies
  // ========================================
  if (!_authStore) _authStore = useAuthStore()
  if (!_api) _api = useApi()
  try {
    if (!_toast) _toast = useToast()
  } catch {
    // Silent catch for useToast outside setup
  }

  const authStore = _authStore
  const { api, fetchCsrfToken } = _api
  const toast = _toast

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

    log.debug('Login successful:', data)

    authStore.setToken(data.token)
    authStore.setUser(data.user)
    authStore.setMsabToken(data.msab_token)

    // REACT
    if (toast) toast.add({ title: 'Welcome back!', color: 'success' })
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

    log.debug('Registration successful:', data)

    authStore.setToken(data.token)
    authStore.setUser(data.user)
    authStore.setMsabToken(data.msab_token)

    // Note: fetchBootstrap is NOT called here because the cookie isn't
    // immediately available to the API client in the same request cycle.
    // The bootstrap.client.ts plugin will fetch data after navigation.

    // REACT
    if (toast) toast.add({ title: 'Account created!', color: 'success' })
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
   * and opening the auth provider in a popup window.
   *
   * Desktop: Popup keeps the main app alive (bootstrap + assets continue).
   * Mobile/blocked: Falls back to window.location.href redirect.
   *
   * EXECUTE: GET /auth/social/{provider}/redirect → open popup or redirect
   * REACT:   On popup result → store tokens, fetch user, navigate
   */
  async function startSocialLogin(provider: string): Promise<void> {
    try {
      const { data } = await api<{ data: { redirect_url: string } }>(`/auth/social/${provider}/redirect`)

      // Try popup first (keeps main app alive)
      const { openPopup, listenForResult } = useOAuthPopup()
      const popup = openPopup(data.redirect_url)

      if (!popup) {
        // Fallback: popup blocked → redirect (mobile, strict browsers)
        window.location.href = data.redirect_url
        return
      }

      // Listen for OAuth result from popup
      const { handlePopupResult } = useOAuthCallback()

      listenForResult(
        popup,
        // onResult — popup sent credentials
        async (popupResult) => {

          const callbackResult = await handlePopupResult(popupResult)

          if (!callbackResult.success) {
            if (toast) toast.add({ title: callbackResult.error ?? 'Authentication failed', color: 'error' })
            return
          }

          // Navigate to home or profile completion
          await navigateTo(callbackResult.redirectTo, { replace: true })
        },
        // onCancel — user closed the popup
        () => {
          // Silent — user intentionally closed the popup
        },
      )
    } catch {
      if (toast) toast.add({ title: `Failed to connect with ${provider}`, color: 'error' })
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
