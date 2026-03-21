// ========================================
// OAuth Callback Composable
// ========================================
// Handles the redirect back from social auth providers.
// The backend redirects here with token and msab_token
// as query parameters after successful OAuth flow.
//
// NOTE: We can't use bootstrapStore.fetchBootstrap() here because the API
// client reads the token from useCookie('sanctum_token'), which isn't
// available in the same tick after setToken(). Instead, we make a direct
// fetch with the Bearer token in the Authorization header.

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

  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const levelsStore = useLevelsStore()
  const toast = useToast()

  // ========================================
  // Actions
  // ========================================

  /**
   * Process the OAuth callback parameters.
   *
   * GATE:    Validate callback params (error, token presence)
   * EXECUTE: Store tokens + fetch user data via direct $fetch
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

    // EXECUTE — store tokens and fetch user data
    authStore.setToken(params.token)
    if (params.msabToken) {
      authStore.setMsabToken(params.msabToken)
    }

    const apiBase = config.public.apiBase as string
    const response = await $fetch<{ data: { user: import('~/types/user/bootstrap').BootstrapUser; user_data: { levels?: { wealth: import('~/types/user/bootstrap').LevelStatus; charm: import('~/types/user/bootstrap').LevelStatus } } } }>(`${apiBase}/bootstrap`, {
      headers: {
        Authorization: `Bearer ${params.token}`,
        Accept: 'application/json',
      },
      credentials: 'include',
    })

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
