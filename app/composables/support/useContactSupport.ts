import type { Ref } from 'vue'
import { z } from 'zod'
import type { ImageUploadAuthParams } from '~/types/asset/upload'

// ========================================
// Types
// ========================================

export type ContactSupportFormData = z.infer<typeof contactSupportSchema>

export interface SupportAttachment {
  url: string
  file_id: string
  localName: string
}

export interface UploadingAttachment {
  localName: string
  progress: number
}

// ========================================
// Schema
// ========================================

export const contactSupportSchema = z.object({
  countryCode: z.string().min(2, 'Country is required'),
  dialCode: z.string().startsWith('+', 'Invalid dial code'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
})

// ========================================
// Constants
// ========================================

const MAX_ATTACHMENTS = 6

// ========================================
// Composable
// ========================================

interface FormInstance {
  errors: unknown
  clear: () => void
  setErrors: (errors: { path: string; id?: string; message: string }[]) => void
}

export function useContactSupport(
  formRef: Ref<FormInstance | null>,
  options: { defaultCategory?: string } = {},
) {
  const { api, normalizeError } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const isSubmitting = ref(false)
  const generalError = ref('')
  const submitted = ref(false)

  const category = ref<string>(options.defaultCategory ?? '')
  const attachments = ref<SupportAttachment[]>([])
  const uploadingAttachments = ref<UploadingAttachment[]>([])
  const attachmentError = ref<string>('')

  // ========================================
  // Helpers
  // ========================================

  function getFieldError(fieldName: string): string | undefined {
    const errors = formRef.value?.errors
    if (!errors) return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawErrors = errors as any
    const errorList = Array.isArray(rawErrors) ? rawErrors : (rawErrors?.value ?? [])
    const error = errorList.find((e: { path: string; id?: string }) => e.path === fieldName || e.id === fieldName)
    return error?.message
  }

  // ========================================
  // addAttachment — GATE → EXECUTE → REACT
  // ========================================

  async function addAttachment(file: File): Promise<void> {
    // GATE
    if (attachments.value.length >= MAX_ATTACHMENTS) {
      attachmentError.value = 'You can attach up to 6 images'
      return
    }
    attachmentError.value = ''

    // EXECUTE
    const { uploadToImageKit } = useImageUpload()
    const { data: authParams } = await api<{ data: ImageUploadAuthParams }>('/support/upload-auth', { method: 'POST' })

    const inFlight: UploadingAttachment = { localName: file.name, progress: 0 }
    uploadingAttachments.value.push(inFlight)

    try {
      const result = await uploadToImageKit(file, authParams, {
        onProgress: (p: number) => {
          const idx = uploadingAttachments.value.indexOf(inFlight)
          if (idx !== -1) uploadingAttachments.value[idx]!.progress = p
        },
      })

      // REACT
      attachments.value.push({
        url: result.url,
        file_id: result.fileId,
        localName: file.name,
      })
    } catch (err) {
      attachmentError.value = err instanceof Error ? err.message : 'Upload failed'
    } finally {
      const idx = uploadingAttachments.value.indexOf(inFlight)
      if (idx !== -1) uploadingAttachments.value.splice(idx, 1)
    }
  }

  // ========================================
  // removeAttachment
  // ========================================

  function removeAttachment(index: number): void {
    attachments.value.splice(index, 1)
  }

  // ========================================
  // submit — GATE → EXECUTE → REACT
  // ========================================

  async function submit(data: {
    countryCode: string
    dialCode: string
    phone: string
    email: string
    name: string
    message: string
  }) {
    if (isSubmitting.value) return

    isSubmitting.value = true
    generalError.value = ''
    formRef.value?.clear()

    try {
      await api('/support/messages', {
        method: 'POST',
        body: {
          name: data.name,
          email: data.email,
          country_code: data.countryCode,
          dial_code: data.dialCode,
          phone: data.phone,
          message: data.message,
          category: category.value,
          attachments: attachments.value.map((a) => ({
            url: a.url,
            file_id: a.file_id,
          })),
        },
      })

      submitted.value = true
    } catch (error: unknown) {
      const normalizedError = normalizeError(error)

      if (normalizedError.status === 422 && normalizedError.fieldErrors) {
        const formErrors = Object.entries(normalizedError.fieldErrors).map(([path, messages]) => ({
          path,
          id: path,
          message: messages?.[0] ?? 'Invalid value',
        }))
        formRef.value?.setErrors(formErrors)
      }

      generalError.value = normalizedError.message

      if (normalizedError.status !== 422) {
        toast.add({
          title: 'Error',
          description: normalizedError.message,
          color: 'error',
        })
      }
    } finally {
      isSubmitting.value = false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    isSubmitting,
    generalError,
    submitted,
    category,
    attachments,
    uploadingAttachments,
    attachmentError,
    getFieldError,
    submit,
    addAttachment,
    removeAttachment,
    schema: contactSupportSchema,
  }
}
