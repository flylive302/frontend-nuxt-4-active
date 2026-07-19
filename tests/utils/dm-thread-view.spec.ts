/**
 * dm-thread-view (dm-messenger-v2/07) — pure grouping/day-separator/last-seen
 * derivation for the DM thread view.
 */
import { describe, it, expect } from 'vitest'
import {
  computeGroupPosition,
  formatDaySeparatorLabel,
  formatLastSeenLabel,
  presenceLabel,
  shouldShowDaySeparator,
} from '../../app/utils/dm-thread-view'
import type { TextThreadMessage } from '../../app/types/inbox'

// ========================================
// Fixtures
// ========================================

function makeMessage(overrides: Partial<TextThreadMessage> = {}): TextThreadMessage {
  return {
    id: '1',
    threadId: 't1',
    senderId: 'u1',
    type: 'text',
    kind: 'text',
    content: 'hi',
    sentAt: '2026-07-19T10:00:00.000Z',
    readAt: null,
    unsent: false,
    isOwn: false,
    ...overrides,
  }
}

// ========================================
// computeGroupPosition
// ========================================

describe('computeGroupPosition', () => {
  it('is single for a lone message', () => {
    const messages = [makeMessage()]
    expect(computeGroupPosition(messages, 0)).toBe('single')
  })

  it('groups consecutive same-sender messages within the gap window', () => {
    const messages = [
      makeMessage({ id: '1', sentAt: '2026-07-19T10:00:00.000Z' }),
      makeMessage({ id: '2', sentAt: '2026-07-19T10:01:00.000Z' }),
      makeMessage({ id: '3', sentAt: '2026-07-19T10:02:00.000Z' }),
    ]
    expect(computeGroupPosition(messages, 0)).toBe('first')
    expect(computeGroupPosition(messages, 1)).toBe('middle')
    expect(computeGroupPosition(messages, 2)).toBe('last')
  })

  it('starts a new group when the sender changes', () => {
    const messages = [
      makeMessage({ id: '1', senderId: 'u1', sentAt: '2026-07-19T10:00:00.000Z' }),
      makeMessage({ id: '2', senderId: 'u2', isOwn: true, sentAt: '2026-07-19T10:00:30.000Z' }),
    ]
    expect(computeGroupPosition(messages, 0)).toBe('single')
    expect(computeGroupPosition(messages, 1)).toBe('single')
  })

  it('starts a new group when the gap exceeds the clustering window', () => {
    const messages = [
      makeMessage({ id: '1', sentAt: '2026-07-19T10:00:00.000Z' }),
      makeMessage({ id: '2', sentAt: '2026-07-19T10:30:00.000Z' }),
    ]
    expect(computeGroupPosition(messages, 0)).toBe('single')
    expect(computeGroupPosition(messages, 1)).toBe('single')
  })

  it('starts a new group across a day boundary even if the gap is small', () => {
    const messages = [
      makeMessage({ id: '1', sentAt: '2026-07-18T12:00:00.000Z' }),
      makeMessage({ id: '2', sentAt: '2026-07-19T12:00:10.000Z' }),
    ]
    expect(computeGroupPosition(messages, 0)).toBe('single')
    expect(computeGroupPosition(messages, 1)).toBe('single')
  })
})

// ========================================
// shouldShowDaySeparator / formatDaySeparatorLabel
// ========================================

describe('shouldShowDaySeparator', () => {
  it('always shows a separator above the first message', () => {
    expect(shouldShowDaySeparator([makeMessage()], 0)).toBe(true)
  })

  it('shows a separator when the calendar day changes', () => {
    const messages = [
      makeMessage({ id: '1', sentAt: '2026-07-18T12:00:00.000Z' }),
      makeMessage({ id: '2', sentAt: '2026-07-19T12:00:00.000Z' }),
    ]
    expect(shouldShowDaySeparator(messages, 1)).toBe(true)
  })

  it('does not show a separator within the same calendar day', () => {
    const messages = [
      makeMessage({ id: '1', sentAt: '2026-07-19T09:00:00.000Z' }),
      makeMessage({ id: '2', sentAt: '2026-07-19T09:05:00.000Z' }),
    ]
    expect(shouldShowDaySeparator(messages, 1)).toBe(false)
  })
})

describe('formatDaySeparatorLabel', () => {
  const now = new Date('2026-07-19T12:00:00.000Z')

  it('labels today', () => {
    expect(formatDaySeparatorLabel('2026-07-19T08:00:00.000Z', now)).toBe('Today')
  })

  it('labels yesterday', () => {
    expect(formatDaySeparatorLabel('2026-07-18T08:00:00.000Z', now)).toBe('Yesterday')
  })

  it('labels older dates with a localized date string', () => {
    const label = formatDaySeparatorLabel('2026-06-01T08:00:00.000Z', now)
    expect(label).not.toBe('Today')
    expect(label).not.toBe('Yesterday')
    expect(label.length).toBeGreaterThan(0)
  })
})

// ========================================
// formatLastSeenLabel / presenceLabel
// ========================================

describe('formatLastSeenLabel', () => {
  const now = new Date('2026-07-19T12:00:00.000Z')

  it('returns null when lastSeenAt is unknown', () => {
    expect(formatLastSeenLabel(null, now)).toBeNull()
  })

  it('returns null for an invalid date', () => {
    expect(formatLastSeenLabel('not-a-date', now)).toBeNull()
  })

  it('reports "just now" for sub-minute gaps', () => {
    expect(formatLastSeenLabel('2026-07-19T11:59:45.000Z', now)).toBe('Last seen just now')
  })

  it('reports minutes ago within the hour', () => {
    expect(formatLastSeenLabel('2026-07-19T11:45:00.000Z', now)).toBe('Last seen 15m ago')
  })

  it('reports hours ago within the same day', () => {
    expect(formatLastSeenLabel('2026-07-19T09:00:00.000Z', now)).toBe('Last seen 3h ago')
  })

  it('reports "yesterday at …" for the previous calendar day', () => {
    expect(formatLastSeenLabel('2026-07-18T09:30:00.000Z', now)).toContain('Last seen yesterday at')
  })

  it('reports a date for older timestamps', () => {
    const label = formatLastSeenLabel('2026-07-01T09:00:00.000Z', now)
    expect(label).toMatch(/^Last seen /)
    expect(label).not.toContain('yesterday')
  })
})

describe('presenceLabel', () => {
  const now = new Date('2026-07-19T12:00:00.000Z')

  it('prefers "Online" over last-seen when online', () => {
    expect(presenceLabel(true, '2026-07-01T09:00:00.000Z', now)).toBe('Online')
  })

  it('falls back to last-seen when offline', () => {
    expect(presenceLabel(false, '2026-07-19T11:59:45.000Z', now)).toBe('Last seen just now')
  })

  it('falls back to null when offline and last-seen is unknown', () => {
    expect(presenceLabel(false, null, now)).toBeNull()
  })
})
