// ========================================
// Image Upload Types
// ========================================

/**
 * Allowed folders for image uploads.
 * Must match backend configuration.
 */
export type ImageUploadFolder =
  | 'avatars'
  | 'covers'
  | 'rooms'
  | 'agencies/logos'
  | 'agencies/national-ids'
  | 'coin-request-proofs'

/**
 * Authentication parameters from backend for ImageKit upload.
 */
export interface ImageUploadAuthParams {
  token: string
  signature: string
  expire: number
  publicKey: string
  folder: string
  urlEndpoint: string
}

/**
 * Result from successful ImageKit upload.
 */
export interface ImageUploadResult {
  fileId: string
  url: string
  name?: string
  size?: number
  width?: number
  height?: number
}

/**
 * Upload progress state.
 */
export interface ImageUploadProgress {
  status: 'idle' | 'uploading' | 'success' | 'error'
  progress: number // 0-100
  error?: string
  result?: ImageUploadResult
}

/**
 * National ID image for agency creation.
 */
export interface NationalIdImage {
  url: string
  file_id: string
  side: 'front' | 'back'
}

// ========================================
// Constants
// ========================================

export const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload'
export const IMAGEKIT_CDN_PREFIX = 'https://ik.imagekit.io/flylive/'

/**
 * Maximum file size in bytes (5MB).
 */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

/**
 * Allowed image MIME types.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
