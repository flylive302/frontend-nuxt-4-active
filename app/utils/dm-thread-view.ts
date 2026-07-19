// ========================================
// DM Thread View — pure derivation (dm-messenger-v2/07)
// ========================================
// Messenger-grade grouping/day-separator/last-seen derivation for the DM
// thread view. Pure functions only — no Vue reactivity, no store imports.
// Consumed by InboxThreadPanel (grouping/day separators) and
// InboxThreadHeader (last-seen label) to keep both components INTENT-only.

import { MESSAGE_GROUP_MAX_GAP_MS } from '~/constants/inbox'
import type { ThreadMessage } from '~/types/inbox'

/** Position of a message within its same-sender visual cluster. */
export type MessageGroupPosition = 'single' | 'first' | 'middle' | 'last'

function isSameCluster(a: ThreadMessage, b: ThreadMessage): boolean {
  if (a.isOwn !== b.isOwn) return false
  if ((a.senderId ?? null) !== (b.senderId ?? null)) return false
  if (new Date(a.sentAt).toDateString() !== new Date(b.sentAt).toDateString()) return false
  const gapMs = Math.abs(new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  return gapMs <= MESSAGE_GROUP_MAX_GAP_MS
}

/**
 * Whether `messages[index]` groups with its neighbor above/below into a
 * tight same-sender cluster, and where in that cluster it sits.
 */
export function computeGroupPosition(messages: ThreadMessage[], index: number): MessageGroupPosition {
  const curr = messages[index]
  if (!curr) return 'single'

  const prev = messages[index - 1]
  const next = messages[index + 1]

  const linksToPrev = prev !== undefined && isSameCluster(prev, curr)
  const linksToNext = next !== undefined && isSameCluster(curr, next)

  if (linksToPrev && linksToNext) return 'middle'
  if (linksToPrev) return 'last'
  if (linksToNext) return 'first'
  return 'single'
}

/** Whether a day separator should render above `messages[index]`. */
export function shouldShowDaySeparator(messages: ThreadMessage[], index: number): boolean {
  if (index === 0) return true
  const prev = messages[index - 1]
  const curr = messages[index]
  if (!prev || !curr) return false
  return new Date(prev.sentAt).toDateString() !== new Date(curr.sentAt).toDateString()
}

/** "Today" / "Yesterday" / localized date label for a day-separator pill. */
export function formatDaySeparatorLabel(dateStr: string, now: Date = new Date()): string {
  const d = new Date(dateStr)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * Thread-header presence label: "Online" wins when the DM Presence store
 * says so; otherwise falls back to a "Last seen …" relative label derived
 * from the thread's `lastSeenAt`, or null when nothing is known yet.
 */
export function formatLastSeenLabel(lastSeenAt: string | null, now: Date = new Date()): string | null {
  if (!lastSeenAt) return null

  const d = new Date(lastSeenAt)
  if (Number.isNaN(d.getTime())) return null

  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'Last seen just now'
  if (diffMin < 60) return `Last seen ${diffMin}m ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24 && d.toDateString() === now.toDateString()) return `Last seen ${diffHours}h ago`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return `Last seen yesterday at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
  }

  return `Last seen ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export function presenceLabel(online: boolean, lastSeenAt: string | null, now: Date = new Date()): string | null {
  if (online) return 'Online'
  return formatLastSeenLabel(lastSeenAt, now)
}
