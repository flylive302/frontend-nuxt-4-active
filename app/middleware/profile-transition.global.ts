/**
 * Activates the shared-element avatar morph for the home ⇄ /profile pair by
 * tagging <html data-profile-avatar>. When present, main.css names BOTH the
 * footer avatar (home) and the profile header avatar `view-transition-name:
 * profile-avatar`, so the small footer avatar flies up and grows into the header
 * avatar (and reverses on the way back).
 *
 * Only the home⇄profile pair carries the marker:
 *   - home ⇄ /profile          → morph (both endpoints have an anchor).
 *   - /profile ⇄ /profile/{sig} → NO morph. The signature page renders a skeleton
 *     before its header avatar mounts, so the avatar is absent at snapshot time;
 *     naming the source avatar would strand it as a mid-screen ghost. That pair
 *     just uses the generic directional root slide (data-nav) like everything else.
 *
 * The page slide itself is no longer driven here — every navigation is a View
 * Transition and the directional root slide is gated on `data-nav`
 * (nav-direction.client.ts). This middleware only adds the avatar morph on top.
 *
 * Runs in the guard chain, ahead of Nuxt's view-transition capture in
 * `router.beforeResolve`, so the attribute is present when the old page is
 * snapshot. We use an attribute instead of the View Transition `types` API
 * because that API's object-form `startViewTransition({ ... })` throws on
 * Chrome 111–124.
 */

const HOME_PATH = '/'
const PROFILE_PATH = '/profile'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const root = document.documentElement

  const homeToProfile = to.path === PROFILE_PATH && from.path === HOME_PATH
  const profileToHome = to.path === HOME_PATH && from.path === PROFILE_PATH

  // Avatar morph only on the home⇄profile pair (both endpoints carry an anchor).
  if (homeToProfile || profileToHome) {
    root.dataset.profileAvatar = ''
  } else {
    delete root.dataset.profileAvatar
  }
})
