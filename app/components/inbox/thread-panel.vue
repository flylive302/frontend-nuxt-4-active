<script setup lang="ts">
// Single-thread chat UI shared by the full-page /inbox/[threadId] route AND
// the in-room chat drawer (RoomChatDrawer) — one component so the thread
// never looks different between the two surfaces.
const props = withDefaults(
  defineProps<{
    threadId: string
    /** Header uses `position: fixed` on the full page; the drawer contains it instead. */
    fixedHeader?: boolean
  }>(),
  { fixedHeader: true },
)

// Emitted whenever the panel wants to leave the thread (chat deleted, user
// blocked, request denied). Page navigates to /inbox; drawer just closes.
const emit = defineEmits<{ (e: 'exit'): void }>()

// ── Composables ───────────────────────────────────────
const store = useInboxStore()
const { loadMessages, loadOlderMessages, sendMessage, markRead, fetchThreads } = useInboxActions()
const { acceptRequest, denyRequest, unsendMessage, deleteMessage, deleteThread, blockUser } = useInboxThread()
const { isOtherTyping, sendTyping, listenForTyping, stopListening } = useTypingIndicator()
const { resolvePropAsset } = usePropLookup()
const authStore = useAuthStore()

// ── Date separator helper ─────────────────────────────
function shouldShowDate(index: number): boolean {
  if (index === 0) return true
  const prev = store.messages[index - 1]
  const curr = store.messages[index]
  if (!prev || !curr) return false
  const prevDate = new Date(prev.sentAt).toDateString()
  const currDate = new Date(curr.sentAt).toDateString()
  return prevDate !== currDate
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Thread meta ───────────────────────────────────────
const thread = computed(() => store.threadById(props.threadId))
const isRequest = computed(() => thread.value?.kind === 'request')

// ── Scroll ────────────────────────────────────────────
const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom(smooth = false): void {
  nextTick(() => {
    if (!scrollEl.value) return
    scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  })
}

watch(() => store.messages.length, () => {
  if (store.activeThreadId === props.threadId) scrollToBottom(true)
})

// ── Long-press message action ─────────────────────────
const selectedMessageId = ref<string | null>(null)
const showMessageMenu = ref(false)

function onLongPress(messageId: string): void {
  selectedMessageId.value = messageId
  showMessageMenu.value = true
}

const selectedMessage = computed(() => store.messages.find(m => String(m.id) === String(selectedMessageId.value)))

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
  await acceptRequest(props.threadId)
  accepting.value = false
}

async function handleDeny(): Promise<void> {
  denying.value = true
  const ok = await denyRequest(props.threadId)
  denying.value = false
  if (ok) emit('exit')
}

// ── Send ──────────────────────────────────────────────
async function handleSend(content: string): Promise<void> {
  await sendMessage(props.threadId, content)
}

// ── Block / Delete Chat / Report ──────────────────────
const showBlockConfirm = ref(false)
const showDeleteConfirm = ref(false)
const showReportModal = ref(false)

function handleBlock(): void {
  showBlockConfirm.value = true
}

function handleDeleteChat(): void {
  showDeleteConfirm.value = true
}

function handleReport(): void {
  showReportModal.value = true
}

async function confirmBlock(): Promise<void> {
  showBlockConfirm.value = false
  if (!thread.value) return
  const ok = await blockUser(thread.value.participant.id)
  if (ok) emit('exit')
}

async function confirmDeleteChat(): Promise<void> {
  showDeleteConfirm.value = false
  const ok = await deleteThread(props.threadId)
  if (ok) emit('exit')
}

// ── Init ──────────────────────────────────────────────
onMounted(async () => {
  // Ensure thread list is loaded (needed for thread metadata: kind, isInitiator)
  if (!store.threadsLoaded) {
    await fetchThreads()
  }
  await loadMessages(props.threadId)
  await markRead(props.threadId)
  listenForTyping(props.threadId)
  scrollToBottom()
})

