# FlyLive Bootstrap & Preloading System PRD

> **Reference Document for AI Agents & Development Team**
> 
> This PRD serves as the source of truth for the Bootstrap/Preloading refactor.
> 
> **Related Docs**:
> - [PHASE_0_DATA_ANALYSIS.md](./PHASE_0_DATA_ANALYSIS.md) - Redundancy report
> - [PHASE_0_SCHEMA_DECISIONS.md](./PHASE_0_SCHEMA_DECISIONS.md) - Type definitions

---

## Document Status

| Item | Status |
|------|--------|
| Phase 0: Discovery | ✅ Complete |
| Phase 1-10: Planning | 🔄 Ready for implementation |

---

## Executive Summary

Replace FlyLive's fragmented preloading system with a **centralized bootstrap architecture**:

1. Single bootstrap plugin with clear lifecycle phases
2. Pinia persistence for config data
3. Cache Storage for binary assets
4. Middleware gating until critical bootstrap completes
5. App-store compliant cellular download strategy
6. PWA/TWA packaging readiness
7. MSAB realtime updates
8. Push notifications for background engagement

---

## Table of Contents

1. [Objectives](#objectives)
2. [Store Criticality](#store-criticality)
3. [API Endpoints for Bootstrap](#api-endpoints-for-bootstrap)
4. [Countries Data Strategy](#countries-data-strategy)
5. [MSAB Events Analysis](#msab-events-analysis)
6. [Phase Details](#phase-details)
7. [Naming Conventions](#naming-conventions)
8. [Audio Streaming Optimization](#audio-streaming-optimization)
9. [Cellular Download Strategy](#cellular-download-strategy)
10. [Open Questions](#open-questions)

---

## Objectives

| Objective | Success Criteria |
|-----------|------------------|
| **Fast cold start** | Critical bootstrap completes in <3s on 4G |
| **Reduced network requests** | Config fetched once per session, assets cached persistently |
| **App store compliant downloads** | Critical assets download without consent; consent for non-critical only |
| **Offline-ready** | Critical assets available offline after first load |
| **TWA/Play Store ready** | App passes installability criteria, offline-ready for store submission |
| **Clean architecture** | Single source of truth for bootstrap state, legacy preloader fully removed |
| **Badge performance** | Zero badge-related API calls during UI rendering |
| **Realtime updates** | All in-app notifications via MSAB socket, no polling |
| **Push notifications** | Background engagement via Web Push API |

---

## Store Criticality

| Store | Priority | Rationale |
|-------|----------|-----------|
| `useAuthStore` | **P0** | Session required for everything |
| `useRoomStore` | **P0** | First data user sees after auth |
| `useGiftStore` | **P0** | Core feature, must load immediately |
| `useLevelsStore` | **P1** | Badge display throughout app |
| `useBadgesStore` | **P1** | User profile display |
| `useIncomeStore` | **P1** | Income targets for hosts |
| `useAgencyStore` | **P1** | Agency membership context |
| `useNotificationStore` | **P2** | Can hydrate async |
| `useRewardsStore` | **P3** | Non-critical, lazy load |
| `useTransactionsStore` | **P3** | Non-critical, lazy load |

---

## API Endpoints for Bootstrap

| Endpoint | Priority | Data |
|----------|----------|------|
| `/auth/user` | P0 | User session |
| `/rooms` | P0 | Room listings |
| `/rooms/myRoom` | P0 | User's room |
| `/gifts/all` | P0 | Gift catalog |
| `/profile/levels` | P1 | User levels |
| `/levels/config` | P1 | XP thresholds |
| `/user/income` | P1 | Income stats |
| `/user/agency` | P1 | Agency context |

---

## Countries Data Strategy

### Current State

- File: `public/countries.json` (19KB, ~245 countries)
- Structure: `{ name, code, dial_code }`
- Usage: Country selection dropdowns, phone formatting

### Recommendation

**Keep the JSON file** and include it in service worker precache:

1. **Stability**: Country data rarely changes
2. **Performance**: Zero network latency
3. **Offline-ready**: Works without internet
4. **Size**: 19KB is negligible

---

## MSAB Events Analysis

### Currently Implemented (MSAB Docs)

| Event | Direction | Status |
|-------|-----------|--------|
| `gift:send` | Client → Server | ✅ Implemented |
| `gift:received` | Server → Client | ✅ Implemented |
| `gift:error` | Server → Client | ✅ Implemented |
| `chat:message` | Bidirectional | ✅ Implemented |
| `room:join` | Client → Server | ✅ Implemented |
| `room:userJoined` | Server → Client | ✅ Implemented |
| `room:userLeft` | Server → Client | ✅ Implemented |
| `speaker:active` | Server → Client | ✅ Implemented |

### Events From mega_feature Docs (Proposed)

| Event | Handler | Status |
|-------|---------|--------|
| `balance.updated` | Update user coins/XP | 📋 In Docs |
| `reward.earned` | Show reward toast | 📋 In Docs |
| `badge.earned` | Show badge animation | 📋 In Docs |
| `income_target.completed` | Show completion modal | 📋 In Docs |
| `room.level_up` | Update room level | 📋 In Docs |

### Agency Events (Proposed New)

| Event | Purpose | Pros | Cons |
|-------|---------|------|------|
| `agency.invitation` | Realtime invite notification | Instant UX | Backend work |
| `agency.join_request` | Realtime request for owners | Instant UX | Backend work |
| `agency.member_joined` | Update member list | UI sync | Minor benefit |
| `agency.member_kicked` | Notify kicked member | Important UX | Backend work |
| `agency.dissolved` | Notify all members | Critical | Backend work |

---

## Phase Details

### Phase 0: Discovery & Inventory ✅ COMPLETE

**Summary**: 
- Identified 10 Pinia stores with criticality levels
- Mapped 8 API endpoints for bootstrap
- Documented legacy preloading logic
- Reviewed MSAB event implementations

**Deep Analysis**: See [PHASE_0_DATA_ANALYSIS.md](./PHASE_0_DATA_ANALYSIS.md)

Key findings:
- 12 unused User fields can be removed
- Avatar/Logo optimization: 75% reduction (4 URLs → 1 template)
- Room data: 71% reduction (nested User → minimal owner)
- Gift pagination: Top 30 by `sort_order` for bootstrap
- Room levels: Same pattern as user levels
- **Estimated total payload reduction: 63%**

---

### Phase 1: Bootstrap API Contract

**Goal**: Define consolidated `/api/v1/bootstrap` endpoint

#### Proposed API Response

```typescript
interface BootstrapResponse {
  version: string
  
  user: BootstrapUser | null
  
  config: {
    wealth_levels: LevelConfigItem[]
    charm_levels: LevelConfigItem[]
    room_levels: LevelConfigItem[]
    level_badges: Badge[]
    feature_flags: Record<string, boolean>
  }
  
  gifts: {
    catalog: Gift[]  // Top 30 by sort_order
  }
  
  user_data: {
    levels: UserLevelsResponse
    badges: UserBadge[]
    income_target: IncomeTarget | null
    agency: UserAgencyContext | null
  }
  
  push_config: {
    vapid_public_key: string
  }
}
```

**Note**: Rooms always fetch fresh (cursor paginated), not in bootstrap.

#### Acceptance Criteria

- [ ] Response schema finalized
- [ ] Backend team requirements documented
- [ ] Cache headers defined

---

### Phase 2: Client Bootstrap Plugin & Middleware

**Goal**: Implement bootstrap orchestration with preloader UI

#### Files to Create

| File | Purpose |
|------|---------|
| `app/stores/bootstrap.ts` | Bootstrap state management |
| `app/plugins/bootstrap.client.ts` | Bootstrap orchestrator |
| `app/middleware/bootstrap.ts` | Navigation gating |
| `app/components/preloader/FullScreenLoader.vue` | Preloader UI |
| `app/constants/cache.ts` | TTL configuration |

#### Bootstrap Store

```typescript
export const useBootstrapStore = defineStore('bootstrap', () => {
  const phase = ref<'idle' | 'auth' | 'config' | 'critical-assets' | 'complete'>('idle')
  const progress = ref(0)
  const error = ref<string | null>(null)
  
  // Config data (persisted)
  const config = ref<BootstrapConfig | null>(null)
  const giftCatalog = ref<Gift[]>([])
  const levelBadges = ref<Badge[]>([])
  
  // Tracking
  const lastBootstrapAt = ref<number | null>(null)
  const cellularConsentGiven = ref(false)
  
  const isComplete = computed(() => phase.value === 'complete')
  
  return { /* ... */ }
}, {
  persist: {
    pick: ['config', 'giftCatalog', 'levelBadges', 'cellularConsentGiven', 'lastBootstrapAt']
  }
})
```

#### TTL Configuration

```typescript
// app/constants/cache.ts
export const CACHE_TTL = {
  LEVEL_CONFIG: 24 * 60 * 60 * 1000,  // 24 hours
  GIFT_CATALOG: 24 * 60 * 60 * 1000,  // 24 hours
  BADGE_CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  COUNTRIES: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const
```

#### Acceptance Criteria

- [ ] Preloader shows during bootstrap
- [ ] Progress reflects actual state
- [ ] Skip available after timeout
- [ ] Auth pages accessible without bootstrap

---

### Phase 2.5: MSAB Realtime Events

**Goal**: Replace polling with socket events

#### Events to Handle

| Category | Events |
|----------|--------|
| Balance | `balance.updated` |
| Rewards | `reward.earned`, `badge.earned` |
| Income | `income_target.completed` |
| Room | `room.level_up` |
| Agency | `agency.invitation`, `agency.join_request`, `agency.member_joined`, `agency.member_kicked`, `agency.dissolved` |

#### Composable: `useRealtimeEvents.ts`

```typescript
export function useRealtimeEvents() {
  const { socket } = useAudioSocket()
  
  function registerHandlers() {
    if (!socket.value) return
    
    socket.value.on('balance.updated', handleBalanceUpdate)
    socket.value.on('reward.earned', handleRewardEarned)
    socket.value.on('badge.earned', handleBadgeEarned)
    socket.value.on('income_target.completed', handleTargetCompleted)
    socket.value.on('agency.invitation', handleAgencyInvitation)
    // ... etc
  }
  
  return { registerHandlers, unregisterHandlers }
}
```

#### Acceptance Criteria

- [ ] Polling removed from notification store
- [ ] Socket events trigger store updates
- [ ] Toast/modal shown for user-facing events

---

### Phase 3: Critical Asset Downloader

**Goal**: Download queue with Cache Storage persistence

#### Key Decisions

- **Priority**: Determined by `sort_order` from backend
- **Concurrency**: Maximum 3 concurrent downloads
- **Retries**: 2 automatic retries on failure
- **Critical assets**: Download silently without user consent
- **Non-critical assets**: Require consent on cellular >5MB

#### Services

| Service | Purpose |
|---------|---------|
| `app/services/assetDownloader.ts` | Queue with concurrency control |
| `app/services/cacheStorage.ts` | Cache Storage wrapper |
| `app/services/assetIndex.ts` | IndexedDB for asset metadata |

---

### Phase 4: Remove Legacy Preloader

**Goal**: Clean removal of old preloading code

#### Files to Delete

- `app/utils/level-badge.ts` (232 lines)

#### Files to Refactor

| File | Change |
|------|--------|
| `app/composables/useGiftData.ts` | Remove fetch, read from bootstrap |
| `app/stores/levels.ts` | Remove fetchLevels, seed from bootstrap |
| `app/stores/auth.ts` | Remove fetchUser, persist token only |
| `app/middleware/auth.ts` | Remove hydration calls |
| `app/plugins/auth.ts` | Replace with bootstrap plugin |

---

### Phase 5: Service Worker & PWA

**Goal**: Configure vite-pwa-nuxt

**Update Strategy**: Silent updates recommended

```typescript
// nuxt.config.ts
pwa: {
  registerType: 'autoUpdate',
  manifest: {
    name: 'FlyLive',
    short_name: 'FlyLive',
    theme_color: '#6366f1',
  }
}
```

---

### Phase 6: Badge Utility

**Goal**: Synchronous badge computation from bootstrap config

```typescript
// Build map once at bootstrap
const badgeMap = new Map(
  config.level_badges.map(b => [b.id, b])
)

// O(1) lookup
function getBadgeById(id: number): Badge | null {
  return badgeMap.get(id) ?? null
}

function getLevelFromXp(xp: number, category: 'wealth' | 'charm' | 'room'): LevelInfo {
  const levels = bootstrapStore.config[`${category}_levels`]
  return levels.findLast(l => xp >= l.required_xp) ?? DEFAULT
}
```

---

### Phase 7: Telemetry

**Goal**: Track bootstrap performance

**Events**:
- `bootstrap_started`
- `bootstrap_completed` (with timing)
- `bootstrap_failed` (with error)
- `cellular_consent_*`

---

### Phase 8: MSAB Config Invalidation

**Goal**: Realtime config/asset updates

**Events**:
- `config:invalidate` → Refresh config
- `asset:invalidate` → Re-download assets

---

### Phase 9: TWA Packaging

**Goal**: Play Store ready

**Checklist**:
- [ ] PWA icons (192x192, 512x512)
- [ ] Manifest complete
- [ ] Digital Asset Links
- [ ] Lighthouse PWA audit passes

---

### Phase 10: Push Notifications

**Goal**: Background engagement via Web Push API

#### Technology Stack

| Component | Technology |
|-----------|------------|
| Browser API | Web Push API + Service Worker |
| Push Service | Firebase Cloud Messaging (FCM) |
| Backend | Laravel + web-push package |

#### Permission Flow

1. Wait for user engagement (not on load)
2. Show modal explaining benefits
3. Request permission
4. Register with FCM
5. Send subscription to backend

---

## Naming Conventions

Following Vue/Nuxt community standards:

| Type | Convention | Example |
|------|------------|---------|
| Composables | `use` prefix | `useRealtimeEvents` |
| Stores | `use...Store` | `useBootstrapStore` |
| Services | camelCase | `assetDownloader` |
| Utils | camelCase | `levelBadge` |
| Components | PascalCase | `FullScreenLoader.vue` |

---

## Audio Streaming Optimization

Since FlyLive is audio-only (no video), here are optimizations:

| Optimization | Benefit |
|--------------|---------|
| `opusDtx: true` | Reduces bandwidth during silence |
| `opusFec: true` | Better quality on lossy networks |
| `opusStereo: false` | Mono = less bandwidth |
| `sampleRate: 48000` | Standard for Opus |
| `channelCount: 1` | Mono sufficient for speech |

---

## Cellular Download Strategy

### App Store Compliance

1. **Critical assets** (needed for app to function) can download without consent
2. **Non-critical assets** (enhancements) should offer user choice on cellular
3. **Size disclosure** required before large downloads

### Implementation Flow

```
Start Bootstrap → Download Config → Download Critical Assets
                                           ↓
                            Network Type? → WiFi → Download All
                                         → Cellular → Size > 5MB?
                                                         ↓
                                              Yes → Show Consent Modal
                                              No  → Download All
```

---

## Storage & Caching Strategy

| Data Type | Storage | Persistence |
|-----------|---------|-------------|
| User session | Pinia (token) | Cookie |
| Level config | Pinia (bootstrap) | localStorage |
| Gift catalog | Pinia (bootstrap) | localStorage |
| Level badges | Pinia (bootstrap) | localStorage |
| Room list | Pinia (room) | Session only |
| SVGA animations | Cache Storage | Persistent |
| Gift videos | Cache Storage | Persistent |
| CDN images | SW Cache | LRU eviction |

---

## Backend Requirements Summary

> [!IMPORTANT]
> After Phase 1 finalization, produce backend requirements doc covering:

1. **Bootstrap API** (`/api/v1/bootstrap`)
   - Consolidated response schema
   - Include gift catalog (30 by sort_order)
   - Versioning strategy
   - Cache headers

2. **Asset Manifest**
   - Include `sort_order` for priority
   - Include `size_bytes` for download estimation

3. **MSAB Events**
   - All agency events (invitation, join request, member changes)
   - `config:invalidate` event
   - `asset:invalidate` event

4. **Push Notifications**
   - Subscription storage endpoint
   - FCM integration

---

## Verification Plan

### Automated Tests

```bash
pnpm test app/stores/bootstrap.test.ts
pnpm test app/services/assetDownloader.test.ts
pnpm test app/composables/useRealtimeEvents.test.ts
```

### Manual Verification

1. **Cold start on 4G**: Measure bootstrap duration
2. **Cellular consent**: Verify modal only for non-critical
3. **Offline mode**: Verify cached content loads
4. **PWA install**: Install on Android/iOS
5. **MSAB notifications**: Trigger events, verify updates

---

## Summary

This PRD defines an 11-phase plan to modernize FlyLive's loading architecture:

1. **Consolidated bootstrap** with all critical data
2. **MSAB-based in-app notifications** replacing polling
3. **Push notifications** for background engagement
4. **Smart cellular handling** with app store compliance
5. **Audio streaming optimizations** for better quality
6. **PWA-ready** with silent updates
7. **Clean architecture** with ~400 lines removed

The implementation maintains backward compatibility through migration adapters while enabling clean removal of legacy code.
