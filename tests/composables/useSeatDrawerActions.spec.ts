// ========================================
// useSeatDrawerActions Composable Tests
// ========================================
//
// Covers the seat-drawer action matrix: which per-user actions are offered for
// a target who is seated / present-but-not-seated / gone / self, as viewed by
// a moderator vs a plain member.
// ========================================

import { describe, it, expect } from 'vitest'
import { resolveSeatDrawerActions } from '~/composables/room/useSeatDrawerActions'
import type { SeatDrawerActionState } from '~/composables/room/useSeatDrawerActions'

const SELF_ID = 1
const OTHER_ID = 2

/** Moderator viewing a seated other user, with a free seat available. */
const BASE: SeatDrawerActionState = {
  targetUserId: OTHER_ID,
  selfUserId: SELF_ID,
  isTargetInRoom: true,
  isTargetSeated: true,
  canManageMembers: true,
  freeSeatIndex: 3,
}

function actionsFor(overrides: Partial<SeatDrawerActionState> = {}) {
  return resolveSeatDrawerActions({ ...BASE, ...overrides })
}

describe('resolveSeatDrawerActions — seated target', () => {
  it('offers follow, chat, gift, mute and kick to a moderator', () => {
    const actions = actionsFor()

    expect(actions).toMatchObject({
      isSelf: false,
      canFollow: true,
      canChat: true,
      canGift: true,
      canMute: true,
      canKick: true,
    })
  })

  it('never offers invite-to-seat — the target already occupies one', () => {
    expect(actionsFor().canInviteToSeat).toBe(false)
  })
})

describe('resolveSeatDrawerActions — non-seated target in the room', () => {
  const nonSeated = { isTargetSeated: false }

  it('offers follow and chat — neither needs a seat', () => {
    const actions = actionsFor(nonSeated)

    expect(actions.canFollow).toBe(true)
    expect(actions.canChat).toBe(true)
  })

  it('withholds gift — recipients resolve from occupied seats only', () => {
    expect(actionsFor(nonSeated).canGift).toBe(false)
  })

  it('withholds mute — there is no live producer to silence', () => {
    expect(actionsFor(nonSeated).canMute).toBe(false)
  })

  it('offers kick — kicking needs room presence, not a seat', () => {
    expect(actionsFor(nonSeated).canKick).toBe(true)
  })

  it('offers invite-to-seat when a free seat exists', () => {
    expect(actionsFor(nonSeated).canInviteToSeat).toBe(true)
  })

  it('withholds invite-to-seat when every seat is taken or locked', () => {
    expect(actionsFor({ ...nonSeated, freeSeatIndex: null }).canInviteToSeat).toBe(false)
  })

  it('treats seat index 0 as a real free seat', () => {
    expect(actionsFor({ ...nonSeated, freeSeatIndex: 0 }).canInviteToSeat).toBe(true)
  })
})

describe('resolveSeatDrawerActions — target who left the room', () => {
  const gone = { isTargetInRoom: false, isTargetSeated: false }

  it('withholds mute, kick and invite — there is nobody in the room to act on', () => {
    const actions = actionsFor(gone)

    expect(actions.canMute).toBe(false)
    expect(actions.canKick).toBe(false)
    expect(actions.canInviteToSeat).toBe(false)
  })

  it('still offers follow and chat — both reach users outside the room', () => {
    const actions = actionsFor(gone)

    expect(actions.canFollow).toBe(true)
    expect(actions.canChat).toBe(true)
  })
})

describe('resolveSeatDrawerActions — non-moderator viewer', () => {
  const member = { canManageMembers: false }

  it('withholds every moderation action', () => {
    const actions = actionsFor({ ...member, isTargetSeated: false })

    expect(actions.canMute).toBe(false)
    expect(actions.canKick).toBe(false)
    expect(actions.canInviteToSeat).toBe(false)
  })

  it('withholds mute even from a seated target', () => {
    expect(actionsFor(member).canMute).toBe(false)
  })

  it('keeps the social actions', () => {
    const actions = actionsFor(member)

    expect(actions.canFollow).toBe(true)
    expect(actions.canChat).toBe(true)
    expect(actions.canGift).toBe(true)
  })
})

describe('resolveSeatDrawerActions — self', () => {
  it('offers nothing when the target is the viewer, even for an owner', () => {
    const actions = actionsFor({ targetUserId: SELF_ID })

    expect(actions).toEqual({
      isSelf: true,
      canFollow: false,
      canChat: false,
      canGift: false,
      canMute: false,
      canKick: false,
      canInviteToSeat: false,
    })
  })

  it('reports self for a non-seated viewer tapping their own chat bubble', () => {
    const actions = actionsFor({ targetUserId: SELF_ID, isTargetSeated: false })

    expect(actions.isSelf).toBe(true)
    expect(actions.canKick).toBe(false)
  })
})

describe('resolveSeatDrawerActions — no target', () => {
  it('offers nothing for an empty seat', () => {
    const actions = actionsFor({ targetUserId: null, isTargetInRoom: false, isTargetSeated: false })

    expect(actions).toEqual({
      isSelf: false,
      canFollow: false,
      canChat: false,
      canGift: false,
      canMute: false,
      canKick: false,
      canInviteToSeat: false,
    })
  })

  it('does not treat a null target as self when the viewer is logged out', () => {
    expect(actionsFor({ targetUserId: null, selfUserId: null }).isSelf).toBe(false)
  })
})
