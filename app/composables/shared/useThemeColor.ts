// ========================================
// Theme Color Composable
// ========================================
// Dynamically controls the <meta name="theme-color"> tag on a per-page
// basis.  On Android PWAs, this drives the status-bar & navigation-bar
// colour.  On iOS with `black-translucent`, the tag is informational only.
//
// Relies on Unhead's automatic deduplication: meta tags with the same
// `name` attribute are merged, and the most-recent entry wins.  When the
// calling component unmounts, Unhead disposes the entry — so the value
// automatically reverts to the app-level default (`#000000` in nuxt.config).
//
// Usage (page or layout):
//   useThemeColor('#ff2465')                 // static colour
//   useThemeColor(computed(() => room.color)) // reactive colour

import type { MaybeRefOrGetter } from 'vue'

/** Default mirrors `nuxt.config.ts > app.head.meta > theme-color` */
const DEFAULT_THEME_COLOR = '#ff2465' as const

/**
 * Override the document `theme-color` meta tag for the lifetime of the
 * calling component.  Accepts a static string, a `Ref<string>`, or a
 * getter — any shape Vue considers `MaybeRefOrGetter<string>`.
 *
 * @param color - the desired theme colour (hex string).
 *                Defaults to `#000000` if omitted.
 */
export function useThemeColor(color: MaybeRefOrGetter<string> = DEFAULT_THEME_COLOR): void {
  useHead({
    meta: [
      { name: 'theme-color', content: color },
    ],
  })
}
