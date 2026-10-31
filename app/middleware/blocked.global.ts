// ========================================
// Blocked Wall (global) — account-bans 03
// ========================================
//
// GATE. While a block is stored (`authStore.blockInfo`, persisted), every
// navigation lands on /blocked — including the first one after a kill +
// relaunch, before any API call has had a chance to come back blocked again.
// The ways out (Try again, Sign out, Back to login) clear the stored block
// first, so they are never bounced back here.
//
// ⛔ Steps aside on a maintenance build: `maintenance.global.ts` redirects
// every route (including /blocked) to /maintenance, and both walls fighting
// would loop forever. Global middleware run in filename order, so this one
// runs first and has to yield explicitly.
import { BLOCKED_PATH } from '~/constants/blocked'

export default defineNuxtRouteMiddleware((to) => {
  if (useRuntimeConfig().public.maintenanceMode) return
  if (!useAuthStore().blockInfo) return

  const path = to.path.replace(/\/+$/, '') || '/'
  if (path === BLOCKED_PATH) return

  return navigateTo(BLOCKED_PATH, { replace: true })
})
