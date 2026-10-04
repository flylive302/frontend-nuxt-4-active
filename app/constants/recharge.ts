/**
 * Recharge activity (/recharge) constants — shared by the `recharge` layout's
 * chrome components, the mission pages and the nav-direction plugin.
 */

/** Mission timeframes the API knows (GET /missions/recharge/{timeframe}). */
export type RechargeTimeframe = 'daily' | 'weekly' | 'monthly'

/** Timeframes that also have a ranking leaderboard (weekly / monthly only). */
export type RechargeRankedTimeframe = Exclude<RechargeTimeframe, 'daily'>

/**
 * Tab bar under the banner, in on-screen left → right order. The order is
 * load-bearing: plugins/nav-direction.client.ts derives the slide direction
 * between sibling tabs from it.
 */
export const RECHARGE_TABS = [
  { to: '/recharge', label: 'Daily' },
  { to: '/recharge/weekly', label: 'Weekly' },
  { to: '/recharge/monthly', label: 'Monthly' },
] as const
