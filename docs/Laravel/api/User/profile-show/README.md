# GET /api/v1/profile

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Profile Show endpoint returns the authenticated user's complete profile data. This is the primary endpoint for fetching current user information after authentication, used during app initialization and profile screens.

### Responsibilities

- Authenticate request via Sanctum token
- Retrieve authenticated user from request context
- Transform user model to API response format
- Return consistent 17-field user profile structure

### What It Owns

| Owned                   | Description                                         |
| ----------------------- | --------------------------------------------------- |
| Profile data retrieval  | Returns current authenticated user's profile        |
| Response transformation | Converts User model to BootstrapUserResource format |

### External Dependencies

| Dependency            | Type     | Purpose                          |
| --------------------- | -------- | -------------------------------- |
| `users` table         | Database | User data storage                |
| Laravel Sanctum       | Package  | Token authentication             |
| BootstrapUserResource | Resource | Response transformation          |
| ApiResponse           | Utility  | Standardized response formatting |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/profile
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter         | Key        | Config                                                    |
| --------------- | ---------- | --------------------------------------------------------- |
| `throttle.role` | Role-based | Varies by user role (defined in RateLimitServiceProvider) |

### Request Headers

| Header             | Required | Type               | Description                  |
| ------------------ | -------- | ------------------ | ---------------------------- |
| `Accept`           | ✅       | `application/json` | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`   | Sanctum authentication token |
| `X-Correlation-ID` | ❌       | `string (UUID)`    | Request tracing ID           |

### Request Body Schema

**No request body required** - This is a GET request with no parameters.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Profile retrieved successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    "avatar": "https://ik.imagekit.io/flylive/avatars/user_123.jpg",
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

#### Response Field Details

| Field                 | Type           | Description                                      |
| --------------------- | -------------- | ------------------------------------------------ |
| `id`                  | `integer`      | User's unique identifier                         |
| `name`                | `string`       | User's display name                              |
| `signature`           | `string`       | Unique 7-digit user ID (public identifier)       |
| `avatar`              | `string\|null` | ImageKit URL for user's avatar image             |
| `frame`               | `string\|null` | User's equipped frame (if any)                   |
| `phone`               | `string\|null` | Phone number in E.164 format                     |
| `country`             | `string\|null` | ISO 3166-1 alpha-2 country code                  |
| `gender`              | `string\|null` | User's gender: `male`, `female`, or `other`      |
| `date_of_birth`       | `string\|null` | Date of birth in `YYYY-MM-DD` format             |
| `coins`               | `string`       | Virtual currency balance (string for precision)  |
| `diamonds`            | `string`       | Premium currency balance (string for precision)  |
| `wealth_xp`           | `string`       | Wealth experience points (spending activity)     |
| `charm_xp`            | `string`       | Charm experience points (receiving activity)     |
| `is_profile_complete` | `boolean`      | True if name, phone, gender, and DOB are set     |
| `is_blocked`          | `boolean`      | Whether user account is blocked                  |
| `blocked_at`          | `string\|null` | ISO 8601 timestamp when user was blocked         |
| `blocked_reason`      | `string\|null` | Reason for account block                         |
| `locked_until`        | `string\|null` | ISO 8601 timestamp for temporary lock expiration |

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

#### ❌ Rate Limit Exceeded (429)

```json
{
  "status": "error",
  "message": "Too Many Requests",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Profile retrieved successfully          |
| `401` | Unauthenticated (missing/invalid token) |
| `429` | Rate limit exceeded                     |
| `500` | Internal server error                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/profile                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/profile.php:20                                             │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/', [UserProfileController::class, 'show']);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum     → Validates Bearer token, populates $request->user() │
│   2. throttle.role    → Role-based rate limiting                            │
│   3. https.enforce    → Enforces HTTPS in production                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: vendor/laravel/sanctum (middleware)                                   │
│                                                                             │
│ Sanctum Authentication Middleware:                                          │
│   1. Extracts Bearer token from Authorization header                        │
│   2. Validates token against `personal_access_tokens` table                 │
│   3. Populates $request->user() with authenticated User model               │
│   4. If invalid → returns 401 Unauthenticated (never reaches controller)    │
│                                                                             │
│ No FormRequest validation - endpoint has no input parameters.               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserProfileController.php            │
│ Method: show(Request $request) at line 112                                  │
│                                                                             │
│ STEP 1: Get Authenticated User (line 114)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ // User is populated by Sanctum middleware                              │ │
│ │ // Returns User model instance or null                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Null Check (lines 116-118)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Defensive check - should never trigger due to auth:sanctum           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Build Success Response (lines 120-123)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new BootstrapUserResource($user),                                   │ │
│ │     'Profile retrieved successfully'                                    │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No service layer involvement - endpoint accesses user directly from         │
│ request context (already loaded by Sanctum middleware).                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: BootstrapUserResource (API Resource)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php              │ │
│ │ Responsibility: Transform User model to consistent API response         │ │
│ │ Reusable: YES (used by profile, login, register, bootstrap)             │ │
│ │ Why It Exists: Ensures consistent user data shape across all endpoints  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray($request) → Returns 17-field user object                    │ │
│ │   • getRawPhone() → Formats phone to E.164 format                       │ │
│ │   • isProfileComplete() → Checks required fields are set                │ │
│ │                                                                         │ │
│ │ Transformation Logic (lines 28-47):                                     │ │
│ │ ┌───────────────────────────────────────────────────────────────────┐   │ │
│ │ │ return [                                                          │   │ │
│ │ │     'id' => $this->id,                                            │   │ │
│ │ │     'name' => $this->name,                                        │   │ │
│ │ │     'signature' => $this->signature,                              │   │ │
│ │ │     'avatar' => $this->avatar,                                    │   │ │
│ │ │     'frame' => $this->whenHas('frame'),                           │   │ │
│ │ │     'phone' => $this->getRawPhone(),                              │   │ │
│ │ │     'country' => $this->country,                                  │   │ │
│ │ │     'gender' => $this->gender,                                    │   │ │
│ │ │     'date_of_birth' => $this->date_of_birth?->toDateString(),     │   │ │
│ │ │     'coins' => (string) (int) $this->coins,                       │   │ │
│ │ │     'diamonds' => (string) (int) $this->diamonds,                 │   │ │
│ │ │     'wealth_xp' => (string) (int) $this->wealth_xp,               │   │ │
│ │ │     'charm_xp' => (string) (int) $this->charm_xp,                 │   │ │
│ │ │     'is_profile_complete' => $this->isProfileComplete(),          │   │ │
│ │ │     'is_blocked' => $this->is_blocked ?? false,                   │   │ │
│ │ │     'blocked_at' => $this->blocked_at?->toIso8601String(),        │   │ │
│ │ │     'blocked_reason' => $this->blocked_reason,                    │   │ │
│ │ │     'locked_until' => $this->locked_until?->toIso8601String(),    │   │ │
│ │ │ ];                                                                │   │ │
│ │ └───────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User (Eloquent Model)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: Eloquent model representing user entity                 │ │
│ │ Reusable: YES (used across entire application)                          │ │
│ │ Why It Exists: ORM model for database operations                        │ │
│ │                                                                         │ │
│ │ Key Properties Used:                                                    │ │
│ │   • id, name, signature, avatar, frame                                  │ │
│ │   • phone (with PhoneCast), country, gender, date_of_birth              │ │
│ │   • coins, diamonds, wealth_xp, charm_xp                                │ │
│ │   • is_blocked, blocked_at, blocked_reason, locked_until                │ │
│ │                                                                         │ │
│ │ Relevant Casts:                                                         │ │
│ │   • phone → PhoneCast (E.164 formatting)                                │ │
│ │   • date_of_birth → date                                                │ │
│ │   • blocked_at, locked_until → datetime                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility Class)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Ensures consistent response structure                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta, $statusCode) → 200 response         │ │
│ │   • unauthorized($message) → 401 response                               │ │
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
│    Source: Laravel Sanctum middleware                                       │
│                                                                             │
│ 2. SELECT: User retrieval (Sanctum middleware)                              │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: Token's tokenable relationship                                   │
│                                                                             │
│ Note: User is already loaded by Sanctum middleware before controller        │
│       executes. No additional database queries in controller logic.         │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - user data is fetched fresh from database via Sanctum               │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - no background jobs dispatched                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ STEP 1: BootstrapUserResource transforms User model                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php              │ │
│ │                                                                         │ │
│ │ Input: User model ($request->user())                                    │ │
│ │                                                                         │ │
│ │ Transformations:                                                        │ │
│ │   • Numeric fields (coins, diamonds, xp) → Cast to string               │ │
│ │   • Phone → Format to E.164 via PhoneCast                               │ │
│ │   • Dates → Format to ISO 8601 string                                   │ │
│ │   • is_profile_complete → Computed from required fields                 │ │
│ │                                                                         │ │
│ │ Output: 17-field associative array                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: ApiResponse::success() wraps in standard envelope                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php:15-30                              │ │
│ │                                                                         │ │
│ │ Final Response Structure:                                               │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Profile retrieved successfully",                          │ │
│ │   "data": { ... BootstrapUserResource output ... },                     │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "...",                                                 │ │
│ │     "correlation_id": "..."                                             │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                        | Used By Endpoints                   | Reusable    | Reasoning                       |
| --------------------------- | ----------------------------------- | ----------- | ------------------------------- |
| `UserProfileController.php` | Profile endpoints only              | ⭕ Mixed    | Controller is endpoint-specific |
| `BootstrapUserResource.php` | Profile, Login, Register, Bootstrap | ✅ Reusable | Standard user response format   |
| `ApiResponse.php`           | All API endpoints                   | ✅ Reusable | Global response utility         |
| `User.php` (Model)          | Entire application                  | ✅ Reusable | Core user model                 |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                        |
| ----- | ------ | -------------------------------- |
| None  | N/A    | Endpoint has no input parameters |

