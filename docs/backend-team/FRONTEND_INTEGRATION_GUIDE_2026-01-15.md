# Frontend Team: Complete Backend Integration Guide

> **Technical Document for Frontend Team**  
> **Date**: 2026-01-15 | **Status**: READY FOR INTEGRATION

---

## Executive Summary

The Laravel backend has completed implementation of:

1. **Bootstrap System** - Single endpoint for app initialization
2. **Real-time Events** - 12 events via MSAB WebSocket
3. **Web Push Setup** - VAPID keys configured

This document provides everything needed for complete frontend integration.

---

## Table of Contents

1. [Bootstrap Endpoint](#1-bootstrap-endpoint)
2. [Real-time Events (MSAB)](#2-real-time-events-msab)
3. [Breaking Changes](#3-breaking-changes)
4. [Web Push Configuration](#4-web-push-configuration)
5. [Type Definitions](#5-type-definitions)
6. [Migration Guide](#6-migration-guide)
7. [Testing](#7-testing)

---

## 1. Bootstrap Endpoint

### Request

```http
GET /api/v1/bootstrap
Authorization: Bearer {token}
```

### Response Structure

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

### Usage Example

```typescript
// Replace multiple init calls with single bootstrap
const { data } = await $fetch<{ data: BootstrapResponse }>(
  "/api/v1/bootstrap",
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);

// Populate stores
userStore.setUser(data.user);
userStore.setLevels(data.user_data.levels);
configStore.setConfig(data.config);
giftStore.setCatalog(data.gifts.catalog);

if (data.user_data.active_income_target) {
  incomeStore.setActiveTarget(data.user_data.active_income_target);
}
```

---

## 2. Real-time Events (MSAB)

### Connection Timing

> **CRITICAL**: Connect to MSAB socket on app boot and stay connected for the user's session. Do NOT wait for room entry.

### Events to Listen For

| Event                            | When Triggered                | Action                                     |
| -------------------------------- | ----------------------------- | ------------------------------------------ |
| `balance.updated`                | Gift sent/received            | Update user balance in store               |
| `badge.earned`                   | Badge awarded                 | Show notification, add to user badges      |
| `room.level_up`                  | Room XP threshold reached     | Show celebration, update room level        |
| `income_target.completed`        | Target 100% complete          | Show reward modal, refresh target          |
| `income_target.member_completed` | Member completed (owner sees) | Show notification                          |
| `reward.earned`                  | User claimed reward           | Show notification, update balance          |
| `agency.invitation`              | Invited to agency             | Show notification, update invitations list |
| `agency.join_request`            | Someone wants to join (owner) | Show notification, update requests list    |
| `agency.join_request_approved`   | Your request approved         | Show notification, update agency status    |
| `agency.join_request_rejected`   | Your request rejected         | Show notification, update status           |
| `agency.member_kicked`           | You were kicked               | Show notification, update agency status    |
| `agency.dissolved`               | Agency dissolved              | Show notification, clear agency data       |
| `config:invalidate`              | Config changed                | Refresh config from API                    |

### Event Payloads

#### balance.updated

```typescript
interface BalanceUpdatedPayload {
  coins: string; // e.g., "15000.0000"
  diamonds: string;
  wealth_xp: string;
  charm_xp: string;
}
```

#### badge.earned

```typescript
interface BadgeEarnedPayload {
  badge_id: number;
  badge_name: string;
  badge_image: string;
  category: "wealth" | "charm" | "room" | "special";
  context: string; // e.g., "level_up", "gift_received"
}
```

#### room.level_up

```typescript
interface RoomLevelUpPayload {
  room_id: number;
  room_name: string;
  previous_level: number;
  new_level: number;
  current_xp: string;
}
```

#### income_target.completed

```typescript
interface IncomeTargetCompletedPayload {
  target_id: number;
  tier: string; // e.g., "T2"
  name: string;
  earned_coins: string;
  member_reward: number; // Diamonds
  owner_reward: number;
}
```

#### reward.earned

```typescript
interface RewardEarnedPayload {
  user_reward_id: number;
  reward: {
    id: number;
    name: string;
    type: "coins" | "diamonds" | "badge" | "gift";
    amount: string;
    description: string | null;
  };
}
```

#### agency.invitation

```typescript
interface AgencyInvitationPayload {
  invitation_id: number;
  agency: {
    id: number;
    name: string;
    logo: string | null;
  };
  invited_by: {
    id: number;
    name: string;
  };
}
```

#### agency.join_request

```typescript
interface AgencyJoinRequestPayload {
  request_id: number;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  message: string | null;
}
```

#### agency.join_request_approved / rejected

```typescript
interface AgencyJoinRequestResultPayload {
  agency_id: number;
  agency_name: string;
}
```

#### agency.member_kicked

```typescript
interface AgencyMemberKickedPayload {
  agency_id: number;
  agency_name: string;
  reason: string | null;
}
```

#### agency.dissolved

```typescript
interface AgencyDissolvedPayload {
  agency_id: number;
  agency_name: string;
}
```

#### config:invalidate

```typescript
interface ConfigInvalidatePayload {
  type: "levels" | "badges" | "gifts" | "all";
  version: string | null;
}
```

### Socket Event Handlers

```typescript
// composables/useMSABEvents.ts
export function useMSABEvents() {
  const socket = useMSABSocket();
  const userStore = useUserStore();
  const notificationStore = useNotificationStore();

  // Balance updates
  socket.on("balance.updated", (payload: BalanceUpdatedPayload) => {
    userStore.updateBalance({
      coins: payload.coins,
      diamonds: payload.diamonds,
      wealth_xp: payload.wealth_xp,
      charm_xp: payload.charm_xp,
    });
  });

  // Badge earned
  socket.on("badge.earned", (payload: BadgeEarnedPayload) => {
    notificationStore.add({
      type: "badge",
      title: "Badge Earned!",
      message: `You earned the ${payload.badge_name} badge!`,
      image: payload.badge_image,
    });
    userStore.addBadge(payload);
  });

  // Room level up
  socket.on("room.level_up", (payload: RoomLevelUpPayload) => {
    notificationStore.add({
      type: "celebration",
      title: "Room Level Up!",
      message: `${payload.room_name} is now Level ${payload.new_level}!`,
    });
  });

  // Income target completed
  socket.on(
    "income_target.completed",
    (payload: IncomeTargetCompletedPayload) => {
      notificationStore.add({
        type: "reward",
        title: "Target Complete!",
        message: `You completed ${payload.name}! +${payload.member_reward} 💎`,
      });
      // Refresh income data
      refreshIncomeTarget();
    }
  );

  // Agency events
  socket.on("agency.invitation", (payload: AgencyInvitationPayload) => {
    notificationStore.add({
      type: "agency",
      title: "Agency Invitation",
      message: `${payload.agency.name} invited you to join!`,
    });
  });

  socket.on(
    "agency.join_request_approved",
    (payload: AgencyJoinRequestResultPayload) => {
      notificationStore.add({
        type: "success",
        title: "Request Approved!",
        message: `Welcome to ${payload.agency_name}!`,
      });
      refreshUserAgency();
    }
  );

  socket.on("agency.member_kicked", (payload: AgencyMemberKickedPayload) => {
    notificationStore.add({
      type: "warning",
      title: "Removed from Agency",
      message: `You have been removed from ${payload.agency_name}`,
    });
    userStore.clearAgency();
  });

  // Config invalidation
  socket.on("config:invalidate", async (payload: ConfigInvalidatePayload) => {
    if (payload.type === "all" || payload.type === "levels") {
      await configStore.refreshLevels();
    }
    if (payload.type === "all" || payload.type === "badges") {
      await configStore.refreshBadges();
    }
    if (payload.type === "all" || payload.type === "gifts") {
      await giftStore.refreshCatalog();
    }
  });
}
```

---

## 3. Breaking Changes

### 3.1 Avatar/Logo Format

```diff
- avatar: { thumbnail: string, medium: string, large: string, original: string }
+ avatar: string | null
```

**Migration**: Use Nuxt Image with ImageKit provider:

```vue
<!-- BEFORE -->
<img :src="user.avatar.medium" />

<!-- AFTER -->
<NuxtImg :src="user.avatar" width="200" />
```

### 3.2 Room Resource Changes

```diff
- level_xp → room_xp
- user → owner (MinimalUserResource)
+ sort_order: number
+ current_level: number
+ is_live: boolean
+ participant_count: number
```

### 3.3 Income Target Changes

```diff
- period_start → start_date
- period_end → end_date
+ name: string
+ coins_to_complete: string
```

### 3.4 Nested User Objects

All nested user references now use `MinimalUserResource`:

```typescript
interface MinimalUserResource {
  id: number;
  name: string;
  signature: string;
  avatar: string | null;
  gender: string | null;
  date_of_birth: string | null;
  wealth_xp: string;
  charm_xp: string;
}
```

**Affected locations:**

- `RoomResource.owner`
- `RoomMemberResource.user`
- `AgencyMemberResource.user`
- `AgencyMemberResource.invited_by`
- `AgencyMemberResource.removed_by`

### 3.5 gift.sent Event Removed

The `gift.sent` event is **NO LONGER** emitted by Laravel. MSAB broadcasts this optimistically during the gift transaction for instant feedback.

---

## 4. Web Push Configuration

### VAPID Public Key

Available in bootstrap response:

```typescript
const vapidKey = bootstrapData.config.vapid_public_key;
```

### Subscription Flow

```typescript
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });

  // Send to backend
  await $fetch("/api/v1/push-subscriptions", {
    method: "POST",
    body: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
        auth: arrayBufferToBase64(subscription.getKey("auth")),
      },
    },
  });
}
```

> **Note**: Push notification decision logic will be handled by MSAB (they determine online/offline status).

---

## 5. Type Definitions

### Full Types File

```typescript
// types/bootstrap.ts

export interface BootstrapUser {
  id: number;
  name: string;
  signature: string;
  avatar: string | null;
  phone: string | null;
  phone_country: string | null;
  phone_country_code: string | null;
  gender: "male" | "female" | null;
  date_of_birth: string | null;
  coins: string;
  diamonds: string;
  wealth_xp: string;
  charm_xp: string;
  is_profile_complete: boolean;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  locked_until: string | null;
}

export interface MinimalUser {
  id: number;
  name: string;
  signature: string;
  avatar: string | null;
  gender: string | null;
  date_of_birth: string | null;
  wealth_xp: string;
  charm_xp: string;
}

export interface LevelStatus {
  current_level: number;
  level_name: string;
  current_xp: number;
  xp_for_next_level: number;
  xp_remaining: number;
  progress_percentage: number;
  badge: {
    id: number;
    name: string;
    image_url: string;
  } | null;
  next_level: {
    level: number;
    name: string;
    required_xp: number;
  } | null;
}

export interface LevelConfig {
  level: number;
  name: string;
  required_xp: number;
  badge_id: number | null;
}

export interface Badge {
  id: number;
  name: string;
  image_url: string | null;
  category: "wealth" | "charm" | "room" | "level" | "special";
}

export interface IncomeTarget {
  id: number;
  tier: number;
  name: string;
  required_coins: string;
  earned_coins: string;
  coins_to_complete: string;
  start_date: string;
  end_date: string;
  member_diamond_reward: string;
  owner_diamond_reward: string;
  is_completed: boolean;
}

export interface Room {
  id: number;
  name: string;
  description: string | null;
  logo: string | null;
  topic: string | null;
  room_xp: string;
  current_level: number;
  sort_order: number;
  is_live: boolean;
  participant_count: number;
  max_seats: number;
  owner: MinimalUser;
}

export interface Gift {
  id: number;
  name: string;
  price: number;
  thumbnail: string;
  animation_url: string | null;
  category: string;
  sort_order: number;
}
```

---

## 6. Migration Guide

### Step 1: Update Types

Copy the types from Section 5 into your codebase.

### Step 2: Update Bootstrap Call

```typescript
// BEFORE - Multiple calls
const [user, levels, gifts] = await Promise.all([
  $fetch("/auth/user"),
  $fetch("/profile/levels"),
  $fetch("/gifts"),
]);

// AFTER - Single call
const { data } = await $fetch("/api/v1/bootstrap");
```

### Step 3: Update Image Handling

```typescript
// BEFORE
getAvatarUrl(user.avatar.medium);

// AFTER
// Just use the URL directly with NuxtImg
<NuxtImg :src="user.avatar" width="200" />
```

### Step 4: Update Field Names

```typescript
// Income target
target.period_start → target.start_date
target.period_end → target.end_date

// Room
room.level_xp → room.room_xp
room.user → room.owner
```

### Step 5: Implement Socket Listeners

Add the event handlers from Section 2 to your MSAB socket connection.

---

## 7. Testing

### Test Bootstrap Endpoint

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/bootstrap | jq
```

### Expected Response Size

~15-25KB (depending on gift catalog size)

### Test Real-time Events

```bash
# Monitor Redis in separate terminal
redis-cli -n 3 PSUBSCRIBE "flylive:msab:*"

# Then trigger an action (e.g., send gift, complete target)
# You should see the event in the Redis monitor
```

---

## Quick Reference Card

| Need                     | Endpoint/Event                            |
| ------------------------ | ----------------------------------------- |
| App initialization       | `GET /api/v1/bootstrap`                   |
| User balance refresh     | Listen to `balance.updated`               |
| Badge notification       | Listen to `badge.earned`                  |
| Room level celebration   | Listen to `room.level_up`                 |
| Income target update     | Listen to `income_target.completed`       |
| Agency notifications     | Listen to `agency.*` events               |
| Config refresh           | Listen to `config:invalidate`             |
| Gift catalog (paginated) | `GET /api/v1/gifts`                       |
| Income history           | `GET /api/v1/user/income/targets/history` |

---

## Contact

Questions? Check these files:

- [BootstrapController.php](file:///home/xha/FlyLive/backend-Laravel-12/app/Http/Controllers/API/V1/BootstrapController.php)
- [MSABEventService.php](file:///home/xha/FlyLive/backend-Laravel-12/app/Services/MSABEventService.php)
- [BootstrapUserResource.php](file:///home/xha/FlyLive/backend-Laravel-12/app/Http/Resources/V1/BootstrapUserResource.php)
