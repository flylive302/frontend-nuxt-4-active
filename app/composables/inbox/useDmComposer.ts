// ========================================
// DM Composer State Machine (dm-messenger-v2/02)
// ========================================
// Orchestrates the image pick → validate → upload → send pipeline as an
// explicit one-state-at-a-time machine: idle → picking → uploading →
// sending → idle. Illegal transitions are no-ops (logged), never thrown —
// callers (message-input/message-bubble) fire intents without needing to
// know the current state.
//
// GATE:    validateImageFile (pick-time reject, no upload starts)
// EXECUTE: downscale once, upload (attachmentUploader owns the 1 auto-retry)
//          + finalize, then POST the message
// REACT:   toast on terminal failure; store mutations are the "side effect"
//          surface here since this composable *is* the orchestrator for
//          this action (per CLAUDE.md, composables may write stores in EXECUTE)

import { createLogger } from '~/utils/logger'
import type { DmAttachmentUploadAuthResponse, DmAttachmentFinalizeResponse, DmVoiceFinalizeResponse, SendMessageResponse } from '~/types/inbox'
import {
  validateImageFile,
  downscaleImage,
  uploadCompressed,
  validateVoiceRecording,
  uploadVoice,
  type DmAttachmentTransport,
  type DownscaleResult,
} from '~/services/attachmentUploader'
import { startVoiceRecording, type VoiceRecorderHandle, type VoiceRecordingResult } from '~/services/voiceRecorder'
import type { DM_COMPOSER_STATES } from '~/constants/inbox'

const log = createLogger('[useDmComposer]')

export type DmComposerState = typeof DM_COMPOSER_STATES[number]

/** Per-pending-upload bookkeeping needed for cancel/retry, keyed by optimistic tempId. */
interface PendingUpload {
  threadId: string
  file: File
  compressed: DownscaleResult | null
  controller: AbortController
}

// Module-scoped machine state: the composer is a per-thread-view singleton,
// but it's instantiated from multiple components (thread-panel for images,
// message-input for voice). Sharing state/pending here keeps the
// one-state-at-a-time invariant across all instances.
const state = ref<DmComposerState>('idle')
const pending = new Map<string, PendingUpload>()
let activeRecording: VoiceRecorderHandle | null = null

