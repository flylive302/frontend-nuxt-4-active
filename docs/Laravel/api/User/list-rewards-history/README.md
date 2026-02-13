# GET /api/v1/user/rewards/history

> **Domain**: User Rewards  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

The rewards history endpoint retrieves a paginated list of all rewards (pending, claimed, and expired) for the authenticated user, ordered by most recent first.

### Responsibilities

- Authenticate user via Sanctum middleware
- Retrieve all user rewards with reward definitions
- Apply limit parameter (max 100)
- Transform rewards into standardized API response

### What It Owns

| Owned            | Description                                 |
| ---------------- | ------------------------------------------- |
| Reward retrieval | Fetches user's complete reward history      |
| Response shaping | Transforms reward data via resource classes |

### External Dependencies

| Dependency | Type           | Purpose                    |
| ---------- | -------------- | -------------------------- |
| Database   | Infrastructure | User reward data retrieval |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/rewards/history
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key          | Config     |
| ------- | ------------ | ---------- |
| Default | User ID / IP | 60 req/min |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter | Type    | Constraints | Default | Example     |
| --------- | ------- | ----------- | ------- | ----------- |
| `limit`   | integer | 1-100       | 50      | `?limit=25` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": 123, // integer, user_reward ID
      "reward": {
        "id": 456, // integer, reward definition ID
        "type": "level_up", // string, reward type enum
        "type_label": "Level Up", // string, human-readable type
        "name": "Level 5 Reward", // string, reward name
        "description": "Congratulations on reaching level 5!", // string|null
        "reward_type": "diamonds", // string, item type enum
        "reward_type_label": "Diamonds", // string, human-readable item type
        "reward_value": 100.0, // float|null, quantity
        "reward_item_id": null, // integer|null, for badge/gift rewards
        "level": 5, // integer|null
        "required_value": 1000.0, // float, XP/coins required
        "icon_url": "https://cdn.example.com/icon.png", // string|null
        "is_one_time": true // boolean
      },
      "status": "pending", // string: pending|claimed|expired
      "status_label": "Pending", // string, human-readable status
      "status_color": "#FFA500", // string, UI color hint
      "source_type": "level_up", // string, what triggered reward
      "source_id": 5, // integer|null, reference ID
      "earned_at": "2026-02-01T10:00:00+00:00", // ISO 8601 timestamp
      "claimed_at": null, // ISO 8601 timestamp|null
      "expires_at": "2026-03-01T10:00:00+00:00", // ISO 8601 timestamp|null
      "can_claim": true // boolean
    }
  ]
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                      |
| ----- | ------------------------------ |
| `200` | Rewards retrieved successfully |
| `401` | Missing or invalid auth token  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/rewards/history                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rewards.php:17                                             │
│ Route: Route::get('/history', [RewardController::class, 'history'])         │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, resolves authenticated user   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No Form Request class - uses base Illuminate\Http\Request                   │
│ Query parameter 'limit' accessed directly in controller                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/RewardController.php          │
│ Method: history(Request $request)                                           │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return UserRewardResource::collection([]);                          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Parse and validate limit parameter                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $limit = min((int) ($request->query('limit', 50)), 100);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Delegate to service layer                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $rewards = $this->rewardService->getAllRewards($userId, $limit);        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/RewardService.php                            │
│ Method: getAllRewards(int $userId, int $limit = 100)                        │
│                                                                             │
│ STEP 1: Build query using Eloquent scopes                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return UserReward::forUser($userId)                                     │ │
│ │     ->with('reward')                                                    │ │
│ │     ->orderBy('earned_at', 'desc')                                      │ │
│ │     ->limit($limit)                                                     │ │
│ │     ->get();                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Features:                                                               │
│   • Uses forUser() scope for filtering                                      │
│   • Eager loads 'reward' relationship to prevent N+1                        │
│   • Orders by earned_at descending (newest first)                           │
│   • Applies limit constraint                                                │
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
│ │ Responsibility: Represents user's earned reward instances               │ │
│ │ Reusable: YES (used by pending, history, stats endpoints)               │ │
│ │                                                                         │ │
│ │ Key Scopes:                                                             │ │
│ │   • forUser(int $userId) → filters by user_id                           │ │
│ │   • pending() → filters pending status                                  │ │
│ │   • claimed() → filters claimed status                                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canClaim() → checks if reward is claimable                          │ │
│ │   • reward() → BelongsTo relationship to Reward model                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Reward (Model)                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/Reward.php                                 │ │
│ │ Responsibility: Reward definitions (type, value, requirements)          │ │
│ │ Reusable: YES (used across all reward-related endpoints)                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserRewardStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/UserRewardStatus.php                        │ │
│ │ Values: PENDING, CLAIMED, EXPIRED                                       │ │
│ │ Provides: label(), color(), canClaim()                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT user_rewards with related rewards                                 │
│    Query pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM user_rewards                                          │  │
│    │ WHERE user_id = ?                                                   │  │
│    │ ORDER BY earned_at DESC                                             │  │
│    │ LIMIT ?                                                             │  │
│    │                                                                     │  │
│    │ SELECT * FROM rewards WHERE id IN (...)                             │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: RewardService::getAllRewards()                                   │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Progression/UserRewardResource.php              │
│                                                                             │
│ The controller returns: UserRewardResource::collection($rewards)            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'reward' => new RewardResource($this->whenLoaded('reward')),        │ │
│ │     'status' => $this->status->value,                                   │ │
│ │     'status_label' => $this->status->label(),                           │ │
│ │     'status_color' => $this->status->color(),                           │ │
│ │     'source_type' => $this->source_type,                                │ │
│ │     'source_id' => $this->source_id,                                    │ │
│ │     'earned_at' => $this->earned_at->toIso8601String(),                 │ │
│ │     'claimed_at' => $this->claimed_at?->toIso8601String(),              │ │
│ │     'expires_at' => $this->expires_at?->toIso8601String(),              │ │
│ │     'can_claim' => $this->canClaim(),                                   │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Nested RewardResource transforms reward definition fields                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 + JSON (data array)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                     | Used By Endpoints                         | Reusable | Reasoning                               |
| ------------------------ | ----------------------------------------- | -------- | --------------------------------------- |
| `RewardController.php`   | rewards, history, stats, claim            | ⭕       | Methods endpoint-specific, class shared |
| `RewardService.php`      | rewards, history, stats, claim            | ✅       | All reward operations centralized       |
| `UserReward.php`         | Multiple progression endpoints            | ✅       | Model with reusable scopes              |
| `Reward.php`             | All reward endpoints, badge/level systems | ✅       | Core reward definition model            |
| `UserRewardResource.php` | rewards, history                          | ✅       | Shared response transformer             |
| `RewardResource.php`     | rewards, history, stats                   | ✅       | Nested in UserRewardResource            |
| `UserRewardStatus.php`   | All reward endpoints                      | ✅       | Status enum with UI helpers             |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

