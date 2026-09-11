/**
 * Keeps a layout's persistent chrome STILL during the directional root slide.
 *
 * By default the whole page is one `root` snapshot, so a fixed header/footer
 * slides along with the content — wrong for sibling tabs that never leave the
 * layout (home ⇄ /discover-all-events). Tagging <html data-nav-shell="<layout>">
 * lets main.css give that layout's chrome its own `view-transition-name`, which
 * lifts it out of the root snapshot: the content slides underneath while the
 * header and footer stay pinned (their own old→new cross-fade still animates the
 * active-tab icon swap).
 *
 * Only set when BOTH endpoints render the same layout — otherwise the chrome has
 * no counterpart on the other side and would be stranded as a fading ghost.
 *
 * Mutually exclusive with the room-card and profile-avatar morphs by
 * construction: both of those cross a layout boundary (home → `room` / `profile`),
 * so the layouts differ and no marker is set.
 *
 * Runs in the guard chain, ahead of Nuxt's view-transition capture in
 * `router.beforeResolve`, so the attribute is present when the old page is
 * snapshot — same mechanism as profile-transition.global.ts.
 */

/** Layouts whose chrome main.css knows how to pin. Add a row + a CSS block together. */
const PINNABLE_LAYOUTS = new Set(['home'])

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const root = document.documentElement
  const layout = to.meta.layout

  // `from` is the sentinel route on a cold load — its layout is undefined, which
  // would compare equal to another undefined. Require a real, known layout name.
  const stable
    = typeof layout === 'string'
      && PINNABLE_LAYOUTS.has(layout)
      && layout === from.meta.layout

  if (stable) {
    root.dataset.navShell = layout
  } else {
    delete root.dataset.navShell
  }
})
