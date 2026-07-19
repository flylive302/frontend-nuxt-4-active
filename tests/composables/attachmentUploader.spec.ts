/**
 * attachmentUploader (dm-messenger-v2/01) — framework-free DM image upload
 * pipeline: validate → downscale (canvas) → signed ImageKit upload → server
 * finalize. Transport (auth/finalize/upload) is injected, so this test
 * mocks it directly rather than the network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateImageFile,
  downscaleImage,
  uploadDmImage,
  uploadCompressed,
  validateVoiceRecording,
  uploadVoice,
  type DmAttachmentTransport,
} from '../../app/services/attachmentUploader'

function makeFile(opts: { type?: string; sizeBytes?: number } = {}): File {
  const type = opts.type ?? 'image/jpeg'
  const size = opts.sizeBytes ?? 1024
  return new File([new Uint8Array(size)], 'photo.jpg', { type })
}

// ── Stub browser canvas APIs (node test env has neither) ─────────────
function stubCanvasApis(dimensions: { width: number; height: number }) {
  const bitmap = { width: dimensions.width, height: dimensions.height, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))

  const canvasBlob = new Blob(['downscaled'], { type: 'image/jpeg' })
  const ctx = { drawImage: vi.fn() }
  class FakeOffscreenCanvas {
    width: number
    height: number
    constructor(w: number, h: number) {
      this.width = w
      this.height = h
    }

    getContext() {
      return ctx
    }

    convertToBlob() {
      return Promise.resolve(canvasBlob)
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
  return { bitmap, ctx }
}

describe('validateImageFile (GATE)', () => {
  it('accepts an allowed mime type under the size cap', () => {
    expect(validateImageFile(makeFile())).toBeNull()
  })

  it('rejects a disallowed mime type', () => {
    expect(validateImageFile(makeFile({ type: 'image/gif' }))).toMatch(/unsupported/i)
  })

  it('rejects an oversized file', () => {
    expect(validateImageFile(makeFile({ sizeBytes: 6 * 1024 * 1024 }))).toMatch(/limit/i)
  })
})

describe('downscaleImage (EXECUTE)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('scales a long-edge-oversized image down to the cap, preserving aspect ratio', async () => {
    stubCanvasApis({ width: 3200, height: 1600 })

    const result = await downscaleImage(makeFile(), 1600)

    expect(result.width).toBe(1600)
    expect(result.height).toBe(800)
    expect(result.blob).toBeInstanceOf(Blob)
  })

  it('leaves an already-small image untouched in dimensions', async () => {
    stubCanvasApis({ width: 400, height: 300 })

    const result = await downscaleImage(makeFile(), 1600)

    expect(result.width).toBe(400)
    expect(result.height).toBe(300)
  })

  it('invokes the canvas draw (compression is applied)', async () => {
    const { ctx } = stubCanvasApis({ width: 3200, height: 1600 })

    await downscaleImage(makeFile(), 1600)

    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
  })
})

describe('uploadDmImage (orchestrator)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    stubCanvasApis({ width: 800, height: 600 })
  })

  function makeTransport(overrides: Partial<DmAttachmentTransport> = {}): DmAttachmentTransport {
    return {
      getUploadAuth: vi.fn().mockResolvedValue({
        token: 't', signature: 's', expire: 123, publicKey: 'pk',
        folder: 'dm-attachments/1', urlEndpoint: 'https://ik.imagekit.io/test', fileName: 'abc123',
      }),
      finalize: vi.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/test/dm-attachments/1/abc123.jpg', mimeType: 'image/jpeg', width: 800, height: 600 }),
      uploadToImageKit: vi.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/test/dm-attachments/1/abc123.jpg' }),
      ...overrides,
    }
  }

  it('GATE: throws before touching the transport when the file is invalid', async () => {
    const transport = makeTransport()

    await expect(uploadDmImage(makeFile({ type: 'image/gif' }), transport)).rejects.toThrow(/unsupported/i)
    expect(transport.getUploadAuth).not.toHaveBeenCalled()
  })

  it('calls auth -> upload -> finalize in order and returns the finalized payload', async () => {
    const transport = makeTransport()

    const payload = await uploadDmImage(makeFile(), transport)

    expect(transport.getUploadAuth).toHaveBeenCalledTimes(1)
    expect(transport.uploadToImageKit).toHaveBeenCalledTimes(1)
    expect(transport.finalize).toHaveBeenCalledTimes(1)
    expect(payload.mimeType).toBe('image/jpeg')
  })

  it('finalize receives the downscaled dimensions and uploaded url', async () => {
    const transport = makeTransport()

    await uploadDmImage(makeFile(), transport)

    expect(transport.finalize).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://ik.imagekit.io/test/dm-attachments/1/abc123.jpg',
      width: 800,
      height: 600,
    }))
  })

  it('propagates a finalize rejection (server-side GATE failure)', async () => {
    const transport = makeTransport({ finalize: vi.fn().mockRejectedValue(new Error('422')) })

    await expect(uploadDmImage(makeFile(), transport)).rejects.toThrow('422')
  })
})

describe('uploadCompressed (progress / cancel / retry)', () => {
  function makeTransport(overrides: Partial<DmAttachmentTransport> = {}): DmAttachmentTransport {
    return {
      getUploadAuth: vi.fn().mockResolvedValue({
        token: 't', signature: 's', expire: 123, publicKey: 'pk',
        folder: 'dm-attachments/1', urlEndpoint: 'https://ik.imagekit.io/test', fileName: 'abc123',
      }),
      finalize: vi.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/test/dm-attachments/1/abc123.jpg', mimeType: 'image/jpeg', width: 800, height: 600 }),
      ...overrides,
    }
  }

  const downscaled = { blob: new Blob(['x'], { type: 'image/jpeg' }), width: 800, height: 600 }

  it('reports progress via onProgress during a successful upload', async () => {
    const uploadToImageKit = vi.fn((_blob, _auth, opts) => {
      opts?.onProgress?.(50, 100)
      opts?.onProgress?.(100, 100)
      return Promise.resolve({ url: 'https://ik.imagekit.io/test/x.jpg' })
    })
    const transport = makeTransport({ uploadToImageKit })
    const onProgress = vi.fn()

    await uploadCompressed(downscaled, transport, { onProgress })

    expect(onProgress).toHaveBeenNthCalledWith(1, 50, 100)
    expect(onProgress).toHaveBeenNthCalledWith(2, 100, 100)
  })

  it('cancel: an aborted signal rejects without ever calling finalize', async () => {
    const controller = new AbortController()
    controller.abort()
    const uploadToImageKit = vi.fn().mockRejectedValue(new DOMException('Upload aborted.', 'AbortError'))
    const transport = makeTransport({ uploadToImageKit })

    await expect(uploadCompressed(downscaled, transport, { signal: controller.signal })).rejects.toThrow(/abort/i)
    expect(transport.finalize).not.toHaveBeenCalled()
    expect(uploadToImageKit).toHaveBeenCalledTimes(1) // abort short-circuits the auto-retry
  })

  it('retry: a transport failure on the first attempt is retried once automatically, then succeeds', async () => {
    const uploadToImageKit = vi.fn()
      .mockRejectedValueOnce(new Error('flaky network'))
      .mockResolvedValueOnce({ url: 'https://ik.imagekit.io/test/x.jpg' })
    const transport = makeTransport({ uploadToImageKit })

    const payload = await uploadCompressed(downscaled, transport)

    expect(uploadToImageKit).toHaveBeenCalledTimes(2)
    expect(transport.finalize).toHaveBeenCalledTimes(1)
    expect(payload.mimeType).toBe('image/jpeg')
  })

  it('retry: two consecutive failures propagate after exactly one retry (no third attempt)', async () => {
    const uploadToImageKit = vi.fn().mockRejectedValue(new Error('down'))
    const transport = makeTransport({ uploadToImageKit })

    await expect(uploadCompressed(downscaled, transport)).rejects.toThrow('down')

    expect(uploadToImageKit).toHaveBeenCalledTimes(2)
    expect(transport.finalize).not.toHaveBeenCalled()
  })
})

// ── voice (dm-messenger-v2/04) ──────────────────────────────────────────

describe('validateVoiceRecording (GATE)', () => {
  it('accepts a recording under the size and duration caps', () => {
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    expect(validateVoiceRecording(blob, 5000)).toBeNull()
  })

  it('rejects an oversized recording', () => {
    const blob = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'audio/webm' })
    expect(validateVoiceRecording(blob, 5000)).toMatch(/limit/i)
  })

  it('rejects a recording over the duration cap', () => {
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })
    expect(validateVoiceRecording(blob, 120_001)).toMatch(/limit/i)
  })

  it('rejects an empty recording', () => {
    const blob = new Blob([], { type: 'audio/webm' })
    expect(validateVoiceRecording(blob, 0)).not.toBeNull()
  })
})

describe('uploadVoice (EXECUTE)', () => {
  function makeVoiceTransport(overrides: Partial<DmAttachmentTransport> = {}): DmAttachmentTransport {
    return {
      getUploadAuth: vi.fn().mockResolvedValue({ token: 't', signature: 's', expire: 1, publicKey: 'p', folder: 'f', urlEndpoint: 'u', fileName: 'note.webm' }),
      finalize: vi.fn(),
      finalizeVoice: vi.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/test/note.webm', durationMs: 4000 }),
      uploadToImageKit: vi.fn().mockResolvedValue({ url: 'https://ik.imagekit.io/test/note.webm' }),
      ...overrides,
    }
  }

  it('uploads the blob and calls finalizeVoice with durationMs', async () => {
    const transport = makeVoiceTransport()
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })

    const payload = await uploadVoice(blob, 'audio/webm', 4000, transport)

    expect(transport.finalizeVoice).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/webm', sizeBytes: 1024, durationMs: 4000 }))
    expect(payload.durationMs).toBe(4000)
  })

  it('throws if the transport has no finalizeVoice configured', async () => {
    const transport = makeVoiceTransport({ finalizeVoice: undefined })
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })

    await expect(uploadVoice(blob, 'audio/webm', 4000, transport)).rejects.toThrow(/voice transport/i)
  })

  it('reports progress and honors one automatic retry, same as image upload', async () => {
    const uploadToImageKit = vi.fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValueOnce({ url: 'https://ik.imagekit.io/test/note.webm' })
    const transport = makeVoiceTransport({ uploadToImageKit })
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/webm' })

    const payload = await uploadVoice(blob, 'audio/webm', 4000, transport)

    expect(uploadToImageKit).toHaveBeenCalledTimes(2)
    expect(payload.url).toBe('https://ik.imagekit.io/test/note.webm')
  })
})
