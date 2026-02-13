# GET /api/v1/reseller/coin-requests

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Lists all coin requests received by the authenticated reseller, allowing them to view pending, approved, rejected, and expired requests from users.

### Responsibilities

- Authenticate and verify the user is a reseller
- Retrieve paginated coin requests for the reseller
- Transform coin request data into standardized API response format

### What It Owns

| Owned                         | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| Reseller coin request listing | Fetches coin requests where the user is the target reseller |

### External Dependencies

| Dependency | Type           | Purpose                                       |
| ---------- | -------------- | --------------------------------------------- |
| Database   | Infrastructure | Stores coin requests in `coin_requests` table |
| Sanctum    | Package        | Authentication token validation               |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/reseller/coin-requests
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key             | Config             |
| ------- | --------------- | ------------------ |
| `api`   | `user_id` or IP | 60 requests/minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type      | Default | Description                |
| ---------- | --------- | ------- | -------------------------- |
| `per_page` | `integer` | `15`    | Number of items per page   |
| `page`     | `integer` | `1`     | Page number for pagination |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin requests retrieved successfully",
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
        "name": "Reseller Name",
        "avatar": "https://example.com/reseller.jpg"
      },
      "amount": "1000.00",
      "approved_amount": "1000.00|null",
      "final_amount": "1000.00",
      "was_adjusted": false,
      "type": {
        "value": "cash|credit",
        "label": "Cash|Credit"
      },
      "status": {
        "value": "pending|approved|rejected|cancelled|expired",
        "label": "Pending|Approved|Rejected|Cancelled|Expired",
        "color": "warning|success|danger|gray",
        "is_final": false
      },
      "message": "Payment proof attached",
      "admin_note": "string|null",
      "proofs": ["url1", "url2"],
      "credit_days": 30,
      "is_repaid": false,
      "repaid_at": "2026-02-01T00:00:00.000000Z|null",
      "is_repayment_due": false,
      "processor": {
        "id": 789,
        "name": "Admin Name"
      },
      "processed_at": "2026-02-01T00:00:00.000000Z|null",
      "expires_at": "2026-02-03T00:00:00.000000Z|null",
      "created_at": "2026-02-01T00:00:00.000000Z",
      "updated_at": "2026-02-01T00:00:00.000000Z"
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 15,
      "total": 100,
      "last_page": 7,
      "from": 1,
      "to": 15,
      "path": "/api/v1/reseller/coin-requests",
      "first_page_url": "/api/v1/reseller/coin-requests?page=1",
      "last_page_url": "/api/v1/reseller/coin-requests?page=7",
      "next_page_url": "/api/v1/reseller/coin-requests?page=2",
      "prev_page_url": null
    },
    "timestamp": "2026-02-02T00:00:00.000000Z",
    "correlation_id": "uuid"
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
    "timestamp": "2026-02-02T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                       |
