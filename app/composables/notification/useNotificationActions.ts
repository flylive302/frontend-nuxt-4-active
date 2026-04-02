// ========================================
// Notifications — GATE / EXECUTE / REACT
// ========================================

import { createLogger } from '~/utils/logger'
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from '~/types/notification/notification'

const log = createLogger('[useNotificationActions]')

export function useNotificationActions() {
  const store = useNotificationStore()
  const { api } = useApi()
  const toast = useToast()

  async function fetchNotifications(reset = false): Promise<void> {
    if (reset) store.resetListPagination()

    if (!store.hasMore || store.loading) return

    store.setLoading(true)
    store.setError(null)

    try {
      const params: Record<string, unknown> = { per_page: 20 }
      if (store.cursor) params.cursor = store.cursor

      const response = await api<NotificationListResponse>('/notifications', { params })

      store.appendNotificationsPage(response.data, response.meta)
    } catch (err) {
      store.setError('Failed to load notifications')
      log.error('fetchNotifications failed:', err)
    } finally {
      store.setLoading(false)
    }
  }

  async function fetchUnreadCount(): Promise<void> {
    try {
      const response = await api<UnreadCountResponse>('/notifications/unread-count')
      store.setUnreadCount(response.data.count)
    } catch (err) {
      log.error('fetchUnreadCount failed:', err)
    }
  }

  async function markAsRead(notificationId: string): Promise<boolean> {
    try {
      await api(`/notifications/${notificationId}/read`, { method: 'PATCH' })
      store.applyReadLocally(notificationId)
      return true
    } catch (err) {
      log.error('markAsRead failed:', err)
      return false
    }
  }

  async function markAllAsRead(): Promise<boolean> {
    try {
      await api('/notifications/mark-all-read', { method: 'POST' })
      store.applyAllReadLocally()
      toast.add({
        title: 'All Read',
        description: 'All notifications marked as read.',
        color: 'success',
      })
      return true
    } catch (err) {
      toast.add({
        title: 'Error',
        description: 'Failed to mark all as read.',
        color: 'error',
      })
      log.error('markAllAsRead failed:', err)
      return false
    }
  }

  async function initialize(): Promise<void> {
    await fetchNotifications(true)
    await fetchUnreadCount()
    log.info('Initialized (socket-based, no polling)')
  }

  /** REACT: prepend + toast (called from event wiring). */
  function handleRealtimeNotification(notification: Notification): void {
    if (store.hasNotificationId(notification.id)) return

    store.prependNotification(notification)
    store.incrementUnread()
    toast.add({
      title: notification.title,
      description: notification.body,
      icon: 'i-lucide-bell',
      color: 'info',
    })
  }

  return {
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    initialize,
    handleRealtimeNotification,
  }
}
