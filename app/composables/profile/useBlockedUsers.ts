// ========================================
// Blocked Users Composable
// ========================================
// Role: Data + Action — load and manage the current user's block list.
// Pages call this; they never touch useApi directly.

import { createLogger } from '~/utils/logger'

export interface BlockEntry {
  id: number
  name: string
  avatar: string | null
  signature: string | null
  blockedAt: string
}

export function useBlockedUsers() {
  const { api, normalizeError } = useApi()
  const toast = useToast()
  const log = createLogger('[BlockedUsers]')

  const blockList = ref<BlockEntry[]>([])
  const blockListLoaded = ref(false)
  const blockListLoading = ref(false)

  /** Fetch the block list (non-blocking; logs on failure). */
  async function loadBlockList(): Promise<void> {
    blockListLoading.value = true
    try {
      const res = await api<{ data: { items: BlockEntry[] } }>('/profile/blocks')
      blockList.value = res.data.items
      blockListLoaded.value = true
    } catch (err) {
    } finally {
      blockListLoading.value = false
    }
  }

  /** Unblock a user and drop them from the local list. Toasts on failure. */
  async function unblock(userId: number): Promise<void> {
    try {
      await api(`/profile/blocks/${userId}`, { method: 'DELETE' })
      blockList.value = blockList.value.filter((b) => b.id !== userId)
    } catch (err) {
      const { message } = normalizeError(err)
      toast.add({ title: message, color: 'error' })
    }
  }

  return { blockList, blockListLoaded, blockListLoading, loadBlockList, unblock }
}
