// ========================================
// OAuth Callback Composable
// ========================================
// Handles the redirect back from social auth providers.
// The backend redirects here with token and msab_token
// as query parameters after successful OAuth flow.

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
  // Actions
  // ========================================

  /**
   * Process the OAuth callback parameters.
   *
   * GATE:    Validate callback params (error, token presence)
   * EXECUTE: Store tokens + fetch user data via api()
   * REACT:   Show success toast
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

    // EXECUTE — store tokens first so the api() interceptor picks them up
    authStore.setToken(params.token)
    if (params.msabToken) {
      authStore.setMsabToken(params.msabToken)
    }

    // The api() interceptor reads authStore.token as a fallback when
    // the cookie isn't available yet, so this works in the same tick.
    const response = await api<{ data: { user: import('~/types/user/bootstrap').BootstrapUser; user_data: { levels?: { wealth: import('~/types/user/bootstrap').LevelStatus; charm: import('~/types/user/bootstrap').LevelStatus } } } }>('/bootstrap')

    if (response?.data?.user) {
      authStore.setUser(response.data.user)
      if (response.data.user_data?.levels) {
        levelsStore.setLevels(response.data.user_data.levels.wealth, response.data.user_data.levels.charm)
      }
    }

    // REACT — success toast
    toast.add({
      title: params.isNew ? 'Account created!' : 'Welcome back!',
      color: 'success',
    })

    log.debug('OAuth callback processed successfully', { isNew: params.isNew })

    return {
      success: true,
      redirectTo: params.isNew ? '/complete-profile-data' : '/',
    }
  }

  // ========================================
  // Return
  // ========================================

  return { handleCallback }
}
