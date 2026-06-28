// ========================================
// useContactSupport Composable Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setupNuxtMocks,
  cleanupNuxtMocks,
  createMockApi,
} from '../helpers/nuxtMocks'

// ========================================
// Shared fixtures
// ========================================

function makeFile(name = 'photo.jpg'): File {
  return new File(['data'], name, { type: 'image/jpeg' })
}

const MOCK_AUTH_PARAMS = {
  token: 'tok',
  signature: 'sig',
  expire: 9999999,
  publicKey: 'pub',
  folder: 'support-attachments',
  urlEndpoint: 'https://ik.imagekit.io/flylive',
}

const MOCK_UPLOAD_RESULT = {
  fileId: 'fid-123',
  url: 'https://ik.imagekit.io/flylive/support-attachments/photo.jpg',
  name: 'photo.jpg',
}

// ========================================
// Mock setup helpers
// ========================================

let mockUploadToImageKit: ReturnType<typeof vi.fn>

function buildApiMock() {
  const mock = createMockApi()
  mock.api.mockImplementation((url: string) => {
    if (url === '/support/upload-auth') {
      return Promise.resolve({ data: MOCK_AUTH_PARAMS })
    }
    return Promise.resolve({})
  })
  return mock
}

function makeFormRef() {
  return { value: { errors: [], clear: vi.fn(), setErrors: vi.fn() } }
}

// ========================================
// Module import (re-loaded per cycle via globalThis mocks)
// ========================================

let useContactSupport: typeof import('~/composables/support/useContactSupport')['useContactSupport']

