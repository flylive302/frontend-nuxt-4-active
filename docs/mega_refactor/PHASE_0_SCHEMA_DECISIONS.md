# Phase 0: Schema Decisions (FINALIZED)

> **All decisions confirmed and documented**
> 
> This is the source of truth for bootstrap data schemas and persistence strategy.

---

## 1. Standardized MinimalUser Type

**Single type used everywhere a user reference is needed:**

```typescript
interface MinimalUser {
  id: number
  name: string
  avatar: string | null       // Original URL, Nuxt Image transforms on client
  gender: number | null
  date_of_birth: string | null
  wealth_xp: string           // For badge display
  charm_xp: string            // For badge display
}
```

**Used in:**
- Room.owner
- RoomMember.user
- RoomJoinRequest.user
- RoomInvitation.inviter / invitee
- AgencyMember.user
- AgencyInvitation.user / invited_by
- AgencyJoinRequest.user / processed_by
- Any other user reference in the app

---

## 2. BootstrapUser Type

```typescript
interface BootstrapUser {
  // Identity
  id: number
  name: string
  signature: string | null
  avatar: string | null       // Original URL only
  
  // Phone (essential - auth basis)
  phone: string
  phone_country: string
  phone_country_code: string
  
  // Demographics (display)
  gender: number | null
  date_of_birth: string | null
  
  // Economy
  coins: string
  diamonds: string
  wealth_xp: string
  charm_xp: string
  
  // Profile completion (minimal - just the bool)
  is_profile_complete: boolean
  
  // Block fields (auth-time modal, NOT persisted)
  is_blocked: boolean
  blocked_at: string | null
  blocked_reason: string | null
  locked_until: string | null
}
```

**Total**: 18 fields

---

## 3. Room Schema

```typescript
interface BootstrapRoom {
  id: number
  name: string
  logo: string | null         // Original URL
  type: 'public' | 'private'
  country: string
  is_live: boolean
  participant_count: number
  sort_order: number          // For display ordering
  room_xp: string             // NEW: For room level calculation
  
  owner: MinimalUser          // Uses standard MinimalUser
}
```

**Pagination**: Cursor-based  
**Persistence**: None (always fetch fresh)

---

## 4. Gift Schema

```typescript
interface Gift {
  id: number
  name: string
  label: string | null
  description: string | null
  price: number
  thumbnail_url: string
  animation_url: string | null
  asset_type: 'video' | 'svga' | 'image'
  category: GiftCategory
  rarity: GiftRarity
  sort_order: number
}
```

**Bootstrap**: First 30 by `sort_order` (first pagination)  
**Lazy load**: Remaining gifts via pagination as user scrolls  
**Persistence**: **ALL fetched gifts** persist long-term (reduces virtual scroll requests)

---

## 5. Level Configuration

```typescript
interface LevelConfigItem {
  level: number
  name: string
  required_xp: number
  badge_id: number            // Reference to badge catalog
}

interface BootstrapConfig {
  wealth_levels: LevelConfigItem[]
  charm_levels: LevelConfigItem[]
  room_levels: LevelConfigItem[]
  level_badges: Badge[]       // Only badges for levels
}
```

---

## 6. Store Persistence Strategy

| Store | Persist | Fields | Reason |
|-------|---------|--------|--------|
| `auth` | ✅ | `token` only | User hydrated from bootstrap |
| `levels` | ✅ | `wealthLevel`, `charmLevel`, `lastFetchedAt` | User's own level data |
| `badges` | ✅ | `userBadges` | User's earned badges |
| `room` | ✅ | `userRoom` only | User's owned room |
| `gift` | ❌ | None | Catalog in bootstrap store |
| `income` | ❌ | None | Fetch on demand |
| `agency` | ❌ | None | Fetch on demand |
| `notification` | ❌ | None | Realtime via MSAB |
| `roomMembership` | ❌ | None | Per-room, session data |
| `rewards` | ❌ | None | Fetch on demand |
| **`bootstrap`** | ✅ | See below | Config + catalog |

### Bootstrap Store Persistence

