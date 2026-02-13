# POST /api/v1/users

> **Domain**: User  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Creates a new user in the system. This is an admin-level endpoint requiring `users.create` permission. Handles password hashing, role assignment, phone validation, and uses database transactions for atomicity.

### Responsibilities

- Authorize via `users.create` permission
- Validate user input with complex password rules
- Delegate to UserService for user creation
- Password hashing handled automatically by Model's `hashed` cast
- Assign roles via CreateUserAction if provided
- Return created user data

### What It Owns

| Owned               | Description                                   |
| ------------------- | --------------------------------------------- |
| User creation logic | Password hashing, role assignment, validation |
| Transaction wrap    | Ensures atomicity of user + role assignment   |

### External Dependencies

| Dependency         | Type           | Purpose                               |
| ------------------ | -------------- | ------------------------------------- |
| Database (`users`) | Eloquent       | User creation                         |
| Database (`roles`) | Eloquent       | Role assignment via Spatie            |
| Laravel Sanctum    | Package        | Authentication verification           |
| Rate Limiter       | Infrastructure | `throttle:api_creator` middleware     |
| UserService        | Service        | Orchestrates user creation via Action |
| CreateUserAction   | Action         | Handles transaction + role assignment |
| PhoneService       | Service        | Phone number validation               |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/users
```

### Authentication

✅ **Required** - Sanctum Bearer token required

### Authorization

✅ **Required** - `users.create` permission via CreateUserRequest::authorize()

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

---

## 3. Request Body Schema

### Required Fields

| Field                   | Type     | Constraints                    | Example              |
| ----------------------- | -------- | ------------------------------ | -------------------- |
| `name`                  | `string` | Required, max 255 chars        | `"John Doe"`         |
| `email`                 | `string` | Required, valid email, unique  | `"john@example.com"` |
| `password`              | `string` | Required, min 8, complex regex | `"SecurePass123!"`   |
| `password_confirmation` | `string` | Required, must match password  | `"SecurePass123!"`   |

### Optional Fields

| Field       | Type      | Constraints                                 | Default | Example           |
| ----------- | --------- | ------------------------------------------- | ------- | ----------------- |
| `phone`     | `string`  | Valid phone number                          | `null`  | `"+923001234567"` |
| `country`   | `string`  | 2-char ISO code                             | `null`  | `"PK"`            |
| `signature` | `string`  | Max 100 chars, unique                       | `null`  | `"3592010"`       |
| `wealth_xp` | `numeric` | Min 0                                       | `0`     | `1000.50`         |
| `charm_xp`  | `numeric` | Min 0                                       | `0`     | `500.25`          |
| `coins`     | `numeric` | Min 0                                       | `0`     | `5000`            |
| `diamonds`  | `numeric` | Min 0                                       | `0`     | `100`             |
| `roles`     | `array`   | Max 5 items, each must exist in roles table | `[]`    | `["user"]`        |

### Password Validation Regex

```regex
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$
```

**Requirements:**

- At least one lowercase letter
- At least one uppercase letter
- At least one digit
- At least one special character (@$!%\*?&)
- Minimum 8 characters

### Example Request Body

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "password_confirmation": "SecurePass123!",
  "phone": "+923001234567",
  "country": "PK",
  "signature": "3592010",
  "wealth_xp": 0,
  "charm_xp": 0,
  "coins": 1000,
  "diamonds": 50,
  "roles": ["user"]
}
```

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "User created successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    "avatar": null,
    "frame": null,
    "gender": null,
    "email": "john.doe@example.com",
    "phone": "+923001234567",
    "country": "PK",
    "date_of_birth": null,
    "wealth_xp": "0",
    "charm_xp": "0"
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
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)."
    ]
  },
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 422,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Phone Validation Error (422)

