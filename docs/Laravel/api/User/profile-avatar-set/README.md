# PUT /api/v1/profile/avatar

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Set Avatar endpoint allows authenticated users to set their profile avatar by providing a pre-uploaded ImageKit URL. The client uploads the image directly to ImageKit, then calls this endpoint to associate the URL with their profile.

### Responsibilities

- Authenticate request via Sanctum token
- Validate ImageKit URL format and origin
- Delete previous avatar if exists
- Update user's avatar URL in database
- Return updated user profile

### What It Owns

| Owned                     | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| Avatar URL validation     | Validates URL is from configured ImageKit CDN        |
| Avatar persistence        | Updates avatar column in users table                 |
| Previous avatar cleanup   | Deletes old avatar via AvatarService                 |

### External Dependencies

| Dependency              | Type           | Purpose                                     |
| ----------------------- | -------------- | ------------------------------------------- |
| `users` table           | Database       | User data storage                           |
| Laravel Sanctum         | Package        | Token authentication                        |
| ImageKit                | External CDN   | Image hosting and transformation            |
| SetAvatarRequest        | FormRequest    | Input validation                            |
| AvatarService           | Service        | Avatar deletion and cache management        |
| CacheService            | Service        | User cache invalidation                     |
| BootstrapUserResource   | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/profile/avatar
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter              | Key               | Config                              |
| -------------------- | ----------------- | ----------------------------------- |
| `throttle.role`      | Role-based        | Varies by user role                 |
| `auth.rate_limit`    | avatar_upload     | Custom rate limit for avatar uploads|

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Content-Type`     | ✅       | `application/json`    | Request body format          |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |
| `X-Correlation-ID` | ❌       | `string (UUID)`       | Request tracing ID           |

### Request Body Schema

```json
{
  "url": "https://ik.imagekit.io/flylive/avatars/user_123_abc123.jpg",
  "file_id": "abc123def456"
}
```

### Field Details

| Field     | Type     | Required | Constraints                                  | Description                              |
| --------- | -------- | -------- | -------------------------------------------- | ---------------------------------------- |
| `url`     | `string` | ✅       | url, must start with ImageKit URL endpoint   | Pre-uploaded ImageKit CDN URL            |
| `file_id` | `string` | ✅       | max:100                                      | ImageKit file ID for future cleanup      |

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Avatar updated successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    "avatar": "https://ik.imagekit.io/flylive/avatars/user_123_abc123.jpg",
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

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "url": ["Avatar must be uploaded to our CDN."],
    "file_id": ["File ID is required for cleanup."]
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
  "message": "Failed to update avatar. Please try again.",
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
| `200` | Avatar updated successfully         |
| `401` | Unauthenticated (missing/invalid token) |
| `422` | Validation failed                   |
| `429` | Rate limit exceeded                 |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    PUT /api/v1/profile/avatar                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/profile.php:24-25                                          │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::put('/avatar', [UserProfileController::class, 'setAvatar'])      │ │
│ │     ->middleware('auth.rate_limit:avatar_upload');                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum         → Validates Bearer token                          │
│   2. throttle.role        → Role-based rate limiting                        │
│   3. https.enforce        → Enforces HTTPS in production                    │
│   4. auth.rate_limit      → Avatar upload specific rate limit               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/SetAvatarRequest.php                    │
│                                                                             │
│ Authorization Check (lines 20-23):                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules (lines 30-46):                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     $urlEndpoint = config('imagekit.url_endpoint');                     │ │
│ │     $urlPattern = '/^' . preg_quote($urlEndpoint, '/') . '\\//'         │ │
│ │                                                                         │ │
│ │     return [                                                            │ │
│ │         'url' => [                                                      │ │
│ │             'required',                                                 │ │
│ │             'url',                                                      │ │
│ │             'regex:' . $urlPattern,  // Must start with ImageKit URL   │ │
│ │         ],                                                              │ │
│ │         'file_id' => [                                                  │ │
│ │             'required',                                                 │ │
│ │             'string',                                                   │ │
│ │             'max:100',                                                  │ │
│ │         ],                                                              │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserProfileController.php            │
│ Method: setAvatar(SetAvatarRequest $request) at line 51                     │
│                                                                             │
│ STEP 1: Get Authenticated User (line 53)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Null Check (lines 55-57)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get Validated Data (line 59)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ // Returns: ['url' => '...', 'file_id' => '...']                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Delete Old Avatar If Exists (lines 62-65)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user->avatar !== null) {                                           │ │
│ │     $this->avatarService->deleteAvatar($user);                          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Set New Avatar URL (line 68)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->update(['avatar' => $validated['url']]);                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Return Success Response (lines 70-73)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new BootstrapUserResource($user),                                   │ │
│ │     'Avatar updated successfully'                                       │ │
│ │ );                                                                      │ │
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
│ │     return true;  // Nothing to delete                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Remove Avatar URL from User (line 40)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->update(['avatar' => null]);                                      │ │
│ │ // Note: ImageKit cleanup handled via expiration policies               │ │
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
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: SetAvatarRequest                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Requests/Api/V1/User/SetAvatarRequest.php                │ │
│ │ Responsibility: Validate ImageKit URL and file_id                       │ │
│ │ Reusable: NO (specific to avatar set operation)                         │ │
│ │                                                                         │ │
│ │ Key Validation:                                                         │ │
│ │   • URL must start with config('imagekit.url_endpoint')                 │ │
│ │   • file_id required for future cleanup operations                      │ │
│ │                                                                         │ │
│ │ Config Dependency:                                                      │ │
│ │   • IMAGEKIT_URL_ENDPOINT env variable                                  │ │
│ │   • Example: https://ik.imagekit.io/flylive                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AvatarService                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/User/AvatarService.php                               │ │
│ │ Responsibility: Avatar lifecycle management                             │ │
│ │ Reusable: YES (used by avatar set, avatar delete)                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deleteAvatar($user) → Removes avatar URL, invalidates cache         │ │
│ │   • getOptimizedAvatarUrl($user, $transformation) → Transformed URL     │ │
│ │   • invalidateCache($user) → Flushes user cache tags                    │ │
│ │                                                                         │ │
│ │ Dependencies:                                                           │ │
│ │   • ImageKitService → CDN operations                                    │ │
│ │   • CacheService → Cache tag management                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CacheService                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Cache/CacheService.php                               │ │
│ │ Method: safeFlushTags($tags)                                            │ │
│ │ Reusable: YES (used across application)                                 │ │
│ │                                                                         │ │
│ │ Purpose: Safely flush cache tags without failing on non-tag drivers     │ │
│ │ Handles: Redis (tags supported), File (no tags - graceful no-op)        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│ 3. UPDATE: Clear old avatar (AvatarService::deleteAvatar - if exists)       │
│    Query: UPDATE users SET avatar = NULL WHERE id = ?                       │
│                                                                             │
│ 4. UPDATE: Set new avatar URL                                               │
│    Query: UPDATE users SET avatar = ? WHERE id = ?                          │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   1. FLUSH: User cache tags after old avatar deletion                       │
│      Operation: $cacheService->safeFlushTags(["user:{$userId}"])            │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - synchronous update                                                 │
│                                                                             │
│ EXTERNAL SERVICES:                                                          │
│   None - ImageKit upload handled client-side before this endpoint           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Updated User model → BootstrapUserResource → ApiResponse::success()         │
│                                                                             │
│ The response includes the new avatar URL in the data.avatar field.          │
│ Frontend can immediately use this URL with Nuxt Image / ImageKit.           │
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
| `SetAvatarRequest.php`                        | Avatar set only                      | ❌ Single  | Specific to avatar URL validation            |
| `AvatarService.php`                           | Avatar set, avatar delete            | ✅ Reusable| Avatar lifecycle management                  |
| `CacheService.php`                            | Multiple services                    | ✅ Reusable| Global cache utility                         |
| `BootstrapUserResource.php`                   | Profile, Login, Register, Bootstrap  | ✅ Reusable| Standard user response format                |
| `ApiResponse.php`                             | All API endpoints                    | ✅ Reusable| Global response utility                      |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                    | Source               | Condition                                |
| ------------------------ | -------------------- | ---------------------------------------- |
| `url.required`           | SetAvatarRequest     | URL not provided                         |
| `url.url`                | SetAvatarRequest     | Value is not a valid URL                 |
| `url.regex`              | SetAvatarRequest     | URL doesn't start with ImageKit endpoint |
| `file_id.required`       | SetAvatarRequest     | File ID not provided                     |
| `file_id.max`            | SetAvatarRequest     | File ID exceeds 100 characters           |

### Business Logic Errors (400)

| Error | Source | Condition |
| ----- | ------ | --------- |
| None  | N/A    | Endpoint has no business logic validation |

### System Errors (500)

| Error                        | Source               | Condition                        |
| ---------------------------- | -------------------- | -------------------------------- |
| Database update failure      | User::update()       | DB connection or constraint error|
| Cache flush failure          | CacheService         | Redis connection error           |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User has no existing avatar       | Simply sets new avatar, no deletion needed         |
| Old avatar deletion fails         | Logs error but still sets NULL before new URL      |
| ImageKit URL format changes       | Update IMAGEKIT_URL_ENDPOINT env variable          |
| Rate limit exceeded               | 429 response before reaching controller            |
| Same URL as current avatar        | Overwrites with same value (idempotent)            |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE/CACHE
   │                       │                       │                       │                    │
   │  PUT /profile/avatar  │                       │                       │                    │
   │  { url, file_id }     │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │    Validate token     │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 2. throttle.role      │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 3. auth.rate_limit    │                       │                    │
   │                       │    avatar_upload      │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 4. SetAvatarRequest   │                       │                    │
   │                       │    validates input    │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 5. Get user           │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 6. Check old avatar   │                    │
   │                       │                       │    exists ($user->    │                    │
   │                       │                       │    avatar !== null)   │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 7. Delete old avatar  │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 8. UPDATE avatar   │
   │                       │                       │                       │    SET NULL        │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 9. Flush cache     │
   │                       │                       │                       │    user:{id} tags  │
   │                       │                       │                       │───────────────────▶│ CACHE
   │                       │                       │◀──────────────────────│◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │ 10. Set new avatar    │                    │
   │                       │                       │     UPDATE users SET  │                    │
   │                       │                       │     avatar = url      │                    │
   │                       │                       │───────────────────────────────────────────▶│ DB
   │                       │                       │◀───────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │                       │ 11. Create resource   │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 12. ApiResponse       │                    │
   │                       │                       │     ::success()       │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │                       │                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
   │                       │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| Avatar moderation               | Add moderation check before setting URL               |
| Avatar size validation          | Add to SetAvatarRequest or call ImageKit API          |
| Avatar history tracking         | Create user_avatar_history table and observer         |
| Avatar file deletion from CDN   | Add ImageKitService::deleteFile($fileId) call         |

### 📝 Field Modification Guide

#### ➕ ADDING CDN FILE DELETION

**Example: Delete old file from ImageKit when setting new avatar**

| Step  | File                                                  | What to Change                           |
| ----- | ----------------------------------------------------- | ---------------------------------------- |
| **1** | `app/Services/Infrastructure/ImageKitService.php`     | Add deleteFile($fileId) method           |
| **2** | `app/Services/User/AvatarService.php`                 | Store file_id, call deleteFile on delete |
| **3** | Database Migration                                    | Add avatar_file_id column to users       |

**Detailed Code Changes:**

```php
// STEP 1: ImageKitService - add delete method
public function deleteFile(string $fileId): bool
{
    try {
        $this->imageKit->deleteFile($fileId);
        return true;
    } catch (\Exception $e) {
        Log::error('ImageKit file deletion failed', [
            'file_id' => $fileId,
            'error' => $e->getMessage(),
        ]);
        return false;
    }
}

