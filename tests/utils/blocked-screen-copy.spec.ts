import { describe, it, expect } from 'vitest'
import { blockedScreenCopy, formatBlockEnd } from '../../app/utils/blocked/blocked-screen-copy'
import type { BlockInfo, BlockKind } from '../../app/types/user/block'

const NOW = new Date('2026-11-01T12:00:00.000Z')
const END_LABEL = 'END_LABEL'
const formatEnd = () => END_LABEL

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const KINDS: BlockKind[] = ['account', 'ip', 'device']

/** ISO string `offsetMs` away from NOW (negative = already past). */
function at(offsetMs: number): string {
  return new Date(NOW.getTime() + offsetMs).toISOString()
}

function info(kind: BlockKind, until: string | null, reason: string | null = null): BlockInfo {
  return { kind, reason, until }
}

describe('blockedScreenCopy — titles and bodies (account-bans 03)', () => {
  it('account timed → title, body with end date, reason, time left', () => {
    const copy = blockedScreenCopy(info('account', at(3 * DAY_MS + HOUR_MS), 'Spam'), NOW, true, formatEnd)
    expect(copy).toEqual({
      title: 'Account blocked',
      body: `Your account has been blocked until ${END_LABEL}.`,
      reason: 'Spam',
      timeLeft: 'About 3 days left',
      isPermanent: false,
      showTryAgain: false,
      action: 'sign-out',
    })
  })

  it('account permanent → generic body, reason kept, no time left', () => {
    const copy = blockedScreenCopy(info('account', null, 'Fraud'), NOW, true, formatEnd)
    expect(copy).toEqual({
      title: 'Account blocked',
      body: 'Your account has been blocked.',
      reason: 'Fraud',
      timeLeft: null,
      isPermanent: true,
      showTryAgain: false,
      action: 'sign-out',
    })
  })

  it('account with no reason → reason null, body still explains the block', () => {
    const copy = blockedScreenCopy(info('account', null, null), NOW, true, formatEnd)
    expect(copy.reason).toBeNull()
    expect(copy.body).toBe('Your account has been blocked.')
  })

  it('account with a blank reason → treated as no reason', () => {
    expect(blockedScreenCopy(info('account', null, '   '), NOW, true, formatEnd).reason).toBeNull()
  })

  it('ip timed → network copy with end date and the Wi-Fi hint', () => {
    const copy = blockedScreenCopy(info('ip', at(2 * HOUR_MS)), NOW, false, formatEnd)
    expect(copy.title).toBe('Network blocked')
    expect(copy.body).toBe(`The network you're on is blocked until ${END_LABEL}. Try Wi-Fi or mobile data.`)
    expect(copy.isPermanent).toBe(false)
  })

  it('ip permanent → no end date in the body', () => {
    const copy = blockedScreenCopy(info('ip', null), NOW, false, formatEnd)
    expect(copy.title).toBe('Network blocked')
    expect(copy.body).toBe("The network you're on is blocked. Try Wi-Fi or mobile data.")
    expect(copy.isPermanent).toBe(true)
    expect(copy.timeLeft).toBeNull()
  })

  it('device timed → device copy with end date', () => {
    const copy = blockedScreenCopy(info('device', at(5 * MINUTE_MS)), NOW, false, formatEnd)
    expect(copy.title).toBe('Device blocked')
    expect(copy.body).toBe(`This device is blocked until ${END_LABEL}.`)
    expect(copy.isPermanent).toBe(false)
  })

  it('device permanent → no end date in the body', () => {
    const copy = blockedScreenCopy(info('device', null), NOW, false, formatEnd)
    expect(copy.title).toBe('Device blocked')
    expect(copy.body).toBe('This device is blocked.')
    expect(copy.isPermanent).toBe(true)
  })
})

describe('blockedScreenCopy — reason privacy', () => {
  it.each(['ip', 'device'] as const)('%s never shows a reason, even when one is supplied', (kind) => {
    expect(blockedScreenCopy(info(kind, null, 'Leaked reason'), NOW, true, formatEnd).reason).toBeNull()
    expect(blockedScreenCopy(info(kind, at(HOUR_MS), 'Leaked reason'), NOW, true, formatEnd).reason).toBeNull()
    expect(blockedScreenCopy(info(kind, at(-HOUR_MS), 'Leaked reason'), NOW, true, formatEnd).reason).toBeNull()
  })

  it.each(['ip', 'device'] as const)('%s body does not echo the reason', (kind) => {
    const copy = blockedScreenCopy(info(kind, at(HOUR_MS), 'Leaked reason'), NOW, true, formatEnd)
    expect(copy.body).not.toContain('Leaked reason')
  })
})

