# GET /api/v1/users/{user}/followers

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieve paginated list of users who follow a specific user.

### Responsibilities

- Fetch followers with cursor pagination
- Transform users via MinimalUserResource
- Support customizable page size

### What It Owns

| Owned          | Description                          |
| -------------- | ------------------------------------ |
| Followers list | Returns followers of the target user |

### External Dependencies

| Dependency | Type     | Purpose             |
| ---------- | -------- | ------------------- |
| MySQL      | Database | Query relationships |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users/{user}/followers
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
| `user`    | `integer` | ID of user to get followers for |

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
      "id": 1,
      "name": "Follower Name",
      "signature": "abc123",
      "avatar": "https://...",
      "gender": 1,
      "email": "follower@example.com",
      "phone": "+1234567890",
      "country": "US",
      "date_of_birth": "1995-05-20",
      "wealth_xp": "500",
      "charm_xp": "250"
    }
  ],
  "meta": {
    "timestamp": "2026-02-03T15:20:00.000000Z",
    "correlation_id": "uuid",
    "path": "/api/v1/users/123/followers",
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
│                    GET /api/v1/users/{user}/followers                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:39                                               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/followers', [FollowController::class, 'followers']);       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/FollowController.php:91-104          │
│ Method: followers(Request $request, User $user)                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $perPage = min($request->integer('per_page', 20), 100);                 │ │
│ │ $followers = $user->followers()->cursorPaginate($perPage);              │ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     MinimalUserResource::collection($followers),                        │ │
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
│ 1. SELECT: Get followers with cursor pagination                             │
│    Query: SELECT users.* FROM users                                         │
│           INNER JOIN user_follows ON users.id = user_follows.follower_id    │
│           WHERE user_follows.following_id = ?                               │
│           ORDER BY user_follows.id DESC LIMIT 21                            │
│    Source: User::followers()->cursorPaginate()                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/User/MinimalUserResource.php                    │
│                                                                             │
│ Each user transformed to include:                                           │
│   id, name, signature, avatar, gender, email, phone,                        │
│   country, date_of_birth, wealth_xp, charm_xp                               │
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

| File                      | Used By Endpoints       | Reusable | Reasoning               |
| ------------------------- | ----------------------- | -------- | ----------------------- |
| `MinimalUserResource.php` | All user list endpoints | ✅       | Standard user format    |
| `ApiResponse::paginated`  | All paginated endpoints | ✅       | Standardized pagination |
| `User::followers()`       | Followers endpoint      | ✅       | Reusable relationship   |

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case           | Behavior            |
| -------------- | ------------------- |
| No followers   | Returns empty array |
| Invalid cursor | Returns first page  |
| per_page > 100 | Capped at 100       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                   DATABASE
   │                       │                       │                            │
   │  GET /users/123/followers                     │                            │
   │──────────────────────▶│                       │                            │
   │                       │ 1. auth:sanctum       │                            │
   │                       │──────────────────────▶│                            │
   │                       │                       │ 2. followers()             │
   │                       │                       │                            │
   │                       │                       │ 3. cursorPaginate()        │
   │                       │                       │───────────────────────────▶│
   │                       │                       │◀───────────────────────────│
   │                       │                       │                            │
   │                       │                       │ 4. MinimalUserResource     │
   │                       │◀──────────────────────│                            │
   │◀──────────────────────│                       │                            │
   │  200 OK + JSON        │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location                        |
| ---------------------- | ------------------------------- |
| Sort order option      | `FollowController::followers()` |
| Additional user fields | `MinimalUserResource`           |

### 📁 File Locations Quick Reference

```
routes/api/users.php                             ← Route
app/Http/Controllers/Api/V1/User/
  └── FollowController.php                       ← Controller
app/Models/User/User.php                         ← followers() relationship
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                    ← Response transformer
```

---

## Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `GET /api/v1/users/{user}/followers` |
| **Domain**          | User                                 |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-03                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4+                                 |
