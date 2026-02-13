# DELETE /api/v1/users/{user}/follow

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Unfollow a user, removing the follower-following relationship and updating counts.

### Responsibilities

- Verify follow relationship exists
- Atomically decrement follower/following counts
- Emit real-time MSAB event to target user

### What It Owns

| Owned               | Description                                      |
| ------------------- | ------------------------------------------------ |
| Follow relationship | Deletes `user_follows` record                    |
| Follower counts     | Decrements `followers_count` / `following_count` |

### External Dependencies

| Dependency | Type           | Purpose                           |
| ---------- | -------------- | --------------------------------- |
| Redis      | Infrastructure | Atomic locking for race condition |
| MSAB       | Real-time      | Emit `user.unfollowed` event      |
| PostgreSQL | Database       | Delete follow relationship        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/users/{user}/follow
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter         | Key          | Config     | Applies To        |
| --------------- | ------------ | ---------- | ----------------- |
| `throttle:30,1` | `user_id:ip` | 30 req/min | Writes (unfollow) |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description            |
| --------- | --------- | ---------------------- |
| `user`    | `integer` | ID of user to unfollow |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Successfully unfollowed user.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Following (404)

```json
{
  "status": "error",
  "message": "You are not following this user.",
  "data": null,
  "errors": {
    "user": ["Not following."]
  }
}
```

### HTTP Status Codes

| Code  | Condition                      | Error Code      |
| ----- | ------------------------------ | --------------- |
| `200` | Successfully unfollowed        | —               |
| `401` | Unauthenticated                | —               |
| `404` | Not following / User not found | `NOT_FOLLOWING` |
| `429` | Rate limit / Lock timeout      | `LOCK_TIMEOUT`  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/users/{user}/follow                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:36-39                                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Writes: 30/min                                                       │ │
│ │ Route::middleware('throttle:30,1')->group(function () {                 │ │
│ │     Route::delete('/follow', [FollowController::class, 'unfollow']);    │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum    → Validates Bearer token                              │
│   2. throttle:30,1   → 30 requests per minute for writes                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER INVOCATION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/FollowController.php:62-89           │
│ Method: unfollow(Request $request, User $user, UnfollowUserAction $action)  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($authUser, $user);                           │ │
│ │ if (!$result->isSuccess()) {                                            │ │
│ │     return ApiResponse::error(...);                                     │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(null, 'Successfully unfollowed user.');    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 ACTION LAYER                                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/User/UnfollowUserAction.php                               │
│                                                                             │
│ STEP 1: Verify relationship exists                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $follow = UserFollow::where('follower_id', $follower->id)               │ │
│ │     ->where('following_id', $target->id)->first();                      │ │
│ │ if ($follow === null) return ActionResult::failure(...);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Acquire lock + transaction (I/O moved outside per P-2)              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cache::lock($lockKey, 10)->block(5, function() {                        │ │
│ │     DB::transaction(function () {                                       │ │
│ │         $follow->delete();                                              │ │
│ │         User::where('id', $target->id)                                  │ │
│ │             ->where('followers_count', '>', 0)                          │ │
│ │             ->decrement('followers_count');                             │ │
│ │         User::where('id', $follower->id)                                │ │
│ │             ->where('following_count', '>', 0)                          │ │
│ │             ->decrement('following_count');                             │ │
│ │     });                                                                 │ │
│ │                                                                         │ │
│ │     // I/O moved outside transaction (P-2 fix)                          │ │
│ │     $this->msabEventService->emitUserUnfollowed(...);                   │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Find follow relationship                                         │
│    Query: SELECT * FROM user_follows WHERE follower_id=? AND following_id=? │
│                                                                             │
│ 2. DELETE: Remove follow relationship                                       │
│    Query: DELETE FROM user_follows WHERE id=?                               │
│                                                                             │
│ 3. UPDATE: Decrement target followers_count (with floor)                    │
│    Query: UPDATE users SET followers_count = followers_count - 1            │
│           WHERE id=? AND followers_count > 0                                │
│                                                                             │
│ 4. UPDATE: Decrement follower following_count (with floor)                  │
│    Query: UPDATE users SET following_count = following_count - 1            │
│           WHERE id=? AND following_count > 0                                │
│                                                                             │
│ REDIS PUBLISH:                                                              │
│                                                                             │
│ 1. PUBLISH: user.unfollowed event to user:{target_id} channel              │
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

| File                     | Used By Endpoints      | Reusable | Reasoning                    |
| ------------------------ | ---------------------- | -------- | ---------------------------- |
| `UnfollowUserAction.php` | DELETE follow only     | ❌       | Single-purpose action        |
| `MSABEventService.php`   | All real-time features | ✅       | Centralized event service    |
| `ApiResponse.php`        | All endpoints          | ✅       | Standardized response helper |

---

## 5. Error Handling & Edge Cases

### Business Logic Errors (404)

| Error                      | Source               | Condition                  |
| -------------------------- | -------------------- | -------------------------- |
| `You are not following...` | `UnfollowUserAction` | Relationship doesn't exist |

### Edge Cases

| Case                | Behavior                              |
| ------------------- | ------------------------------------- |
| Count already at 0  | WHERE clause prevents negative counts |
| Concurrent unfollow | Lock prevents race condition          |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                  DATABASE/REDIS
   │                       │                       │                       │                       │
   │  DELETE /users/123/follow                     │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │ 2. execute()          │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 3. SELECT follow      │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │ 4. LOCK acquire       │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │ 5. DELETE + UPDATE    │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │ 6. PUBLISH event      │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │◀──────────────────────│                       │
   │◀──────────────────────│                       │                       │                       │
   │  200 OK + JSON        │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### 📁 File Locations Quick Reference

```
routes/api/users.php                             ← Route definition
app/Http/Controllers/Api/V1/User/
  └── FollowController.php                       ← Controller (unfollow method)
app/Actions/User/
  └── UnfollowUserAction.php                     ← Business logic
app/Services/Gift/
  └── MSABEventService.php                       ← Real-time events
```

---

## Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `DELETE /api/v1/users/{user}/follow` |
| **Domain**          | User                                 |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-03                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4+                                 |
