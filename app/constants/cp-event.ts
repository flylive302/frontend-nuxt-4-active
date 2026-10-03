/**
 * CP event (/cp-event) constants — shared by the `cp` layout's hero components
 * and the nav-direction plugin.
 */

/** Carts spaced evenly around the hero ferris wheel. */
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
