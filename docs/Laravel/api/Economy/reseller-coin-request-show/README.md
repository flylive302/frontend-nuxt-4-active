# GET /api/v1/reseller/coin-requests/{id}

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

This endpoint retrieves a specific coin request's details for resellers. It returns comprehensive information including the requesting user, reseller, amounts, status, and approval metadata.

### Responsibilities

- Retrieve a specific coin request by ID
- Authorize access via policy (owner, reseller, or Super Admin)
- Eager load related user, reseller, and processor data
- Transform response through resource class

### What It Owns

| Owned            | Description                                         |
| ---------------- | --------------------------------------------------- |
| Single coin read | Retrieves one `coin_requests` record with relations |

### External Dependencies

| Dependency | Type         | Purpose                         |
| ---------- | ------------ | ------------------------------- |
| MySQL      | Database     | `coin_requests`, `users` tables |
| Sanctum    | Auth Package | Bearer token authentication     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/reseller/coin-requests/{id}
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter        | Key     | Config               |
| -------------- | ------- | -------------------- |
| Default (60/m) | User ID | `config/sanctum.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints | Example | Description              |
| --------- | --------- | ----------- | ------- | ------------------------ |
| `id`      | `integer` | Required    | `123`   | Coin request primary key |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin request retrieved successfully",
  "data": {
    "id": 123,
    "user": {
      "id": 456,
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "reseller": {
      "id": 789,
      "name": "Reseller Name",
      "avatar": "https://example.com/reseller.jpg"
    },
    "amount": "1000.00",
    "approved_amount": "950.00", // null if not approved
    "final_amount": "950.00",
    "was_adjusted": true,
    "type": {
      "value": "cash", // cash | credit
      "label": "Cash"
    },
    "status": {
      "value": "approved", // pending | approved | rejected | cancelled | expired
      "label": "Approved",
      "color": "success",
      "is_final": true
    },
    "message": "Payment proof attached", // Request message from user
    "admin_note": "Approved by reseller", // Note from processor
    "proofs": [
      // Array of proof objects
      { "url": "...", "type": "image" }
    ],
    "credit_days": null, // Integer if credit type
    "is_repaid": false,
    "repaid_at": null,
    "is_repayment_due": false,
    "processor": {
      // null if not processed
      "id": 789,
      "name": "Reseller Name"
    },
    "processed_at": "2026-02-01T12:00:00.000000Z",
    "expires_at": null,
    "created_at": "2026-02-01T10:00:00.000000Z",
    "updated_at": "2026-02-01T12:00:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-02T19:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [CoinRequest]",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-02-02T19:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-02-02T19:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Unauthenticated Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-02-02T19:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | Coin request retrieved successfully           |
| `401` | Missing or invalid authentication token       |
| `403` | User not authorized to view this coin request |
| `404` | Coin request not found (or soft-deleted)      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                GET /api/v1/reseller/coin-requests/{id}                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:33                                       │
│ Route: Route::get('/{coinRequest}', [ResellerCoinRequestController::class,  │
│        'show'])                                                             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Sanctum authentication guard                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('reseller/coin-requests')->group(function () {            │ │
│ │     // ...                                                              │ │
│ │     Route::get('/{coinRequest}', [ResellerCoinRequestController::class, │ │
│ │                                   'show']);                             │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Economy/CoinRequest.php                                    │
│                                                                             │
│ Laravel's implicit route model binding resolves {coinRequest} to:           │
│   CoinRequest::findOrFail($id)                                              │
│                                                                             │
│ The model uses SoftDeletes trait, so soft-deleted records return 404.       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ class CoinRequest extends Model                                         │ │
│ │ {                                                                       │ │
│ │     use HasFactory, SoftDeletes;                                        │ │
│ │     // ...                                                              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│ Method: show(CoinRequest $coinRequest)                                      │
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('view', $coinRequest);                                 │ │
│ │                                                                         │ │
│ │ // Delegates to CoinRequestPolicy::view()                               │ │
│ │ // Throws AuthorizationException (403) if unauthorized                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Eager Load Relations                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->load([                                                    │ │
│ │     'user:id,name,avatar',                                              │ │
│ │     'reseller:id,name,avatar',                                          │ │
│ │     'processor:id,name'                                                 │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ // Selective loading: only id, name, avatar columns                     │ │
│ │ // Processor may be null (not processed yet)                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Response                                                     │
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
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Economy/CoinRequestPolicy.php                            │
│ Method: view(User $user, CoinRequest $coinRequest)                          │
│                                                                             │
│ Authorization Logic:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function view(User $user, CoinRequest $coinRequest): bool        │ │
│ │ {                                                                       │ │
│ │     // Allow if user is:                                                │ │
│ │     // 1. The request owner (user_id)                                   │ │
│ │     // 2. The target reseller (reseller_id)                             │ │
│ │     // 3. A Super Admin                                                 │ │
│ │     return $user->id === $coinRequest->user_id                          │ │
│ │         || $user->id === $coinRequest->reseller_id                      │ │
│ │         || $user->hasRole('Super Admin');                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CoinRequest (Eloquent Model)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/CoinRequest.php                                │ │
│ │ Responsibility: ORM model for coin_requests table                       │ │
│ │ Reusable: YES (used by all coin request endpoints)                      │ │
│ │ Why It Exists: Central data model for coin request lifecycle            │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user() → BelongsTo User (requester)                                 │ │
│ │   • reseller() → BelongsTo User (target reseller)                       │ │
│ │   • processor() → BelongsTo User (who processed it)                     │ │
│ │                                                                         │ │
│ │ Key Helper Methods:                                                     │ │
│ │   • getFinalAmount() → Returns approved_amount or amount                │ │
│ │   • wasAmountAdjusted() → Checks if amount was modified                 │ │
│ │   • isRepaymentDue() → Checks if credit payment is overdue              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/CoinRequestResource.php             │ │
│ │ Responsibility: Transform CoinRequest model to API response             │ │
│ │ Reusable: YES (used by all coin request endpoints)                      │ │
│ │ Why It Exists: Consistent response structure across all endpoints       │ │
│ │                                                                         │ │
│ │ Key Transformations:                                                    │ │
│ │   • Embeds user/reseller/processor as nested objects                    │ │
│ │   • Converts enums (type, status) to value+label objects                │ │
│ │   • Formats all timestamps to ISO 8601 strings                          │ │
│ │   • Computes derived fields (final_amount, was_adjusted, etc.)          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by ALL API controllers)                             │ │
│ │ Why It Exists: Ensures consistent response structure application-wide   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 response with data                                  │ │
│ │   • error() → Error response with status code                           │ │
│ │   • forbidden() → 403 response                                          │ │
│ │   • notFound() → 404 response                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Abstract Resource)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Base class for all API resources                        │ │
│ │ Reusable: YES (extended by all resources)                               │ │
│ │ Why It Exists: Provides common metadata and helper methods              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • with() → Adds timestamp and correlation_id to responses             │ │
│ │   • formatTimestamp() → Consistent ISO 8601 formatting                  │ │
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
│ 1. [SELECT] Route Model Binding - Find CoinRequest                          │
│    Query: SELECT * FROM coin_requests WHERE id = ? AND deleted_at IS NULL   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. [SELECT] Eager Load User                                                 │
│    Query: SELECT id, name, avatar FROM users WHERE id = ?                   │
│    Source: $coinRequest->load(['user:id,name,avatar'])                      │
│                                                                             │
│ 3. [SELECT] Eager Load Reseller                                             │
│    Query: SELECT id, name, avatar FROM users WHERE id = ?                   │
│    Source: $coinRequest->load(['reseller:id,name,avatar'])                  │
│                                                                             │
│ 4. [SELECT] Eager Load Processor (if exists)                                │
│    Query: SELECT id, name FROM users WHERE id = ?                           │
│    Source: $coinRequest->load(['processor:id,name'])                        │
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
│ 1. CoinRequestResource transforms model to array:                           │
│    - Extracts all required fields from CoinRequest                          │
│    - Builds nested user/reseller/processor objects                          │
│    - Converts enums to value+label structure                                │
│    - Calls helper methods (getFinalAmount, wasAmountAdjusted, etc.)         │
│                                                                             │
│ 2. ApiResponse::success() wraps the resource:                               │
│    - Adds status: "success"                                                 │
│    - Adds message: "Coin request retrieved successfully"                    │
│    - Adds meta with timestamp and correlation_id                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         200 + JSON Body                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                | Used By Endpoints                    | Reusable | Reasoning                                     |
| ----------------------------------- | ------------------------------------ | -------- | --------------------------------------------- |
| `CoinRequest.php`                   | All coin request endpoints           | ✅       | Central model for all coin request operations |
| `CoinRequestPolicy.php`             | All coin request endpoints           | ✅       | Single policy for all coin request auth       |
| `CoinRequestResource.php`           | All coin request endpoints           | ✅       | Consistent response format across endpoints   |
| `ResellerCoinRequestController.php` | Reseller coin request endpoints only | ⭕       | Controller methods are reseller-specific      |
| `ApiResponse.php`                   | ALL API endpoints                    | ✅       | Global utility for response formatting        |
| `BaseResource.php`                  | ALL API resources                    | ✅       | Base class for all resource transformations   |
| `CoinRequestStatus.php`             | All coin request endpoints           | ✅       | Enum used for status field                    |
| `CoinRequestType.php`               | All coin request endpoints           | ✅       | Enum used for type field                      |

---

## 5. Error Handling & Edge Cases

### Not Found Errors (404)

| Error               | Source              | Condition                           |
| ------------------- | ------------------- | ----------------------------------- |
| Model not found     | Route Model Binding | ID doesn't exist in `coin_requests` |
| Soft-deleted record | Route Model Binding | Record has `deleted_at` set         |

### Authorization Errors (403)

| Error        | Source              | Condition                                   |
| ------------ | ------------------- | ------------------------------------------- |
| Unauthorized | `CoinRequestPolicy` | User is not owner, reseller, or Super Admin |

### Authentication Errors (401)

| Error           | Source                    | Condition                       |
| --------------- | ------------------------- | ------------------------------- |
| Unauthenticated | `auth:sanctum` middleware | Missing or invalid bearer token |

### System Errors (500)

| Error              | Source              | Condition                         |
| ------------------ | ------------------- | --------------------------------- |
| Database error     | Eloquent            | Connection failure or query error |
| Resource transform | CoinRequestResource | Null access on required relation  |

### Edge Cases

| Case                             | Behavior                                       |
| -------------------------------- | ---------------------------------------------- |
| Processor is null                | `processor` field returns `null` in response   |
| Approved amount is null          | `final_amount` returns original `amount`       |
| Credit type with no credit_days  | `is_repayment_due` returns `false`             |
| Expired pending request          | Still viewable, `status.value` shows "expired" |
| User deleted but relation exists | May cause null access - ensure cascade deletes |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            POLICY                  DATABASE
   │                       │                       │                    │                        │
   │  GET /reseller/       │                       │                    │                        │
   │  coin-requests/{id}   │                       │                    │                        │
   │──────────────────────▶│                       │                    │                        │
   │                       │                       │                    │                        │
   │                       │ 1. auth:sanctum       │                    │                        │
   │                       │   validate token      │                    │                        │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │                       │                    │                        │
   │                       │◀──────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                        │
   │                       │ 2. Route Model Bind   │                    │                        │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │   SELECT * FROM coin_requests WHERE id = ?                         │
   │                       │◀──────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                        │
   │                       │ 3. Invoke show()      │                    │                        │
   │                       │──────────────────────▶│                    │                        │
   │                       │                       │                    │                        │
   │                       │                       │ 4. authorize()     │                        │
   │                       │                       │───────────────────▶│                        │
   │                       │                       │   Policy::view()   │                        │
   │                       │                       │◀──────────────────│                        │
   │                       │                       │                    │                        │
   │                       │                       │ 5. Eager load      │                        │
   │                       │                       │   relations        │                        │
   │                       │                       │───────────────────────────────────────────▶│
   │                       │                       │   SELECT id,name,avatar FROM users          │
   │                       │                       │◀──────────────────────────────────────────│
   │                       │                       │                    │                        │
   │                       │                       │ 6. Transform via   │                        │
   │                       │                       │   CoinRequestResource                       │
   │                       │                       │                    │                        │
   │                       │◀──────────────────────│                    │                        │
   │◀──────────────────────│                       │                    │                        │
   │                       │                       │                    │                        │
   │  200 + JSON Response  │                       │                    │                        │
   │                       │                       │                    │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                         | Location                                         |
| -------------------------------- | ------------------------------------------------ |
| New response field               | `CoinRequestResource::toArray()`                 |
| New authorization rule           | `CoinRequestPolicy::view()`                      |
| Additional eager-loaded relation | `ResellerCoinRequestController::show()` line 64  |
| New computed/derived field       | `CoinRequest` model (add helper method)          |
| New enum value                   | `CoinRequestStatus.php` or `CoinRequestType.php` |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                    | What to Change                         |
| ----- | ------------------------------------------------------- | -------------------------------------- |
| **1** | `database/migrations/xxx_create_coin_requests.php`      | Add column to schema                   |
| **2** | `app/Models/Economy/CoinRequest.php`                    | Add to `$fillable`, add cast if needed |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Add field to `toArray()` return        |

#### ➕ ADDING A NEW EAGER-LOADED RELATION

| Step  | File                                                         | What to Change                   |
| ----- | ------------------------------------------------------------ | -------------------------------- |
| **1** | `app/Models/Economy/CoinRequest.php`                         | Add relationship method          |
| **2** | `app/Http/Controllers/.../ResellerCoinRequestController.php` | Add to `load()` array in line 64 |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`      | Add nested object in `toArray()` |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                    | What to Change                  |
| ----- | ------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Remove from `toArray()` return  |
| **2** | Frontend clients                                        | Update to not expect the field  |
| **3** | Database migration (optional)                           | Drop column if no longer needed |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW: Response Fields                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Database Column        Model Property          Resource Field             │
│   ─────────────────      ──────────────          ──────────────             │
│   coin_requests.id    →  $coinRequest->id     →  data.id                    │
│   coin_requests.amount→  $coinRequest->amount →  data.amount                │
│   users.name          →  $coinRequest->user   →  data.user.name             │
│                          ->name                                             │
│                                                                             │
│   Computed Fields:                                                          │
│   ───────────────                                                           │
│   (none)              →  getFinalAmount()     →  data.final_amount          │
│   (none)              →  wasAmountAdjusted()  →  data.was_adjusted          │
│   (none)              →  isRepaymentDue()     →  data.is_repayment_due      │
│                                                                             │
│   Enum Fields:                                                              │
│   ───────────────                                                           │
│   coin_requests.status→  CoinRequestStatus    →  data.status.value          │
│                          enum casting            data.status.label          │
│                                                  data.status.color          │
│                                                  data.status.is_final       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `ApiResponse` structure      | All clients depend on consistent response format          |
| `CoinRequestPolicy::view()`  | Security-critical authorization logic                     |
| Route model binding behavior | 404 handling relies on implicit binding                   |
| Enum values                  | Database stores these values; changes break existing data |
| Relationship column selects  | Changing may break resource field access                  |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                          |
| ------------------------------------------ | --------------------------------------------------- |
| Adding field to resource but not model     | Always check model casts/fillable first             |
| Forgetting to eager load new relation      | Add to `load()` call before using in resource       |
| Assuming processor is always present       | Use null-safe operators (`?->`) in resource         |
| Changing enum without migration            | Enum values are stored in DB; need data migration   |
| Removing eager load without resource check | Causes N+1 or null access if resource uses relation |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                             ← Route definition (:33)
app/Http/Controllers/Api/V1/Economy/
  └── ResellerCoinRequestController.php                  ← Controller (:60-70)
app/Policies/Economy/
  └── CoinRequestPolicy.php                              ← Authorization (:28-34)
app/Models/Economy/
  └── CoinRequest.php                                    ← Model
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                            ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
app/Enums/Economy/
  ├── CoinRequestStatus.php                              ← Status enum
  └── CoinRequestType.php                                ← Type enum
```

---

## Document Metadata

| Property            | Value                                     |
| ------------------- | ----------------------------------------- |
| **Endpoint**        | `GET /api/v1/reseller/coin-requests/{id}` |
| **Domain**          | Economy                                   |
| **Author**          | System Documentation                      |
| **Created**         | 2026-02-02                                |
| **Laravel Version** | 12.x                                      |
| **PHP Version**     | 8.4                                       |
