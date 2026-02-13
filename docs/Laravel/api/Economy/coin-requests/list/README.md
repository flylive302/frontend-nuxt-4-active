# GET /api/v1/coin-requests

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Coin Requests endpoint retrieves a paginated list of the authenticated user's coin requests. It shows all requests the user has made to resellers for coins or diamonds, regardless of status.

### Responsibilities

- Retrieve all coin requests belonging to the authenticated user
- Paginate results with configurable page size
- Include related reseller and processor information
- Transform data using consistent API resource format

### What It Owns

| Owned           | Description                                        |
| --------------- | -------------------------------------------------- |
| User's requests | Retrieves `coin_requests` records for current user |
| Pagination      | Controls page size and result ordering             |

### External Dependencies

| Dependency | Type           | Purpose                    |
| ---------- | -------------- | -------------------------- |
| Database   | Infrastructure | Query `coin_requests` table |
| Sanctum    | Package        | User authentication        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/coin-requests
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key            | Config                    |
| ------- | -------------- | ------------------------- |
| Default | `user_id + ip` | 60 requests/minute (API)  |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type      | Default | Description               |
| ---------- | --------- | ------- | ------------------------- |
| `per_page` | `integer` | `15`    | Number of results per page |
| `page`     | `integer` | `1`     | Page number               |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin requests retrieved successfully",
  "data": [
    {
      "id": 1,
      "user": {
        "id": 123,
        "name": "John Doe",
        "avatar": "https://..."
      },
      "reseller": {
        "id": 456,
        "name": "Reseller Name",
        "avatar": "https://..."
      },
      "amount": "100.00",
      "approved_amount": "100.00",        // null if not yet approved
      "final_amount": "100.00",           // approved_amount ?? amount
      "was_adjusted": false,              // true if approved_amount differs
      "type": {
        "value": "cash",                  // "cash" or "credit"
        "label": "Cash"
      },
      "status": {
        "value": "pending",               // pending|approved|rejected|cancelled|expired
        "label": "Pending",
        "color": "yellow",                // UI hint
        "is_final": false                 // true for rejected/cancelled/expired
      },
      "message": "Please process quickly",
      "admin_note": null,                 // Reseller's note
      "proofs": [                         // Array of proof images
        { "url": "https://...", "file_id": "abc123" }
      ],
      "credit_days": null,                // Only for credit type
      "is_repaid": false,
      "repaid_at": null,
      "is_repayment_due": false,
      "processor": null,                  // User who processed
      "processed_at": null,
      "expires_at": "2026-02-03T08:43:09.000000Z",
      "created_at": "2026-02-02T08:43:09.000000Z",
      "updated_at": "2026-02-02T08:43:09.000000Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 15,
      "total": 42,
      "last_page": 3,
      "from": 1,
      "to": 15,
      "path": "http://api.flylive.com/api/v1/coin-requests",
      "first_page_url": "...",
      "last_page_url": "...",
      "next_page_url": "...",
      "prev_page_url": null
    },
    "timestamp": "2026-02-02T08:43:09.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Unauthenticated",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Requests retrieved successfully     |
| `401` | Missing or invalid authentication   |
| `500` | Server error (database failure)     |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/coin-requests                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:23                                       │
│ Route: Route::get('/', [CoinRequestController::class, 'index'])             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::prefix('coin-requests')->group(function () {                 │ │
│ │         Route::get('/', [CoinRequestController::class, 'index']);       │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, sets Auth::user()               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest - Uses standard Illuminate\Http\Request                      │
│                                                                             │
│ Query parameters are read directly:                                         │
│   • per_page: Optional integer, defaults to 15                              │
│   • page: Optional integer, defaults to 1                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/CoinRequestController.php:32-46   │
│ Method: index(Request $request)                                             │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ /** @var \App\Models\User\User $user */                                 │ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Query repository for user's coin requests                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequests = $this->repository->getByUser(                           │ │
│ │     $user->id,                                                          │ │
│ │     (int) $request->input('per_page', 15)                               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return paginated response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     CoinRequestResource::collection($coinRequests),                     │ │
│ │     'Coin requests retrieved successfully'                              │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 REPOSITORY LAYER                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ Interface: app/Contracts/Repositories/CoinRequestRepositoryInterface.php    │
│ Implementation: app/Repositories/CoinRequest/CoinRequestRepository.php      │
│ Binding: app/Providers/RepositoryServiceProvider.php:24                     │
│                                                                             │
│ Method: getByUser(int $userId, int $perPage = 15)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return CoinRequest::with(['reseller:id,name,avatar',                    │ │
│ │                           'processor:id,name'])                         │ │
│ │     ->where('user_id', $userId)                                         │ │
│ │     ->latest()                                                          │ │
│ │     ->paginate($perPage);                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Eager Loading:                                                              │
│   • reseller → User model (id, name, avatar)                                │
│   • processor → User model (id, name) - who approved/rejected               │
│                                                                             │
│ Note: 'user' relation NOT loaded - already known (authenticated user)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CoinRequest (Model)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/CoinRequest.php                                │ │
│ │ Responsibility: Eloquent model for coin_requests table                  │ │
│ │ Reusable: YES (used by multiple endpoints)                              │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user()      → BelongsTo User (requester)                            │ │
│ │   • reseller()  → BelongsTo User (target reseller)                      │ │
│ │   • processor() → BelongsTo User (who processed)                        │ │
│ │                                                                         │ │
│ │ Key Methods used by Resource:                                           │ │
│ │   • getFinalAmount()      → approved_amount ?? amount                   │ │
│ │   • wasAmountAdjusted()   → approved != original                        │ │
│ │   • isRepaymentDue()      → credit overdue check                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/CoinRequestResource.php             │ │
│ │ Responsibility: Transform CoinRequest model to API response             │ │
│ │ Reusable: YES (used by index, show, store, destroy endpoints)           │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • Transforms enum values (type, status) to value/label objects        │ │
│ │   • Computes derived fields (final_amount, was_adjusted)                │ │
│ │   • Formats timestamps to ISO 8601 strings                              │ │
│ │   • Handles nullable relationships (processor)                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Consistent API response formatting                      │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Method:                                                             │ │
│ │   • paginated() → Extracts pagination meta from LengthAwarePaginator    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Enums                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Files:                                                                  │ │
│ │   • app/Enums/Economy/CoinRequestStatus.php                             │ │
│ │   • app/Enums/Economy/CoinRequestType.php                               │ │
│ │   • app/Enums/Gift/AssetType.php                                        │ │
│ │                                                                         │ │
│ │ CoinRequestStatus values:                                               │ │
│ │   pending, approved, rejected, cancelled, expired                       │ │
│ │                                                                         │ │
│ │ CoinRequestType values:                                                 │ │
│ │   cash, credit                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Get paginated coin requests                                      │
│    Query: SELECT * FROM coin_requests                                       │
│           WHERE user_id = ?                                                 │
│           ORDER BY created_at DESC                                          │
│           LIMIT ? OFFSET ?                                                  │
│    Source: CoinRequestRepository::getByUser()                               │
│                                                                             │
│ 2. SELECT: Count total for pagination                                       │
│    Query: SELECT COUNT(*) FROM coin_requests WHERE user_id = ?              │
│    Source: LengthAwarePaginator (automatic)                                 │
│                                                                             │
│ 3. SELECT: Eager load resellers                                             │
│    Query: SELECT id, name, avatar FROM users WHERE id IN (...)              │
│    Source: with(['reseller:id,name,avatar'])                                │
│                                                                             │
│ 4. SELECT: Eager load processors (if any)                                   │
│    Query: SELECT id, name FROM users WHERE id IN (...)                      │
│    Source: with(['processor:id,name'])                                      │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ 1. CoinRequestResource::collection()                                        │
│    → Wraps LengthAwarePaginator in ResourceCollection                       │
│    → Each item transformed via CoinRequestResource::toArray()               │
│                                                                             │
│ 2. ApiResponse::paginated()                                                 │
│    → Extracts pagination metadata from the paginator                        │
│    → Builds standardized response structure                                 │
│    → Adds timestamp and correlation_id to meta                              │
│                                                                             │
│ 3. Response format:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Coin requests retrieved successfully",                    │ │
│ │   "data": [ ... transformed coin requests ... ],                        │ │
│ │   "meta": {                                                             │ │
│ │     "pagination": { ... },                                              │ │
│ │     "timestamp": "...",                                                 │ │
│ │     "correlation_id": "..."                                             │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
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

| File                                      | Used By Endpoints                                   | Reusable | Reasoning                                    |
| ----------------------------------------- | --------------------------------------------------- | -------- | -------------------------------------------- |
| `CoinRequestController.php`               | coin-requests CRUD                                  | ⭕       | index/show shared patterns, store/destroy specific |
| `CoinRequestRepository.php`               | All coin request endpoints                          | ✅       | Central data access layer                    |
| `CoinRequestRepositoryInterface.php`      | All coin request endpoints                          | ✅       | Contract for dependency injection            |
| `CoinRequestResource.php`                 | index, show, store, destroy                         | ✅       | Single transformation for all responses      |
| `CoinRequest.php` (Model)                 | All Economy domain endpoints                        | ✅       | Eloquent model, relationships, scopes        |
| `ApiResponse.php`                         | ALL API endpoints                                   | ✅       | Global response wrapper                      |
| `BaseResource.php`                        | ALL API resources                                   | ✅       | Common resource utilities                    |
| `CoinRequestStatus.php` (Enum)            | All coin request endpoints                          | ✅       | Status values with labels/colors             |
| `CoinRequestType.php` (Enum)              | All coin request endpoints                          | ✅       | Type values (cash/credit)                    |
| `RepositoryServiceProvider.php`           | Application bootstrap                               | ✅       | DI container bindings                        |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

None - this endpoint has no required input validation beyond authentication.

### Authentication Errors (401)

| Error              | Source                  | Condition                           |
| ------------------ | ----------------------- | ----------------------------------- |
| `Unauthenticated.` | `auth:sanctum` middleware | Missing or invalid Bearer token     |

### System Errors (500)

| Error                     | Source                   | Condition                        |
| ------------------------- | ------------------------ | -------------------------------- |
| Database connection error | `CoinRequestRepository`  | Database unavailable             |
| Query timeout             | `CoinRequestRepository`  | Large dataset, slow query        |

### Edge Cases

| Case                              | Behavior                              |
| --------------------------------- | ------------------------------------- |
| User has no coin requests         | Returns empty `data: []` with pagination showing `total: 0` |
| Invalid `per_page` value (string) | Cast to `(int)`, "abc" becomes 0, uses default 15 |
| Very large `per_page` (e.g., 1000) | No server-side limit enforced - returns up to 1000 |
| Negative `per_page`               | Laravel paginator uses absolute value |
| Soft-deleted requests             | Excluded by default (SoftDeletes trait) |
| Related reseller deleted          | Returns reseller data if soft-deleted, null if hard-deleted |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            REPOSITORY               DATABASE
    │                       │                       │                       │                    │
    │  GET /coin-requests   │                       │                       │                    │
    │  Authorization: ...   │                       │                       │                    │
    │──────────────────────▶│                       │                       │                    │
    │                       │                       │                       │                    │
    │                       │ 1. Validate token     │                       │                    │
    │                       │    (auth:sanctum)     │                       │                    │
    │                       │──────────────────────▶│                       │                    │
    │                       │                       │                       │                    │
    │                       │                       │ 2. Get user from      │                    │
    │                       │                       │    request            │                    │
    │                       │                       │                       │                    │
    │                       │                       │ 3. Call repository    │                    │
    │                       │                       │    getByUser()        │                    │
    │                       │                       │──────────────────────▶│                    │
    │                       │                       │                       │                    │
    │                       │                       │                       │ 4. SELECT count    │
    │                       │                       │                       │───────────────────▶│
    │                       │                       │                       │◀───────────────────│
    │                       │                       │                       │                    │
    │                       │                       │                       │ 5. SELECT requests │
    │                       │                       │                       │    + ORDER + LIMIT │
    │                       │                       │                       │───────────────────▶│
    │                       │                       │                       │◀───────────────────│
    │                       │                       │                       │                    │
    │                       │                       │                       │ 6. SELECT resellers│
    │                       │                       │                       │    (eager load)    │
    │                       │                       │                       │───────────────────▶│
    │                       │                       │                       │◀───────────────────│
    │                       │                       │                       │                    │
    │                       │                       │                       │ 7. SELECT processors
    │                       │                       │                       │    (eager load)    │
    │                       │                       │                       │───────────────────▶│
    │                       │                       │                       │◀───────────────────│
    │                       │                       │                       │                    │
    │                       │                       │◀──────────────────────│                    │
    │                       │                       │  LengthAwarePaginator │                    │
    │                       │                       │                       │                    │
    │                       │                       │ 8. Transform with     │                    │
    │                       │                       │    CoinRequestResource│                    │
    │                       │                       │                       │                    │
    │                       │                       │ 9. ApiResponse::      │                    │
    │                       │                       │    paginated()        │                    │
    │                       │                       │                       │                    │
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
| New query filter            | `CoinRequestRepository::getByUser()` + controller input |
| New response field          | `CoinRequestResource::toArray()`                    |
| New sorting option          | `CoinRequestRepository::getByUser()`                |
| Caching                     | `CoinRequestRepository::getByUser()` (wrap query)   |
| Rate limiting               | `routes/api/coin-requests.php` (add middleware)     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                      | What to Change                          |
| ----- | --------------------------------------------------------- | --------------------------------------- |
| **1** | `database/migrations/` (if new column)                    | Add column migration                    |
| **2** | `app/Models/Economy/CoinRequest.php`                      | Add to `$fillable`, add to `casts()`    |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`   | Add field to `toArray()` return array   |
| **4** | This documentation                                        | Update response schema                  |

**Example - Adding `priority` field:**

```php
// In CoinRequestResource::toArray()
return [
    // ... existing fields ...
    'priority' => $coinRequest->priority,  // Add new field
];
```

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                      | What to Change                          |
| ----- | --------------------------------------------------------- | --------------------------------------- |
| **1** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`   | Remove from `toArray()` return array    |
| **2** | This documentation                                        | Update response schema                  |
| **3** | Frontend consumers                                        | Update to not expect field              |

#### 🔧 ADDING A QUERY FILTER

| Step  | File                                                      | What to Change                          |
| ----- | --------------------------------------------------------- | --------------------------------------- |
| **1** | `app/Contracts/Repositories/CoinRequestRepositoryInterface.php` | Update method signature              |
| **2** | `app/Repositories/CoinRequest/CoinRequestRepository.php`  | Implement filter in query               |
| **3** | `app/Http/Controllers/Api/V1/Economy/CoinRequestController.php` | Read query param, pass to repository |

**Example - Adding status filter:**

```php
// In CoinRequestController::index()
$status = $request->input('status');

$coinRequests = $this->repository->getByUser(
    $user->id,
    (int) $request->input('per_page', 15),
    $status  // Pass filter
);
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIELD MODIFICATION CHAIN                           │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Database Column                                                            │
│       │                                                                     │
│       ▼                                                                     │
│  CoinRequest Model ($fillable, casts())                                     │
│       │                                                                     │
│       ▼                                                                     │
│  CoinRequestResource (toArray())                                            │
│       │                                                                     │
│       ▼                                                                     │
│  API Response (JSON output)                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                              |
| --------------------------------- | --------------------------------------------------- |
| `CoinRequestResource` field names | Breaking change for API consumers                   |
| `ApiResponse::paginated()` format | All endpoints depend on this structure              |
| `auth:sanctum` middleware         | Security critical                                   |
| Repository interface methods      | Requires updating all implementations               |
| Status enum values                | Used for business logic across domain               |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                         |
| -------------------------------------- | -------------------------------------------------- |
| Forgetting eager loading               | Always check N+1 queries with Laravel Debugbar     |
| Returning raw model instead of resource | Always use `CoinRequestResource` transformation   |
| Adding filter without validation        | Use FormRequest for complex query parameters       |
| Changing resource field names           | Version the API or deprecate fields properly      |
| Large `per_page` values                 | Consider adding max limit (e.g., 100)             |
| Missing `user` relation in resource     | Resource accesses `$coinRequest->user` - ensure loaded |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                             ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── CoinRequestController.php                          ← Controller
app/Contracts/Repositories/
  └── CoinRequestRepositoryInterface.php                 ← Repository contract
app/Repositories/CoinRequest/
  └── CoinRequestRepository.php                          ← Repository implementation
app/Providers/
  └── RepositoryServiceProvider.php                      ← DI binding
app/Models/Economy/
  └── CoinRequest.php                                    ← Eloquent model
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                            ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
app/Enums/Economy/
  ├── CoinRequestStatus.php                              ← Status enum
  └── CoinRequestType.php                                ← Type enum
database/migrations/
  └── 2025_12_18_000001_create_coin_requests_table.php   ← Migration
```

---

## Document Metadata

| Property            | Value                                     |
| ------------------- | ----------------------------------------- |
| **Endpoint**        | `GET /api/v1/coin-requests`               |
| **Domain**          | Economy                                   |
| **Author**          | System Documentation                      |
| **Created**         | 2026-02-02                                |
| **Laravel Version** | 12.x                                      |
| **PHP Version**     | 8.4                                       |
