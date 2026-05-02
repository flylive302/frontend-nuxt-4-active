// ========================================
// Typing Indicator Composable
// ========================================
// Manages typing indicator state for the active thread.
// Uses Reverb whisper events (client-to-client, no backend persistence).

export function useTypingIndicator() {
  const { $echo } = useNuxtApp()
  const authStore = useAuthStore()
  const store = useInboxStore()

  const isOtherTyping = ref(false)
  let typingTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Send a typing whisper to the other participant.
   */
  function sendTyping(): void {
    const threadId = store.activeThreadId
    if (!threadId) return

    const channel = $echo.private(`dm.thread.${threadId}`)
    channel.whisper('typing', { userId: authStore.user?.id })
  }

  /**
   * Listen for typing whispers from the other participant.
   */
  function listenForTyping(threadId: string): void {
    const channel = $echo.private(`dm.thread.${threadId}`)
    channel.listenForWhisper('typing', () => {
      isOtherTyping.value = true

      // Auto-dismiss after 3 seconds of inactivity
      if (typingTimeout) clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => {
        isOtherTyping.value = false
      }, 3000)
    })
  }

  function stopListening(threadId: string): void {
    isOtherTyping.value = false
    if (typingTimeout) clearTimeout(typingTimeout)
    $echo.leave(`dm.thread.${threadId}`)
  }

  return {
    isOtherTyping: readonly(isOtherTyping),
    sendTyping,
    listenForTyping,
    stopListening,
  }
}
