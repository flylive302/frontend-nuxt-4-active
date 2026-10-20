/**
 * CP event — pure helpers (no Vue, no stores).
 */
import type { CpPairCard, CpUserCard, CpWinnerCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'
import type { CpBootstrapConfig } from '~/types/user/bootstrap'
import { CP_HOURS_PER_DAY } from '~/constants/cp-event'

type FrameConfig = Pick<CpBootstrapConfig, 'frame_male' | 'frame_female'>

/** Backend gender values: 1 male, 2 female, 3 non-binary, 4 unspecified (legacy payloads: 'female'). */
function isFemale(gender: CpUserCard['gender'] | number | undefined): boolean {
  if (gender === null || gender === undefined) return false
  return String(gender).toLowerCase() === 'female' || String(gender) === '2'
}

/**
 * Static ring frame prop id for a CP list avatar. Female → `frame_female`;
 * male / null / other → `frame_male`. Null when the setting is unset.
 */
export function cpFrameId(user: Pick<CpUserCard, 'gender'>, config: FrameConfig): number | null {
  return isFemale(user.gender) ? config.frame_female : config.frame_male
}

/** Route of a user's CP profile page. */
export function cpProfilePath(signature: string): string {
  return `/cp-event/${signature}-cp`
}

/** Splits the hour total from `useMissionCountdown` into days + remaining hours. */
export function splitCountdownHours(totalHours: number): { days: number; hours: number } {
  return { days: Math.floor(totalHours / CP_HOURS_PER_DAY), hours: totalHours % CP_HOURS_PER_DAY }
}

/** Two-digit zero pad for countdown boxes. */
export function padTwo(value: number): string {
  return String(Math.max(0, value)).padStart(2, '0')
}

/**
 * Keyed, order-preserving dedupe for pair rows: incoming rows whose `pair_id`
 * is already present (or repeated within the page) are dropped; existing win.
 */
export function excludeExistingPairs<T extends { readonly pair_id: number }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set<number>(existing.map(p => p.pair_id))
  const fresh: T[] = []
  for (const pair of incoming) {
    if (seen.has(pair.pair_id)) continue
    seen.add(pair.pair_id)
    fresh.push(pair)
  }
  return fresh
}

/** `2026-W42` → `Week 42, 2026`; unparseable keys come back unchanged. */
export function formatCpWeekLabel(weekKey: string | null): string {
  if (!weekKey) return ''
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekKey)
  return match ? `Week ${Number(match[2])}, ${match[1]}` : weekKey
}

/**
 * Adapts a frozen winner to the pair shape `CpEventPodium` renders. A deleted
 * user (`null` on the wire) becomes a placeholder card. Winners carry no
 * lifetime figure, so `lifetime_intimacy` is 0; the square shows `weekly_score`.
 */
export function winnerToPairCard(winner: CpWinnerCard): CpPairCard {
  const deleted = (id: number): CpUserCard => ({
    id,
    name: 'Deleted user',
    signature: null,
    avatar: ASSETS.AVATAR_PLACEHOLDER,
    vip_level: 0,
    gender: null,
    frame_id: null,
  })
  return {
    pair_id: winner.pair_id,
    binder: winner.binder ?? deleted(-winner.pair_id * 2),
    partner: winner.partner ?? deleted(-winner.pair_id * 2 - 1),
    bound_at: '',
    days: 0,
    lifetime_intimacy: 0,
    weekly_score: winner.weekly_score,
    lifetime_rank: null,
    weekly_rank: winner.rank,
  }
}