### Business Logic Errors (400)

| Error | Source | Condition                                 |
| ----- | ------ | ----------------------------------------- |
| None  | N/A    | Endpoint has no business logic validation |

### System Errors (500)

| Error                    | Source                | Condition                        |
| ------------------------ | --------------------- | -------------------------------- |
| Database connection fail | Sanctum middleware    | Unable to validate token         |
| Model serialization fail | BootstrapUserResource | Null pointer on model properties |

### Edge Cases

| Case                    | Behavior                                         |
| ----------------------- | ------------------------------------------------ |
| Token expired           | 401 Unauthenticated (handled by Sanctum)         |
| Token revoked           | 401 Unauthenticated (handled by Sanctum)         |
| User soft deleted       | 401 Unauthenticated (Sanctum checks user exists) |
| Missing optional fields | Returned as null in response                     |
| Large currency values   | Cast to string to preserve precision             |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            RESOURCE               DATABASE
   │                       │                       │                       │                    │
   │  GET /api/v1/profile  │                       │                       │                    │
   │  Authorization: Bearer│                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │    Extract token      │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │                       │                       │                    │
   │                       │                       │                       │    2. SELECT token │
   │                       │                       │                       │    from PAT table  │
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │    3. SELECT user  │
   │                       │                       │                       │    by tokenable_id │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 4. Populate           │                       │                    │
   │                       │    $request->user()   │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 5. throttle.role      │                       │                    │
   │                       │    Check rate limit   │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 6. https.enforce      │                       │                    │
   │                       │    Verify HTTPS       │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 7. Get user from      │                    │
   │                       │                       │    request context    │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 8. Create resource    │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 9. Transform user  │
   │                       │                       │                       │    to 17-field obj │
   │                       │                       │                       │                    │
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │                       │                    │
   │                       │                       │ 10. ApiResponse       │                    │
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

