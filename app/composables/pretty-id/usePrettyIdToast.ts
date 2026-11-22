/**
 * The three toast kinds of the Pretty ID event, defined once.
 *
 * Every Pretty ID composable routes its toasts through here so the colours and
 * icons stay uniform. The message goes in `title` alone.
 */

export interface PrettyIdToaster {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

export function usePrettyIdToast(): PrettyIdToaster {
  const toast = useToast()

  return {
    success: (message) => {
      toast.add({ title: message, color: 'success', icon: 'i-lucide-circle-check' })
    },
    error: (message) => {
      toast.add({ title: message, color: 'error', icon: 'i-lucide-circle-alert' })
    },
    info: (message) => {
      toast.add({ title: message, color: 'info', icon: 'i-lucide-info' })
    },
  }
}
