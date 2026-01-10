# Transaction API v2 Specification

> **Date**: 2026-01-10  
> **Status**: Pending Backend Implementation  
> **Priority**: High  
> **Requested By**: Frontend Team

---

## Overview

This specification outlines required changes to the Transaction API to improve:
1. **UX**: Display transactions from the current user's perspective
2. **Privacy**: Don't expose other party's balance information
3. **Performance**: Reduce payload size by ~50%
4. **Clarity**: Simplify data structure for frontend consumption

---

## Current Issues

| Issue | Description |
|-------|-------------|
| **Wrong Perspective** | Amount sign is based on initiator, confusing when user is beneficiary |
| **Privacy Leak** | Initiator balance exposed to beneficiary and vice versa |
| **Data Bloat** | Sends 8 balance/XP fields when only 4 are relevant to user |
| **Cognitive Overload** | Frontend must compute which fields are relevant |

---

## Proposed API Response Structure

### `GET /api/v1/user/transactions`

Each transaction should be returned **from the current user's perspective**:

```json
{
  "success": true,
  "data": {
    "transactions_by_date": [
      {
        "date": "2026-01-10",
        "date_formatted": "10 January, 2026",
        "transactions": [
          {
            "id": "txn_4",
            "type": "gift",
            "timestamp": "2026-01-10T10:56:00Z",
            "title": "Gift",
            "description": "Sent Rose to @haider_shah",
            "thumbnail_url": "https://cdn.example.com/gifts/rose.webp",

            // ═══════════════════════════════════════════════════════
            // NEW: User's role in this transaction
            // ═══════════════════════════════════════════════════════
            "my_role": "initiator",

            // ═══════════════════════════════════════════════════════
            // NEW: Amount from CURRENT USER's perspective
            // - Negative if user spent/lost
            // - Positive if user received/gained
            // ═══════════════════════════════════════════════════════
            "amount": {
              "value": -500,
              "currency": "coins",
              "formatted": "-500.00"
            },

            // ═══════════════════════════════════════════════════════
            // NEW: Only the CURRENT USER's balance changes
            // Do NOT include other party's balance
            // ═══════════════════════════════════════════════════════
            "my_balance": {
              "coins": {
                "before": 5000,
                "after": 4500
              },
              "diamonds": null
            },

            // ═══════════════════════════════════════════════════════
            // NEW: Only the CURRENT USER's XP changes
            // Do NOT include other party's XP
            // ═══════════════════════════════════════════════════════
            "my_xp": {
              "wealth": {
                "before": 5000,
                "after": 5100
              },
              "charm": null
            },

            // ═══════════════════════════════════════════════════════
            // NEW: The OTHER party in the transaction
            // Only identity info, NO balance/XP data
            // ═══════════════════════════════════════════════════════
            "other_party": {
              "id": 2,
              "name": "Haider Shah",
              "signature": "1766229",
              "avatar_url": "https://cdn.example.com/avatars/2.webp"
            },

            // ═══════════════════════════════════════════════════════
            // OPTIONAL: Additional metadata (gift details, etc.)
            // ═══════════════════════════════════════════════════════
            "metadata": {
              "gift_id": 15,
              "gift_name": "Rose",
              "quantity": 1
            }
          }
        ]
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "has_more": false,
      "next_cursor": null
    }
  }
}
```

---

## Field Specifications

### `my_role` (required)
```typescript
type MyRole = 'initiator' | 'beneficiary'
```

| User's Role | Meaning |
|-------------|---------|
| `initiator` | User started the transaction (sent gift, transferred coins, etc.) |
| `beneficiary` | User received the transaction (received gift, received coins, etc.) |

**Special Cases:**
- `room_commission`: User is always `initiator` (room owner receiving commission)
- `system_reward`: User is always `beneficiary` (receiving from system)
- `system_generation`: User is always `beneficiary` (admin generating coins for them)

---

### `amount` (required)
The primary amount change from the **current user's perspective**.

```typescript
interface Amount {
  value: number      // Negative = user lost, Positive = user gained
  currency: 'coins' | 'diamonds'
  formatted: string  // Pre-formatted with sign, e.g., "-500.00" or "+100.00"
}
```

**Logic:**
- If user is **initiator** of a gift: `value = -gift_cost` (negative, they paid)
- If user is **beneficiary** of a gift: `value = +gift_value` (positive, they received)
- If user is **initiator** of coin_transfer: `value = -transfer_amount` (negative)
- If user is **beneficiary** of coin_transfer: `value = +transfer_amount` (positive)

---

### `my_balance` (required)
Only the **current user's** balance before/after this transaction.

```typescript
interface MyBalance {
  coins: { before: number; after: number } | null
  diamonds: { before: number; after: number } | null
}
```

**Important:** Do NOT include the other party's balance. This is a privacy requirement.

---

### `my_xp` (required)
Only the **current user's** XP before/after this transaction.

