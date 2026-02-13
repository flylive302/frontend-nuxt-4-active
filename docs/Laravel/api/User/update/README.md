# PUT /api/v1/users/{user}

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Updates an existing user's profile. Users can update their own profile, or administrators (Super Admin, Admin, Moderator) can update any user's profile. Supports partial updates with field-level validation and unique constraint handling.

### Responsibilities

- Authorize via policy (self-update or admin role)
- Validate only provided fields (partial updates)
- Handle unique constraint exclusion for email/signature
- Delegate to UserService for profile update
- Password hashing handled automatically by Model's `hashed` cast
- Refresh and return updated user data

### What It Owns

| Owned                | Description                             |
| -------------------- | --------------------------------------- |
| Profile update logic | Password hashing, partial field updates |
| Self-update access   | Users can update their own profile      |
| Admin update access  | Admins can update any user profile      |

### External Dependencies

| Dependency         | Type           | Purpose                              |
| ------------------ | -------------- | ------------------------------------ |
| Database (`users`) | Eloquent       | User update                          |
| Laravel Sanctum    | Package        | Authentication verification          |
| Rate Limiter       | Infrastructure | `throttle:api_creator` middleware    |
| UserService        | Service        | Orchestrates update via UpdateAction |
| UpdateUserAction   | Action         | Handles update via direct Eloquent   |
| PhoneService       | Service        | Phone number validation              |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/users/{user}
```

### Authentication

✅ **Required** - Sanctum Bearer token required

### Authorization

✅ **Required** - Via `UpdateUserProfileRequest::authorize()`:

- ✅ User updating their **own** profile (always allowed)
- ✅ User with role: Super Admin, Admin, or Moderator (can update any user)

### Rate Limiting

| Limiter       | Key         | Config                           |
| ------------- | ----------- | -------------------------------- |
| `api_creator` | `user:{id}` | Higher limits for elevated roles |

### Middleware Stack

```
1. auth:sanctum        → Verifies authentication token
2. throttle:api_creator → Rate limiting for creator actions
```

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |
| `Content-Type`  | ✅       | `application/json` | Request body format  |

### Path Parameters

| Parameter | Type      | Constraints               | Example | Description       |
| --------- | --------- | ------------------------- | ------- | ----------------- |
| `user`    | `integer` | Required, exists in users | `123`   | User ID to update |

---

## 3. Request Body Schema

All fields are optional (partial updates supported). Only include fields you want to change.

### Updatable Fields

| Field                   | Type      | Constraints                            | Example                  |
| ----------------------- | --------- | -------------------------------------- | ------------------------ |
| `name`                  | `string`  | Max 255 chars                          | `"John Doe Updated"`     |
| `email`                 | `string`  | Valid email, unique (excluding self)   | `"john.new@example.com"` |
| `password`              | `string`  | Min 8, complex regex                   | `"NewSecurePass123!"`    |
| `password_confirmation` | `string`  | Must match password (if password set)  | `"NewSecurePass123!"`    |
| `phone`                 | `string`  | Valid phone number, nullable           | `"+923009876543"`        |
| `country`               | `string`  | 2-char ISO code                        | `"PK"`                   |
| `gender`                | `integer` | 1, 2, 3, or 4; nullable                | `2`                      |
| `date_of_birth`         | `string`  | Valid date format; nullable            | `"1990-05-15"`           |
| `signature`             | `string`  | Max 100 chars, unique (excluding self) | `"1234567"`              |

### Gender Values

| Value | Description   |
| ----- | ------------- |
| `1`   | Male          |
| `2`   | Female        |
| `3`   | Non-binary    |
| `4`   | Not specified |

### Password Validation Regex

```regex
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$
```

### Example Request Body (Partial Update)

```json
{
  "name": "John Doe Updated",
  "gender": 1,
  "date_of_birth": "1995-06-15"
}
```

### Example Request Body (With Password Change)

```json
{
  "password": "NewSecurePass123!",
  "password_confirmation": "NewSecurePass123!"
}
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User profile updated successfully",
  "data": {
    "id": 123,
    "name": "John Doe Updated",
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

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "email": ["This email address is already taken."],
    "password": [
      "The password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    ]
  },
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 422,
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

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | User updated successfully               |
| `401` | Missing or invalid authentication token |
| `403` | User cannot update this profile         |
| `404` | User with given ID not found            |
| `422` | Validation failed                       |
| `429` | Rate limit exceeded                     |
| `500` | Database or unexpected server error     |

---

## 4. Response Field Reference

### BootstrapUserResource Fields (19 Fields)

| Field                 | Type            | Source                 | Description                                       |
| --------------------- | --------------- | ---------------------- | ------------------------------------------------- |
| `id`                  | `integer`       | `users.id`             | User primary key                                  |
| `name`                | `string`        | `users.name`           | User display name                                 |
| `signature`           | `string`        | `users.signature`      | Unique 7-digit public identifier                  |
| `avatar`              | `string\|null`  | `users.avatar`         | CDN URL for avatar image                          |
| `frame`               | `string\|null`  | `users.frame`          | Avatar frame identifier (conditional via whenHas) |
| `phone`               | `string\|null`  | `users.phone` (E.164)  | Phone in E.164 format via `getRawPhone()`         |
| `country`             | `string\|null`  | `users.country`        | 2-char ISO country code (e.g., "PK")              |
| `gender`              | `integer\|null` | `users.gender`         | 1=male, 2=female, 3=non-binary, 4=not specified   |
| `date_of_birth`       | `string\|null`  | `users.date_of_birth`  | Date string in YYYY-MM-DD format                  |
| `coins`               | `string`        | `users.coins`          | Coin balance as string                            |
| `diamonds`            | `string`        | `users.diamonds`       | Diamond balance as string                         |
| `wealth_xp`           | `string`        | `users.wealth_xp`      | Wealth XP as string                               |
| `charm_xp`            | `string`        | `users.charm_xp`       | Charm XP as string                                |
| `is_profile_complete` | `boolean`       | Computed               | True if name, phone, gender, date_of_birth set    |
| `is_blocked`          | `boolean`       | `users.is_blocked`     | Whether user is blocked (defaults to false)       |
| `blocked_at`          | `string\|null`  | `users.blocked_at`     | ISO8601 timestamp when blocked                    |
| `blocked_reason`      | `string\|null`  | `users.blocked_reason` | Reason for blocking                               |
| `locked_until`        | `string\|null`  | `users.locked_until`   | ISO8601 timestamp for temporary lock expiry       |

---

## 5. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    PUT /api/v1/users/123                                    │
│                    Body: { name: "Updated Name", gender: 1 }                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:29                                               │
│ Route: Route::put('/users/{user}', [UserController::class, 'update'])       │
│                                                                             │
│ Route Model Binding:                                                        │
│   • Laravel automatically resolves {user} to User model                     │
│   • If not found → 404 before controller                                    │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_creator → Rate limiting for creator actions               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.2 FORM REQUEST - UpdateUserProfileRequest                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/UpdateUserProfileRequest.php            │
│                                                                             │
│ AUTHORIZATION CHECK:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     $routeUser = $this->route('user');                                  │ │
│ │     $currentUser = $this->user();                                       │ │
│ │                                                                         │ │
│ │     // Get user ID from route parameter                                 │ │
│ │     $userId = $routeUser->id;                                           │ │
│ │                                                                         │ │
│ │     // Allow self-update OR admin roles                                 │ │
│ │     return $currentUser->id === $userId ||                              │ │
│ │         $currentUser->hasAnyRole(['Super Admin', 'Admin', 'Moderator']);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ VALIDATION RULES (all 'sometimes' - partial update):                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name'          => ['sometimes', 'string', 'max:255']                   │ │
│ │ 'email'         => ['sometimes', 'email', 'max:255',                    │ │
│ │                     'unique:users,email,' . $userId]                    │ │
│ │ 'password'      => ['sometimes', 'string', 'min:8', 'confirmed',        │ │
│ │                     'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)             │ │
│ │                             (?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/']         │ │
│ │ 'phone'         => ['sometimes', 'nullable', phoneValidationRule()]     │ │
│ │ 'gender'        => ['sometimes', 'nullable', 'integer', 'in:1,2,3,4']   │ │
│ │ 'date_of_birth' => ['sometimes', 'nullable', 'date']                    │ │
│ │ 'country' => ['sometimes', countryRules()]                   │ │
│ │ 'signature'     => ['sometimes', 'nullable', 'string', 'max:100',       │ │
│ │                     'unique:users,signature,' . $userId]                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key: 'unique:users,email,' . $userId → Excludes current user from unique   │
│      check so user can keep their existing email/signature                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.3 CONTROLLER METHOD - update()                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:161-182           │
│ Method: update(UpdateUserProfileRequest $request, User $user): JsonResponse │
│                                                                             │
│ STEP 1: Delegate to UserService                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Authorization handled by FormRequest                                 │ │
│ │ $freshUser = $this->userService->updateUserProfile(                     │ │
│ │     $user,                                                              │ │
│ │     $request->validated()                                               │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // UserService internally:                                              │ │
│ │ // - Creates UpdateUserDTO from validated array                         │ │
│ │ // - Uses UpdateUserAction with direct Eloquent (User::findOrFail)      │ │
│ │ // - Password hashing handled by Model's 'hashed' cast                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new BootstrapUserResource($freshUser),                              │ │
│ │     'User profile updated successfully'                                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EXCEPTION HANDLING:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ catch (NumberParseException|InvalidPhoneNumberException $e) {           │ │
│ │     return $this->errorResponder->validationError(                      │ │
│ │         ['phone' => [$e->getMessage()]],                                │ │
│ │         'Phone number validation failed'                                │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │ catch (UserUpdateException $e) {                                        │ │
│ │     return $this->errorResponder->serverError($e->getMessage());        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.4 DATA ACCESS / DATABASE OPERATIONS                                       │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ QUERY 1: Route Model Binding (automatic)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM users WHERE id = 123 LIMIT 1                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ QUERY 2: Update user                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ UPDATE users                                                            │ │
│ │ SET name = 'Updated Name',                                              │ │
│ │     gender = 1,                                                         │ │
│ │     updated_at = now()                                                  │ │
│ │ WHERE id = 123                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ QUERY 3: Fresh fetch after update                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM users WHERE id = 123 LIMIT 1                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
│ EXTERNAL API CALLS: None                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Reusability Matrix

| File                           | Used By Endpoints             | Reusable    | Reasoning                                 |
| ------------------------------ | ----------------------------- | ----------- | ----------------------------------------- |
| `UserController.php`           | Multiple `/users/*` endpoints | ⭕ Mixed    | Controller bound to User domain           |
| `UpdateUserProfileRequest.php` | This endpoint, profile update | ⭕ Limited  | Shared for user profile updates           |
| `BaseUserRequest.php`          | Create, Update requests       | ✅ Reusable | Shared phone validation logic             |
| `BootstrapUserResource.php`    | Bootstrap, list, show, update | ✅ Reusable | Full user data for authenticated contexts |
| `ApiResponse.php`              | All API endpoints             | ✅ Reusable | Global response envelope                  |
| `ApiErrorResponder.php`        | All API endpoints             | ✅ Reusable | Centralized error formatting              |
| `User.php` (Model)             | Entire application            | ✅ Reusable | Core entity model                         |

---

## 7. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source                                | Condition                          |
| ------------------------------ | ------------------------------------- | ---------------------------------- |
| "This action is unauthorized." | `UpdateUserProfileRequest::authorize` | Not own profile AND not admin role |

### Validation Errors (422)

| Field       | Error Message                                 | Condition                    |
| ----------- | --------------------------------------------- | ---------------------------- |
| `email`     | "This email address is already taken."        | Duplicate email (other user) |
| `password`  | "The password must be at least 8 characters." | Password too short           |
| `password`  | "The password must contain..."                | Missing required characters  |
| `password`  | "The password confirmation does not match."   | Confirmation mismatch        |
| `signature` | "This signature is already taken."            | Duplicate signature (other)  |
| `gender`    | "The selected gender is invalid."             | Value not in 1,2,3,4         |
| `phone`     | "Invalid phone number format"                 | Phone parse error            |

### Not Found Errors (404)

| Error                                         | Source              | Condition             |
| --------------------------------------------- | ------------------- | --------------------- |
| "No query results for model [App\Models\...]" | Route Model Binding | User ID doesn't exist |

### Edge Cases

| Case                           | Behavior                                        |
| ------------------------------ | ----------------------------------------------- |
| Empty request body             | 200 success (no fields updated)                 |
| Update own profile             | Always allowed for authenticated user           |
| Admin updating other user      | Allowed for Super Admin, Admin, Moderator       |
| User updating other user       | 403 Forbidden                                   |
| Same email as current          | Passes (unique excludes current user)           |
| Same signature as current      | Passes (unique excludes current user)           |
| Password without confirmation  | 422 "confirmation does not match"               |
| Setting field to null          | Works for nullable fields                       |
| Invalid gender value (e.g., 5) | 422 "The selected gender is invalid"            |
| Updating blocked user          | Allowed (blocked status unchanged unless admin) |

---

## 8. Sequence Diagram (Textual)

```
 CLIENT               ROUTER              FORM REQUEST           CONTROLLER            DATABASE
   │                     │                       │                       │                   │
   │ PUT /users/123      │                       │                       │                   │
   │   { name, gender }  │                       │                       │                   │
   │────────────────────▶│                       │                       │                   │
   │                     │                       │                       │                   │
   │                     │ 1. Route Model        │                       │                   │
   │                     │    Binding: User#123  │                       │                   │
   │                     │────────┐              │                       │                   │
   │                     │◀───────┘              │                       │                   │
   │                     │                       │                       │                   │
   │                     │──────────────────────▶│                       │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 2. auth:sanctum       │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 3. authorize()        │                   │
   │                     │                       │    self OR admin?     │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │   true                │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 4. rules()            │                   │
   │                     │                       │    validate fields    │                   │
   │                     │                       │    (sometimes)        │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │                       │                   │
   │                     │                       │──────────────────────▶│                   │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 5. validated()    │
   │                     │                       │                       │────────┐          │
   │                     │                       │                       │◀───────┘          │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 6. UPDATE users   │
   │                     │                       │                       │──────────────────▶│
   │                     │                       │                       │◀──────────────────│
   │                     │                       │                       │                   │
   │                     │                       │                       │ 7. fresh()        │
   │                     │                       │                       │──────────────────▶│
   │                     │                       │                       │◀──────────────────│
   │                     │                       │                       │                   │
   │                     │                       │                       │ 8. Bootstrap      │
   │                     │                       │                       │    UserResource   │
   │                     │                       │                       │────────┐          │
   │                     │                       │                       │◀───────┘          │
   │                     │                       │                       │                   │
   │                     │◀─────────────────────────────────────────────│                   │
   │◀────────────────────│                       │                       │                   │
   │                     │                       │                       │                   │
   │  200 OK + JSON      │                       │                       │                   │
   │                     │                       │                       │                   │
```

---

## 9. Comparison: update() vs adminUpdate()

| Aspect               | `PUT /users/{user}` (update) | `PUT /users/{user}/admin` (adminUpdate) |
| -------------------- | ---------------------------- | --------------------------------------- |
| **Authorization**    | Self OR admin roles          | Permission-based                        |
| **Updatable fields** | Profile fields only          | Profile + roles + permissions           |
| **Role assignment**  | ❌ Not supported             | ✅ `syncRoles()`                        |
| **Permission sync**  | ❌ Not supported             | ✅ `syncPermissions()`                  |
| **Use case**         | Users updating their profile | Admin managing user accounts            |

---

## 10. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                       | Location                                        |
| ------------------------------ | ----------------------------------------------- |
| New updatable field            | UpdateUserProfileRequest rules + User $fillable |
| Additional authorization check | UpdateUserProfileRequest::authorize()           |
| Avatar upload handling         | Separate upload action or add file validation   |
| Audit logging for changes      | Add observer or event after $user->update()     |
| Email change verification      | Dispatch verification email if email changes    |

### ⚠️ Common Pitfalls

| Pitfall                            | Prevention                                        |
| ---------------------------------- | ------------------------------------------------- |
| Unique constraint race condition   | DB-level unique index prevents duplicates         |
| Password stored in plain text      | Always check isset() before Hash::make()          |
| Stale data in response             | Use fresh() to get updated model                  |
| Over-permissive authorization      | Check role hierarchy if needed                    |
| Currency field updates via profile | Not in UpdateUserProfileRequest, use admin update |

---

## 11. Document Metadata

| Property         | Value                    |
| ---------------- | ------------------------ |
| **Author**       | API Documentation System |
| **Created**      | 2026-01-27               |
| **Last Updated** | 2026-01-28               |
| **Version**      | 1.0.0                    |
| **Status**       | Complete                 |

### Changelog

| Version | Date       | Changes                              |
| ------- | ---------- | ------------------------------------ |
| 1.1.0   | 2026-01-28 | Updated to reflect Eloquent refactor |
| 1.0.0   | 2026-01-27 | Initial documentation created        |
