# GET /api/v1/users

> **Domain**: User  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Lists users with pagination and filtering capabilities. This is an admin-level endpoint that requires the `users.view` permission. Supports multi-field search, role filtering, and date range filters for comprehensive user management.

### Responsibilities

- Authorize access via `users.view` permission
- Apply search filters (name, email, signature, phone)
- Format phone numbers for exact match search
- Filter by role assignments
- Filter by date ranges (created_at, last_login_at)
- Return paginated user list with full bootstrap data

### What It Owns

| Owned                | Description                                   |
| -------------------- | --------------------------------------------- |
| User listing logic   | Filters, search, and pagination configuration |
| Admin access control | Policy-based authorization for listing users  |
| Search normalization | Phone number formatting for better search     |

### External Dependencies

| Dependency         | Type           | Purpose                            |
| ------------------ | -------------- | ---------------------------------- |
| Database (`users`) | Eloquent       | User data retrieval                |
| Database (`roles`) | Eloquent       | Role-based filtering via subquery  |
| Laravel Sanctum    | Package        | Authentication verification        |
| Rate Limiter       | Infrastructure | `throttle:api_dynamic` middleware  |
| UserPolicy         | Authorization  | `viewAny` permission check         |
| PhoneService       | Service        | Phone number validation/formatting |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users
```

### Authentication

✅ **Required** - Sanctum Bearer token required

### Authorization

✅ **Required** - `users.view` permission via UserPolicy::viewAny()

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

### Query Parameters

| Parameter  | Type     | Constraints                   | Example   | Description                                |
| ---------- | -------- | ----------------------------- | --------- | ------------------------------------------ |
| `search`   | `string` | Optional                      | `"john"`  | Search by name, email, signature, or phone |
| `role`     | `string` | Optional                      | `"admin"` | Filter by role name                        |
| `per_page` | `int`    | Optional, default 15, max 100 | `25`      | Items per page (max 100)                   |
| `page`     | `int`    | Optional, default 1           | `2`       | Page number for length-aware pagination    |

> **Note**: If `search` contains a valid phone number, it will also perform an exact E.164 formatted match.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": [
    {
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
    {
      "id": 456,
      "name": "Jane Smith",
      "signature": "1234567",
      "avatar": null,
      "frame": null,
      "phone": "+923009876543",
      "country": "PK",
      "gender": 2,
      "date_of_birth": "1998-03-22",
      "coins": "5000",
      "diamonds": "100",
      "wealth_xp": "3200",
      "charm_xp": "1800",
      "is_profile_complete": true,
      "is_blocked": false,
      "blocked_at": null,
      "blocked_reason": null,
      "locked_until": null
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "from": 1,
      "last_page": 5,
      "per_page": 15,
      "to": 15,
      "total": 72,
      "path": "http://localhost/api/v1/users",
      "links": [
        { "url": null, "label": "&laquo; Previous", "active": false },
        {
          "url": "http://localhost/api/v1/users?page=1",
          "label": "1",
          "active": true
        },
        {
          "url": "http://localhost/api/v1/users?page=2",
          "label": "2",
          "active": false
        },
        {
          "url": "http://localhost/api/v1/users?page=2",
          "label": "Next &raquo;",
          "active": false
        }
      ]
    },
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Empty Results

```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": [],
  "meta": {
    "pagination": {
      "current_page": 1,
      "from": null,
      "last_page": 1,
      "per_page": 15,
      "to": null,
      "total": 0,
      "path": "http://localhost/api/v1/users",
      "links": []
    },
    "timestamp": "2026-01-27T14:30:00.000000Z",
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
| `200` | Users retrieved successfully            |
| `401` | Missing or invalid authentication token |
| `403` | User lacks `users.view` permission      |
| `429` | Rate limit exceeded                     |
| `500` | Unexpected server error                 |

---

## 3. Response Field Reference

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

### Computed Field: `is_profile_complete`

```php
// From BootstrapUserResource::isProfileComplete()
return $this->name !== null
    && $this->phone !== null
    && $this->gender !== null
    && $this->date_of_birth !== null;
```

---

## 4. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/users?search=john&role=user                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:22                                               │
│ Route: Route::get('/users', [UserController::class, 'index'])               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_dynamic → Dynamic rate limiting by user role              │
│                                                                             │
│ Route Group Context:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::middleware('throttle:api_dynamic')->group(function () {      │ │
│ │         Route::get('/users', [UserController::class, 'index']);         │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.2 CONTROLLER METHOD - index()                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:69-104            │
│ Method: index(Request $request): JsonResponse                               │
│                                                                             │
│ Dependencies (injected via constructor):                                    │
│   • PhoneService $phoneService                                              │
│   • UserService $userService (not used for listing - direct Eloquent)       │
│                                                                             │
│ STEP 1: Authorize via policy                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('viewAny', User::class);                               │ │
│ │                                                                         │ │
│ │ // Calls UserPolicy::viewAny($user)                                     │ │
│ │ // Returns: $user->can('users.view')                                    │ │
│ │ // Throws AuthorizationException if false → 403 response               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build filters array                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $filters = [                                                            │ │
│ │     'search' => $request->input('search'),                              │ │
│ │     'active' => true,  // Always filter to non-deleted users            │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Format phone for exact match (if search is valid phone)             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($request->filled('search')) {                                       │ │
│ │     $search = $request->input('search');                                │ │
│ │     try {                                                               │ │
│ │         if ($this->phoneService->isValid($search)) {                    │ │
│ │             $filters['formatted_phone'] =                               │ │
│ │                 $this->phoneService->formatForStorage($search);         │ │
│ │         }                                                               │ │
│ │     } catch (NumberParseException|InvalidPhoneNumberException) {        │ │
│ │         // Silently ignore phone parse errors                           │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Add role filter if provided                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($request->filled('role')) {                                         │ │
│ │     $filters['roles'] = [$request->input('role')];                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Execute direct Eloquent query and return paginated response        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = User::query()->whereNull('deleted_at');                        │ │
│ │                                                                         │ │
│ │ // Apply search filter                                                  │ │
│ │ if (isset($filters['search'])) {                                        │ │
│ │     $query->where(function ($q) use ($search) {                         │ │
│ │         $q->where('name', 'ilike', "%{$search}%")                       │ │
│ │           ->orWhere('email', 'ilike', "%{$search}%")                    │ │
│ │           ->orWhere('signature', 'ilike', "%{$search}%");               │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Apply formatted phone filter for exact match                         │ │
│ │ if (isset($filters['formatted_phone'])) {                               │ │
│ │     $query->where('phone', $filters['formatted_phone']);                │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Apply role filter                                                    │ │
│ │ if (isset($filters['roles'])) {                                         │ │
│ │     $query->whereHas('roles', fn ($q) => $q->whereIn('name', ...));     │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $users = $query->orderBy('created_at', 'desc')->paginate($perPage);     │ │
│ │                                                                         │ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     BootstrapUserResource::collection($users),                          │ │
│ │     'Users retrieved successfully'                                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.3 AUTHORIZATION - UserPolicy::viewAny()                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/User/UserPolicy.php:13-16                                │
│ Method: viewAny(User $user): bool                                           │
│                                                                             │
│ Logic:                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return $user->can('users.view');                                        │ │
│ │                                                                         │ │
│ │ // Checks if authenticated user has 'users.view' permission             │ │
│ │ // Via Spatie Laravel-Permission package                                │ │
│ │ // Returns false → throws AuthorizationException → 403 response         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Required Permission: users.view                                             │
│ Typical Roles with Permission: Super Admin, Admin, Moderator               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.4 QUERY BUILDING - Inline in Controller                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:109-135           │
│ Method: index() - Direct Eloquent via User::query()                         │
│                                                                             │
│ NOTE: Repository pattern was removed. Query logic is now inline:            │
│                                                                             │
│ QUERY BUILDING:                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = User::query()->whereNull('deleted_at');                        │ │
│ │                                                                         │ │
│ │ // Search filter (name, email, signature) - uses ilike for Postgres     │ │
│ │ if (isset($filters['search']) && $filters['search'] !== '') {           │ │
│ │     $query->where(function ($q) use ($search) {                         │ │
│ │         $q->where('name', 'ilike', "%{$search}%")                       │ │
│ │           ->orWhere('email', 'ilike', "%{$search}%")                    │ │
│ │           ->orWhere('signature', 'ilike', "%{$search}%");               │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Exact phone match if formatted_phone provided                        │ │
│ │ if (isset($filters['formatted_phone'])) {                               │ │
│ │     $query->where('phone', $filters['formatted_phone']);                │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Role filter with optimized subquery                                  │ │
│ │ if (isset($filters['roles']) && is_array($filters['roles'])) {          │ │
│ │     $query->whereHas('roles', fn ($q) =>                                │ │
│ │         $q->whereIn('name', $filters['roles']));                        │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Default ordering                                                     │ │
│ │ $query->orderBy('created_at', 'desc');                                  │ │
│ │                                                                         │ │
│ │ return $query->paginate($perPage);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Supported Filter Keys (all optional):                                       │
│   • search           → Multi-field ilike search                             │
│   • formatted_phone  → Exact E.164 phone match                              │
│   • roles            → Array of role names for whereHas                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.5 DATA ACCESS / DATABASE QUERY                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ GENERATED SQL (with search and role filter):                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM users                                                     │ │
│ │ WHERE (                                                                 │ │
│ │     name LIKE '%john%'                                                  │ │
│ │     OR email LIKE '%john%'                                              │ │
│ │     OR signature LIKE '%john%'                                          │ │
│ │     OR phone LIKE '%john%'                                              │ │
│ │ )                                                                       │ │
│ │ AND EXISTS (                                                            │ │
│ │     SELECT * FROM roles                                                 │ │
│ │     INNER JOIN model_has_roles ON roles.id = model_has_roles.role_id    │ │
│ │     WHERE model_has_roles.model_id = users.id                           │ │
│ │       AND model_has_roles.model_type = 'App\\Models\\User\\User'        │ │
│ │       AND roles.name IN ('user')                                        │ │
│ │ )                                                                       │ │
│ │ AND deleted_at IS NULL                                                  │ │
│ │ ORDER BY created_at DESC                                                │ │
│ │ LIMIT 15 OFFSET 0                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: UserController::index() - Direct Eloquent Query                     │
│                                                                             │
│ Count query for pagination:                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT COUNT(*) FROM users WHERE ... (same conditions)                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Indexes Used:                                                               │
│   • idx_users_deleted_at (for active filter)                                │
│   • idx_users_created_at (for ordering)                                     │
│   • Full-text or pattern indexes on name/email if available                 │
│                                                                             │
│ CACHE OPERATIONS: None (pagination not cached)                              │
│ QUEUE OPERATIONS: None                                                      │
│ EXTERNAL API CALLS: None                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.6 RESOURCE LAYER - BootstrapUserResource                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php:26-48           │
│ Method: toArray(Request $request): array                                    │
│                                                                             │
│ FIELD MAPPING (19 fields):                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'signature' => $this->signature,                                    │ │
│ │     'avatar' => $this->avatar,                                          │ │
│ │     'frame' => $this->whenHas('frame'),                                 │ │
│ │     'phone' => $this->getRawPhone(),                                    │ │
│ │     'country' => $this->country,                            │ │
│ │     'gender' => $this->gender,                                          │ │
│ │     'date_of_birth' => $this->date_of_birth?->toDateString(),           │ │
│ │     'coins' => (string) $this->coins,                                   │ │
│ │     'diamonds' => (string) $this->diamonds,                             │ │
│ │     'wealth_xp' => (string) $this->wealth_xp,                           │ │
│ │     'charm_xp' => (string) $this->charm_xp,                             │ │
│ │     'is_profile_complete' => $this->isProfileComplete(),                │ │
│ │     'is_blocked' => $this->is_blocked ?? false,                         │ │
│ │     'blocked_at' => $this->blocked_at?->toIso8601String(),              │ │
│ │     'blocked_reason' => $this->blocked_reason,                          │ │
│ │     'locked_until' => $this->locked_until?->toIso8601String(),          │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Private Methods:                                                            │
│   • getRawPhone() → Returns E.164 formatted phone or raw attribute          │
│   • isProfileComplete() → Checks name, phone, gender, date_of_birth set     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ RESPONSE FLOW:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. BootstrapUserResource::collection($users) wraps LengthAwarePaginator │ │
│ │         ↓                                                               │ │
│ │ 2. ApiResponse::paginated() extracts pagination metadata                │ │
│ │         ↓                                                               │ │
│ │ 3. Builds response with status, message, data[], meta{}                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PAGINATION TYPE: LengthAwarePaginator (includes total count)                │
│                                                                             │
│ Meta includes:                                                              │
│   • current_page, from, to, per_page                                        │
│   • last_page, total (unique to LengthAwarePaginator)                       │
│   • path, links[] (for navigation)                                          │
│   • timestamp, correlation_id                                               │
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
| `BootstrapUserResource.php` | Bootstrap, user list, profile | ✅ Reusable | Full user data for authenticated contexts |
| `UserPolicy.php`            | All user actions              | ✅ Reusable | Authorization for all user operations     |
| `PhoneService.php`          | Registration, search, updates | ✅ Reusable | Phone validation/formatting utility       |
| `ApiResponse.php`           | All API endpoints             | ✅ Reusable | Global response envelope                  |
| `User.php` (Model)          | Entire application            | ✅ Reusable | Core entity model                         |

---

## 6. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source                | Condition                          |
| ------------------------------ | --------------------- | ---------------------------------- |
| "This action is unauthorized." | `UserPolicy::viewAny` | User lacks `users.view` permission |

### Rate Limit Errors (429)

| Error                                  | Source                 | Condition           |
| -------------------------------------- | ---------------------- | ------------------- |
| "Too many requests. Please try again." | `throttle:api_dynamic` | Rate limit exceeded |

### System Errors (500)

| Error                       | Source              | Condition         |
| --------------------------- | ------------------- | ----------------- |
| Database connection failure | `getPaginatedUsers` | DB unavailable    |
| Role subquery failure       | `whereHas('roles')` | Invalid role data |

### Edge Cases

| Case                      | Behavior                                               |
| ------------------------- | ------------------------------------------------------ |
| Empty search term         | Returns all users (no search filter applied)           |
| Invalid phone in search   | Phone parsing exception silently ignored               |
| Valid phone in search     | Adds exact E.164 match alongside LIKE search           |
| Non-existent role filter  | Returns empty results (no matching users)              |
| No users in system        | Returns empty array with pagination showing total: 0   |
| Very large per_page       | No explicit cap, returns requested amount              |
| Deleted users             | Excluded by `active: true` filter (deleted_at IS NULL) |
| Search with special chars | LIKE pattern may match unexpectedly                    |
| Negative page number      | Laravel defaults to page 1                             |

---

## 7. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            POLICY                REPOSITORY             DATABASE
   │                       │                       │                     │                       │                       │
   │ GET /users?           │                       │                     │                       │                       │
   │   search=john         │                       │                     │                       │                       │
   │──────────────────────▶│                       │                     │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │ 1. auth:sanctum       │                     │                       │                       │
   │                       │    verify token       │                     │                       │                       │
   │                       │────────┐              │                     │                       │                       │
   │                       │◀───────┘              │                     │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │ 2. throttle check     │                     │                       │                       │
   │                       │────────┐              │                     │                       │                       │
   │                       │◀───────┘              │                     │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │ 3. dispatch           │                     │                       │                       │
   │                       │──────────────────────▶│                     │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │                       │ 4. authorize        │                       │                       │
   │                       │                       │    ('viewAny',      │                       │                       │
   │                       │                       │     User::class)    │                       │                       │
   │                       │                       │────────────────────▶│                       │                       │
   │                       │                       │                     │ 5. check              │                       │
   │                       │                       │                     │   users.view          │                       │
   │                       │                       │                     │   permission          │                       │
   │                       │                       │◀────────────────────│                       │                       │
   │                       │                       │     bool: true      │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │                       │ 6. build filters    │                       │                       │
   │                       │                       │    - search: john   │                       │                       │
   │                       │                       │    - active: true   │                       │                       │
   │                       │                       │────────┐            │                       │                       │
   │                       │                       │◀───────┘            │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │                       │ 7. phoneService     │                       │                       │
   │                       │                       │    ->isValid()      │                       │                       │
   │                       │                       │    (check if phone) │                       │                       │
   │                       │                       │────────┐            │                       │                       │
   │                       │                       │◀───────┘            │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │                       │ 8. User::query()    │                       │                       │
   │                       │                       │    with filters     │                       │                       │
   │                       │                       │─────────────────────────────────────────────▶│                       │
   │                       │                       │                     │                       │ 9. build query        │
   │                       │                       │                     │                       │    with filters       │
   │                       │                       │                     │                       │────────┐              │
   │                       │                       │                     │                       │◀───────┘              │
   │                       │                       │                     │                       │                       │
   │                       │                       │                     │                       │ 10. SELECT + COUNT    │
   │                       │                       │                     │                       │──────────────────────▶│
   │                       │                       │                     │                       │◀──────────────────────│
   │                       │                       │◀─────────────────────────────────────────────│                       │
   │                       │                       │  LengthAwarePaginator<User>                 │                       │
   │                       │                       │                     │                       │                       │
   │                       │                       │ 11. BootstrapUser   │                       │                       │
   │                       │                       │     Resource::      │                       │                       │
   │                       │                       │     collection()    │                       │                       │
   │                       │                       │────────┐            │                       │                       │
   │                       │                       │◀───────┘            │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │                       │ 12. ApiResponse::   │                       │                       │
   │                       │                       │     paginated()     │                       │                       │
   │                       │                       │────────┐            │                       │                       │
   │                       │                       │◀───────┘            │                       │                       │
   │                       │                       │                     │                       │                       │
   │                       │◀──────────────────────│                     │                       │                       │
   │◀──────────────────────│                       │                     │                       │                       │
   │                       │                       │                     │                       │                       │
   │  200 OK + JSON        │                       │                     │                       │                       │
   │                       │                       │                     │                       │                       │
```

---

## 8. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location                                     |
| ---------------------------- | -------------------------------------------- |
| New response field           | `BootstrapUserResource::toArray()`           |
| New filter parameter         | Controller `$filters` array + inline query   |
| Search in additional columns | `UserController::index()` query where clause |
| Role-based visibility        | `UserPolicy::viewAny()` or new policy method |
| Eager load relationships     | Add `->with()` to query in controller        |
| Export functionality         | New controller method using same query logic |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO USER LIST

| Step  | File                                              | What to Change                        |
| ----- | ------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Add field to `toArray()` return array |
| **2** | If new DB column, add migration                   | Create column in users table          |
| **3** | Update this documentation                         | Add field to response schema          |

Example: Adding `last_login_at` field:

```diff
// BootstrapUserResource.php
return [
    // ... existing fields ...
    'locked_until' => $this->locked_until?->toIso8601String(),
+   'last_login_at' => $this->last_login_at?->toIso8601String(),
];
```

#### ➕ ADDING A NEW FILTER PARAMETER

| Step  | File                                                  | What to Change                        |
| ----- | ----------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/User/UserController.php` | Add to `$filters` array build + query |
| **2** | Update this documentation                             | Add to Query Parameters table         |

Example: Adding `blocked` filter:

```diff
// UserController.php index()
$filters = [
    'search' => $request->input('search'),
    'active' => true,
+   'blocked' => $request->boolean('blocked'),
];

// Later in the query building
+ if (isset($filters['blocked'])) {
+     $query->where('is_blocked', $filters['blocked']);
+ }
```

### ⚠️ Common Pitfalls

| Pitfall                         | Prevention                                           |
| ------------------------------- | ---------------------------------------------------- |
| Missing permission check        | Always call `$this->authorize()` first               |
| N+1 queries with role filtering | Use `whereHas` not loading all roles                 |
| Phone search not matching       | formatForStorage may produce different E.164 format  |
| Exposing sensitive data         | Review BootstrapUserResource fields carefully        |
| Performance on large datasets   | Consider cursor pagination for very large user bases |

---

## 9. Related Endpoints

| Endpoint                     | Method | Description                 | Documentation                       |
| ---------------------------- | ------ | --------------------------- | ----------------------------------- |
| `/users/search`              | GET    | Public user search          | [search/](../search/)               |
| `/users/profile/{signature}` | GET    | Public profile by signature | [profile/](../profile/)             |
| `/users/{user}`              | GET    | Single user details         | [show/](../show/) _(pending)_       |
| `/users`                     | POST   | Create new user             | [store/](../store/) _(pending)_     |
| `/users/{user}`              | PUT    | Update user                 | [update/](../update/) _(pending)_   |
| `/users/{user}`              | DELETE | Delete user                 | [destroy/](../destroy/) _(pending)_ |

---

## 10. Document Metadata

| Property         | Value                    |
| ---------------- | ------------------------ |
| **Author**       | API Documentation System |
| **Created**      | 2026-01-27               |
| **Last Updated** | 2026-01-28               |
| **Version**      | 1.1.0                    |
| **Status**       | Complete                 |
| **Reviewed By**  | -                        |

### Changelog

| Version | Date       | Changes                                                   |
| ------- | ---------- | --------------------------------------------------------- |
| 1.1.0   | 2026-01-28 | Updated to reflect Eloquent refactor (repository removed) |
| 1.0.0   | 2026-01-27 | Initial documentation created                             |
