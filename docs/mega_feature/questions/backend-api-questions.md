# Backend API Questions - Frontend Team

> **Date:** 2025-12-31
> **From:** Frontend Team
> **Priority:** HIGH - Blocking frontend implementation

---

## Question 1: Badge API Response Format

**Endpoints in question:**
- `GET /badges`
- `GET /user/badges`

**Current Issue:**
The frontend store expects this response format:
```json
{
  "success": true,
  "data": {
    "badges": [...],
    "pagination": { "has_more": false, "next_cursor": null }
  }
}
```

But per the API docs (`docs/mega_feature/01-api-reference.md`), the response is:
```json
{
  "data": [
    { "id": 1, "name": "Wealth Level 1", ... }
  ]
}
```

**Please confirm:** Which format is correct? Is pagination supported?

---

## Question 2: Agency Owner - Member Income Endpoint

**Required for:** Agency Member Income Page (for owners/admins)

The frontend needs to display:
- Total diamonds earned by all agency members
- Each member's progress toward their income targets
- Contribution breakdown per member
- How much each member needs to earn to reach their next target
- Historical earnings per member

**Requested endpoint:** `GET /agency/{agencyId}/members/income` (or similar)

**Expected response format:**
```json
{
  "success": true,
  "data": {
    "agency_totals": {
      "total_diamonds_earned": 5000,
      "total_coins_contributed": "150000.0000",
      "member_count": 12
    },
    "members": [
      {
        "user_id": 123,
        "name": "Member Name",
        "avatar_url": "...",
        "current_target": {
          "tier": "T2",
          "required_coins": "5000.0000",
          "earned_coins": "3500.0000",
          "progress_percentage": 70,
          "coins_to_complete": "1500.0000",
          "days_remaining": 5
        },
        "total_diamonds_earned": 150,
        "total_coins_earned": "12500.0000",
        "joined_at": "2025-11-15T00:00:00Z"
      }
    ],
    "pagination": {
      "has_more": false,
      "next_cursor": null
    }
  }
}
```

**Questions:**
1. Does this endpoint exist?
2. If yes, please provide the actual response format
3. If no, can it be created? This is required for agency owners to monitor their members' performance

---

## Question 3: User Level/XP System

**Required for:** Wealth Level & Charm Level pages

Currently these pages show static/hardcoded data:
- Static XP values ("9560.4 XP", "1058.4 XP to next level")
- Static level badges table
- Static user info

**Requested endpoints:**

### 3.1 User Level Status
`GET /user/levels` or `GET /user/profile/levels`

**Expected response:**
```json
{
  "success": true,
  "data": {
    "wealth": {
      "current_level": 3,
      "current_xp": "9560.4000",
      "xp_for_next_level": "10618.8000",
      "xp_remaining": "1058.4000",
      "progress_percentage": 90
    },
    "charm": {
      "current_level": 2,
      "current_xp": "5230.0000",
      "xp_for_next_level": "8000.0000",
      "xp_remaining": "2770.0000",
      "progress_percentage": 65
    }
  }
}
```

### 3.2 Level Configuration (Badge Rewards per Level)
`GET /levels/config` or `GET /badges/levels`

**Expected response:**
```json
{
  "success": true,
  "data": {
    "wealth_levels": [
      {
        "level": 1,
        "required_xp": "0",
        "badge": {
          "id": 1,
          "name": "Wealth Level 1",
          "image_url": "..."
        }
      },
      {
        "level": 2,
        "required_xp": "1000",
        "badge": {...}
      }
    ],
    "charm_levels": [
      {
        "level": 1,
        "required_xp": "0",
        "badge": {...}
      }
    ]
  }
}
```

**Questions:**
1. Do these endpoints exist?
2. How is XP calculated? (1 coin = 1 XP for wealth? Gifts received = charm XP?)
3. What are the level thresholds?
4. If endpoints don't exist, can they be created?

---

## Question 4: Coin to Diamond Exchange

**Required for:** My Income page

The static page shows:
- "Exchange Rate: 1 Diamond = 1750 Coins"
- A form to convert coins to diamonds

**Requested endpoints:**

### 4.1 Get Exchange Rate
`GET /user/exchange-rate` or similar

**Expected response:**
```json
{
  "success": true,
  "data": {
    "coins_per_diamond": 1750,
    "min_exchange_amount": 1750,
    "user_coins_balance": "75000.0000"
  }
}
```

### 4.2 Perform Exchange
`POST /user/exchange-coins`

**Request:**
```json
{
  "coin_amount": 3500
}
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "coins_deducted": "3500.0000",
    "diamonds_received": 2,
    "new_coin_balance": "71500.0000",
    "new_diamond_balance": 152
  },
  "message": "Successfully exchanged 3500 coins for 2 diamonds"
}
```

**Questions:**
1. Do these endpoints exist?
2. Is the exchange rate fixed (1750) or dynamic?
3. Are there minimum/maximum limits?

---

## Summary of Required Endpoints

| Priority | Endpoint | Purpose | Status |
|----------|----------|---------|--------|
| HIGH | Badge response format | Fix TypeError on /badges page | Clarification needed |
| HIGH | `/agency/{id}/members/income` | Member income page for owners | Needs creation? |
| MEDIUM | `/user/levels` | Wealth/Charm level display | Needs creation? |
| MEDIUM | `/levels/config` | Level thresholds & rewards | Needs creation? |
| MEDIUM | Coin exchange endpoints | Convert coins to diamonds | Clarification needed |

---

**Please respond with:**
1. Confirmation of which endpoints exist
2. Actual response formats for existing endpoints
3. Timeline for any new endpoints that need to be created

Thank you!
