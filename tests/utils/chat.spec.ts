import { describe, it, expect } from 'vitest'
import { filterChatMessages } from '../../app/utils/chat'
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
