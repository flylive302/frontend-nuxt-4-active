# POST /api/v1/user/rewards/{id}/claim

> **Domain**: User / Progression  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Claims a pending reward for the authenticated user, processing the appropriate reward type (diamonds, coins, badge, or gift) and updating balances accordingly.

### Responsibilities

- Validate that the reward exists and belongs to the user
- Verify the reward is in a claimable state (pending, not expired)
- Process reward based on type (add currency, award badge, or add gift)
- Create transaction record for currency rewards
- Mark the reward as claimed with timestamp
- Emit real-time event for reward claimed

### What It Owns

| Owned                 | Description                                        |
| --------------------- | -------------------------------------------------- |
| Reward Claim Process  | Orchestrates the entire claim workflow             |
| User Balance Mutation | Updates coins/diamonds via CoinDistributionService |
| Transaction Creation  | Creates audit record for currency rewards          |
| Status Transition     | Marks UserReward as claimed                        |

### External Dependencies

| Dependency                | Type           | Purpose                        |
| ------------------------- | -------------- | ------------------------------ |
| `user_rewards` table      | Database       | User's pending/claimed rewards |
| `rewards` table           | Database       | Reward definitions             |
| `transactions` table      | Database       | Transaction audit log          |
| `CoinDistributionService` | Service        | Currency balance mutations     |
| `BadgeService`            | Service        | Badge awarding                 |
| `MSABEventService`        | Service        | Real-time event emission       |
| Redis                     | Infrastructure | Event queuing for MSAB         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/rewards/{id}/claim
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter | Key         | Config           |
| ------- | ----------- | ---------------- |
| Default | `user:{id}` | `config/api.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type      | Constraints            | Example |
| --------- | --------- | ---------------------- | ------- |
| `id`      | `integer` | Required, numeric only | `42`    |

### Request Body

None required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Reward claimed successfully",
  "data": {
    "user_reward_id": 42, // integer, the UserReward record ID
    "reward_id": 5, // integer, the Reward definition ID
    "reward_type": "diamonds", // string, enum: diamonds|coins|badge|gift
    "diamonds_claimed": 100, // integer, only present for diamond rewards
    "coins_claimed": 500.0, // float, only present for coin rewards
    "badge_id": 7, // integer, only present for badge rewards
    "gift_id": 12, // integer, only present for gift rewards
    "message": "Gift added to inventory", // string, only for gift rewards
    "claimed_at": "2026-02-01T14:30:00+00:00" // ISO8601 timestamp
  },
  "meta": {
    "timestamp": "2026-02-01T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "Reward not found",
  "data": null,
  "errors": {
    "code": "REWARD_NOT_FOUND",
    "context": {
      "reward_id": 42
    }
  },
  "meta": {
    "timestamp": "2026-02-01T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Already Claimed (400)

```json
{
  "status": "error",
  "message": "Reward has already been claimed",
  "data": null,
  "errors": {
    "code": "REWARD_ALREADY_CLAIMED",
    "context": {
      "reward_id": 42
    }
  },
  "meta": {
    "timestamp": "2026-02-01T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Expired (410)

```json
{
  "status": "error",
  "message": "Reward has expired",
  "data": null,
  "errors": {
    "code": "REWARD_EXPIRED",
    "context": {
      "reward_id": 42
    }
  },
  "meta": {
    "timestamp": "2026-02-01T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                   |
| ----- | ------------------------------------------- |
| `200` | Reward claimed successfully                 |
| `400` | Reward already claimed or cannot be claimed |
| `401` | User not authenticated                      |
| `404` | Reward not found or doesn't belong to user  |
| `410` | Reward has expired                          |
| `500` | Internal server error                       |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/user/rewards/{id}/claim                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rewards.php:19                                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{id}/claim', [RewardController::class, 'claim'])          │ │
│ │     ->whereNumber('id');                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads User                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/RewardController.php:85       │
│ Method: claim(Request $request, int $id)                                    │
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
│ STEP 2: Delegate to RewardService                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     $result = $this->rewardService->claimReward($id, $userId);          │ │
│ │     return ApiResponse::success($result, 'Reward claimed successfully');│ │
│ │ } catch (\App\Exceptions\DomainException $e) {                          │ │
│ │     return ApiResponse::error($e->getMessage(), $e->getContext(),       │ │
│ │                                $e->getCode());                          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/RewardService.php:55                         │
│ Method: claimReward(int $userRewardId, int $userId): array                  │
│                                                                             │
│ STEP 1: Begin database transaction with row lock                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($userRewardId, $userId) {       │ │
│ │     $userReward = UserReward::where('id', $userRewardId)                │ │
│ │         ->where('user_id', $userId)                                     │ │
│ │         ->with('reward')                                                │ │
│ │         ->lockForUpdate()                                               │ │
│ │         ->first();                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate reward exists and is claimable                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $userReward) {                                                    │ │
│ │     throw RewardException::notFound($userRewardId);                     │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ if (! $userReward->canClaim()) {                                        │ │
│ │     if ($userReward->status === UserRewardStatus::CLAIMED) {            │ │
│ │         throw RewardException::alreadyClaimed($userRewardId);           │ │
│ │     }                                                                   │ │
│ │     if ($userReward->status === UserRewardStatus::EXPIRED) {            │ │
│ │         throw RewardException::expired($userRewardId);                  │ │
│ │     }                                                                   │ │
│ │     throw RewardException::cannotClaim($userRewardId, 'Unknown');       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Process reward based on type (switch statement)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ switch ($reward->reward_type) {                                         │ │
│ │     case RewardItemType::DIAMONDS:                                      │ │
│ │         // Calls CoinDistributionService::addDiamondsToUser()           │ │
│ │         // Creates Transaction record                                   │ │
│ │         break;                                                          │ │
│ │     case RewardItemType::COINS:                                         │ │
│ │         // Calls CoinDistributionService::addToUser()                   │ │
│ │         // Creates Transaction record                                   │ │
│ │         break;                                                          │ │
│ │     case RewardItemType::BADGE:                                         │ │
│ │         // Calls BadgeService::awardBadge()                             │ │
│ │         break;                                                          │ │
│ │     case RewardItemType::GIFT:                                          │ │
│ │         // Adds gift to user inventory                                  │ │
│ │         break;                                                          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Mark reward as claimed                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userReward->claim(); // Sets status=CLAIMED, claimed_at=now()          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Emit MSAB real-time event                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitRewardEarned(                              │ │
│ │     $userId,                                                            │ │
│ │     $userRewardId,                                                      │ │
│ │     $reward->id,                                                        │ │
│ │     $reward->name,                                                      │ │
│ │     $reward->reward_type->value,                                        │ │
│ │     (string) $reward->reward_value,                                     │ │
│ │     $reward->description                                                │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CoinDistributionService (Service)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Economy/CoinDistributionService.php                  │ │
│ │ Responsibility: Canonical service for all coin/diamond balance mutations│ │
│ │ Reusable: YES (used by multiple endpoints)                              │ │
│ │ Why It Exists: Enforces balance invariants (no negative, atomic ops)    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • addToUser($userId, $amount) → adds coins to user                    │ │
│ │   • addDiamondsToUser($userId, $amount) → adds diamonds to user         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeService (Service)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/BadgeService.php                         │ │
│ │ Responsibility: Awards badges to users                                  │ │
│ │ Reusable: YES (used for level-ups, achievements, rewards)               │ │
│ │ Why It Exists: Centralized badge awarding logic                         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • awardBadge($userId, $badgeId, $context, $sourceId) → awards badge   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emits real-time events to MSAB server                   │ │
│ │ Reusable: YES (used by many endpoints)                                  │ │
│ │ Why It Exists: Real-time client updates via Redis pub/sub               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitRewardEarned() → notifies user of claimed reward                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserReward (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/UserReward.php                             │ │
│ │ Responsibility: Represents a user's earned reward record                │ │
│ │ Reusable: YES (core domain model)                                       │ │
│ │ Why It Exists: Tracks reward earning, claiming, and expiry              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canClaim() → checks if reward is claimable                          │ │
│ │   • claim() → marks reward as claimed with timestamp                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RewardException (Exception)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Progression/RewardException.php                    │ │
│ │ Responsibility: Domain-specific exceptions for reward operations        │ │
│ │ Reusable: YES (used across reward endpoints)                            │ │
│ │ Why It Exists: Structured error handling with codes and context         │ │
│ │                                                                         │ │
│ │ Factory Methods:                                                        │ │
│ │   • notFound($id) → 404 REWARD_NOT_FOUND                                │ │
│ │   • alreadyClaimed($id) → 400 REWARD_ALREADY_CLAIMED                    │ │
│ │   • expired($id) → 410 REWARD_EXPIRED                                   │ │
│ │   • cannotClaim($id, $reason) → 400 REWARD_CANNOT_CLAIM                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT (with lock): Fetch UserReward with reward relationship           │
│    Query: SELECT * FROM user_rewards WHERE id = ? AND user_id = ?           │
│           FOR UPDATE (with JOIN to rewards)                                 │
│    Source: RewardService::claimReward()                                     │
│                                                                             │
│ 2. SELECT (with lock): Fetch User for balance update (currency rewards)    │
│    Query: SELECT * FROM users WHERE id = ? FOR UPDATE                       │
│    Source: CoinDistributionService::addDiamondsToUser/addToUser()           │
│                                                                             │
│ 3. UPDATE: Update user balance (coins or diamonds)                          │
│    Query: UPDATE users SET coins/diamonds = ? WHERE id = ?                  │
│    Source: CoinDistributionService                                          │
│                                                                             │
│ 4. INSERT: Create transaction record (currency rewards only)                │
│    Query: INSERT INTO transactions (...)                                    │
│    Source: RewardService::claimReward() switch block                        │
│                                                                             │
│ 5. UPDATE: Mark UserReward as claimed                                       │
│    Query: UPDATE user_rewards SET status = 'claimed', claimed_at = ?        │
│    Source: UserReward::claim()                                              │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ 1. DISPATCH: EmitMSABEvent to "events" queue                                │
│    Payload: reward_earned event with user_id and reward details             │
│    Source: MSABEventService::emitRewardEarned()                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Success response via ApiResponse::success()                          │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Reward claimed successfully',                         │ │
│ │     'data' => $result,  // Array from RewardService                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $correlationId,                             │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Result array varies by reward type:                                         │
│   • DIAMONDS: user_reward_id, reward_id, reward_type, diamonds_claimed      │
│   • COINS: user_reward_id, reward_id, reward_type, coins_claimed            │
│   • BADGE: user_reward_id, reward_id, reward_type, badge_id                 │
│   • GIFT: user_reward_id, reward_id, reward_type, gift_id, message          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         200 + JSON Body                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                          | Used By Endpoints                | Reusable | Reasoning                                |
| ----------------------------- | -------------------------------- | -------- | ---------------------------------------- |
| `RewardController.php`        | All `/user/rewards/*` endpoints  | ⭕       | Controller methods are endpoint-specific |
| `RewardService.php`           | claim, index, history, stats     | ✅       | Central reward business logic            |
| `UserReward.php`              | Multiple reward endpoints        | ✅       | Core domain model                        |
| `Reward.php`                  | All reward-related endpoints     | ✅       | Reward definition model                  |
| `CoinDistributionService.php` | Gifts, purchases, rewards        | ✅       | Canonical balance mutation service       |
| `BadgeService.php`            | Rewards, level-ups, achievements | ✅       | Centralized badge awarding               |
| `MSABEventService.php`        | Many real-time update endpoints  | ✅       | Shared real-time event emission          |
| `Transaction.php`             | All financial operations         | ✅       | Audit logging for economy                |
| `RewardException.php`         | All reward endpoints             | ✅       | Domain-specific error handling           |
| `ApiResponse.php`             | All API endpoints                | ✅       | Standardized response formatting         |
| `UserRewardStatus.php`        | Reward endpoints                 | ✅       | Enum for reward status                   |
| `RewardItemType.php`          | Reward endpoints                 | ✅       | Enum for reward types                    |

---

## 5. Error Handling & Edge Cases

### Business Logic Errors (400)

| Error                    | Source            | Condition                             |
| ------------------------ | ----------------- | ------------------------------------- |
| `REWARD_ALREADY_CLAIMED` | `RewardException` | UserReward.status = 'claimed'         |
| `REWARD_CANNOT_CLAIM`    | `RewardException` | Unknown reason for unclaimable reward |

### Not Found Errors (404)

| Error              | Source            | Condition                                   |
| ------------------ | ----------------- | ------------------------------------------- |
| `REWARD_NOT_FOUND` | `RewardException` | UserReward not found or doesn't belong user |

### Gone Errors (410)

| Error            | Source            | Condition                                        |
| ---------------- | ----------------- | ------------------------------------------------ |
| `REWARD_EXPIRED` | `RewardException` | UserReward.status = 'expired' or past expires_at |

### System Errors (500)

| Error                     | Source           | Condition                    |
| ------------------------- | ---------------- | ---------------------------- |
| Database connection error | Database driver  | MySQL unavailable            |
| Redis connection error    | MSABEventService | Redis unavailable for events |
| Transaction deadlock      | DB::transaction  | Concurrent claim attempts    |

### Edge Cases

| Case                                 | Behavior                                         |
| ------------------------------------ | ------------------------------------------------ |
| User tries to claim another's reward | Returns 404 (user_id filter in query)            |
| Reward expires during claim          | `canClaim()` returns false, throws expired error |
| Concurrent claim attempts            | `lockForUpdate()` serializes, second gets 400    |
| Badge reward with null item_id       | Badge not awarded, still marked claimed          |
| Gift reward type                     | Returns gift_id with message, no balance change  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER             REWARDSERVICE           COINDISTSERVICE          DATABASE
   │                       │                       │                       │                       │                      │
   │  POST /rewards/42/claim│                       │                       │                       │                      │
   │──────────────────────▶│                       │                       │                       │                      │
   │                       │                       │                       │                       │                      │
   │                       │ 1. auth:sanctum       │                       │                       │                      │
   │                       │ Validate token        │                       │                       │                      │
   │                       │──────────────────────▶│                       │                       │                      │
   │                       │                       │                       │                       │                      │
   │                       │                       │ 2. $request->user()   │                       │                      │
   │                       │                       │──────────────────────▶│                       │                      │
   │                       │                       │                       │                       │                      │
   │                       │                       │ 3. claimReward($id)   │                       │                      │
   │                       │                       │──────────────────────▶│                       │                      │
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 4. BEGIN TRANSACTION  │                      │
   │                       │                       │                       │─────────────────────────────────────────────▶│
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 5. SELECT user_rewards FOR UPDATE            │
   │                       │                       │                       │─────────────────────────────────────────────▶│
   │                       │                       │                       │◀─────────────────────────────────────────────│
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 6. Validate canClaim()│                      │
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 7. addDiamondsToUser()│                      │
   │                       │                       │                       │──────────────────────▶│                      │
   │                       │                       │                       │                       │ 8. SELECT users FOR UPDATE
   │                       │                       │                       │                       │─────────────────────▶│
   │                       │                       │                       │                       │◀─────────────────────│
   │                       │                       │                       │                       │ 9. UPDATE users      │
   │                       │                       │                       │                       │─────────────────────▶│
   │                       │                       │                       │◀──────────────────────│                      │
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 10. INSERT transactions                      │
   │                       │                       │                       │─────────────────────────────────────────────▶│
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 11. UserReward::claim()                      │
   │                       │                       │                       │──────────────────────────────────────────────│
   │                       │                       │                       │ UPDATE user_rewards (status='claimed')       │
   │                       │                       │                       │─────────────────────────────────────────────▶│
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 12. COMMIT TRANSACTION│                      │
   │                       │                       │                       │─────────────────────────────────────────────▶│
   │                       │                       │                       │                       │                      │
   │                       │                       │                       │ 13. emitRewardEarned()│                      │
   │                       │                       │                       │──────────▶MSAB Queue  │                      │
   │                       │                       │                       │                       │                      │
   │                       │                       │◀──────────────────────│                       │                      │
   │                       │                       │                       │                       │                      │
   │                       │◀──────────────────────│                       │                       │                      │
   │◀──────────────────────│                       │                       │                       │                      │
   │                       │                       │                       │                       │                      │
   │  200 + JSON (result)  │                       │                       │                       │                      │
   │                       │                       │                       │                       │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| New reward type        | `RewardItemType.php` enum + switch in `RewardService::claimReward()` |
| Post-claim hook        | After `$userReward->claim()` in `RewardService`                      |
| New validation rule    | In `RewardService::claimReward()` validation block                   |
| Custom exception       | Extend `RewardException` with new factory method                     |
| Additional result data | In switch cases of `RewardService::claimReward()`                    |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REWARD TYPE

| Step  | File                                         | What to Change                            |
| ----- | -------------------------------------------- | ----------------------------------------- |
| **1** | `app/Enums/Progression/RewardItemType.php`   | Add new case (e.g., `FRAME = 'frame'`)    |
| **2** | `app/Services/Progression/RewardService.php` | Add new case in switch block              |
| **3** | `app/Models/Progression/Reward.php`          | Add helper method (e.g., `grantsFrame()`) |
| **4** | Database migration                           | Add reward_data JSON column if needed     |

#### ➕ ADDING RESPONSE FIELD

| Step  | File                                         | What to Change                             |
| ----- | -------------------------------------------- | ------------------------------------------ |
| **1** | `app/Services/Progression/RewardService.php` | Add to `$result` array in appropriate case |

#### ➖ REMOVING A REWARD TYPE

| Step  | File                                         | What to Change                               |
| ----- | -------------------------------------------- | -------------------------------------------- |
| **1** | Verify no active rewards use the type        | Query `rewards` table                        |
| **2** | `app/Services/Progression/RewardService.php` | Remove switch case                           |
| **3** | `app/Enums/Progression/RewardItemType.php`   | Remove case (may cause issues if still used) |

### 🔗 Field Flow Dependency Chain

```
URL {id} Parameter
       │
       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ RewardController│────▶│  RewardService  │────▶│   UserReward    │
│ $id parameter   │     │ $userRewardId   │     │ ->canClaim()    │
└─────────────────┘     └─────────────────┘     │ ->claim()       │
                               │                 └─────────────────┘
                               │                         │
                               ▼                         ▼
                     ┌─────────────────┐        ┌─────────────────┐
                     │ CoinDist/Badge  │        │  $result array  │
                     │ Service calls   │        │  returned       │
                     └─────────────────┘        └─────────────────┘
                               │
                               ▼
                     ┌─────────────────┐
                     │   Transaction   │
                     │   record        │
                     └─────────────────┘
```

### 📋 Field Modification Checklist

- [ ] Update `RewardItemType` enum if adding type
- [ ] Update switch statement in `claimReward()`
- [ ] Update result array construction
- [ ] Test all reward types
- [ ] Verify transaction records are created correctly
- [ ] Test concurrent claim prevention

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                               |
| --------------------------- | ---------------------------------------------------- |
| `DB::transaction()` wrapper | Ensures atomicity of claim + balance update          |
| `lockForUpdate()` call      | Prevents race conditions on concurrent claims        |
| `CoinDistributionService`   | Central balance mutation service, has invariants     |
| Status checks before claim  | Security: prevents double-claim exploitation         |
| `user_id` filter in query   | Security: ensures users only claim their own rewards |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                           |
| ----------------------------------------- | ---------------------------------------------------- |
| Removing `lockForUpdate()`                | Will cause race conditions on concurrent claims      |
| Bypassing `canClaim()` check              | Could allow claiming expired/already-claimed rewards |
| Not wrapping in transaction               | Partial claim could leave inconsistent state         |
| Modifying balance outside CoinDistService | Violates balance invariants contract                 |
| Forgetting to call `$userReward->claim()` | Reward stays pending, can be claimed again           |
| Removing user_id from query               | Security vulnerability: claim any user's reward      |

### 📁 File Locations Quick Reference

```
routes/api/rewards.php                              ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── RewardController.php                          ← Controller (claim method)
app/Services/Progression/
  └── RewardService.php                             ← Business logic
app/Services/Economy/
  └── CoinDistributionService.php                   ← Balance mutations
app/Services/Gift/
  └── MSABEventService.php                          ← Real-time events
app/Models/Progression/
  ├── UserReward.php                                ← User reward record
  └── Reward.php                                    ← Reward definition
app/Models/Economy/
  └── Transaction.php                               ← Transaction record
app/Enums/Progression/
  ├── UserRewardStatus.php                          ← Status enum
  └── RewardItemType.php                            ← Reward type enum
app/Exceptions/Progression/
  └── RewardException.php                           ← Domain exceptions
app/Http/Utils/
  └── ApiResponse.php                               ← Response formatting
```

---

## Document Metadata

| Property            | Value                                  |
| ------------------- | -------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/rewards/{id}/claim` |
| **Domain**          | User / Progression                     |
| **Author**          | System Documentation                   |
| **Created**         | 2026-02-01                             |
| **Laravel Version** | 12.x                                   |
| **PHP Version**     | 8.4                                    |
