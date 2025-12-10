import { defineNuxtPlugin, type NuxtApp } from 'nuxt/app'
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

export default defineNuxtPlugin((nuxtApp: NuxtApp) => {
  nuxtApp.vueApp.use(VueVirtualScroller)
})