```typescript
persist: {
  pick: [
    'config',              // Level thresholds
    'levelBadges',         // Badge catalog for levels
    'giftCatalog',         // ALL fetched gifts (accumulates over time)
    'cellularConsentGiven',
    'lastBootstrapAt'
  ]
}
```

**Gift Strategy**:
- Bootstrap: First 30 gifts (first pagination)
- User scrolls: Fetch more pages, append to `giftCatalog`
- Persistence: All fetched gifts saved with 24h TTL
- Virtual scroll: Reads from persisted catalog, only fetches missing

---

## 7. Caching Strategy

### TTL-Based (Configurable)

```typescript
// app/constants/cache.ts
export const CACHE_TTL = {
  LEVEL_CONFIG: 24 * 60 * 60 * 1000,  // 24 hours
  GIFT_CATALOG: 24 * 60 * 60 * 1000,  // 24 hours
  BADGE_CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  COUNTRIES: 7 * 24 * 60 * 60 * 1000, // 7 days (static)
} as const
```

### Stale Check Pattern

```typescript
function isStale(lastFetchedAt: number | null, ttl: number): boolean {
  if (!lastFetchedAt) return true
  return Date.now() - lastFetchedAt > ttl
}

// Usage
if (isStale(bootstrapStore.lastBootstrapAt, CACHE_TTL.LEVEL_CONFIG)) {
  await bootstrapStore.refresh()
}
```

### Force Refresh

For admin updates, use versioned URLs or manual refresh:
- `/levels/config?v=2`
- User pull-to-refresh
- Invalidation via MSAB socket

---

## 8. Data Fetching Summary

| Data | Fetch Strategy | Persist |
|------|---------------|---------|
| User | Bootstrap | Token only |
| Rooms | Always fresh | No |
| Gifts (30) | Bootstrap → lazy full | Yes (catalog) |
| Level Config | Bootstrap, 24h TTL | Yes |
| Badge Catalog | Bootstrap, 24h TTL | Yes |
| User Levels | Middleware hydrate | Yes |
| User Badges | Middleware hydrate | Yes |
| Income | On demand | No |
| Agency | On demand | No |
| Rewards | On demand | No |

---

## 9. Avatar/Logo Handling

**Backend returns**: Single original URL  
**Field name**: Keep as `avatar` (no rename)  
**Client transforms**: Via Nuxt Image module

```vue
<NuxtImg 
  :src="user.avatar" 
  width="128" 
  height="128" 
  format="webp"
  placeholder
/>
```

---

## 10. Room Levels

**Same as user levels**:
- Config included in bootstrap (`room_levels`)
- Room returns `room_xp` field
- Client calculates level from config

```typescript
function getRoomLevel(room_xp: string): LevelInfo {
  const xp = parseFloat(room_xp)
  const config = bootstrapStore.config.room_levels
  return config.findLast(l => xp >= l.required_xp) ?? DEFAULT
}
```

---

## 11. Badge Optimization

**Badge ID + Catalog approach**:
- Level config stores `badge_id` only
- `level_badges` array in bootstrap config
- Client builds Map for O(1) lookup

```typescript
// Build once at bootstrap
const badgeMap = new Map(
  config.level_badges.map(b => [b.id, b])
)

// O(1) lookup
function getBadgeById(id: number): Badge | null {
  return badgeMap.get(id) ?? null
}
```

---

## Summary of Key Decisions

| Decision | Value |
|----------|-------|
| MinimalUser fields | 7 (id, name, avatar, gender, dob, wealth_xp, charm_xp) |
| BootstrapUser fields | 18 |
| Avatar format | Single original URL |
| Rooms | Always fresh, cursor paginated |
| Gifts | Bootstrap 30, persist catalog |
| Level config | Bootstrap, persist, 24h TTL |
| Room levels | Same pattern as user levels |
| Badge storage | ID reference + catalog |
| TTL | Configurable constants |

---

## Next: Phase 1

With schemas finalized, Phase 1 will define the exact API contract for `/api/v1/bootstrap`.
