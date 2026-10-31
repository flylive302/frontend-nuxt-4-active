// ========================================
// Blocked screen copy (account-bans 03)
// ========================================
// Pure. Turns a BlockInfo + the clock + sign-in state into everything /blocked
// needs to render. No Vue, no stores, no `new Date()` of its own — `now` is
// always passed in, so the page controls the tick and tests are deterministic.

import {
  BLOCKED_END_DATE_FORMAT,
  HOURS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
} from '~/constants/blocked'
import type { BlockInfo, BlockKind } from '~/types/user/block'

export type BlockedScreenAction = 'sign-out' | 'back-to-login'

export interface BlockedScreenCopy {
  title: string
  body: string
  /** Account blocks only. Always null for IP / device, whatever the input says. */
  reason: string | null
  /** "About 3 days left" — timed blocks that have not ended yet, else null. */
  timeLeft: string | null
  /** No end date (or an end date we cannot read — treated as permanent, the safe side). */
  isPermanent: boolean
  /** Timed block, end reached, and the user still holds a session. Never on permanent. */
  showTryAgain: boolean
  action: BlockedScreenAction
}

/** Formats the block end date for display; injectable so tests do not depend on the host locale. */
export type BlockEndFormatter = (end: Date) => string

const TITLES: Record<BlockKind, string> = {
  account: 'Account blocked',
  ip: 'Network blocked',
  device: 'Device blocked',
}

const ENDED_BODY_SIGNED_IN = 'This block has ended. Tap Try again to continue.'
const ENDED_BODY_SIGNED_OUT = 'This block has ended. Log in to continue.'

export function formatBlockEnd(end: Date): string {
  return end.toLocaleString(undefined, BLOCKED_END_DATE_FORMAT)
}

/** The end of the block, or null when permanent / unreadable. */
function parseBlockEnd(until: string | null): Date | null {
  if (!until) return null
  const end = new Date(until)
  return Number.isNaN(end.getTime()) ? null : end
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

/** Rounds down to the largest whole unit: days, then hours, then minutes (at least 1). */
function formatTimeLeft(remainingMs: number): string {
  const hours = Math.floor(remainingMs / MS_PER_HOUR)
  const days = Math.floor(hours / HOURS_PER_DAY)

  if (days > 0) return `About ${plural(days, 'day')} left`
  if (hours > 0) return `About ${plural(hours, 'hour')} left`

  const minutes = Math.max(1, Math.floor(remainingMs / MS_PER_MINUTE))
  return `About ${plural(minutes, 'minute')} left`
}

/** `endLabel` null = permanent. */
function activeBody(kind: BlockKind, endLabel: string | null): string {
  switch (kind) {
    case 'ip':
      return endLabel
        ? `The network you're on is blocked until ${endLabel}. Try Wi-Fi or mobile data.`
        : `The network you're on is blocked. Try Wi-Fi or mobile data.`
    case 'device':
      return endLabel ? `This device is blocked until ${endLabel}.` : 'This device is blocked.'
    case 'account':
      return endLabel
        ? `Your account has been blocked until ${endLabel}.`
        : 'Your account has been blocked.'
  }
}

export function blockedScreenCopy(
  info: BlockInfo,
  now: Date,
  signedIn: boolean,
  formatEnd: BlockEndFormatter = formatBlockEnd,
): BlockedScreenCopy {
  const end = parseBlockEnd(info.until)
  const isPermanent = end === null
  const hasEnded = end !== null && now.getTime() >= end.getTime()

  let body: string
  if (hasEnded) body = signedIn ? ENDED_BODY_SIGNED_IN : ENDED_BODY_SIGNED_OUT
  else body = activeBody(info.kind, end ? formatEnd(end) : null)

  const reason = info.kind === 'account' && info.reason?.trim() ? info.reason : null

  return {
    title: TITLES[info.kind],
    body,
    reason,
    timeLeft: end && !hasEnded ? formatTimeLeft(end.getTime() - now.getTime()) : null,
    isPermanent,
    showTryAgain: hasEnded && signedIn,
    action: signedIn ? 'sign-out' : 'back-to-login',
  }
}
