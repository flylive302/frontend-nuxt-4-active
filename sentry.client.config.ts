import * as Sentry from '@sentry/nuxt'

const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentry.dsn as string,
  environment: config.public.sentry.environment as string,
  release: (config.public.sentry.release as string) || undefined,

  sendDefaultPii: false,

  // 20% of transactions — adjust per environment as traffic grows
  tracesSampleRate: 0.2,

  // Strip any PII that might land in the user context; only id is allowed
  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id }
    }
    return event
  },
})
