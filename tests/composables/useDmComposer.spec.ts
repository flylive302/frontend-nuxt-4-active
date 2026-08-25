/**
 * useDmComposer (dm-messenger-v2/02) — compose state machine
 * idle -> picking -> uploading -> sending -> idle, orchestrating pick-time
 * GATE validation, optimistic bubble insertion/progress, cancel, and
 * automatic + manual retry on transport failure.
 *
 * attachmentUploader is mocked so this test covers machine transitions +
 * bubble lifecycle, not the network (prior art: useTypingIndicator.spec.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readonly, ref } from 'vue'

vi.stubGlobal('readonly', readonly)
vi.stubGlobal('ref', ref)

// ── Mock attachmentUploader (the only heavy dependency) ────────────────
const downscaleImage = vi.fn()
const uploadCompressed = vi.fn()
const validateImageFile = vi.fn()
const uploadVoice = vi.fn()
const validateVoiceRecording = vi.fn()
vi.mock('../../app/services/attachmentUploader', () => ({
  downscaleImage: (...args: unknown[]) => downscaleImage(...args),
  uploadCompressed: (...args: unknown[]) => uploadCompressed(...args),
  validateImageFile: (...args: unknown[]) => validateImageFile(...args),
  uploadVoice: (...args: unknown[]) => uploadVoice(...args),
  validateVoiceRecording: (...args: unknown[]) => validateVoiceRecording(...args),
}))

// ── Mock voiceRecorder ───────────────────────────────────────────────────
const startVoiceRecording = vi.fn()
vi.mock('../../app/services/voiceRecorder', () => ({
  startVoiceRecording: (...args: unknown[]) => startVoiceRecording(...args),
}))

// ── Mock store (setters-only, per architecture) ─────────────────────────
function createMockStore() {
  const messages: Record<string, unknown>[] = []
  return {
    messages,
    appendMessage: vi.fn((msg: Record<string, unknown>) => { messages.push(msg) }),
    setMessageUploadState: vi.fn((id: string, patch: Record<string, unknown>) => {
      const msg = messages.find(m => m.id === id)
      if (msg) Object.assign(msg, patch)
    }),
    removeMessage: vi.fn((id: string) => {
      const idx = messages.findIndex(m => m.id === id)
      if (idx >= 0) messages.splice(idx, 1)
    }),
    replaceOptimisticMessage: vi.fn((tempId: string, confirmed: Record<string, unknown>) => {
      const idx = messages.findIndex(m => m.id === tempId)
      if (idx >= 0) messages[idx] = confirmed
    }),
  }
}

let store: ReturnType<typeof createMockStore>
let toastAdd: ReturnType<typeof vi.fn>
let apiMock: ReturnType<typeof vi.fn>

vi.stubGlobal('useInboxStore', () => store)
vi.stubGlobal('useAuthStore', () => ({ user: { id: 1 } }))
vi.stubGlobal('useToast', () => ({ add: toastAdd }))
vi.stubGlobal('useApi', () => ({ api: apiMock, normalizeError: (err: unknown) => ({ message: (err as Error)?.message ?? 'Error' }) }))

function makeFile(): File {
  return new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' })
}

describe('useDmComposer', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    store = createMockStore()
    toastAdd = vi.fn()
    apiMock = vi.fn().mockResolvedValue({ data: { id: 'confirmed-1', kind: 'media' } })
    validateImageFile.mockReturnValue(null)
    downscaleImage.mockResolvedValue({ blob: new Blob(['x'], { type: 'image/jpeg' }), width: 100, height: 100 })
    uploadCompressed.mockResolvedValue({ url: 'https://ik.io/x.jpg', mimeType: 'image/jpeg', width: 100, height: 100 })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })

    validateVoiceRecording.mockReturnValue(null)
    uploadVoice.mockResolvedValue({ url: 'https://ik.io/note.webm', durationMs: 3000 })
    startVoiceRecording.mockResolvedValue({ stop: vi.fn(), cancel: vi.fn(), elapsedMs: () => 0 })
  })

  async function setup() {
    const { useDmComposer } = await import('../../app/composables/inbox/useDmComposer')
    return useDmComposer()
  }

  describe('GATE: pick-time validation', () => {
    it('rejects an invalid file with a toast, never inserts a bubble, stays idle', async () => {
      validateImageFile.mockReturnValue('Unsupported image type.')
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled())

      expect(store.appendMessage).not.toHaveBeenCalled()
      expect(downscaleImage).not.toHaveBeenCalled()
      expect(composer.state.value).toBe('idle')
    })
  })

  describe('happy path: picking -> uploading -> sending -> idle', () => {
    it('inserts an optimistic uploading bubble, uploads, sends, and settles to a confirmed message', async () => {
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(apiMock).toHaveBeenCalled())

      expect(store.appendMessage).toHaveBeenCalledTimes(1)
      const inserted = store.appendMessage.mock.calls[0]![0]
      expect(inserted.uploadStatus).toBe('uploading')
      expect(inserted.kind).toBe('media')

      await vi.waitFor(() => expect(store.replaceOptimisticMessage).toHaveBeenCalled())
      expect(composer.state.value).toBe('idle')
      expect(store.messages[0]).toEqual({ id: 'confirmed-1', kind: 'media' })
    })

    it('reports progress via setMessageUploadState during upload', async () => {
      uploadCompressed.mockImplementation(async (_result, _transport, opts) => {
        opts.onProgress(50, 100)
        return { url: 'https://ik.io/x.jpg', mimeType: 'image/jpeg' }
      })
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(apiMock).toHaveBeenCalled())

      const progressCall = store.setMessageUploadState.mock.calls.find(c => c[1].uploadProgress === 50)
      expect(progressCall).toBeTruthy()
    })
  })

  describe('cancel (uploading -> idle)', () => {
    it('aborts, removes the bubble, and sends nothing', async () => {
      let resolveUpload: (v: unknown) => void = () => {}
      uploadCompressed.mockImplementation(() => new Promise((resolve, reject) => {
        resolveUpload = resolve
        // simulate abort rejecting the upload promise
        void reject
      }))
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(store.appendMessage).toHaveBeenCalled())
      const tempId = store.appendMessage.mock.calls[0]![0].id as string

      composer.cancelUpload(tempId)

      expect(store.removeMessage).toHaveBeenCalledWith(tempId)
      expect(apiMock).not.toHaveBeenCalled()
      expect(composer.state.value).toBe('idle')
      void resolveUpload // unused resolver, upload intentionally left pending
    })

    it('illegal: cancel with no pending upload is a no-op', async () => {
      const composer = await setup()

      composer.cancelUpload('nonexistent')

      expect(store.removeMessage).not.toHaveBeenCalled()
    })
  })

  describe('transport failure -> automatic retry (owned by attachmentUploader) -> failed bubble', () => {
    it('a single uploadCompressed rejection flips the bubble to failed and returns composer to idle', async () => {
      uploadCompressed.mockRejectedValue(new Error('network down'))
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(toastAdd).toHaveBeenCalled())

      expect(uploadCompressed).toHaveBeenCalledTimes(1) // composer never wraps its own retry loop
      expect(store.setMessageUploadState).toHaveBeenCalledWith(expect.any(String), { uploadStatus: 'failed' })
      expect(composer.state.value).toBe('idle')
      expect(apiMock).not.toHaveBeenCalled()
    })
  })

  describe('manual retry (idle, failed bubble -> uploading), reuses the cached compressed blob', () => {
    it('re-invokes uploadCompressed without re-downscaling', async () => {
      uploadCompressed.mockRejectedValueOnce(new Error('flaky'))
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(store.setMessageUploadState).toHaveBeenCalledWith(expect.any(String), { uploadStatus: 'failed' }))
      const tempId = store.appendMessage.mock.calls[0]![0].id as string

      uploadCompressed.mockResolvedValue({ url: 'https://ik.io/x.jpg', mimeType: 'image/jpeg' })
      composer.retryUpload(tempId)
      await vi.waitFor(() => expect(apiMock).toHaveBeenCalled())

      expect(downscaleImage).toHaveBeenCalledTimes(1) // only the original pick downscaled
      expect(uploadCompressed).toHaveBeenCalledTimes(2)
    })

    it('illegal: retry with no cached blob (never picked) is a no-op', async () => {
      const composer = await setup()

      composer.retryUpload('nonexistent')

      expect(uploadCompressed).not.toHaveBeenCalled()
    })
  })

  describe('discard a failed bubble', () => {
    it('removes the bubble without retrying', async () => {
      uploadCompressed.mockRejectedValue(new Error('gone'))
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(store.setMessageUploadState).toHaveBeenCalledWith(expect.any(String), { uploadStatus: 'failed' }))
      const tempId = store.appendMessage.mock.calls[0]![0].id as string

      composer.discardFailed(tempId)

      expect(store.removeMessage).toHaveBeenCalledWith(tempId)
    })
  })

  describe('illegal: pick while not idle', () => {
    it('a second pick during an in-flight upload is a no-op (one state at a time)', async () => {
      uploadCompressed.mockImplementation(() => new Promise(() => {})) // never resolves
      const composer = await setup()

      composer.pickImage('t1', makeFile())
      await vi.waitFor(() => expect(composer.state.value).toBe('uploading'))

      composer.pickImage('t1', makeFile())

      expect(store.appendMessage).toHaveBeenCalledTimes(1) // second pick rejected
    })
  })

  describe('voice recording (dm-messenger-v2/04): idle -> recording -> uploading -> sending -> idle', () => {
    it('starts recording on startRecording, transitions to recording', async () => {
      const composer = await setup()

      const promise = composer.startRecording('t1')
      await vi.waitFor(() => expect(composer.state.value).toBe('recording'))
      await promise

      expect(startVoiceRecording).toHaveBeenCalledTimes(1)
    })

    it('cancelRecording releases the mic and returns to idle without sending', async () => {
      const cancel = vi.fn()
      startVoiceRecording.mockResolvedValue({ stop: vi.fn(), cancel, elapsedMs: () => 0 })
      const composer = await setup()

      await composer.startRecording('t1')
      expect(composer.state.value).toBe('recording')

      composer.cancelRecording()

      expect(cancel).toHaveBeenCalledTimes(1)
      expect(composer.state.value).toBe('idle')
      expect(apiMock).not.toHaveBeenCalled()
    })

    it('stopRecording uploads the blob and sends a voice message, settling to idle', async () => {
      const stop = vi.fn().mockResolvedValue({ blob: new Blob(['x'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 3000 })
      startVoiceRecording.mockResolvedValue({ stop, cancel: vi.fn(), elapsedMs: () => 3000 })
      apiMock.mockResolvedValue({ data: { id: 'voice-1', kind: 'voice' } })
      const composer = await setup()

      await composer.startRecording('t1')
      await composer.stopRecording('t1')

      expect(uploadVoice).toHaveBeenCalledWith(expect.any(Blob), 'audio/webm', 3000, expect.any(Object), expect.any(Object))
      expect(apiMock).toHaveBeenCalledWith('/inbox/threads/t1/messages', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ type: 'voice' }),
      }))
      expect(store.appendMessage).toHaveBeenCalledWith({ id: 'voice-1', kind: 'voice' })
      expect(composer.state.value).toBe('idle')
    })

    it('rejects an over-limit recording at finish-time GATE without uploading', async () => {
      validateVoiceRecording.mockReturnValue('Voice note exceeds the 120s limit.')
      const stop = vi.fn().mockResolvedValue({ blob: new Blob(['x']), mimeType: 'audio/webm', durationMs: 130_000 })
      startVoiceRecording.mockResolvedValue({ stop, cancel: vi.fn(), elapsedMs: () => 130_000 })
      const composer = await setup()

      await composer.startRecording('t1')
      await composer.stopRecording('t1')

      expect(uploadVoice).not.toHaveBeenCalled()
      expect(toastAdd).toHaveBeenCalled()
      expect(composer.state.value).toBe('idle')
    })

    it('illegal: stopRecording with nothing recording is a no-op', async () => {
      const composer = await setup()

      await composer.stopRecording('t1')

      expect(uploadVoice).not.toHaveBeenCalled()
    })

    it('illegal: startRecording while already recording is a no-op', async () => {
      const composer = await setup()

      await composer.startRecording('t1')
      expect(composer.state.value).toBe('recording')

      composer.startRecording('t1')

      expect(startVoiceRecording).toHaveBeenCalledTimes(1)
    })
  })
})