| Addition                    | Location                                            |
| --------------------------- | --------------------------------------------------- |
| New profile field           | 1. Migration 2. User model 3. BootstrapUserResource |
| Profile caching             | Create ProfileService with cache layer              |
| Include user roles          | Add to BootstrapUserResource::toArray()             |
| Include permissions         | Add to BootstrapUserResource::toArray()             |
| Related data (e.g., agency) | Add eager loading and include in resource           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

**Example: Adding `email` to the profile response**

| Step  | File                                                   | What to Change                |
| ----- | ------------------------------------------------------ | ----------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Add field to toArray() method |

**Detailed Code Change:**

```php
// BootstrapUserResource.php - toArray()
return [
    'id' => $this->id,
    'name' => $this->name,
    'email' => $this->email,  // ADD THIS LINE
    'signature' => $this->signature,
    // ... rest of fields
];
```

#### ➕ ADDING COMPUTED FIELD

**Example: Adding `level` computed from XP**

| Step  | File                                                   | What to Change              |
| ----- | ------------------------------------------------------ | --------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Add computed field logic    |
| **2** | Optional: `app/Models/User/User.php`                   | Add level accessor to model |

**Detailed Code Change:**

```php
// Option A: Compute in resource
return [
    // ... existing fields
    'wealth_level' => $this->computeLevel($this->wealth_xp),
    'charm_level' => $this->computeLevel($this->charm_xp),
];

private function computeLevel(int $xp): int
{
    // Level calculation logic
    return (int) floor($xp / 1000);
}

// Option B: Use model accessor
// User.php
public function getWealthLevelAttribute(): int
{
    return (int) floor($this->wealth_xp / 1000);
}

// BootstrapUserResource.php
return [
    // ...
    'wealth_level' => $this->wealth_level,
];
```

