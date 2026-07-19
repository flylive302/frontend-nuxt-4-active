// ========================================
// Legacy WebView polyfills
// ========================================
//
// The Vite build targets modern engines and does NOT polyfill newer
// built-ins. A long tail of Android WebViews (observed: Chrome 87 on
// Android 8) lacks `Array.prototype.at` / `String.prototype.at`
// (Chrome 92+), which vue-router uses (`route.matched.at(-1)`) — crashing
// every navigation on those devices. Named `00.` + `enforce: 'pre'` so the
// polyfill lands before any app/router code runs.
// ========================================

function polyfillAt(proto: { at?: unknown }): void {
  if (typeof proto.at === 'function') return
  Object.defineProperty(proto, 'at', {
    value: function at(this: { length: number; [i: number]: unknown }, index: number) {
      const n = Math.trunc(index) || 0
      const k = n < 0 ? this.length + n : n
      return k >= 0 && k < this.length ? this[k] : undefined
    },
    writable: true,
    configurable: true,
  })
}

export default defineNuxtPlugin({
  name: 'legacy-polyfills',
  enforce: 'pre',
  setup() {
    polyfillAt(Array.prototype as unknown as { at?: unknown })
    polyfillAt(String.prototype as unknown as { at?: unknown })
  },
})
