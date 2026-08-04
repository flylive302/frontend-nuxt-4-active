<script setup lang="ts">
// Single-thread chat UI shared by the full-page /inbox/[threadId] route AND
// the in-room chat drawer (RoomChatDrawer) — one component so the thread
// never looks different between the two surfaces.
import type { MediaContentPayload } from '~/types/inbox'
import type { MessageGroupPosition } from '~/utils/dm-thread-view'
import { computeGroupPosition, formatDaySeparatorLabel, shouldShowDaySeparator } from '~/utils/dm-thread-view'
import { dmMessageCopyText } from '~/utils/dm-message-preview'

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
const { loadOlderMessages, sendMessage, markRead } = useInboxActions()
const { pickImage, cancelUpload, retryUpload, discardFailed } = useDmComposer()
const { reconcileInbox } = useInboxReconcile()
const { acceptRequest, denyRequest, unsendMessage, deleteMessage, deleteThread, blockUser } = useInboxThread()
const { isOtherTyping, sendTyping, listenForTyping, stopListening } = useTypingIndicator()
const { resolvePropAsset } = usePropLookup()
const authStore = useAuthStore()
const toast = useToast()

// ── Grouping / day separators (pure derivation, dm-messenger-v2/07) ──
function groupPosition(index: number): MessageGroupPosition {
  return computeGroupPosition(store.messages, index)
}

function showDaySeparator(index: number): boolean {
  return shouldShowDaySeparator(store.messages, index)
}

function daySeparatorLabel(dateStr: string): string {
  return formatDaySeparatorLabel(dateStr)
}

function groupWrapperClass(index: number): string[] {
  const pos = groupPosition(index)
  const msg = store.messages[index]
  return [
    'thread-msg',
    `thread-msg--${pos}`,
    msg?.isOwn ? 'thread-msg--own' : 'thread-msg--peer',
  ]
}

// ── Thread meta ───────────────────────────────────────
const thread = computed(() => store.threadById(props.threadId))
const isRequest = computed(() => thread.value?.kind === 'request')

// dm-realtime-platform/07: presence dot for the header.
const presenceStore = usePresenceStore()
const isPeerOnline = computed(() => {
  const peerId = thread.value?.participant.id
  if (peerId === undefined) return false
  return presenceStore.onlineByUserId[Number(peerId)] === true
})

// ── Scroll (dm-messenger-v2/07: scroll-to-bottom pill) ────
const scrollEl = ref<HTMLElement | null>(null)
const threadMessages = computed(() => store.messages)
const { isScrolledUp, newMessageCount, scrollToBottom, onScroll, jumpToBottom } = useThreadScrollPill(scrollEl, threadMessages)

// ── Lightbox (dm-messenger-v2/03) ─────────────────────
// Bubble emits `open-image` with the full media payload; the lightbox owns
// its own gesture/open state internally, we just call its exposed `open()`
// with the asset URL.
const lightboxRef = ref<{ open: (url: string) => void } | null>(null)

function onOpenImage(payload: MediaContentPayload): void {
  lightboxRef.value?.open(payload.url)
}

// ── Long-press message action ─────────────────────────
const selectedMessageId = ref<string | null>(null)
const showMessageMenu = ref(false)

function onLongPress(messageId: string): void {
  selectedMessageId.value = messageId
  showMessageMenu.value = true
}

const selectedMessage = computed(() => store.messages.find(m => String(m.id) === String(selectedMessageId.value)))

// Copy: text messages copy their text, media/voice copy the asset URL;
// null (unsent/unresolvable) hides the option entirely.
const copyableText = computed(() => {
  const msg = selectedMessage.value
  if (!msg) return null
  return dmMessageCopyText(msg)
})

