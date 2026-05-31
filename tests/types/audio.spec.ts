import { describe, it, expect } from 'vitest'
import { userToParticipant } from '../../app/types/room/audio'
import type { MinimalUser } from '../../app/types/user/bootstrap'

// Factory targets the post-Issue-03 MinimalUser shape (no phone, no email).
// Cast suppresses the transient type error while MinimalUser still has those fields.
function makeUser(overrides: Partial<Record<string, unknown>> = {}): MinimalUser {
  return {
    id: 1,
    name: 'Test User',
    signature: 'sig',
    country: 'US',
    wealth_xp: '100',
    charm_xp: '50',
    frame_id: null,
    chat_bubble_id: null,
    entry_animation_id: null,
    data_card_id: null,
    mice_wave_id: null,
    slides_id: null,
    avatar: 'https://cdn.example.com/avatar.jpg',
    cover_image: null,
    gender: null,
    date_of_birth: '1990-01-15',
    vip_level: 0,
    ...overrides,
  } as MinimalUser
}

describe('userToParticipant', () => {
  it('carries date_of_birth from the input without override', () => {
    const result = userToParticipant(makeUser({ date_of_birth: '1990-01-15' }))
    expect(result.date_of_birth).toBe('1990-01-15')
  })

  it('does not include phone on the result', () => {
    expect(Object.prototype.hasOwnProperty.call(userToParticipant(makeUser()), 'phone')).toBe(false)
  })

  it('does not include email on the result', () => {
    expect(Object.prototype.hasOwnProperty.call(userToParticipant(makeUser()), 'email')).toBe(false)
  })

  it('does not set isSpeaker on the result', () => {
    expect(Object.prototype.hasOwnProperty.call(userToParticipant(makeUser()), 'isSpeaker')).toBe(false)
  })

  it('does not set isMuted on the result', () => {
    expect(Object.prototype.hasOwnProperty.call(userToParticipant(makeUser()), 'isMuted')).toBe(false)
  })

  it('preserves identity fields from the input user', () => {
    const user = makeUser({ id: 42, name: 'Alice', avatar: 'https://cdn.example.com/alice.jpg' })
    const result = userToParticipant(user)

    expect(result.id).toBe(42)
    expect(result.name).toBe('Alice')
    expect(result.avatar).toBe('https://cdn.example.com/alice.jpg')
    expect(result.signature).toBe('sig')
    expect(result.country).toBe('US')
    expect(result.wealth_xp).toBe('100')
    expect(result.vip_level).toBe(0)
  })
})
