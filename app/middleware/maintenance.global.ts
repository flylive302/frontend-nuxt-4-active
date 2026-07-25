// ========================================
// Maintenance Wall (global)
// ========================================
//
// GATE. When the bundle was built with `NUXT_PUBLIC_MAINTENANCE_MODE=true`,
// every route in the app is unreachable and every navigation lands on
// /maintenance. There is no per-user bypass and no partial/read-only tier —
// this is a whole-app hard wall.
//
// The flag is BAKED IN AT BUILD TIME (`runtimeConfig.public` under `ssr: false`),
// so it is a deploy-scoped switch, not a runtime toggle: turning it on or off
// costs a Cloudflare Pages redeploy on web and an OTA bundle push for the
// Android shell. Nothing here polls the backend, so the wall holds even when
// Laravel and MSAB are completely down.
//
// Ordering matters twice over, and both come for free:
//   - Global middleware run in alphabetical filename order, and `maintenance`
//     sorts before `profile-transition` / `room-minimize` / `room-transition`.
//   - Nuxt runs ALL global middleware before any named page middleware, so
//     `auth` never gets to redirect a maintenance build to /log-in or /welcome.
import { MAINTENANCE_PATH } from '~/constants/maintenance'

export default defineNuxtRouteMiddleware((to) => {
  const isDown = useRuntimeConfig().public.maintenanceMode

  // Tolerate both `/maintenance` and `/maintenance/` — prerender runs with
  // `autoSubfolderIndex: false`, and a hand-typed URL can carry either form.
  // Comparing raw paths would miss one and redirect it onto itself forever.
  const path = to.path.replace(/\/+$/, '') || '/'
  const onWall = path === MAINTENANCE_PATH

  // Flag off: the wall is not somewhere anyone should be able to sit, so a tab
  // left open through the window — or a bookmarked URL — bounces home.
  if (!isDown) {
    return onWall ? navigateTo('/', { replace: true }) : undefined
  }

  if (onWall) return

  // `replace` so the wall does not stack history entries: with every route
  // redirecting here, `push` would make the device back button unusable.
  return navigateTo(MAINTENANCE_PATH, { replace: true })
})
