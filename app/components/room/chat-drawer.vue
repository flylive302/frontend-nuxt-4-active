<script setup lang="ts">
// In-room chat drawer — opens a DM thread with a participant without leaving
// the room. Reuses InboxThreadPanel so the thread looks identical to /inbox.
//
// Perf: the thread panel (messages fetch, typing socket) only mounts while
// the drawer is open (`v-if`, not `v-show`) — closed, this component costs
// nothing beyond the store watcher, unlike UDrawer content which is real DOM.
import { createLogger } from '~/utils/logger'

const log = createLogger('[RoomChatDrawer]')

const seatsStore = useRoomSeatsStore()
const { startThread } = useInboxActions()

const isOpen = ref(false)
const threadId = ref<string | null>(null)
const isLoading = ref(false)

watch(
  () => seatsStore.chatDrawerUserId,
  async (userId) => {
    isOpen.value = userId !== null
    if (userId === null) {
      threadId.value = null
      return
    }
    isLoading.value = true
    threadId.value = null
    try {
      const thread = await startThread(userId)
      // Bail if the drawer was closed (or reopened for someone else) while awaited.
      if (seatsStore.chatDrawerUserId !== userId) return
      threadId.value = thread ? String(thread.id) : null
    } catch (error) {
      log.warn('Failed to start thread', error)
    } finally {
      isLoading.value = false
    }
  },
)

function handleOpenChange(open: boolean): void {
  if (!open) seatsStore.closeChat()
}
</script>

<template>
  <UDrawer
    v-model:open="isOpen"
    title="Chat"
    description="Send and receive messages with this user."
    :ui="{ content: 'h-[85dvh]', body: 'p-0 flex-1 min-h-0' }"
    @update:open="handleOpenChange"
  >
    <template #content>
      <InboxThreadPanel
        v-if="threadId"
        :thread-id="threadId"
        :fixed-header="false"
        @exit="seatsStore.closeChat()"
      />
      <div v-else-if="isLoading" class="flex-1 flex items-center justify-center py-16">
        <UIcon name="i-lucide-loader-2" class="size-6 animate-spin text-muted" />
      </div>
    </template>
  </UDrawer>
</template>
