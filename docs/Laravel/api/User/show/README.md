# GET /api/v1/users/{user}

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-27

---

## 1. Domain Overview

### Purpose

Retrieves a single user by their ID. Users can view their own profile, or administrators with `users.view` permission can view any user's profile. Uses Laravel Route Model Binding for automatic user lookup and 404 handling.

### Responsibilities

- Resolve user from route parameter via Route Model Binding
- Authorize access via policy (self-view or `users.view` permission)
- Return full user data using BootstrapUserResource

### What It Owns

| Owned              | Description                             |
| ------------------ | --------------------------------------- |
| Single user lookup | Route model binding resolves user by ID |
| View authorization | Policy check for viewing specific user  |

### External Dependencies

| Dependency         | Type           | Purpose                           |
| ------------------ | -------------- | --------------------------------- |
| Database (`users`) | Eloquent       | User lookup via route binding     |
| Laravel Sanctum    | Package        | Authentication verification       |
| Rate Limiter       | Infrastructure | `throttle:api_dynamic` middleware |
| UserPolicy         | Authorization  | `view` permission check           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users/{user}
```

### Authentication

✅ **Required** - Sanctum Bearer token required

### Authorization

✅ **Required** - Via `UserPolicy::view($authUser, $targetUser)`:

- ✅ User viewing their **own** profile (always allowed)
- ✅ User with `users.view` permission (can view any user)

### Rate Limiting

| Limiter       | Key         | Config                     |
| ------------- | ----------- | -------------------------- |
| `api_dynamic` | `user:{id}` | Dynamic based on user role |

### Middleware Stack

```
1. auth:sanctum        → Verifies authentication token
2. throttle:api_dynamic → Dynamic rate limiting based on user role
```

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints               | Example | Description         |
| --------- | --------- | ------------------------- | ------- | ------------------- |
| `user`    | `integer` | Required, exists in users | `123`   | User ID to retrieve |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User retrieved successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    "avatar": "https://cdn.example.com/avatars/123.jpg",
    "frame": "frames/gold",
    "phone": "+923001234567",
    "country": "PK",
    "gender": 1,
    "date_of_birth": "1995-06-15",
    "coins": "15000",
    "diamonds": "500",
    "wealth_xp": "12500",
    "charm_xp": "8750",
    "is_profile_complete": true,
    "is_blocked": false,
    "blocked_at": null,
    "blocked_reason": null,
    "locked_until": null
  },
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\User\\User] 999",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 404,
    "correlation_id": "uuid"
  }
}
```

> **Note**: 404 is automatically returned by Route Model Binding when user ID doesn't exist.

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 401,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 403,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Rate Limited (429)

