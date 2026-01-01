# Backend API Answers - Response to Frontend Team

> **Date:** 2025-12-31
> **From:** Backend Team
> **Status:** ✅ All Requested Features Implemented

---

## Summary

All requested endpoints have been implemented and are ready for integration:

| Question             | Status       | Endpoint                                 |
| -------------------- | ------------ | ---------------------------------------- |
| Badge API Format     | ✅ Clarified | `GET /api/v1/badges`                     |
| Agency Member Income | ✅ **NEW**   | `GET /api/v1/user/agency/members/income` |
| User Levels/XP       | ✅ **NEW**   | `GET /api/v1/profile/levels`             |
| Level Config         | ✅ **NEW**   | `GET /api/v1/levels/config`              |
| Coin Exchange        | ✅ **NEW**   | `GET/POST /api/v1/user/exchange`         |

---

## Question 1: Badge API Response Format

### Answer

The badge endpoints use **standard Laravel Resource format**:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Wealth Level 1",
      "description": "Badge for reaching Wealth Level 1",
      "category": "wealth",
      "category_label": "Wealth",
      "level": 1,
      "image_url": "https://cdn.example.com/badges/wealth_1.png",
      "is_stackable": false,
      "metadata": null
    }
  ]
}
```

**Key Points:**

- Response is wrapped in `"data": [...]` (standard Laravel)
- **No pagination** - badge collections are small (10-50 items)
- Filter by category: `GET /api/v1/badges?category=wealth`

### Frontend Action Required

Update your store to expect `response.data` array format.

---

## Question 2: Agency Owner - Member Income Endpoint

### ✅ Implemented: `GET /api/v1/user/agency/members/income`

**Authentication:** Required (Owner or Admin role only)

**Pagination:** Cursor-based for scalability

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `per_page` | int | 20 | 100 | Items per page |
| `cursor` | string | null | - | Cursor for next page |

### Response Format

```json
{
  "status": "success",
  "message": "Members income retrieved",
  "data": {
    "agency_id": 1,
    "agency_name": "Example Agency",
    "members": [
      {
        "user_id": 5,
        "name": "John Doe",
        "avatar_url": "https://cdn.example.com/avatars/user5.jpg",
        "joined_at": "2025-12-01T10:00:00+00:00",
        "current_target": {
          "tier": "T2",
          "required_coins": 5000.0,
          "earned_coins": 2500.0,
          "progress_percentage": 50.0,
          "coins_to_complete": 2500.0,
          "days_remaining": 4,
          "diamond_reward": 50
        },
        "total_diamonds_earned": 60,
        "total_coins_contributed": 6000.0,
        "completed_targets_count": 2
      }
    ]
  },
  "meta": {
    "pagination": {
      "per_page": 20,
      "next_cursor": "eyJpZCI6MjAsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0",
      "prev_cursor": null,
      "has_more": true
    },
    "timestamp": "2025-12-31T16:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

### Edge Cases Handled

| Case                    | Behavior                                  |
| ----------------------- | ----------------------------------------- |
| New member (no targets) | `current_target: null`, totals = 0        |
| Empty agency            | `members: []`, `agency_id` still returned |
| Non-owner/admin access  | 403 Forbidden                             |
| Max level target        | Same format, target continues             |

---

## Question 3: User Level/XP System

### ✅ Implemented: Two New Endpoints

### 3.1 User's Current Level Status

**Endpoint:** `GET /api/v1/profile/levels`

**Authentication:** Required

**Response:**

```json
{
  "status": "success",
  "message": "Level status retrieved",
  "data": {
    "wealth": {
      "current_level": 2,
      "level_name": "Wealth Level 2",
      "current_xp": 8500.0,
      "xp_for_next_level": 15000.0,
      "xp_remaining": 6500.0,
      "progress_percentage": 35.0,
      "badge": {
        "id": 2,
        "name": "Wealth Badge L2",
        "image_url": "https://cdn.example.com/badges/wealth_2.png"
      },
      "next_level": {
        "level": 3,
        "name": "Wealth Level 3",
        "required_xp": 15000.0
      }
    },
    "charm": {
      "current_level": 0,
      "level_name": "Beginner",
      "current_xp": 0.0,
      "xp_for_next_level": 1000.0,
      "xp_remaining": 1000.0,
      "progress_percentage": 0.0,
      "badge": null,
      "next_level": {
        "level": 1,
        "name": "Charm Level 1",
        "required_xp": 1000.0
      }
    }
  }
}
```

### 3.2 Level Configuration (Public)

**Endpoint:** `GET /api/v1/levels/config`

**Authentication:** Not required (public data)

**Response:**

```json
{
  "status": "success",
  "message": "Level configuration retrieved",
  "data": {
    "wealth_levels": [
      {
        "level": 1,
        "name": "Wealth Level 1",
        "required_xp": 1000.0000,
        "badge": {
          "id": 1,
          "name": "Wealth Badge L1",
          "description": "Awarded for reaching Wealth Level 1",
          "image_url": "https://cdn.example.com/badges/wealth_1.png",
          "category": "wealth"
        }
      },
      {
        "level": 2,
        "name": "Wealth Level 2",
        "required_xp": 5000.0000,
        "badge": { ... }
      }
      // ... up to level 10
    ],
    "charm_levels": [
      // Same structure as wealth_levels
    ]
  }
}
```

### XP System Answers

| Question              | Answer                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| How is XP calculated? | **Wealth XP**: Earned when SENDING gifts (gift value)<br>**Charm XP**: Earned when RECEIVING gifts (gift value) |
| Level thresholds?     | L1: 1K, L2: 5K, L3: 15K, L4: 50K, L5: 100K, L6: 250K, L7: 500K, L8: 1M, L9: 2.5M, L10: 5M                       |
| New user display?     | Level 0 with "Beginner" label                                                                                   |
| Max level?            | Level 10, `progress_percentage: 100%`, `next_level: null`                                                       |
| Decimal precision?    | XP stored as DECIMAL(15,4), displayed to 4 decimals                                                             |

---

## Question 4: Coin to Diamond Exchange

### ✅ Implemented: Three New Endpoints

### 4.1 Get Exchange Info

**Endpoint:** `GET /api/v1/user/exchange`

**Authentication:** Required

**Response:**

```json
{
  "status": "success",
  "message": "Exchange info retrieved",
  "data": {
    "coins_per_diamond": 1750,
    "min_exchange_amount": 1750,
    "max_per_transaction": 500000,
    "daily_limit": 1000000,
    "is_enabled": true,
    "user_coins_balance": 50000.0,
    "user_diamonds_balance": 100,
    "today_exchanged": 5250.0,
    "daily_remaining": 994750.0
  }
}
```

### 4.2 Preview Exchange (Optional, for UI)

**Endpoint:** `POST /api/v1/user/exchange/preview`

**Request:**

```json
{
  "coin_amount": 5000
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Exchange preview",
  "data": {
    "coins_to_deduct": 3500.0,
    "diamonds_to_receive": 2,
    "leftover_coins": 1500.0,
    "exchange_rate": 1750
  }
}
```

### 4.3 Execute Exchange

**Endpoint:** `POST /api/v1/user/exchange`

**Rate Limit:** 10 requests per minute

**Request:**

```json
{
  "coin_amount": 5000
}
```

**Response (Success):**

```json
{
  "status": "success",
  "message": "Successfully exchanged coins for 2 diamonds",
  "data": {
    "coins_deducted": "3500.0000",
    "diamonds_received": 2,
    "new_coin_balance": "46500.0000",
    "new_diamond_balance": 102,
    "exchange_rate": 1750
  }
}
```

### Error Responses

| Error                | HTTP Code | Message                                                           |
| -------------------- | --------- | ----------------------------------------------------------------- |
| Disabled             | 422       | "Exchange is currently disabled"                                  |
| Insufficient coins   | 422       | "Insufficient coins. Minimum: 1750"                               |
| Below minimum        | 422       | "Minimum exchange is 1750 coins"                                  |
| Over max/transaction | 422       | "Maximum per transaction is 500000 coins"                         |
| Daily limit          | 422       | "Daily limit exceeded. You can exchange up to X more coins today" |

### Exchange System Answers

| Question                | Answer                                                |
| ----------------------- | ----------------------------------------------------- |
| Is exchange rate fixed? | **Configurable** via admin panel (default: 1750)      |
| Are there limits?       | Yes: min 1750, max 500K/transaction, 1M/day           |
| Floor behavior?         | Yes - 5000 coins = 2 diamonds (3500 used), 1500 stays |
| Audit trail?            | Yes - all exchanges logged in transactions table      |

---

## Complete Endpoint Summary

### Public Endpoints (No Auth)

| Method | Endpoint                         | Description                       |
| ------ | -------------------------------- | --------------------------------- |
| GET    | `/api/v1/levels/config`          | All level definitions with badges |
| GET    | `/api/v1/levels/wealth`          | Wealth levels only                |
| GET    | `/api/v1/levels/charm`           | Charm levels only                 |
| GET    | `/api/v1/badges`                 | Badge catalog                     |
| GET    | `/api/v1/badges?category=wealth` | Filtered badges                   |

### Authenticated Endpoints

| Method | Endpoint                             | Description                         |
| ------ | ------------------------------------ | ----------------------------------- |
| GET    | `/api/v1/profile/levels`             | User's wealth & charm level status  |
| GET    | `/api/v1/user/badges`                | User's earned badges                |
| GET    | `/api/v1/user/exchange`              | Exchange rate & user balance        |
| POST   | `/api/v1/user/exchange`              | Execute coin-to-diamond exchange    |
| POST   | `/api/v1/user/exchange/preview`      | Preview exchange result             |
| GET    | `/api/v1/user/income`                | User's own income stats             |
| GET    | `/api/v1/user/agency/members/income` | Agency members income (owner/admin) |

---

## TypeScript Types (Suggestion)

```typescript
// Level Status
interface LevelStatus {
  current_level: number;
  level_name: string;
  current_xp: number;
  xp_for_next_level: number;
  xp_remaining: number;
  progress_percentage: number;
  badge: Badge | null;
  next_level: {
    level: number;
    name: string;
    required_xp: number;
  } | null;
}

interface UserLevelsResponse {
  wealth: LevelStatus;
  charm: LevelStatus;
}

// Exchange
interface ExchangeInfo {
  coins_per_diamond: number;
  min_exchange_amount: number;
  max_per_transaction: number;
  daily_limit: number;
  is_enabled: boolean;
  user_coins_balance: number;
  user_diamonds_balance: number;
  today_exchanged: number;
  daily_remaining: number;
}

interface ExchangeResult {
  coins_deducted: string;
  diamonds_received: number;
  new_coin_balance: string;
  new_diamond_balance: number;
  exchange_rate: number;
}

// Agency Member Income
interface MemberIncome {
  user_id: number;
  name: string;
  avatar_url: string | null;
  joined_at: string;
  current_target: {
    tier: string;
    required_coins: number;
    earned_coins: number;
    progress_percentage: number;
    coins_to_complete: number;
    days_remaining: number;
    diamond_reward: number;
  } | null;
  total_diamonds_earned: number;
  total_coins_contributed: number;
  completed_targets_count: number;
}

interface MembersIncomeResponse {
  agency_id: number;
  agency_name: string;
  members: MemberIncome[];
}
```

---

## Questions?

Contact the backend team if you need:

- Additional fields in responses
- Changes to pagination behavior
- Additional filtering options
- Error code clarifications
