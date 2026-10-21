/**
 * Turns the native View Transition off per navigation on weak devices
 * (cost-and-speed-tuning/14). `nuxt.config` keeps `app.viewTransition: true`;
 * Nuxt's `view-transitions.client` plugin reads `to.meta.viewTransition` in
 * `router.beforeResolve`, which runs after route middleware, so setting it to
 * `false` here skips the snapshot for that navigation only. `to.meta` is a
 * fresh object per resolved location, so nothing leaks to other navigations.
 *
 * Tier decision lives in `utils/fx-tier-defaults.ts` (low -> off).
 */
import { defaultFxForTier, readFxTier, resolveFxEnabled } from '~/utils/fx-tier-defaults'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  // No user switch for transitions: `auto` = tier decides.
  if (resolveFxEnabled('auto', defaultFxForTier(readFxTier()).viewTransitions)) return

  to.meta.viewTransition = false
})