```json
{
  "status": "error",
  "message": "Too many requests. Please try again later.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 429,
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | User retrieved successfully             |
| `401` | Missing or invalid authentication token |
| `403` | User cannot view this profile           |
| `404` | User with given ID not found            |
| `429` | Rate limit exceeded                     |
| `500` | Unexpected server error                 |

---

## 3. Response Field Reference

### BootstrapUserResource Fields (19 Fields)

| Field                 | Type            | Source                     | Description                                       |
| --------------------- | --------------- | -------------------------- | ------------------------------------------------- |
| `id`                  | `integer`       | `users.id`                 | User primary key                                  |
| `name`                | `string`        | `users.name`               | User display name                                 |
| `signature`           | `string`        | `users.signature`          | Unique 7-digit public identifier                  |
| `avatar`              | `string\|null`  | `users.avatar`             | CDN URL for avatar image                          |
| `frame`               | `string\|null`  | `users.frame`              | Avatar frame identifier (conditional via whenHas) |
| `phone`               | `string\|null`  | `users.phone` (E.164)      | Phone in E.164 format via `getRawPhone()`         |
| `country`       | `string\|null`  | `users.country`      | 2-char ISO country code (e.g., "PK")              |
| `gender`              | `integer\|null` | `users.gender`             | 1=male, 2=female, 3=non-binary, 4=not specified   |
| `date_of_birth`       | `string\|null`  | `users.date_of_birth`      | Date string in YYYY-MM-DD format                  |
| `coins`               | `string`        | `users.coins`              | Coin balance as string                            |
| `diamonds`            | `string`        | `users.diamonds`           | Diamond balance as string                         |
| `wealth_xp`           | `string`        | `users.wealth_xp`          | Wealth XP as string                               |
| `charm_xp`            | `string`        | `users.charm_xp`           | Charm XP as string                                |
| `is_profile_complete` | `boolean`       | Computed                   | True if name, phone, gender, date_of_birth set    |
| `is_blocked`          | `boolean`       | `users.is_blocked`         | Whether user is blocked (defaults to false)       |
| `blocked_at`          | `string\|null`  | `users.blocked_at`         | ISO8601 timestamp when blocked                    |
| `blocked_reason`      | `string\|null`  | `users.blocked_reason`     | Reason for blocking                               |
| `locked_until`        | `string\|null`  | `users.locked_until`       | ISO8601 timestamp for temporary lock expiry       |

---

## 4. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/users/123                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:23                                               │
│ Route: Route::get('/users/{user}', [UserController::class, 'show'])         │
│                                                                             │
│ Route Model Binding:                                                        │
│   • Laravel automatically resolves {user} to User model                     │
│   • SELECT * FROM users WHERE id = 123 LIMIT 1                              │
│   • If not found → 404 ModelNotFoundException before controller             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_dynamic → Dynamic rate limiting by user role              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.2 CONTROLLER METHOD - show()                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:145-152           │
│ Method: show(User $user): JsonResponse                                      │
│                                                                             │
│ Implementation:                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function show(User $user): JsonResponse                          │ │
│ │ {                                                                       │ │
│ │     $this->authorize('view', $user);                                    │ │
│ │                                                                         │ │
│ │     return ApiResponse::success(                                        │ │
│ │         new BootstrapUserResource($user),                               │ │
│ │         'User retrieved successfully'                                   │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Characteristics:                                                        │
│   • Uses Route Model Binding (User injected automatically)                  │
│   • Simple authorization check before returning data                        │
│   • Uses same BootstrapUserResource as index() endpoint                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.3 AUTHORIZATION - UserPolicy::view()                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/User/UserPolicy.php:21-25                                │
│ Method: view(User $user, User $model): bool                                 │
│                                                                             │
│ Logic:                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function view(User $user, User $model): bool                     │ │
│ │ {                                                                       │ │
│ │     // Users can view their own profile,                                │ │
│ │     // or if they have view users permission                            │ │
│ │     return $user->id === $model->id || $user->can('users.view');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Authorization Logic:                                                        │
│   1. Self-view: $user->id === $model->id → ALWAYS ALLOWED                   │
│   2. Admin view: $user->can('users.view') → Permission-based                │
│                                                                             │
│ Failure → 403 Forbidden                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.4 DATA ACCESS / DATABASE QUERY                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ QUERY 1: Route Model Binding (automatic)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM users WHERE id = 123 LIMIT 1                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: Laravel Route Model Binding                                         │
│ Timing: Before controller method executes                                   │
│                                                                             │
│ If user not found → ModelNotFoundException → 404 response                   │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
│ EXTERNAL API CALLS: None                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.5 RESOURCE LAYER - BootstrapUserResource                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php:26-48           │
│ Method: toArray(Request $request): array                                    │
│                                                                             │
│ (Same resource as GET /users - see list/ documentation for full details)   │
│                                                                             │
│ Returns 19 fields with computed is_profile_complete and E.164 phone format. │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│ Method: ApiResponse::success($data, $message)                               │
│                                                                             │
│ RESPONSE FLOW:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. BootstrapUserResource wraps User model                               │ │
│ │         ↓                                                               │ │
│ │ 2. ApiResponse::success() wraps in standard envelope                    │ │
│ │         ↓                                                               │ │
│ │ 3. JSON response with status, message, data, meta                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Uses success() not paginated() since this is a single resource.      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Reusability Matrix

| File                        | Used By Endpoints             | Reusable    | Reasoning                                 |
| --------------------------- | ----------------------------- | ----------- | ----------------------------------------- |
| `UserController.php`        | Multiple `/users/*` endpoints | ⭕ Mixed    | Controller bound to User domain           |
| `BootstrapUserResource.php` | Bootstrap, list, show         | ✅ Reusable | Full user data for authenticated contexts |
| `UserPolicy.php`            | All user actions              | ✅ Reusable | Authorization for all user operations     |
| `ApiResponse.php`           | All API endpoints             | ✅ Reusable | Global response envelope                  |
| `User.php` (Model)          | Entire application            | ✅ Reusable | Core entity model                         |

---

## 6. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source             | Condition                                   |
| ------------------------------ | ------------------ | ------------------------------------------- |
| "This action is unauthorized." | `UserPolicy::view` | Not own profile AND lacks `users.view` perm |

### Not Found Errors (404)

| Error                                         | Source              | Condition             |
| --------------------------------------------- | ------------------- | --------------------- |
| "No query results for model [App\Models\...]" | Route Model Binding | User ID doesn't exist |

### Rate Limit Errors (429)

| Error                                  | Source                 | Condition           |
| -------------------------------------- | ---------------------- | ------------------- |
| "Too many requests. Please try again." | `throttle:api_dynamic` | Rate limit exceeded |

### Edge Cases

| Case                         | Behavior                                      |
| ---------------------------- | --------------------------------------------- |
| Viewing own profile          | Always allowed                                |
| Viewing other user's profile | Requires `users.view` permission              |
| Non-numeric user ID          | Route won't match, 404 from router            |
| Soft-deleted user            | Route Model Binding may include (check model) |
| User ID = 0                  | 404 (no user with ID 0)                       |
| Negative user ID             | Route won't match or 404                      |

---

## 7. Sequence Diagram (Textual)

```
 CLIENT                ROUTER              MIDDLEWARE              CONTROLLER            POLICY
   │                     │                       │                       │                   │
   │ GET /users/123      │                       │                       │                   │
   │────────────────────▶│                       │                       │                   │
   │                     │                       │                       │                   │
   │                     │ 1. Route Model        │                       │                   │
   │                     │    Binding: find      │                       │                   │
   │                     │    User where id=123  │                       │                   │
   │                     │────────┐              │                       │                   │
   │                     │◀───────┘              │                       │                   │
   │                     │   User $user          │                       │                   │
   │                     │                       │                       │                   │
   │                     │──────────────────────▶│                       │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 2. auth:sanctum       │                   │
   │                     │                       │    verify token       │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 3. throttle check     │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │                       │                   │
   │                     │                       │──────────────────────▶│                   │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 4. authorize      │
   │                     │                       │                       │    ('view', $user)│
   │                     │                       │                       │──────────────────▶│
   │                     │                       │                       │                   │
   │                     │                       │                       │   5. check:       │
   │                     │                       │                       │   $authUser->id   │
   │                     │                       │                       │   === $user->id   │
   │                     │                       │                       │   OR users.view   │
   │                     │                       │                       │◀──────────────────│
   │                     │                       │                       │   bool: true      │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 6. Bootstrap      │
   │                     │                       │                       │    UserResource   │
   │                     │                       │                       │────────┐          │
   │                     │                       │                       │◀───────┘          │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 7. ApiResponse::  │
   │                     │                       │                       │    success()      │
   │                     │                       │                       │────────┐          │
   │                     │                       │                       │◀───────┘          │
   │                     │                       │                       │                   │
   │                     │                       │◀──────────────────────│                   │
   │◀────────────────────│                       │                       │                   │
   │                     │                       │                       │                   │
   │  200 OK + JSON      │                       │                       │                   │
   │                     │                       │                       │                   │
```

---

## 8. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                 |
| ------------------------ | ---------------------------------------- |
| New response field       | `BootstrapUserResource::toArray()`       |
| Additional authorization | `UserPolicy::view()` method              |
| Eager load relations     | Controller show() method before resource |
| Auditing/logging views   | Add after authorize(), before response   |

### 📝 Common Modifications

#### Adding Relation Eager Loading

```diff
// UserController.php
public function show(User $user): JsonResponse
{
    $this->authorize('view', $user);

+   // Eager load relations for resource
+   $user->load(['roles', 'activeAgencyMembership.agency']);

    return ApiResponse::success(
        new BootstrapUserResource($user),
        'User retrieved successfully'
    );
}
```

### ⚠️ Common Pitfalls

| Pitfall                      | Prevention                                |
| ---------------------------- | ----------------------------------------- |
| Exposing sensitive user data | Review BootstrapUserResource fields       |
| Missing authorization        | Policy always checked via authorize()     |
| N+1 on relations             | Load relations before passing to resource |
| Large user model memory      | Consider select() for specific fields     |

---

## 9. Comparison: show() vs showPublicProfile()

| Aspect             | `GET /users/{user}`               | `GET /users/profile/{signature}`      |
| ------------------ | --------------------------------- | ------------------------------------- |
| **Lookup by**      | User ID (integer)                 | Signature (string)                    |
| **Authorization**  | Self OR `users.view` permission   | Any authenticated user                |
| **Resource**       | BootstrapUserResource (19 fields) | UserPublicProfileResource (11 fields) |
| **Phone data**     | ✅ Included                       | ❌ Not included (public profile)      |
| **Currency data**  | ✅ Coins, diamonds                | ❌ Not included                       |
| **Gifts received** | ❌ Not included                   | ✅ Cursor-paginated                   |
| **Profile visits** | ❌ Not tracked                    | ✅ Recorded on each view              |
| **Use case**       | Admin/self profile management     | Public profile viewing                |

---

## 10. Document Metadata

| Property         | Value                    |
| ---------------- | ------------------------ |
| **Author**       | API Documentation System |
| **Created**      | 2026-01-27               |
| **Last Updated** | 2026-01-27               |
| **Version**      | 1.0.0                    |
| **Status**       | Complete                 |

### Changelog

| Version | Date       | Changes                       |
| ------- | ---------- | ----------------------------- |
| 1.0.0   | 2026-01-27 | Initial documentation created |
