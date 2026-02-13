# GET /api/v1/resellers

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Resellers endpoint returns a list of all users with the "Reseller" role. This allows authenticated users to browse available resellers when submitting coin requests, with optional search filtering by signature or name.

### Responsibilities

- Retrieve all users assigned the "Reseller" role
- Support optional search/filter by signature or name (partial match)
- Return formatted reseller data for UI consumption
- Provide contact information (phone or email fallback)

### What It Owns

| Owned              | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| Reseller retrieval | Queries users with Reseller role from database              |
| Search filtering   | Applies optional signature/name partial match filter        |
| Response format    | Transforms User models into ResellerResource JSON structure |

### External Dependencies

| Dependency        | Type           | Purpose                                            |
| ----------------- | -------------- | -------------------------------------------------- |
| Spatie/Permission | Package        | Provides role-based filtering via `HasRoles` trait |
| Database          | Infrastructure | Users table with Spatie role model_has_roles pivot |
| Sanctum           | Package        | Authentication middleware                          |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/resellers
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config               |
| ------- | ------- | -------------------- |
| API     | User IP | `config/rate-limits` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter   | Type     | Required | Constraints     | Example    |
| ----------- | -------- | -------- | --------------- | ---------- |
| `signature` | `string` | ❌       | Optional search | `"ABC123"` |

