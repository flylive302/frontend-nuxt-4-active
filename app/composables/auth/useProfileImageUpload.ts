// ========================================
// useProfileImageUpload — avatar / cover upload orchestrator
// ========================================
// GATE → EXECUTE → REACT wrapper around useProfileActions for the two
// profile image types. The backend deletes the previous CDN file
// (DeleteCdnFileJob) on every change, so no client-side cleanup is needed.

export type ProfileImageType = 'avatar' | 'cover'

export function useProfileImageUpload() {
  const { uploadAvatar, uploadCoverImage } = useProfileActions()
  const toast = useToast()

  const isUploading = ref(false)
  const progress = ref(-1)

  /**
   * Uploads a (cropped) profile image. Returns true on success.
   */
  async function uploadProfileImage(type: ProfileImageType, file: File): Promise<boolean> {
    // GATE — one upload at a time
    if (isUploading.value) return false

    // EXECUTE — ImageKit upload + backend URL persist (via useProfileActions)
    isUploading.value = true
    progress.value = 0
    try {
      const onProgress = (percent: number): void => { progress.value = percent }
      if (type === 'avatar') {
        await uploadAvatar(file, onProgress)
      } else {
        await uploadCoverImage(file, onProgress)
      }
      return true
    } catch {
      // REACT — failure feedback
      toast.add({
        title: 'Upload Failed',
        description: `Failed to upload ${type === 'avatar' ? 'profile picture' : 'cover image'}. Please try again.`,
        color: 'error',
      })
      return false
    } finally {
      isUploading.value = false
      progress.value = -1
    }
  }

  return { isUploading, progress, uploadProfileImage }
}
