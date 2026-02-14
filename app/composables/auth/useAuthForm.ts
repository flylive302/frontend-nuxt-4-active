import type { Ref } from 'vue'
import { useApi } from '../shared/useApi'

/**
 * Field error object shape used by Nuxt UI Form component at runtime.
 * Note: This differs from @nuxt/ui's FormError<T> TypeScript type due to 
 * a mismatch between the library's type definitions and runtime behavior.
 */
interface FormFieldError {
  path: string
  id?: string
  message: string
}

/**
 * Minimal interface for the form methods we actually use.
 * Uses loose typing to accommodate Nuxt UI Form's complex internal types.
 * 
 * @internal This is intentionally loose to handle Nuxt UI's Form component
 * which has complex generic types that don't align with our usage patterns.
 */
interface FormInstance {
  errors: unknown
  clear: () => void
  setErrors: (errors: FormFieldError[]) => void
}

export interface UseAuthFormOptions {
  /** 
   * Reference to the Nuxt UI Form component instance.
   * Uses loose typing due to Nuxt UI Form's complex generic types.
   */
  formRef: Ref<FormInstance | null>
  onSuccess?: (data: unknown) => Promise<void> | void
  successMessage?: string
}

export function useAuthForm(options: UseAuthFormOptions) {
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
    
    // Handle both array and ref-wrapped array formats from Nuxt UI Form
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawErrors = errors as any
    const errorList: FormFieldError[] = Array.isArray(rawErrors) 
      ? rawErrors 
      : (rawErrors?.value ?? [])
    
    const error = errorList.find(
      (e: FormFieldError) => e.path === fieldName || e.id === fieldName
    )
    return error?.message
  }

  /**
   * Handles form submission with standardized error handling and state management.
   * @param action - The async action to perform (e.g., login, register).
   */
  async function handleSubmit(action: () => Promise<unknown>) {
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
        const formErrors: FormFieldError[] = Object.entries(normalizedError.fieldErrors).map(
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
