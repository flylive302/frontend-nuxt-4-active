/**
 * Progression Constants
 *
 * Centralized configuration for badge / level-up celebration features.
 * Use these constants instead of magic numbers throughout the codebase.
 */

/**
 * Max celebration modals shown per page visit for a page-gated level-up
 * drain (level-up-celebrations epic, ticket 04). When more levels than this
 * were crossed since the device's watermark, the first `CAP - 1` crossed
 * levels are shown individually and the remainder are collapsed into one
 * summary modal — so a visit never shows more than this many popups.
 */
export const LEVEL_UP_MODAL_CAP = 3

/**
 * Max agency-milestone celebration modals shown per visit to
 * `/agency/my-income` (level-up-celebrations epic, ticket 05). Same cap rule
 * as the level-up drain: first `CAP - 1` crossed tiers individually, the rest
 * collapsed into one summary modal.
 */
export const MILESTONE_MODAL_CAP = LEVEL_UP_MODAL_CAP
