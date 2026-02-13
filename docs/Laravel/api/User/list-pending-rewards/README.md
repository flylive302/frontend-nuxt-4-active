# GET /api/v1/user/rewards

> **Domain**: Progression  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Returns a list of pending (unclaimed) rewards for the authenticated user, including reward details and expiration status.

### Responsibilities

- Retrieve all pending rewards for the authenticated user
- Eager load associated reward definitions
- Transform rewards using API resources for consistent response format
- Handle unauthenticated users gracefully

### What It Owns

| Owned                | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| Pending rewards list | Fetches user's unclaimed rewards from `user_rewards` table |

### External Dependencies

| Dependency | Type       | Purpose                                    |
| ---------- | ---------- | ------------------------------------------ |
| Database   | PostgreSQL | Stores `user_rewards` and `rewards` tables |
| Sanctum    | Package    | Token-based authentication                 |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/rewards
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config        |
| ------- | ------- | ------------- |
| Default | User ID | `api` limiter |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

No request body required (GET request).

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": "integer", // UserReward ID
      "reward": {
        // Nested Reward object
        "id": "integer", // Reward ID
        "type": "string", // wealth_level, charm_level, etc.
        "type_label": "string", // Human-readable type
        "name": "string", // Reward name
        "description": "string|null", // Reward description
        "reward_type": "string", // diamonds, coins, badge, gift
        "reward_type_label": "string", // Human-readable reward type
        "reward_value": "float|null", // Numeric value for coins/diamonds
        "reward_item_id": "integer|null", // Related badge/gift ID
        "level": "integer|null", // Level requirement
        "required_value": "float", // Progress required
        "icon_url": "string|null", // Icon URL
        "is_one_time": "boolean" // Can only be claimed once
      },
      "status": "string", // pending
      "status_label": "string", // Pending
      "status_color": "string", // warning
      "source_type": "string", // Source of reward (e.g., level_up)
      "source_id": "integer|null", // Source record ID
      "earned_at": "string", // ISO 8601 datetime
      "claimed_at": "null", // Always null for pending
      "expires_at": "string|null", // ISO 8601 datetime or null
      "can_claim": "boolean" // Whether reward can be claimed
    }
  ]
}
```

#### ❌ Unauthorized (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Success - returns rewards array   |
| `401` | Missing or invalid authentication |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/rewards                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rewards.php:16                                             │
│ Route: Route::get('/', [RewardController::class, 'index'])                  │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Bearer token                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/RewardController.php:26       │
│                                                                             │
│ No FormRequest used - standard Request injection.                           │
│ No request body validation needed for this GET endpoint.                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/RewardController.php          │
│ Method: index(Request $request): AnonymousResourceCollection                │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return UserRewardResource::collection([]);                          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Fetch pending rewards via service                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userId = $user->id;                                                    │ │
│ │ $rewards = $this->rewardService->getPendingRewards($userId);            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return resource collection                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return UserRewardResource::collection($rewards);                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/RewardService.php:178-181                    │
│                                                                             │
│ METHOD: getPendingRewards(int $userId): Collection                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getPendingRewards(int $userId): Collection              │ │
│ │ {                                                                       │ │
│ │     return UserReward::getPendingForUser($userId);                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Delegates directly to UserReward model static method.                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UserReward (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/UserReward.php                             │ │
│ │ Responsibility: Represents a user's earned reward instance              │ │
│ │ Reusable: YES (used by multiple reward-related endpoints)               │ │
│ │ Why It Exists: Tracks individual reward assignments to users            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getPendingForUser($userId) → Static query builder for pending       │ │
│ │   • scopePending($query) → Filters by PENDING status                    │ │
│ │   • scopeForUser($query, $userId) → Filters by user_id                  │ │
│ │   • canClaim() → Checks if reward can be claimed                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Reward (Model)                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/Reward.php                                 │ │
│ │ Responsibility: Defines reward types and their properties               │ │
│ │ Reusable: YES (reward definitions shared across users)                  │ │
│ │ Why It Exists: Single source of truth for reward configurations         │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • type → RewardType enum (wealth_level, charm_level, etc.)            │ │
│ │   • reward_type → RewardItemType enum (diamonds, coins, badge, gift)    │ │
│ │   • reward_value → Numeric amount for coins/diamonds                    │ │
│ │   • reward_item_id → FK to badges/gifts table                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserRewardStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/UserRewardStatus.php                        │ │
│ │ Responsibility: Defines reward claim states                             │ │
│ │ Reusable: YES (used in queries and status checks)                       │ │
│ │ Why It Exists: Type-safe status management                              │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PENDING → Can be claimed                                            │ │
│ │   • CLAIMED → Already claimed by user                                   │ │
│ │   • EXPIRED → Past expiration date, cannot claim                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Fetch pending user rewards with eager-loaded reward              │
│    Query:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT * FROM user_rewards                                          │ │
│    │ WHERE user_id = ? AND status = 'pending'                            │ │
│    │ ORDER BY earned_at DESC                                             │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: UserReward::getPendingForUser()                                  │
│                                                                             │
│ 2. SELECT: Eager load rewards (single query for all related records)        │
│    Query:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT * FROM rewards WHERE id IN (...)                             │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: ->with('reward') eager loading                                   │
│                                                                             │
│ NO CACHE OPERATIONS                                                         │
│ NO QUEUE OPERATIONS                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UserRewardResource (API Resource)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Progression/UserRewardResource.php          │ │
│ │                                                                         │ │
│ │ Transforms each UserReward model to:                                    │ │
│ │   • id, status, status_label, status_color                              │ │
│ │   • source_type, source_id                                              │ │
│ │   • earned_at, claimed_at, expires_at (ISO 8601)                        │ │
│ │   • can_claim (boolean)                                                 │ │
│ │   • reward → nested RewardResource                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RewardResource (API Resource)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Progression/RewardResource.php              │ │
│ │                                                                         │ │
│ │ Transforms each Reward model to:                                        │ │
│ │   • id, type, type_label, name, description                             │ │
│ │   • reward_type, reward_type_label, reward_value                        │ │
│ │   • reward_item_id, level, required_value                               │ │
│ │   • icon_url, is_one_time                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                     | Used By Endpoints                                                                   | Reusable | Reasoning                                        |
| ------------------------ | ----------------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| `RewardController.php`   | /user/rewards, /user/rewards/history, /user/rewards/stats, /user/rewards/{id}/claim | ⭕ Mixed | Methods reuse patterns but are endpoint-specific |
| `RewardService.php`      | Multiple reward endpoints                                                           | ✅       | Central service for all reward operations        |
| `UserReward.php`         | All reward-related endpoints                                                        | ✅       | Core model with reusable scopes and methods      |
| `Reward.php`             | All reward system endpoints                                                         | ✅       | Reward definition model                          |
| `UserRewardResource.php` | /user/rewards, /user/rewards/history                                                | ✅       | Common API response format for user rewards      |
| `RewardResource.php`     | All reward endpoints                                                                | ✅       | Common API response format for rewards           |
| `UserRewardStatus.php`   | All reward endpoints                                                                | ✅       | Shared enum for status values                    |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

No validation errors possible - this is a simple GET endpoint with no request body or parameters.

### Business Logic Errors (400)

No business logic errors - endpoint simply returns available data.

### System Errors (500)

| Error               | Source   | Condition             |
| ------------------- | -------- | --------------------- |
| Database connection | Database | Database unavailable  |
| Query timeout       | Database | Very large result set |

### Edge Cases

| Case                     | Behavior                                   |
| ------------------------ | ------------------------------------------ |
| No pending rewards       | Returns empty array `{ "data": [] }`       |
| User has expired rewards | Not returned (only PENDING status fetched) |
| Reward relation missing  | `reward` field shows `null` (whenLoaded)   |
| Null user (edge case)    | Returns empty collection                   |
| Very old pending rewards | Still returned if not expired              |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               MODEL                 DATABASE
    │                       │                       │                    │                    │                      │
    │  GET /user/rewards    │                       │                    │                    │                      │
    │──────────────────────▶│                       │                    │                    │                      │
    │                       │                       │                    │                    │                      │
    │                       │ 1. auth:sanctum       │                    │                    │                      │
    │                       │   (validate token)    │                    │                    │                      │
    │                       │──────────────────────▶│                    │                    │                      │
    │                       │                       │                    │                    │                      │
    │                       │                       │ 2. Get user        │                    │                      │
    │                       │                       │    from request    │                    │                      │
    │                       │                       │                    │                    │                      │
    │                       │                       │ 3. getPending      │                    │                      │
    │                       │                       │    Rewards($id)    │                    │                      │
    │                       │                       │───────────────────▶│                    │                      │
    │                       │                       │                    │                    │                      │
    │                       │                       │                    │ 4. getPending      │                      │
    │                       │                       │                    │    ForUser($id)    │                      │
    │                       │                       │                    │───────────────────▶│                      │
    │                       │                       │                    │                    │                      │
    │                       │                       │                    │                    │ 5. SELECT            │
    │                       │                       │                    │                    │    user_rewards      │
    │                       │                       │                    │                    │    WHERE pending     │
    │                       │                       │                    │                    │───────────────────────▶
    │                       │                       │                    │                    │◀───────────────────────
    │                       │                       │                    │                    │                      │
    │                       │                       │                    │                    │ 6. SELECT rewards    │
    │                       │                       │                    │                    │    (eager load)      │
    │                       │                       │                    │                    │───────────────────────▶
    │                       │                       │                    │                    │◀───────────────────────
    │                       │                       │                    │                    │                      │
    │                       │                       │                    │◀───────────────────│                      │
    │                       │                       │◀───────────────────│                    │                      │
    │                       │                       │                    │                    │                      │
    │                       │                       │ 7. Transform via   │                    │                      │
    │                       │                       │    UserRewardResource                   │                      │
    │                       │                       │                    │                    │                      │
    │                       │◀──────────────────────│                    │                    │                      │
    │◀──────────────────────│                       │                    │                    │                      │
    │                       │                       │                    │                    │                      │
    │  200 OK + JSON        │                       │                    │                    │                      │
    │                       │                       │                    │                    │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                               |
| -------------------------- | ------------------------------------------------------ |
| New filter (e.g., by type) | `RewardController::index()` + `RewardService`          |
| Pagination                 | `RewardController::index()` + `UserReward` model query |
| Caching                    | `RewardService::getPendingRewards()`                   |
| New response fields        | `UserRewardResource::toArray()`                        |
| New status type            | `UserRewardStatus` enum + related queries              |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                       | What to Change                        |
| ----- | ---------------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Resources/V1/Progression/UserRewardResource.php` | Add field to `toArray()` return array |
| **2** | `app/Models/Progression/UserReward.php`                    | Add to `$fillable` if database column |
| **3** | Database Migration                                         | Add column to `user_rewards` table    |

