<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const notificationStore = useNotificationStore()
const { markAllAsRead, markAsRead, fetchNotifications } = useNotificationActions()

// ========================================
// Component State
// ========================================

const markingAllRead = ref(false)

// ========================================
// Event Handlers
// ========================================

async function handleMarkAllRead(): Promise<void> {
  markingAllRead.value = true
  await markAllAsRead()
  markingAllRead.value = false
}

async function handleNotificationClick(notification: { id: string; read_at: string | null; action_url?: string }): Promise<void> {
  // Mark as read if unread
  if (!notification.read_at) {
    await markAsRead(notification.id)
  }
  
  // Navigate to action URL if present
  if (notification.action_url) {
    navigateTo(notification.action_url)
  }
}

function handleLoadMore(): void {
  void fetchNotifications(false)
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  // Fetch notifications on mount if not already loaded
  if (notificationStore.items.length === 0) {
    void fetchNotifications(true)
  }
})
</script>

<template>
  <main>
    <NavAlt back-to="/">
      Notifications
      <template #action>
        <UButton
          v-if="notificationStore.hasUnread"
          variant="ghost"
          size="sm"
          icon="i-lucide-check-check"
          :loading="markingAllRead"
          @click="handleMarkAllRead"
        >
          Mark All Read
        </UButton>
      </template>
    </NavAlt>

    <div class="px-3 pt-14 pb-24">
      <!-- Loading State -->
      <div v-if="notificationStore.loading && notificationStore.items.length === 0" class="space-y-3">
        <div v-for="i in 5" :key="i" class="animate-pulse">
          <div class="flex gap-3 p-3 bg-elevated rounded-lg">
            <div class="size-10 bg-muted rounded-full shrink-0" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted rounded w-3/4" />
              <div class="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!notificationStore.loading && notificationStore.items.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-bell-off" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No Notifications</h3>
        <p class="text-sm text-muted max-w-xs">
          When you receive notifications, they will appear here.
        </p>
      </div>

      <!-- Notifications List -->
      <div v-else class="space-y-4">
        <div
          v-for="group in notificationStore.groupedNotifications"
          :key="group.label"
          class="space-y-2"
        >
          <!-- Group Header -->
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wide px-1">
            {{ group.label }}
          </h3>

          <!-- Notification Cards -->
          <div
            v-for="notification in group.notifications"
            :key="notification.id"
            class="relative flex gap-3 p-3 rounded-lg border transition-colors cursor-pointer"
            :class="[
              notification.read_at 
                ? 'bg-elevated border-transparent' 
                : 'bg-primary/5 border-primary/20'
            ]"
            @click="handleNotificationClick(notification)"
          >
            <!-- Unread Indicator -->
            <span
              v-if="!notification.read_at"
              class="absolute top-3 left-1 size-2 bg-primary rounded-full"
            />

            <!-- Icon -->
            <div
              class="size-10 rounded-full flex items-center justify-center shrink-0"
              :class="[
                notification.read_at ? 'bg-muted/20' : 'bg-primary/20'
              ]"
            >
              <icon
                v-if="notification.data.user_avatar"
                :name="notification.data.user_avatar"
                class="size-6"
              />
              <icon
                v-else
                name="i-lucide-bell"
                class="size-5"
                :class="notification.read_at ? 'text-muted' : 'text-primary'"
              />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-semibold truncate">
                {{ notification.title }}
              </h4>
              <p class="text-sm text-muted line-clamp-2">
                {{ notification.body }}
              </p>
              <p class="text-xs text-muted/70 mt-1">
                {{ formatRelativeTime(notification.created_at) }}
              </p>
            </div>

            <!-- Action Arrow -->
            <div
              v-if="notification.action_url"
              class="flex items-center"
            >
              <icon name="i-lucide-chevron-right" class="size-5 text-muted" />
            </div>
          </div>
        </div>

        <!-- Load More -->
        <div v-if="notificationStore.hasMore" class="flex justify-center pt-4">
          <UButton
            variant="soft"
            color="primary"
            :loading="notificationStore.loading"
            @click="handleLoadMore"
          >
            Load More
          </UButton>
        </div>
      </div>

      <!-- Error State -->
      <UAlert
        v-if="notificationStore.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="notificationStore.error"
        class="mt-4"
      />
    </div>
  </main>
</template>

<script lang="ts">
// ========================================
// Helpers / Utilities
// ========================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
