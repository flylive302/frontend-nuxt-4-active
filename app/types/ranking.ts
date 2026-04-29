// ========================================
// Ranking Types
// ========================================
// Shape of GET /api/v1/rankings response. Mirrors:
// - app/Http/Resources/V1/Ranking/RankingEntryResource.php
// - app/Http/Controllers/Api/V1/Ranking/RankingController.php
// ========================================

import type { MinimalUser } from '~/types/user/bootstrap'
import type { RankingCategory, RankingPeriod } from '~/constants/ranking'

/** Subject discriminator stored on each row. */
export type RankingSubjectType = 'user' | 'room' | 'agency'

/** Trimmed room shape returned inline on a Room/Agency-category entry row. */
export interface RankingRoomSubject {
  id: number
  name: string
  logo: string | null
  country: string | null
  is_live: boolean
  participant_count: number
  current_level: number
  owner: {
    id: number
    name: string
    signature: string
    avatar: string | null
  } | null
}

/** Trimmed agency shape returned inline on an Agency-category entry row. */
export interface RankingAgencySubject {
  id: number
  name: string
  country: string | null
  logo: string | null
  owner: MinimalUser | null
}

/**
 * One row of the global ranking. Exactly one of `user`/`room`/`agency`
 * is populated, matching `subject_type`.
 */
export interface RankingEntry {
  rank: number
  /** Score is sent as a string to preserve decimal precision. */
  score: string
  subject_type: RankingSubjectType
  user: MinimalUser | null
  room: RankingRoomSubject | null
  agency: RankingAgencySubject | null
}

/**
 * The authenticated caller's slot in the same (category, period).
 * `null` when the user has no qualifying subject (no room, no agency,
 * or simply outside the top-100 cut-off).
 */
export interface CurrentUserRank {
  rank: number
  score: string
  subject_type: RankingSubjectType
}

/** `data` payload of the ranking endpoint. */
export interface RankingResponseData {
  category: RankingCategory
  period: RankingPeriod
  /** ISO timestamp of the snapshot the entries were drawn from. */
  updated_at: string | null
  entries: RankingEntry[]
  current_user: CurrentUserRank | null
}

/** Full envelope from ApiResponse::success(). */
export interface RankingApiResponse {
  status: 'success' | 'error'
  message: string
  data: RankingResponseData
  meta: {
    timestamp: string
    correlation_id: string
  }
}
