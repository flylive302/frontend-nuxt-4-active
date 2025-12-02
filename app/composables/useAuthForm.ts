
import { ref, type Ref } from 'vue'

export interface UseAuthFormOptions {
  formRef: Ref<any>
  onSuccess?: (data: any) => Promise<void> | void
  successMessage?: string
}

export function useAuthForm(options: UseAuthFormOptions) {
  const { normalizeError } = useApi()
  const toast = useToast()
  
  const isSubmitting = ref(false)
  const generalError = ref('')

  async function handleSubmit(action: () => Promise<any>) {
    isSubmitting.value = true
    generalError.value = ''

    try {
      const result = await action()
      
      if (options.successMessage) {
        toast.add({
          title: 'Success',
          description: options.successMessage,
          color: 'success'
        })
      }

      if (options.onSuccess) {
        await options.onSuccess(result)
      }
    } catch (error: unknown) {
      const normalizedError = normalizeError(error)

      // Handle validation errors (422)
      if (normalizedError.status === 422 && normalizedError.fieldErrors) {
        const formErrors = Object.entries(normalizedError.fieldErrors).map(
          ([path, messages]) => ({
            path, // UForm uses 'path' or 'name' depending on version, usually 'path' matches schema keys
            message: messages?.[0] ?? 'Invalid value',
          })
        )
        options.formRef.value?.setErrors(formErrors)
      }

      // Set general error message
      generalError.value = normalizedError.message

      // Show toast for non-validation errors or general fallback
      if (normalizedError.status !== 422) {
        toast.add({
          title: 'Error',
          description: normalizedError.message,
          color: 'error'
        })
      }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    isSubmitting,
    generalError,
    handleSubmit
  }
}
