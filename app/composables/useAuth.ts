// ========================================
// Imports & Types
// ========================================
import type { AuthResponse, User, LoginPayload, RegisterPayload, UpdateProfilePayload } from '~/types/auth'

// ========================================
// Composable
// ========================================
export function useAuth() {
  // ========================================
  // Composables / Injected Dependencies
  // ========================================
  const authStore = useAuthStore()
  const { api } = useApi()
  const toast = useToast()
  const config = useRuntimeConfig()

  // ========================================
  // Business Logic / Core Logic
  // ========================================

  /**
   * Fetches the CSRF token from the backend.
   * Required before making state-modifying requests (POST, PUT, DELETE).
   */
  async function fetchCsrfToken(): Promise<void> {
    // Remove /api from the end of apiBase to get the root URL
    // We cast to string because we know apiBase is defined in nuxt.config
    const backendUrl = (config.public.apiBase as string).replace(/\/api\/.*$/, '')

    await api(`${backendUrl}/sanctum/csrf-cookie`, {
      method: 'GET',
    })
  }

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

    toast.add({ title: 'Account created!', color: 'success' })
    return data
  }

  /**
   * Logs out the current user.
   * Calls the logout API, clears the store, and redirects to login.
   * Ignores API errors during logout to ensure local cleanup always happens.
   */
  async function logout(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch (error) {
      // Ignore logout errors from API, we still want to clear local state
      console.error('Logout API error (ignored):', error)
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
   * @param file - The image file to upload.
   * @returns The updated user data (or specific avatar response if needed).
   */
  async function uploadAvatar(file: File): Promise<User> {
      await fetchCsrfToken()

      const formData = new FormData()
      formData.append('avatar', file)

      const { data } = await api<{ data: User }>('/profile/avatar', {
          method: 'POST',
          body: formData,
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
