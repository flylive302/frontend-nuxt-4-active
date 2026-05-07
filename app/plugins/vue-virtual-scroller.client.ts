// vue-virtual-scroller components and CSS are imported locally in each consuming
// component (chat-panel, info, infinite-scroll) so they only load on pages that
// need them — not on auth/public pages where they cause render-blocking CSS.
export default defineNuxtPlugin(() => {})
