import { describe, it, expect } from 'vitest'
import {
  resolvePushTransport,
  type PushPlatform,
  type PushTransport,
} from '../../app/utils/push-transport'

// Pure transport resolution (capacitor-06 / ADR 0013).
const cases: Array<{
  name: string
  platform: PushPlatform
  expected: PushTransport
}> = [
  { name: 'native → fcm', platform: 'native', expected: 'fcm' },
  { name: 'web → webpush', platform: 'web', expected: 'webpush' },
]

describe('resolvePushTransport', () => {
  it.each(cases)('$name', ({ platform, expected }) => {
    expect(resolvePushTransport(platform)).toBe(expected)
  })

  it('reserves apns in the transport type for the future iOS phase', () => {
    const apns: PushTransport = 'apns'
    expect(apns).toBe('apns')
  })
})
