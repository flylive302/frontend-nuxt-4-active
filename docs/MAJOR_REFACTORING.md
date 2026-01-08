# Major Refactoring Plan

> Read this file FIRST before making any changes.

## Status Overview

| Priority | Task | Effort | Status |
|----------|------|--------|--------|
| **PRE-REQ** | Fix composable issues | 15 min | ✅ |
| **P1** | Gift watcher optimization | 5 min | ✅ |
| **P2** | Agency store decomposition | 2-3 hrs | ✅ (219 lines) |
| **P3-PRE** | RoomMembership fixes | 30 min | ✅ |
| **P3** | RoomMembership decomposition | 1-2 hrs | ✅ (158 lines) |
| **P4** | Notification WebSocket | TBD | 🔮 Future |

✅ = Complete | ⏳ = Pending | 🔮 = Future/Deferred

---

## PRE-REQ: Fix Composable Issues (Must Do First)

### Issue 1: Broken Dependency
**File:** `useAgencyInvitations.ts:75`
```typescript
// BREAKING: Calls store method that will be removed
await store.fetchUserAgency()

// FIX: Use composable
const { fetchUserAgency } = useAgencyMembership()
await fetchUserAgency()
```

### Issue 2: Degraded Error Handling
All composables use hardcoded messages. Should use `normalizeError()`.

**Files to fix:**
- `useAgencyMembership.ts` - leaveAgency, dissolveAgency, changeCoinReseller
- `useAgencyBrowsing.ts` - createAgency
- `useAgencyInvitations.ts` - all action functions
- `useAgencyJoinRequests.ts` - all action functions  
- `useAgencyAdmin.ts` - all action functions

**Pattern:**
```typescript
const { api, normalizeError } = useApi()
// ...
catch (error) {
  const err = normalizeError(error)
  toast.add({ description: err.message, ... })
}
```

---

## P1: Gift Watcher Optimization

**File:** `stores/gift.ts:171-178`

**Current (inefficient):**
```typescript
watch([selectedGift, selectedRecipients], ..., { deep: true })
```

**Optimal:**
```typescript
watch(
  [selectedGift, () => selectedRecipients.value.length],
  ([gift, _count]) => {
    if (gift && selectedRecipients.value.length > 0) {
      debouncedPreload(gift, selectedRecipients.value)
    }
  }
)
```

---

## P2: Agency Store Decomposition

**Goal:** Reduce `agency.ts` from 966 → ~150 lines

**What stays in store:** State + computed only
**What moves to composables:** Already done (useAgencyBrowsing, etc.)

### Migration Table

| Page | Store Method | Use Composable |
|------|-------------|----------------|
| `list.vue:37,41,56` | fetchAgencies | `useAgencyBrowsing()` |
| `create.vue` | createAgency | `useAgencyBrowsing()` |
| `[id].vue` | fetchAgencyById | `useAgencyBrowsing()` |
| `my-agency.vue` | leaveAgency, dissolve | `useAgencyMembership()` |
| `my-requests.vue` | join request methods | `useAgencyJoinRequests()` |
| `invitations.vue` | invitation methods | `useAgencyInvitations()` |
| `choose-default-reseller.vue` | changeCoinReseller | `useAgencyMembership()` |

---

## P3: RoomMembership Decomposition (Future)

**File:** `roomMembership.ts` (447 lines)

Same pattern as agency - has duplicate `MemberListState`, `RequestListState`.

**Do after P2 proves the pattern works.**

---

## P4: Notification WebSocket (Future)

**Current:** 2 polling intervals (lines 261, 265)
**Already prepared:** `handleRealtimeNotification()` placeholder exists

**Defer until:** Backend implements WebSocket support

---

## Already Optimal ✅

| Item | Why It's Good |
|------|--------------|
| Persistence config | Selective: auth, room, badges, levels |
| Optimistic updates | badges.ts:222-240 shows correct rollback pattern |
| Socket cleanup | Intervals properly cleared in stopPolling() |
| Shallow refs | Used for socket instances |

---

## Execution Order

```
1. PRE-REQ (15 min)  → npm run test
2. P1 (5 min)        → npm run test  
3. P2 Phase 1        → Migrate pages to composables
4. P2 Phase 2        → Remove store actions
5. P2 Phase 3        → npm run test + npm run build
```

---

## Quality Gates

After each step:
```bash
npm run lint      # 0 errors
npm run test      # 36 passed
npx tsc --noEmit  # 0 errors
```
