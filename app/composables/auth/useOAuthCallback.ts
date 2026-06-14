// ========================================
// OAuth Callback Composable
// ========================================
// Handles the redirect back from social auth providers.
// The backend redirects here with token and msab_token
// as query parameters after successful OAuth flow.

import type { OAuthPopupResult } from '~/composables/auth/useOAuthPopup'
import type { BootstrapUser } from '~/types/user/bootstrap'


export interface OAuthCallbackParams {
  token?: string
  msabToken?: string
  error?: string
  isNew: boolean
}

export interface OAuthCallbackResult {
  success: boolean
  error?: string
  redirectTo: string
}

export function useOAuthCallback() {
  // ========================================
  // Dependencies
  // ========================================

  const authStore = useAuthStore()
  const toast = useToast()
  const { api } = useApi()

  // ========================================
  // Shared Helpers
  // ========================================

  /**
   * Store tokens, fetch user data, seed stores, show toast.
   * Shared by both redirect-flow (handleCallback) and popup-flow (handlePopupResult).
   */
  async function storeTokensAndFetchUser(
    token: string,
    msabToken?: string,
    isNew: boolean = false,
  ): Promise<OAuthCallbackResult> {
    // EXECUTE — store tokens first so the api() interceptor picks them up
    authStore.setToken(token)
    if (msabToken) {
      authStore.setMsabToken(msabToken)
    }

    // The api() interceptor reads authStore.token as a fallback when
    // the cookie isn't available yet, so this works in the same tick.
    let userData: BootstrapUser | undefined
    try {
      const response = await api<{ data: BootstrapUser }>('/auth/user')
      userData = response?.data
    } catch {
      // Backend rejected the token — clear partial auth state rather than
      // leaving a bad token in the store.
      authStore.logout()
      return { success: false, error: 'Sign-in failed. Please try again.', redirectTo: '/log-in' }
    }

    if (userData) {
      authStore.setUser(userData)
    }

    // REACT — success toast
    toast.add({
      title: isNew ? 'Account created!' : 'Welcome back!',
      color: 'success',
    })

    return {
      success: true,
      redirectTo: isNew ? '/complete-profile-data' : '/',
    }
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Process the OAuth callback parameters (redirect-flow).
   *
   * GATE: Validate callback params (error, token presence)
   * EXECUTE: Store tokens and fetch user data via api()
   * REACT: Show success toast
   *
   * Returns a result object — the caller (page) decides navigation.
   */
  async function handleCallback(params: OAuthCallbackParams): Promise<OAuthCallbackResult> {
    // GATE — validate callback params
    if (params.error) {
      return { success: false, error: params.error, redirectTo: '/log-in' }
    }

    if (!params.token) {
      return { success: false, error: 'Authentication failed. No token received.', redirectTo: '/log-in' }
    }

    const result = await storeTokensAndFetchUser(params.token, params.msabToken, params.isNew)


    return result
  }

  /**
   * Process the OAuth result from a popup postMessage (popup-flow).
   *
   * Called from the main app window after receiving credentials
   * from the popup — the main app never unloaded, so bootstrap
   * and asset downloads continue uninterrupted.
   *
   * GATE:    Validate popup result (error, token presence)
   * EXECUTE: Store tokens + fetch user data
   * REACT:   Show success toast
   */
  async function handlePopupResult(result: OAuthPopupResult): Promise<OAuthCallbackResult> {
    // GATE — validate popup result
    if (result.error) {
      return { success: false, error: result.error, redirectTo: '/log-in' }
    }

    if (!result.token) {
      return { success: false, error: 'Authentication failed. No token received.', redirectTo: '/log-in' }
    }

    const callbackResult = await storeTokensAndFetchUser(result.token, result.msabToken, result.isNew)


    return callbackResult
  }

  /**
   * Exchange a single-use native callback code for the session credentials,
   * then reuse the validated redirect-flow path (native-flow).
   *
   * The session token never travels in the deep-link URL on native — only an
   * opaque, single-use `code`. We POST it to /auth/social/exchange for the real
   * credentials, then feed them through `handleCallback` so the credential layer
   * (token-presence GATE → store → fetch user) is shared verbatim with web.
   *
   * `is_new` from the exchange is a real JSON boolean (not the `'true'` string
   * the URL/popup flows carry) — pass it through directly.
   *
   * EXECUTE: POST /auth/social/exchange → handleCallback
   */
  async function handleExchangeCode(code: string): Promise<OAuthCallbackResult> {
    let data: { token: string; msab_token: string | null; is_new: boolean }
    try {
      const res = await api<{ data: { token: string; msab_token: string | null; is_new: boolean } }>(
        '/auth/social/exchange',
        { method: 'POST', body: { code } },
      )
      data = res.data
    } catch {
      return { success: false, error: 'Sign-in failed. Please try again.', redirectTo: '/log-in' }
    }

    return handleCallback({
      token: data.token,
      msabToken: data.msab_token ?? undefined,
      isNew: data.is_new,
    })
  }

  // ========================================
  // Return
  // ========================================

  return { handleCallback, handlePopupResult, handleExchangeCode }
}
