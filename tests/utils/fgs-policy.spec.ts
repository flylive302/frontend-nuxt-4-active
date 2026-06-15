import { describe, it, expect } from 'vitest'
import {
  fgsPolicy,
  diffFgs,
  type FgsService,
  type RoomActivity,
} from '../../app/utils/fgs-policy'

// Table-driven over every activity combination (capacitor-03 / D1).
// `fgsPolicy` is the union of services each active capability requires.
const policyCases: Array<{
  name: string
  activity: RoomActivity
  expected: FgsService[]
}> = [
  {
    name: 'Speaker (producing + consuming) → microphone + mediaPlayback',
    activity: { producing: true, consuming: true },
    expected: ['microphone', 'mediaPlayback'],
  },
  {
    name: 'Listener (consuming only) → mediaPlayback',
    activity: { producing: false, consuming: true },
    expected: ['mediaPlayback'],
  },
  {
    name: 'idle / not in a room (neither) → no services',
    activity: { producing: false, consuming: false },
    expected: [],
  },
  {
    // Degenerate but well-defined: producing implies in-room, but the policy is
    // a pure function of its inputs, so producing-without-consuming still yields
    // exactly the microphone service.
    name: 'producing without consuming → microphone only',
    activity: { producing: true, consuming: false },
    expected: ['microphone'],
  },
]

describe('fgsPolicy', () => {
  for (const c of policyCases) {
    it(c.name, () => {
      expect(fgsPolicy(c.activity)).toEqual(new Set(c.expected))
    })
  }

  it('microphone is present iff producing', () => {
    expect(fgsPolicy({ producing: true, consuming: true }).has('microphone')).toBe(true)
    expect(fgsPolicy({ producing: true, consuming: false }).has('microphone')).toBe(true)
    expect(fgsPolicy({ producing: false, consuming: true }).has('microphone')).toBe(false)
    expect(fgsPolicy({ producing: false, consuming: false }).has('microphone')).toBe(false)
  })
})

describe('diffFgs', () => {
  const producingState = () => fgsPolicy({ producing: true, consuming: true })
  const consumingOnly = () => fgsPolicy({ producing: false, consuming: true })

  // AC #1 verbatim: a producing→idle transition yields a STOP of microphone.
  // (Expressed against consuming-only so mediaPlayback stays put and only the
  // microphone delta surfaces — the exact behaviour the coordinator executes.)
  it('producing → consuming-only yields a stop of microphone', () => {
    expect(diffFgs(producingState(), consumingOnly())).toEqual({
      start: [],
      stop: ['microphone'],
    })
  })

  it('consuming-only → producing yields a start of microphone', () => {
    expect(diffFgs(consumingOnly(), producingState())).toEqual({
      start: ['microphone'],
      stop: [],
    })
  })

  it('idle → Speaker starts both services', () => {
    const diff = diffFgs(new Set(), producingState())
    expect(diff.stop).toEqual([])
    expect(new Set(diff.start)).toEqual(new Set<FgsService>(['microphone', 'mediaPlayback']))
  })

  it('Speaker → idle stops both services', () => {
    const diff = diffFgs(producingState(), new Set())
    expect(diff.start).toEqual([])
    expect(new Set(diff.stop)).toEqual(new Set<FgsService>(['microphone', 'mediaPlayback']))
  })

  it('no-op when running already equals desired (idempotent)', () => {
    expect(diffFgs(producingState(), producingState())).toEqual({ start: [], stop: [] })
    expect(diffFgs(new Set(), new Set())).toEqual({ start: [], stop: [] })
  })
})
