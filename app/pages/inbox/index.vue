<script setup lang="ts">
definePageMeta({ layout: 'alt', middleware: 'auth' })

// ── Composables ───────────────────────────────────────
const store = useInboxStore()
const { fetchThreads } = useInboxActions()

// ── Init: navigate to /inbox?start=userId for Chat button ─
const route = useRoute()
const { startThread } = useInboxActions()

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
</script>

<template>
  <main>
    <NavAlt back-to="/">
      Messages
    </NavAlt>

    <div class="pt-14 pb-24">
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
        <!-- ── Official thread (always pinned) ────────── -->
        <NuxtLink to="/inbox/official">
          <InboxSystemThreadItem
            :unread-count="store.officialUnreadCount"
            :last-notification="null"
          />
        </NuxtLink>

        <!-- ── Known DMs ──────────────────────────────── -->
        <div v-if="store.dmThreads.length > 0" class="divide-y divide-muted/10">
          <NuxtLink
            v-for="thread in store.dmThreads"
            :key="thread.id"
            :to="`/inbox/${thread.id}`"
          >
            <InboxThreadItem :thread="thread" />
          </NuxtLink>
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
