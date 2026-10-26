// CP Event (couples) — API shapes.
// Mirrors backend routes/api/cp.php (all under /api/v1/cp, auth + `cp.enabled`):
//   GET  cp/list                 → CpListResponse
//   GET  cp/list/page?offset=N   → CpListPageResponse
//   GET  cp/me                   → CpMeResponse
//   GET  cp/profile/{signature}  → CpProfileResponse
//   POST cp/pairs/{pair}/break   → 200 | 403 | 409
//   GET  cp/rewards              → CpRewardsResponse
//   GET  cp/square               → CpSquareResponse
//   GET  cp/history              → CpHistoryResponse
//   POST cp/seat-partners        → CpSeatPartnersResponse
// Backend resources: app/Http/Resources/V1/Cp/{CpUserCardResource,CpPairCardResource}.php

import type { CoinRewardMode, RewardType } from '~/types/mission/recharge'

/** `{ data }` wrapper every cp/* endpoint returns. */
export interface CpEnvelope<T> {
  readonly data: T
}

/** Compact user on every CP surface (CpUserCardResource). */
export interface CpUserCard {
  readonly id: number
  readonly name: string | null
  readonly signature: string | null
  readonly avatar: string | null
  readonly vip_level: number
  readonly gender: string | null
  readonly frame_id: number | null
}

/**
 * One pair (CpPairCardResource). `binder` is always shown left, `partner` right.
 * `weekly_score` is for the current week. `points` / `can_break` are present
 * only when the viewer is one of the two partners.
 */
export interface CpPairCard {
  readonly pair_id: number
  readonly binder: CpUserCard
  readonly partner: CpUserCard
  readonly bound_at: string
  /** Days together, bind day = 1. */
  readonly days: number
  readonly lifetime_intimacy: number
  readonly weekly_score: number
  /**
   * Positions among SHOWN pairs — pairs with a staff or banned partner are never counted.
   * Null = unranked: such a hidden pair, not in that ranking, or not computed for this row.
   */
  readonly lifetime_rank: number | null
  readonly weekly_rank: number | null
  readonly points?: number
  readonly can_break?: boolean
}

/** Week clock — the countdown is fed by server time, never the phone clock. */
export interface CpWeekMeta {
  /** `YYYY-Www`. */
  readonly week_key: string
  /** ISO-8601 — next Monday 02:00 PKT. */
  readonly closes_at: string
  /** ISO-8601 server "now" at response time. */
  readonly server_time: string
}

/** GET cp/list — podium + first page of ranks 4+, ranked by this week's score. */
export interface CpListResponse {
  readonly top: CpPairCard[]
  readonly page: CpPairCard[]
  /** Offset to request next (null = end of list or offset cap reached). */
  readonly next_offset: number | null
  readonly week: CpWeekMeta
}

/** GET cp/list/page?offset=N — 20 rows of ranks 4+. */
export interface CpListPageResponse {
  readonly page: CpPairCard[]
  readonly next_offset: number | null
}

/** GET cp/me — the viewer's pair leading this week (lifetime breaks ties), with both ranks. */
export interface CpMeResponse {
  readonly pair: CpPairCard | null
  readonly week: CpWeekMeta
}

/** GET cp/profile/{signature} — a user's pairs, ordered by lifetime intimacy. */
export interface CpProfileResponse {
  readonly user: CpUserCard
  /** Top pair (header) — carries the all-time (lifetime) rank. Null = no CP yet. */
  readonly top_pair: CpPairCard | null
  /** All active pairs including the top one, lifetime desc. */
  readonly pairs: CpPairCard[]
}

/** One configured weekly reward row (recharge key names). */
export interface CpRewardItem {
  readonly id: number
  readonly rank: number
  readonly reward_type: RewardType
  readonly reward_id: number | null
  readonly duration_days: number | null
  readonly coin_mode: CoinRewardMode | null
  readonly coin_value: number | null
  readonly sort_order: number
}

/** GET cp/rewards — one list per rank 1–3. */
export interface CpRewardsResponse {
  readonly ranks: { readonly rank: 1 | 2 | 3; readonly rewards: CpRewardItem[] }[]
}

/** A frozen weekly winner (cp_week_winners snapshot). */
export interface CpWinnerCard {
  readonly week_key: string
  readonly rank: number
  readonly pair_id: number
  readonly binder: CpUserCard | null
  readonly partner: CpUserCard | null
  readonly weekly_score: number
}

/**
 * GET cp/square — last closed week's top 3 (broken pairs hidden, so the next
 * one moves up) and the all-time top 50 by lifetime intimacy (`lifetime_rank`
 * 1..50, never resets). `all_time` is absent from a backend older than it.
 */
export interface CpSquareResponse {
  readonly week_key: string | null
  readonly winners: CpWinnerCard[]
  readonly all_time?: CpPairCard[]
}

/** GET cp/history — the last 6 rank-1 pairs still together, newest first. */
export interface CpHistoryResponse {
  readonly winners: CpWinnerCard[]
}

/** POST cp/seat-partners — active pairs fully inside the posted user set. */
export interface CpSeatPartnersResponse {
  readonly pairs: { readonly pair_id: number; readonly binder_id: number; readonly partner_id: number }[]
}