export function useDmComposer() {
  const store = useInboxStore()
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const authStore = useAuthStore()

  // ── Transport (network wiring, injected into attachmentUploader) ──────
  function createTransport(threadId: string): DmAttachmentTransport {
    return {
      getUploadAuth: async () => {
        const res = await api<DmAttachmentUploadAuthResponse>(`/inbox/threads/${threadId}/attachments/upload-auth`, {
          method: 'POST',
        })
        return res.data
      },
      finalize: async (input) => {
        const res = await api<DmAttachmentFinalizeResponse>(`/inbox/threads/${threadId}/attachments/finalize`, {
          method: 'POST',
          body: input,
        })
        return res.data
      },
      finalizeVoice: async (input) => {
        const res = await api<DmVoiceFinalizeResponse>(`/inbox/threads/${threadId}/attachments/finalize`, {
          method: 'POST',
          body: { ...input, kind: 'voice' },
        })
        return res.data
      },
    }
  }

  // ── Transition guard ───────────────────────────────────────────────────
  function transition(from: DmComposerState[], to: DmComposerState, action: string): boolean {
    if (!from.includes(state.value)) {
      log.warn(`Illegal transition: ${action} from "${state.value}" (expected one of ${from.join('/')})`)
      return false
    }
    state.value = to
    return true
  }

  // ── GATE: pick-time validation ─────────────────────────────────────────
  function pickImage(threadId: string, file: File): void {
    if (!transition(['idle'], 'picking', 'pick(file)')) return

    const error = validateImageFile(file)
    if (error) {
      state.value = 'idle'
      toast.add({ title: error, color: 'error' })
      return
    }

    void beginUpload(threadId, file)
  }

  // ── EXECUTE: downscale + insert optimistic bubble + upload ────────────
  async function beginUpload(threadId: string, file: File): Promise<void> {
    state.value = 'uploading'
    const tempId = `tmp-${Date.now()}`
    const controller = new AbortController()
    pending.set(tempId, { threadId, file, compressed: null, controller })

    let compressed: DownscaleResult
    try {
      compressed = await downscaleImage(file)
    }
    catch (err) {
      log.warn('Downscale failed', err)
      pending.delete(tempId)
      state.value = 'idle'
      toast.add({ title: 'Could not process that image.', color: 'error' })
      return
    }

    const entry = pending.get(tempId)
    if (!entry) return // cancelled while downscaling
    entry.compressed = compressed

    const localPreviewUrl = URL.createObjectURL(compressed.blob)
    store.appendMessage({
      id: tempId,
      threadId,
      senderId: String(authStore.user?.id ?? 'me'),
      content: '',
      type: 'media',
      kind: 'media',
      media: { url: localPreviewUrl, mimeType: compressed.blob.type || 'image/jpeg', width: compressed.width, height: compressed.height },
      sentAt: new Date().toISOString(),
      readAt: null,
      unsent: false,
      isOwn: true,
      uploadStatus: 'uploading',
      uploadProgress: 0,
      localPreviewUrl,
    })

    await runUpload(tempId)
  }

  async function runUpload(tempId: string): Promise<void> {
    const entry = pending.get(tempId)
    if (!entry || !entry.compressed) return

    state.value = 'uploading'
    store.setMessageUploadState(tempId, { uploadStatus: 'uploading', uploadProgress: 0 })

    try {
      const payload = await uploadCompressed(entry.compressed, createTransport(entry.threadId), {
        onProgress: (loaded, total) => {
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0
          store.setMessageUploadState(tempId, { uploadProgress: pct })
        },
        signal: entry.controller.signal,
      })

      state.value = 'sending'
      const res = await api<SendMessageResponse>(`/inbox/threads/${entry.threadId}/messages`, {
        method: 'POST',
        body: { content: JSON.stringify(payload), type: 'media' },
      })
      revokePreview(tempId)
      store.replaceOptimisticMessage(tempId, res.data)
      pending.delete(tempId)
      state.value = 'idle'
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return // cancelled — handled by cancelUpload
      log.warn('Image message failed', err)
      const { message } = normalizeError(err)
      toast.add({ title: message ?? 'Upload failed.', color: 'error' })
      store.setMessageUploadState(tempId, { uploadStatus: 'failed' })
      state.value = 'idle'
    }
  }

  // ── Cancel (uploading → idle): abort, remove bubble, nothing sent ─────
  function cancelUpload(tempId: string): void {
    const entry = pending.get(tempId)
    if (!entry) {
      log.warn(`Illegal transition: cancel with no pending upload for "${tempId}"`)
      return
    }
    if (!transition(['uploading', 'sending'], 'idle', 'cancel')) return

    entry.controller.abort()
    revokePreview(tempId)
    store.removeMessage(tempId)
    pending.delete(tempId)
  }

  // ── Manual retry (idle, failed bubble → uploading): reuses cached blob ─
  function retryUpload(tempId: string): void {
    const entry = pending.get(tempId)
    if (!entry || !entry.compressed) {
      log.warn(`Illegal transition: retry with no cached upload for "${tempId}"`)
      return
    }
    if (state.value !== 'idle') {
      log.warn(`Illegal transition: retry(tempId) from "${state.value}" (expected idle)`)
      return
    }
    // Fresh AbortController per attempt — the previous one may have settled.
    entry.controller = new AbortController()
    void runUpload(tempId)
  }

  // ── Discard a failed bubble (idle → idle): remove, nothing sent ───────
  function discardFailed(tempId: string): void {
    const entry = pending.get(tempId)
    if (!entry) {
      log.warn(`Illegal transition: discard with no pending upload for "${tempId}"`)
      return
    }
    revokePreview(tempId)
    store.removeMessage(tempId)
    pending.delete(tempId)
  }

  function revokePreview(tempId: string): void {
    const msg = store.messages.find(m => String(m.id) === tempId)
    if (msg?.localPreviewUrl) URL.revokeObjectURL(msg.localPreviewUrl)
  }

  // ── GATE + EXECUTE: hold-to-record voice note ──────────────────────────
  // idle -> recording (mic permission requested here, first use only) ->
  // uploading -> sending -> idle. Hard stop at DM_VOICE_MAX_DURATION_MS is
  // handled inside voiceRecorder and delivered via the onHardStop callback.
  async function startRecording(threadId: string): Promise<void> {
    if (!transition(['idle'], 'recording', 'startRecording')) return

    try {
      activeRecording = await startVoiceRecording((result) => {
        // Hard stop hit while still holding — finish the send pipeline.
        activeRecording = null
        void finishRecording(threadId, result)
      })
    }
    catch (err) {
      log.warn('Voice recording could not start', err)
      state.value = 'idle'
      toast.add({ title: 'Microphone access is required to record a voice note.', color: 'error' })
    }
  }

  /** Release the mic + discard — recording -> idle, nothing sent. */
  function cancelRecording(): void {
    if (!transition(['recording'], 'idle', 'cancelRecording')) return
    activeRecording?.cancel()
    activeRecording = null
  }

  /** Release the mic + stop — recording -> uploading -> sending -> idle. */
  async function stopRecording(threadId: string): Promise<void> {
    if (state.value !== 'recording' || !activeRecording) {
      log.warn(`Illegal transition: stopRecording from "${state.value}"`)
      return
    }
    const handle = activeRecording
    activeRecording = null
    try {
      const result = await handle.stop()
      await finishRecording(threadId, result)
    }
    catch (err) {
      log.warn('Voice recording stop failed', err)
      state.value = 'idle'
      toast.add({ title: 'Could not process that recording.', color: 'error' })
    }
  }

  async function finishRecording(threadId: string, result: VoiceRecordingResult): Promise<void> {
    const error = validateVoiceRecording(result.blob, result.durationMs)
    if (error) {
      state.value = 'idle'
      toast.add({ title: error, color: 'error' })
      return
    }

    state.value = 'uploading'
    const controller = new AbortController()

    try {
      const payload = await uploadVoice(result.blob, result.mimeType, result.durationMs, createTransport(threadId), {
        signal: controller.signal,
      })

      state.value = 'sending'
      const res = await api<SendMessageResponse>(`/inbox/threads/${threadId}/messages`, {
        method: 'POST',
        body: { content: JSON.stringify(payload), type: 'voice' },
      })
      store.appendMessage(res.data)
      state.value = 'idle'
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      log.warn('Voice message failed', err)
      const { message } = normalizeError(err)
      toast.add({ title: message ?? 'Voice note upload failed.', color: 'error' })
      state.value = 'idle'
    }
  }

  return {
    state: readonly(state),
    pickImage,
    cancelUpload,
    retryUpload,
    discardFailed,
    startRecording,
    cancelRecording,
    stopRecording,
  }
}