// STEP 2: AvatarService::deleteAvatar() - add CDN cleanup
public function deleteAvatar(User $user): bool
{
    if ($user->avatar === null) {
        return true;
    }
    
    // Delete from ImageKit if file_id exists
    if ($user->avatar_file_id !== null) {
        $this->imageKitService->deleteFile($user->avatar_file_id);
    }
    
    $user->update([
        'avatar' => null,
        'avatar_file_id' => null,
    ]);
    // ... rest of method
}

// STEP 3: Controller - also save file_id
$user->update([
    'avatar' => $validated['url'],
    'avatar_file_id' => $validated['file_id'],
]);
```

#### ✏️ MODIFYING URL VALIDATION

**Example: Supporting multiple CDN providers**

```php
// SetAvatarRequest::rules()
public function rules(): array
{
    $allowedDomains = [
        config('imagekit.url_endpoint'),
        'https://cdn.cloudflare.com',
    ];
    
    $pattern = '/^(' . implode('|', array_map(fn($d) => preg_quote($d, '/'), $allowedDomains)) . ')\\//'

    return [
        'url' => ['required', 'url', 'regex:' . $pattern],
        // ...
    ];
}
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client uploads image to ImageKit directly                                  │
│       │                                                                     │
│       ▼                                                                     │
│  ImageKit returns URL + file_id                                             │
│       │                                                                     │
│       ▼                                                                     │
│  PUT /api/v1/profile/avatar { url, file_id }                                │
│       │                                                                     │
│       ▼                                                                     │
│  SetAvatarRequest::rules()          ← Validates URL matches ImageKit CDN    │
│       │                                                                     │
│       ▼                                                                     │
│  Controller::setAvatar()                                                    │
│       │                                                                     │
│       ├──► AvatarService::deleteAvatar()   ← Clears old avatar if exists    │
│       │                                                                     │
│       └──► $user->update(['avatar' => $url])   ← Sets new avatar URL        │
│                                                                             │
│  BootstrapUserResource::toArray()   ← Returns avatar in response            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| ImageKit URL validation regex       | Must match IMAGEKIT_URL_ENDPOINT exactly                |
| file_id requirement                 | Needed for potential future CDN cleanup                 |
| Cache invalidation call             | Ensures avatar changes reflect immediately              |
| Old avatar cleanup order            | Must delete before setting new to maintain consistency  |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                                |
| ------------------------------------ | --------------------------------------------------------- |
| Allowing external URLs               | Regex validates URL starts with configured ImageKit domain|
| Missing file_id                      | Required field for future cleanup operations              |
| Cache not invalidated                | Call cacheService->safeFlushTags() after avatar change    |
| Large image files                    | Client-side upload limits handled by ImageKit             |
| Orphaned CDN files                   | Currently handled by ImageKit expiration policies         |

### 📁 File Locations Quick Reference

```
routes/api/profile.php:24-25                        ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserProfileController.php:51-76               ← Controller method
app/Http/Requests/Api/V1/User/
  └── SetAvatarRequest.php                          ← Request validation
app/Services/User/
  └── AvatarService.php                             ← Avatar management
app/Services/Cache/
  └── CacheService.php                              ← Cache utilities
config/imagekit.php                                 ← ImageKit configuration
.env                                                ← IMAGEKIT_URL_ENDPOINT
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                          |
| ------------------- | ------------------------------ |
| **Endpoint**        | `PUT /api/v1/profile/avatar`   |
| **Domain**          | User                           |
| **Author**          | System Documentation           |
| **Created**         | 2026-02-04                     |
| **Laravel Version** | 12.x                           |
| **PHP Version**     | 8.4+                           |
