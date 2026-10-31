// ========================================
// Native device id — resolved before the first API call (account-bans 05)
// ========================================
//
// `X-Device-ID` is set by a sync request hook, but the native id comes from an
// async bridge call (`Device.getId()`). This plugin awaits it once, at boot.
//
// Ordering: Nuxt awaits each non-`parallel` plugin before starting the next, in
// filename order, so `01.` runs after the `00.` polyfills and before `auth`,
// `bootstrap` and every other plugin that can fire a request. ⛔ Never mark it
// `parallel` — that would let `/bootstrap` (and the login request) go out with
// the web UUID.
//
// Boot never stalls on it: `resolveNativeDeviceId` caps the wait
// (NATIVE_DEVICE_ID_TIMEOUT_MS) and swallows every failure; web returns at once.
import { resolveNativeDeviceId } from '~/composables/shared/useDeviceId'

export default defineNuxtPlugin({
  name: 'device-id',
  async setup() {
    await resolveNativeDeviceId()
  },
})
