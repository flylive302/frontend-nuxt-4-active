import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCroppedFile,
  downscaleImageToBlob,
  downscaleImageForUpload,
  fitToLongEdge,
  resolveDownscaleFormat,
} from '~/utils/image-file'
import { CROP_RESULT_MAX_LONG_EDGE_PX, UPLOAD_IMAGE_CAPS } from '~/constants/upload'

// ── Stub browser canvas APIs (node test env has neither) ─────────────
// Mirrors tests/composables/attachmentUploader.spec.ts so both downscale
// call sites are exercised against the same fakes.
function stubCanvasApis(options: {
  source: { width: number, height: number }
  blob?: Blob
}) {
  const bitmap = { ...options.source, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))

  const canvasBlob = options.blob ?? new Blob(['downscaled'], { type: 'image/jpeg' })
  const ctx = { drawImage: vi.fn() }
  const constructed: Array<{ width: number, height: number }> = []
  const convertToBlob = vi.fn().mockResolvedValue(canvasBlob)

  class FakeOffscreenCanvas {
    width: number
    height: number
    constructor(w: number, h: number) {
      this.width = w
      this.height = h
      constructed.push({ width: w, height: h })
    }

    getContext() { return ctx }
    convertToBlob(opts: unknown) { return convertToBlob(opts) }
  }
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)

  return { bitmap, ctx, constructed, convertToBlob }
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fitToLongEdge', () => {
  it('scales a landscape image down to the cap, preserving aspect ratio', () => {
    expect(fitToLongEdge(4000, 2000, 1600)).toEqual({ width: 1600, height: 800 })
  })

  it('scales a portrait image down by its height', () => {
    expect(fitToLongEdge(3456, 4608, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('never scales up an image already within the cap', () => {
    expect(fitToLongEdge(300, 200, 1600)).toEqual({ width: 300, height: 200 })
  })

  it('never rounds an extreme aspect ratio down to a zero-width canvas', () => {
    expect(fitToLongEdge(10000, 3, 512).width).toBeGreaterThan(0)
    expect(fitToLongEdge(10000, 3, 512).height).toBeGreaterThan(0)
  })
})

describe('resolveDownscaleFormat', () => {
  it('keeps PNG when the source is PNG and alpha must survive', () => {
    expect(resolveDownscaleFormat('image/png', true)).toBe('image/png')
  })

  it('keeps alpha for WebP sources by re-encoding as PNG', () => {
    expect(resolveDownscaleFormat('image/webp', true)).toBe('image/png')
  })

  it('uses JPEG for a JPEG source even when alpha is requested', () => {
    expect(resolveDownscaleFormat('image/jpeg', true)).toBe('image/jpeg')
  })

  it('flattens to JPEG when alpha is not requested', () => {
    expect(resolveDownscaleFormat('image/png', false)).toBe('image/jpeg')
    expect(resolveDownscaleFormat('image/png')).toBe('image/jpeg')
  })

  it('is case-insensitive about the source mime', () => {
    expect(resolveDownscaleFormat('IMAGE/PNG', true)).toBe('image/png')
  })
})

describe('downscaleImageToBlob', () => {
  it('sizes the canvas to the cap, not the source', async () => {
    const { constructed } = stubCanvasApis({ source: { width: 3456, height: 4608 } })

    const result = await downscaleImageToBlob(makeFile('id.jpg', 'image/jpeg', 5_000_000), {
      maxLongEdge: 1600,
      quality: 0.9,
    })

    expect(constructed[0]).toEqual({ width: 1200, height: 1600 })
    expect(result.width).toBe(1200)
    expect(result.height).toBe(1600)
  })

  it('passes the resolved format and quality to the encoder', async () => {
    const { convertToBlob } = stubCanvasApis({ source: { width: 800, height: 800 } })

    await downscaleImageToBlob(makeFile('logo.png', 'image/png', 900_000), {
      maxLongEdge: 512,
      quality: 0.85,
      preserveAlpha: true,
    })

    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/png', quality: 0.85 })
  })

  it('releases the decoded bitmap', async () => {
    const { bitmap } = stubCanvasApis({ source: { width: 800, height: 800 } })

    await downscaleImageToBlob(makeFile('a.jpg', 'image/jpeg', 100), { maxLongEdge: 512, quality: 0.85 })

    expect(bitmap.close).toHaveBeenCalled()
  })
})

describe('downscaleImageForUpload', () => {
  it('returns a smaller File named for the encoded bytes', async () => {
    stubCanvasApis({
      source: { width: 3456, height: 4608 },
      blob: new Blob([new Uint8Array(400_000)], { type: 'image/jpeg' }),
    })
    const original = makeFile('national-id.png', 'image/png', 5_000_000)

    const result = await downscaleImageForUpload(original, { maxLongEdge: 1600, quality: 0.9 })

    expect(result).not.toBe(original)
    expect(result.size).toBe(400_000)
    expect(result.type).toBe('image/jpeg')
    // Extension must follow the bytes, not the original pick.
    expect(result.name).toBe('national-id.jpg')
  })

  it('trusts the blob\'s own type when the encoder falls back to another codec', async () => {
    stubCanvasApis({
      source: { width: 2000, height: 2000 },
      blob: new Blob([new Uint8Array(1000)], { type: 'image/png' }),
    })
    const original = makeFile('pic.jpg', 'image/jpeg', 900_000)

    const result = await downscaleImageForUpload(original, { maxLongEdge: 512, quality: 0.85 })

    expect(result.type).toBe('image/png')
    expect(result.name).toBe('pic.png')
  })

  it('keeps the original when the re-encode came out no smaller', async () => {
    stubCanvasApis({
      source: { width: 100, height: 100 },
      blob: new Blob([new Uint8Array(80_000)], { type: 'image/jpeg' }),
    })
    const original = makeFile('tiny.jpg', 'image/jpeg', 60_000)

    const result = await downscaleImageForUpload(original, { maxLongEdge: 1600, quality: 0.85 })

    expect(result).toBe(original)
  })

  it('keeps the original when the encoder produced nothing', async () => {
    stubCanvasApis({
      source: { width: 4000, height: 4000 },
      blob: new Blob([], { type: 'image/jpeg' }),
    })
    const original = makeFile('empty.jpg', 'image/jpeg', 900_000)

    expect(await downscaleImageForUpload(original, { maxLongEdge: 512, quality: 0.85 })).toBe(original)
  })

  it('keeps the original when the file cannot be decoded', async () => {
    stubCanvasApis({ source: { width: 4000, height: 4000 } })
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const original = makeFile('broken.jpg', 'image/jpeg', 900_000)

    expect(await downscaleImageForUpload(original, { maxLongEdge: 512, quality: 0.85 })).toBe(original)
  })

  it('keeps the original when the canvas APIs are unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('OffscreenCanvas', undefined)
    const original = makeFile('nocanvas.jpg', 'image/jpeg', 900_000)

    expect(await downscaleImageForUpload(original, { maxLongEdge: 512, quality: 0.85 })).toBe(original)
  })

  it('does not throw when the 2D context is missing', async () => {
    stubCanvasApis({ source: { width: 4000, height: 4000 } })
    vi.stubGlobal('OffscreenCanvas', class {
      getContext() { return null }
    })
    const original = makeFile('nocontext.jpg', 'image/jpeg', 900_000)

    expect(await downscaleImageForUpload(original, { maxLongEdge: 512, quality: 0.85 })).toBe(original)
  })
})

describe('UPLOAD_IMAGE_CAPS', () => {
  it('covers every upload folder', () => {
    expect(Object.keys(UPLOAD_IMAGE_CAPS).sort()).toEqual([
      'agencies/logos',
      'agencies/national-ids',
      'avatars',
      'coin-request-proofs',
      'covers',
      'rooms',
      'support-attachments',
    ])
  })

  it('caps agency national IDs — the asset class this ticket targets', () => {
    expect(UPLOAD_IMAGE_CAPS['agencies/national-ids']).toEqual({
      maxLongEdge: 1600,
      quality: 0.90,
      preserveAlpha: false,
    })
  })

  it('never sets a cap the crop flow would have to re-encode a second time', () => {
    // A cap strictly between 512 and the crop ceiling means an image arriving
    // from the cropper gets decoded and re-encoded again — two lossy
    // generations. Either match the crop ceiling or downscale hard enough
    // (<=512) that the extra generation is invisible.
    for (const [folder, cap] of Object.entries(UPLOAD_IMAGE_CAPS)) {
      const isSingleGeneration
        = cap.maxLongEdge >= CROP_RESULT_MAX_LONG_EDGE_PX || cap.maxLongEdge <= 512
      expect(isSingleGeneration, `${folder} at ${cap.maxLongEdge}px double-encodes crop output`).toBe(true)
    }
  })

  it('only preserves alpha on caps small enough that PNG output stays cheap', () => {
    for (const [folder, cap] of Object.entries(UPLOAD_IMAGE_CAPS)) {
      if (cap.preserveAlpha) {
        expect(cap.maxLongEdge, `${folder} keeps PNG output at ${cap.maxLongEdge}px`).toBeLessThanOrEqual(512)
      }
    }
  })
})

describe('buildCroppedFile', () => {
  it('rewrites the extension to match the output format', () => {
    const file = buildCroppedFile(new Blob(['x']), 'photo.heic', 'image/jpeg')
    expect(file.name).toBe('photo.jpg')
    expect(file.type).toBe('image/jpeg')
  })
})
