// ========================================
// OAuth Callback Composable
// ========================================
// Handles the redirect back from social auth providers.
// The backend redirects here with token and msab_token
// as query parameters after successful OAuth flow.

import type { OAuthPopupResult } from '~/composables/auth/useOAuthPopup'
import type { BootstrapUser, LevelStatus } from '~/types/user/bootstrap'
import { createLogger } from '~/utils/logger'

const log = createLogger('[OAuthCallback]')

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
  const levelsStore = useLevelsStore()
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
    const response = await api<{
      data: BootstrapUser
    }>('/auth/user')

    log.debug('User data fetched successfully', { response })
    if (response?.data) {
      authStore.setUser(response.data)
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

    log.debug('OAuth callback processed successfully', { isNew: params.isNew })

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

    log.debug('OAuth popup result processed successfully', { isNew: result.isNew })

    return callbackResult
  }

  // ========================================
  // Return
  // ========================================

  return { handleCallback, handlePopupResult }
}
