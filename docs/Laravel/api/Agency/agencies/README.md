# GET /api/v1/agencies

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Lists all **approved agencies** with cursor-based pagination. Results are cached in Redis for 5 minutes with tagged caching for efficient invalidation.

### Responsibilities

- Return paginated list of approved agencies only
- Support search by agency name
- Support filtering by country code
- Eager load owner with minimal user fields
- Count active members efficiently using subquery
- Apply role-based field visibility (sensitive fields for members/owners, admin fields for staff)

### What It Owns

| Owned            | Description                                          |
| ---------------- | ---------------------------------------------------- |
| Agency listing   | Retrieves and returns paginated approved agencies    |
| Cache management | Uses Redis tagged caching with 5-minute TTL          |
| Member count     | Returns active member count via `withCount` subquery |

### External Dependencies

| Dependency | Type           | Purpose                         |
| ---------- | -------------- | ------------------------------- |
| Redis      | Infrastructure | Tagged caching for list results |
| MySQL      | Database       | agencies, users tables          |
| Sanctum    | Package        | Token-based authentication      |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/agencies
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config             |
| ------- | ------- | ------------------ |
| Default | User ID | 60 requests/minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type     | Constraints      | Example      |
| ---------- | -------- | ---------------- | ------------ |
| `search`   | `string` | Optional         | `"Elite"`    |
| `country`  | `string` | Optional, 2-char | `"US"`       |
| `per_page` | `int`    | Optional, 1-100  | `20`         |
| `cursor`   | `string` | Optional         | `"eyJpZ..."` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": 1,
      "name": "Elite Agency",
      "country": "US",
      "logo": "https://ik.imagekit.io/.../logo.png",
      "status": "approved",
      "status_label": "Approved",
      "created_at": "2026-01-15T10:30:00.000000Z",
      "owner": {
        "id": 42,
        "name": "John Doe",
        "signature": "JD123",
        "avatar": "https://ik.imagekit.io/.../avatar.jpg",
        "frame": "gold_frame",
        "gender": "male",
        "email": "john@example.com",
        "phone": "+1234567890",
        "country": "US",
        "date_of_birth": "1990-05-15",
        "wealth_xp": "15000",
        "charm_xp": "8500"
      },
      "member_count": 25
    }
  ],
  "links": {
    "first": null,
    "last": null,
    "prev": null,
    "next": "http://api.example.com/api/v1/agencies?cursor=eyJpZ..."
  },
  "meta": {
    "path": "http://api.example.com/api/v1/agencies",
    "per_page": 20,
    "next_cursor": "eyJpZ...",
    "prev_cursor": null,
    "timestamp": "2026-02-03T03:04:49.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "An unexpected error occurred",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Successful retrieval              |
| `401` | Missing or invalid authentication |
| `429` | Rate limit exceeded               |
| `500` | Internal server error             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/agencies                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:26                                            │
│ Route: Route::get('/', [AgencyController::class, 'index'])                  │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. EnsureFrontendRequestsAreStateful → Sanctum SPA support                │
│   2. auth:sanctum                      → Token authentication               │
│   3. ApiResponseMiddleware             → Standardized response format       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE PROCESSING                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: vendor/laravel/sanctum/src/Http/Middleware/                           │
│       EnsureFrontendRequestsAreStateful.php                                 │
│                                                                             │
│ STEP 1: Check if request is from frontend SPA (stateful)                    │
│ STEP 2: For API requests, validate Bearer token                             │
│                                                                             │
│ File: bootstrap/app.php:40-42                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $middleware->api(append: [                                              │ │
│ │     \App\Http\Middleware\ApiResponseMiddleware::class,                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:38-66         │
│ Method: index(Request $request)                                             │
│                                                                             │
│ STEP 1: Build cache key from query parameters                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $cacheParams = $request->only(['search', 'country', 'per_page',         │ │
│ │                                'cursor']);                              │ │
│ │ $cacheKey = 'agencies:list:' . md5(serialize($cacheParams));            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Attempt to retrieve from Redis cache (5-minute TTL)                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agencies = Cache::tags(['agencies'])->remember($cacheKey, 300,         │ │
│ │     function () use ($request) { ... });                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Build query (only if cache miss)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = Agency::query()                                                │ │
│ │     ->approved()                                                        │ │
│ │     ->withCount(['members as active_members_count' => function ($q) {   │ │
│ │         $q->where('status', 'active');                                  │ │
│ │     }])                                                                 │ │
│ │     ->with(['owner:id,name,avatar,frame,signature,...']);               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Apply optional filters                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($request->has('search')) {                                          │ │
│ │     $query->search($request->input('search'));                          │ │
│ │ }                                                                       │ │
│ │ if ($request->has('country')) {                                         │ │
│ │     $query->byCountry($request->input('country'));                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Execute cursor pagination                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return $query->cursorPaginate($request->input('per_page', 20));         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Transform with resource collection                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyResource::collection($agencies);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 MODEL LAYER (Query Scopes)                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Agency/Agency.php                                          │
│                                                                             │
│ SCOPE: approved() (lines 186-195)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function scopeApproved(Builder $query): Builder                  │ │
│ │ {                                                                       │ │
│ │     return $query->where('status', AgencyStatus::APPROVED);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: search() (lines 219-228)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function scopeSearch(Builder $query, string $search): Builder    │ │
│ │ {                                                                       │ │
│ │     return $query->where('name', 'like', "%{$search}%");                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: byCountry() (lines 197-206)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function scopeByCountry(Builder $query, string $country): Builder│ │
│ │ {                                                                       │ │
│ │     return $query->where('country', strtoupper($country));              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyResource (API Resource)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyResource.php                   │ │
│ │ Responsibility: Transform Agency model to JSON response                 │ │
│ │ Reusable: YES (used by index, show, store endpoints)                    │ │
│ │ Why It Exists: Consistent API response format with role-based fields   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Core transformation with conditional fields             │ │
│ │   • canViewAgencySensitiveFields() → Check for address, coin_reseller   │ │
│ │   • canViewAdminFields() → Check for national_id_images, dissolved_at   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Transform User to minimal 12-field response             │ │
│ │ Reusable: YES (used across Agency, Room, Gift endpoints)                │ │
│ │ Why It Exists: Optimized for embedding in parent resources              │ │
│ │                                                                         │ │
│ │ Fields: id, name, signature, avatar, frame, gender, email, phone,       │ │
│ │         country, date_of_birth, wealth_xp, charm_xp                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Abstract Resource)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Add common meta, role checks, timestamp formatting      │ │
│ │ Reusable: YES (extended by all V1 resources)                            │ │
│ │ Why It Exists: DRY principle for shared resource functionality          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • with() → Adds meta.timestamp and meta.correlation_id                │ │
│ │   • canViewAdminFields() → Super Admin/Admin role check                 │ │
│ │   • userHasRole() → Generic role checking                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET: agencies:list:{md5_hash} (300s TTL)                                 │
│    Source: AgencyController::index                                          │
│    Tags: ['agencies']                                                       │
│                                                                             │
│ DATABASE OPERATIONS (on cache miss):                                        │
│                                                                             │
│ 1. SELECT agencies with count subquery:                                     │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT agencies.*,                                                  │  │
│    │        (SELECT COUNT(*) FROM agency_members                         │  │
│    │         WHERE agency_members.agency_id = agencies.id                │  │
│    │         AND status = 'active') AS active_members_count              │  │
│    │ FROM agencies                                                       │  │
│    │ WHERE status = 'approved'                                           │  │
│    │ [AND name LIKE '%search%']                                          │  │
│    │ [AND country = 'XX']                                                │  │
│    │ ORDER BY id                                                         │  │
│    │ LIMIT 21                                                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 2. SELECT owners (eager loaded):                                            │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT id, name, avatar, frame, signature, gender, date_of_birth,   │  │
│    │        wealth_xp, charm_xp, email, phone, country                   │  │
│    │ FROM users                                                          │  │
│    │ WHERE id IN (owner_ids...)                                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Agency/AgencyResource.php:24-75                 │
│                                                                             │
│ STEP 1: Build base response array                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = [                                                               │ │
│ │     'id' => $agency->id,                                                │ │
│ │     'name' => $agency->name,                                            │ │
│ │     'country' => $agency->country,                                      │ │
│ │     'logo' => $agency->logo,                                            │ │
│ │     'status' => $agency->status->value,                                 │ │
│ │     'status_label' => $agency->status->label(),                         │ │
│ │     'created_at' => $agency->created_at->toISOString(),                 │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Add owner (if relation loaded)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->relationLoaded('owner')) {                                 │ │
│ │     $data['owner'] = new MinimalUserResource($agency->owner);           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Add member count for approved agencies                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->isApproved()) {                                            │ │
│ │     $data['member_count'] = $agency->active_members_count               │ │
│ │         ?? $agency->activeMembers()->count();                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Sensitive fields (owner/member/admin only) - NOT in list response  │
│ STEP 5: Admin fields (Super Admin/Admin only) - NOT in list response       │
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

| File                      | Used By Endpoints            | Reusable | Reasoning                           |
| ------------------------- | ---------------------------- | -------- | ----------------------------------- |
| `AgencyController.php`    | agencies._, user.agency._    | ⭕       | Contains both reusable and specific |
| `Agency.php` (Model)      | All agency endpoints         | ✅       | Core domain model with scopes       |
| `AgencyResource.php`      | index, show, store           | ✅       | Consistent API transformation       |
| `MinimalUserResource.php` | 20+ endpoints across domains | ✅       | Optimized for embedding             |
| `BaseResource.php`        | All V1 API resources         | ✅       | Shared meta & role checks           |
| `AgencyPolicy.php`        | All agency authorization     | ✅       | Centralized authorization logic     |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error                     | Source  | Condition                    |
| ------------------------- | ------- | ---------------------------- |
| "Authentication required" | Sanctum | Missing/invalid Bearer token |
| "Unauthenticated"         | Sanctum | Expired token                |

### Rate Limiting (429)

| Error               | Source           | Condition                |
| ------------------- | ---------------- | ------------------------ |
| "Too Many Requests" | ThrottleRequests | 60+ requests in 1 minute |

### System Errors (500)

| Error                    | Source    | Condition                   |
| ------------------------ | --------- | --------------------------- |
| "An unexpected error..." | Exception | Redis connection failure    |
| "An unexpected error..." | Exception | Database connection failure |

### Edge Cases

| Case                           | Behavior                                |
| ------------------------------ | --------------------------------------- |
| No approved agencies exist     | Returns empty `data` array              |
| Invalid cursor parameter       | Returns first page (cursor reset)       |
| per_page > 100                 | Clamped to default (20)                 |
| Country code lowercase         | Auto-converted to uppercase in scope    |
| Search with special characters | LIKE query escapes properly             |
| Cache miss                     | Query executed, result cached for 5 min |
| Owner deleted (soft)           | Agency still returned, owner null       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER            MODEL/CACHE              DATABASE
   │                      │                      │                      │                      │
   │  GET /api/v1/        │                      │                      │                      │
   │  agencies?country=US │                      │                      │                      │
   │─────────────────────▶│                      │                      │                      │
   │                      │                      │                      │                      │
   │                      │ 1. auth:sanctum      │                      │                      │
   │                      │    validate token    │                      │                      │
   │                      │─────────────────────▶│                      │                      │
   │                      │                      │                      │                      │
   │                      │                      │ 2. Build cache key   │                      │
   │                      │                      │    from query params │                      │
   │                      │                      │                      │                      │
   │                      │                      │ 3. Cache::tags()     │                      │
   │                      │                      │    ->remember()      │                      │
   │                      │                      │─────────────────────▶│                      │
   │                      │                      │                      │                      │
   │                      │                      │                      │ 4. GET redis key     │
   │                      │                      │                      │ (cache miss)         │
   │                      │                      │                      │                      │
   │                      │                      │                      │ 5. Build query       │
   │                      │                      │                      │    with scopes       │
   │                      │                      │                      │─────────────────────▶│
   │                      │                      │                      │                      │
   │                      │                      │                      │ 6. SELECT agencies   │
   │                      │                      │                      │    WHERE status=     │
   │                      │                      │                      │    'approved'        │
   │                      │                      │◀─────────────────────│                      │
   │                      │                      │                      │                      │
   │                      │                      │                      │ 7. SELECT users      │
   │                      │                      │                      │    (eager load)      │
   │                      │                      │                      │─────────────────────▶│
   │                      │                      │                      │◀─────────────────────│
   │                      │                      │                      │                      │
   │                      │                      │                      │ 8. SET redis key     │
   │                      │                      │                      │    TTL 300s          │
   │                      │                      │                      │                      │
   │                      │                      │◀─────────────────────│                      │
   │                      │                      │                      │                      │
   │                      │                      │ 9. Transform via     │                      │
   │                      │                      │    AgencyResource    │                      │
   │                      │                      │    ::collection()    │                      │
   │                      │                      │                      │                      │
   │                      │◀─────────────────────│                      │                      │
   │                      │                      │                      │                      │
   │                      │ 10. ApiResponse      │                      │                      │
   │                      │     Middleware       │                      │                      │
   │◀─────────────────────│                      │                      │                      │
   │                      │                      │                      │                      │
   │  200 OK + JSON       │                      │                      │                      │
   │                      │                      │                      │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition           | Location                                            |
| ------------------ | --------------------------------------------------- |
| New query filter   | `AgencyController::index` + new scope in Model      |
| New response field | `AgencyResource::toArray()`                         |
| Admin-only field   | `AgencyResource` with `canViewAdminFields()` check  |
| Cache invalidation | Observer/Events triggering `Cache::tags()->flush()` |
| New sorting option | `AgencyController::index` query builder             |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                              | What to Change                      |
| ----- | ------------------------------------------------- | ----------------------------------- |
| **1** | `database/migrations/*create_agencies_table.php`  | Add column (if DB-backed)           |
| **2** | `app/Models/Agency/Agency.php`                    | Add to `$fillable`, `$casts`        |
| **3** | `app/Http/Resources/V1/Agency/AgencyResource.php` | Add to `$data` array in `toArray()` |
| **4** | Controller `->with()` clause                      | Add to eager load if relation       |

#### ➕ ADDING A NEW FILTER

| Step  | File                                                      | What to Change                    |
| ----- | --------------------------------------------------------- | --------------------------------- |
| **1** | `app/Models/Agency/Agency.php`                            | Add new `scope` method            |
| **2** | `app/Http/Controllers/Api/V1/Agency/AgencyController.php` | Add filter check in `index()`     |
| **3** | Cache key generation                                      | Add param to `$cacheParams` array |

#### ➖ REMOVING A FIELD

| Step  | File                                              | What to Change             |
| ----- | ------------------------------------------------- | -------------------------- |
| **1** | `app/Http/Resources/V1/Agency/AgencyResource.php` | Remove from `$data` array  |
| **2** | Controller `->with()` clause                      | Remove if no longer needed |
| **3** | Test frontend consumers                           | Ensure no dependencies     |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD FLOW: member_count                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Controller                 Model                 Resource                  │
│  ┌─────────────┐           ┌──────────────┐       ┌──────────────┐         │
│  │ withCount() │ ────────▶ │ active_      │ ────▶ │ member_count │         │
│  │             │           │ members_count│       │              │         │
│  └─────────────┘           └──────────────┘       └──────────────┘         │
│                                                                             │
│  DEPENDENCY: agency_members table, AgencyMember model                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD FLOW: owner                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Controller             Model                 Resource                      │
│  ┌─────────────┐       ┌────────────┐        ┌────────────────────┐        │
│  │ with()      │ ────▶ │ owner      │ ────▶  │ MinimalUserResource│        │
│  │ :id,name,...│       │ relation   │        │                    │        │
│  └─────────────┘       └────────────┘        └────────────────────┘        │
│                                                                             │
│  DEPENDENCY: users table, User model, MinimalUserResource                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                    |
| ---------------------------- | ----------------------------------------- |
| Cache tag `agencies`         | Used for cache invalidation across system |
| Cache TTL (300s)             | Balanced for freshness vs performance     |
| `scopeApproved()` logic      | Core filter - affects all list views      |
| Response structure           | Breaking change for frontend clients      |
| `MinimalUserResource` fields | 20+ endpoints depend on this structure    |
| Cursor pagination            | Mobile clients rely on cursor-based flow  |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                  |
| ---------------------------------------- | ------------------------------------------- |
| Adding filter without updating cache key | Always add new params to `$cacheParams`     |
| N+1 query on owner                       | Maintain eager loading with `->with()`      |
| Cache not invalidating                   | Use `Cache::tags(['agencies'])->flush()`    |
| Member count fallback query              | Always use `withCount()` in controller      |
| Country filter case sensitivity          | Scope handles `strtoupper()` automatically  |
| Search SQL injection                     | Laravel query builder escapes automatically |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 26)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php                                 ← Controller (lines 38-66)
app/Models/Agency/
  └── Agency.php                                           ← Model with scopes
app/Http/Resources/V1/Agency/
  └── AgencyResource.php                                   ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                              ← Owner sub-resource
app/Http/Resources/
  └── BaseResource.php                                     ← Abstract resource base
app/Policies/Agency/
  └── AgencyPolicy.php                                     ← Authorization (not used by index)
database/migrations/
  └── 2025_12_27_000001_create_agencies_table.php          ← Schema definition
bootstrap/app.php                                          ← Middleware configuration
```

---

## Document Metadata

| Property            | Value                  |
| ------------------- | ---------------------- |
| **Endpoint**        | `GET /api/v1/agencies` |
| **Domain**          | Agency                 |
| **Author**          | System Documentation   |
| **Created**         | 2026-02-03             |
| **Laravel Version** | 12.x                   |
| **PHP Version**     | 8.4                    |
