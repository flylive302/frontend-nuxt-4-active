// ========================================
// Auth Actions Composable
// ========================================
// Handles authentication actions: login, register, logout, social redirect, MSAB token refresh.
// Profile management is in useProfileActions.ts.

import type {
  AuthResponse,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from '~/types/user/auth'
import { Capacitor } from '@capacitor/core'
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
  const { api, fetchCsrfToken, normalizeError } = _api
  const toast = _toast
  const { handlePopupResult } = useOAuthCallback()

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
  async function login(credentials: LoginPayload, redirectTo?: string): Promise<AuthResponse | null> {
    // SETUP — infrastructure prerequisite, not a validation gate
    await fetchCsrfToken()

    // EXECUTE
    let data: AuthResponse
    try {
      const res = await api<{ data: AuthResponse }>('/auth/login', {
        method: 'POST',
        body: credentials,
      })
      data = res.data
    } catch (err) {
      // Unverified account: the backend re-sent a fresh OTP. Route to the
      // verification screen instead of surfacing an error (REACT).
      if (normalizeError(err).errorCode === 'EMAIL_NOT_VERIFIED') {
        await navigateTo({ path: '/verify-email', query: { email: credentials.email } })
        return null
      }
      throw err
    }

    authStore.setToken(data.token)
    authStore.setUser(data.user)
    authStore.setMsabToken(data.msab_token)

    // REACT
    if (toast) toast.add({ title: 'Welcome back!', color: 'success' })
    // Fire-and-forget — non-fatal if push permission denied
    usePushSubscription().register().catch(() => {})
    if (redirectTo) {
      await navigateTo(redirectTo)
    }
    return data
  }

  /**
   * Registers a new user. No token is issued yet — the account is created
   * unverified and an email OTP is sent. Routes to the verification screen.
   *
   * SETUP:   Fetch CSRF token
   * EXECUTE: POST /auth/register
   * REACT:   Toast + navigate to /verify-email
   */
  async function register(payload: RegisterPayload): Promise<RegisterResponse> {
    // SETUP
    await fetchCsrfToken()

    // EXECUTE
    const { data } = await api<{ data: RegisterResponse }>('/auth/register', {
      method: 'POST',
      body: payload,
    })

    // REACT
    if (toast) toast.add({ title: 'Check your email for a verification code.', color: 'success' })
    await navigateTo({ path: '/verify-email', query: { email: data.email } })
    return data
  }

  /**
   * Verifies the email OTP. On success the account is logged in (tokens issued)
   * and routed into profile completion.
   *
   * SETUP:   Fetch CSRF token
   * EXECUTE: POST /auth/email/verify → update store
   * REACT:   Toast + navigate
   */
  async function verifyEmail(payload: VerifyEmailPayload, redirectTo = '/complete-profile-data'): Promise<AuthResponse> {
    await fetchCsrfToken()

    const { data } = await api<{ data: AuthResponse }>('/auth/email/verify', {
      method: 'POST',
      body: payload,
    })

    authStore.setToken(data.token)
    authStore.setUser(data.user)
    authStore.setMsabToken(data.msab_token)

    if (toast) toast.add({ title: 'Email verified!', color: 'success' })
    usePushSubscription().register().catch(() => {})
    await navigateTo(redirectTo)
    return data
  }

  /**
   * Resends the email verification OTP. Always resolves — the backend never
   * reveals whether the email exists.
   *
   * EXECUTE: POST /auth/email/resend
   */
  async function resendVerificationCode(email: string): Promise<void> {
    await fetchCsrfToken()
    await api('/auth/email/resend', { method: 'POST', body: { email } })
  }

  /**
   * Requests a password-reset OTP for the given email.
   *
   * EXECUTE: POST /auth/password/forgot
   */
  async function requestPasswordReset(payload: ForgotPasswordPayload): Promise<void> {
    await fetchCsrfToken()
    await api('/auth/password/forgot', { method: 'POST', body: payload })
  }

  /**
   * Resets the password using a valid OTP code.
   *
   * EXECUTE: POST /auth/password/reset
   */
  async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await fetchCsrfToken()
    await api('/auth/password/reset', { method: 'POST', body: payload })
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
    // Fire-and-forget — unregister push before clearing auth
    usePushSubscription().unregister().catch(() => {})
    try {
      // EXECUTE
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      log.warn('Logout API call failed, clearing local state anyway', error)
    } finally {
      // Clear room session state too — otherwise the persisted `minimizedRoom`
      // snapshot survives logout in localStorage and the mini-player bubble
      // reappears on the next login (stale "tap to rejoin"). Setting currentRoom
      // null also drives the lifecycle watcher's audio teardown.
      useRoomSession().leaveRoom()
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
        return true
      } catch (err) {
        log.warn('Failed to refresh MSAB token', err)
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
    // Native (Capacitor): open the real system browser and let the result come
    // back via a custom-scheme deep link. The web popup/redirect flow below is
    // left byte-for-byte unchanged (ADR 0011).
    if (Capacitor.isNativePlatform()) {
      await useNativeSocialAuth().launch(provider)
      return
    }

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
    verifyEmail,
    resendVerificationCode,
    requestPasswordReset,
    resetPassword,
    logout,
    refreshMsabToken,
    startSocialLogin,
  }
}
