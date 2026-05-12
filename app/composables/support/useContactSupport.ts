import type { Ref } from 'vue'
import { z } from 'zod'
import { useApi } from '~/composables/shared/useApi'

// ========================================
// Types
// ========================================

export type ContactSupportFormData = z.infer<typeof contactSupportSchema>

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
// Composable
// ========================================

interface FormInstance {
  errors: unknown
  clear: () => void
  setErrors: (errors: { path: string; id?: string; message: string }[]) => void
}

export function useContactSupport(formRef: Ref<FormInstance | null>) {
  const { api, normalizeError } = useApi()
  const toast = useToast()

  const isSubmitting = ref(false)
  const generalError = ref('')
  const submitted = ref(false)

  function getFieldError(fieldName: string): string | undefined {
    const errors = formRef.value?.errors
    if (!errors) return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawErrors = errors as any
    const errorList = Array.isArray(rawErrors) ? rawErrors : (rawErrors?.value ?? [])
    const error = errorList.find((e: { path: string; id?: string }) => e.path === fieldName || e.id === fieldName)
    return error?.message
  }

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

  return {
    isSubmitting,
    generalError,
    submitted,
    getFieldError,
    submit,
    schema: contactSupportSchema,
  }
}
