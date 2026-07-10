/**
 * Tags <html> with the direction of a room navigation so the CSS reveal knows
 * whether to expand or collapse (see `main.css`).
 *
 * This runs ahead of Nuxt's view-transition hook, which starts capturing in
 * `router.beforeResolve`. We use an attribute rather than the View Transition
 * `types` API because that API's object-form `startViewTransition({ ... })`
 * throws on Chrome 111–124 — WebView versions we still support.
 */

const ROOM_PATH_PREFIX = '/room/'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const root = document.documentElement

  if (to.path.startsWith(ROOM_PATH_PREFIX)) {
    root.dataset.roomTransition = 'enter'
  } else if (from.path.startsWith(ROOM_PATH_PREFIX)) {
    root.dataset.roomTransition = 'leave'
  } else {
    delete root.dataset.roomTransition
  }
})
