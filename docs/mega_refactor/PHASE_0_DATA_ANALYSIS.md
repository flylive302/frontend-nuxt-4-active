# Phase 0: Data Analysis & Redundancy Report

> **Complete analysis for bootstrap system implementation**
> 
> This document provides the analysis that informs implementation decisions.
> For finalized schemas, see [PHASE_0_SCHEMA_DECISIONS.md](./PHASE_0_SCHEMA_DECISIONS.md)

---

## 1. Current API Call Analysis

### Calls Made on App Start

| Endpoint | Location | Purpose |
|----------|----------|---------|
| `GET /auth/user` | `auth.ts:37`, `plugins/auth.ts:8` | Fetch user |
| `GET /profile/levels` | `levels.ts:86`, `wealth.vue`, `charm.vue` | User XP levels |
| `GET /levels/config` | `level-badge.ts:65`, `wealth.vue`, `charm.vue` | Level thresholds |
| `GET /gifts/all` | `useGiftData.ts:101` | Gift catalog |

**Total**: 4+ separate API calls on every app start

### After Bootstrap

| Endpoint | Status |
|----------|--------|
| `GET /api/v1/bootstrap` | Single consolidated call |

**Result**: 4+ calls → 1 call

---

## 2. Redundant Code Analysis

### Files to DELETE

| File | Lines | Reason |
|------|-------|--------|
| `app/utils/level-badge.ts` | 232 | Bootstrap provides config + sync lookup |

### Files to REFACTOR

| File | Change |
|------|--------|
| `app/composables/useGiftData.ts` | Remove `fetchGifts()`, read from bootstrap |
| `app/stores/levels.ts` | Remove `fetchLevels()`, seed from bootstrap |
| `app/stores/auth.ts` | Remove `fetchUser()`, seed from bootstrap |
| `app/middleware/auth.ts` | Remove hydration calls, bootstrap handles |
| `app/plugins/auth.ts` | Replace with bootstrap plugin |

### Cache Systems to Remove

| Cache | Location | Replaced By |
|-------|----------|-------------|
| `_levelConfigCache` | level-badge.ts | bootstrapStore.config |
| `gifts` shared ref | useGiftData.ts | bootstrapStore.giftCatalog |
| `_fetchPromise` | level-badge.ts | Bootstrap orchestration |

---

## 3. User Type Field Analysis

### Fields by Usage

| Status | Fields |
|--------|--------|
| **Essential** | id, name, signature, avatar, phone, phone_country, phone_country_code |
| **Display** | gender, date_of_birth |
| **Economy** | coins, diamonds, wealth_xp, charm_xp |
| **Auth-time only** | is_blocked, blocked_at, blocked_reason, locked_until, is_profile_complete |
| **Never used** | email_verified_at, last_login_at, created_at, updated_at, permissions, roles |

### Result

- **Before**: 32 fields (full User type)
- **After**: 18 fields (BootstrapUser)
- **Reduction**: 44%

---

## 4. Avatar/Logo Optimization

### Current

```typescript
avatar: { thumbnail, medium, large, original }  // 4 URLs
```

### Actual Usage Found

| Variant | Uses | Location |
|---------|------|----------|
| `thumbnail` | 0 | - |
| `medium` | 1 | UserInviteDialog.vue |
| `large` | 0 | - |
| `original` | 2 | profile/edit.vue |

### After

```typescript
avatar: string | null  // 1 URL (original)
```

Client transforms via Nuxt Image module.

**Reduction**: 75%

---

## 5. Nested User Problem

### Locations

| Type | Embeds | Problem |
|------|--------|---------|
| Room.user (owner) | Full 32-field User | 10 rooms = 320 extra fields |
| RoomMember.user | Full 32-field User | Same issue |
| RoomJoinRequest.user | Full 32-field User | Same issue |
| AgencyMember.user | UserReference (lighter) | OK but missing XP |

### Solution

Standardized `MinimalUser` (7 fields) used everywhere.

---

## 6. Store Persistence Strategy

| Store | Current | After |
|-------|---------|-------|
| auth | user + token | **token only** |
| levels | wealthLevel + charmLevel | Keep |
| badges | userBadges | Keep |
| room | userRoom + currentRoom | **userRoom only** |
| gift | None | None (moved to bootstrap) |
| **bootstrap** | N/A | config + giftCatalog + levelBadges |

### Gift Accumulation Strategy

- **Bootstrap**: Fetches first 30 gifts (first pagination)
- **Virtual scroll**: Fetches additional pages as user scrolls
- **Persistence**: ALL fetched gifts accumulate in `giftCatalog` with 24h TTL
- **Benefit**: Subsequent sessions/scrolls read from cache, fewer requests

---

## 7. Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| API calls on start | 4+ | 1 |
| User type fields | 32 | 18 |
| Avatar URLs per object | 4 | 1 |
| Nested user fields | 32 | 7 |
| Cache implementations | 3 | 1 |
| Lines removed | - | ~400 |

---

## 8. Implementation Order

1. Create bootstrap store + plugin
2. Seed stores from bootstrap data
3. Remove legacy fetch calls
4. Delete level-badge.ts
5. Refactor useGiftData.ts
6. Update middleware

---

## Related Documents

- [PHASE_0_SCHEMA_DECISIONS.md](./PHASE_0_SCHEMA_DECISIONS.md) - Finalized type definitions
- [BOOTSTRAP_PRD.md](./BOOTSTRAP_PRD.md) - Full implementation plan