async function handleCopy(): Promise<void> {
  if (!copyableText.value) return
  try {
    await navigator.clipboard.writeText(copyableText.value)
    toast.add({ title: 'Copied', icon: 'i-lucide-clipboard-check', color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy to clipboard.', color: 'error' })
  }
  showMessageMenu.value = false
}

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

function handlePickImage(file: File): void {
  pickImage(props.threadId, file)
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
  // Thread-open reconcile trigger (issue 03, dm-realtime-platform): refetches
  // thread list + unread counts (covers metadata like kind/isInitiator) and,
  // since activeThreadId is now set, this thread's tail.
  store.activeThreadId = props.threadId
  await reconcileInbox('thread-open')
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
  <div class="flex flex-col h-full overflow-hidden relative">
    <!-- Header -->
    <InboxThreadHeader
      :fixed="fixedHeader"
      :name="thread?.participant.name ?? ''"
      :avatar="thread?.participant.avatar"
      :frame="resolvePropAsset(thread?.participant.frame_id) ?? undefined"
      :signature="thread?.participant.signature"
      :gender="thread?.participant.gender"
      :online="isPeerOnline"
      :last-seen-at="thread?.participant.lastSeenAt ?? null"
      @block="handleBlock"
      @delete-chat="handleDeleteChat"
      @report="handleReport"
      @back="emit('exit')"
    />

    <!-- Messages -->
    <div
      ref="scrollEl"
      class="flex-1 overflow-y-auto pb-2 flex flex-col"
      :class="fixedHeader ? 'pt-[calc(3.5rem+env(safe-area-inset-top,0px))]' : ''"
      @scroll.passive="onScroll"
    >
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

        <!-- Message bubbles: grouped clusters + day separators (dm-messenger-v2/07) -->
        <template v-for="(msg, idx) in store.messages" :key="msg.id">
          <!-- Day separator -->
          <div v-if="showDaySeparator(idx)" class="flex justify-center py-2">
            <span class="text-[10px] font-medium text-muted bg-elevated/80 px-3 py-1 rounded-full">
              {{ daySeparatorLabel(msg.sentAt) }}
            </span>
          </div>
          <div :class="groupWrapperClass(idx)">
            <InboxMessageBubble
              :message="msg"
              :peer-seen-up-to-message-id="thread?.peerSeenUpToMessageId ?? null"
              @long-press="onLongPress(msg.id)"
              @cancel-upload="cancelUpload(msg.id)"
              @retry-upload="retryUpload(msg.id)"
              @discard-failed="discardFailed(msg.id)"
              @open-image="onOpenImage"
            />
          </div>
        </template>

        <!-- Typing indicator -->
        <div v-if="isOtherTyping" class="flex justify-start px-3 mb-1.5">
          <div class="bg-elevated rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
            <span class="typing-dot size-1.5 bg-muted rounded-full" />
            <span class="typing-dot size-1.5 bg-muted rounded-full" />
            <span class="typing-dot size-1.5 bg-muted rounded-full" />
          </div>
        </div>
      </template>
    </div>

    <!-- Scroll-to-bottom pill (dm-messenger-v2/07) -->
    <Transition name="scroll-pill">
      <button
        v-if="isScrolledUp"
        type="button"
        class="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full bg-elevated/95 backdrop-blur border border-muted/20 shadow-lg px-3.5 py-2 text-xs font-medium text-default active:scale-95 transition-transform"
        :class="fixedHeader ? 'bottom-24' : 'bottom-20'"
        @click="jumpToBottom"
      >
        <UIcon name="i-lucide-chevron-down" class="size-4" />
        <span v-if="newMessageCount > 0">{{ newMessageCount > 99 ? '99+' : newMessageCount }} new</span>
      </button>
    </Transition>

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
      @pick-image="handlePickImage"
    />

    <!-- Message action sheet -->
    <UModal v-model:open="showMessageMenu">
      <template #content>
        <div class="p-4 space-y-1">
          <UButton
            v-if="copyableText"
            block
            variant="ghost"
            color="neutral"
            icon="i-lucide-copy"
            @click="handleCopy"
          >
            Copy
          </UButton>
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

    <!-- Full-screen image lightbox (dm-messenger-v2/03) -->
    <InboxImageLightbox ref="lightboxRef" />

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

<style scoped>
/* ── Same-sender clustering (dm-messenger-v2/07) ──────────────────────── */
/* message-bubble.vue owns its own mb-1.5 + corner radii; we tighten/round
   via :deep() from the wrapper rather than editing that component (owned
   by a parallel agent — see issue 07). */

/* Tight spacing: first/middle of a cluster sit close to the next bubble. */
.thread-msg--first :deep(.mb-1\.5),
.thread-msg--middle :deep(.mb-1\.5) {
  margin-bottom: 2px;
}

/* Own messages (right-aligned, bg-primary): flatten the tail-side corner
   that isn't the actual tail of the cluster. */
.thread-msg--own.thread-msg--first :deep(.bg-primary),
.thread-msg--own.thread-msg--middle :deep(.bg-primary) {
  border-bottom-right-radius: 6px;
}
.thread-msg--own.thread-msg--middle :deep(.bg-primary),
.thread-msg--own.thread-msg--last :deep(.bg-primary) {
  border-top-right-radius: 6px;
}

/* Peer messages (left-aligned, bg-elevated): same treatment, mirrored. */
.thread-msg--peer.thread-msg--first :deep(.bg-elevated),
.thread-msg--peer.thread-msg--middle :deep(.bg-elevated) {
  border-bottom-left-radius: 6px;
}
.thread-msg--peer.thread-msg--middle :deep(.bg-elevated),
.thread-msg--peer.thread-msg--last :deep(.bg-elevated) {
  border-top-left-radius: 6px;
}

/* Single timestamp/tick per cluster: only the last bubble in a group shows
   its meta row (time + read receipt); earlier bubbles in the same cluster
   hide theirs, matching WhatsApp/IG-style grouping. */
.thread-msg--first :deep(.text-\[10px\]),
.thread-msg--middle :deep(.text-\[10px\]) {
  display: none;
}

/* ── Typing indicator dots ────────────────────────────────────────────
   WhatsApp-style stagger: each dot lifts + brightens in sequence. A custom
   keyframe (not animate-bounce) so the rise is small and the opacity pulse
   reads clearly at size-1.5. */
.typing-dot {
  animation: typing-dot 1.2s ease-in-out infinite;
  opacity: 0.4;
}
.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes typing-dot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* ── Scroll-to-bottom pill transition ─────────────────────────────────── */
.scroll-pill-enter-active,
.scroll-pill-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.scroll-pill-enter-from,
.scroll-pill-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>

