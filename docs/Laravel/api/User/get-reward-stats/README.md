# GET /api/v1/user/rewards/stats

> **Domain**: User / Progression  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

The reward statistics endpoint retrieves aggregated statistics about a user's rewards, including counts of pending and claimed rewards, plus totals of diamonds and coins claimed.

### Responsibilities

- Authenticate user via Sanctum token
- Retrieve reward statistics from database using efficient aggregation
- Return structured JSON response with counts and totals

### What It Owns

| Owned              | Description                                   |
| ------------------ | --------------------------------------------- |
| Statistics queries | Aggregates reward data for authenticated user |
| Response format    | Structures stats in consistent JSON format    |

### External Dependencies

| Dependency | Type           | Purpose                |
| ---------- | -------------- | ---------------------- |
| MySQL      | Database       | Source of reward data  |
| Sanctum    | Authentication | Validates bearer token |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/rewards/stats
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter  | Key       | Config               |
| -------- | --------- | -------------------- |
| Standard | `user_id` | `config/sanctum.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
No request body required (GET endpoint)
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Reward statistics retrieved",
  "data": {
    "pending_count": 3, // integer - Rewards awaiting claim
    "claimed_count": 25, // integer - Rewards already claimed
    "total_count": 28, // integer - Sum of pending + claimed
    "total_diamonds_claimed": 500, // integer - Total diamond value claimed
    "total_coins_claimed": 1250.5 // float - Total coin value claimed
  },
  "meta": {
    "timestamp": "2026-02-01T19:21:19.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T19:21:19.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                     |
| ----- | ----------------------------- |
| `200` | Statistics retrieved          |
| `401` | Missing or invalid auth token |
| `500` | Database or server error      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/rewards/stats                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rewards.php:18                                             │
│ Route: Route::get('/stats', [RewardController::class, 'stats'])             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, attaches User to request        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->prefix('user/rewards')->group(...)   │ │
│ │     Route::get('/stats', [RewardController::class, 'stats']);           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Sanctum Authentication Middleware                                           │
│                                                                             │
│ • Extracts Bearer token from Authorization header                           │
│ • Validates token against personal_access_tokens table                      │
│ • Attaches authenticated User model to request                              │
│ • Returns 401 if token invalid or missing                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/RewardController.php          │
│ Method: stats(Request $request): JsonResponse                               │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call service for statistics                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userId = $user->id;                                                    │ │
│ │ $stats = $this->rewardService->getRewardStats($userId);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return JSON response                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($stats, 'Reward statistics retrieved');    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/RewardService.php                            │
│ Method: getRewardStats(int $userId): array                                  │
│                                                                             │
│ SINGLE OPTIMIZED QUERY:                                                     │
│ Uses conditional aggregates to retrieve all statistics in one query:       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $stats = UserReward::query()                                            │ │
│ │     ->where('user_id', $userId)                                         │ │
│ │     ->join('rewards', 'user_rewards.reward_id', '=', 'rewards.id')      │ │
│ │     ->selectRaw('                                                       │ │
│ │         COUNT(CASE WHEN status = "pending" THEN 1 END) as pending,      │ │
│ │         COUNT(CASE WHEN status = "claimed" THEN 1 END) as claimed,      │ │
│ │         COALESCE(SUM(CASE WHEN status = "claimed"                       │ │
│ │             AND reward_type = "diamonds"                                │ │
│ │             THEN reward_value END), 0) as total_diamonds,               │ │
│ │         COALESCE(SUM(CASE WHEN status = "claimed"                       │ │
│ │             AND reward_type = "coins"                                   │ │
│ │             THEN reward_value END), 0) as total_coins                   │ │
│ │     ')                                                                  │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ RESPONSE STRUCTURE BUILT:                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'pending_count' => (int) $stats->pending_count,                     │ │
│ │     'claimed_count' => (int) $stats->claimed_count,                     │ │
│ │     'total_count' => $pending + $claimed,                               │ │
│ │     'total_diamonds_claimed' => (int) $stats->total_diamonds,           │ │
│ │     'total_coins_claimed' => (float) $stats->total_coins,               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ApiResponse (Utility Class)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Constructs standardized JSON responses                  │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Ensures consistent API response format                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 response with data                   │ │
│ │   • unauthorized($message)   → 401 response                             │ │
│ │   • getCorrelationId()       → Extracts/generates request ID            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserRewardStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/UserRewardStatus.php                        │ │
│ │ Responsibility: Defines reward status constants                         │ │
│ │ Reusable: YES (used across Progression domain)                          │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PENDING  = 'pending'                                                │ │
│ │   • CLAIMED  = 'claimed'                                                │ │
│ │   • EXPIRED  = 'expired'                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RewardItemType (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/RewardItemType.php                          │ │
│ │ Responsibility: Defines reward types for aggregation                    │ │
│ │ Reusable: YES (used across Progression domain)                          │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • DIAMONDS = 'diamonds'                                               │ │
│ │   • COINS    = 'coins'                                                  │ │
│ │   • BADGE    = 'badge'                                                  │ │
│ │   • GIFT     = 'gift'                                                   │ │
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
│ 1. SELECT (Aggregation): Get reward statistics                              │
│    Query:                                                                   │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ SELECT                                                            │    │
│    │   COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,│    │
│    │   COUNT(CASE WHEN status = 'claimed' THEN 1 END) as claimed_count,│    │
│    │   COALESCE(SUM(CASE WHEN status = 'claimed'                       │    │
│    │       AND reward_type = 'diamonds'                                │    │
│    │       THEN reward_value END), 0) as total_diamonds,               │    │
│    │   COALESCE(SUM(CASE WHEN status = 'claimed'                       │    │
│    │       AND reward_type = 'coins'                                   │    │
│    │       THEN reward_value END), 0) as total_coins                   │    │
│    │ FROM user_rewards                                                 │    │
│    │ INNER JOIN rewards ON user_rewards.reward_id = rewards.id         │    │
│    │ WHERE user_id = ?                                                 │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│    Source: RewardService::getRewardStats()                                  │
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
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ The ApiResponse::success() method wraps the raw array from RewardService:   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Reward statistics retrieved',                         │ │
│ │     'data' => [                                                         │ │
│ │         'pending_count' => 3,                                           │ │
│ │         'claimed_count' => 25,                                          │ │
│ │         'total_count' => 28,                                            │ │
│ │         'total_diamonds_claimed' => 500,                                │ │
│ │         'total_coins_claimed' => 1250.50,                               │ │
│ │     ],                                                                  │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => '2026-02-01T19:21:19.000000Z',                   │ │
│ │         'correlation_id' => 'uuid-from-header-or-generated',            │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                   | Used By Endpoints                     | Reusable | Reasoning                             |
| ---------------------- | ------------------------------------- | -------- | ------------------------------------- |
| `RewardController.php` | `/user/rewards/*` endpoints           | ⭕       | Methods reusable within reward domain |
| `RewardService.php`    | All reward endpoints, jobs, listeners | ✅       | Core reward logic, highly reusable    |
| `ApiResponse.php`      | All API endpoints                     | ✅       | Application-wide response formatter   |
| `UserReward.php`       | Reward CRUD, stats, claims            | ✅       | Core model for reward tracking        |
| `UserRewardStatus.php` | All reward-related code               | ✅       | Enum for status values                |
| `RewardItemType.php`   | Reward creation, claims, stats        | ✅       | Enum for reward type classification   |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                 |
| ----- | ------ | ----------------------------------------- |
| N/A   | N/A    | No request body validation (GET endpoint) |

### Business Logic Errors (400)

| Error | Source | Condition                                    |
| ----- | ------ | -------------------------------------------- |
| N/A   | N/A    | No business logic errors for stats retrieval |

### Authentication Errors (401)

| Error             | Source             | Condition                     |
| ----------------- | ------------------ | ----------------------------- |
| "Unauthorized"    | `RewardController` | User is null after auth check |
| "Unauthenticated" | Sanctum Middleware | Missing/invalid Bearer token  |

### System Errors (500)

| Error                   | Source          | Condition             |
| ----------------------- | --------------- | --------------------- |
| "Database error"        | `RewardService` | DB connection failure |
| "Internal server error" | Laravel Handler | Unhandled exception   |

### Edge Cases

| Case                          | Behavior                                               |
| ----------------------------- | ------------------------------------------------------ |
| User has no rewards           | Returns all zeros for counts and totals                |
| User has only expired rewards | Expired rewards are not counted (only pending/claimed) |
| Large reward history          | Single query handles any size efficiently              |
| Float precision for coins     | Coins returned as float with decimal precision         |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                SANCTUM AUTH              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                        │                       │                        │
   │  GET /user/rewards/stats                       │                       │                        │
   │  Authorization: Bearer {token}                 │                       │                        │
   │──────────────────────▶│                        │                       │                        │
   │                       │                        │                       │                        │
   │                       │ 1. Validate token      │                       │                        │
   │                       │────────────────────────────────────────────────────────────────────────▶│
   │                       │◀────────────────────────────────────────────────────────────────────────│
   │                       │    (token valid, user attached)               │                        │
   │                       │                        │                       │                        │
   │                       │ 2. Pass to controller  │                       │                        │
   │                       │───────────────────────▶│                       │                        │
   │                       │                        │                       │                        │
   │                       │                        │ 3. getRewardStats()   │                        │
   │                       │                        │──────────────────────▶│                        │
   │                       │                        │                       │                        │
   │                       │                        │                       │ 4. SELECT aggregates   │
   │                       │                        │                       │───────────────────────▶│
   │                       │                        │                       │◀───────────────────────│
   │                       │                        │                       │    (stats object)      │
   │                       │                        │                       │                        │
   │                       │                        │◀──────────────────────│                        │
   │                       │                        │    (stats array)      │                        │
   │                       │                        │                       │                        │
   │                       │ 5. ApiResponse::success()                      │                        │
   │                       │◀───────────────────────│                       │                        │
   │◀──────────────────────│                        │                       │                        │
   │                       │                        │                       │                        │
   │  200 OK + JSON        │                        │                       │                        │
   │                       │                        │                       │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                            |
| -------------------------- | ----------------------------------- |
| New statistic field        | `RewardService::getRewardStats()`   |
| Cache layer for stats      | `RewardService::getRewardStats()`   |
| Different time-range stats | Add method to `RewardService`       |
| Rate limiting              | `routes/api/rewards.php` middleware |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW STATISTIC FIELD

| Step  | File                                         | What to Change                         |
| ----- | -------------------------------------------- | -------------------------------------- |
| **1** | `app/Services/Progression/RewardService.php` | Add to selectRaw() in getRewardStats() |
| **2** | `app/Services/Progression/RewardService.php` | Add to return array                    |
| **3** | API Documentation                            | Update response schema                 |

**Example: Adding `expired_count`:**

```php
// In RewardService::getRewardStats()
->selectRaw('
    COUNT(CASE WHEN user_rewards.status = ? THEN 1 END) as pending_count,
    COUNT(CASE WHEN user_rewards.status = ? THEN 1 END) as claimed_count,
    COUNT(CASE WHEN user_rewards.status = ? THEN 1 END) as expired_count,  // NEW
    // ... rest of selects
', [
    UserRewardStatus::PENDING->value,
    UserRewardStatus::CLAIMED->value,
    UserRewardStatus::EXPIRED->value,  // NEW binding
    // ... rest
])

// In return array
return [
    'pending_count' => (int) ($stats->pending_count ?? 0),
    'claimed_count' => (int) ($stats->claimed_count ?? 0),
    'expired_count' => (int) ($stats->expired_count ?? 0),  // NEW
    // ...
];
```

#### ➖ REMOVING A STATISTIC FIELD

| Step  | File                                         | What to Change           |
| ----- | -------------------------------------------- | ------------------------ |
| **1** | `app/Services/Progression/RewardService.php` | Remove from selectRaw()  |
| **2** | `app/Services/Progression/RewardService.php` | Remove from return array |
| **3** | API Documentation                            | Update response schema   |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        STATS RESPONSE FIELD FLOW                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATABASE TABLES                                                             │
│  ┌─────────────────────┐     ┌─────────────────────┐                         │
│  │    user_rewards     │     │      rewards        │                         │
│  ├─────────────────────┤     ├─────────────────────┤                         │
│  │ - user_id           │────▶│ - id                │                         │
│  │ - reward_id         │     │ - reward_type       │                         │
│  │ - status (enum)     │     │ - reward_value      │                         │
│  └─────────────────────┘     └─────────────────────┘                         │
│           │                           │                                      │
│           └────────────┬──────────────┘                                      │
│                        ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ RewardService::getRewardStats()                                         │ │
│  │   - JOIN tables                                                         │ │
│  │   - Conditional COUNT for pending/claimed                               │ │
│  │   - Conditional SUM for diamonds/coins by reward_type                   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                        │                                                     │
│                        ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Return Array → ApiResponse::success() → JSON Response                   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                | Reason                                               |
| ------------------------ | ---------------------------------------------------- |
| `ApiResponse::success()` | Used by all API endpoints; changes affect entire app |
| `UserRewardStatus` enum  | Database stores these values; changing breaks data   |
| `RewardItemType` enum    | Used in aggregation queries; changes break stats     |
| JOIN in getRewardStats() | Must match foreign key relationship                  |

### 🚨 Common Pitfalls

| Pitfall                      | Prevention                                           |
| ---------------------------- | ---------------------------------------------------- |
| Adding N+1 queries for stats | Keep single query with conditional aggregates        |
| Breaking enum value strings  | Never change enum backing values (`'pending'`, etc.) |
| Forgetting COALESCE for SUM  | Always use COALESCE to handle NULL sums              |
| Type casting issues          | Cast pending/claimed to int, coins to float          |
| Missing parameter bindings   | Count parameters must match selectRaw placeholders   |

### 📁 File Locations Quick Reference

```
routes/api/rewards.php                                  ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── RewardController.php                              ← Controller (stats method)
app/Services/Progression/
  └── RewardService.php                                 ← Service (getRewardStats)
app/Http/Utils/
  └── ApiResponse.php                                   ← Response formatter
app/Models/Progression/
  └── UserReward.php                                    ← Model used in query
app/Enums/Progression/
  ├── UserRewardStatus.php                              ← Status enum
  └── RewardItemType.php                                ← Reward type enum
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `GET /api/v1/user/rewards/stats` |
| **Domain**          | User / Progression               |
| **Author**          | System Documentation             |
| **Created**         | 2026-02-01                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4                              |