onBeforeUnmount(() => {
  stopListening(props.threadId)
  // Clear active thread so incoming messages correctly bump unread badge
  if (store.activeThreadId === props.threadId) store.activeThreadId = null
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <InboxThreadHeader
      :fixed="fixedHeader"
      :name="thread?.participant.name ?? ''"
      :avatar="thread?.participant.avatar"
      :frame="resolvePropAsset(thread?.participant.frame_id) ?? undefined"
      :signature="thread?.participant.signature"
      :gender="thread?.participant.gender"
      @block="handleBlock"
      @delete-chat="handleDeleteChat"
      @report="handleReport"
      @back="emit('exit')"
    />

    <!-- Messages -->
    <div ref="scrollEl" class="flex-1 overflow-y-auto pb-2 flex flex-col" :class="fixedHeader ? 'pt-14' : ''">
      <!-- Loading -->
      <div v-if="store.messagesLoading && store.messages.length === 0" class="space-y-3 px-3 pt-6">
        <div v-for="i in 4" :key="i" class="animate-pulse flex" :class="i % 2 === 0 ? 'justify-end' : 'justify-start'">
          <div class="h-10 bg-muted/30 rounded-2xl" :class="i % 2 === 0 ? 'w-40' : 'w-52'" />
        </div>
      </div>

      <!-- Empty -->
      <div
        v-else-if="store.messages.length === 0 && !store.messagesLoading"
        class="flex flex-col items-center justify-center py-16 text-center px-6 flex-1"
      >
        <div class="size-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <UIcon name="i-lucide-message-circle" class="size-7 text-primary" />
        </div>
        <p class="text-sm text-muted">No messages yet. Say hello!</p>
      </div>

      <template v-else>
        <!-- Spacer pushes messages to bottom like WhatsApp -->
        <div class="flex-1" />

        <!-- Load older button -->
        <div v-if="store.messagesHasMore && store.messages.length > 0" class="flex justify-center py-2">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="store.messagesLoading"
            @click="loadOlderMessages(threadId)"
          >
            Load older
          </UButton>
        </div>

        <!-- Message bubbles with date separators -->
        <template v-for="(msg, idx) in store.messages" :key="msg.id">
          <!-- Date separator -->
          <div v-if="shouldShowDate(idx)" class="flex justify-center py-2">
            <span class="text-[10px] text-muted bg-elevated/80 px-3 py-1 rounded-full">
              {{ formatDateLabel(msg.sentAt) }}
            </span>
          </div>
          <InboxMessageBubble
            :message="msg"
            @long-press="onLongPress(msg.id)"
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
      @typing="sendTyping"
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
    <!-- Block confirm dialog -->
    <UModal v-model:open="showBlockConfirm">
      <template #content>
        <div class="p-5 text-center space-y-4">
          <div class="size-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <UIcon name="i-lucide-ban" class="size-6 text-red-500" />
          </div>
          <p class="text-sm font-medium">Block {{ thread?.participant.name }}?</p>
          <p class="text-xs text-muted">They won't be able to send you messages or find your profile.</p>
          <div class="flex gap-2">
            <UButton class="flex-1" color="neutral" variant="outline" @click="showBlockConfirm = false">Cancel</UButton>
            <UButton class="flex-1" color="error" @click="confirmBlock">Block</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Report user modal -->
    <ReportModal
      v-if="thread?.participant.id"
      v-model:open="showReportModal"
      reportable-type="user"
      :reportable-id="Number(thread.participant.id)"
    />

    <!-- Delete chat confirm dialog -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <div class="p-5 text-center space-y-4">
          <div class="size-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <UIcon name="i-lucide-trash-2" class="size-6 text-red-500" />
          </div>
          <p class="text-sm font-medium">Delete this conversation?</p>
          <p class="text-xs text-muted">Messages will be removed for you only. The other person will still see them.</p>
          <div class="flex gap-2">
            <UButton class="flex-1" color="neutral" variant="outline" @click="showDeleteConfirm = false">Cancel</UButton>
            <UButton class="flex-1" color="error" @click="confirmDeleteChat">Delete</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