| ----- | ----------------------------------------------- |
| `200` | Coin requests retrieved successfully            |
| `401` | Missing or invalid authentication token         |
| `403` | User does not have Reseller or Super Admin role |
| `500` | Internal server error                           |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/reseller/coin-requests                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:31                                       │
│ Route: Route::get('/', [ResellerCoinRequestController::class, 'index'])     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets authenticated user        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│                                                                             │
│ No FormRequest used - uses standard Illuminate\Http\Request                 │
│ Query parameters parsed directly from request: ?per_page=15&page=1          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│ Method: index(Request $request)                                             │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ /** @var \App\Models\User\User $user */                                 │ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate user has Reseller or Super Admin role                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $user->hasAnyRole(['Reseller', 'Super Admin'])) {                 │ │
│ │     return ApiResponse::forbidden(                                      │ │
│ │         'You must be a reseller to access this resource'                │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Fetch coin requests via repository                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequests = $this->repository->getByReseller(                       │ │
│ │     $user->id,                                                          │ │
│ │     $request->input('per_page', 15)                                     │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return paginated response                                           │
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
│                                                                             │
│ COMPONENT: CoinRequestRepository (Repository)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Repositories/CoinRequest/CoinRequestRepository.php            │ │
│ │ Interface: app/Contracts/Repositories/CoinRequestRepositoryInterface.php│ │
│ │ Responsibility: Data access abstraction for CoinRequest model           │ │
│ │ Reusable: YES (Used by multiple endpoints)                              │ │
│ │ Why It Exists: Decouples data access from controllers                   │ │
│ │                                                                         │ │
│ │ Key Method: getByReseller(int $resellerId, int $perPage = 15)           │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ return CoinRequest::with([                                          │ │ │
│ │ │         'user:id,name,avatar',                                      │ │ │
│ │ │         'reseller:id,name,avatar',                                  │ │ │
│ │ │         'processor:id,name'                                         │ │ │
│ │ │     ])                                                              │ │ │
│ │ │     ->where('reseller_id', $resellerId)                             │ │ │
│ │ │     ->latest()                                                      │ │ │
│ │ │     ->paginate($perPage);                                           │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
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
│ │ Reusable: YES (Core domain model)                                       │ │
│ │ Why It Exists: Represents coin request entity with relationships        │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user() → BelongsTo User (the requester)                             │ │
│ │   • reseller() → BelongsTo User (the reseller)                          │ │
│ │   • processor() → BelongsTo User (who approved/rejected)                │ │
│ │                                                                         │ │
│ │ Key Methods Used by Resource:                                           │ │
│ │   • getFinalAmount() → Returns approved_amount or original amount       │ │
│ │   • wasAmountAdjusted() → Checks if amount was modified on approval     │ │
│ │   • isRepaymentDue() → Checks if credit payment deadline passed         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestStatus (Enum)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Economy/CoinRequestStatus.php                           │ │
│ │ Responsibility: Defines request lifecycle states                        │ │
│ │ Reusable: YES (Domain-wide enum)                                        │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED                 │ │
│ │ Methods: label(), isFinal(), color()                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestType (Enum)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Economy/CoinRequestType.php                             │ │
│ │ Responsibility: Defines payment type for approval                       │ │
│ │ Reusable: YES (Domain-wide enum)                                        │ │
│ │                                                                         │ │
│ │ Values: CASH (paid upfront), CREDIT (pay later)                         │ │
│ │ Methods: label(), description()                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (Used by all API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • paginated() → Formats paginated response with metadata              │ │
│ │   • forbidden() → Returns 403 error response                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Fetch coin requests with eager-loaded relationships              │
│    Query:                                                                   │
│    SELECT * FROM coin_requests                                              │
│    WHERE reseller_id = ?                                                    │
│    ORDER BY created_at DESC                                                 │
│    LIMIT ? OFFSET ?                                                         │
│    Source: CoinRequestRepository::getByReseller()                           │
│                                                                             │
│ 2. SELECT: Count total records for pagination                               │
│    Query: SELECT COUNT(*) FROM coin_requests WHERE reseller_id = ?          │
│    Source: Paginator internal                                               │
│                                                                             │
│ 3. SELECT: Eager load user relationship                                     │
│    Query: SELECT id, name, avatar FROM users WHERE id IN (...)              │
│    Source: with('user:id,name,avatar')                                      │
│                                                                             │
│ 4. SELECT: Eager load reseller relationship                                 │
│    Query: SELECT id, name, avatar FROM users WHERE id IN (...)              │
│    Source: with('reseller:id,name,avatar')                                  │
│                                                                             │
│ 5. SELECT: Eager load processor relationship                                │
│    Query: SELECT id, name FROM users WHERE id IN (...)                      │
│    Source: with('processor:id,name')                                        │
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
│ │ Responsibility: Transform CoinRequest model to API response format      │ │
│ │ Reusable: YES (Used by all coin request endpoints)                      │ │
│ │                                                                         │ │
│ │ Transforms:                                                             │ │
│ │   • Basic fields: id, amount, approved_amount, message, admin_note      │ │
│ │   • Computed fields: final_amount, was_adjusted, is_repayment_due       │ │
│ │   • Nested objects: user, reseller, processor, type, status             │ │
│ │   • Timestamps: processed_at, expires_at, created_at, updated_at        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Final Response Assembly via ApiResponse::paginated():                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Coin requests retrieved successfully",                    │ │
│ │   "data": [...transformed resources...],                                │ │
│ │   "meta": {                                                            │ │
│ │     "pagination": {...},                                                │ │
│ │     "timestamp": "...",                                                 │ │
│ │     "correlation_id": "..."                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                                 | Used By Endpoints                    | Reusable | Reasoning                                                 |
| ------------------------------------ | ------------------------------------ | -------- | --------------------------------------------------------- |
| `ResellerCoinRequestController.php`  | Reseller coin request endpoints only | ⭕       | Controller is endpoint-specific, methods reuse repository |
| `CoinRequestRepositoryInterface.php` | All coin request endpoints           | ✅       | Contract for data access abstraction                      |
| `CoinRequestRepository.php`          | All coin request endpoints           | ✅       | Implementation can be swapped via DI                      |
| `CoinRequestResource.php`            | All coin request endpoints           | ✅       | Consistent response format across endpoints               |
| `CoinRequest.php` (Model)            | Entire Economy domain                | ✅       | Core domain entity                                        |
| `CoinRequestStatus.php`              | Entire Economy domain                | ✅       | Domain-wide status enum                                   |
| `CoinRequestType.php`                | Entire Economy domain                | ✅       | Domain-wide type enum                                     |
| `ApiResponse.php`                    | All API endpoints                    | ✅       | Global response utility                                   |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                                            | Source                                 | Condition                                   |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------------- |
| "You must be a reseller to access this resource" | `ResellerCoinRequestController::index` | User lacks `Reseller` or `Super Admin` role |

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### System Errors (500)

| Error                   | Source         | Condition                         |
| ----------------------- | -------------- | --------------------------------- |
| "Internal server error" | Database layer | Database connection failure       |
| "Internal server error" | Repository     | Unexpected exception during query |

### Edge Cases

| Case                              | Behavior                                             |
| --------------------------------- | ---------------------------------------------------- |
| No coin requests exist            | Returns empty array with pagination showing total: 0 |
| User deleted (soft delete)        | Related user data may show null avatar               |
| `per_page` negative or zero       | Laravel defaults to 15, no validation error          |
| `per_page` extremely large        | Query runs, may cause performance issues             |
| Super Admin without Reseller role | Allowed access (Super Admin bypasses role check)     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                 MIDDLEWARE              CONTROLLER              REPOSITORY                DATABASE
   │                        │                       │                       │                         │
   │  GET /reseller/        │                       │                       │                         │
   │  coin-requests         │                       │                       │                         │
   │───────────────────────▶│                       │                       │                         │
   │                        │                       │                       │                         │
   │                        │ 1. auth:sanctum       │                       │                         │
   │                        │    (validate token)   │                       │                         │
   │                        │──────────────────────▶│                       │                         │
   │                        │                       │                       │                         │
   │                        │                       │ 2. Check user role    │                         │
   │                        │                       │    hasAnyRole()       │                         │
   │                        │                       │                       │                         │
   │                        │                       │ 3. getByReseller()    │                         │
   │                        │                       │──────────────────────▶│                         │
   │                        │                       │                       │                         │
   │                        │                       │                       │ 4. SELECT coin_requests │
   │                        │                       │                       │    WHERE reseller_id=?  │
   │                        │                       │                       │────────────────────────▶│
   │                        │                       │                       │◀────────────────────────│
   │                        │                       │                       │                         │
   │                        │                       │                       │ 5. SELECT users         │
   │                        │                       │                       │    (eager load)         │
   │                        │                       │                       │────────────────────────▶│
   │                        │                       │                       │◀────────────────────────│
   │                        │                       │                       │                         │
   │                        │                       │◀──────────────────────│                         │
   │                        │                       │                       │                         │
   │                        │                       │ 6. Transform via      │                         │
   │                        │                       │    CoinRequestResource│                         │
   │                        │                       │                       │                         │
   │                        │                       │ 7. ApiResponse::      │                         │
   │                        │                       │    paginated()        │                         │
   │                        │                       │                       │                         │
   │                        │◀──────────────────────│                       │                         │
   │◀───────────────────────│                       │                       │                         │
   │                        │                       │                       │                         │
   │  200 OK + JSON         │                       │                       │                         │
   │                        │                       │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition             | Location                                                    |
| -------------------- | ----------------------------------------------------------- |
| New query filter     | `CoinRequestRepository::getByReseller()` - add where clause |
| New response field   | `CoinRequestResource::toArray()` - add to return array      |
| New validation rule  | Create dedicated FormRequest class                          |
| Status filtering     | Add `?status=pending` query param in controller             |
| Date range filtering | Add `?from=&to=` query params, update repository method     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                    | What to Change                             |
| ----- | ------------------------------------------------------- | ------------------------------------------ |
| **1** | **Database Migration**                                  | Add column to `coin_requests` table        |
| **2** | `app/Models/Economy/CoinRequest.php`                    | Add to `$fillable` and `casts()` if needed |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Add field to `toArray()` return            |

#### ➕ ADDING A NEW QUERY FILTER

| Step  | File                                     | What to Change                   |
| ----- | ---------------------------------------- | -------------------------------- |
| **1** | `ResellerCoinRequestController::index()` | Extract query param from request |
| **2** | `CoinRequestRepositoryInterface.php`     | Update method signature          |
| **3** | `CoinRequestRepository::getByReseller()` | Add conditional where clause     |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                    | What to Change                  |
| ----- | ------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Remove from `toArray()` return  |
| **2** | **Database Migration** (optional)                       | Drop column if no longer needed |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FIELD FLOW CHAIN                                  │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Database Column (coin_requests)                                            │
│         │                                                                   │
│         ▼                                                                   │
│  Model Property (CoinRequest::$fillable / casts())                          │
│         │                                                                   │
│         ├──────────────────────┐                                            │
│         │                      │                                            │
│         ▼                      ▼                                            │
│  Eager Load (Repository)   Model Methods                                    │
│  with('user:id,name')      getFinalAmount()                                 │
│         │                      │                                            │
│         └──────────┬───────────┘                                            │
│                    │                                                        │
│                    ▼                                                        │
│         CoinRequestResource::toArray()                                      │
│                    │                                                        │
│                    ▼                                                        │
│         ApiResponse::paginated() → JSON Response                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                 |
| --------------------------------- | -------------------------------------- |
| `ApiResponse::paginated()` format | Breaking change for all API consumers  |
| `CoinRequestResource` field names | Breaking change for mobile/web clients |
| Repository interface signature    | Requires updating all implementations  |
| Role check logic                  | Security-critical authorization        |
| Eager load relationships          | May cause N+1 queries if removed       |

### 🚨 Common Pitfalls

| Pitfall                        | Prevention                                           |
| ------------------------------ | ---------------------------------------------------- |
| Removing eager load causes N+1 | Always profile queries when modifying repository     |
| Adding field without migration | Test on fresh database before deploying              |
| Changing status enum values    | Update all places that compare status strings        |
| Large per_page values          | Consider adding max limit validation                 |
| Not handling null processor    | Check for null before accessing processor properties |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                                ← Route definition (line 31)
app/Http/Controllers/Api/V1/Economy/
  └── ResellerCoinRequestController.php                     ← Controller (index method)
app/Contracts/Repositories/
  └── CoinRequestRepositoryInterface.php                    ← Repository interface
app/Repositories/CoinRequest/
  └── CoinRequestRepository.php                             ← Repository implementation
app/Models/Economy/
  └── CoinRequest.php                                       ← Eloquent model
app/Enums/Economy/
  ├── CoinRequestStatus.php                                 ← Status enum
  └── CoinRequestType.php                                   ← Type enum
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                               ← API resource transformer
app/Http/Utils/
  └── ApiResponse.php                                       ← Response utility
```

---

## Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `GET /api/v1/reseller/coin-requests` |
| **Domain**          | Economy                              |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-02                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4                                  |
