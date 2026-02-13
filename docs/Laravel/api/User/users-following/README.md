# GET /api/v1/users/{user}/following

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieve paginated list of users that a specific user is following.

### Responsibilities

- Fetch following users with cursor pagination
- Transform users via MinimalUserResource
- Support customizable page size

### What It Owns

| Owned          | Description                            |
| -------------- | -------------------------------------- |
| Following list | Returns users that target user follows |

### External Dependencies

| Dependency | Type     | Purpose             |
| ---------- | -------- | ------------------- |
| MySQL      | Database | Query relationships |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users/{user}/following
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter         | Key          | Config     |
| --------------- | ------------ | ---------- |
| `throttle:60,1` | `user_id:ip` | 60 req/min |

### Path Parameters

| Parameter | Type      | Description                     |
| --------- | --------- | ------------------------------- |
| `user`    | `integer` | ID of user to get following for |

### Query Parameters

| Parameter  | Type      | Default | Description              |
| ---------- | --------- | ------- | ------------------------ |
| `per_page` | `integer` | 20      | Items per page (max 100) |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "id": 2,
      "name": "Following Name",
      "signature": "def456",
      "avatar": "https://...",
      "gender": 0,
      "email": "following@example.com",
      "phone": "+9876543210",
      "country": "UK",
      "date_of_birth": "1992-08-10",
      "wealth_xp": "1500",
      "charm_xp": "800"
    }
  ],
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid",
    "path": "/api/v1/users/123/following",
    "per_page": 20,
    "next_cursor": "eyJpZCI6MTAsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0",
    "prev_cursor": null
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
│                    GET /api/v1/users/{user}/following                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:40                                               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/following', [FollowController::class, 'following']);       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/FollowController.php:106-119         │
│ Method: following(Request $request, User $user)                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $perPage = min($request->integer('per_page', 20), 100);                 │ │
│ │ $following = $user->following()->cursorPaginate($perPage);              │ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     MinimalUserResource::collection($following),                        │ │
│ │     'Success'                                                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT: Get following users with cursor pagination                       │
│    Query: SELECT users.* FROM users                                         │
│           INNER JOIN user_follows ON users.id = user_follows.following_id   │
│           WHERE user_follows.follower_id = ?                                │
│           ORDER BY user_follows.id DESC LIMIT 21                            │
│    Source: User::following()->cursorPaginate()                              │
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

| File                      | Used By Endpoints       | Reusable | Reasoning             |
| ------------------------- | ----------------------- | -------- | --------------------- |
| `MinimalUserResource.php` | All user list endpoints | ✅       | Standard user format  |
| `User::following()`       | Following endpoint      | ✅       | Reusable relationship |

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case               | Behavior            |
| ------------------ | ------------------- |
| No following users | Returns empty array |
| Invalid cursor     | Returns first page  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                   DATABASE
   │                       │                       │                            │
   │  GET /users/123/following                     │                            │
   │──────────────────────▶│                       │                            │
   │                       │ 1. auth:sanctum       │                            │
   │                       │──────────────────────▶│                            │
   │                       │                       │ 2. following()             │
   │                       │                       │───────────────────────────▶│
   │                       │                       │◀───────────────────────────│
   │                       │◀──────────────────────│                            │
   │◀──────────────────────│                       │                            │
   │  200 OK + JSON        │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### 📁 File Locations Quick Reference

```
routes/api/users.php                             ← Route
app/Http/Controllers/Api/V1/User/
  └── FollowController.php                       ← Controller
app/Models/User/User.php                         ← following() relationship
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                    ← Response transformer
```

---

## Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `GET /api/v1/users/{user}/following` |
| **Domain**          | User                                 |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-03                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4+                                 |
