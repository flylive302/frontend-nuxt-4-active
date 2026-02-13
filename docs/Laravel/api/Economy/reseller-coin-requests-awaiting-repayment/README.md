# GET /api/v1/reseller/coin-requests/awaiting-repayment

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Lists credit coin requests awaiting repayment from users. This endpoint allows resellers to track outstanding credits they have extended to users.

### Responsibilities

- Verify the authenticated user has the Reseller or Super Admin role
- Query for approved credit requests that are not yet repaid
- Return a collection of coin requests with user/reseller details

### What It Owns

| Owned                        | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| Credit Repayment Tracking    | Returns unpaid credit requests for the reseller            |
| Reseller Authorization Check | Validates user has appropriate role to access the resource |

### External Dependencies

| Dependency | Type                   | Purpose                     |
| ---------- | ---------------------- | --------------------------- |
| Database   | PostgreSQL (MySQL)     | Stores coin request records |
| Sanctum    | Auth Package           | Token-based authentication  |
| Spatie     | Role/Permission Plugin | Role verification           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/reseller/coin-requests/awaiting-repayment
```

### Authentication

✅ **Required** - Bearer token (Sanctum)

### Rate Limiting

| Limiter | Key       | Config            |
| ------- | --------- | ----------------- |
| `api`   | `user:id` | `config/rate.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

No request body required (GET request).

### Query Parameters

