# GET /api/v1/users/search

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Searches users by name, user ID, or signature with cursor-based pagination. Returns minimal user data optimized for search result displays and user selection interfaces.

### Responsibilities

- Accept optional search term parameter
- Return empty results for empty/null search input
- Search by exact user ID match (if numeric)
- Search by name or signature prefix match
- Return cursor-paginated results with minimal user fields
- Exclude soft-deleted users from results

### What It Owns

| Owned             | Description                             |
| ----------------- | --------------------------------------- |
| Search execution  | Performs optimized user lookups         |
| Result pagination | Cursor-based pagination with `per_page` |
| Empty state       | Returns empty array for no/empty search |

### External Dependencies

| Dependency         | Type           | Purpose                           |
| ------------------ | -------------- | --------------------------------- |
| Database (`users`) | Eloquent       | User search queries               |
| Laravel Sanctum    | Package        | Authentication verification       |
| Rate Limiter       | Infrastructure | `throttle:api_dynamic` middleware |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users/search
```

### Authentication

✅ **Required** - Sanctum Bearer token required

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

| Parameter  | Type     | Constraints                          | Example       |
| ---------- | -------- | ------------------------------------ | ------------- |
| `search`   | `string` | Optional, nullable                   | `"john"`      |
| `per_page` | `int`    | Optional, default 15, min 1, max 100 | `20`          |
| `cursor`   | `string` | Optional, pagination token           | `"eyJpZC..."` |

---

### Response Schemas

#### ✅ Success Response (200) - With Results

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
      "frame": null,
      "gender": 1,
      "email": "john@example.com",
      "phone": "+923001234567",
      "country": "PK",
      "date_of_birth": "1990-05-15",
      "wealth_xp": "12500",
      "charm_xp": "8750"
    }
  ],
  "meta": {
    "pagination": {
      "path": "http://localhost/api/v1/users/search",
      "per_page": 15,
      "next_cursor": "eyJpZCI6MTAwLCJfcG9pbn...",
      "prev_cursor": null
    },
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response (200) - Empty Search

When `search` parameter is null, empty string, or missing:

```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": [],
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
    "search": ["The search field must be a string."]
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null
}
```

#### ❌ Rate Limited (429)

```json
{
  "status": "error",
  "message": "Too Many Attempts.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `200` | Search successful (even with empty result) |
| `401` | Missing or invalid authentication token    |
| `422` | Validation error (search not a string)     |
| `429` | Rate limit exceeded                        |
| `500` | Unexpected server error                    |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/users/search?search=john                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:19                                               │
│ Route: Route::get('/users/search', [UserController::class, 'search'])       │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_dynamic → Dynamic rate limiting by user role              │
│                                                                             │
│ Route Group Context:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::middleware('throttle:api_dynamic')->group(function () {      │ │
│ │         Route::get('/users/search', [...]);                             │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED - INLINE VALIDATION                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:43-45             │
│                                                                             │
│ INLINE VALIDATION (no FormRequest class):                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $request->validate([                                                    │ │
│ │     'search' => ['nullable', 'string'],                                 │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Why Inline Validation:                                                      │
│   • Only single simple field                                                │
│   • No complex business rules                                               │
│   • No reuse requirement                                                    │
│                                                                             │
│ Failure → 422 Validation Error with field-specific messages                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:41-64             │
│ Method: search(Request $request): JsonResponse                              │
│                                                                             │
│ STEP 1: Extract search term                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $searchTerm = $request->input('search');                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Handle empty search (early return)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($searchTerm === null || $searchTerm === '') {                       │ │
│ │     return ApiResponse::success(                                        │ │
│ │         [],  // Empty data array                                        │ │
│ │         'Users retrieved successfully'                                  │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute search via direct Eloquent                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $users = User::query()                                                  │ │
│ │     ->where(function ($query) use ($searchTerm) {                       │ │
│ │         $query->where('name', 'ilike', "%{$searchTerm}%")               │ │
│ │             ->orWhere('signature', 'ilike', "%{$searchTerm}%")          │ │
│ │             ->orWhere('id', 'ilike', "%{$searchTerm}%");                │ │
│ │     })                                                                 │ │
│ │     ->orderBy('name')                                                  │ │
│ │     ->cursorPaginate($perPage);                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return paginated response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     MinimalUserResource::collection($users),                            │ │
│ │     'Users retrieved successfully'                                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Controller Responsibilities:                                                │
│   • Validate input inline                                                   │
│   • Handle empty search early return                                        │
│   • Execute search via direct Eloquent                                      │
│   • Transform result with resource collection                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 QUERY BUILDING - Inline in Controller                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ NOTE: Repository pattern was removed. Query logic is now inline in the     │
│ controller using direct Eloquent:                                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $users = User::query()                                                  │ │
│ │     ->where(function ($query) use ($searchTerm) {                       │ │
│ │         $query->where('name', 'ilike', "%{$searchTerm}%")               │ │
│ │             ->orWhere('signature', 'ilike', "%{$searchTerm}%")          │ │
│ │             ->orWhere('id', 'ilike', "%{$searchTerm}%");                │ │
│ │     })                                                                 │ │
│ │     ->orderBy('name')                                                  │ │
│ │     ->cursorPaginate($perPage);                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Search Logic:                                                               │
│   • Name prefix: Matches names containing search term (ilike)              │
│   • Signature match: Matches signatures containing search term             │
│   • ID match: Matches user IDs containing search term                      │
│   • Order: Alphabetical by name for stable pagination                      │
│                                                                             │
│ Performance Optimizations:                                                  │
│   • Cursor pagination (no COUNT query overhead)                            │
│   • ilike for case-insensitive Postgres matching                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UserController                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Controllers/Api/V1/User/UserController.php               │ │
│ │ Responsibility: Handle user-related HTTP requests                        │ │
│ │ Reusable: NO (Controller is endpoint-bound)                             │ │
│ │ Why It Exists: Route handler for User domain endpoints                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • search() → User search with cursor pagination                       │ │
│ │   • index() → List users (admin)                                        │ │
│ │   • show() → Get single user                                            │ │
│ │   • showPublicProfile() → Public profile by signature                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserController                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Controllers/Api/V1/User/UserController.php               │ │
│ │ Responsibility: Handle user-related HTTP requests                        │ │
│ │ Reusable: NO (Controller is endpoint-bound)                             │ │
│ │ Why It Exists: Route handler for User domain endpoints                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • search() → User search with cursor pagination (direct Eloquent)     │ │
│ │   • index() → List users (admin, direct Eloquent)                        │ │
│ │   • show() → Get single user                                            │ │
│ │   • showPublicProfile() → Public profile by signature                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/MinimalUserResource.php                     │ │
│ │ Responsibility: Transform User to minimal JSON representation           │ │
│ │ Reusable: YES (Embedded in Room, RoomMember, AgencyMember, etc.)        │ │
│ │ Why It Exists: Lightweight user data for nested resources               │ │
│ │                                                                         │ │
│ │ Fields Returned (12 total):                                             │ │
│ │   • id          → User primary key                                      │ │
│ │   • name        → Display name                                          │ │
│ │   • signature   → Unique public identifier                              │ │
│ │   • avatar      → Avatar URL                                            │ │
│ │   • frame       → Avatar frame (whenHas)                                │ │
│ │   • gender      → Gender code (1=male, 2=female, etc.)                  │ │
│ │   • email       → Email address                                         │ │
│ │   • phone       → Phone number                                          │ │
│ │   • country     → 2-char ISO country code                               │ │
│ │   • date_of_birth → Date string (Y-m-d)                                 │ │
│ │   • wealth_xp   → Stringified integer                                   │ │
│ │   • charm_xp    → Stringified integer                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (All API endpoints)                                       │ │
│ │ Why It Exists: Consistent response envelope across all endpoints        │ │
│ │                                                                         │ │
│ │ Key Methods Used:                                                       │ │
│ │   • success() → Standard success response (empty search case)           │ │
│ │   • paginated() → Cursor pagination response with meta                  │ │
│ │                                                                         │ │
│ │ Cursor Pagination Meta:                                                 │ │
│ │   • path → Base URL                                                     │ │
│ │   • per_page → Items per page                                           │ │
│ │   • next_cursor → Encoded cursor for next page                          │ │
│ │   • prev_cursor → Encoded cursor for previous page                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT users with search conditions (cursorPaginate)                     │
│    Query (search term e.g., "john"):                                        │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT *                                                            │ │
│    │ FROM users                                                          │ │
│    │ WHERE (name ILIKE '%john%'                                          │ │
│    │        OR signature ILIKE '%john%'                                  │ │
│    │        OR id ILIKE '%john%')                                        │ │
│    │   AND deleted_at IS NULL                                            │ │
│    │ ORDER BY name                                                       │ │
│    │ LIMIT 16                                                            │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: UserController::search() - Direct Eloquent Query                 │
│                                                                             │
│ Note: LIMIT is perPage + 1 to determine if next page exists                │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
│ EXTERNAL API CALLS: None                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/MinimalUserResource.php:27-43                   │
│                                                                             │
│ SUCCESS PATH (results found):                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CursorPaginator<User>                                                   │ │
│ │         │                                                               │ │
│ │         ▼                                                               │ │
│ │ MinimalUserResource::collection($users)                                 │ │
│ │         │                                                               │ │
│ │         ▼                                                               │ │
│ │ For each user, MinimalUserResource::toArray():                          │ │
│ │   {                                                                     │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'signature' => $this->signature,                                    │ │
│ │     'avatar' => $this->avatar,                                          │ │
│ │     'frame' => $this->whenHas('frame'),                                 │ │
│ │     'gender' => $this->gender,                                          │ │
│ │     'email' => $this->email,                                            │ │
│ │     'phone' => $this->phone,                                            │ │
│ │     'country' => $this->country,                                  │ │
│ │     'date_of_birth' => $this->date_of_birth?->toDateString(),           │ │
│ │     'wealth_xp' => (string) (int) $this->wealth_xp,                     │ │
│ │     'charm_xp' => (string) (int) $this->charm_xp,                       │ │
│ │   }                                                                     │ │
│ │         │                                                               │ │
│ │         ▼                                                               │ │
│ │ ApiResponse::paginated(collection, 'Users retrieved successfully')      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EMPTY SEARCH PATH:                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ No database query executed                                              │ │
│ │         │                                                               │ │
│ │         ▼                                                               │ │
│ │ ApiResponse::success([], 'Users retrieved successfully')                │ │
│ │         │                                                               │ │
│ │         ▼                                                               │ │
│ │ { status: 'success', message: '...', data: [], meta: {...} }            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL OUTPUT:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse wraps with standard envelope:                               │ │
│ │   • status: 'success'                                                   │ │
│ │   • message: 'Users retrieved successfully'                             │ │
│ │   • data: [...user objects...] or []                                    │ │
│ │   • meta: { pagination: {...}, timestamp, correlation_id }              │ │
│ │                                                                         │ │
│ │ → HTTP 200 + JSON Body                                                  │ │
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

| File                      | Used By Endpoints             | Reusable    | Reasoning                       |
| ------------------------- | ----------------------------- | ----------- | ------------------------------- |
| `UserController.php`      | Multiple `/users/*` endpoints | ⭕ Mixed    | Controller bound to User domain |
| `MinimalUserResource.php` | Search, Room, Agency embedded | ✅ Reusable | Lightweight user embedding      |
| `ApiResponse.php`         | All API endpoints             | ✅ Reusable | Global response envelope        |
| `User.php` (Model)        | Entire application            | ✅ Reusable | Core entity model               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error           | Source              | Condition                    |
| --------------- | ------------------- | ---------------------------- |
| `search.string` | Inline `validate()` | Search param is not a string |

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Rate Limit Errors (429)

| Error                | Source                 | Condition           |
| -------------------- | ---------------------- | ------------------- |
| "Too Many Attempts." | `throttle:api_dynamic` | Rate limit exceeded |

### System Errors (500)

| Error                       | Source          | Condition           |
| --------------------------- | --------------- | ------------------- |
| Database connection failure | Direct Eloquent | DB unavailable      |
| Query execution error       | Direct Eloquent | Invalid query state |

### Edge Cases

| Case                        | Behavior                                        |
| --------------------------- | ----------------------------------------------- |
| Empty string `search=""`    | Returns empty array, no DB query                |
| Null search parameter       | Returns empty array, no DB query                |
| Numeric search `search=123` | Matches by exact ID OR signature/name prefix    |
| Very long search string     | Queries DB, likely no results                   |
| SQL injection attempt       | Laravel parameterized queries prevent injection |
| Special chars in search     | Treated as literal string (escaped)             |
| Deleted users               | Excluded via `whereNull('deleted_at')`          |
| `per_page=0`                | Treated as 0, returns empty result              |
| `per_page` > 100            | No explicit cap, returns requested amount       |
| Invalid cursor              | Laravel throws exception → 500 error            |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                               DATABASE
   │                       │                       │                                           │
   │  GET /users/search    │                       │                                           │
   │  ?search=john         │                       │                                           │
   │──────────────────────▶│                       │                                           │
   │                       │                       │                                           │
   │                       │ 1. auth:sanctum       │                                           │
   │                       │    verify token       │                                           │
   │                       │────────┐              │                                           │
   │                       │◀───────┘              │                                           │
   │                       │                       │                                           │
   │                       │ 2. throttle check     │                                           │
   │                       │────────┐              │                                           │
   │                       │◀───────┘              │                                           │
   │                       │                       │                                           │
   │                       │ 3. dispatch           │                                           │
   │                       │──────────────────────▶│                                           │
   │                       │                       │                                           │
   │                       │                       │ 4. validate(['search' => 'nullable|string'])   │
   │                       │                       │────────┐                                  │
   │                       │                       │◀───────┘                                  │
   │                       │                       │                                           │
   │                       │                       │ 5. extract searchTerm                     │
   │                       │                       │────────┐                                  │
   │                       │                       │◀───────┘                                  │
   │                       │                       │                                           │
   │                       │                       │ 6. check empty (if empty: return [])      │
   │                       │                       │                                           │
   │                       │                       │ 7. User::query()->where(...)->cursorPaginate │
   │                       │                       │──────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────│
   │                       │                       │  CursorPaginator                          │
   │                       │                       │                                           │
   │                       │                       │ 8. MinimalUserResource::collection()      │
   │                       │                       │────────┐                                  │
   │                       │                       │◀───────┘                                  │
   │                       │                       │                                           │
   │                       │                       │ 9. ApiResponse::paginated()               │
   │                       │                       │────────┐                                  │
   │                       │                       │◀───────┘                                  │
   │                       │                       │                                           │
   │                       │◀──────────────────────│                                           │
   │◀──────────────────────│                       │                                           │
   │                       │                       │                                           │
   │  200 OK + JSON        │                       │                                           │
   │                       │                       │                                           │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                       |
| ------------------------ | ---------------------------------------------- |
| New search fields        | `UserController::search()` query clause        |
| Search filters           | Controller inline validation + query           |
| Fuzzy/full-text search   | Controller query (consider DB full-text index) |
| Search result caching    | Add Cache facade usage in controller           |
| Search analytics/logging | Controller after search execution              |
| Result ordering options  | Add `sort` param validation + query logic      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO SEARCH RESULTS

| Step  | File                                             | What to Change                  |
| ----- | ------------------------------------------------ | ------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/UserController.php` | Add column to query select()    |
| **2** | `app/Http/Resources/V1/MinimalUserResource.php`  | Add field to `toArray()` return |
| **3** | Update this documentation                        | Add field to response schema    |

Example: Adding `bio` field:

```diff
// UserController.php:search()
$users = User::query()
    ->select([
        'id', 'name', 'phone', 'country', 'email',
        'signature', 'avatar', 'gender', 'date_of_birth',
-       'wealth_xp', 'charm_xp', 'frame'
+       'wealth_xp', 'charm_xp', 'frame', 'bio'
    ])

// MinimalUserResource.php:42
+   'bio' => $this->bio,
```

#### ➕ ADDING A NEW SEARCHABLE COLUMN

| Step  | File                                             | What to Change               |
| ----- | ------------------------------------------------ | ---------------------------- |
| **1** | `app/Http/Controllers/Api/V1/UserController.php` | Add to `where()` clause      |
| **2** | Consider adding DB index                         | Create migration for index   |
| **3** | Update this documentation                        | Document new search behavior |

Example: Adding email search:

```diff
// UserController.php:search()
$query->where('name', 'ilike', "%{$searchTerm}%")
    ->orWhere('signature', 'ilike', "%{$searchTerm}%")
-   ->orWhere('id', 'ilike', "%{$searchTerm}%");
+   ->orWhere('id', 'ilike', "%{$searchTerm}%")
+   ->orWhere('email', 'ilike', "%{$searchTerm}%");
```

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                             | What to Change                    |
| ----- | ------------------------------------------------ | --------------------------------- |
| **1** | `app/Http/Resources/V1/MinimalUserResource.php`  | Remove from `toArray()`           |
| **2** | `app/Http/Controllers/Api/V1/UserController.php` | Remove from `select()` (optional) |
| **3** | Update this documentation                        | Remove from response schema       |

> [!CAUTION]
> `MinimalUserResource` is used by many endpoints (Room, Agency, etc.). Removing fields may break other features.

### 🔗 Field Flow Dependency Chain

```
Request: ?search=john&per_page=15
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Controller: search()                                            │
│                                                                 │
│   $searchTerm = $request->input('search');      // "john"       │
│   $perPage = (int) $request->input('per_page'); // 15           │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Direct Eloquent in Controller::search()                         │
│                                                                 │
│   ->where(name/signature/id ILIKE '%john%')                     │
│   ->whereNull('deleted_at') // via SoftDeletes                  │
│   ->orderBy('name')                                             │
│   ->cursorPaginate(15)                                          │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Resource: MinimalUserResource::collection($users)               │
│                                                                 │
│   Maps each User → { id, name, signature, avatar, ... }         │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ ApiResponse: paginated(collection, message)                     │
│                                                                 │
│   { status, message, data: [...], meta: { pagination: {...} } } │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                              |
| ----------------------------- | --------------------------------------------------- |
| `MinimalUserResource` fields  | Used by 10+ endpoints; changes affect many features |
| `cursorSearch()` order clause | Cursor pagination requires stable ordering          |
| `whereNull('deleted_at')`     | Removing would expose deleted users                 |
| Empty search behavior         | Frontend may depend on empty `[]` response          |
| Response envelope structure   | All clients expect consistent structure             |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                        |
| ----------------------------------------- | ------------------------------------------------- |
| Removing from `select()` but not resource | Always update both controller query AND resource  |
| Adding full-text search without index     | ilike is fast; full-text needs proper index       |
| Using `%search%` instead of `search%`     | Contains match vs prefix match - consider perf    |
| Not handling empty cursor parameter       | Laravel handles gracefully, but test edge cases   |
| Forgetting `deleted_at` filter            | Soft-deleted users would appear in results        |
| Adding relations without eager loading    | N+1 queries; use `with()` if adding relationships |

### 📁 File Locations Quick Reference

```
routes/api/users.php                              ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserController.php                          ← Controller with search() - direct Eloquent
app/Http/Resources/V1/
  └── MinimalUserResource.php                     ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                             ← Response envelope utility
app/Models/User/
  └── User.php                                    ← User entity model
```

---

## 8. User Resource Field Details

### MinimalUserResource Fields

| Field           | Type           | Source                       | Notes                                           |
| --------------- | -------------- | ---------------------------- | ----------------------------------------------- |
| `id`            | `integer`      | `users.id`                   | Primary key                                     |
| `name`          | `string`       | `users.name`                 | Display name                                    |
| `signature`     | `string`       | `users.signature`            | Unique public ID, 7 digits                      |
| `avatar`        | `string\|null` | `users.avatar`               | CDN URL or null                                 |
| `frame`         | `string\|null` | `users.frame`                | Avatar frame, conditional                       |
| `gender`        | `integer`      | `users.gender`               | 1=male, 2=female, 3=non-binary, 4=not specified |
| `email`         | `string`       | `users.email`                | Email address                                   |
| `phone`         | `string\|null` | `users.phone` (cast)         | E.164 format via PhoneCast                      |
| `country`       | `string\|null` | `users.country`              | 2-char ISO country code                         |
| `date_of_birth` | `string\|null` | `users.date_of_birth` (cast) | Y-m-d format or null                            |
| `wealth_xp`     | `string`       | `users.wealth_xp`            | Stringified integer (no decimals)               |
| `charm_xp`      | `string`       | `users.charm_xp`             | Stringified integer (no decimals)               |

---

## Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `GET /api/v1/users/search` |
| **Domain**          | User                       |
| **Author**          | System Documentation       |
| **Created**         | 2026-01-27                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4                        |
