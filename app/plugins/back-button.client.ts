// ========================================
// Android Back Button Plugin
// ========================================
//
// Thin INTENT trigger. The whole pipeline lives in `useAndroidBackButton`
// (EXECUTE/REACT) and `utils/backNavigation` (GATE).
//
// Registered here rather than inside `global-shell.client.vue` on purpose: the
// shell is not mounted on auth routes, `/offline`, or in maintenance mode, and
// a back button that silently changes behaviour between screens is worse than
// one that behaves the same everywhere.

import { Capacitor } from '@capacitor/core';

export default defineNuxtPlugin((nuxtApp) => {
  // GATE — native only. `@capacitor/app` never emits `backButton` in a browser,
  // and on mobile web the browser's own back is already correct.
  if (!Capacitor.isNativePlatform()) return;

  const { start } = useAndroidBackButton();

  // Deferred to `app:mounted` so the toast host exists before the first press
  // can reach `useToast()`.
  nuxtApp.hook('app:mounted', () => {
    void start();
  });
});