```typescript
interface MyXP {
  wealth: { before: number; after: number } | null
  charm: { before: number; after: number } | null
}
```

**Important:** Do NOT include the other party's XP.

---

### `other_party` (nullable)
Information about the other participant in the transaction.

```typescript
interface OtherParty {
  id: number
  name: string
  signature: string
  avatar_url: string | null
}
```

**When `null`:**
- `system_reward` (no other party, system generated)
- `system_generation` (admin action)
- Cases where there's no counterparty

---

## Fields to REMOVE from Response

The following fields should **NOT** be included in the new response:

| Old Field | Reason for Removal |
|-----------|-------------------|
| `initiator` | Replaced by `my_role` + `other_party` |
| `beneficiary` | Replaced by `my_role` + `other_party` |
| `initiator_balance` | Privacy: other party shouldn't see this |
| `beneficiary_balance` | Privacy: other party shouldn't see this |
| `initiator_xp` | Privacy: replaced by `my_xp` |
| `beneficiary_xp` | Privacy: replaced by `my_xp` |

---

## Example Scenarios

### Scenario 1: User Sends a Gift

**User A sends Rose (500 coins) to User B**

**Response for User A (initiator):**
```json
{
  "id": "txn_4",
  "type": "gift",
  "my_role": "initiator",
  "amount": { "value": -500, "currency": "coins", "formatted": "-500.00" },
  "my_balance": { "coins": { "before": 5000, "after": 4500 }, "diamonds": null },
  "my_xp": { "wealth": { "before": 5000, "after": 5100 }, "charm": null },
  "other_party": { "id": 2, "name": "User B", "signature": "1234567", "avatar_url": "..." },
  "description": "Sent Rose to @userb"
}
```

**Response for User B (beneficiary):**
```json
{
  "id": "txn_4",
  "type": "gift",
  "my_role": "beneficiary",
  "amount": { "value": 500, "currency": "coins", "formatted": "+500.00" },
  "my_balance": { "coins": { "before": 1000, "after": 1500 }, "diamonds": null },
  "my_xp": { "wealth": null, "charm": { "before": 3000, "after": 3100 } },
  "other_party": { "id": 1, "name": "User A", "signature": "7654321", "avatar_url": "..." },
  "description": "Received Rose from @usera"
}
```

---

### Scenario 2: Room Commission (No Beneficiary)

**Room owner receives 50 coins commission**

```json
{
  "id": "txn_5",
  "type": "room_commission",
  "my_role": "initiator",
  "amount": { "value": 50, "currency": "coins", "formatted": "+50.00" },
  "my_balance": { "coins": { "before": 4500, "after": 4550 }, "diamonds": null },
  "my_xp": { "wealth": { "before": 5100, "after": 5150 }, "charm": null },
  "other_party": null,
  "description": "Room commission from Live Room"
}
```

---

### Scenario 3: Diamond Exchange

**User exchanges 2 diamonds for 3500 coins**

```json
{
  "id": "txn_6",
  "type": "diamond_exchange",
  "my_role": "initiator",
  "amount": { "value": 3500, "currency": "coins", "formatted": "+3,500.00" },
  "my_balance": { 
    "coins": { "before": 4550, "after": 8050 }, 
    "diamonds": { "before": 50, "after": 48 } 
  },
  "my_xp": null,
  "other_party": null,
  "description": "Exchanged 2 diamonds for coins",
  "metadata": {
    "diamonds_deducted": 2,
    "coins_received": 3500,
    "exchange_rate": 1750
  }
}
```

---

## Implementation Checklist for Backend

- [ ] Add `my_role` field to response
- [ ] Replace `initiator`/`beneficiary` with `other_party`
- [ ] Replace `initiator_balance`/`beneficiary_balance` with `my_balance`
- [ ] Replace `initiator_xp`/`beneficiary_xp` with `my_xp`
- [ ] Ensure `amount.value` sign is from current user's perspective
- [ ] Update `description` to be from current user's perspective
- [ ] Remove old fields from response
- [ ] Test both initiator and beneficiary views

---

## Response Requested from Backend

Once implemented, please provide:

1. **Confirmation** that the spec was followed
2. **Any deviations** from this specification (with reasons)
3. **New field additions** if any were needed
4. **Edge cases** discovered during implementation

This will help frontend update accordingly.

---

## Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Payload per transaction | ~800 bytes | ~400 bytes | **50% smaller** |
| Fields per transaction | 12+ | 8 | **33% fewer** |
| Privacy exposure | High | None | **100% safer** |

---

## Questions for Backend

1. For `coin_transfer` where reseller gives coins to user, is the user `initiator` or `beneficiary`?
2. For `system_generation` (admin gives coins), should `other_party` be `null` or contain admin info?
3. Should we include transaction `status` field for pending/completed states?

---

**Frontend Team Contact**: [Your Name]  
**Expected Completion**: TBD
