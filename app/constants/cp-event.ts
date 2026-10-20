/**
 * CP event (/cp-event) constants — shared by the `cp` layout's hero components
 * and the nav-direction plugin.
 */

/** Carts spaced evenly around the hero ferris wheel = last N rank-1 pairs (backend cp/history). */
export const CP_FERRIS_CART_COUNT = 6

/** Countdown units under the hero, left → right. */
export const CP_COUNTDOWN_UNITS = ['Days', 'Hours', 'Minutes', 'Seconds'] as const

/**
 * Tab bar under the hero, in on-screen left → right order. The order is
 * load-bearing: plugins/nav-direction.client.ts derives the slide direction
 * between sibling tabs from it.
 */
export const CP_EVENT_TABS = [
  { to: '/cp-event/square', label: 'CP Square' },
  { to: '/cp-event', label: 'CP List' },
  { to: '/cp-event/reward', label: 'CP Reward' },
] as const

/** Gift category that holds the CP gifts (matches backend `Gift::CP_CATEGORY`). */
export const CP_GIFT_CATEGORY = 'cp-gift'

/** Subcategory marking the single binding gift (matches backend `Gift::CP_BINDING_SUBCATEGORY`). */
export const CP_BINDING_SUBCATEGORY = 'binding'

/** Deepest list offset the backend serves (backend `cp.max_offset`). */
export const CP_LIST_MAX_OFFSET = 500

/** Pairs on the podium (ranks 1–3). */
export const CP_PODIUM_SIZE = 3

/** Debounce for socket-driven refetches — a gift combo of N = one refetch. */
export const CP_SIGNAL_DEBOUNCE_MS = 1000

/** Countdown-zero refetch: jittered retry until `week_key` changes. */
export const CP_WEEK_ROLL_RETRY_MIN_MS = 1000
export const CP_WEEK_ROLL_RETRY_MAX_MS = 5000
export const CP_WEEK_ROLL_MAX_TRIES = 6

/** Animated hero frame on the CP profile page (profile hero only — lists use the static ring). */
export const CP_PROFILE_FRAME_SVGA = 'https://assets.flyliveapp.com/events/cp/3.svga'

/** Avatar image keys inside CP_PROFILE_FRAME_SVGA — binder left, partner right. */
export const CP_PROFILE_FRAME_BINDER_KEY = 'avatar1'
export const CP_PROFILE_FRAME_PARTNER_KEY = 'avatar2'

/** Seconds → ms. */
export const CP_MS_PER_SECOND = 1000

/** Hours in a day, for the Days/Hours countdown split. */
export const CP_HOURS_PER_DAY = 24

/**
 * Seat heart shown between adjacent CP partners in a room (tier-gated SVGA; still frame elsewhere).
 * The final URL is launch content (wayfinder ticket 11 item 5) — a failed load renders nothing.
 */
export const CP_SEAT_HEART_SVGA = 'https://assets.flyliveapp.com/events/cp/heart.svga'

/** Max users sent to cp/seat-partners (backend cap). */
export const CP_SEAT_PARTNERS_MAX_USERS = 30

/** Debounce for the seat-occupant watch before asking cp/seat-partners. */
export const CP_SEAT_HEARTS_DEBOUNCE_MS = 750

/** Slow safety refetch of seat pairs (visible tab, ≥ 2 seated). */
export const CP_SEAT_HEARTS_SLOW_REFETCH_MS = 120_000

/** Max seat hearts running a live SVGA at once (the rest render the still). */
export const CP_SEAT_HEARTS_MAX_ANIMATED = 2

/** Rendered heart size in CSS px. */
export const CP_SEAT_HEART_SIZE_PX = 28

/**
 * Full-screen animation played to everyone in the room each time two CP partners become
 * seat neighbours (the moment their seat heart appears). Plays in the gift center lane.
 */
export const CP_BIND_FX_SVGA = 'https://assets.flyliveapp.com/events/cp/bind.svga'

/** Placeholder keys inside CP_BIND_FX_SVGA — `01` = the left seat's partner, `02` = the right seat's. */
export const CP_BIND_FX_LEFT_AVATAR_KEY = 'avatar01'
export const CP_BIND_FX_RIGHT_AVATAR_KEY = 'avatar02'
export const CP_BIND_FX_LEFT_NAME_KEY = 'username01'
export const CP_BIND_FX_RIGHT_NAME_KEY = 'username02'

/** Avatar fetch width in px — the SVGA's avatar slots are 191 units wide. */
export const CP_BIND_FX_AVATAR_WIDTH = 192

/** Synthetic gift id of the bind FX playback item — outside every real and entry-animation id. */
export const CP_BIND_FX_GIFT_ID = Number.MIN_SAFE_INTEGER

/**
 * Forced cp/seat-partners refetches after a binding gift lands in the room. Only the two
 * partners get cp.pair.bound; everyone else re-checks. Delayed because ApplyCpGift is queued,
 * so an immediate fetch can run before the pair exists.
 */
export const CP_BIND_REFETCH_DELAYS_MS = [3000, 8000] as const
