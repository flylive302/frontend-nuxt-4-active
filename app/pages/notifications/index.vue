<script setup lang="ts">
import {useInboxActions} from "~/composables/inbox/useInboxActions";

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ── Stores & composables ──────────────────────────────
const notificationStore = useNotificationStore()
const inboxStore = useInboxStore()
const { fetchNotifications } = useNotificationActions()
const { fetchThreads } = useInboxActions()

// ── Infinite scroll sentinel ──────────────────────────
const sentinel = ref<HTMLElement | null>(null)
const { stop } = useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (entry?.isIntersecting && inboxStore.threadsHasMore && !inboxStore.threadsLoading) {
      void fetchThreads()
    }
  },
  { threshold: 0.1 },
)
onUnmounted(stop)

// ── Init ──────────────────────────────────────────────
onMounted(() => {
  if (notificationStore.items.length === 0) void fetchNotifications(true)
  if (inboxStore.threads.length === 0) void fetchThreads(true)
})

// ── Derived ───────────────────────────────────────────
const lastNotification = computed(() => notificationStore.items[0] ?? null)
</script>

<template>
  <main>
    <NavAlt back-to="/">
      Messages
    </NavAlt>

    <div class="pt-14 pb-24">
      <!-- Loading skeleton (first load only) -->
      <div v-if="inboxStore.threadsLoading && inboxStore.threads.length === 0" class="divide-y divide-muted/10">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div class="size-12 rounded-full bg-muted/30 shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-3.5 bg-muted/30 rounded w-2/5" />
            <div class="h-3 bg-muted/20 rounded w-3/5" />
          </div>
        </div>
      </div>

      <!-- Thread list -->
      <div v-else class="divide-y divide-muted/10">
        <!-- Pinned: System / Official thread -->
        <NuxtLink to="/notifications/system">
          <InboxSystemThreadItem
            :unread-count="notificationStore.unreadCount"
            :last-notification="lastNotification"
          />
        </NuxtLink>

        <!-- DM threads -->
        <NuxtLink
          v-for="thread in inboxStore.threads"
          :key="thread.id"
          :to="`/notifications/${thread.id}`"
        >
          <InboxThreadItem :thread="thread" />
        </NuxtLink>

        <!-- Infinite scroll sentinel -->
        <div ref="sentinel" class="h-px" />

        <!-- Fetch-more loader -->
        <div v-if="inboxStore.threadsLoading && inboxStore.threads.length > 0" class="flex justify-center py-4">
          <UIcon name="i-lucide-loader-circle" class="size-5 text-muted animate-spin" />
        </div>

        <!-- End of list -->
        <p v-if="!inboxStore.threadsHasMore && inboxStore.threads.length > 0" class="text-center text-xs text-muted py-4">
          No more messages
        </p>
      </div>
    </div>
  </main>
</template>
