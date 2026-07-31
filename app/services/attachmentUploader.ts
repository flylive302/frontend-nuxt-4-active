// ========================================
// DM Attachment Uploader (dm-messenger-v2/01)
// ========================================
// Framework-free: no Vue reactivity, no store imports. Pick/validate →
// canvas downscale → signed ImageKit upload → server finalize. The
// network transport is injected so this module stays independently
// testable (mocked transport, prior art: composable service mocks).

import type { DmAttachmentUploadAuth, MediaContentPayload, VoiceContentPayload } from '~/types/inbox'
import {
  DM_IMAGE_ALLOWED_MIME_TYPES,
  DM_IMAGE_COMPRESS_QUALITY,
  DM_IMAGE_DOWNSCALE_LONG_EDGE_PX,
  DM_IMAGE_MAX_BYTES,
  DM_VOICE_MAX_BYTES,
  DM_VOICE_MAX_DURATION_MS,
} from '~/constants/inbox'
import { downscaleImageToBlob } from '~/utils/image-file'

// ========================================
// Types
// ========================================

export interface DownscaleResult {
  blob: Blob
  width: number
  height: number
}

export interface FinalizeInput {
  url: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
}

export interface FinalizeVoiceInput {
  url: string
  mimeType: string
  sizeBytes: number
  durationMs: number
}

export interface UploadProgressHandler {
  (loaded: number, total: number): void
}

/** Injected network transport — lets this module stay Nuxt-free and testable. */
export interface DmAttachmentTransport {
  getUploadAuth: () => Promise<DmAttachmentUploadAuth>
  finalize: (input: FinalizeInput) => Promise<MediaContentPayload>
  /** Voice-note finalize — separate endpoint contract (kind + durationMs). */
  finalizeVoice?: (input: FinalizeVoiceInput) => Promise<VoiceContentPayload>
  /**
   * Overridable for tests; defaults to a direct ImageKit XHR POST that
   * reports progress and honors an AbortSignal.
   */
  uploadToImageKit?: (
    blob: Blob,
    auth: DmAttachmentUploadAuth,
    opts?: { onProgress?: UploadProgressHandler, signal?: AbortSignal },
  ) => Promise<{ url: string }>
}

// ========================================
// GATE — pick-time validation
// ========================================

/** Returns an error message, or null if the file is acceptable. */
export function validateImageFile(file: File): string | null {
  if (!file) return 'No file selected.'
  if (!(DM_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported image type. Use JPG, PNG, or WebP.'
  }
  if (file.size > DM_IMAGE_MAX_BYTES) {
    return `Image exceeds the ${DM_IMAGE_MAX_BYTES / 1024 / 1024}MB limit.`
  }
  return null
}

/** Returns an error message, or null if the voice recording is acceptable. */
export function validateVoiceRecording(blob: Blob, durationMs: number): string | null {
  if (!blob || blob.size === 0) return 'No recording captured.'
  if (blob.size > DM_VOICE_MAX_BYTES) {
    return `Voice note exceeds the ${DM_VOICE_MAX_BYTES / 1024 / 1024}MB limit.`
  }
  if (durationMs <= 0) return 'Recording was too short.'
  if (durationMs > DM_VOICE_MAX_DURATION_MS) {
    return `Voice note exceeds the ${DM_VOICE_MAX_DURATION_MS / 1000}s limit.`
  }
  return null
}

// ========================================
// EXECUTE — downscale
// ========================================

/**
 * Downscales an image to a long-edge cap via canvas, re-encoding as JPEG.
 * No-ops (returns original dimensions) if already within the cap.
 *
 * The canvas work itself lives in `~/utils/image-file` so the DM path and the
 * `useImageUpload` path share one implementation. DM's caps stay explicit
 * arguments here — this path's behaviour is unchanged.
 */
export function downscaleImage(
  file: File,
  maxLongEdge: number = DM_IMAGE_DOWNSCALE_LONG_EDGE_PX,
): Promise<DownscaleResult> {
  return downscaleImageToBlob(file, {
    maxLongEdge,
    quality: DM_IMAGE_COMPRESS_QUALITY,
    preserveAlpha: false,
  })
}

// ========================================
// EXECUTE — upload
// ========================================

/**
 * XHR (not fetch) is the pragmatic choice here — it's the only browser
 * primitive that reports upload progress and supports abort via signal.
 */
function defaultUploadToImageKit(
  blob: Blob,
  auth: DmAttachmentUploadAuth,
  opts?: { onProgress?: UploadProgressHandler, signal?: AbortSignal },
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', blob, auth.fileName)
    formData.append('fileName', auth.fileName)
    formData.append('folder', auth.folder)
    formData.append('publicKey', auth.publicKey)
    formData.append('signature', auth.signature)
    formData.append('expire', String(auth.expire))
    formData.append('token', auth.token)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts?.onProgress?.(e.loaded, e.total)
    }
    xhr.onerror = () => reject(new Error('ImageKit upload failed (network error).'))
    xhr.onabort = () => reject(new DOMException('Upload aborted.', 'AbortError'))
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`ImageKit upload failed with status ${xhr.status}`))
        return
      }
      try {
        const json = JSON.parse(xhr.responseText) as { url: string }
        resolve({ url: json.url })
      }
      catch {
        reject(new Error('ImageKit upload returned an unparseable response.'))
      }
    }

    if (opts?.signal) {
      if (opts.signal.aborted) {
        xhr.abort()
        return
      }
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })
}

