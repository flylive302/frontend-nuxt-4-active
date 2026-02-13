# POST /api/v1/users/{user}/follow

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Follow another user, establishing a follower-following relationship with real-time notifications.

### Responsibilities

- Validate follower cannot follow themselves
- Prevent duplicate follow relationships
- Atomically increment follower/following counts
- Emit real-time MSAB event to target user
- Create database notification for persistence

### What It Owns

| Owned                | Description                                      |
| -------------------- | ------------------------------------------------ |
| Follow relationship  | Creates `user_follows` record                    |
| Follower counts      | Increments `followers_count` / `following_count` |
| Follow notifications | Creates database notification + MSAB event       |

### External Dependencies

| Dependency | Type           | Purpose                           |
| ---------- | -------------- | --------------------------------- |
| Redis      | Infrastructure | Atomic locking for race condition |
| MSAB       | Real-time      | Emit `user.followed` event        |
| PostgreSQL | Database       | Store follow relationship         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/users/{user}/follow
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter          | Key          | Config      | Applies To      |
| ---------------- | ------------ | ----------- | --------------- |
| `throttle:30,1`  | `user_id:ip` | 30 req/min  | Writes (follow) |
| `throttle:120,1` | `user_id:ip` | 120 req/min | Reads (lists)   |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description          |
| --------- | --------- | -------------------- |
| `user`    | `integer` | ID of user to follow |

### Request Body Schema

```json
{}
```

_No request body required_

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Successfully followed user.",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "signature": "abc123",
      "avatar": "https://...",
      "gender": 1,
      "email": "john@example.com",
      "phone": "+1234567890",
      "country": "US",
      "date_of_birth": "1990-01-15",
      "wealth_xp": "1000",
      "charm_xp": "500"
    },
    "followed_at": "2026-02-03T15:20:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Self-Follow Error (403)

```json
{
  "status": "error",
  "message": "You cannot follow yourself.",
  "data": null,
  "errors": {
    "user": ["Self-following is not allowed."]
  }
}
```

#### ❌ Already Following (409)

```json
{
  "status": "error",
  "message": "You are already following this user.",
  "data": null,
  "errors": {
    "user": ["Already following."]
  }
}
```