> **Note**: The `signature` parameter performs a partial match search on both `signature` and `name` fields using SQL `LIKE %term%`.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Resellers retrieved successfully",
  "data": [
    {
      "id": 123,
      "name": "John Reseller",
      "signature": "JRS001",
      "contact": "+1234567890",
      "avatar": "https://example.com/avatar.jpg"
    }
  ],
  "meta": {
    "timestamp": "2026-02-02T08:22:16.000000Z",
    "correlation_id": "uuid-v4-string"
  }
}
```

#### Response Field Details

| Field       | Type           | Description                            |
| ----------- | -------------- | -------------------------------------- |
| `id`        | `integer`      | User's unique identifier               |
| `name`      | `string`       | User's display name                    |
| `signature` | `string`       | User's unique signature/ID code        |
| `contact`   | `string\|null` | Phone (formatted) or email as fallback |
| `avatar`    | `string\|null` | URL to user's avatar image             |

#### ❌ Unauthenticated Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-02T08:22:16.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "meta": {
    "timestamp": "2026-02-02T08:22:16.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                        |
| ----- | -------------------------------- |
| `200` | Resellers retrieved successfully |
| `401` | Missing or invalid auth token    |
| `500` | Database or server error         |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/resellers                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:17                                       │
│ Route: Route::get('/resellers', [ResellerController::class, 'index'])       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::get('/resellers', [ResellerController::class, 'index']);     │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Sanctum bearer token, sets $request->user()  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: vendor/laravel/sanctum/src/Http/Middleware/EnsureFrontendRequestsAre  │
│       Stateful.php                                                          │
│                                                                             │
│ Sanctum middleware validates the Bearer token from Authorization header     │
│ and resolves the authenticated User model onto the request.                 │
│                                                                             │
│ No custom FormRequest is used - this endpoint accepts only optional query   │
│ parameters and uses the base Illuminate\Http\Request.                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/ResellerController.php:25          │
│ Method: index(Request $request): JsonResponse                               │
│                                                                             │
│ STEP 1: Build base query for users with Reseller role                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = User::role('Reseller')                                         │ │
│ │     ->select(['id', 'name', 'signature', 'phone', 'country',            │ │
│ │               'email', 'avatar']);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Apply optional search filter                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($request->filled('signature')) {                                    │ │
│ │     $searchTerm = $request->input('signature');                         │ │
│ │     $query->where(function ($q) use ($searchTerm) {                     │ │
│ │         $q->where('signature', 'like', '%' . $searchTerm . '%')         │ │
│ │           ->orWhere('name', 'like', '%' . $searchTerm . '%');           │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute query and order results                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $resellers = $query->orderBy('name')->get();                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return formatted response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     ResellerResource::collection($resellers),                           │ │
│ │     'Resellers retrieved successfully'                                  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint does NOT use a dedicated service layer.                       │
│                                                                             │
│ The controller directly queries the User model using Eloquent with          │
│ Spatie Permission's role() scope. This is appropriate for simple read-only  │
│ operations without complex business logic.                                  │
│                                                                             │
│ SPATIE PERMISSION ROLE SCOPE:                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // From vendor/spatie/laravel-permission/src/Traits/HasRoles.php        │ │
│ │ public function scopeRole($query, $roles, $guard = null)                │ │
│ │ {                                                                       │ │
│ │     // Joins model_has_roles + roles tables to filter by role name      │ │
│ │     return $query->whereHas('roles', function ($q) use ($roles) {       │ │
│ │         $q->where('name', $roles);                                      │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: User (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: Represents users in the system                          │ │
│ │ Reusable: YES (central model used across entire application)            │ │
│ │ Why It Exists: Core user entity with roles, authentication, relations   │ │
│ │                                                                         │ │
│ │ Key Traits:                                                             │ │
│ │   • HasRoles (Spatie) → Provides role() scope for filtering             │ │
│ │   • HasApiTokens (Sanctum) → Token-based authentication                 │ │
│ │                                                                         │ │
│ │ Key Fields Selected:                                                    │ │
│ │   • id, name, signature, phone, country, email, avatar                  │ │
│ │                                                                         │ │
│ │ Key Cast:                                                               │ │
│ │   • phone → PhoneCast::class (auto-formats as PhoneNumber object)       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ResellerResource (API Resource)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/ResellerResource.php                │ │
│ │ Responsibility: Transform User model into reseller JSON response        │ │
│ │ Reusable: YES (used by multiple reseller-related endpoints)             │ │
│ │ Why It Exists: Consistent reseller data format across API               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns id, name, signature, contact, avatar            │ │
│ │                                                                         │ │
│ │ Contact Logic:                                                          │ │
│ │   • 'contact' => $this->formatted_phone ?? $this->email                 │ │
│ │   • Prefers phone if available, falls back to email                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Abstract Resource)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Common resource functionality (metadata, helpers)       │ │
│ │ Reusable: YES (parent class for all API resources)                      │ │
│ │ Why It Exists: DRY principle - shared metadata and helper methods       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • with() → Adds meta.timestamp and meta.correlation_id                │ │
│ │   • userHasRole() → Check authenticated user roles                      │ │
│ │   • formatTimestamp() → Consistent ISO timestamp formatting             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent response structure across entire API          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Standard success response with data/message/meta        │ │
│ │   • error() → Standard error response                                   │ │
│ │   • getCorrelationId() → Request tracking ID                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: PhoneCast (Cast)                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Casts/PhoneCast.php                                           │ │
│ │ Responsibility: Cast phone field to/from PhoneNumber object             │ │
│ │ Reusable: YES (used by User model phone field)                          │ │
│ │ Why It Exists: Automatic E.164 formatting and PhoneNumber parsing       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • get() → Parse stored E.164 string to PhoneNumber object             │ │
│ │   • set() → Convert input to E.164 format for storage                   │ │
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
│ 1. SELECT: Retrieve users with Reseller role                                │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT users.id, users.name, users.signature, users.phone,           │ │
│    │        users.country, users.email, users.avatar                      │ │
│    │ FROM users                                                           │ │
│    │ WHERE EXISTS (                                                       │ │
│    │     SELECT * FROM model_has_roles                                    │ │
│    │     INNER JOIN roles ON roles.id = model_has_roles.role_id           │ │
│    │     WHERE model_has_roles.model_id = users.id                        │ │
│    │       AND model_has_roles.model_type = 'App\Models\User\User'        │ │
│    │       AND roles.name = 'Reseller'                                    │ │
│    │ )                                                                    │ │
│    │ [AND (signature LIKE '%term%' OR name LIKE '%term%')]  -- if search  │ │
│    │ ORDER BY name ASC                                                    │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: ResellerController::index()                                      │
│    Tables: users, model_has_roles (Spatie), roles (Spatie)                 │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ STEP 1: Collection Processing                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ResellerResource::collection($resellers)                                │ │
│ │ └─> Iterates over each User model                                       │ │
│ │     └─> Calls ResellerResource::toArray() for each                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: ResellerResource Transform                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // app/Http/Resources/V1/Economy/ResellerResource.php:25                │ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'signature' => $this->signature,                                    │ │
│ │     'contact' => $this->formatted_phone ?? $this->email,                │ │
│ │     'avatar' => $this->avatar,                                          │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: ApiResponse Wrapping                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // app/Http/Utils/ApiResponse.php:15                                    │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Resellers retrieved successfully',                    │ │
│ │     'data' => [...transformed resources...],                            │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
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

| File                           | Used By Endpoints                                          | Reusable | Reasoning                                           |
| ------------------------------ | ---------------------------------------------------------- | -------- | --------------------------------------------------- |
| `ResellerController.php`       | `/resellers`, `/user/default-reseller`                     | ⭕       | Reseller-specific but has multiple methods          |
| `ResellerResource.php`         | `/resellers`, `/user/default-reseller`, `/coin-requests/*` | ✅       | Standard reseller data format across economy domain |
| `BaseResource.php`             | All API resources                                          | ✅       | Abstract base for all resources                     |
| `ApiResponse.php`              | All API endpoints                                          | ✅       | Universal response formatter                        |
| `User.php`                     | Entire application                                         | ✅       | Core user model                                     |
| `PhoneCast.php`                | `User.phone`, any model with phone field                   | ✅       | Generic phone number handling                       |
| `routes/api/coin-requests.php` | Coin request domain routes                                 | ⭕       | Domain-specific route file                          |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

This endpoint has **no validation errors** as it only accepts optional query parameters with no constraints.

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |
| "Unauthenticated." | `auth:sanctum` | Expired Sanctum token           |

### Business Logic Errors (400)

This endpoint has **no business logic errors** - it's a simple read operation.

### System Errors (500)

| Error                 | Source           | Condition                          |
| --------------------- | ---------------- | ---------------------------------- |
| Database connection   | `User::role()`   | MySQL connection failure           |
| Query execution error | Eloquent Builder | Malformed SQL (unlikely)           |
| Phone parsing error   | `PhoneCast`      | Corrupted phone data (logged only) |

### Edge Cases

| Case                           | Behavior                                               |
| ------------------------------ | ------------------------------------------------------ |
| No resellers exist             | Returns empty array `[]` with success status           |
| Search returns no matches      | Returns empty array `[]` with success status           |
| User phone is null             | `contact` falls back to email                          |
| Both phone and email are null  | `contact` will be `null`                               |
| Search term contains SQL chars | Safely escaped by Eloquent parameter binding           |
| Very long search term          | No limit, may impact performance (consider adding max) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            USER MODEL              DATABASE
   │                       │                       │                       │                     │
   │  GET /api/v1/resellers│                       │                       │                     │
   │  ?signature=ABC       │                       │                       │                     │
   │──────────────────────▶│                       │                       │                     │
   │                       │                       │                       │                     │
   │                       │ 1. auth:sanctum       │                       │                     │
   │                       │    validate token     │                       │                     │
   │                       │──────────────────────▶│                       │                     │
   │                       │                       │                       │                     │
   │                       │                       │ 2. User::role('Reseller')                   │
   │                       │                       │    ->select([fields])  │                     │
   │                       │                       │──────────────────────▶│                     │
   │                       │                       │                       │                     │
   │                       │                       │                       │ 3. Build query with │
   │                       │                       │                       │    Spatie role scope │
   │                       │                       │                       │                     │
   │                       │                       │ 4. Apply search filter│                     │
   │                       │                       │    (if signature set) │                     │
   │                       │                       │──────────────────────▶│                     │
   │                       │                       │                       │                     │
   │                       │                       │                       │ 5. Execute query    │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                     │
   │                       │                       │                       │ 6. Return User      │
   │                       │                       │                       │    Collection       │
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                     │
   │                       │                       │ 7. Transform via      │                     │
   │                       │                       │    ResellerResource   │                     │
   │                       │                       │◀──────────────────────│                     │
   │                       │                       │                       │                     │
   │                       │                       │ 8. Wrap in            │                     │
   │                       │                       │    ApiResponse::success                     │
   │                       │                       │                       │                     │
   │                       │◀──────────────────────│                       │                     │
   │◀──────────────────────│                       │                       │                     │
   │                       │                       │                       │                     │
   │  200 OK + JSON        │                       │                       │                     │
   │                       │                       │                       │                     │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| New response field          | `ResellerResource::toArray()`                                     |
| New search/filter parameter | `ResellerController::index()` - add to query builder              |
| Pagination                  | `ResellerController::index()` - change `get()` to `paginate()`    |
| Caching                     | `ResellerController::index()` - wrap query with Cache::remember() |
| New reseller-related route  | `routes/api/coin-requests.php` in same middleware group           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                        | What to Change                        |
| ----- | ----------------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Agency/ResellerController.php` | Add field to `->select([...])` array  |
| **2** | `app/Http/Resources/V1/Economy/ResellerResource.php`        | Add field to `toArray()` return array |

**Example: Adding `country` field**

```php
// Step 1: ResellerController.php:28
$query = User::role('Reseller')
    ->select(['id', 'name', 'signature', 'phone', 'country', 'email', 'avatar', 'country']);
                                                                        // ^^^^^^^ add here

// Step 2: ResellerResource.php:27
return [
    'id' => $this->id,
    'name' => $this->name,
    'signature' => $this->signature,
    'contact' => $this->formatted_phone ?? $this->email,
    'avatar' => $this->avatar,
    'country' => $this->country,  // <-- add here
];
```

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                        | What to Change                                                   |
| ----- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **1** | `app/Http/Resources/V1/Economy/ResellerResource.php`        | Remove field from `toArray()` return array                       |
| **2** | `app/Http/Controllers/Api/V1/Agency/ResellerController.php` | Remove field from `->select([...])` (optional, for optimization) |

#### ➕ ADDING A NEW FILTER PARAMETER

| Step  | File                                                        | What to Change               |
| ----- | ----------------------------------------------------------- | ---------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Agency/ResellerController.php` | Add conditional query clause |

**Example: Adding `country` filter**

```php
// ResellerController.php:31
if ($request->filled('country')) {
    $query->where('country', $request->input('country'));
}
```

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW: phone → contact                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Database (users.phone)                                                      │
│       │                                                                      │
│       ▼                                                                      │
│  PhoneCast::get()         → Parses E.164 string to PhoneNumber object        │
│       │                                                                      │
│       ▼                                                                      │
│  PhoneNumber object       → Provides formatting methods                       │
│       │                                                                      │
│       ▼                                                                      │
│  formatted_phone accessor → ??? (May be on PhoneNumber or missing)           │
│       │                                                                      │
│       ▼                                                                      │
│  ResellerResource         → $this->formatted_phone ?? $this->email           │
│       │                                                                      │
│       ▼                                                                      │
│  JSON Response            → "contact": "+1234567890" or "user@example.com"   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding pagination

- [ ] Change `->get()` to `->paginate($perPage)`
- [ ] Change `ApiResponse::success()` to `ApiResponse::paginated()`
- [ ] Add `per_page` query parameter support
- [ ] Update API documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                 |
| ------------------------- | ------------------------------------------------------ |
| `User::role()` scope      | Spatie Permission internal - modify via package config |
| `ApiResponse` structure   | Breaking change for all API consumers                  |
| `BaseResource::with()`    | Affects metadata for all API responses                 |
| `model_has_roles` table   | Spatie Permission internal - use package migrations    |
| Authentication middleware | Security-critical - requires thorough testing          |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                                 |
| ---------------------------------------- | ---------------------------------------------------------- |
| Forgetting to select field in controller | Always add to `select()` when adding to resource           |
| N+1 query with relationships             | Use `->with()` for any relationships (none currently used) |
| SQL injection via search parameter       | Already safe - Eloquent uses parameter binding             |
| Exposing sensitive user fields           | Only select necessary fields in controller                 |
| Breaking API contract                    | Use API versioning for breaking changes                    |
| Missing `formatted_phone` accessor       | Depends on PhoneNumber object's `__toString()` or accessor |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                       ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── ResellerController.php                       ← Controller
app/Http/Resources/V1/Economy/
  └── ResellerResource.php                         ← Response transformer
app/Http/Resources/
  └── BaseResource.php                             ← Base resource class
app/Http/Utils/
  └── ApiResponse.php                              ← Response utility
app/Models/User/
  └── User.php                                     ← User model
app/Casts/
  └── PhoneCast.php                                ← Phone field cast
```

---

## Document Metadata

| Property            | Value                   |
| ------------------- | ----------------------- |
| **Endpoint**        | `GET /api/v1/resellers` |
| **Domain**          | Economy                 |
| **Author**          | System Documentation    |
| **Created**         | 2026-02-02              |
| **Laravel Version** | 12.x                    |
| **PHP Version**     | 8.4                     |