#### ➖ REMOVING A FIELD

**Example: Removing `frame` from response**

| Step  | File                                                   | What to Change                    |
| ----- | ------------------------------------------------------ | --------------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Remove field from toArray()       |
| **2** | Frontend                                               | Remove field usage (check impact) |

#### ✏️ MODIFYING FIELD FORMAT

**Example: Changing date_of_birth format to timestamp**

```php
// BEFORE
'date_of_birth' => $this->date_of_birth?->toDateString(),

// AFTER (timestamp)
'date_of_birth' => $this->date_of_birth?->getTimestamp(),

// AFTER (ISO 8601 with time)
'date_of_birth' => $this->date_of_birth?->toIso8601String(),
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GET /api/v1/profile                                                        │
│       │                                                                     │
│       ▼                                                                     │
│  Sanctum Middleware        ← Populates $request->user()                     │
│       │                                                                     │
│       ▼                                                                     │
│  UserProfileController::show()                                              │
│       │                                                                     │
│       ▼                                                                     │
│  BootstrapUserResource     ← Transforms User model                          │
│       │                                                                     │
│       ├──► id, name, signature, avatar, frame     ← Direct from model       │
│       │                                                                     │
│       ├──► phone                                   ← Via getRawPhone()      │
│       │                                                                     │
│       ├──► date_of_birth                           ← Via Carbon::toDateString│
│       │                                                                     │
│       ├──► coins, diamonds, xp values              ← Cast to string         │
│       │                                                                     │
│       └──► is_profile_complete                     ← Computed from fields   │
│                                                                             │
│  ApiResponse::success()    ← Wraps in envelope                              │
│       │                                                                     │
│       ▼                                                                     │
│  JSON Response                                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                              |
| ------------------------------ | --------------------------------------------------- |
| `BootstrapUserResource` fields | Mobile/web clients depend on exact field names      |
| Currency as string format      | Prevents JavaScript precision loss on large numbers |
| is_profile_complete logic      | App onboarding flow depends on this check           |
| Phone E.164 format             | All phone handling expects consistent format        |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                              |
| ----------------------------------- | ------------------------------------------------------- |
| Returning sensitive data (password) | BootstrapUserResource only includes safe fields         |
| Changing field types                | Frontend expects specific types - add new field instead |
| Removing fields                     | Deprecate first, then remove in next major version      |
| Adding expensive computed fields    | Use eager loading or caching for heavy computations     |

### 📁 File Locations Quick Reference

```
routes/api/profile.php:20                        ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserProfileController.php:112-123          ← Controller method
app/Http/Resources/V1/Auth/
  └── BootstrapUserResource.php                  ← Response transformer
app/Models/User/
  └── User.php                                   ← Eloquent model
app/Http/Utils/
  └── ApiResponse.php                            ← Response envelope utility
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                 |
| ------------------- | --------------------- |
| **Endpoint**        | `GET /api/v1/profile` |
| **Domain**          | User                  |
| **Author**          | System Documentation  |
| **Created**         | 2026-02-04            |
| **Laravel Version** | 12.x                  |
| **PHP Version**     | 8.4+                  |
