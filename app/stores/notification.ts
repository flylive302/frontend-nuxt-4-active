// ========================================
// Notification Store
// ========================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createLogger } from '~/utils/logger'
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from '~/types/notification'

// Note: Polling has been removed in favor of realtime socket events.
// See useRealtimeEvents.ts for notification.new and notification.read handlers.

// ========================================
// Store Definition
// ========================================

export const useNotificationStore = defineStore('notification', () => {
  const log = createLogger('[NotificationStore]')
  const { api } = useApi()
  const toast = useToast()

  // ========================================
  // State
  // ========================================

  const items = ref<Notification[]>([])
  const unreadCount = ref<number>(0)
  const loading = ref<boolean>(false)
  const hasMore = ref<boolean>(true)
  const cursor = ref<string | null>(null)
  const lastFetched = ref<number | null>(null)
  const error = ref<string | null>(null)

  // ========================================
  // Computed
  // ========================================

  const hasUnread = computed(() => unreadCount.value > 0)
  
  const unreadBadge = computed(() => {
    if (unreadCount.value === 0) return null
    if (unreadCount.value > 99) return '99+'
    return String(unreadCount.value)
  })

  /**
   * Group notifications by date for display.
   */
  const groupedNotifications = computed(() => {
    const groups: Map<string, Notification[]> = new Map()
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    for (const notification of items.value) {
      const date = new Date(notification.created_at)
      let groupKey: string

      if (isSameDay(date, today)) {
        groupKey = 'Today'
      } else if (isSameDay(date, yesterday)) {
        groupKey = 'Yesterday'
      } else {
        groupKey = formatDate(date)
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(notification)
    }

    return Array.from(groups.entries()).map(([label, notifications]) => ({
      label,
      notifications,
    }))
  })

  // ========================================
  // Helpers
  // ========================================

  function isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch notifications list.
   * Supports pagination via cursor.
   */
  async function fetchNotifications(reset = false): Promise<void> {
    if (reset) {
      items.value = []
      cursor.value = null
      hasMore.value = true
    }

    if (!hasMore.value || loading.value) return

    loading.value = true
    error.value = null

    try {
      const params: Record<string, unknown> = {
        per_page: 20, // Default page size
      }
      
      if (cursor.value) {
        params.cursor = cursor.value
      }

      const response = await api<NotificationListResponse>('/notifications', { params })

      items.value.push(...response.data)
      cursor.value = response.meta.next_cursor
      hasMore.value = response.meta.next_cursor !== null
      unreadCount.value = response.meta.unread_count
      lastFetched.value = Date.now()
    } catch (err) {
      error.value = 'Failed to load notifications'
      log.error('fetchNotifications failed:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch only the unread count.
   * Lightweight endpoint for badge updates.
   */
  async function fetchUnreadCount(): Promise<void> {
    try {
      const response = await api<UnreadCountResponse>('/notifications/unread-count')
      unreadCount.value = response.data.count
    } catch (err) {
      log.error('fetchUnreadCount failed:', err)
    }
  }

  /**
   * Mark a single notification as read.
   */
  async function markAsRead(notificationId: string): Promise<boolean> {
    try {
      await api(`/notifications/${notificationId}/read`, { method: 'PATCH' })

      // Update local state
      const notification = items.value.find(n => n.id === notificationId)
      if (notification && !notification.read_at) {
        notification.read_at = new Date().toISOString()
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }

      return true
    } catch (err) {
      log.error('markAsRead failed:', err)
      return false
    }
  }

  /**
   * Mark all notifications as read.
   */
  async function markAllAsRead(): Promise<boolean> {
    try {
      await api('/notifications/mark-all-read', { method: 'POST' })

      // Update local state
      for (const notification of items.value) {
        if (!notification.read_at) {
          notification.read_at = new Date().toISOString()
        }
      }
      unreadCount.value = 0

      toast.add({ title: 'All Read', description: 'All notifications marked as read.', color: 'success' })
      return true
    } catch (err) {
      toast.add({ title: 'Error', description: 'Failed to mark all as read.', color: 'error' })
      log.error('markAllAsRead failed:', err)
      return false
    }
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Initialize notifications on auth.
   * Call this when user authenticates.
   * Polling has been removed - realtime updates come via socket events.
   */
  async function initialize(): Promise<void> {
    await fetchNotifications(true)
    await fetchUnreadCount()
    log.info('Initialized (socket-based, no polling)')
  }

  /**
   * Handle WebSocket notification event.
   * This will be used when backend implements real-time.
   * For now, it's a no-op placeholder.
   */
  function handleRealtimeNotification(notification: Notification): void {
    // Check if already exists
    const exists = items.value.some(n => n.id === notification.id)
    if (exists) return

    // Prepend to list
    items.value.unshift(notification)
    unreadCount.value++

    // Show toast
    toast.add({
      title: notification.title,
      description: notification.body,
      icon: 'i-lucide-bell',
      color: 'info',
    })
  }

  /**
   * Mark notification as read via WebSocket event.
   * Placeholder for future real-time implementation.
   */
  function handleRealtimeRead(notificationId: string): void {
    const notification = items.value.find(n => n.id === notificationId)
    if (notification && !notification.read_at) {
      notification.read_at = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  // ========================================
  // Reset State
  // ========================================

  function $reset(): void {
    items.value = []
    unreadCount.value = 0
    loading.value = false
    hasMore.value = true
    cursor.value = null
    lastFetched.value = null
    error.value = null
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    items,
    unreadCount,
    loading,
    hasMore,
    cursor,
    lastFetched,
    error,

    // Computed
    hasUnread,
    unreadBadge,
    groupedNotifications,

    // Actions
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,

    // Lifecycle (replaces polling)
    initialize,

    // Socket Event Handlers
    handleRealtimeNotification,
    handleRealtimeRead,

    // Reset
    $reset,
  }
})
