<script setup lang="ts">
import { NOTIFICATION_TYPE_CONFIG } from '~/types/notification/notification'
import { formatRelativeTime } from '~/utils/date'
import {useInboxActions} from "~/composables/inbox/useInboxActions";

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ── Route ──────────────────────────────────────────────
const route = useRoute()
const threadId = computed(() => route.params.id as string)
const isSystem = computed(() => threadId.value === 'system')

// ── Stores & composables ──────────────────────────────
const notificationStore = useNotificationStore()
const inboxStore = useInboxStore()
const { markAsRead, fetchNotifications } = useNotificationActions()
const { sendMessage } = useInboxActions()
const { reconcileInbox } = useInboxReconcile()
const { isOtherTyping, sendTyping, listenForTyping, stopListening } = useTypingIndicator()

// ── Active thread meta (DM only) ──────────────────────
const thread = computed(() => inboxStore.threadById(threadId.value))

// ── Header props ──────────────────────────────────────
const headerName = computed(() => isSystem.value ? 'Official' : (thread.value?.participant.name ?? ''))
const headerAvatar = computed(() => thread.value?.participant.avatar ?? null)
const headerFrameId = computed(() => thread.value?.participant.frame_id ?? null)

// ── Scroll container ──────────────────────────────────
const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom(smooth = false): void {
  nextTick(() => {
    if (!scrollEl.value) return
    scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  })
}

// ── System thread: notifications as message list ──────
const systemMessages = computed(() => notificationStore.items)

watch(
  () => systemMessages.value.length,
  () => { if (isSystem.value) scrollToBottom() },
)

// ── DM thread ──────────────────────────────────────────
watch(
  () => inboxStore.messages.length,
  () => { if (!isSystem.value) scrollToBottom(true) },
)

async function handleSend(content: string): Promise<void> {
  await sendMessage(threadId.value, content)
}

async function handleNotificationClick(id: string, readAt: string | null, actionUrl?: string): Promise<void> {
  if (!readAt) await markAsRead(id)
  if (actionUrl) navigateTo(actionUrl)
}

// ── Init ──────────────────────────────────────────────
onMounted(async () => {
  if (isSystem.value) {
    if (notificationStore.items.length === 0) await fetchNotifications(true)
    scrollToBottom()
  } else {
    // Thread-open reconcile trigger (issue 03, dm-realtime-platform).
    inboxStore.activeThreadId = threadId.value
    await reconcileInbox('thread-open')
    listenForTyping(threadId.value)
    scrollToBottom()
  }
})

onBeforeUnmount(() => {
  if (!isSystem.value) {
    stopListening(threadId.value)
    if (inboxStore.activeThreadId === threadId.value) inboxStore.activeThreadId = null
  }
})
</script>

<template>
  <main class="flex flex-col h-screen overflow-hidden">
    <!-- Header -->
    <InboxThreadHeader
      :name="headerName"
      :avatar="headerAvatar"
      :frame-id="headerFrameId"
      :is-system="isSystem"
    />

    <!-- ── SYSTEM THREAD ─────────────────────────────── -->
    <div
      v-if="isSystem"
      ref="scrollEl"
      class="flex-1 overflow-y-auto pt-14 pb-4 space-y-2"
    >
      <!-- Loading skeleton -->
      <div v-if="notificationStore.loading && notificationStore.items.length === 0" class="space-y-3 px-3 pt-4">
        <div v-for="i in 5" :key="i" class="animate-pulse flex gap-3">
          <div class="size-10 rounded-full bg-muted/30 shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-3.5 bg-muted/30 rounded w-3/4" />
            <div class="h-3 bg-muted/20 rounded w-1/2" />
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="notificationStore.items.length === 0" class="flex flex-col items-center justify-center py-16 text-center px-6">
        <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-bell-off" class="size-8 text-primary" />
        </div>
        <p class="text-sm text-muted">No official messages yet.</p>
      </div>

      <!-- Notification items as chat bubbles -->
      <template v-else>
        <div
          v-for="n in notificationStore.items"
          :key="n.id"
          class="px-3"
          @click="handleNotificationClick(n.id, n.read_at, n.action_url)"
        >
          <div class="flex gap-2.5 cursor-pointer group">
            <!-- Icon -->
            <div
              class="size-9 rounded-full shrink-0 flex items-center justify-center mt-0.5"
              :class="`bg-${NOTIFICATION_TYPE_CONFIG[n.type]?.color ?? 'neutral'}/15`"
            >
              <icon
                :name="NOTIFICATION_TYPE_CONFIG[n.type]?.icon ?? 'i-lucide-bell'"
                class="size-4.5"
                :class="`text-${NOTIFICATION_TYPE_CONFIG[n.type]?.color ?? 'neutral'}`"
              />
            </div>

            <!-- Bubble -->
            <div
              class="flex-1 rounded-2xl rounded-tl-sm px-3 py-2 transition-colors"
              :class="n.read_at ? 'bg-elevated' : 'bg-primary/10 border border-primary/20'"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-semibold leading-snug">{{ n.title }}</p>
                <span v-if="!n.read_at" class="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
              </div>
              <p class="text-sm text-muted mt-0.5 leading-snug">{{ n.body }}</p>
              <p class="text-[10px] text-muted/60 mt-1.5">{{ formatRelativeTime(n.created_at) }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ── DM THREAD ─────────────────────────────────── -->
    <div
      v-else
      ref="scrollEl"
      class="flex-1 overflow-y-auto pt-14 pb-2"
    >
      <!-- Loading -->
      <div v-if="inboxStore.messagesLoading" class="space-y-3 px-3 pt-6">
        <div v-for="i in 4" :key="i" class="animate-pulse flex justify-start">
          <div class="h-10 bg-muted/30 rounded-2xl w-48" />
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="inboxStore.messages.length === 0" class="flex flex-col items-center justify-center py-16 text-center px-6">
        <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-message-circle" class="size-8 text-primary" />
        </div>
        <p class="text-sm text-muted">No messages yet. Say hello!</p>
      </div>

      <!-- Messages -->
      <template v-else>
        <InboxMessageBubble
          v-for="msg in inboxStore.messages"
          :key="msg.id"
          :message="msg"
          :peer-seen-up-to-message-id="thread?.peerSeenUpToMessageId ?? null"
        />
      </template>

      <!-- Typing indicator -->
      <div v-if="isOtherTyping" class="flex justify-start px-3 mb-1.5">
        <div class="bg-elevated rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
          <span class="size-1.5 bg-muted rounded-full animate-bounce" style="animation-delay: 0ms" />
          <span class="size-1.5 bg-muted rounded-full animate-bounce" style="animation-delay: 150ms" />
          <span class="size-1.5 bg-muted rounded-full animate-bounce" style="animation-delay: 300ms" />
        </div>
      </div>
    </div>

    <!-- Send input — DM only -->
    <InboxMessageInput v-if="!isSystem" @send="handleSend" @typing="sendTyping" />
  </main>
</template>
