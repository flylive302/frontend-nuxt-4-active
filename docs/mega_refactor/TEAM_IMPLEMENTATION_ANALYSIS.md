# Team Implementation Comparative Analysis Report

> **Date**: 2026-01-16 | **Status**: ✅ All Questions Resolved - Ready for Implementation

---

## Executive Summary

Both teams have completed their implementations. All conflicts resolved. Ready for frontend implementation.

---

## 1. Final Bootstrap Response Schema

```typescript
interface BootstrapResponse {
  user: BootstrapUser;
  
  user_data: {
    levels: {
      wealth: LevelStatus;
      charm: LevelStatus;
    };
    active_income_target: IncomeTarget | null;
    room: Room | null;
    badges: UserBadge[];  // ✅ Added - max 5 displayed
    agency: {             // ✅ Added
      agency_id: number;
      agency_name: string;
      agency_logo: string | null;
      member_count: number;
      role: 'owner' | 'admin' | 'member';
      is_owner: boolean;
      joined_at: string;
    } | null;
  };
  
  gifts: {
    catalog: Gift[];
    total: number;
  };
  
  config: {
    api_version: string;
    economy: {
      room_owner_percentage: number;
      receiver_percentage: number;
    };
    wealth_levels: LevelConfig[];
    charm_levels: LevelConfig[];
    room_levels: LevelConfig[];
    level_badges: Badge[];
    vapid_public_key: string | null;
  };
}
```

---

## 2. Resolved Conflicts

| Conflict | Resolution |
|----------|------------|
| Socket connection timing | Connect at app boot, not room entry |
| User badges missing | ✅ Backend added `user_data.badges` |
| Agency context missing | ✅ Backend added `user_data.agency` |
| Income tier type | Confirmed: `string` (e.g., "T1", "T2") |
| gift.sent event | Not needed - `balance.updated` sufficient |
| room.level_up targeting | All room members |
| Push notifications | Deferred to final phase |

---

## 3. Critical Code Fix Required

**File**: `app/composables/useRoomAudio.ts` (Line 304)

```diff
function leaveRoom(): void {
  if (socket.value && roomStore.currentRoom) {
    socket.value.emit('room:leave', { roomId: roomStore.currentRoom.id.toString() });
  }
  cleanupMediasoup();
- disconnect();  // ❌ REMOVE - socket stays connected
  roomStore.clearAudioState();
}
```

---

## 4. Breaking Changes

| Change | Before | After |
|--------|--------|-------|
| Avatar | `{thumbnail, medium, large, original}` | `string \| null` |
| Room owner | `room.user` | `room.owner` |
| Room XP | `room.level_xp` | `room.room_xp` |
| Income dates | `period_start/end` | `start_date/end_date` |
| MinimalUser | 7 fields | 8 fields (+signature) |

---

## 5. Implementation Checklist

### Phase 1: Types & Schema (Day 1)
- [ ] Create `app/types/bootstrap.ts`
- [ ] Create `app/types/socket-events.ts`
- [ ] Update `app/types/auth.ts` (BootstrapUser)
- [ ] Update `app/types/room.ts` (MinimalUser, Room)

### Phase 2: Bootstrap Store (Day 2)
- [ ] Create `app/stores/bootstrap.ts`
- [ ] Create `app/plugins/bootstrap.client.ts`
- [ ] Create `app/constants/cache.ts`

### Phase 3: Socket Refactor (Day 3)
- [ ] Refactor `useAudioSocket.ts` for app-boot connection
- [ ] Create `app/plugins/socket.client.ts`
- [ ] Create `app/composables/useRealtimeEvents.ts`
- [ ] Fix `leaveRoom()` - remove disconnect

### Phase 4: Component Updates (Day 4)
- [ ] Update avatar usage (grep for `.avatar.`)
- [ ] Update room field references
- [ ] Update income target fields

### Phase 5: Legacy Cleanup (Day 5)
- [ ] Delete `app/utils/level-badge.ts`
- [ ] Refactor `useGiftData.ts`
- [ ] Remove redundant fetches from stores

---

## 6. Files Summary

| Action | Files |
|--------|-------|
| **Create** | 7 new files |
| **Modify** | ~15 files (types, stores, composables) |
| **Delete** | 1 file (level-badge.ts) |

---

## Related Documents

- [BOOTSTRAP_PRD.md](./BOOTSTRAP_PRD.md) - Full implementation plan
- [LARAVEL_REQUIREMENTS.md](./LARAVEL_REQUIREMENTS.md) - Backend specs
- [MSAB_REQUIREMENTS.md](./MSAB_REQUIREMENTS.md) - Socket event specs
