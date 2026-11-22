// ========================================
// Pretty ID Event Gate
// ========================================
//
// GATE. Pretty ID pages 404 unless the build was made with
// `NUXT_PUBLIC_PRETTY_ID_ENABLED=true` (`runtimeConfig.public.prettyIdEnabled`).
//
// The event currently runs on a mock backend (services/prettyIdMockApi.ts):
// balances, auctions and winners are fabricated on the device. The flag is
// therefore unset — off — in every build that reaches real users, so an event
// banner pointing at /pretty-id cannot show them fake data. When the real API
// ships, this becomes a server flag read from bootstrap, like `cp-enabled`.
export default defineNuxtRouteMiddleware(() => {
  if (!useRuntimeConfig().public.prettyIdEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })
  }
})
