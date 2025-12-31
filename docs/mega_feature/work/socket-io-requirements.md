# Socket.IO Event Requirements for MSAB Team

> **Frontend Team → MSAB (Mediasoup/Socket.IO) Team**
> 
> **Document Version:** 1.0.0
> **Date:** 2025-12-29

---

## Overview

The frontend requires real-time event notifications for the Mega Feature system. This document specifies all events the frontend needs to receive from the Socket.IO server.

---

## Event Specifications

### 1. Balance Updated Event

**Event Name:** `balance.updated`

**When to Emit:** Whenever a user's balance changes (coins, diamonds, XP).

**Payload:**
```typescript
{
  user_id: number;        // Target user ID
  coins?: string;         // New coins balance (optional, only if changed)
  diamonds?: string;      // New diamonds balance (optional, only if changed)
  wealth_xp?: string;     // New wealth XP (optional, only if changed)
  charm_xp?: string;      // New charm XP (optional, only if changed)
}
```

**Example:**
```json
{
  "user_id": 12345,
  "coins": "1500.0000",
  "wealth_xp": "5250.0000"
}
```

**Target:** Emit to the specific user only (private channel).

---

### 2. Gift Sent Event

**Event Name:** `gift.sent`

**When to Emit:** When a gift is successfully sent in a room.

**Payload:**
```typescript
{
  batch_id: string;       // Unique batch identifier
  sender: {
    id: number;
    name: string;
    avatar_url: string;
  };
  receiver: {
    id: number;
    name: string;
  };
  gift: {
    id: number;
    name: string;
    thumbnail_url: string;
    animation_url?: string;  // SVGA or video URL for playback
  };
  quantity: number;
  room_id: number;
  timestamp: string;      // ISO 8601
}
```

**Target:** Broadcast to all users in the room (`room:{room_id}`).

---

### 3. Reward Earned Event

**Event Name:** `reward.earned`

**When to Emit:** When a user earns a new pending reward.

**Payload:**
```typescript
{
  id: number;                           // Reward ID
  reward_type: 'diamonds' | 'coins' | 'badge' | 'gift';
  reward_value: number | null;          // Value for coins/diamonds, null for badges
  source: string;                       // e.g., 'agency_target', 'wealth_level'
  source_name: string;                  // Human-readable, e.g., 'Tier 1 Target Completed'
  reward_data?: {                       // Additional data for badge rewards
    badge_name?: string;
    badge_url?: string;
  };
}
```

**Target:** Emit to the specific user only (private channel).

---

### 4. Badge Earned Event

**Event Name:** `badge.earned`

**When to Emit:** When a user earns a new badge.

**Payload:**
```typescript
{
  id: number;                 // UserBadge ID
  badge_id: number;           // Badge catalog ID
  badge: {
    name: string;
    image_url: string;
    category: 'wealth' | 'charm' | 'room' | 'agency' | 'special';
  };
  source_type: string;        // e.g., 'wealth_level', 'room_level'
}
```

**Target:** Emit to the specific user only (private channel).

---

### 5. Income Target Completed Event

**Event Name:** `income_target.completed`

**When to Emit:** When a user completes an income target.

**Payload:**
```typescript
{
  id: number;                 // Target ID
  tier: string;               // e.g., 'T1', 'T2'
  name: string;               // e.g., 'Tier 1'
  earned_coins: string;       // Total earned
  member_diamond_reward: number;  // Diamonds earned
}
```

**Target:** Emit to the specific user only (private channel).

---

### 6. Room Level Up Event

**Event Name:** `room.level_up`

**When to Emit:** When a room levels up.

**Payload:**
```typescript
{
  room_id: number;
  new_level: number;
  badge?: {                   // Optional, if badge is awarded
    id: number;
    name: string;
    image_url: string;
  };
}
```

**Target:** Broadcast to all users in the room (`room:{room_id}`).

---

### 7. Room Join Request Event

**Event Name:** `room.join_request`

**When to Emit:** When a user submits a join request to a room.

**Payload:**
```typescript
{
  id: number;                 // Request ID
  user: {
    id: number;
    name: string;
    avatar_url: string;
  };
  message?: string;           // Optional message from requester
}
```

**Target:** Emit to room owner/admins only (private channels for those users).

---

### 8. Room Invitation Event

**Event Name:** `room.invitation`

**When to Emit:** When a user receives a room invitation.

**Payload:**
```typescript
{
  id: number;                 // Invitation ID
  room: {
    id: number;
    name: string;
    logo: string;
  };
  inviter: {
    id: number;
    name: string;
  };
  message?: string;
}
```

**Target:** Emit to the invited user only (private channel).

---

## Channel/Room Structure

The frontend expects the following Socket.IO room structure:

| Channel Pattern | Purpose | Subscribers |
|-----------------|---------|-------------|
| `user:{user_id}` | Private user notifications | Single user |
| `room:{room_id}` | Room-wide broadcasts | All users in the room |

---

## Connection Requirements

### Authentication
- Socket connections must be authenticated using the same Bearer token used for REST API
- Unauthenticated connections should be rejected

### Reconnection
- Frontend will handle automatic reconnection
- Upon reconnection, frontend will re-subscribe to relevant channels

### Event Format
- All payloads must be valid JSON
- Timestamps should be ISO 8601 format
- Decimal values (coins, XP) should be strings to preserve precision

---

## Priority Order

1. **High Priority (Phase 1-2):**
   - `balance.updated` - Critical for real-time balance display
   - `gift.sent` - Required for gift animation playback

2. **Medium Priority (Phase 3-4):**
   - `reward.earned` - Reward notifications
   - `income_target.completed` - Income dashboard updates
   - `badge.earned` - Badge celebration modal

3. **Lower Priority (Phase 5-6):**
   - `room.level_up` - Room level celebration
   - `room.join_request` - Admin notifications
   - `room.invitation` - User notifications

---

## Questions for MSAB Team

1. What is the current Socket.IO namespace structure?
2. How should we handle authentication for socket connections?
3. Is there an existing event format/wrapper we should follow?
4. What is the expected latency for event delivery?

---

## Contact

For questions or clarifications, contact the Frontend Team.