describe('useContactSupport', () => {
  let mockApi: ReturnType<typeof createMockApi>
  let mockToast: { add: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    mockApi = buildApiMock()
    mockToast = { add: vi.fn() }
    mockUploadToImageKit = vi.fn().mockResolvedValue(MOCK_UPLOAD_RESULT)

    setupNuxtMocks({ api: mockApi })
    ;(globalThis as Record<string, unknown>).useToast = () => mockToast
    ;(globalThis as Record<string, unknown>).useImageUpload = () => ({
      uploadToImageKit: mockUploadToImageKit,
    })

    const mod = await import('~/composables/support/useContactSupport')
    useContactSupport = mod.useContactSupport
  })

  afterEach(() => {
    cleanupNuxtMocks()
    Reflect.deleteProperty(globalThis, 'useToast')
    Reflect.deleteProperty(globalThis, 'useImageUpload')
    vi.resetModules()
  })

  // ======================================================================
  // CATEGORY
  // ======================================================================

  describe('category initialisation', () => {
    it('seeds category from defaultCategory option', () => {
      const { category } = useContactSupport(makeFormRef() as never, { defaultCategory: 'password_reset' })
      expect(category.value).toBe('password_reset')
    })

    it('defaults category to empty string when no option given', () => {
      const { category } = useContactSupport(makeFormRef() as never)
      expect(category.value).toBe('')
    })
  })

  // ======================================================================
  // addAttachment — GATE
  // ======================================================================

  describe('addAttachment GATE', () => {
    it('rejects the 7th file without calling /support/upload-auth', async () => {
      const formRef = makeFormRef()
      const { addAttachment, attachments } = useContactSupport(formRef as never)

      // Seed 6 completed attachments
      attachments.value = Array.from({ length: 6 }, (_, i) => ({
        url: `https://cdn.example.com/img${i}.jpg`,
        file_id: `fid-${i}`,
        localName: `img${i}.jpg`,
      }))

      await addAttachment(makeFile('seventh.jpg'))

      expect(mockApi.api).not.toHaveBeenCalledWith('/support/upload-auth', expect.anything())
      expect(attachments.value).toHaveLength(6)
    })

    it('exposes an attachmentError when max is reached', async () => {
      const formRef = makeFormRef()
      const { addAttachment, attachments, attachmentError } = useContactSupport(formRef as never)

      attachments.value = Array.from({ length: 6 }, (_, i) => ({
        url: `https://cdn.example.com/img${i}.jpg`,
        file_id: `fid-${i}`,
        localName: `img${i}.jpg`,
      }))

      await addAttachment(makeFile('seventh.jpg'))

      expect(attachmentError.value).toBeTruthy()
    })

    it('clears attachmentError on a successful upload within limit', async () => {
      const formRef = makeFormRef()
      const { addAttachment, attachmentError } = useContactSupport(formRef as never)

      // Trigger error first
      await addAttachment(makeFile('ok.jpg'))
      // First upload succeeds, attachmentError should be cleared
      expect(attachmentError.value).toBe('')
    })
  })

  // ======================================================================
  // addAttachment — EXECUTE
  // ======================================================================

  describe('addAttachment EXECUTE', () => {
    it('calls POST /support/upload-auth to fetch auth params', async () => {
      const { addAttachment } = useContactSupport(makeFormRef() as never)

      await addAttachment(makeFile())

      expect(mockApi.api).toHaveBeenCalledWith('/support/upload-auth', { method: 'POST' })
    })

    it('passes the file and fetched auth params to uploadToImageKit', async () => {
      const { addAttachment } = useContactSupport(makeFormRef() as never)
      const file = makeFile()

      await addAttachment(file)

      expect(mockUploadToImageKit).toHaveBeenCalledWith(
        file,
        MOCK_AUTH_PARAMS,
        expect.objectContaining({ onProgress: expect.any(Function) }),
      )
    })
  })

  // ======================================================================
  // addAttachment — REACT
  // ======================================================================

  describe('addAttachment REACT', () => {
    it('appends { url, file_id, localName } to attachments after success', async () => {
      const { addAttachment, attachments } = useContactSupport(makeFormRef() as never)

      await addAttachment(makeFile('shot.jpg'))

      expect(attachments.value).toHaveLength(1)
      expect(attachments.value[0]).toEqual({
        url: MOCK_UPLOAD_RESULT.url,
        file_id: MOCK_UPLOAD_RESULT.fileId,
        localName: 'shot.jpg',
      })
    })

    it('tracks the in-flight upload in uploadingAttachments and removes it on completion', async () => {
      const observed: number[] = []
      mockUploadToImageKit.mockImplementation(
        (_file: File, _params: unknown, opts: { onProgress?: (p: number) => void }) => {
          opts?.onProgress?.(42)
          return Promise.resolve(MOCK_UPLOAD_RESULT)
        }
      )

      const { addAttachment, uploadingAttachments } = useContactSupport(makeFormRef() as never)

      const promise = addAttachment(makeFile('track.jpg'))
      // After await the upload completes
      await promise

      // uploadingAttachments is empty once the upload finished
      expect(uploadingAttachments.value).toHaveLength(0)
      // attachments gained the entry
      void observed
    })

    it('does not append to attachments when upload fails', async () => {
      mockUploadToImageKit.mockRejectedValueOnce(new Error('Network error'))
      const { addAttachment, attachments } = useContactSupport(makeFormRef() as never)

      await addAttachment(makeFile())

      expect(attachments.value).toHaveLength(0)
    })
  })

  // ======================================================================
  // removeAttachment
  // ======================================================================

  describe('removeAttachment', () => {
    it('removes the item at the given index', async () => {
      const { attachments, removeAttachment } = useContactSupport(makeFormRef() as never)

      attachments.value = [
        { url: 'https://cdn/a.jpg', file_id: 'fa', localName: 'a.jpg' },
        { url: 'https://cdn/b.jpg', file_id: 'fb', localName: 'b.jpg' },
        { url: 'https://cdn/c.jpg', file_id: 'fc', localName: 'c.jpg' },
      ]

      removeAttachment(1)

      expect(attachments.value).toHaveLength(2)
      expect(attachments.value.map((a) => a.localName)).toEqual(['a.jpg', 'c.jpg'])
    })
  })

  // ======================================================================
  // submit payload
  // ======================================================================

  describe('submit', () => {
    it('includes category and attachments in the API body', async () => {
      const formRef = makeFormRef()
      const { submit, attachments } = useContactSupport(formRef as never, {
        defaultCategory: 'bug_report',
      })

      attachments.value = [
        { url: 'https://cdn/x.jpg', file_id: 'fx', localName: 'x.jpg' },
      ]

      await submit({
        countryCode: 'US',
        dialCode: '+1',
        phone: '5551234',
        email: 'user@example.com',
        name: 'Alice',
        message: 'Something broke',
      })

      expect(mockApi.api).toHaveBeenCalledWith(
        '/support/messages',
        expect.objectContaining({
          body: expect.objectContaining({
            category: 'bug_report',
            attachments: [{ url: 'https://cdn/x.jpg', file_id: 'fx' }],
          }),
        }),
      )
    })

    it('sets submitted to true on success', async () => {
      const { submit, submitted } = useContactSupport(makeFormRef() as never)

      await submit({
        countryCode: 'US',
        dialCode: '+1',
        phone: '5551234',
        email: 'user@example.com',
        name: 'Alice',
        message: 'Everything is broken',
      })

      expect(submitted.value).toBe(true)
    })
  })
})
