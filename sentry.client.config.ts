import * as Sentry from '@sentry/nuxt'
import { applySentryEventPolicy } from '~/utils/sentry-event-policy'

const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentry.dsn as string,
  environment: config.public.sentry.environment as string,
  release: (config.public.sentry.release as string) || undefined,

  sendDefaultPii: false,

  // 20% of transactions — adjust per environment as traffic grows
  tracesSampleRate: 0.2,

  // Strips PII down to `user.id`, and tags auto-recovered stale-bundle errors
  // `recovered: true` so the issue stream can filter them with `!recovered:true`
  // without losing the evidence that chunk recovery still works.
  // Logic lives in `~/utils/sentry-event-policy` so it is unit-testable.
  beforeSend(event, hint) {
    return applySentryEventPolicy(event, hint)
  },
})
