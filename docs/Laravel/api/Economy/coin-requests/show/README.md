# GET /api/v1/coin-requests/{coinRequest}

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Show Coin Request endpoint retrieves a single coin request by its ID. Users can view their own requests, resellers can view requests made to them, and Super Admins can view any request.

### Responsibilities

- Retrieve a specific coin request by ID using route-model binding
- Authorize access via CoinRequestPolicy (owner, reseller, or Super Admin)
- Eager load related user, reseller, and processor information
- Transform data using consistent API resource format

### What It Owns

| Owned               | Description                                     |
| ------------------- | ----------------------------------------------- |
| Single request view | Retrieves `coin_requests` record by primary key |
| Authorization       | Enforces view permissions via policy            |

### External Dependencies

| Dependency | Type           | Purpose                     |
| ---------- | -------------- | --------------------------- |
| Database   | Infrastructure | Query `coin_requests` table |
| Sanctum    | Package        | User authentication         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/coin-requests/{coinRequest}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key            | Config                   |
| ------- | -------------- | ------------------------ |
| Default | `user_id + ip` | 60 requests/minute (API) |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter     | Type      | Description                        |
| ------------- | --------- | ---------------------------------- |
| `coinRequest` | `integer` | The ID of the coin request to view |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin request retrieved successfully",
  "data": {
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
    "approved_amount": "100.00", // null if not yet approved
    "final_amount": "100.00", // approved_amount ?? amount
    "was_adjusted": false, // true if approved_amount differs
    "type": {
      "value": "cash", // "cash" or "credit"
      "label": "Cash"
    },
    "status": {
      "value": "pending", // pending|approved|rejected|cancelled|expired
      "label": "Pending",
      "color": "yellow", // UI hint
      "is_final": false // true for rejected/cancelled/expired
    },
    "message": "Please process quickly",
    "admin_note": null, // Reseller's note
    "proofs": [
      // Array of proof images
      { "url": "https://...", "file_id": "abc123" }
    ],
    "credit_days": null, // Only for credit type
    "is_repaid": false,
    "repaid_at": null,
    "is_repayment_due": false,
    "processor": null, // User who processed
    "processed_at": null,
    "expires_at": "2026-02-03T08:43:09.000000Z",
    "created_at": "2026-02-02T08:43:09.000000Z",
    "updated_at": "2026-02-02T08:43:09.000000Z"
  },
  "meta": {
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

#### ❌ Forbidden (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Economy\\CoinRequest] {id}",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Request retrieved successfully      |
| `401` | Missing or invalid authentication   |
| `403` | User not authorized to view request |
| `404` | Coin request not found              |
| `500` | Server error (database failure)     |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/coin-requests/{coinRequest}                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:25                                       │
│ Route: Route::get('/{coinRequest}', [CoinRequestController::class, 'show']) │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::prefix('coin-requests')->group(function () {                 │ │
│ │         Route::get('/{coinRequest}', [CoinRequestController::class,     │ │
│ │                                       'show']);                         │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, sets Auth::user()               │
│                                                                             │
│ Route-Model Binding:                                                        │
│   {coinRequest} → Resolved via implicit binding to CoinRequest model        │
│   If not found → Laravel throws ModelNotFoundException (404)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE-MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel automatically resolves {coinRequest} to CoinRequest model instance  │
│                                                                             │
│ Implicit Binding Process:                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Laravel internally performs:                                         │ │
│ │ CoinRequest::findOrFail($coinRequest);                                  │ │
│ │                                                                         │ │
│ │ // Using SoftDeletes - excluded by default                              │ │
│ │ SELECT * FROM coin_requests WHERE id = ? AND deleted_at IS NULL LIMIT 1 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If not found:                                                               │
│   → Throws Illuminate\Database\Eloquent\ModelNotFoundException              │
│   → Laravel converts to 404 response                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/CoinRequestController.php:84-97   │
│ Method: show(CoinRequest $coinRequest)                                      │
│                                                                             │
│ STEP 1: Policy authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('view', $coinRequest);                                 │ │
│ │                                                                         │ │
│ │ // Delegates to CoinRequestPolicy::view()                               │ │
│ │ // Throws AuthorizationException (403) if denied                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Eager load relationships                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->load([                                                    │ │
│ │     'user:id,name,avatar',                                              │ │
│ │     'reseller:id,name,avatar',                                          │ │
│ │     'processor:id,name'                                                 │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new CoinRequestResource($coinRequest),                              │ │
│ │     'Coin request retrieved successfully'                               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 AUTHORIZATION (POLICY)                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Economy/CoinRequestPolicy.php:28-34                      │
│ Method: view(User $user, CoinRequest $coinRequest)                          │
│                                                                             │
│ Authorization Logic:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function view(User $user, CoinRequest $coinRequest): bool        │ │
│ │ {                                                                       │ │
│ │     // Owner, target reseller, or SuperAdmin                            │ │
│ │     return $user->id === $coinRequest->user_id                          │ │
│ │         || $user->id === $coinRequest->reseller_id                      │ │
│ │         || $user->hasRole('Super Admin');                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Access Granted To:                                                          │
│   • Owner (user_id matches authenticated user)                              │
│   • Target Reseller (reseller_id matches authenticated user)                │
│   • Super Admin (has 'Super Admin' role)                                    │
│                                                                             │
│ If Denied:                                                                  │
│   → Throws Illuminate\Auth\Access\AuthorizationException                    │
│   → Laravel converts to 403 Forbidden response                              │
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
│ │   • processor() → BelongsTo User (who processed the request)            │ │
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
│ COMPONENT: CoinRequestPolicy (Authorization)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Economy/CoinRequestPolicy.php                        │ │
│ │ Responsibility: Authorize access to CoinRequest resources               │ │
│ │ Reusable: YES (used by all coin request endpoints)                      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • view()       → Owner, reseller, or Super Admin                      │ │
│ │   • cancel()     → Owner or Super Admin (pending only)                  │ │
│ │   • approve()    → Target reseller or Super Admin                       │ │
│ │   • reject()     → Same as approve()                                    │ │
│ │   • markRepaid() → Reseller or Super Admin (approved credit only)       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Consistent API response formatting                      │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Method:                                                             │ │
│ │   • success() → Wraps data with status, message, meta                   │ │
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
│ 1. SELECT: Route-model binding (find coin request)                          │
│    Query: SELECT * FROM coin_requests                                       │
│           WHERE id = ? AND deleted_at IS NULL                               │
│           LIMIT 1                                                           │
│    Source: Laravel route-model binding (implicit)                           │
│                                                                             │
│ 2. SELECT: Eager load user                                                  │
│    Query: SELECT id, name, avatar FROM users WHERE id = ?                   │
│    Source: $coinRequest->load(['user:id,name,avatar'])                      │
│                                                                             │
│ 3. SELECT: Eager load reseller                                              │
│    Query: SELECT id, name, avatar FROM users WHERE id = ?                   │
│    Source: $coinRequest->load(['reseller:id,name,avatar'])                  │
│                                                                             │
│ 4. SELECT: Eager load processor (if exists)                                 │
│    Query: SELECT id, name FROM users WHERE id = ?                           │
│    Source: $coinRequest->load(['processor:id,name'])                        │
│    Note: Only executed if processed_by is not null                          │
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
│ 1. CoinRequestResource::toArray()                                           │
│    → Transforms CoinRequest model to array                                  │
│    → Includes nested user/reseller/processor objects                        │
│    → Computes derived values (final_amount, was_adjusted, is_repayment_due) │
│                                                                             │
│ 2. ApiResponse::success()                                                   │
│    → Wraps transformed data in standard envelope                            │
│    → Adds timestamp and correlation_id to meta                              │
│                                                                             │
│ 3. Response format:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Coin request retrieved successfully",                     │ │
│ │   "data": { ... transformed coin request ... },                         │ │
│ │   "meta": {                                                             │ │
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

| File                           | Used By Endpoints            | Reusable | Reasoning                                          |
| ------------------------------ | ---------------------------- | -------- | -------------------------------------------------- |
| `CoinRequestController.php`    | coin-requests CRUD           | ⭕       | index/show shared patterns, store/destroy specific |
| `CoinRequestResource.php`      | index, show, store, destroy  | ✅       | Single transformation for all responses            |
| `CoinRequest.php` (Model)      | All Economy domain endpoints | ✅       | Eloquent model, relationships, scopes              |
| `CoinRequestPolicy.php`        | All coin request endpoints   | ✅       | Central authorization logic                        |
| `ApiResponse.php`              | ALL API endpoints            | ✅       | Global response wrapper                            |
| `BaseResource.php`             | ALL API resources            | ✅       | Common resource utilities                          |
| `CoinRequestStatus.php` (Enum) | All coin request endpoints   | ✅       | Status values with labels/colors                   |
| `CoinRequestType.php` (Enum)   | All coin request endpoints   | ✅       | Type values (cash/credit)                          |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error             | Source                    | Condition                       |
| ----------------- | ------------------------- | ------------------------------- |
| `Unauthenticated` | `auth:sanctum` middleware | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source              | Condition                                   |
| ------------------------------ | ------------------- | ------------------------------------------- |
| `This action is unauthorized.` | `CoinRequestPolicy` | User is not owner, reseller, or Super Admin |

### Not Found Errors (404)

| Error                           | Source              | Condition                      |
| ------------------------------- | ------------------- | ------------------------------ |
| `No query results for model...` | Route-model binding | Coin request ID does not exist |
| `No query results for model...` | Route-model binding | Coin request is soft-deleted   |

### System Errors (500)

| Error                     | Source              | Condition            |
| ------------------------- | ------------------- | -------------------- |
| Database connection error | Route-model binding | Database unavailable |

### Edge Cases

| Case                         | Behavior                                                |
| ---------------------------- | ------------------------------------------------------- |
| Non-numeric ID (e.g., "abc") | Laravel returns 404 (model not found)                   |
| Negative ID (e.g., -1)       | Laravel returns 404 (model not found)                   |
| ID = 0                       | Laravel returns 404 (model not found)                   |
| Soft-deleted coin request    | Returns 404 (excluded by SoftDeletes trait)             |
| Related user soft-deleted    | Returns user data (soft-deleted users still accessible) |
| Related processor is null    | Returns `processor: null` in response                   |
| Viewing as owner             | Authorized ✅                                           |
| Viewing as target reseller   | Authorized ✅                                           |
| Viewing as Super Admin       | Authorized ✅                                           |
| Viewing as different user    | Returns 403 Forbidden                                   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER               POLICY                 DATABASE
    │                       │                       │                       │                       │
    │  GET /coin-requests/1 │                       │                       │                       │
    │  Authorization: ...   │                       │                       │                       │
    │──────────────────────▶│                       │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 1. Validate token     │                       │                       │
    │                       │    (auth:sanctum)     │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 2. Route-model        │                       │                       │
    │                       │    binding            │                       │                       │
    │                       │                       │                       │ 3. SELECT coin_request│
    │                       │                       │                       │    WHERE id = ?       │
    │                       │                       │                       │───────────────────────▶
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │                       │                       │
    │                       │──────────────────────▶│                       │                       │
    │                       │   show($coinRequest)  │                       │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 4. authorize('view')  │                       │
    │                       │                       │──────────────────────▶│                       │
    │                       │                       │                       │                       │
    │                       │                       │                       │ Check: user_id match? │
    │                       │                       │                       │ Check: reseller_id?   │
    │                       │                       │                       │ Check: Super Admin?   │
    │                       │                       │                       │                       │
    │                       │                       │◀──────────────────────│                       │
    │                       │                       │   true/false          │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 5. load() relations   │                       │
    │                       │                       │───────────────────────────────────────────────▶
    │                       │                       │   SELECT users (user, reseller, processor)    │
    │                       │                       │◀──────────────────────────────────────────────│
    │                       │                       │                       │                       │
    │                       │                       │ 6. Transform with     │                       │
    │                       │                       │    CoinRequestResource│                       │
    │                       │                       │                       │                       │
    │                       │                       │ 7. ApiResponse::      │                       │
    │                       │                       │    success()          │                       │
    │                       │                       │                       │                       │
    │                       │◀──────────────────────│                       │                       │
    │◀──────────────────────│                       │                       │                       │
    │                       │                       │                       │                       │
    │  200 OK + JSON        │                       │                       │                       │
    │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                         |
| ------------------------ | ------------------------------------------------ |
| Additional authorization | `CoinRequestPolicy::view()`                      |
| New response field       | `CoinRequestResource::toArray()`                 |
| New relationship loading | Controller `show()` method `load()` call         |
| Audit logging            | Controller `show()` method (after authorization) |
| Caching                  | Controller before database access                |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                    | What to Change                        |
| ----- | ------------------------------------------------------- | ------------------------------------- |
| **1** | `database/migrations/` (if new column)                  | Add column migration                  |
| **2** | `app/Models/Economy/CoinRequest.php`                    | Add to `$fillable`, add to `casts()`  |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Add field to `toArray()` return array |
| **4** | This documentation                                      | Update response schema                |

**Example - Adding `priority` field:**

```php
// In CoinRequestResource::toArray()
return [
    // ... existing fields ...
    'priority' => $coinRequest->priority,  // Add new field
];
```

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                    | What to Change                       |
| ----- | ------------------------------------------------------- | ------------------------------------ |
| **1** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Remove from `toArray()` return array |
| **2** | This documentation                                      | Update response schema               |
| **3** | Frontend consumers                                      | Update to not expect field           |

#### 🔧 MODIFYING AUTHORIZATION RULES

| Step  | File                                         | What to Change                   |
| ----- | -------------------------------------------- | -------------------------------- |
| **1** | `app/Policies/Economy/CoinRequestPolicy.php` | Modify `view()` method logic     |
| **2** | Tests                                        | Update policy tests              |
| **3** | This documentation                           | Update authorization description |

**Example - Adding Agency Admin access:**

```php
// In CoinRequestPolicy::view()
return $user->id === $coinRequest->user_id
    || $user->id === $coinRequest->reseller_id
    || $user->hasRole('Super Admin')
    || $user->hasRole('Agency Admin');  // Add new role
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

### 📋 Authorization Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHORIZATION FLOW CHAIN                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Controller ($this->authorize('view', $coinRequest))                        │
│       │                                                                     │
│       ▼                                                                     │
│  Gate (resolves policy class)                                               │
│       │                                                                     │
│       ▼                                                                     │
│  CoinRequestPolicy::view()                                                  │
│       │                                                                     │
│       ├── Check: User is owner?                                             │
│       ├── Check: User is target reseller?                                   │
│       └── Check: User has Super Admin role?                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                 |
| --------------------------------- | -------------------------------------- |
| `CoinRequestResource` field names | Breaking change for API consumers      |
| `CoinRequestPolicy::view()` logic | May expose data to unauthorized users  |
| `ApiResponse::success()` format   | All endpoints depend on this structure |
| `auth:sanctum` middleware         | Security critical                      |
| Route-model binding parameter     | Would break URL structure              |
| Status enum values                | Used for business logic across domain  |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                          |
| --------------------------------------- | --------------------------------------------------- |
| Forgetting to load relationships        | Always call `load()` before resource transformation |
| Returning raw model instead of resource | Always use `CoinRequestResource` transformation     |
| Modifying policy without testing        | Write comprehensive authorization tests             |
| Adding field without type casting       | Define all new fields in model `casts()`            |
| Exposing sensitive fields               | Review what data is included in resource            |
| Breaking 404 handling                   | Don't catch ModelNotFoundException manually         |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                             ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── CoinRequestController.php                          ← Controller
app/Policies/Economy/
  └── CoinRequestPolicy.php                              ← Authorization
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
| **Endpoint**        | `GET /api/v1/coin-requests/{coinRequest}` |
| **Domain**          | Economy                                   |
| **Author**          | System Documentation                      |
| **Created**         | 2026-02-02                                |
| **Laravel Version** | 12.x                                      |
| **PHP Version**     | 8.4                                       |