```json
{
  "status": "error",
  "message": "Phone number validation failed",
  "data": null,
  "errors": {
    "phone": ["Invalid phone number format"]
  },
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 422,
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
| `201` | User created successfully               |
| `401` | Missing or invalid authentication token |
| `403` | User lacks `users.create` permission    |
| `422` | Validation failed                       |
| `429` | Rate limit exceeded                     |
| `500` | Database or unexpected server error     |

---

## 4. Response Field Reference

### MinimalUserResource Fields (12 Fields)

| Field           | Type            | Source                | Description                                       |
| --------------- | --------------- | --------------------- | ------------------------------------------------- |
| `id`            | `integer`       | `users.id`            | User primary key                                  |
| `name`          | `string`        | `users.name`          | User display name                                 |
| `signature`     | `string`        | `users.signature`     | Unique 7-digit public identifier                  |
| `avatar`        | `string\|null`  | `users.avatar`        | CDN URL for avatar image                          |
| `frame`         | `string\|null`  | `users.frame`         | Avatar frame identifier (conditional via whenHas) |
| `gender`        | `integer\|null` | `users.gender`        | 1=male, 2=female, 3=non-binary, 4=not specified   |
| `email`         | `string`        | `users.email`         | User email address                                |
| `phone`         | `string\|null`  | `users.phone`         | Phone number (stored format)                      |
| `country`       | `string\|null`  | `users.country`       | 2-char ISO country code (e.g., "PK")              |
| `date_of_birth` | `string\|null`  | `users.date_of_birth` | Date string in YYYY-MM-DD format                  |
| `wealth_xp`     | `string`        | `users.wealth_xp`     | Wealth XP as string                               |
| `charm_xp`      | `string`        | `users.charm_xp`      | Charm XP as string                                |

---

## 5. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/users                                       │
│                    Body: { name, email, password, ... }                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:28                                               │
│ Route: Route::post('/users', [UserController::class, 'store'])              │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_creator → Rate limiting for creator actions               │
│                                                                             │
│ Route Group Context:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::middleware('throttle:api_creator')->group(function () {      │ │
│ │         Route::post('/users', [UserController::class, 'store']);        │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.2 FORM REQUEST - CreateUserRequest                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/CreateUserRequest.php                   │
│                                                                             │
│ AUTHORIZATION CHECK (before validation):                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user()?->can('users.create') ?? false;                │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Returns false → 403 Forbidden                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ VALIDATION RULES:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name'      => ['required', 'string', 'max:255']                        │ │
│ │ 'email'     => ['required', 'email', 'max:255', 'unique:users,email']   │ │
│ │ 'password'  => ['required', 'string', 'min:8', 'confirmed',             │ │
│ │                 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)                  │ │
│ │                         (?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/']           │ │
│ │ 'phone'     => ['nullable', phoneValidationRule()]                      │ │
│ │ 'country' => countryRules()                                  │ │
│ │ 'signature' => ['nullable', 'string', 'max:100', 'unique:users']        │ │
│ │ 'wealth_xp' => ['nullable', 'numeric', 'min:0']                         │ │
│ │ 'charm_xp'  => ['nullable', 'numeric', 'min:0']                         │ │
│ │ 'coins'     => ['nullable', 'numeric', 'min:0']                         │ │
│ │ 'diamonds'  => ['nullable', 'numeric', 'min:0']                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation failed → 422 with field-specific errors                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.3 CONTROLLER METHOD - store()                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:115-145           │
│ Method: store(CreateUserRequest $request): JsonResponse                     │
│                                                                             │
│ STEP 1: Create DTO from validated request                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = new CreateUserDTO(                                               │ │
│ │     name: $request->validated('name'),                                  │ │
│ │     email: $request->validated('email'),                                │ │
│ │     password: $request->validated('password'), // NOT hashed here       │ │
│ │     phone: $request->validated('phone'),                                │ │
│ │     country: $request->validated('country'),                            │ │
│ │     signature: $request->validated('signature'),                        │ │
│ │     roles: $request->validated('roles')                                 │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // Password hashing handled by Model's 'hashed' cast automatically     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to UserService                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $this->userService->createUser($dto);                           │ │
│ │                                                                         │ │
│ │ // UserService internally uses CreateUserAction which:                  │ │
│ │ // - Wraps in DB::transaction()                                         │ │
│ │ // - Creates user via User::create() (direct Eloquent)                  │ │
│ │ // - Assigns roles if provided                                          │ │
│ │ // - Auto-generates signature if not provided                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new MinimalUserResource($user),                                     │ │
│ │     'User created successfully',                                        │ │
│ │     [],                                                                 │ │
│ │     201  // HTTP 201 Created                                            │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EXCEPTION HANDLING:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ catch (UserCreationException $e) {                                      │ │
│ │     return $this->errorResponder->serverError($e->getMessage());        │ │
│ │ }                                                                       │ │
│ │ catch (NumberParseException|InvalidPhoneNumberException $e) {           │ │
│ │     return $this->errorResponder->validationError(                      │ │
│ │         ['phone' => [$e->getMessage()]],                                │ │
│ │         'Phone number validation failed'                                │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5.4 DATA ACCESS / DATABASE OPERATIONS                                       │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ TRANSACTION BOUNDARY:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ BEGIN TRANSACTION                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ QUERY 1: Insert user                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ INSERT INTO users (name, email, password, phone, country,         │ │
│ │                    signature, wealth_xp, charm_xp, coins, diamonds,     │ │
│ │                    created_at, updated_at)                              │ │
│ │ VALUES (...)                                                            │ │
│ │ RETURNING id                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: User::create() (direct Eloquent model)                              │
│                                                                             │
│ QUERY 2: Assign roles (if roles provided)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM roles WHERE name IN ('user') AND guard_name = 'web'       │ │
│ │                                                                         │ │
│ │ INSERT INTO model_has_roles (role_id, model_type, model_id)             │ │
│ │ VALUES (role_id, 'App\Models\User\User', user_id)                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: $user->assignRole()                                                 │
│                                                                             │
│ TRANSACTION END:                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMMIT  (on success)                                                    │ │
│ │ ROLLBACK (on any exception)                                             │ │
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
│                    201 Created + JSON Body                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Reusability Matrix

| File                      | Used By Endpoints             | Reusable    | Reasoning                                |
| ------------------------- | ----------------------------- | ----------- | ---------------------------------------- |
| `UserController.php`      | Multiple `/users/*` endpoints | ⭕ Mixed    | Controller bound to User domain          |
| `CreateUserRequest.php`   | This endpoint only            | ⭕ Limited  | Specific validation for user creation    |
| `BaseUserRequest.php`     | Create, Update requests       | ✅ Reusable | Shared phone validation logic            |
| `MinimalUserResource.php` | Store, search, nested refs    | ✅ Reusable | Minimal user data for creation responses |
| `ApiResponse.php`         | All API endpoints             | ✅ Reusable | Global response envelope                 |
| `ApiErrorResponder.php`   | All API endpoints             | ✅ Reusable | Centralized error formatting             |
| `User.php` (Model)        | Entire application            | ✅ Reusable | Core entity model                        |
| `Hash` Facade             | Auth, user operations         | ✅ Reusable | Password hashing                         |

---

## 7. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source                         | Condition                            |
| ------------------------------ | ------------------------------ | ------------------------------------ |
| "This action is unauthorized." | `CreateUserRequest::authorize` | User lacks `users.create` permission |

### Validation Errors (422)

| Field       | Error Message                                 | Condition                   |
| ----------- | --------------------------------------------- | --------------------------- |
| `name`      | "The name field is required."                 | Missing name                |
| `email`     | "This email address is already taken."        | Duplicate email             |
| `email`     | "The email must be a valid email address."    | Invalid email format        |
| `password`  | "The password must be at least 8 characters." | Password too short          |
| `password`  | "Password must contain..."                    | Missing required characters |
| `password`  | "The password confirmation does not match."   | Confirmation mismatch       |
| `signature` | "This signature is already taken."            | Duplicate signature         |
| `phone`     | "Invalid phone number format"                 | Phone parse error           |

### Rate Limit Errors (429)

| Error                                  | Source                 | Condition           |
| -------------------------------------- | ---------------------- | ------------------- |
| "Too many requests. Please try again." | `throttle:api_creator` | Rate limit exceeded |

### System Errors (500)

| Error                       | Source              | Condition            |
| --------------------------- | ------------------- | -------------------- |
| Database connection failure | `User::create()`    | DB unavailable       |
| Transaction failure         | `DB::transaction()` | Constraint violation |

### Edge Cases

| Case                          | Behavior                                    |
| ----------------------------- | ------------------------------------------- |
| Missing password_confirmation | 422 "password confirmation does not match"  |
| Weak password                 | 422 with specific regex requirement message |
| Phone without country         | May pass; country optional                  |
| Duplicate signature           | 422 "This signature is already taken"       |
| Negative XP/currency values   | 422 "min:0" validation fails                |
| Empty roles array             | No role assignment, user has no roles       |
| Non-existent role name        | Spatie throws exception (500)               |
| Email with whitespace         | Trimmed by Laravel, then validated          |
| Very long name (>255)         | 422 validation fails                        |

---

## 8. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              FORM REQUEST           CONTROLLER            DATABASE
   │                       │                       │                       │                   │
   │ POST /users           │                       │                       │                   │
   │   { name, email,      │                       │                       │                   │
   │     password, ... }   │                       │                       │                   │
   │──────────────────────▶│                       │                       │                   │
   │                       │                       │                       │                   │
   │                       │ 1. auth:sanctum       │                       │                   │
   │                       │    verify token       │                       │                   │
   │                       │────────┐              │                       │                   │
   │                       │◀───────┘              │                       │                   │
   │                       │                       │                       │                   │
   │                       │ 2. throttle check     │                       │                   │
   │                       │────────┐              │                       │                   │
   │                       │◀───────┘              │                       │                   │
   │                       │                       │                       │                   │
   │                       │──────────────────────▶│                       │                   │
   │                       │                       │                       │                   │
   │                       │                       │ 3. authorize()        │                   │
   │                       │                       │    users.create       │                   │
   │                       │                       │────────┐              │                   │
   │                       │                       │◀───────┘              │                   │
   │                       │                       │   bool: true          │                   │
   │                       │                       │                       │                   │
   │                       │                       │ 4. rules()            │                   │
   │                       │                       │    validate fields    │                   │
   │                       │                       │────────┐              │                   │
   │                       │                       │◀───────┘              │                   │
   │                       │                       │   passes              │                   │
   │                       │                       │                       │                   │
   │                       │                       │──────────────────────▶│                   │
   │                       │                       │                       │                   │
   │                       │                       │                       │ 5. BEGIN          │
   │                       │                       │                       │    TRANSACTION    │
   │                       │                       │                       │──────────────────▶│
   │                       │                       │                       │                   │
   │                       │                       │                       │ 6. Hash::make()   │
   │                       │                       │                       │    hash password  │
   │                       │                       │                       │────────┐          │
   │                       │                       │                       │◀───────┘          │
   │                       │                       │                       │                   │
   │                       │                       │                       │ 7. INSERT users   │
   │                       │                       │                       │──────────────────▶│
   │                       │                       │                       │◀──────────────────│
   │                       │                       │                       │    user_id        │
   │                       │                       │                       │                   │
   │                       │                       │                       │ 8. assignRole()   │
   │                       │                       │                       │    (if roles)     │
   │                       │                       │                       │──────────────────▶│
   │                       │                       │                       │◀──────────────────│
   │                       │                       │                       │                   │
   │                       │                       │                       │ 9. COMMIT         │
   │                       │                       │                       │──────────────────▶│
   │                       │                       │                       │                   │
   │                       │                       │                       │ 10. Bootstrap     │
   │                       │                       │                       │     UserResource  │
   │                       │                       │                       │────────┐          │
   │                       │                       │                       │◀───────┘          │
   │                       │                       │                       │                   │
   │                       │◀─────────────────────────────────────────────│                   │
   │◀──────────────────────│                       │                       │                   │
   │                       │                       │                       │                   │
   │  201 Created + JSON   │                       │                       │                   │
   │                       │                       │                       │                   │
```

---

## 9. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                       | Location                                    |
| ------------------------------ | ------------------------------------------- |
| New user field                 | CreateUserRequest rules + User $fillable    |
| Email verification trigger     | After User::create() in controller          |
| Welcome email notification     | Dispatch job after successful creation      |
| Different permission for roles | Add role-specific validation in authorize() |
| Audit log creation             | Add after transaction commits               |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUIRED FIELD

| Step  | File                                                  | What to Change                  |
| ----- | ----------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Requests/Api/V1/User/CreateUserRequest.php` | Add to `rules()` array          |
| **2** | `app/Models/User/User.php`                            | Add to `$fillable` array        |
| **3** | `database/migrations/...`                             | Create migration for new column |
| **4** | Update this documentation                             | Add to request body schema      |

### ⚠️ Common Pitfalls

| Pitfall                        | Prevention                                      |
| ------------------------------ | ----------------------------------------------- |
| Password stored in plain text  | Model's `hashed` cast auto-hashes on assignment |
| Missing transaction rollback   | CreateUserAction wraps in DB::transaction()     |
| Role not found exception       | Validate role names against existing roles      |
| Duplicate email race condition | Unique constraint on DB level + validation      |
| Phone validation bypass        | Catch NumberParseException explicitly           |

---

## 10. Document Metadata

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
