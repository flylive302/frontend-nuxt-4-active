import { ref, computed, type Ref } from 'vue'
import type { Form, FormError } from '@nuxt/ui'
import { useApi } from './useApi'

export interface UseAuthFormOptions<T> {
  formRef: Ref<any>
  onSuccess?: (data: any) => Promise<void> | void
  successMessage?: string
}

export function useAuthForm<T extends Record<string, any>>(options: UseAuthFormOptions<T>) {
  const { normalizeError } = useApi()
  const toast = useToast()
  
  const isSubmitting = ref(false)
  const generalError = ref('')

  /**
   * Generic helper to extract field-specific errors from the form.
   * This centralizes error retrieval logic while maintaining composable genericity.
   * 
   * @param fieldName - The name/path/id of the field to get the error for
   * @returns The error message for the field, or undefined if no error exists
   */
  function getFieldError(fieldName: string): string | undefined {
    const errors = options.formRef.value?.errors
    if (!errors) return undefined
    
    // errors is a Ref<FormError[]> in Nuxt UI Form
    // We define a local interface to ensure we can access the properties we need
    interface LocalFormError {
      id: string
      message: string
      path?: string
    }

    const errorList = (Array.isArray(errors) ? errors : (errors as unknown as Ref<LocalFormError[]>).value) as LocalFormError[]
    
    const error = errorList?.find(
      (e) => e.path === fieldName || e.id === fieldName
    )
    return error?.message
  }

  /**
   * Handles form submission with standardized error handling and state management.
   * @param action - The async action to perform (e.g., login, register).
   */
  async function handleSubmit(action: () => Promise<any>) {
    if (isSubmitting.value) return
    
    isSubmitting.value = true
    generalError.value = ''
    options.formRef.value?.clear()

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
        const formErrors: FormError[] = Object.entries(normalizedError.fieldErrors).map(
          ([path, messages]) => ({
            path,
            id: path,
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
    getFieldError,
    handleSubmit
  }
}
