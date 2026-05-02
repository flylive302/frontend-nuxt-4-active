<script setup lang="ts">
definePageMeta({ layout: 'alt', middleware: 'auth' })

// ── Route ──────────────────────────────────────────────
const route = useRoute()
const threadId = computed(() => route.params.threadId as string)

// ── Composables ───────────────────────────────────────
const store = useInboxStore()
const { loadMessages, sendMessage, markRead } = useInboxActions()
const { acceptRequest, denyRequest, unsendMessage, deleteMessage } = useInboxThread()

// ── Thread meta ───────────────────────────────────────
const thread = computed(() => store.threadById(threadId.value))
const isRequest = computed(() => thread.value?.kind === 'request')
const authStore = useAuthStore()

// ── Scroll ────────────────────────────────────────────
const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom(smooth = false): void {
  nextTick(() => {
    if (!scrollEl.value) return
    scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  })
}

watch(() => store.messages.length, () => {
  if (store.activeThreadId === threadId.value) scrollToBottom(true)
})

// ── Long-press message action ─────────────────────────
const selectedMessageId = ref<string | null>(null)
const showMessageMenu = ref(false)

function onLongPress(messageId: string): void {
  selectedMessageId.value = messageId
  showMessageMenu.value = true
}

const selectedMessage = computed(() => store.messages.find(m => m.id === selectedMessageId.value))

async function handleDelete(): Promise<void> {
  if (!selectedMessageId.value) return
  await deleteMessage(selectedMessageId.value)
  showMessageMenu.value = false
}

async function handleUnsend(): Promise<void> {
  if (!selectedMessageId.value) return
  await unsendMessage(selectedMessageId.value)
  showMessageMenu.value = false
}

// ── Accept / Deny request ─────────────────────────────
const accepting = ref(false)
const denying = ref(false)

async function handleAccept(): Promise<void> {
  accepting.value = true
  await acceptRequest(threadId.value)
  accepting.value = false
}

async function handleDeny(): Promise<void> {
  denying.value = true
  const ok = await denyRequest(threadId.value)
  denying.value = false
  if (ok) await navigateTo('/inbox', { replace: true })
}

// ── Send ──────────────────────────────────────────────
async function handleSend(content: string): Promise<void> {
  await sendMessage(threadId.value, content)
}

// ── Init ──────────────────────────────────────────────
onMounted(async () => {
  await loadMessages(threadId.value)
  await markRead(threadId.value)
  scrollToBottom()
})
</script>

<template>
  <main class="flex flex-col h-dvh overflow-hidden">
    <!-- Header -->
    <InboxThreadHeader
      :name="thread?.participant.name ?? ''"
      :avatar="thread?.participant.avatar"
      :frame="thread?.participant.frame"
    />

    <!-- Messages -->
    <div ref="scrollEl" class="flex-1 overflow-y-auto pt-14 pb-2">
      <!-- Loading -->
      <div v-if="store.messagesLoading && store.messages.length === 0" class="space-y-3 px-3 pt-6">
        <div v-for="i in 4" :key="i" class="animate-pulse flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
          <div class="h-10 bg-muted/30 rounded-2xl" :class="i % 2 === 0 ? 'w-40' : 'w-52'" />
        </div>
      </div>

      <!-- Empty -->
      <div
        v-else-if="store.messages.length === 0 && !store.messagesLoading"
        class="flex flex-col items-center justify-center py-16 text-center px-6"
      >
        <div class="size-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <UIcon name="i-lucide-message-circle" class="size-7 text-primary" />
        </div>
        <p class="text-sm text-muted">No messages yet. Say hello!</p>
      </div>

      <!-- Message bubbles -->
      <template v-else>
        <InboxMessageBubble
          v-for="msg in store.messages"
          :key="msg.id"
          :message="msg"
          @long-press="onLongPress(msg.id)"
        />
      </template>
    </div>

    <!-- Request banner — recipient view -->
    <div v-if="isRequest && !thread?.isInitiator" class="px-4 py-3 bg-elevated border-t border-muted/20">
      <p class="text-xs text-muted text-center mb-3">
        <span class="font-semibold text-default">{{ thread?.participant.name }}</span>
        sent you a message request
        <span v-if="thread?.requestMessageCount">
          ({{ thread.requestMessageCount }} message{{ thread.requestMessageCount > 1 ? 's' : '' }})
        </span>
      </p>
      <div class="flex gap-2">
        <UButton
          class="flex-1"
          size="sm"
          :loading="accepting"
          @click="handleAccept"
        >
          Accept
        </UButton>
        <UButton
          class="flex-1"
          size="sm"
          color="neutral"
          variant="outline"
          :loading="denying"
          @click="handleDeny"
        >
          Deny
        </UButton>
      </div>
    </div>

    <!-- Request banner — initiator view (waiting) -->
    <div v-else-if="isRequest && thread?.isInitiator" class="px-4 py-2 bg-elevated border-t border-muted/20">
      <p class="text-xs text-muted text-center">
        Waiting for <span class="font-semibold text-default">{{ thread?.participant.name }}</span> to accept your request
        <span v-if="thread?.requestMessageCount !== undefined">
          · {{ thread.requestMessageCount }}/{{ 5 }} messages sent
        </span>
      </p>
    </div>

    <!-- Message input — shown for both DM and request senders -->
    <InboxMessageInput
      v-if="authStore.user?.id !== null"
      @send="handleSend"
    />

    <!-- Message action sheet -->
    <UModal v-model:open="showMessageMenu">
      <template #content>
        <div class="p-4 space-y-1">
          <UButton
            v-if="selectedMessage?.isOwn"
            block
            variant="ghost"
            color="error"
            icon="i-lucide-rotate-ccw"
            @click="handleUnsend"
          >
            Unsend for everyone
          </UButton>
          <UButton
            block
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            @click="handleDelete"
          >
            Delete for me
          </UButton>
          <UButton
            block
            variant="ghost"
            color="neutral"
            @click="showMessageMenu = false"
          >
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </main>
</template>
