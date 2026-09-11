import { describe, it, expect } from 'vitest'
import { filterChatMessages, shouldRenderChatBubble, formatChatAge, filterUnblockedMessages } from '../../app/utils/chat'
import {
  CHAT_TAB_ALL,
  CHAT_TAB_CHAT,
  CHAT_TAB_GIFTS,
  CHAT_MESSAGE_TYPE_TEXT,
  CHAT_MESSAGE_TYPE_SYSTEM,
  CHAT_MESSAGE_TYPE_GIFT,
  CHAT_MESSAGE_TYPE_LUCKY_WIN,
} from '../../app/constants/room'
import type { ChatMessageEvent } from '../../app/types/room/audio'

function msg(id: string, type: string): ChatMessageEvent {
  return { id, userId: 1, content: id, type, timestamp: 0 }
}

const messages: ChatMessageEvent[] = [
  msg('text-1', CHAT_MESSAGE_TYPE_TEXT),
  msg('system-1', CHAT_MESSAGE_TYPE_SYSTEM),
  msg('gift-1', CHAT_MESSAGE_TYPE_GIFT),
  msg('lucky-1', CHAT_MESSAGE_TYPE_LUCKY_WIN),
  msg('text-2', CHAT_MESSAGE_TYPE_TEXT),
]

describe('filterChatMessages', () => {
  it('"all" returns every message unfiltered', () => {
    expect(filterChatMessages(messages, CHAT_TAB_ALL)).toEqual(messages)
  })

  it('"chat" returns only real user-typed (text) messages', () => {
    expect(filterChatMessages(messages, CHAT_TAB_CHAT).map((m) => m.id)).toEqual(['text-1', 'text-2'])
  })

  it('"gifts" returns every non-text message: system, gift, and lucky-win', () => {
    expect(filterChatMessages(messages, CHAT_TAB_GIFTS).map((m) => m.id)).toEqual(['system-1', 'gift-1', 'lucky-1'])
  })

  it('"gifts" also includes an unrecognized future non-text type (matches != text, not an allowlist)', () => {
    const withFuture = [...messages, msg('future-1', 'future-type')]
    expect(filterChatMessages(withFuture, CHAT_TAB_GIFTS).map((m) => m.id)).toContain('future-1')
  })

  it('returns an empty array when no message matches the tab', () => {
    expect(filterChatMessages([msg('text-1', CHAT_MESSAGE_TYPE_TEXT)], CHAT_TAB_GIFTS)).toEqual([])
  })
})

describe('shouldRenderChatBubble', () => {
  // The bug this guards: a chat bubble awarded by an admin to a user who never bought VIP.
  // The prop is owned and equipped, so it must render at vip level 0.
  it('renders an equipped bubble for a non-VIP user', () => {
    expect(shouldRenderChatBubble(42, 0)).toBe(true)
  })

  // Regression guard: VIP grants the default bubble skin with nothing equipped.
  it('renders the default bubble for a VIP user with nothing equipped', () => {
    expect(shouldRenderChatBubble(null, 3)).toBe(true)
  })

  it('renders an equipped bubble for a VIP user', () => {
    expect(shouldRenderChatBubble(42, 3)).toBe(true)
  })

  it('falls back to the plain box when there is neither a bubble nor VIP', () => {
    expect(shouldRenderChatBubble(null, 0)).toBe(false)
  })

  // A departed author has no live participant, so vip level arrives undefined while the
  // bubble id survives on the message snapshot.
  it('renders an equipped bubble when the author has left the room', () => {
    expect(shouldRenderChatBubble(42, undefined)).toBe(true)
  })

  it('falls back to the plain box when both values are absent', () => {
    expect(shouldRenderChatBubble(undefined, undefined)).toBe(false)
  })
})

describe('formatChatAge', () => {
  const t0 = 1_700_000_000_000

  it('is "now" under a minute', () => {
    expect(formatChatAge(t0, t0)).toBe('now')
    expect(formatChatAge(t0, t0 + 59_000)).toBe('now')
  })

  it('switches to minutes at exactly 60s', () => {
    expect(formatChatAge(t0, t0 + 60_000)).toBe('1m')
    expect(formatChatAge(t0, t0 + 59 * 60_000)).toBe('59m')
  })

  it('switches to hours at 3600s and days at 86400s', () => {
    expect(formatChatAge(t0, t0 + 3_600_000)).toBe('1h')
    expect(formatChatAge(t0, t0 + 23 * 3_600_000)).toBe('23h')
    expect(formatChatAge(t0, t0 + 86_400_000)).toBe('1d')
    expect(formatChatAge(t0, t0 + 3 * 86_400_000)).toBe('3d')
  })

  it('clamps a future timestamp (clock skew) to "now"', () => {
    expect(formatChatAge(t0 + 5_000, t0)).toBe('now')
  })

  it('changes as `now` advances for a fixed timestamp (the frozen-clock regression)', () => {
    expect(formatChatAge(t0, t0 + 10_000)).toBe('now')
    expect(formatChatAge(t0, t0 + 130_000)).toBe('2m')
  })
})

describe('filterUnblockedMessages', () => {
  it('returns the identical array reference when nothing is blocked (fast path)', () => {
    expect(filterUnblockedMessages(messages, new Set())).toBe(messages)
  })

  it('drops messages from blocked senders and keeps the rest in order', () => {
    const list = [
      { ...msg('a', CHAT_MESSAGE_TYPE_TEXT), userId: 1 },
      { ...msg('b', CHAT_MESSAGE_TYPE_TEXT), userId: 2 },
      { ...msg('c', CHAT_MESSAGE_TYPE_TEXT), userId: 1 },
    ]
    const out = filterUnblockedMessages(list, new Set([1]))
    expect(out).not.toBe(list)
    expect(out.map((m) => m.id)).toEqual(['b'])
  })
})
