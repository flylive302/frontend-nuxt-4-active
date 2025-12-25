# Frontend Conventions

## File Naming

### Component Suffixes

| Suffix | Purpose | Example |
|--------|---------|---------|
| `.client.vue` | Client-only components (browser APIs, DOM manipulation) | `minimized.client.vue` |
| `.server.vue` | Server-only components (SSR only) | N/A (SPA mode) |

### When to use `.client.vue`

Use the `.client.vue` suffix when a component:
- Uses browser-only APIs (`window`, `document`, `navigator`)
- Relies on DOM manipulation or measurements
- Uses third-party libraries that require browser environment
- Contains animations or transitions that should only run on client

**Example:** `app/components/room/minimized.client.vue`

## Logging

Use the production-safe logger instead of `console.log`:

```typescript
import { createLogger } from '~/utils/logger';

const log = createLogger('[ComponentName]');

log.debug('Debug info');  // Only in development
log.info('Info message'); // Only in development
log.warn('Warning');      // Always logged
log.error('Error');       // Always logged
```

## Constants

Import from `~/constants/room.ts` instead of using magic numbers:

```typescript
import { SEAT_COUNT, CONNECTION_TIMEOUT_MS } from '~/constants/room';
```

## Auto-Imports

Nuxt auto-imports are preferred over explicit imports for:
- Composables (`useRoomStore`, `useAuthStore`)
- Vue utilities (`ref`, `computed`, `watch`)
- Nuxt utilities (`useRuntimeConfig`, `useToast`)
