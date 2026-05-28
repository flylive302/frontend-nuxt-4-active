// ========================================
// Profile Actions Composable
// ========================================
// Handles profile updates, avatar uploads, and cover image uploads.
// Extracted from useAuth.ts per ARCHITECTURE.md:
// "Auth actions and profile updates are separate domains."

import type { User, UpdateProfilePayload } from '~/types/user/auth'
import type { ProfileSyncFields } from '~/types/user/profile-sync'
import { createLogger } from '~/utils/logger'

const log = createLogger('[ProfileActions]')

export function useProfileActions() {
  // ========================================
  // Dependencies
  // ========================================

  const authStore = useAuthStore()
  const { api, fetchCsrfToken } = useApi()
  const toast = useToast()
  const { socket: audioSocket } = useAudioSocket()

  // ========================================
  // Actions
  // ========================================

  /**
   * Updates the user's profile information.
   *
   * SETUP:   Fetch CSRF token
   * EXECUTE: PUT /profile → update store
   * REACT:   Push socket sync, show toast
   */
  async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
    // SETUP
    await fetchCsrfToken()

    // EXECUTE
    const { data } = await api<{ data: User }>('/profile', {
      method: 'PUT',
      body: payload,
    })

    authStore.setUser(data)

    // REACT
    emitProfileSync({
      name: data.name,
      signature: data.signature ?? undefined,
      avatar: data.avatar ?? undefined,
      frame_id: data.frame_id ?? null,
      chat_bubble_id: data.chat_bubble_id ?? null,
      entry_animation_id: data.entry_animation_id ?? null,
      data_card_id: data.data_card_id ?? null,
      mice_wave_id: data.mice_wave_id ?? null,
      slides_id: data.slides_id ?? null,
      gender: data.gender ?? undefined,
    })

    toast.add({ title: 'Profile updated', color: 'success' })
    return data
  }

  /**
   * Uploads and updates the user's profile avatar.
   * Uses ImageKit CDN for direct client-side upload with progress tracking.
   *
   * SETUP:   Fetch CSRF token
   * EXECUTE: Upload to ImageKit CDN → PUT /profile/avatar → update store
   * REACT:   Push socket sync, show toast
   */
  async function uploadAvatar(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<User> {
    // SETUP
    await fetchCsrfToken()

    // EXECUTE — Step 1: Upload to ImageKit CDN
    const { uploadImage } = useImageUpload()
    const result = await uploadImage(file, 'avatars', { onProgress })

    // EXECUTE — Step 2: Submit URL to API
    const { data } = await api<{ data: User }>('/profile/avatar', {
      method: 'PUT',
      body: {
        url: result.url,
        file_id: result.fileId,
      },
    })

    authStore.setUser(data)

    // REACT
    emitProfileSync({ avatar: data.avatar ?? undefined })
    toast.add({ title: 'Avatar updated successfully', color: 'success' })
    return data
  }

  /**
   * Uploads and updates the user's profile cover image.
   * Uses ImageKit CDN for direct client-side upload with progress tracking.
   *
   * SETUP:   Fetch CSRF token
   * EXECUTE: Upload to ImageKit CDN → PUT /profile/cover-image → update store
   * REACT:   Show toast
   */
  async function uploadCoverImage(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<User> {
    // SETUP
    await fetchCsrfToken()

    // EXECUTE — Step 1: Upload to ImageKit CDN
    const { uploadImage } = useImageUpload()
    const result = await uploadImage(file, 'covers', { onProgress })

    // EXECUTE — Step 2: Submit URL to API
    const { data } = await api<{ data: User }>('/profile/cover-image', {
      method: 'PUT',
      body: {
        url: result.url,
        file_id: result.fileId,
      },
    })

    authStore.setUser(data)

    // REACT
    toast.add({ title: 'Cover image updated successfully', color: 'success' })
    return data
  }

  // ========================================
  // Helpers
  // ========================================

  /**
   * Push updated profile fields directly through the audio socket.
   * Provides instant room propagation without waiting for the queued
   * Laravel → SNS/HTTP → MSAB pipeline.
   *
   * Best-effort / fire-and-forget — silent on failure.
   */
  function emitProfileSync(fields: ProfileSyncFields): void {
    try {
      if (!audioSocket.value?.connected) return

      audioSocket.value.emit('user:profileSync', { profile: fields })
    } catch {
      // Silent — Laravel SyncProfileToMsab provides cross-region consistency.
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    updateProfile,
    uploadAvatar,
    uploadCoverImage,
    emitProfileSync,
  }
}
