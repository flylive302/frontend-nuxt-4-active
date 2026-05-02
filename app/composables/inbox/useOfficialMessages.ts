// ========================================
// Official Messages Composable
// ========================================
// Manages fetching, pagination, and read-marking for official/system messages.
// Extracted from pages/inbox/official.vue per architecture rules.

import type { OfficialMessage } from '~/types/inbox'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useOfficialMessages]')

export function useOfficialMessages() {
  const { api } = useApi()
  const store = useInboxStore()

  // ── State ─────────────────────────────────────────────
  const messages = ref<OfficialMessage[]>([])
  const loading = ref(false)
  const nextCursor = ref<string | null>(null)

  // ── Fetch ─────────────────────────────────────────────
  async function fetchMessages(): Promise<void> {
    loading.value = true
    try {
      const res = await api<{ data: OfficialMessage[], meta: { next_cursor: string | null } }>(
        '/inbox/official',
      )
      messages.value = res.data
      nextCursor.value = res.meta.next_cursor
    }
    catch (err) {
      log.error('fetchMessages failed:', err)
    }
    finally {
      loading.value = false
    }
  }

  async function loadOlder(): Promise<void> {
    if (!nextCursor.value || loading.value) return
    loading.value = true
    try {
      const res = await api<{ data: OfficialMessage[], meta: { next_cursor: string | null } }>(
        `/inbox/official?cursor=${nextCursor.value}`,
      )
      messages.value = [...messages.value, ...res.data]
      nextCursor.value = res.meta.next_cursor
    }
    catch (err) {
      log.error('loadOlder failed:', err)
    }
    finally {
      loading.value = false
    }
  }

  async function markRead(): Promise<void> {
    try {
      await api('/inbox/official/read', { method: 'POST' })
      store.clearOfficialUnread()
    }
    catch (err) {
      log.error('markRead failed:', err)
    }
  }

  return {
    messages: readonly(messages),
    loading: readonly(loading),
    nextCursor: readonly(nextCursor),
    fetchMessages,
    loadOlder,
    markRead,
  }
}