None - This endpoint has no validation rules. The `limit` parameter is sanitized in controller.

### Business Logic Errors (400)

None - This is a read-only endpoint with no business logic constraints.

### System Errors (500)

| Error            | Source          | Condition                  |
| ---------------- | --------------- | -------------------------- |
| Database failure | `RewardService` | Database connection issues |

### Edge Cases

| Case                   | Behavior                                    |
| ---------------------- | ------------------------------------------- |
| No rewards exist       | Returns empty `data: []` array              |
| User not authenticated | Returns 401 Unauthenticated                 |
| Limit exceeds 100      | Capped to 100 automatically                 |
| Limit is 0 or negative | Cast to int, min(0, 100) = 0, returns empty |
| Non-numeric limit      | Cast to int (0), returns empty results      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER           SERVICE              DATABASE
   │                     │                       │                    │                    │
   │  GET /history       │                       │                    │                    │
   │  + Bearer token     │                       │                    │                    │
   │────────────────────▶│                       │                    │                    │
   │                     │                       │                    │                    │
   │                     │ 1. auth:sanctum       │                    │                    │
   │                     │    validate token     │                    │                    │
   │                     │    resolve user       │                    │                    │
   │                     │──────────────────────▶│                    │                    │
   │                     │                       │                    │                    │
   │                     │                       │ 2. Get user        │                    │
   │                     │                       │    Parse limit     │                    │
   │                     │                       │                    │                    │
   │                     │                       │ 3. getAllRewards() │                    │
   │                     │                       │───────────────────▶│                    │
   │                     │                       │                    │                    │
   │                     │                       │                    │ 4. Query          │
   │                     │                       │                    │    user_rewards   │
   │                     │                       │                    │    + rewards      │
   │                     │                       │                    │───────────────────▶│
   │                     │                       │                    │◀───────────────────│
   │                     │                       │                    │                    │
   │                     │                       │◀───────────────────│                    │
   │                     │                       │    Collection      │                    │
   │                     │                       │                    │                    │
   │                     │                       │ 5. Transform via   │                    │
   │                     │                       │    UserReward      │                    │
   │                     │                       │    Resource        │                    │
   │                     │                       │                    │                    │
   │                     │◀──────────────────────│                    │                    │
   │◀────────────────────│                       │                    │                    │
   │                     │                       │                    │                    │
   │  200 + JSON data    │                       │                    │                    │
   │                     │                       │                    │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition           | Location                                 |
