# GET /api/v1/users/{user}/follow-status

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Check the follow relationship status between the authenticated user and a target user.

### Responsibilities

- Return if auth user follows target
- Return if target follows auth user
- Include follow timestamp if relationship exists

### What It Owns

| Owned         | Description                             |
| ------------- | --------------------------------------- |
| Follow status | Returns mutual follow relationship info |

### External Dependencies

| Dependency | Type     | Purpose             |
| ---------- | -------- | ------------------- |
| MySQL      | Database | Query relationships |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users/{user}/follow-status
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter         | Key          | Config     |
| --------------- | ------------ | ---------- |
| `throttle:60,1` | `user_id:ip` | 60 req/min |

### Path Parameters

| Parameter | Type      | Description                    |
| --------- | --------- | ------------------------------ |
| `user`    | `integer` | ID of user to check status for |

---

### Response Schemas

#### ✅ Success Response (200) - Following

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "is_following": true,
    "is_followed_by": false,
    "followed_at": "2026-02-03T15:20:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response (200) - Mutual Follow

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "is_following": true,
    "is_followed_by": true,
    "followed_at": "2026-02-03T15:10:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response (200) - Not Following

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "is_following": false,
    "is_followed_by": false,
    "followed_at": null
  },
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition              |
| ----- | ---------------------- |
| `200` | Successfully retrieved |
| `401` | Unauthenticated        |
| `404` | User not found         |
| `429` | Rate limit exceeded    |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/users/{user}/follow-status                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:41                                               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/follow-status', [FollowController::class, 'status']);      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/FollowController.php:121-150         │
│ Method: status(Request $request, User $user)                                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $authUser = $request->user();                                           │ │
│ │ $isFollowing = $authUser->isFollowing($user);                           │ │
│ │ $isFollowedBy = $authUser->isFollowedBy($user);                         │ │
│ │                                                                         │ │
│ │ $followedAt = null;                                                     │ │
│ │ if ($isFollowing) {                                                     │ │
│ │     $follow = UserFollow::where('follower_id', $authUser->id)           │ │
│ │         ->where('following_id', $user->id)->first();                    │ │
│ │     $followedAt = $follow?->created_at;                                 │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success([                                           │ │
│ │     'is_following' => $isFollowing,                                     │ │
│ │     'is_followed_by' => $isFollowedBy,                                  │ │
│ │     'followed_at' => $followedAt?->toIso8601String(),                   │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Check if auth user follows target                                │
│    Query: SELECT EXISTS(SELECT 1 FROM user_follows                          │
│           WHERE follower_id=? AND following_id=?)                           │
│    Source: User::isFollowing()                                              │
│                                                                             │
│ 2. SELECT: Check if target follows auth user                                │
│    Query: SELECT EXISTS(SELECT 1 FROM user_follows                          │
│           WHERE follower_id=? AND following_id=?)                           │
│    Source: User::isFollowedBy()                                             │
│                                                                             │
│ 3. SELECT: Get follow timestamp (if following)                              │
│    Query: SELECT * FROM user_follows WHERE follower_id=? AND following_id=? │
│    Source: UserFollow::where()->first()                                     │
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

| File                   | Used By Endpoints      | Reusable | Reasoning                 |
| ---------------------- | ---------------------- | -------- | ------------------------- |
| `User::isFollowing()`  | Status, follow actions | ✅       | Relationship check helper |
| `User::isFollowedBy()` | Status endpoint        | ✅       | Relationship check helper |
| `ApiResponse.php`      | All endpoints          | ✅       | Standardized response     |

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case              | Behavior                            |
| ----------------- | ----------------------------------- |
| Self-status check | Returns correct mutual status       |
| No relationship   | Both booleans false, null timestamp |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                   DATABASE
   │                       │                       │                            │
   │  GET /users/123/follow-status                 │                            │
   │──────────────────────▶│                       │                            │
   │                       │ 1. auth:sanctum       │                            │
   │                       │──────────────────────▶│                            │
   │                       │                       │ 2. isFollowing()           │
   │                       │                       │───────────────────────────▶│
   │                       │                       │◀───────────────────────────│
   │                       │                       │ 3. isFollowedBy()          │
   │                       │                       │───────────────────────────▶│
   │                       │                       │◀───────────────────────────│
   │                       │                       │ 4. get follow record       │
   │                       │                       │───────────────────────────▶│
   │                       │                       │◀───────────────────────────│
   │                       │◀──────────────────────│                            │
   │◀──────────────────────│                       │                            │
   │  200 OK + JSON        │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                | Location                        |
| ----------------------- | ------------------------------- |
| Additional status flags | `FollowController::status()`    |
| Cache follow status     | Add Redis caching in controller |

### ⚠️ What Should NOT Be Modified Casually

| Component             | Reason                                 |
| --------------------- | -------------------------------------- |
| Response field names  | Frontend clients depend on these names |
| Boolean return values | Must remain consistent for UI logic    |

### 🚨 Common Pitfalls

| Pitfall                     | Prevention                        |
| --------------------------- | --------------------------------- |
| N+1 query on follow record  | Only fetch if isFollowing is true |
| Null handling for timestamp | Use null-safe operator (?->)      |

### 📁 File Locations Quick Reference

```
routes/api/users.php                             ← Route
app/Http/Controllers/Api/V1/User/
  └── FollowController.php                       ← Controller (status method)
app/Models/User/User.php                         ← isFollowing(), isFollowedBy()
app/Models/User/UserFollow.php                   ← Follow record model
```

---

## Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `GET /api/v1/users/{user}/follow-status` |
| **Domain**          | User                                     |
| **Author**          | System Documentation                     |
| **Created**         | 2026-02-03                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4+                                     |
