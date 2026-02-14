// ========================================
// Imports & Types
// ========================================
import type { AuthResponse, User, LoginPayload, RegisterPayload, UpdateProfilePayload } from '~/types/user/auth'
import { createLogger } from '~/utils/logger'

const log = createLogger('[Auth]')

// ========================================
// Composable
// ========================================
export function useAuth() {
  // ========================================
  // Composables / Injected Dependencies
  // ========================================
  const authStore = useAuthStore()
  const { api, fetchCsrfToken } = useApi()
  const toast = useToast()

  /**
   * Authenticates a user with the provided credentials.
   * Fetches CSRF token, performs login, updates store, and shows success toast.
   * @param credentials - The user's login credentials.
   * @returns The auth response data if successful.
   */
  async function login(credentials: LoginPayload): Promise<AuthResponse> {
    await fetchCsrfToken()

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

    toast.add({ title: 'Welcome back!', color: 'success' })
    return data
  }

  /**
   * Registers a new user with the provided payload.
   * Fetches CSRF token, performs registration, updates store, and shows success toast.
   * @param payload - The registration data.
   * @returns The auth response data if successful.
   */
  async function register(payload: RegisterPayload): Promise<AuthResponse> {
    await fetchCsrfToken()

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

    toast.add({ title: 'Account created!', color: 'success' })
    return data
  }

  /**
   * Logs out the current user.
   * Calls the logout API, clears the store, and redirects to log in.
   * Ignores API errors during logout to ensure local cleanup always happens.
   */
  async function logout(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      // Ignore logout errors from API, we still want to clear local state
      log.warn('Logout API error (ignored):', error)
    } finally {
      authStore.logout()
      await navigateTo('/log-in')
    }
  }

  /**
   * Updates the user's profile information.
   * @param payload - The profile data to update.
   * @returns The updated user data.
   */
  async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
    await fetchCsrfToken()

    const { data } = await api<{ data: User }>('/profile', {
      method: 'PUT',
      body: payload,
    })

    authStore.setUser(data)
    toast.add({ title: 'Profile updated', color: 'success' })
    return data
  }

  /**
   * Uploads and updates the user's profile avatar.
   * Uses ImageKit CDN for direct client-side upload with progress tracking.
   *
   * @param file - The image file to upload.
   * @param onProgress - Optional callback for upload progress (0-100).
   * @returns The updated user data.
   */
  async function uploadAvatar(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<User> {
    // Step 1: Upload to ImageKit CDN
    const { uploadImage } = useImageUpload()
    const result = await uploadImage(file, 'avatars', { onProgress })

    // Step 2: Submit URL to API (PUT method per migration guide)
    await fetchCsrfToken()
    const { data } = await api<{ data: User }>('/profile/avatar', {
      method: 'PUT',
      body: {
        url: result.url,
        file_id: result.fileId,
      },
    })

    authStore.setUser(data)
    toast.add({ title: 'Avatar updated successfully', color: 'success' })
    return data
  }

  return {
    login,
    register,
    logout,
    updateProfile,
    uploadAvatar,
  }
}
