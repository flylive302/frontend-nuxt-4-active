// ========================================
// useImageUpload — createUploadState
// ========================================
// Agency create reported a bare "Failed to upload logo": the upload state held
// the real reason but callers had no usable message for auth-params failures,
// and every retry re-uploaded images that had already succeeded (3 auth-params
// calls per attempt against a 10/min throttle).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('ref', ref)

vi.mock('~/utils/image-file', () => ({
  downscaleImageForUpload: (file: File) => Promise.resolve(file),
}))

const apiMock = vi.fn()
vi.stubGlobal('useApi', () => ({ api: apiMock }))

const AUTH_PARAMS = {
  token: 't', signature: 's', expire: 1, publicKey: 'pk', folder: 'agencies/logos', urlEndpoint: 'u',
}

class FakeXhr {
  status = 200
  responseText = JSON.stringify({ fileId: 'f1', url: 'https://ik.imagekit.io/flylive/a.png' })
  timeout = 0
  upload = { addEventListener: vi.fn() }
  private listeners: Record<string, () => void> = {}
  addEventListener(name: string, cb: () => void) { this.listeners[name] = cb }
  open() {}
  send() { queueMicrotask(() => this.listeners.load?.()) }
  abort() {}
}
vi.stubGlobal('XMLHttpRequest', FakeXhr)

function pngFile(name = 'logo.png', type = 'image/png'): File {
  return new File([new Uint8Array(10)], name, { type })
}

async function setup() {
  const { useImageUpload } = await import('../../app/composables/shared/useImageUpload')
  return useImageUpload().createUploadState()
}

describe('createUploadState', () => {
  beforeEach(() => {
    apiMock.mockReset()
    apiMock.mockResolvedValue({ data: AUTH_PARAMS })
  })

  it('reuses a successful result for the same file instead of re-uploading', async () => {
    const upload = await setup()
    const file = pngFile()

    const first = await upload.upload(file, 'agencies/logos')
    const second = await upload.upload(file, 'agencies/logos')

    expect(second).toEqual(first)
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('uploads again when a different file is picked', async () => {
    const upload = await setup()

    await upload.upload(pngFile('a.png'), 'agencies/logos')
    await upload.upload(pngFile('b.png'), 'agencies/logos')

    expect(apiMock).toHaveBeenCalledTimes(2)
  })

  it('exposes the file-type rejection message', async () => {
    const upload = await setup()

    const result = await upload.upload(pngFile('photo.heic', 'image/heic'), 'agencies/logos')

    expect(result).toBeNull()
    expect(upload.state.value.error).toBe('Invalid file type. Allowed: JPG, PNG, WebP')
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('maps an auth-params 429 to a wait-and-retry message', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('[POST] 429'), {
      response: { status: 429, _data: { message: 'Too Many Attempts.' } },
    }))
    const upload = await setup()

    await upload.upload(pngFile(), 'agencies/logos')

    expect(upload.state.value.error).toBe('Too many upload attempts. Please wait a minute and try again.')
  })

  it('surfaces the backend message for other auth-params failures', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('[POST] 401'), {
      response: { status: 401, _data: { message: 'Unauthenticated.' } },
    }))
    const upload = await setup()

    await upload.upload(pngFile(), 'agencies/logos')

    expect(upload.state.value.error).toBe('Unauthenticated.')
  })
})
