<script setup lang="ts">
definePageMeta({ layout: 'alt', middleware: 'auth' })

// ── Stores & composables ──────────────────────────────
const notificationStore = useNotificationStore()
const inboxStore = useInboxStore()
const { fetchNotifications } = useNotificationActions()
const { fetchThreads } = useInboxActions()

// ── Init ──────────────────────────────────────────────
onMounted(() => {
  if (notificationStore.items.length === 0) void fetchNotifications(true)
  if (!inboxStore.threadsLoaded) void fetchThreads()
})

// ── Derived ───────────────────────────────────────────
const lastNotification = computed(() => notificationStore.items[0] ?? null)
const allDmThreads = computed(() => [...inboxStore.dmThreads, ...inboxStore.requestThreads])
</script>

<template>
  <main>
    <NavAlt back-to="/">
      Messages
    </NavAlt>

    <div class="pt-14 pb-24">
      <!-- Loading skeleton -->
      <div v-if="inboxStore.threadsLoading && !inboxStore.threadsLoaded" class="divide-y divide-muted/10">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div class="size-12 rounded-full bg-muted/30 shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-3.5 bg-muted/30 rounded w-2/5" />
            <div class="h-3 bg-muted/20 rounded w-3/5" />
          </div>
        </div>
      </div>

      <template v-else>
        <!-- Pinned: System / Official thread -->
        <NuxtLink to="/notifications/system">
          <InboxSystemThreadItem
            :unread-count="notificationStore.unreadCount"
            :last-notification="lastNotification"
          />
        </NuxtLink>

        <!-- DM threads -->
        <div v-if="allDmThreads.length > 0" class="divide-y divide-muted/10">
          <NuxtLink
            v-for="thread in allDmThreads"
            :key="thread.id"
            :to="`/inbox/${thread.id}`"
          >
            <InboxThreadItem :thread="thread" />
          </NuxtLink>
        </div>

        <!-- Empty state -->
        <div
          v-if="allDmThreads.length === 0"
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
