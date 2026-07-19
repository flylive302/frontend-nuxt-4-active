<script setup lang="ts">
definePageMeta({ layout: 'alt', middleware: 'auth' })

// ── Composables ───────────────────────────────────────
const store = useInboxStore()
const { fetchThreads, loadMoreThreads, startThread } = useInboxActions()
const presenceStore = usePresenceStore()

// ---- Following Carousel (ranked, Redis-cached)
const { fetchRankedFollowing } = useFollowingData()
const { data: rankedFollowing } = useAsyncData(
    'home-following-ranked',
    () => fetchRankedFollowing(),
    // This branch is client-only rendered below; keep non-blocking to reduce home TTFB.
    { lazy: true }
)

// Candidate ids for the following strip must stay presence-subscribed so
// their online state resolves — the strip itself only *renders* the subset
// that is online (see onlineFollowing below).
const followingCandidateIds = computed(() => rankedFollowing.value?.map(u => u.id) ?? [])
const onlineFollowing = computed(
  () => rankedFollowing.value?.filter(u => presenceStore.onlineByUserId[u.id] === true) ?? [],
)

const { stop: stopPresence } = useDmPresence({ stripUserIds: followingCandidateIds })

// ── Init: navigate to /inbox?start=userId for Chat button ─
const route = useRoute()

onMounted(async () => {
  if (!store.threadsLoaded) await fetchThreads()

  // Chat button on profile page navigates here with ?start=userId
  const startUserId = route.query.start as string | undefined
  if (startUserId) {
    const thread = await startThread(startUserId)
    if (thread) {
      await navigateTo(`/inbox/${thread.id}`, { replace: true })
    }
  }
})

onBeforeUnmount(() => {
  stopPresence()
})

// Online-friend card tap → open (or start) the DM thread with that user.
async function handleFriendChat(user: { id: number }): Promise<void> {
  const thread = await startThread(String(user.id))
  if (thread) await navigateTo(`/inbox/${thread.id}`)
}

// ── Search anyone by ID → message them ────────────────
const searchOpen = ref(false)

async function handleSearchMessage(user: { id: number }): Promise<void> {
  searchOpen.value = false
  await handleFriendChat(user)
}
</script>

<template>
  <!-- Top inset is handled by NavAlt's `spacer` (the fixed nav pads itself). -->
  <main class="safe-area-bottom">
    <NavAlt spacer back-to="/">
      Messages
    </NavAlt>

    <div class="pt-8">
      <!-- ── Search anyone by ID ─────────────────────── -->
      <button
        type="button"
        class="mx-3 mt-2 mb-4 flex items-center gap-2 w-[calc(100%-1.5rem)] rounded-full bg-muted border border-muted/20 px-4 py-2.5 text-sm text-muted active:scale-[0.98] transition-transform"
        @click="searchOpen = true"
      >
        <UIcon name="i-lucide-search" class="size-4 shrink-0" />
        Search People by ID to message…
      </button>
      <UserSearchDrawer
        v-model:open="searchOpen"
        title="New Message"
        description="Search by ID and start a chat."
      >
        <template #actions="{ user }">
          <UButton
            icon="i-lucide-message-circle"
            size="sm"
            variant="soft"
            class="w-full justify-center rounded-t-none"
            @click="handleSearchMessage(user)"
          >
            Message
          </UButton>
        </template>
      </UserSearchDrawer>

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
          <SectionTitle class="ml-3">Online Friends</SectionTitle>
          <HomeFollowingCarousel :users="onlineFollowing" tap-action="chat" class="mx-3" @chat="handleFriendChat" />
        </template>
        <!-- ── DM Threads ────────────────────────────── -->
        <div v-if="store.dmThreads.length > 0" class="divide-y divide-muted/10">
          <NuxtLink
            v-for="thread in store.dmThreads"
            :key="thread.id"
            :to="`/inbox/${thread.id}`"
          >
            <InboxThreadItem :thread="thread" />
          </NuxtLink>
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
            <NuxtLink
              v-for="thread in store.requestThreads"
              :key="thread.id"
              :to="`/inbox/${thread.id}`"
            >
              <InboxThreadItem :thread="thread" />
            </NuxtLink>
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
  </main>
</template>