#### ❌ User Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\User\\User]",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                 | Error Code          |
| ----- | ------------------------- | ------------------- |
| `201` | Successfully followed     | —                   |
| `401` | Unauthenticated           | —                   |
| `403` | Cannot follow self        | `SELF_FOLLOW`       |
| `404` | Target user not found     | `USER_NOT_FOUND`    |
| `409` | Already following         | `ALREADY_FOLLOWING` |
| `429` | Rate limit / Lock timeout | `LOCK_TIMEOUT`      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/users/{user}/follow                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:34-45                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('users/{user}')->group(function () {                      │ │
│ │     // Writes: 30/min                                                   │ │
│ │     Route::middleware('throttle:30,1')->group(function () {             │ │
│ │         Route::post('/follow', [FollowController::class, 'follow']);    │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum    → Validates Bearer token, sets Auth::user()           │
│   2. throttle:30,1   → 30 requests per minute for writes                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER INVOCATION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/FollowController.php:27-60           │
│ Method: follow(Request $request, User $user, FollowUserAction $action)      │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $authUser = $request->user();                                           │ │
│ │ if ($authUser === null) {                                               │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Execute action                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($authUser, $user);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle result and build response                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$result->isSuccess()) {                                            │ │
│ │     return ApiResponse::error($result->getMessage(), ...);              │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success([                                           │ │
│ │     'user' => new MinimalUserResource($data['user']),                   │ │
│ │     'followed_at' => $data['followed_at']?->toIso8601String(),          │ │
│ │ ], ..., 201);                                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 ACTION LAYER                                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/User/FollowUserAction.php                                 │
│ Method: execute(User $follower, User $target): ActionResult                 │
│                                                                             │
│ STEP 1: Validation                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Validate: Cannot follow yourself                                     │ │
│ │ if ($follower->id === $target->id) {                                    │ │
│ │     return ActionResult::failure(message: 'You cannot follow...');      │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Check if already following                                           │ │
│ │ if ($follower->isFollowing($target)) {                                  │ │
│ │     return ActionResult::failure(message: 'Already following...');      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Acquire atomic lock                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $lockKey = "follow:{$follower->id}:{$target->id}";                      │ │
│ │ Cache::lock($lockKey, 10)->block(5, function() { ... });                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Database transaction (I/O moved outside per P-2)                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $follow = DB::transaction(function () use ($follower, $target) {        │ │
│ │     // Create follow relationship                                       │ │
│ │     $follow = UserFollow::create([                                      │ │
│ │         'follower_id' => $follower->id,                                 │ │
│ │         'following_id' => $target->id,                                  │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     // Atomically increment counters                                    │ │
│ │     User::where('id', $target->id)->increment('followers_count');       │ │
│ │     User::where('id', $follower->id)->increment('following_count');     │ │
│ │                                                                         │ │
│ │     return $follow;                                                     │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Emit MSAB event (AFTER transaction commit)                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // I/O moved outside transaction for reliability (P-2 fix)              │ │
│ │ $this->msabEventService->emitUserFollowed(                              │ │
│ │     $target->id, $follower->id, $follower->name, $follower->avatar      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Create database notification (AFTER transaction commit)             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $target->notify(new UserFollowedNotification($follower));               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php:514-530                    │ │
│ │ Responsibility: Emit real-time events via Redis                         │ │
│ │ Reusable: YES (used by multiple domains)                                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitUserFollowed() → Publishes 'user.followed' event to Redis       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserFollowedNotification (Notification)                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Notifications/UserFollowedNotification.php                    │ │
│ │ Responsibility: Persist notification to database                        │ │
│ │ Reusable: NO (specific to follow feature)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • via() → Returns ['database']                                        │ │
│ │   • toArray() → Returns notification payload                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Transform User model for API response                   │ │
│ │ Reusable: YES (used across all user-related endpoints)                  │ │
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
│ 1. SELECT: Check if already following                                       │
│    Query: SELECT * FROM user_follows WHERE follower_id=? AND following_id=? │
│    Source: User::isFollowing()                                              │
│                                                                             │
│ 2. INSERT: Create follow relationship                                       │
│    Query: INSERT INTO user_follows (follower_id, following_id, created_at)  │
│    Source: UserFollow::create()                                             │
│                                                                             │
│ 3. UPDATE: Increment target followers_count                                 │
│    Query: UPDATE users SET followers_count = followers_count + 1 WHERE id=? │
│    Source: User::where()->increment()                                       │
│                                                                             │
│ 4. UPDATE: Increment follower following_count                               │
│    Query: UPDATE users SET following_count = following_count + 1 WHERE id=? │
│    Source: User::where()->increment()                                       │
│                                                                             │
│ 5. INSERT: Create notification                                              │
│    Query: INSERT INTO notifications (type, notifiable_id, data, ...)        │
│    Source: User::notify()                                                   │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. LOCK: follow:{follower_id}:{target_id} (TTL: 10s, block: 5s)             │
│    Source: FollowUserAction                                                 │
│                                                                             │
│ REDIS PUBLISH:                                                              │
│                                                                             │
│ 1. PUBLISH: user.followed event to user:{target_id} channel                 │
│    Source: MSABEventService::emitUserFollowed()                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Controllers/Api/V1/User/FollowController.php:51-59           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     [                                                                   │ │
│ │         'user' => new MinimalUserResource($data['user']),               │ │
│ │         'followed_at' => $data['followed_at']?->toIso8601String(),      │ │
│ │     ],                                                                  │ │
│ │     'Successfully followed user.',                                      │ │
│ │     [],                                                                 │ │
│ │     201                                                                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    201 Created + JSON Body                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints      | Reusable | Reasoning                       |
| ------------------------------ | ---------------------- | -------- | ------------------------------- |
| `FollowController.php`         | Follow endpoints only  | ⭕       | Controller pattern reusable     |
| `FollowUserAction.php`         | POST follow            | ❌       | Single-purpose action           |
| `MSABEventService.php`         | All real-time features | ✅       | Centralized event service       |
| `UserFollowedNotification.php` | POST follow            | ❌       | Specific to follow notification |
| `MinimalUserResource.php`      | All user endpoints     | ✅       | Standard user response format   |
| `ApiResponse.php`              | All endpoints          | ✅       | Standardized response helper    |
| `ActionResult.php`             | All actions            | ✅       | Standard action return type     |

---

## 5. Error Handling & Edge Cases

### Validation Errors (403)

| Error                        | Source             | Condition                       |
| ---------------------------- | ------------------ | ------------------------------- |
| `You cannot follow yourself` | `FollowUserAction` | `$follower->id === $target->id` |

### Business Logic Errors (400/409)

| Error                           | Source             | Condition                     |
| ------------------------------- | ------------------ | ----------------------------- |
| `You are already following...`  | `FollowUserAction` | Relationship already exists   |
| `Request is being processed...` | `FollowUserAction` | Lock timeout (race condition) |

### System Errors (500)

| Error                   | Source             | Condition                  |
| ----------------------- | ------------------ | -------------------------- |
| `Failed to follow user` | `FollowUserAction` | DB/Redis connection failed |

### Edge Cases

| Case                       | Behavior                                     |
| -------------------------- | -------------------------------------------- |
| Rapid double-click         | Redis lock prevents duplicate follows        |
| Target user deleted        | Returns 404 (model binding fails)            |
| Concurrent follow requests | First succeeds, second gets 409              |
| MSAB event fails           | Follow still succeeds (event is fire-forget) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                  DATABASE/REDIS
   │                       │                       │                       │                       │
   │  POST /users/123/follow                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │ 2. throttle:60,1      │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. execute()          │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. isFollowing()      │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. LOCK acquire       │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 6. INSERT user_follows│
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 7. UPDATE counts      │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 8. PUBLISH event      │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 9. INSERT notification │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  201 Created + JSON   │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                          |
| -------------------------- | --------------------------------- |
| New validation rules       | `FollowUserAction::execute()`     |
| Additional response fields | `FollowController::follow()`      |
| New notification channels  | `UserFollowedNotification::via()` |
| Blocking integration       | `FollowUserAction` (TODO exists)  |

### 📝 Field Modification Guide

#### ➕ ADDING A NOTIFICATION CHANNEL

| Step  | File                           | What to Change               |
| ----- | ------------------------------ | ---------------------------- |
| **1** | `UserFollowedNotification.php` | Add channel to `via()` array |
| **2** | `UserFollowedNotification.php` | Add `toChannel()` method     |

#### ➖ REMOVING MSAB EVENT

| Step  | File                   | What to Change                    |
| ----- | ---------------------- | --------------------------------- |
| **1** | `FollowUserAction.php` | Remove `emitUserFollowed()` call  |
| **2** | `MSABEventService.php` | Remove method (if no other usage) |

### 🔗 Field Flow Dependency Chain

```
POST /users/{user}/follow
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ FollowController│────▶│ FollowUserAction│
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│MinimalUserResource    │ MSABEventService│     │UserFollowedNotif │
└─────────────────┘     └─────────────────┘     └──────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component          | Reason                                          |
| ------------------ | ----------------------------------------------- |
| Redis lock key     | Changing pattern breaks race condition handling |
| Unique constraint  | Removing allows duplicate follows               |
| Counter increments | Must stay atomic within transaction             |
| MSAB event format  | Frontend clients depend on payload structure    |

### 🚨 Common Pitfalls

| Pitfall                     | Prevention                               |
| --------------------------- | ---------------------------------------- |
| Using model `increment()`   | Use query builder to bypass strict mode  |
| Forgetting transaction      | All DB ops must be in single transaction |
| Missing lock release        | Lock auto-releases on timeout            |
| Returning wrong status code | 201 for create, 409 for conflict         |

### 📁 File Locations Quick Reference

```
routes/api/users.php                             ← Route definition
app/Http/Controllers/Api/V1/User/
  └── FollowController.php                       ← Controller
app/Actions/User/
  └── FollowUserAction.php                       ← Business logic
app/Models/User/
  └── UserFollow.php                             ← Follow model
  └── User.php                                   ← User relationships
app/Services/Gift/
  └── MSABEventService.php                       ← Real-time events
app/Notifications/
  └── UserFollowedNotification.php               ← Database notification
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                    ← Response transformer
```

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `POST /api/v1/users/{user}/follow` |
| **Domain**          | User                               |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-03                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4+                               |