/** Retries a flaky ImageKit upload attempt once (auth + finalize are not retried here). */
async function uploadWithRetry(
  blob: Blob,
  auth: DmAttachmentUploadAuth,
  transport: DmAttachmentTransport,
  opts?: { onProgress?: UploadProgressHandler, signal?: AbortSignal },
): Promise<{ url: string }> {
  const uploadFn = transport.uploadToImageKit ?? defaultUploadToImageKit
  try {
    return await uploadFn(blob, auth, opts)
  }
  catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (opts?.signal?.aborted) throw err
    return uploadFn(blob, auth, opts)
  }
}

/**
 * Uploads an already-downscaled blob: auth → upload (1 auto-retry, progress,
 * cancelable) → finalize. Kept separate from `downscaleImage` so a manual
 * retry (composer-driven) can reuse the compressed blob without re-encoding.
 */
export async function uploadCompressed(
  result: DownscaleResult,
  transport: DmAttachmentTransport,
  opts?: { onProgress?: UploadProgressHandler, signal?: AbortSignal },
): Promise<MediaContentPayload> {
  const { blob, width, height } = result
  const auth = await transport.getUploadAuth()
  const { url } = await uploadWithRetry(blob, auth, transport, opts)

  return transport.finalize({
    url,
    mimeType: blob.type || 'image/jpeg',
    sizeBytes: blob.size,
    width,
    height,
  })
}

/**
 * Uploads a recorded voice blob: auth → upload (1 auto-retry, progress,
 * cancelable) → finalizeVoice. Mirrors `uploadCompressed` but skips the
 * image-only downscale step and carries `durationMs`.
 */
export async function uploadVoice(
  blob: Blob,
  mimeType: string,
  durationMs: number,
  transport: DmAttachmentTransport,
  opts?: { onProgress?: UploadProgressHandler, signal?: AbortSignal },
): Promise<VoiceContentPayload> {
  if (!transport.finalizeVoice) throw new Error('Voice transport not configured.')

  const auth = await transport.getUploadAuth()
  const { url } = await uploadWithRetry(blob, auth, transport, opts)

  return transport.finalizeVoice({
    url,
    mimeType,
    sizeBytes: blob.size,
    durationMs,
  })
}

// ========================================
// Orchestrator
// ========================================

/**
 * Full pick→send pipeline for a DM image attachment. GATE (validate) →
 * EXECUTE (downscale, upload, finalize) → returns the typed payload the
 * caller sends as a `media`-kind message.
 */
export async function uploadDmImage(file: File, transport: DmAttachmentTransport): Promise<MediaContentPayload> {
  // GATE
  const error = validateImageFile(file)
  if (error) throw new Error(error)

  // EXECUTE
  const result = await downscaleImage(file)
  return uploadCompressed(result, transport)
}
