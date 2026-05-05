import { defineNuxtPlugin } from 'nuxt/app'
import VueVirtualScroller from 'vue-virtual-scroller'

// CSS is intentionally NOT imported here — keeping it out of the critical
// CSS bundle prevents a render-blocking stylesheet on every page.
// Each consumer imports it directly so Vite places it in that component's chunk.

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueVirtualScroller)
})
