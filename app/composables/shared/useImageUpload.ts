// ========================================
// Image Upload Composable
// ========================================

import { ref } from 'vue'
import type {
  ImageUploadFolder,
  ImageUploadAuthParams,
  ImageUploadResult,
  ImageUploadProgress,
} from '~/types/asset/upload'
import {
  IMAGEKIT_UPLOAD_URL,
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from '~/types/asset/upload'
import { UPLOAD_IMAGE_CAPS } from '~/constants/upload'
import { downscaleImageForUpload } from '~/utils/image-file'


// ========================================
// Types
// ========================================

interface UploadOptions {
  /** Progress callback (0-100) */
  onProgress?: (percent: number) => void
  /** Abort signal for cancellation */
  signal?: AbortSignal
}

// ========================================
// Composable
// ========================================

/**
 * Composable for uploading images to ImageKit CDN.
 * Implements the 3-step flow:
 * 1. Get auth params from backend
 * 2. Upload directly to ImageKit
 * 3. Return URL for API submission
 */
export function useImageUpload() {
  const { api } = useApi()

  // ========================================
  // Validation
  // ========================================

  /**
   * Validates a file before upload.
   * @throws Error if file is invalid
   */
  function validateFile(file: File): void {
    if (!file) {
      throw new Error('No file provided')
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`File size exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`)
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Invalid file type. Allowed: JPG, PNG, WebP')
    }
  }

  // ========================================
  // Downscale
  // ========================================

  /**
   * Shrinks a picked image to its asset class's ceiling before upload.
   *
   * Keyed by `folder` rather than an options argument on purpose: every caller
   * already passes a folder, including the ones going through
   * `createUploadState()`, so no call site has to opt in. Falls back to the
   * original file on any failure — see `downscaleImageForUpload`.
   */
  function prepareForUpload(file: File, folder: ImageUploadFolder): Promise<File> {
    return downscaleImageForUpload(file, UPLOAD_IMAGE_CAPS[folder])
  }

  // ========================================
  // Auth Params
  // ========================================

  /**
   * Gets upload authentication parameters from backend.
   * Rate limited to 10 requests per minute.
   */
  async function getAuthParams(folder: ImageUploadFolder): Promise<ImageUploadAuthParams> {
    const response = await api<{ data: ImageUploadAuthParams }>('/uploads/auth-params', {
      method: 'POST',
      body: { folder, expire_seconds: 300 }, // 5 minutes, well under 1 hour limit
    })



    return response.data
  }

  // ========================================
  // ImageKit Upload
  // ========================================

  /**
   * Uploads a file directly to ImageKit CDN.
   * Supports progress tracking via XMLHttpRequest.
   */
  async function uploadToImageKit(
    file: File,
    authParams: ImageUploadAuthParams,
    options: UploadOptions = {}
  ): Promise<ImageUploadResult> {
    const { onProgress, signal } = options

    // Build FormData
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('folder', authParams.folder)
    formData.append('publicKey', authParams.publicKey)
    formData.append('signature', authParams.signature)
    formData.append('expire', authParams.expire.toString())
    formData.append('token', authParams.token)

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort()
          reject(new Error('Upload cancelled'))
        })
      }

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100)
          onProgress(percent)
        }
      })

      // Success handler
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText)
            resolve({
              fileId: result.fileId,
              url: result.url,
              name: result.name,
              size: result.size,
              width: result.width,
              height: result.height,
            })
          } catch {
            reject(new Error('Invalid response from ImageKit'))
          }
        } else {
          // Extract error message from ImageKit response
          let errorMessage = `Upload failed with status ${xhr.status}`
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            if (errorResponse.message) {
              errorMessage = errorResponse.message
            }
          } catch {
            // Use default error message
          }
          reject(new Error(errorMessage))
        }
      })

      // Error handlers
      xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
      xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))

      // Configure and send
      xhr.open('POST', IMAGEKIT_UPLOAD_URL)
      xhr.timeout = 120_000 // 2 minute timeout for large files
      xhr.send(formData)
    })
  }

  // ========================================
  // Combined Upload
  // ========================================

  /**
   * Complete upload flow: validate → get auth → upload to ImageKit.
   * Returns the uploaded file URL and ID for API submission.
   */
  async function uploadImage(
    file: File,
    folder: ImageUploadFolder,
    options: UploadOptions = {}
  ): Promise<ImageUploadResult> {
    // Validate — against the ORIGINAL file, so the 5MB ceiling still means
    // "what the user may pick", not "what survived the downscale".
    validateFile(file)

    // Shrink to the asset class's ceiling
    const prepared = await prepareForUpload(file, folder)

    // Get auth params
    const authParams = await getAuthParams(folder)

    // Upload to ImageKit
    return uploadToImageKit(prepared, authParams, options)
  }

  // ========================================
  // Reactive Upload State
  // ========================================

  /**
   * Creates a reactive upload state for tracking upload progress.
   * Useful for UI feedback.
   */
  function createUploadState() {
    const state = ref<ImageUploadProgress>({
      status: 'idle',
      progress: 0,
    })

    async function upload(file: File, folder: ImageUploadFolder): Promise<ImageUploadResult | null> {
      state.value = { status: 'uploading', progress: 0 }

      try {
        const result = await uploadImage(file, folder, {
          onProgress: (percent) => {
            state.value = { status: 'uploading', progress: percent }
          },
        })

        state.value = { status: 'success', progress: 100, result }
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        state.value = { status: 'error', progress: 0, error: message }
        return null
      }
    }

    function reset() {
      state.value = { status: 'idle', progress: 0 }
    }

    return {
      state,
      upload,
      reset,
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    validateFile,
    prepareForUpload,
    getAuthParams,
    uploadToImageKit,
    uploadImage,
    createUploadState,
  }
}