None.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Awaiting repayment requests retrieved successfully",
  "data": [
    {
      "id": 123,
      "user": {
        "id": 456,
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "reseller": {
        "id": 789,
        "name": "Jane Reseller",
        "avatar": "https://example.com/reseller.jpg"
      },
      "amount": "1000.00",
      "approved_amount": "1000.00",
      "final_amount": "1000.00",
      "was_adjusted": false,
      "type": {
        "value": "credit",
        "label": "Credit"
      },
      "status": {
        "value": "approved",
        "label": "Approved",
        "color": "success",
        "is_final": true
      },
      "message": "Need coins for event",
      "admin_note": null,
      "proofs": [],
      "credit_days": 7,
      "is_repaid": false,
      "repaid_at": null,
      "is_repayment_due": true,
      "processor": {
        "id": 789,
        "name": "Jane Reseller"
      },
      "processed_at": "2026-01-25T10:00:00.000000Z",
      "expires_at": null,
      "created_at": "2026-01-24T10:00:00.000000Z",
      "updated_at": "2026-01-25T10:00:00.000000Z"
    }
  ],
  "meta": {
    "timestamp": "2026-02-02T14:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You must be a reseller to access this resource",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T14:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Unauthenticated Error (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                                       |
| ----- | ----------------------------------------------- |
| `200` | Successfully retrieved awaiting repayment       |
| `401` | Missing or invalid authentication token         |
| `403` | User does not have Reseller or Super Admin role |
| `500` | Unexpected server error                         |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              GET /api/v1/reseller/coin-requests/awaiting-repayment          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:32                                       │
│ Route: Route::get('/awaiting-repayment',                                    │
│                   [ResellerCoinRequestController::class, 'awaitingRepayment'])│
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads User model                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest class used - Request validated in controller                 │
│                                                                             │
│ The controller method handles role verification directly.                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│ Method: awaitingRepayment(Request $request)                                 │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ /** @var \App\Models\User\User $user */                                 │ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Verify user has Reseller or Super Admin role                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $user->hasAnyRole(['Reseller', 'Super Admin'])) {                 │ │
│ │     return ApiResponse::forbidden(                                      │ │
│ │         'You must be a reseller to access this resource'                │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Fetch awaiting repayment requests via repository                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequests = $this->repository->getAwaitingRepayment($user->id);     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success response with collection                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     CoinRequestResource::collection($coinRequests),                     │ │
│ │     'Awaiting repayment requests retrieved successfully'                │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 REPOSITORY LAYER FLOW                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CoinRequestRepository (Repository)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Repositories/CoinRequest/CoinRequestRepository.php:190-196    │ │
│ │                                                                         │ │
│ │ public function getAwaitingRepayment(int $resellerId): Collection       │ │
│ │ {                                                                       │ │
│ │     return CoinRequest::awaitingRepayment()                             │ │
│ │         ->where('reseller_id', $resellerId)                             │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Uses Model Scope: scopeAwaitingRepayment                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/CoinRequest.php:226-231                        │ │
│ │                                                                         │ │
│ │ public function scopeAwaitingRepayment(Builder $query): Builder         │ │
│ │ {                                                                       │ │
│ │     return $query->where('status', CoinRequestStatus::APPROVED)         │ │
│ │         ->where('type', CoinRequestType::CREDIT)                        │ │
│ │         ->where('is_repaid', false);                                    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│ │ Reusable: YES (shared across all coin request endpoints)                │ │
│ │ Why It Exists: Defines table structure, casts, relationships, scopes    │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user()      → BelongsTo User (requester)                            │ │
│ │   • reseller()  → BelongsTo User (reseller)                             │ │
│ │   • processor() → BelongsTo User (who approved/rejected)                │ │
│ │                                                                         │ │
│ │ Key Helper Methods:                                                     │ │
│ │   • getFinalAmount()     → Returns approved_amount or amount            │ │
│ │   • wasAmountAdjusted()  → Checks if amount was modified                │ │
│ │   • isRepaymentDue()     → Checks if credit is past due date            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestStatus (Enum)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Economy/CoinRequestStatus.php                           │ │
│ │ Responsibility: Defines request lifecycle states                        │ │
│ │ Reusable: YES (used throughout coin request domain)                     │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable name                                       │ │
│ │   • color() → UI color (warning, success, error, gray)                  │ │
│ │   • isFinal() → Whether state is terminal                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestType (Enum)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Economy/CoinRequestType.php                             │ │
│ │ Responsibility: Defines payment type for request                        │ │
│ │ Reusable: YES (used throughout coin request domain)                     │ │
│ │                                                                         │ │
│ │ Values: CASH (payment received), CREDIT (coins lent)                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable name                                       │ │
│ │   • requiresCreditDays() → True for CREDIT type                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success()    → 200 OK with data                                     │ │
│ │   • forbidden()  → 403 error response                                   │ │
│ │   • error()      → Generic error response                               │ │
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
│ 1. SELECT: Fetch awaiting repayment coin requests                          │
│    Query: SELECT * FROM coin_requests                                       │
│           WHERE status = 'approved'                                         │
│             AND type = 'credit'                                             │
│             AND is_repaid = false                                           │
│             AND reseller_id = ?                                             │
│    Source: CoinRequestRepository::getAwaitingRepayment()                    │
│                                                                             │
│ 2. LAZY LOAD: User, Reseller, Processor relationships                      │
│    Query: SELECT id, name, avatar FROM users WHERE id IN (...)             │
│    Source: CoinRequestResource (accessing related models)                   │
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
│ COMPONENT: CoinRequestResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/CoinRequestResource.php             │ │
│ │ Responsibility: Transform CoinRequest model to API response             │ │
│ │ Reusable: YES (used by all coin request endpoints)                      │ │
│ │                                                                         │ │
│ │ Transforms each CoinRequest to:                                         │ │
│ │   • id, amount, approved_amount, final_amount, was_adjusted             │ │
│ │   • user: { id, name, avatar }                                          │ │
│ │   • reseller: { id, name, avatar }                                      │ │
│ │   • type: { value, label }                                              │ │
│ │   • status: { value, label, color, is_final }                           │ │
│ │   • message, admin_note, proofs                                         │ │
│ │   • credit_days, is_repaid, repaid_at, is_repayment_due                 │ │
│ │   • processor: { id, name } | null                                      │ │
│ │   • processed_at, expires_at, created_at, updated_at                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Final response wrapped by ApiResponse::success()                            │
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

| File                                 | Used By Endpoints                   | Reusable | Reasoning                                 |
| ------------------------------------ | ----------------------------------- | -------- | ----------------------------------------- |
| `ResellerCoinRequestController.php`  | All reseller coin request endpoints | ✅       | Shared controller for reseller operations |
| `CoinRequestRepositoryInterface.php` | All coin request endpoints          | ✅       | Contract for repository implementations   |
| `CoinRequestRepository.php`          | All coin request endpoints          | ✅       | Concrete implementation of repository     |
| `CoinRequest.php` (Model)            | Entire Economy domain               | ✅       | Core model for coin requests              |
| `CoinRequestResource.php`            | All coin request endpoints          | ✅       | Shared response transformer               |
| `CoinRequestStatus.php` (Enum)       | Entire Economy domain               | ✅       | Standard status values                    |
| `CoinRequestType.php` (Enum)         | Entire Economy domain               | ✅       | Payment type values                       |
| `ApiResponse.php`                    | All API endpoints                   | ✅       | Standardized response formatting          |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

None - this endpoint has no request body or query parameters to validate.

### Business Logic Errors (403)

| Error                                 | Source                          | Condition                            |
| ------------------------------------- | ------------------------------- | ------------------------------------ |
| "You must be a reseller to access..." | `ResellerCoinRequestController` | User lacks Reseller/Super Admin role |

### System Errors (500)

| Error                      | Source           | Condition               |
| -------------------------- | ---------------- | ----------------------- |
| Database connection failed | Repository layer | Database unavailable    |
| Unexpected exception       | Any component    | Unhandled runtime error |

### Edge Cases

| Case                            | Behavior                           |
| ------------------------------- | ---------------------------------- |
| No awaiting repayment requests  | Returns empty array `data: []`     |
| User has Reseller + Super Admin | Access granted (hasAnyRole)        |
| All credits marked as repaid    | Returns empty array                |
| Requests with null processor    | Processor field is `null`          |
| N+1 query on relationships      | Lazy loads user/reseller/processor |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            REPOSITORY               DATABASE
   │                       │                       │                       │                       │
   │  GET /awaiting-repayment                      │                       │                       │
   │───────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum      │                       │                       │
   │                       │   (validate token)    │                       │                       │
   │                       │───────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. Get $user from     │                       │
   │                       │                       │    request            │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. Check hasAnyRole   │                       │
   │                       │                       │    ['Reseller',       │                       │
   │                       │                       │     'Super Admin']    │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 4. Call repository    │                       │
   │                       │                       │───────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. SELECT coin_requests│
   │                       │                       │                       │    WHERE status='approved'
   │                       │                       │                       │      AND type='credit' │
   │                       │                       │                       │      AND is_repaid=false
   │                       │                       │                       │      AND reseller_id=? │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. Transform via      │                       │
   │                       │                       │    CoinRequestResource│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 7. SELECT users       │                       │
   │                       │                       │    (lazy load)        │                       │
   │                       │                       │────────────────────────────────────────────────▶│
   │                       │                       │◀────────────────────────────────────────────────│
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

| Addition                   | Location                                              |
| -------------------------- | ----------------------------------------------------- |
| Additional filters         | Controller method + Repository method                 |
| Pagination support         | Change `get()` to `paginate()` in repository          |
| Eager loading optimization | Add `with()` in repository's `getAwaitingRepayment()` |
| New response field         | `CoinRequestResource::toArray()`                      |
| Custom sorting             | Repository query modification                         |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                    | What to Change                   |
| ----- | ------------------------------------------------------- | -------------------------------- |
| **1** | Database Migration                                      | Add column to `coin_requests`    |
| **2** | `app/Models/Economy/CoinRequest.php`                    | Add to `$fillable` and `casts()` |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Add field to `toArray()` return  |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                    | What to Change                |
| ----- | ------------------------------------------------------- | ----------------------------- |
| **1** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Remove from `toArray()`       |
| **2** | Database Migration (optional)                           | Drop column if no longer used |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW: is_repaid                               │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Database Column          Model Attribute        Scope Filter               │
│  ┌─────────────┐         ┌─────────────┐       ┌───────────────────────┐   │
│  │ is_repaid   │────────▶│ is_repaid   │──────▶│ scopeAwaitingRepayment│   │
│  │ (boolean)   │         │ (cast bool) │       │ where is_repaid=false │   │
│  └─────────────┘         └─────────────┘       └───────────────────────┘   │
│        │                        │                        │                  │
│        ▼                        ▼                        ▼                  │
│  ┌─────────────────┐     ┌─────────────────┐    ┌─────────────────────┐    │
│  │ Resource output │     │ isRepaymentDue()│    │ Query result        │    │
│  │ 'is_repaid'     │     │ helper method   │    │ Collection          │    │
│  └─────────────────┘     └─────────────────┘    └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                  |
| -------------------------------- | --------------------------------------- |
| `scopeAwaitingRepayment()` logic | Core business logic for credit tracking |
| Role check in controller         | Security-critical authorization         |
| `CoinRequestResource` structure  | Breaking change for API consumers       |
| `CoinRequestStatus` enum values  | Used throughout the system              |

### 🚨 Common Pitfalls

| Pitfall                     | Prevention                                                  |
| --------------------------- | ----------------------------------------------------------- |
| N+1 query on relationships  | Add `with(['user', 'reseller', 'processor'])` in repository |
| Removing role check         | Never remove authorization logic                            |
| Changing enum values        | Use migrations for status updates                           |
| Not handling null processor | Resource already handles null case                          |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                              ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── ResellerCoinRequestController.php                   ← Controller
app/Contracts/Repositories/
  └── CoinRequestRepositoryInterface.php                  ← Repository contract
app/Repositories/CoinRequest/
  └── CoinRequestRepository.php                           ← Repository implementation
app/Models/Economy/
  └── CoinRequest.php                                     ← Eloquent model
app/Enums/Economy/
  ├── CoinRequestStatus.php                               ← Status enum
  └── CoinRequestType.php                                 ← Type enum
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                             ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                     ← Response utility
```

---

## Document Metadata

| Property            | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Endpoint**        | `GET /api/v1/reseller/coin-requests/awaiting-repayment` |
| **Domain**          | Economy                                                 |
| **Author**          | System Documentation                                    |
| **Created**         | 2026-02-02                                              |
| **Laravel Version** | 12.x                                                    |
| **PHP Version**     | 8.4                                                     |
