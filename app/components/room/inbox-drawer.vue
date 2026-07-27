<script setup lang="ts">
/**
 * Room Inbox Drawer
 *
 * In-room bottom drawer mirroring the /inbox page (minus NavAlt): friends
 * carousel + DM threads + message requests. Lets users check messages
 * without leaving the room. Trigger button mirrors the home-footer inbox
 * button, including the unread badge. Tapping a thread swaps the drawer to
 * an embedded InboxThreadPanel (same component as /inbox/[id] and
 * RoomChatDrawer) instead of navigating away.
 */
import { createLogger } from '~/utils/logger'

const log = createLogger('[RoomInboxDrawer]')

const isOpen = ref(false)
const isClientHydrated = ref(false)

// Non-null = drawer shows the embedded thread view instead of the list.
const activeThreadId = ref<string | null>(null)

function openThread(threadId: string | number): void {
  activeThreadId.value = String(threadId)
}

function backToList(): void {
  activeThreadId.value = null
}

// Online-friend card tap → open (or start) the DM thread inside the drawer.
async function handleFriendChat(user: { id: number }): Promise<void> {
  const thread = await startThread(String(user.id))
  if (thread) openThread(thread.id)
}

const store = useInboxStore()
const { fetchThreads, loadMoreThreads, startThread } = useInboxActions()
const { fetchRankedFollowing } = useFollowingData()
const presenceStore = usePresenceStore()

const rankedFollowing = ref<Awaited<ReturnType<typeof fetchRankedFollowing>>>([])
const followingLoaded = ref(false)

// Candidate ids for the strip must stay presence-subscribed; the strip
// itself renders only the online subset (see onlineFollowing below).
const followingCandidateIds = computed(() => rankedFollowing.value?.map(u => u.id) ?? [])
const onlineFollowing = computed(
  () => rankedFollowing.value?.filter(u => presenceStore.onlineByUserId[u.id] === true) ?? [],
)

const { stop: stopPresence } = useDmPresence({ stripUserIds: followingCandidateIds })

onBeforeUnmount(() => {
  stopPresence()
})

onMounted(() => {
  isClientHydrated.value = true
})

const inboxBadge = computed(() => {
  const count = store.dmUnread
  if (count === 0) return null
  return count > 99 ? '99+' : String(count)
})

// Lazy-load inbox data on first open — never blocks room render.
watch(isOpen, async (open) => {
  if (!open) {
    // Fresh list next open; also unmounts the thread panel (messages fetch,
    // typing socket) so a closed drawer costs nothing.
    activeThreadId.value = null
    return
  }
  try {
    if (!store.threadsLoaded) await fetchThreads()
    if (!followingLoaded.value) {
      rankedFollowing.value = await fetchRankedFollowing()
      followingLoaded.value = true
    }
  } catch (error) {
    log.warn('Failed to load inbox data', error)
  }
})
</script>

<template>
  <UDrawer
    v-model:open="isOpen"
    title="Messages"
    description="Your followers and inbox messages"
    :ui="{ content: 'h-[85dvh]', body: 'p-0 flex-1 min-h-0 flex flex-col' }"
  >
    <!-- Trigger — mirrors home-footer inbox button (icon + unread badge) -->
    <UButton
      class="flex-middle relative text-primary p-0"
      :aria-label="isClientHydrated && inboxBadge ? `Inbox, ${inboxBadge} unread` : 'Inbox'"
      variant="ghost"
      square
      size="xl"
    >
      <UIcon class="size-8 drop-shadow-md" name="i-lucide-message-circle" />
      <span
        v-if="isClientHydrated && inboxBadge"
        class="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center"
      >
        {{ inboxBadge }}
      </span>
    </UButton>

    <template #content>
      <!-- ── Thread view ─────────────────────────────── -->
      <InboxThreadPanel
        v-if="activeThreadId"
        :thread-id="activeThreadId"
        :fixed-header="false"
        class="flex-1 min-h-0"
        @exit="backToList"
      />

      <!-- ── Thread list ─────────────────────────────── -->
      <div v-else class="overflow-y-auto overscroll-contain safe-area-bottom pb-6">
        <!-- Loading skeleton -->
        <div v-if="store.threadsLoading && !store.threadsLoaded" class="divide-y divide-muted/10">
          <div v-for="i in 6" :key="i" class="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div class="size-12 rounded-full bg-muted/30 shrink-0" />
            <div class="flex-1 space-y-2">
              <div class="h-3.5 bg-muted/30 rounded w-2/5" />
              <div class="h-3 bg-muted/20 rounded w-3/5" />
            </div>
          </div>
        </div>

        <template v-else>
          <template v-if="onlineFollowing.length > 0">
            <SectionTitle class="ml-3">Friends</SectionTitle>
            <HomeFollowingCarousel :users="onlineFollowing" tap-action="chat" class="mx-3" @chat="handleFriendChat" />
          </template>

          <!-- ── DM Threads ────────────────────────────── -->
          <div v-if="store.dmThreads.length > 0" class="divide-y divide-muted/10">
            <button
              v-for="thread in store.dmThreads"
              :key="thread.id"
              type="button"
              class="block w-full text-left"
              @click="openThread(thread.id)"
            >
              <InboxThreadItem :thread="thread" />
            </button>
          </div>

          <!-- ── Load more DM threads ─────────────────────── -->
          <div v-if="store.dmNextCursor" class="flex justify-center py-3">
            <UButton
              variant="ghost"
              size="sm"
              :loading="store.threadsLoading"
              @click="loadMoreThreads"
            >
              Load more
            </UButton>
          </div>

          <!-- ── Requests ───────────────────────────────── -->
          <template v-if="store.requestThreads.length > 0">
            <div class="px-4 pt-5 pb-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">
                Message Requests
                <span class="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px]">
                  {{ store.requestThreads.length }}
                </span>
              </p>
            </div>
            <div class="divide-y divide-muted/10">
              <button
                v-for="thread in store.requestThreads"
                :key="thread.id"
                type="button"
                class="block w-full text-left"
                @click="openThread(thread.id)"
              >
                <InboxThreadItem :thread="thread" />
              </button>
            </div>
          </template>

          <!-- Empty state -->
          <div
            v-if="store.dmThreads.length === 0 && store.requestThreads.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center px-6"
          >
            <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UIcon name="i-lucide-message-circle" class="size-8 text-primary" />
            </div>
            <p class="text-sm text-muted">No conversations yet.</p>
            <p class="text-xs text-muted/60 mt-1">Visit someone's profile to start chatting.</p>
          </div>
        </template>
      </div>
    </template>
  </UDrawer>
</template>
