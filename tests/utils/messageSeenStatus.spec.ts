import { describe, it, expect } from 'vitest'
import { isMessageSeen } from '~/utils/messageSeenStatus'

describe('isMessageSeen', () => {
  it('is seen when the message id is at or below the peer watermark', () => {
    expect(isMessageSeen(5, 5, null)).toBe(true)
    expect(isMessageSeen(3, 5, null)).toBe(true)
  })

  it('is not seen when the message id is above the peer watermark', () => {
    expect(isMessageSeen(6, 5, null)).toBe(false)
  })

  it('works with string ids/watermarks (as stored on the FE Thread type)', () => {
    expect(isMessageSeen('10', '10', null)).toBe(true)
    expect(isMessageSeen('11', '10', null)).toBe(false)
  })

  it('falls back to readAt when no watermark is known yet (self-heal before reconcile)', () => {
    expect(isMessageSeen(1, null, '2026-07-18T00:00:00Z')).toBe(true)
    expect(isMessageSeen(1, null, null)).toBe(false)
  })
})
