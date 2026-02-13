# DELETE /api/v1/profile/avatar

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Delete Avatar endpoint removes the authenticated user's profile avatar. This clears the avatar URL from the database and invalidates related caches. The actual CDN file cleanup is handled by ImageKit's expiration policies.

### Responsibilities

- Authenticate request via Sanctum token
- Remove avatar URL from user record
- Invalidate user cache tags
- Return updated user profile without avatar

### What It Owns

| Owned                     | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| Avatar removal            | Clears avatar column in users table                  |
| Cache invalidation        | Flushes user:{id} cache tags                         |

### External Dependencies

| Dependency              | Type           | Purpose                                     |
| ----------------------- | -------------- | ------------------------------------------- |
| `users` table           | Database       | User data storage                           |
| Laravel Sanctum         | Package        | Token authentication                        |
| AvatarService           | Service        | Avatar deletion and cache management        |
| CacheService            | Service        | User cache invalidation                     |
| BootstrapUserResource   | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/profile/avatar
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter        | Key               | Config                              |
| -------------- | ----------------- | ----------------------------------- |
| `throttle.role`| Role-based        | Varies by user role                 |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |
| `X-Correlation-ID` | ❌       | `string (UUID)`       | Request tracing ID           |

### Request Body Schema

**No request body required** - This is a DELETE request with no parameters.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Avatar deleted successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    "avatar": null,
    "frame": null,
    "phone": "+923001234567",
    "country": "PK",
    "gender": "male",
    "date_of_birth": "1995-05-15",
    "coins": "1500",
    "diamonds": "250",
    "wealth_xp": "5000",
    "charm_xp": "3200",
    "is_profile_complete": true,
    "is_blocked": false,
    "blocked_at": null,
    "blocked_reason": null,
    "locked_until": null
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to delete avatar. Please try again.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Avatar deleted successfully         |
| `401` | Unauthenticated (missing/invalid token) |
| `429` | Rate limit exceeded                 |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/profile/avatar                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/profile.php:27                                             │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::delete('/avatar', [UserProfileController::class, 'deleteAvatar'])│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum     → Validates Bearer token                              │
│   2. throttle.role    → Role-based rate limiting                            │
│   3. https.enforce    → Enforces HTTPS in production                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest - endpoint has no input parameters.                          │
│ Sanctum middleware authenticates and populates $request->user().            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserProfileController.php            │
│ Method: deleteAvatar(Request $request) at line 82                           │
│                                                                             │
│ STEP 1: Get Authenticated User (line 84)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Null Check (lines 86-88)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Call Avatar Service (lines 91-99)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     $this->avatarService->deleteAvatar($user);                          │ │
│ │                                                                         │ │
│ │     return ApiResponse::success(                                        │ │
│ │         new BootstrapUserResource($user->fresh()),                      │ │
│ │         'Avatar deleted successfully'                                   │ │
│ │     );                                                                  │ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     return ApiResponse::serverError('Failed to delete avatar...');      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/AvatarService.php                                   │
│ Method: deleteAvatar() at lines 31-60                                       │
│                                                                             │
│ STEP 1: Check if Avatar Exists (lines 34-36)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user->avatar === null) {                                           │ │
│ │     return true;  // Nothing to delete - idempotent operation           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Remove Avatar URL from User (line 40)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->update(['avatar' => null]);                                      │ │
│ │ // Note: Can't delete from ImageKit without file_id                     │ │
│ │ // ImageKit cleanup handled via expiration policies                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Invalidate User Cache (line 43)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->cacheService->safeFlushTags(["user:{$user->id}"]);               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Log Success (lines 45-47)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('Avatar deleted from database', [                             │ │
│ │     'user_id' => $user->id,                                             │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ return true;                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Error Handling (lines 50-59)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     Log::error('Avatar deletion failed', [                              │ │
│ │         'user_id' => $user->id,                                         │ │
│ │         'error' -> $e->getMessage(),                                    │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     // Still clear the user avatar even if ImageKit fails              │ │
│ │     $user->update(['avatar' => null]);                                  │ │
│ │                                                                         │ │
│ │     return false;                                                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AvatarService                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/User/AvatarService.php                               │ │
│ │ Responsibility: Avatar lifecycle management                             │ │
│ │ Reusable: YES (used by avatar set, avatar delete)                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deleteAvatar($user) → Removes avatar URL, invalidates cache         │ │
│ │                                                                         │ │
│ │ Behavior Notes:                                                         │ │
│ │   • Idempotent - calling on user without avatar returns true            │ │
│ │   • Graceful degradation - clears DB even if cache flush fails          │ │
│ │   • CDN cleanup deferred to ImageKit expiration policies                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CacheService (see profile-avatar-set docs)                       │
│                                                                             │
│ COMPONENT: BootstrapUserResource (see profile-show docs)                    │
│                                                                             │
│ COMPONENT: ApiResponse (see previous docs)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT: Token validation (Sanctum middleware)                            │
│    Query: SELECT * FROM personal_access_tokens WHERE token = ?              │
│                                                                             │
│ 2. SELECT: User retrieval (Sanctum middleware)                              │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ 3. UPDATE: Clear avatar (AvatarService::deleteAvatar)                       │
│    Query: UPDATE users SET avatar = NULL WHERE id = ?                       │
│                                                                             │
│ 4. SELECT: Fresh user for response                                          │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   1. FLUSH: User cache tags                                                 │
│      Operation: $cacheService->safeFlushTags(["user:{$userId}"])            │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - synchronous operation                                              │
│                                                                             │
│ EXTERNAL SERVICES:                                                          │
│   None - ImageKit cleanup handled via expiration policies                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ $user->fresh() → BootstrapUserResource → ApiResponse::success()             │
│                                                                             │
│ Note: fresh() called to ensure response reflects database state             │
│       (avatar will be null in the response)                                 │
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

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `UserProfileController.php`                   | Profile endpoints only               | ⭕ Mixed   | Controller is endpoint-specific              |
| `AvatarService.php`                           | Avatar set, avatar delete            | ✅ Reusable| Avatar lifecycle management                  |
| `CacheService.php`                            | Multiple services                    | ✅ Reusable| Global cache utility                         |
| `BootstrapUserResource.php`                   | Profile, Login, Register, Bootstrap  | ✅ Reusable| Standard user response format                |
| `ApiResponse.php`                             | All API endpoints                    | ✅ Reusable| Global response utility                      |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition |
| ----- | ------ | --------- |
| None  | N/A    | Endpoint has no input parameters |

### Business Logic Errors (400)

| Error | Source | Condition |
| ----- | ------ | --------- |
| None  | N/A    | Endpoint has no business logic validation |

### System Errors (500)

| Error                        | Source               | Condition                        |
| ---------------------------- | -------------------- | -------------------------------- |
| Database update failure      | User::update()       | DB connection or constraint error|
| Cache flush failure          | CacheService         | Redis connection error (logged, continues) |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User has no avatar                | Returns 200 OK - idempotent operation              |
| Cache flush fails                 | Logs error, still clears avatar from DB            |
| Called multiple times             | Idempotent - always returns 200 OK                 |
| Race condition with set           | Last operation wins (no locking)                   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE/CACHE
   │                       │                       │                       │                    │
   │DELETE /profile/avatar │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │    Validate token     │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 2. throttle.role      │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 3. Get user           │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 4. Call               │                    │
   │                       │                       │    deleteAvatar()     │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 5. Check avatar    │
   │                       │                       │                       │    exists          │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 6. UPDATE users    │
   │                       │                       │                       │    SET avatar=NULL │
   │                       │                       │                       │───────────────────▶│ DB
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 7. Flush cache     │
   │                       │                       │                       │    user:{id} tags  │
   │                       │                       │                       │───────────────────▶│ CACHE
   │                       │                       │◀──────────────────────│◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │ 8. $user->fresh()     │                    │
   │                       │                       │───────────────────────────────────────────▶│
   │                       │                       │◀───────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │                       │ 9. Create resource    │                    │
   │                       │                       │    (avatar = null)    │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 10. ApiResponse       │                    │
   │                       │                       │     ::success()       │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │                       │                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
   │  { avatar: null }     │                       │                       │                    │
   │                       │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| CDN file deletion               | AvatarService::deleteAvatar() with ImageKitService    |
| Avatar history tracking         | Create observer to log avatar changes                 |
| Soft delete (keep in DB)        | Add avatar_deleted_at column, modify service          |

### 📝 Field Modification Guide

#### ➕ ADDING CDN FILE DELETION

**See profile-avatar-set documentation for detailed implementation.**

The key change would be in `AvatarService::deleteAvatar()`:

```php
public function deleteAvatar(User $user): bool
{
    if ($user->avatar === null) {
        return true;
    }
    
    // NEW: Delete from ImageKit if file_id exists
    if ($user->avatar_file_id !== null) {
        $this->imageKitService->deleteFile($user->avatar_file_id);
    }
    
    $user->update([
        'avatar' => null,
        'avatar_file_id' => null,  // NEW: Also clear file_id
    ]);
    
    // ... rest of method
}
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DELETE /api/v1/profile/avatar (no body)                                    │
│       │                                                                     │
│       ▼                                                                     │
│  Sanctum Middleware              ← Validates token, loads user              │
│       │                                                                     │
│       ▼                                                                     │
│  Controller::deleteAvatar()                                                 │
│       │                                                                     │
│       ▼                                                                     │
│  AvatarService::deleteAvatar()                                              │
│       │                                                                     │
│       ├──► Check $user->avatar !== null                                     │
│       │                                                                     │
│       ├──► $user->update(['avatar' => null])                                │
│       │                                                                     │
│       └──► $cacheService->safeFlushTags(["user:{$id}"])                     │
│                                                                             │
│  $user->fresh()                  ← Reload from database                     │
│       │                                                                     │
│       ▼                                                                     │
│  BootstrapUserResource           ← avatar = null in response                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Idempotent behavior                 | Clients may retry; should always succeed                |
| Cache invalidation                  | Ensures avatar removal reflects immediately             |
| Graceful error handling             | Must clear DB even if other operations fail             |
| $user->fresh() call                 | Ensures response reflects actual database state         |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                                |
| ------------------------------------ | --------------------------------------------------------- |
| Non-idempotent response              | Always return 200 even if avatar was already null         |
| Stale cache after deletion           | Call cacheService->safeFlushTags() after DB update        |
| Response shows old avatar            | Use $user->fresh() to reload from database                |
| Orphaned CDN files                   | Currently handled by ImageKit expiration policies         |

### 📁 File Locations Quick Reference

```
routes/api/profile.php:27                           ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserProfileController.php:82-106              ← Controller method
app/Services/User/
  └── AvatarService.php:31-60                       ← Avatar deletion logic
app/Services/Cache/
  └── CacheService.php                              ← Cache utilities
app/Http/Resources/V1/Auth/
  └── BootstrapUserResource.php                     ← Response transformer
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                             |
| ------------------- | --------------------------------- |
| **Endpoint**        | `DELETE /api/v1/profile/avatar`   |
| **Domain**          | User                              |
| **Author**          | System Documentation              |
| **Created**         | 2026-02-04                        |
| **Laravel Version** | 12.x                              |
| **PHP Version**     | 8.4+                              |
