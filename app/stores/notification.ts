// ========================================
// Notification Store
// ========================================
// State + computed + setters ONLY — useNotificationActions for API/toast.

import { defineStore } from 'pinia'
import type { Notification } from '~/types/notification/notification'

interface ListMeta {
  next_cursor: string | null
  unread_count: number
}

export const useNotificationStore = defineStore('notification', () => {
  const items = ref<Notification[]>([])
  const unreadCount = ref<number>(0)
  const loading = ref<boolean>(false)
  const hasMore = ref<boolean>(true)
  const cursor = ref<string | null>(null)
  const lastFetched = ref<number | null>(null)
  const error = ref<string | null>(null)

  const hasUnread = computed(() => unreadCount.value > 0)

  const unreadBadge = computed(() => {
    if (unreadCount.value === 0) return null
    if (unreadCount.value > 99) return '99+'
    return String(unreadCount.value)
  })

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

  function setLoading(v: boolean): void {
    loading.value = v
  }

  function setError(msg: string | null): void {
    error.value = msg
  }

  function setUnreadCount(n: number): void {
    unreadCount.value = n
  }

  function incrementUnread(): void {
    unreadCount.value += 1
  }

  function resetListPagination(): void {
    items.value = []
    cursor.value = null
    hasMore.value = true
  }

  function appendNotificationsPage(data: Notification[], meta: ListMeta): void {
    items.value.push(...data)
    cursor.value = meta.next_cursor
    hasMore.value = meta.next_cursor !== null
    unreadCount.value = meta.unread_count
    lastFetched.value = Date.now()
  }

  function applyReadLocally(notificationId: string): void {
    const notification = items.value.find(n => n.id === notificationId)
    if (notification && !notification.read_at) {
      notification.read_at = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  function applyAllReadLocally(): void {
    for (const notification of items.value) {
      if (!notification.read_at) {
        notification.read_at = new Date().toISOString()
      }
    }
    unreadCount.value = 0
  }

  function prependNotification(notification: Notification): void {
    items.value.unshift(notification)
  }

  function hasNotificationId(id: string): boolean {
    return items.value.some(n => n.id === id)
  }

  function handleRealtimeRead(notificationId: string): void {
    const notification = items.value.find(n => n.id === notificationId)
    if (notification && !notification.read_at) {
      notification.read_at = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  function $reset(): void {
    items.value = []
    unreadCount.value = 0
    loading.value = false
    hasMore.value = true
    cursor.value = null
    lastFetched.value = null
    error.value = null
  }

  return {
    items,
    unreadCount,
    loading,
    hasMore,
    cursor,
    lastFetched,
    error,
    hasUnread,
    unreadBadge,
    groupedNotifications,
    setLoading,
    setError,
    setUnreadCount,
    incrementUnread,
    resetListPagination,
    appendNotificationsPage,
    applyReadLocally,
    applyAllReadLocally,
    prependNotification,
    hasNotificationId,
    handleRealtimeRead,
    $reset,
  }
})
