/**
 * Sets <html data-nav="forward|back"> before each navigation so the directional
 * root slide on the View Transition pseudo-elements (main.css) knows which way to
 * move:
 *   forward → the incoming page slides in from the right (drill-in)
 *   back    → the outgoing page slides off to the right (pop / back button)
 *
 * Direction is derived from the browser history position — Vue Router stores it
 * in `history.state.position` — so drill-downs and the OS/back button are
 * automatic with zero per-page config, and every new page just works.
 *
 * Sibling TAB navigations are a `push` in BOTH directions, which history cannot
 * tell apart, so their spatial left→right order is looked up in TAB_GROUPS.
 * These mirror the NavAlt `first-link` (left) / `second-link` (right) pairs — add
 * a row here whenever a new linked NavAlt tab bar is introduced.
 */

// Paths are compared trailing-slash-insensitively (see stripSlash).
const TAB_GROUPS: string[][] = [
  ['/mall', '/mall/my-props'],
  ['/coins/request', '/coins/exchange'],
  ['/levels/wealth', '/levels/charm'],
]

const stripSlash = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p)

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const root = document.documentElement
  let lastPos = (history.state?.position as number | undefined) ?? 0

  router.beforeEach((to, from) => {
    // data-nav is set on EVERY navigation — it drives the directional root slide
    // on the View Transition pseudo-elements (main.css). Morph navs (room card,
    // profile avatar) also set their own attribute in middleware; the room morph
    // suppresses the generic root slide, the profile morph rides on top of it.
    const toPath = stripSlash(to.path)
    const fromPath = stripSlash(from.path)

    // Tab bars: spatial order wins (both directions are a forward push).
    const group = TAB_GROUPS.find(g => g.includes(toPath) && g.includes(fromPath))
    if (group) {
      root.dataset.nav = group.indexOf(toPath) > group.indexOf(fromPath) ? 'forward' : 'back'
      return
    }

    // Everything else: a drop in history position means a back/pop navigation.
    // On a push the position hasn't advanced yet at guard time, so it reads equal
    // → forward, which is correct.
    const pos = (history.state?.position as number | undefined) ?? 0
    root.dataset.nav = pos < lastPos ? 'back' : 'forward'
  })

  // Sync the baseline to the committed position for the next comparison.
  router.afterEach(() => {
    lastPos = (history.state?.position as number | undefined) ?? 0
  })
})