describe('blockedScreenCopy — time left rounding', () => {
  const timeLeftFor = (offsetMs: number) =>
    blockedScreenCopy(info('account', at(offsetMs)), NOW, true, formatEnd).timeLeft

  it('1 day exactly → singular', () => {
    expect(timeLeftFor(DAY_MS)).toBe('About 1 day left')
  })

  it('rounds down to whole days', () => {
    expect(timeLeftFor(2 * DAY_MS + 23 * HOUR_MS)).toBe('About 2 days left')
  })

  it('under a day → hours (singular and plural)', () => {
    expect(timeLeftFor(HOUR_MS)).toBe('About 1 hour left')
    expect(timeLeftFor(5 * HOUR_MS + 59 * MINUTE_MS)).toBe('About 5 hours left')
  })

  it('under an hour → minutes (singular and plural)', () => {
    expect(timeLeftFor(MINUTE_MS)).toBe('About 1 minute left')
    expect(timeLeftFor(45 * MINUTE_MS + 30_000)).toBe('About 45 minutes left')
  })

  it('under a minute → still at least 1 minute', () => {
    expect(timeLeftFor(10_000)).toBe('About 1 minute left')
  })

  it('applies to ip and device too', () => {
    expect(blockedScreenCopy(info('ip', at(2 * HOUR_MS)), NOW, false, formatEnd).timeLeft).toBe('About 2 hours left')
    expect(blockedScreenCopy(info('device', at(2 * DAY_MS)), NOW, false, formatEnd).timeLeft).toBe('About 2 days left')
  })
})

describe('blockedScreenCopy — Try again', () => {
  it.each(KINDS)('%s: before the end → no Try again', (kind) => {
    const copy = blockedScreenCopy(info(kind, at(MINUTE_MS)), NOW, true, formatEnd)
    expect(copy.showTryAgain).toBe(false)
    expect(copy.timeLeft).not.toBeNull()
  })

  it.each(KINDS)('%s: after the end and signed in → Try again, no time left', (kind) => {
    const copy = blockedScreenCopy(info(kind, at(-MINUTE_MS)), NOW, true, formatEnd)
    expect(copy.showTryAgain).toBe(true)
    expect(copy.timeLeft).toBeNull()
    expect(copy.body).toBe('This block has ended. Tap Try again to continue.')
    expect(copy.isPermanent).toBe(false)
  })

  it('exactly at the end counts as ended', () => {
    const copy = blockedScreenCopy(info('account', NOW.toISOString()), NOW, true, formatEnd)
    expect(copy.showTryAgain).toBe(true)
  })

  it('one millisecond before the end is not ended', () => {
    const copy = blockedScreenCopy(info('account', at(1)), NOW, true, formatEnd)
    expect(copy.showTryAgain).toBe(false)
  })

  it.each(KINDS)('%s: after the end but signed out → no Try again', (kind) => {
    const copy = blockedScreenCopy(info(kind, at(-MINUTE_MS)), NOW, false, formatEnd)
    expect(copy.showTryAgain).toBe(false)
    expect(copy.body).toBe('This block has ended. Log in to continue.')
  })

  it.each(KINDS)('%s: permanent → never Try again, signed in or not', (kind) => {
    expect(blockedScreenCopy(info(kind, null), NOW, true, formatEnd).showTryAgain).toBe(false)
    expect(blockedScreenCopy(info(kind, null), NOW, false, formatEnd).showTryAgain).toBe(false)
  })

  it('ticking the clock past the end flips Try again on', () => {
    const block = info('account', at(10 * MINUTE_MS))
    const before = blockedScreenCopy(block, NOW, true, formatEnd)
    const after = blockedScreenCopy(block, new Date(NOW.getTime() + 10 * MINUTE_MS), true, formatEnd)
    expect(before.showTryAgain).toBe(false)
    expect(after.showTryAgain).toBe(true)
  })
})

describe('blockedScreenCopy — action', () => {
  it.each(KINDS)('%s: signed in → sign-out', (kind) => {
    expect(blockedScreenCopy(info(kind, null), NOW, true, formatEnd).action).toBe('sign-out')
  })

  it.each(KINDS)('%s: signed out → back-to-login', (kind) => {
    expect(blockedScreenCopy(info(kind, null), NOW, false, formatEnd).action).toBe('back-to-login')
  })
})

describe('blockedScreenCopy — unreadable end date', () => {
  it.each(KINDS)('%s: invalid until → permanent-safe, no Try again, does not throw', (kind) => {
    const run = () => blockedScreenCopy(info(kind, 'not-a-date'), NOW, true, formatEnd)
    expect(run).not.toThrow()
    const copy = run()
    expect(copy.isPermanent).toBe(true)
    expect(copy.showTryAgain).toBe(false)
    expect(copy.timeLeft).toBeNull()
    expect(copy.body).not.toContain('Invalid Date')
    expect(copy.body).not.toContain(END_LABEL)
  })

  it('empty-string until → permanent', () => {
    const copy = blockedScreenCopy(info('device', ''), NOW, true, formatEnd)
    expect(copy.isPermanent).toBe(true)
    expect(copy.showTryAgain).toBe(false)
  })
})

describe('formatBlockEnd (default formatter)', () => {
  it('uses medium date + short time in the host locale', () => {
    const end = new Date('2026-11-04T16:30:00.000Z')
    expect(formatBlockEnd(end)).toBe(end.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))
  })

  it('is what blockedScreenCopy uses when no formatter is passed', () => {
    const until = at(DAY_MS)
    const copy = blockedScreenCopy(info('device', until), NOW, false)
    expect(copy.body).toContain(formatBlockEnd(new Date(until)))
  })
})
