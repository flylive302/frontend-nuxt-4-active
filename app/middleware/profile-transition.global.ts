/**
 * Tags <html> with the direction of a home⇄profile navigation so the CSS knows
 * whether to slide the profile page in (enter) or the home page back in (leave),
 * and — via attribute-gated CSS — which avatar owns the shared `profile-avatar`
 * name so the footer avatar morphs into the profile header avatar (see main.css).
 *
 * Same rationale as room-transition.global.ts: this runs in the guard chain,
 * ahead of Nuxt's view-transition capture in `router.beforeResolve`, so the
 * attribute (and thus the shared name) is present when the old page is snapshot.
 * We use an attribute instead of the View Transition `types` API because that
 * API's object-form `startViewTransition({ ... })` throws on Chrome 111–124.
 *
 * Scoped to the exact home⇄profile pair: that is the only pair where both the
 * footer avatar (source) and the profile header avatar (target) exist.
 */

const HOME_PATH = '/'
const PROFILE_PATH = '/profile'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const root = document.documentElement

  if (to.path === PROFILE_PATH && from.path === HOME_PATH) {
    root.dataset.profileTransition = 'enter'
  } else if (to.path === HOME_PATH && from.path === PROFILE_PATH) {
    root.dataset.profileTransition = 'leave'
  } else {
    delete root.dataset.profileTransition
  }
})