| ------------------ | ---------------------------------------- |
| New query filter   | `RewardController::history()` method     |
| New status type    | `UserRewardStatus` enum                  |
| New response field | `UserRewardResource` or `RewardResource` |
| Pagination support | `RewardController` + `RewardService`     |
| Caching            | `RewardService::getAllRewards()`         |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                       | What to Change                     |
| ----- | ---------------------------------------------------------- | ---------------------------------- |
| **1** | Database Migration                                         | Add column to `user_rewards` table |
| **2** | `app/Models/Progression/UserReward.php`                    | Add to `$fillable` and `$casts`    |
| **3** | `app/Http/Resources/V1/Progression/UserRewardResource.php` | Add field to `toArray()` output    |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                       | What to Change                 |
| ----- | ---------------------------------------------------------- | ------------------------------ |
| **1** | `app/Http/Resources/V1/Progression/UserRewardResource.php` | Remove from `toArray()` output |
| **2** | Document as deprecated first, remove in v2                 |                                |

### 🔗 Field Flow Dependency Chain

```
user_rewards table
       │
       ▼
UserReward (Model)
       │
       ├──── status (UserRewardStatus enum)
       │            │
       │            └──► value, label(), color()
       │
       └──── reward (Reward model)
                    │
                    └──► RewardResource
       │
       ▼
UserRewardResource
       │
       ▼
JSON Response
```

### ⚠️ What Should NOT Be Modified Casually

| Component            | Reason                                               |
| -------------------- | ---------------------------------------------------- |
| `UserRewardStatus`   | Status values used in database, changing breaks data |
| `forUser()` scope    | Ensures user isolation, security critical            |
| `earned_at` ordering | Frontend expects newest-first order                  |
| `with('reward')`     | Removing causes N+1 query performance issue          |

### 🚨 Common Pitfalls

| Pitfall                        | Prevention                                      |
| ------------------------------ | ----------------------------------------------- |
| Removing eager loading         | Always check query count in development         |
| Adding filter without index    | Add database index for new filter columns       |
| Exposing sensitive reward data | Review RewardResource before adding fields      |
| Breaking status enum values    | Use migrations for data if changing enum values |

### 📁 File Locations Quick Reference

```
routes/api/rewards.php                                    ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── RewardController.php                                ← Controller
app/Services/Progression/
  └── RewardService.php                                   ← Business logic
app/Models/Progression/
  ├── UserReward.php                                      ← User reward instance
  └── Reward.php                                          ← Reward definition
app/Http/Resources/V1/Progression/
  ├── UserRewardResource.php                              ← Response transformer
  └── RewardResource.php                                  ← Nested reward data
app/Enums/Progression/
  └── UserRewardStatus.php                                ← Status enum
```

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `GET /api/v1/user/rewards/history` |
| **Domain**          | User Rewards                       |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-01                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4                                |
