# MSAB Realtime Event Registry

> **Version**: 1.0  
> **Last Updated**: 2026-02-04  
> **Maintainer**: FlyLive Backend Team

This document is the **single source of truth** for all real-time events between Laravel and MSAB. Frontend and MSAB teams should implement against these contracts.

---

## Table of Contents

1. [Event Envelope Structure](#1-event-envelope-structure)
2. [Naming Convention](#2-naming-convention)
3. [Outgoing Events (Laravel → MSAB)](#3-outgoing-events-laravel--msab)
4. [Incoming Events (MSAB → Laravel)](#4-incoming-events-msab--laravel)
5. [Events NOT Emitted by Laravel](#5-events-not-emitted-by-laravel)
6. [Event Quick Reference](#6-event-quick-reference)

---

## 1. Event Envelope Structure

All events emitted by Laravel follow this envelope structure:

```json
{
  "event": "laravel.balance.updated",
  "user_id": 123,
  "room_id": null,
  "payload": { ... },
  "timestamp": "2026-02-04T01:45:00+00:00",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field            | Type     | Description              |
| ---------------- | -------- | ------------------------ | ---------------------------------------------- |
| `event`          | `string` | Event name with prefix   |
| `user_id`        | `integer | null`                    | Target user (null for room-wide/broadcast)     |
| `room_id`        | `integer | null`                    | Target room (null for user-specific/broadcast) |
| `payload`        | `object` | Event-specific data      |
| `timestamp`      | `string` | ISO 8601 timestamp       |
| `correlation_id` | `string` | UUID for request tracing |

### Target Types

| Target    | user_id | room_id | Description                   |
| --------- | ------- | ------- | ----------------------------- |
| User      | `123`   | `null`  | Send to specific user only    |
| Room      | `null`  | `456`   | Broadcast to all room members |
| Broadcast | `null`  | `null`  | Broadcast to all connected    |

---

## 2. Naming Convention

| Direction      | Prefix      | Code Name         | Doc Name                  |
| -------------- | ----------- | ----------------- | ------------------------- |
| MSAB → Laravel | `msab.*`    | (varies per API)  | `msab.gift.batch`         |
| Laravel → MSAB | `laravel.*` | `balance.updated` | `laravel.balance.updated` |

> [!NOTE]
> The codebase uses unprefixed event names (e.g., `balance.updated`).
> The `laravel.*` / `msab.*` prefix is for **documentation clarity only**.
> MSAB subscribes to the Redis channel and routes based on the actual event name.

---

## 3. Outgoing Events (Laravel → MSAB)

### 3.1 Balance & Economy Events

#### `laravel.balance.updated`

| Property | Value                                    |
| -------- | ---------------------------------------- |
| Target   | User                                     |
| Trigger  | After any coin/diamond/XP mutation       |
| Source   | `MSABEventService::emitBalanceUpdated()` |

```json
{
  "coins": "45000",
  "diamonds": "1000",
  "wealth_xp": "15500",
  "charm_xp": "8500"
}
```

| Field       | Type     | Description             |
| ----------- | -------- | ----------------------- |
| `coins`     | `string` | Current coin balance    |
| `diamonds`  | `string` | Current diamond balance |
| `wealth_xp` | `string` | Current wealth XP       |
| `charm_xp`  | `string` | Current charm XP        |

---

### 3.2 Progression Events

#### `laravel.level.up`

| Property | Value                             |
| -------- | --------------------------------- |
| Target   | User                              |
| Trigger  | When user's wealth/charm level up |
| Source   | `MSABEventService::emitLevelUp()` |

```json
{
  "type": "wealth",
  "previous_level": 5,
  "new_level": 6,
  "current_xp": "25000"
}
```

| Field            | Type      | Description              |
| ---------------- | --------- | ------------------------ |
| `type`           | `string`  | `"wealth"` or `"charm"`  |
| `previous_level` | `integer` | Level before change      |
| `new_level`      | `integer` | Level after change       |
| `current_xp`     | `string`  | Current XP for this type |

---

#### `laravel.badge.earned`

| Property | Value                                 |
| -------- | ------------------------------------- |
| Target   | User                                  |
| Trigger  | When user unlocks a new badge         |
| Source   | `MSABEventService::emitBadgeEarned()` |

```json
{
  "badge_id": 42,
  "badge_name": "Gift Master",
  "badge_image": "https://cdn.flylive.com/badges/gift-master.png",
  "category": "gifting",
  "context": "room_gift"
}
```

| Field         | Type      | Description            |
| ------------- | --------- | ---------------------- |
| `badge_id`    | `integer` | Badge ID               |
| `badge_name`  | `string`  | Display name           |
| `badge_image` | `string`  | Badge image URL        |
| `category`    | `string`  | Badge category         |
| `context`     | `string`  | Where badge was earned |

---

#### `laravel.reward.earned`

| Property | Value                                  |
| -------- | -------------------------------------- |
| Target   | User                                   |
| Trigger  | After user claims a reward             |
| Source   | `MSABEventService::emitRewardEarned()` |

```json
{
  "user_reward_id": 999,
  "reward": {
    "id": 15,
    "name": "Daily Bonus",
    "type": "coins",
    "amount": "1000",
    "description": "Daily login reward"
  }
}
```

---

### 3.3 Agency Events

#### `laravel.agency.invitation`

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Target   | User (invitee)                             |
| Trigger  | When user is invited to join an agency     |
| Source   | `MSABEventService::emitAgencyInvitation()` |

```json
{
  "invitation_id": 123,
  "agency": {
    "id": 456,
    "name": "Star Agency",
    "logo": "https://cdn.flylive.com/agencies/456.png"
  },
  "invited_by": {
    "id": 789,
    "name": "Agency Owner"
  }
}
```

---

#### `laravel.agency.join_request`

| Property | Value                                       |
| -------- | ------------------------------------------- |
| Target   | User (agency owner)                         |
| Trigger  | When user requests to join an agency        |
| Source   | `MSABEventService::emitAgencyJoinRequest()` |

```json
{
  "request_id": 100,
  "user": {
    "id": 123,
    "name": "New Member",
    "avatar": "https://..."
  },
  "message": "I'd like to join your agency!"
}
```

---

#### `laravel.agency.join_request_approved`

| Property | Value                                               |
| -------- | --------------------------------------------------- |
| Target   | User (requester)                                    |
| Trigger  | When agency owner approves join request             |
| Source   | `MSABEventService::emitAgencyJoinRequestApproved()` |

```json
{
  "agency_id": 456,
  "agency_name": "Star Agency"
}
```

---

#### `laravel.agency.join_request_rejected`

| Property | Value                                               |
| -------- | --------------------------------------------------- |
| Target   | User (requester)                                    |
| Trigger  | When agency owner rejects join request              |
| Source   | `MSABEventService::emitAgencyJoinRequestRejected()` |

```json
{
  "agency_id": 456,
  "agency_name": "Star Agency"
}
```

---

#### `laravel.agency.member_joined`

| Property | Value                                        |
| -------- | -------------------------------------------- |
| Target   | User (agency owner)                          |
| Trigger  | When new member joins the agency             |
| Source   | `MSABEventService::emitAgencyMemberJoined()` |

```json
{
  "agency_id": 456,
  "member_id": 123
}
```

---

#### `laravel.agency.member_left`

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Target   | User (agency owner)                        |
| Trigger  | When member leaves the agency              |
| Source   | `MSABEventService::emitAgencyMemberLeft()` |

```json
{
  "agency_id": 456,
  "member_id": 123,
  "reason": "voluntary"
}
```

| `reason` values | Description              |
| --------------- | ------------------------ |
| `voluntary`     | Member left on their own |
| `kicked`        | Member was kicked        |
| `dissolved`     | Agency was dissolved     |

---

#### `laravel.agency.member_kicked`

| Property | Value                                        |
| -------- | -------------------------------------------- |
| Target   | User (kicked member)                         |
| Trigger  | When member is kicked from agency            |
| Source   | `MSABEventService::emitAgencyMemberKicked()` |

```json
{
  "agency_id": 456,
  "agency_name": "Star Agency",
  "reason": null
}
```

---

#### `laravel.agency.dissolved`

| Property | Value                                     |
| -------- | ----------------------------------------- |
| Target   | User (each member, emitted individually)  |
| Trigger  | When agency owner dissolves the agency    |
| Source   | `MSABEventService::emitAgencyDissolved()` |

```json
{
  "agency_id": 456,
  "agency_name": "Star Agency"
}
```

---

#### `laravel.income_target.completed`

| Property | Value                                           |
| -------- | ----------------------------------------------- |
| Target   | User (agency member)                            |
| Trigger  | When member completes an income target tier     |
| Source   | `MSABEventService::emitIncomeTargetCompleted()` |

```json
{
  "target_id": 99,
  "tier": 3,
  "name": "Silver Target",
  "earned_coins": "50000",
  "member_reward": 100,
  "owner_reward": 50
}
```

---

#### `laravel.income_target.member_completed`

| Property | Value                                 |
| -------- | ------------------------------------- |
| Target   | User (agency owner)                   |
| Trigger  | When a member completes income target |
| Source   | Same as above (sent to owner)         |

```json
{
  "target_id": 99,
  "member_id": 123,
  "tier": 3,
  "owner_reward": 50
}
```

---

### 3.4 Room Events

#### `laravel.room.level_up`

| Property | Value                                 |
| -------- | ------------------------------------- |
| Target   | Room                                  |
| Trigger  | When room gains enough XP to level up |
| Source   | `MSABEventService::emitRoomLevelUp()` |

```json
{
  "room_id": 789,
  "room_name": "Fun Room",
  "previous_level": 4,
  "new_level": 5,
  "current_xp": "100000"
}
```

---

#### `laravel.room.participant_count`

| Property | Value                                                 |
| -------- | ----------------------------------------------------- |
| Target   | Room                                                  |
| Trigger  | When participant count changes                        |
| Source   | `MSABEventService::emitRoomParticipantCountChanged()` |

```json
{
  "count": 42
}
```

---

#### `laravel.room.member_joined`

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Target   | Room                                       |
| Trigger  | When user becomes a room member            |
| Source   | `MSABEventService::emitRoomMemberJoined()` |

```json
{
  "user_id": 123,
  "user": {
    "id": 123,
    "name": "New Member",
    "avatar": "https://..."
  },
  "role": "member"
}
```

---

#### `laravel.room.membership_dropped`

| Property | Value                                           |
| -------- | ----------------------------------------------- |
| Target   | Room                                            |
| Trigger  | When member voluntarily leaves room             |
| Source   | `MSABEventService::emitRoomMembershipDropped()` |

```json
{
  "user_id": 123
}
```

---

#### `laravel.room.member_kicked`

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Target   | User (kicked) AND Room                     |
| Trigger  | When member is kicked from room            |
| Source   | `MSABEventService::emitRoomMemberKicked()` |

**To kicked user:**

```json
{
  "room_id": 789,
  "kicked_by": 456
}
```

**To room members:**

```json
{
  "user_id": 123,
  "kicked_by": 456
}
```

---

#### `laravel.room.member_blocked`

| Property | Value                                       |
| -------- | ------------------------------------------- |
| Target   | User (blocked) AND Room                     |
| Trigger  | When member is blocked/banned from room     |
| Source   | `MSABEventService::emitRoomMemberBlocked()` |

**To blocked user:**

```json
{
  "room_id": 789,
  "blocked_by": 456,
  "duration": "24h",
  "banned_until": "2026-02-05T01:45:00+00:00"
}
```

**To room members:**

```json
{
  "user_id": 123,
  "duration": "24h"
}
```

---

#### `laravel.room.member_role_changed`

| Property | Value                                           |
| -------- | ----------------------------------------------- |
| Target   | Room                                            |
| Trigger  | When member is promoted/demoted                 |
| Source   | `MSABEventService::emitRoomMemberRoleChanged()` |

```json
{
  "user_id": 123,
  "previous_role": "member",
  "new_role": "admin"
}
```

---

#### `laravel.room.join_request_created`

| Property | Value                                            |
| -------- | ------------------------------------------------ |
| Target   | User (room owner)                                |
| Trigger  | When user requests to join room                  |
| Source   | `MSABEventService::emitRoomJoinRequestCreated()` |

```json
{
  "request_id": 100,
  "room_id": 789,
  "user": {
    "id": 123,
    "name": "Requester",
    "avatar": "https://...",
    "signature": "abc123",
    "gender": 1
  },
  "message": "Can I join?"
}
```

---

#### `laravel.room.join_request_approved`

| Property | Value                                             |
| -------- | ------------------------------------------------- |
| Target   | User (requester)                                  |
| Trigger  | When room owner approves join request             |
| Source   | `MSABEventService::emitRoomJoinRequestApproved()` |

```json
{
  "room_id": 789,
  "room_name": "Fun Room"
}
```

---

#### `laravel.room.join_request_rejected`

| Property | Value                                             |
| -------- | ------------------------------------------------- |
| Target   | User (requester)                                  |
| Trigger  | When room owner rejects join request              |
| Source   | `MSABEventService::emitRoomJoinRequestRejected()` |

```json
{
  "room_id": 789,
  "room_name": "Fun Room"
}
```

---

### 3.5 User Social Events

#### `laravel.user.followed`

| Property | Value                                  |
| -------- | -------------------------------------- |
| Target   | User (followed user)                   |
| Trigger  | When someone follows the user          |
| Source   | `MSABEventService::emitUserFollowed()` |

```json
{
  "follower": {
    "id": 123,
    "name": "New Follower",
    "avatar": "https://..."
  },
  "followed_at": "2026-02-04T01:45:00+00:00"
}
```

---

#### `laravel.user.unfollowed`

| Property | Value                                    |
| -------- | ---------------------------------------- |
| Target   | User (unfollowed user)                   |
| Trigger  | When someone unfollows the user          |
| Source   | `MSABEventService::emitUserUnfollowed()` |

```json
{
  "follower_id": 123
}
```

---

### 3.6 System Events

#### `laravel.config.invalidate`

| Property | Value                                      |
| -------- | ------------------------------------------ |
| Target   | Broadcast (all connected users)            |
| Trigger  | When system config changes (gifts, levels) |
| Source   | `MSABEventService::emitConfigInvalidate()` |

```json
{
  "type": "gifts",
  "version": "2026-02-04-001"
}
```

| `type` values | Description               |
| ------------- | ------------------------- |
| `levels`      | Level thresholds changed  |
| `badges`      | Badge definitions changed |
| `gifts`       | Gift catalog changed      |
| `all`         | Full cache invalidation   |

---

## 4. Incoming Events (MSAB → Laravel)

### 4.1 Gift Processing

#### `msab.gift.batch`

| Property    | Value                            |
| ----------- | -------------------------------- |
| Endpoint    | `POST /api/internal/gifts/batch` |
| Handler     | `GiftController::processBatch()` |
| Idempotency | Yes, via `transaction_id`        |

**Request Payload:**

```json
{
  "transactions": [
    {
      "transaction_id": "msab_tx_abc123",
      "sender_id": 123,
      "recipient_id": 456,
      "gift_id": 1,
      "room_id": 789,
      "quantity": 5,
      "timestamp": 1738618800,
      "message": "Great stream!"
    }
  ]
}
```

| Field            | Type      | Required | Description            |
| ---------------- | --------- | -------- | ---------------------- |
| `transaction_id` | `string`  | Yes      | Idempotency key        |
| `sender_id`      | `integer` | Yes      | User sending gift      |
| `recipient_id`   | `integer` | Yes      | User receiving gift    |
| `gift_id`        | `integer` | Yes      | Gift being sent        |
| `room_id`        | `integer` | Yes      | Room where gift sent   |
| `quantity`       | `integer` | Yes      | Number of gifts (1-99) |
| `timestamp`      | `numeric` | Yes      | Unix timestamp         |
| `message`        | `string`  | No       | Optional message       |

---

## 5. Events NOT Emitted by Laravel

These events are handled by MSAB directly. Do NOT implement these in Laravel.

| Event               | Reason                                         |
| ------------------- | ---------------------------------------------- |
| `gift.animation`    | MSAB broadcasts optimistically before API call |
| `room.user_entered` | MSAB handles room presence directly            |
| `room.user_left`    | MSAB handles room presence directly            |
| `chat.message`      | MSAB handles chat routing directly             |
| `voice.state`       | MSAB handles voice state directly              |

> [!WARNING]
> Adding these events in Laravel will cause **duplicate broadcasts**.
> MSAB handles these for latency-sensitive real-time features.

---

## 6. Event Quick Reference

### All Outgoing Events (Laravel → MSAB)

| Event                                    | Target    | Domain      |
| ---------------------------------------- | --------- | ----------- |
| `laravel.balance.updated`                | User      | Economy     |
| `laravel.level.up`                       | User      | Progression |
| `laravel.badge.earned`                   | User      | Progression |
| `laravel.reward.earned`                  | User      | Progression |
| `laravel.agency.invitation`              | User      | Agency      |
| `laravel.agency.join_request`            | User      | Agency      |
| `laravel.agency.join_request_approved`   | User      | Agency      |
| `laravel.agency.join_request_rejected`   | User      | Agency      |
| `laravel.agency.member_joined`           | User      | Agency      |
| `laravel.agency.member_left`             | User      | Agency      |
| `laravel.agency.member_kicked`           | User      | Agency      |
| `laravel.agency.dissolved`               | User      | Agency      |
| `laravel.income_target.completed`        | User      | Agency      |
| `laravel.income_target.member_completed` | User      | Agency      |
| `laravel.room.level_up`                  | Room      | Room        |
| `laravel.room.participant_count`         | Room      | Room        |
| `laravel.room.member_joined`             | Room      | Room        |
| `laravel.room.membership_dropped`        | Room      | Room        |
| `laravel.room.member_kicked`             | User+Room | Room        |
| `laravel.room.member_blocked`            | User+Room | Room        |
| `laravel.room.member_role_changed`       | Room      | Room        |
| `laravel.room.join_request_created`      | User      | Room        |
| `laravel.room.join_request_approved`     | User      | Room        |
| `laravel.room.join_request_rejected`     | User      | Room        |
| `laravel.user.followed`                  | User      | Social      |
| `laravel.user.unfollowed`                | User      | Social      |
| `laravel.config.invalidate`              | Broadcast | System      |

### All Incoming Events (MSAB → Laravel)

| Event             | Endpoint                         | Domain |
| ----------------- | -------------------------------- | ------ |
| `msab.gift.batch` | `POST /api/internal/gifts/batch` | Gift   |

---

## Version History

| Version | Date       | Author | Changes                  |
| ------- | ---------- | ------ | ------------------------ |
| 1.0     | 2026-02-04 | System | Initial registry created |