#### ➕ ADDING A NEW FIELD TO REWARD NESTED OBJECT

| Step  | File                                                   | What to Change                        |
| ----- | ------------------------------------------------------ | ------------------------------------- |
| **1** | `app/Http/Resources/V1/Progression/RewardResource.php` | Add field to `toArray()` return array |
| **2** | `app/Models/Progression/Reward.php`                    | Add to `$fillable` and `$casts`       |
| **3** | Database Migration                                     | Add column to `rewards` table         |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                       | What to Change                       |
| ----- | ---------------------------------------------------------- | ------------------------------------ |
| **1** | `app/Http/Resources/V1/Progression/UserRewardResource.php` | Remove from `toArray()` return array |
| **2** | Database Migration                                         | Drop column (if safe and unused)     |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────────┐
│   user_rewards  │────▶│   UserReward     │────▶│ UserRewardResource     │
│   (table)       │     │   (Model)        │     │ (API Resource)         │
└─────────────────┘     └──────────────────┘     └────────────────────────┘
         │                       │                          │
         │              ┌────────┴────────┐                 │
         │              │                 │                 │
         ▼              ▼                 ▼                 ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│   rewards       │──│   Reward     │──│   RewardResource         │
│   (table)       │  │   (Model)    │  │   (API Resource)         │
└─────────────────┘  └──────────────┘  └──────────────────────────┘
```

### 📋 Field Modification Checklists

**Before adding a field:**

- [ ] Determine if field belongs in `user_rewards` or `rewards` table
- [ ] Check if field is user-specific or reward-definition-specific
- [ ] Plan appropriate data type and constraints

**After adding a field:**

- [ ] Run migrations
- [ ] Update relevant API resource file
- [ ] Update API documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                              | Reason                                       |
| -------------------------------------- | -------------------------------------------- |
| `UserReward` status enum               | Changes affect claim logic across the system |
| `Reward` relationship to badges/gifts  | Other systems depend on reward_item_id FK    |
| `scopePending()` query logic           | Core filtering used by multiple features     |
| Eager loading in `getPendingForUser()` | Prevents N+1 queries                         |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                           |
| ------------------------------------ | ---------------------------------------------------- |
| Removing `with('reward')` eager load | Causes N+1 queries on large reward lists             |
| Changing `status` column type        | Use enum casting consistently                        |
| Returning expired rewards            | Always use `scopePending()` which filters by PENDING |
| Missing null checks on user          | Controller already handles null user case            |
| Modifying response structure         | Will break mobile/frontend clients                   |

### 📁 File Locations Quick Reference

```
routes/api/rewards.php                                   ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── RewardController.php                               ← Controller
app/Services/Progression/
  └── RewardService.php                                  ← Business logic
app/Models/Progression/
  ├── UserReward.php                                     ← User reward model
  └── Reward.php                                         ← Reward definition model
app/Http/Resources/V1/Progression/
  ├── UserRewardResource.php                             ← User reward transformer
  └── RewardResource.php                                 ← Reward transformer
app/Enums/Progression/
  └── UserRewardStatus.php                               ← Status enum (PENDING/CLAIMED/EXPIRED)
```

---

## Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `GET /api/v1/user/rewards` |
| **Domain**          | Progression                |
| **Author**          | System Documentation       |
| **Created**         | 2026-02-01                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4                        |
