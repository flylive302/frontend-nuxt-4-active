# GET /api/v1/auth/user

> **Domain**: Authentication  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Returns the authenticated user's profile data for app initialization (bootstrap). This is the primary endpoint called after login to populate the client-side user state.

### Responsibilities

- Return current user's profile information
- Provide balances (coins, diamonds)
- Provide XP values (wealth, charm)
- Provide account status (blocked, locked)
- Indicate profile completion status

### What It Owns

| Owned              | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| User data exposure | Controls which fields are exposed via BootstrapUserResource |

### External Dependencies

| Dependency         | Type     | Purpose             |
| ------------------ | -------- | ------------------- |
| Database (`users`) | Eloquent | User data retrieval |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/auth/user
```

### Authentication

✅ **Required** - Bearer token via `Authorization` header

### Rate Limiting

| Limiter         | Key Pattern           | Limits              |
| --------------- | --------------------- | ------------------- |
| `throttle.role` | Role-based throttling | Varies by user role |

### Middleware Stack

```
1. auth:sanctum    → Authenticates user via Sanctum token
2. throttle.role   → Role-based rate limiting
3. https.enforce   → Forces HTTPS in production
```

### Request Headers

| Header          | Required | Type               | Description         |
| --------------- | -------- | ------------------ | ------------------- |
| `Authorization` | ✅       | `Bearer {token}`   | Valid Sanctum token |
| `Accept`        | ✅       | `application/json` | Response format     |

### Request Body Schema

```json
{}
```

> **Note**: GET request - no body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User profile retrieved successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "1234567",
    "avatar": "https://cdn.example.com/avatars/user123.jpg",
    "frame": "gold_frame",
    "phone": "+15551234567",
    "country": "US",
    "gender": "male",
    "date_of_birth": "1990-05-15",
    "coins": "15000",
    "diamonds": "500",
    "wealth_xp": "12500",
    "charm_xp": "8000",
    "is_profile_complete": true,
    "is_blocked": false,
    "blocked_at": null,
    "blocked_reason": null,
    "locked_until": null
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field                 | Type           | Description                                    |
| --------------------- | -------------- | ---------------------------------------------- |
| `id`                  | `integer`      | User's unique ID                               |
| `name`                | `string\|null` | Display name                                   |
| `signature`           | `string`       | Unique public identifier (7-digit)             |
| `avatar`              | `string\|null` | Avatar image URL                               |
| `frame`               | `string\|null` | User's profile frame (conditional)             |
| `phone`               | `string\|null` | E.164 formatted phone                          |
| `country`             | `string\|null` | ISO 2-letter country code                      |
| `gender`              | `string\|null` | User's gender                                  |
| `date_of_birth`       | `string\|null` | Date in YYYY-MM-DD format                      |
| `coins`               | `string`       | Virtual currency balance (stringified integer) |
| `diamonds`            | `string`       | Premium currency balance (stringified integer) |
| `wealth_xp`           | `string`       | Wealth experience points (stringified)         |
| `charm_xp`            | `string`       | Charm experience points (stringified)          |
| `is_profile_complete` | `boolean`      | True if name, phone, gender, DOB set           |
| `is_blocked`          | `boolean`      | Account permanently blocked                    |
| `blocked_at`          | `string\|null` | ISO 8601 timestamp when blocked                |
| `blocked_reason`      | `string\|null` | Reason for block                               |
| `locked_until`        | `string\|null` | ISO 8601 timestamp until lock expires          |

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | User profile retrieved successfully |
| `401` | Missing or invalid token            |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/auth/user                                    │
│                    Authorization: Bearer {token}                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:44                                                │
│ Route: Route::get('/user', [AuthController::class, 'user']);                │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum   → Validates Bearer token, attaches User to request      │
│   2. throttle.role  → Role-based rate limiting                              │
│   3. https.enforce  → Redirects to HTTPS in production                      │
│                                                                             │
│ If token invalid/missing → 401 Unauthenticated (before controller)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE: auth:sanctum                                                │
│─────────────────────────────────────────────────────────────────────────────│
│ Package: Laravel Sanctum                                                    │
│                                                                             │
│ WHAT IT DOES:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Extract token from Authorization: Bearer {token} header              │ │
│ │ 2. Hash token and lookup in personal_access_tokens table                │ │
│ │ 3. Verify token not expired                                             │ │
│ │ 4. Attach User model to $request->user()                                │ │
│ │                                                                         │ │
│ │ Query: SELECT * FROM personal_access_tokens                             │ │
│ │        WHERE token = SHA256({token})                                    │ │
│ │                                                                         │ │
│ │ Then eager loads User:                                                  │ │
│ │ Query: SELECT * FROM users WHERE id = ?                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Failure → 401 Unauthenticated                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/AuthController.php:108-123           │
│ Method: user(Request $request): JsonResponse                                │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ │ // Note: Should never hit due to auth:sanctum middleware                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return user data via resource                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new BootstrapUserResource($user),                                   │ │
│ │     'User profile retrieved successfully'                               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Controller Responsibilities:                                                │
│   • Get user from request                                                   │
│   • Transform via resource                                                  │
│   • Return response                                                         │
│   • NO service layer needed (simple read operation)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 RESOURCE TRANSFORMATION                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: BootstrapUserResource                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php               │ │
│ │ Responsibility: Transform User model for API response (19 fields)      │ │
│ │ Reusable: YES (Login, Register, /user endpoint)                         │ │
│ │                                                                         │ │
│ │ Fields Returned:                                                        │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ return [                                                            │ │ │
│ │ │     'id'                 => $this->id,                              │ │ │
│ │ │     'name'               => $this->name,                            │ │ │
│ │ │     'signature'          => $this->signature,                       │ │ │
│ │ │     'avatar'             => $this->avatar,                          │ │ │
│ │ │     'frame'              => $this->whenHas('frame'),                │ │ │
│ │ │     'phone'              => $this->getRawPhone(),       // E.164    │ │ │
│ │ │     'country'      => $this->country,                   │ │ │
│ │ │     'gender'             => $this->gender,                          │ │ │
│ │ │     'date_of_birth'      => $this->date_of_birth?->toDateString(),  │ │ │
│ │ │     'coins'              => (string) $this->coins,                  │ │ │
│ │ │     'diamonds'           => (string) $this->diamonds,               │ │ │
│ │ │     'wealth_xp'          => (string) $this->wealth_xp,              │ │ │
│ │ │     'charm_xp'           => (string) $this->charm_xp,               │ │ │
│ │ │     'is_profile_complete'=> $this->isProfileComplete(),             │ │ │
│ │ │     'is_blocked'         => $this->is_blocked ?? false,             │ │ │
│ │ │     'blocked_at'         => $this->blocked_at?->toIso8601String(),  │ │ │
│ │ │     'blocked_reason'     => $this->blocked_reason,                  │ │ │
│ │ │     'locked_until'       => $this->locked_until?->toIso8601String(),│ │ │
│ │ │ ];                                                                  │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ Helper Methods:                                                         │ │
│ │   • getRawPhone() → Formats phone to E.164 via model's phone cast      │ │
│ │   • isProfileComplete() → Returns true if name, phone, gender, DOB set │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT token (auth:sanctum middleware)                                   │
│    Query: SELECT * FROM personal_access_tokens WHERE token = ?              │
│                                                                             │
│ 2. SELECT user (auth:sanctum middleware)                                    │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ Note: User is already loaded by middleware - no additional DB queries       │
│       in controller or resource (model attributes accessed directly)        │
│                                                                             │
│ registration, eliminating the need for PhoneService calls.                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SUCCESS PATH:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(                                                   │ │
│ │     new BootstrapUserResource($user),                                   │ │
│ │     'User profile retrieved successfully'                               │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ → HTTP 200 + JSON envelope:                                             │ │
│ │   {                                                                     │ │
│ │     "status": "success",                                                │ │
│ │     "message": "User profile retrieved successfully",                   │ │
│ │     "data": { ...19 fields from BootstrapUserResource... },             │ │
│ │     "meta": { "timestamp": "...", "correlation_id": "..." }             │ │
│ │   }                                                                     │ │
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

| File                        | Used By Endpoints               | Reusable    | Reasoning                       |
| --------------------------- | ------------------------------- | ----------- | ------------------------------- |
| `AuthController.php`        | Register, Login, Logout, User   | ⭕ Mixed    | Controller is endpoint-specific |
| `BootstrapUserResource.php` | Register, Login, /user, Profile | ✅ Reusable | Standard user data transformer  |
| User `phone` cast           | Register, Login, /user, Profile | ✅ Reusable | E.164 phone formatting          |
| `ApiResponse.php`           | All API endpoints               | ✅ Reusable | Global response envelope        |
| `User.php` (Model)          | Entire application              | ✅ Reusable | User entity model               |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error                     | Source                    | Condition                     |
| ------------------------- | ------------------------- | ----------------------------- |
| "Authentication required" | `AuthController`          | `$request->user()` is null    |
| "Unauthenticated"         | `auth:sanctum` middleware | Invalid/missing/expired token |

### Edge Cases

| Case               | Behavior                                        |
| ------------------ | ----------------------------------------------- |
| User has no DOB    | `date_of_birth` returns null                    |
| User blocked       | Returns data with `is_blocked: true` and reason |
| User locked        | Returns data with `locked_until` timestamp      |
| Profile incomplete | `is_profile_complete: false`                    |
| Frame not set      | `frame` field omitted from response (whenHas)   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER            RESOURCE                DATABASE
   │                     │                       │                    │                      │
   │  GET /user          │                       │                    │                      │
   │  Authorization: ... │                       │                    │                      │
   │────────────────────▶│                       │                    │                      │
   │                     │                       │                    │                      │
   │                     │ 1. auth:sanctum       │                    │                      │
   │                     │    (validate token)   ─────────────────────────────────────────────▶
   │                     │◀─────────────────────────────────── SELECT personal_access_tokens ─│
   │                     │    (load user)        ─────────────────────────────────────────────▶
   │                     │◀─────────────────────────────────── SELECT users WHERE id = ? ─────│
   │                     │                       │                    │                      │
   │                     │ 2. throttle.role      │                    │                      │
   │                     │                       │                    │                      │
   │                     │ 3. Forward to         │                    │                      │
   │                     │    controller         │                    │                      │
   │                     │──────────────────────▶│                    │                      │
   │                     │                       │                    │                      │
   │                     │                       │ 4. Get user        │                      │
   │                     │                       │    $request->user()│                      │
   │                     │                       │                    │                      │
   │                     │                       │ 5. Create resource │                      │
   │                     │                       │───────────────────▶│                      │
   │                     │                       │                    │                      │
   │                     │                       │                    │ 6. Transform         │
   │                     │                       │                    │    user data         │
   │                     │                       │                    │    (18 fields)       │
   │                     │                       │                    │                      │
   │                     │                       │                    │ 7. Phone cast        │
   │                     │                       │                    │    formatE164()      │
   │                     │                       │                    │                      │
   │                     │                       │ 8. Return array    │                      │
   │                     │                       │◀───────────────────│                      │
   │                     │                       │                    │                      │
   │                     │ 9. Build response     │                    │                      │
   │                     │◀──────────────────────│                    │                      │
   │                     │                       │                    │                      │
   │◀────────────────────│                       │                    │                      │
   │                     │                       │                    │                      │
   │  200 + User JSON    │                       │                    │                      │
   │                     │                       │                    │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| New user field in response    | Add to `BootstrapUserResource::toArray()`                  |
| Eager load relationships      | Modify auth:sanctum middleware or create custom            |
| Additional user data endpoint | Create separate controller/resource                        |
| User preferences              | Add to BootstrapUserResource or create PreferencesResource |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `email_verified`)

| Step  | File                                              | What to Change               |
| ----- | ------------------------------------------------- | ---------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Add field to `toArray()`     |
| **2** | Update API documentation                          | Add field to response schema |
| **3** | Frontend                                          | Update TypeScript types      |

**Code Change:**

```php
// BootstrapUserResource::toArray()
return [
    // ... existing fields
    'email_verified' => $this->hasVerifiedEmail(),  // ADD
];
```

#### ➖ REMOVING A FIELD

| Step  | File                                              | What to Change              |
| ----- | ------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Remove from `toArray()`     |
| **2** | **Coordinate with frontend**                      | Breaking change!            |
| **3** | Update API documentation                          | Remove from response schema |

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                           |
| --------------------------- | ------------------------------------------------ |
| `auth:sanctum` middleware   | Core authentication                              |
| Balances as strings         | Frontend expects string format for large numbers |
| `is_profile_complete` logic | Affects onboarding flow                          |
| Field naming conventions    | Breaking change for clients                      |

### 🚨 Common Pitfalls

| Pitfall                        | Prevention                                    |
| ------------------------------ | --------------------------------------------- |
| N+1 queries from relationships | Don't add relationships without eager loading |
| Exposing sensitive data        | Review all fields before adding               |
| Breaking numeric precision     | Keep large numbers as strings                 |
| Forgetting null safety         | Use null-safe operators (`?->`)               |

### 📁 File Locations Quick Reference

```
routes/api/auth.php:44                           ← Route definition
app/Http/Controllers/Api/V1/Auth/
  └── AuthController.php:108-123                 ← Controller method
app/Http/Resources/V1/
  └── BootstrapUserResource.php                  ← Response transformer
app/Models/User/
  └── User.php (phone cast)                      ← E.164 phone formatting
app/Models/User/
  └── User.php                                   ← User model
```

---

## Document Metadata

| Property            | Value                   |
| ------------------- | ----------------------- |
| **Endpoint**        | `GET /api/v1/auth/user` |
| **Domain**          | Authentication          |
| **Author**          | System Documentation    |
| **Created**         | 2026-01-27              |
| **Laravel Version** | 12.x                    |
| **PHP Version**     | 8.4                     |
