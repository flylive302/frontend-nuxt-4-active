# GET /api/v1/transactions

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Retrieves paginated transaction history for the authenticated user with date grouping, filtering, and perspective-aware display.

### Responsibilities

- Fetch transactions where user is initiator OR beneficiary
- Group transactions by date with formatted headers
- Apply type/date filtering and sorting
- Provide perspective-aware transaction descriptions and amounts
- Return paginated results with metadata

### What It Owns

| Owned                  | Description                                         |
| ---------------------- | --------------------------------------------------- |
| Transaction retrieval  | Queries `transactions` table with user filters      |
| Date grouping          | Groups transactions by date with formatted labels   |
| Perspective formatting | Adjusts display based on user's role in transaction |

### External Dependencies

| Dependency | Type           | Purpose                |
| ---------- | -------------- | ---------------------- |
| MySQL      | Database       | Stores transactions    |
| Sanctum    | Authentication | Validates Bearer token |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/transactions
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key       | Config          |
| ------- | --------- | --------------- |
| `api`   | `user:id` | 60 requests/min |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

```
?type=all|coins|diamonds|gifts|{exact_type}  // Filter by type category or exact type
?page=1                                       // Page number (min: 1)
?per_page=20                                  // Results per page (min: 1, max: 50)
?date_from=2026-01-01                         // Filter from date (inclusive)
?date_to=2026-01-31                           // Filter to date (inclusive)
?sort=newest|oldest                           // Sort order (default: newest)
```

#### Field Details

| Field       | Type      | Constraints                      | Example        |
| ----------- | --------- | -------------------------------- | -------------- |
| `type`      | `string`  | Optional, category or exact type | `"coins"`      |
| `page`      | `integer` | Optional, min: 1                 | `1`            |
| `per_page`  | `integer` | Optional, min: 1, max: 50        | `20`           |
| `date_from` | `date`    | Optional, YYYY-MM-DD format      | `"2026-01-01"` |
| `date_to`   | `date`    | Optional, must be >= date_from   | `"2026-01-31"` |
| `sort`      | `string`  | Optional, `newest` or `oldest`   | `"newest"`     |

**Type Categories:**
| Category | Maps to Transaction Types |
| ---------- | -------------------------------------------------------------------------------- |
| `coins` | `coin_transfer`, `room_commission`, `target_refund`, `system_generation` |
| `diamonds` | `reward_claim`, `owner_bonus`, `diamond_exchange` |
| `gifts` | `gift`, `agency_income` |
| `all` | No filter (default) |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Transactions retrieved",
  "data": {
    "transactions_by_date": [
      {
        "date": "2026-01-15",
        "date_formatted": "15 January, 2026",
        "transactions": [
          {
            "id": "txn_12345",
            "type": "gift",
            "timestamp": "2026-01-15T14:30:00+00:00",
            "title": "Gift",
            "description": "Sent Rose to @john_doe",
            "thumbnail_url": "https://ik.imagekit.io/flylive/gifts/rose.webp",
            "status": "completed",
            "my_role": "initiator",
            "amount": {
              "value": -500.0,
              "currency": "coins",
              "formatted": "-500.00"
            },
            "my_balance": {
              "coins": {
                "before": "10000.0000",
                "after": "9500.0000"
              },
              "diamonds": null
            },
            "my_xp": {
              "wealth": {
                "before": "5000.0000",
                "after": "5500.0000"
              },
              "charm": null
            },
            "other_party": {
              "id": 456,
              "name": "John Doe",
              "signature": "john_doe",
              "avatar_url": "https://example.com/avatar.jpg"
            },
            "metadata": {
              "gift_name": "Rose",
              "gift_id": 42
            }
          }
        ]
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total_pages": 5,
      "total_transactions": 100,
      "has_more": true
    }
  },
  "meta": {
    "timestamp": "2026-01-15T14:30:00.000000Z",
    "correlation_id": "uuid-string"
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
    "date_to": [
      "The date to field must be a date after or equal to date from."
    ],
    "per_page": ["The per page field must not be greater than 50."]
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Transactions retrieved successfully     |
| `401` | Missing or invalid authentication token |
| `422` | Validation failed on query parameters   |
| `500` | Internal server error                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/transactions                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/transactions.php:16                                        │
│ Route: Route::get('/', [TransactionController::class, 'index'])             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, loads authenticated user       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED - INLINE VALIDATION                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/TransactionController.php:24-31   │
│                                                                             │
│ No FormRequest class used - validation is inline in controller:             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $request->validate([                                                    │ │
│ │     'type' => 'sometimes|string',                                       │ │
│ │     'page' => 'sometimes|integer|min:1',                                │ │
│ │     'per_page' => 'sometimes|integer|min:1|max:50',                     │ │
│ │     'date_from' => 'sometimes|date',                                    │ │
│ │     'date_to' => 'sometimes|date|after_or_equal:date_from',             │ │
│ │     'sort' => 'sometimes|string|in:newest,oldest',                      │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If validation fails → 422 ValidationException thrown automatically          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/TransactionController.php         │
│ Method: index(Request $request): JsonResponse                               │
│                                                                             │
│ STEP 1: Extract authenticated user and query parameters                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ $userId = $user->id;                                                    │ │
│ │ $type = $request->query('type', 'all');                                 │ │
│ │ $perPage = min((int) ($request->query('per_page', 20)), 50);            │ │
│ │ $sortDirection = $request->query('sort', 'newest') === 'newest'         │ │
│ │     ? 'desc' : 'asc';                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build base query with user filter                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = Transaction::query()                                           │ │
│ │     ->where(function ($q) use ($userId) {                               │ │
│ │         $q->where('user_id', $userId)                                   │ │
│ │             ->orWhere('beneficiary_id', $userId);                       │ │
│ │     })                                                                  │ │
│ │     ->with(['user', 'beneficiary', 'transactionable']);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Apply type filtering                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($type !== 'all') {                                                  │ │
│ │     $typeMapping = [                                                    │ │
│ │         'coins' => [TYPE_COIN_TRANSFER, TYPE_ROOM_COMMISSION,           │ │
│ │                     TYPE_TARGET_REFUND, TYPE_SYSTEM_GENERATION],        │ │
│ │         'diamonds' => [TYPE_REWARD_CLAIM, TYPE_OWNER_BONUS,             │ │
│ │                        TYPE_DIAMOND_EXCHANGE],                          │ │
│ │         'gifts' => [TYPE_GIFT, TYPE_AGENCY_INCOME],                     │ │
│ │     ];                                                                  │ │
│ │     if (isset($typeMapping[$type])) {                                   │ │
│ │         $query->whereIn('type', $typeMapping[$type]);                   │ │
│ │     } else {                                                            │ │
│ │         $query->where('type', $type);  // Exact type match              │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Apply date filters                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($request->query('date_from')) {                                     │ │
│ │     $query->whereDate('created_at', '>=', $request->query('date_from'));│ │
│ │ }                                                                       │ │
│ │ if ($request->query('date_to')) {                                       │ │
│ │     $query->whereDate('created_at', '<=', $request->query('date_to'));  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Execute paginated query                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query->orderBy('created_at', $sortDirection);                          │ │
│ │ $paginated = $query->paginate($perPage);                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Group by date and return response                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $groupedByDate = $this->groupTransactionsByDate(                        │ │
│ │     $paginated->items(), $userId                                        │ │
│ │ );                                                                      │ │
│ │ return ApiResponse::success([...], 'Transactions retrieved');           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service class - all logic in controller.                       │
│ Helper method for date grouping:                                            │
│                                                                             │
│ METHOD: groupTransactionsByDate(array $transactions, int $perspectiveUserId)│
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: TransactionController.php:156-174                                 │ │
│ │ Purpose: Groups transactions by date with formatted labels              │ │
│ │                                                                         │ │
│ │ $grouped = collect($transactions)->groupBy(function ($transaction) {    │ │
│ │     return Carbon::parse($transaction->created_at)->format('Y-m-d');    │ │
│ │ });                                                                     │ │
│ │                                                                         │ │
│ │ return $grouped->map(function ($transactions, $date) use ($userId) {    │ │
│ │     return [                                                            │ │
│ │         'date' => $date,                                                │ │
│ │         'date_formatted' => Carbon::parse($date)->format('d F, Y'),     │ │
│ │         'transactions' => TransactionResource::collection($transactions)│ │
│ │             ->additional(['perspective_user_id' => $userId]),           │ │
│ │     ];                                                                  │ │
│ │ })->values()->toArray();                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Transaction (Model)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/Transaction.php                                │ │
│ │ Responsibility: Transaction data model with relationships               │ │
│ │ Reusable: YES (used by all economy features)                            │ │
│ │ Why It Exists: Central model for all financial operations               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • user() → BelongsTo relationship to initiator User                   │ │
│ │   • beneficiary() → BelongsTo relationship to beneficiary User          │ │
│ │   • room() → BelongsTo relationship to Room                             │ │
│ │   • transactionable() → MorphTo polymorphic (gift, frame, etc.)         │ │
│ │   • getDefaultIcon(string $type) → Returns icon URL for type            │ │
│ │                                                                         │ │
│ │ Type Constants: TYPE_GIFT, TYPE_COIN_TRANSFER, TYPE_DIAMOND_EXCHANGE,   │ │
│ │                 TYPE_REWARD_CLAIM, TYPE_ROOM_COMMISSION, etc.           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: TransactionResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/TransactionResource.php             │ │
│ │ Responsibility: Perspective-aware transaction formatting                │ │
│ │ Reusable: YES (used by all transaction display endpoints)               │ │
│ │ Why It Exists: Provides consistent, perspective-aware transformation    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray($request) → Main transformation method                      │ │
│ │   • getTransactionTitle() → Human-readable transaction type             │ │
│ │   • getDescriptionForPerspective($isInitiator) → Role-aware description │ │
│ │   • formatAmountForPerspective($isInitiator) → +/- amount display       │ │
│ │   • formatInitiatorBalance() → User's balance before/after              │ │
│ │   • formatOtherParty($isInitiator) → Other party info (no financials)   │ │
│ │                                                                         │ │
│ │ Perspective Logic:                                                      │ │
│ │   - If user is initiator: shows initiator balance, counterparty=beneficiary │
│ │   - If user is beneficiary: shows beneficiary balance, counterparty=user│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure with meta                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta, $statusCode) → 200 response         │ │
│ │   • error($message, $errors, $statusCode, $meta) → Error response       │ │
│ │   • validationError($errors, $message, $meta) → 422 response            │ │
│ │   • getCorrelationId() → Request tracking UUID                          │ │
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
│ 1. SELECT (count): Count total matching transactions for pagination        │
│    Query: SELECT COUNT(*) FROM transactions                                 │
│           WHERE (user_id = ? OR beneficiary_id = ?)                         │
│           [AND type IN (?...)]                                              │
│           [AND DATE(created_at) >= ?]                                       │
│           [AND DATE(created_at) <= ?]                                       │
│    Source: TransactionController::index() via paginate()                    │
│                                                                             │
│ 2. SELECT (paginated): Fetch transactions with eager loading               │
│    Query: SELECT * FROM transactions                                        │
│           WHERE (user_id = ? OR beneficiary_id = ?)                         │
│           [AND type IN (?...)]                                              │
│           [AND DATE(created_at) >= ?]                                       │
│           [AND DATE(created_at) <= ?]                                       │
│           ORDER BY created_at DESC|ASC                                      │
│           LIMIT ? OFFSET ?                                                  │
│    Source: TransactionController::index() via paginate()                    │
│                                                                             │
│ 3. SELECT (eager load): Load user relationships                             │
│    Query: SELECT * FROM users WHERE id IN (...)                             │
│    Source: with(['user', 'beneficiary']) eager loading                      │
│                                                                             │
│ 4. SELECT (eager load): Load transactionable polymorphic                    │
│    Query: SELECT * FROM [gifts|frames|...] WHERE id IN (...)                │
│    Source: with(['transactionable']) eager loading                          │
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
│ STEP 1: Group transactions by date                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ collect($transactions)->groupBy(fn($t) => $t->created_at->format('Y-m-d'))│
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: For each date group, transform via TransactionResource             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ TransactionResource::collection($transactions)                          │ │
│ │     ->additional(['perspective_user_id' => $userId])                    │ │
│ │                                                                         │ │
│ │ Each transaction transformed with:                                      │ │
│ │   - my_role based on whether user is initiator or beneficiary           │ │
│ │   - my_balance showing user's balance changes only                      │ │
│ │   - other_party showing counterparty identity (no financials)           │ │
│ │   - amount with +/- based on user's perspective                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Build final response via ApiResponse::success()                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success([                                                  │ │
│ │     'transactions_by_date' => $groupedByDate,                           │ │
│ │     'pagination' => [                                                   │ │
│ │         'current_page' => $paginated->currentPage(),                    │ │
│ │         'per_page' => $paginated->perPage(),                            │ │
│ │         'total_pages' => $paginated->lastPage(),                        │ │
│ │         'total_transactions' => $paginated->total(),                    │ │
│ │         'has_more' => $paginated->hasMorePages(),                       │ │
│ │     ],                                                                  │ │
│ │ ], 'Transactions retrieved');                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Final JSON structure with meta                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Transactions retrieved",                                  │ │
│ │   "data": { ... },                                                      │ │
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

| File                          | Used By Endpoints           | Reusable | Reasoning                                         |
| ----------------------------- | --------------------------- | -------- | ------------------------------------------------- |
| `TransactionController.php`   | Transactions endpoints only | ⭕       | index/summary methods specific; grouping reusable |
| `Transaction.php`             | All Economy endpoints       | ✅       | Central model for all financial operations        |
| `TransactionResource.php`     | All transaction displays    | ✅       | Perspective-aware, works with any transaction     |
| `ApiResponse.php`             | All API endpoints           | ✅       | Global response formatting utility                |
| `routes/api/transactions.php` | Transactions endpoints only | ❌       | Endpoint-specific routing                         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                    | Source            | Condition                           |
| ------------------------ | ----------------- | ----------------------------------- |
| `page.min`               | Inline validation | Page number less than 1             |
| `per_page.min`           | Inline validation | Per page less than 1                |
| `per_page.max`           | Inline validation | Per page greater than 50            |
| `date_from.date`         | Inline validation | Invalid date format                 |
| `date_to.date`           | Inline validation | Invalid date format                 |
| `date_to.after_or_equal` | Inline validation | date_to before date_from            |
| `sort.in`                | Inline validation | Sort value not `newest` or `oldest` |

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### System Errors (500)

| Error                   | Source            | Condition                         |
| ----------------------- | ----------------- | --------------------------------- |
| "Internal server error" | Exception handler | Database connection failure       |
| "Internal server error" | Exception handler | Unhandled exception in controller |

### Edge Cases

| Case                                 | Behavior                                           |
| ------------------------------------ | -------------------------------------------------- |
| No transactions found                | Returns empty `transactions_by_date: []` array     |
| User is both initiator & beneficiary | Shows as initiator (user_id checked first)         |
| Invalid exact type string            | Still searches (returns empty if no match)         |
| Page beyond total pages              | Returns empty transactions with correct pagination |
| `per_page` > 50                      | Capped at 50 via `min()` function                  |
| System transaction (no beneficiary)  | `other_party` is `null`                            |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            MODEL/RESOURCE              DATABASE
   │                       │                       │                       │                         │
   │  GET /transactions    │                       │                       │                         │
   │──────────────────────▶│                       │                       │                         │
   │                       │                       │                       │                         │
   │                       │ 1. auth:sanctum       │                       │                         │
   │                       │   validate token      │                       │                         │
   │                       │   load user           │                       │                         │
   │                       │──────────────────────▶│                       │                         │
   │                       │                       │                       │                         │
   │                       │                       │ 2. Inline validate()  │                         │
   │                       │                       │   type, page, dates   │                         │
   │                       │                       │   [422 if fails]      │                         │
   │                       │                       │                       │                         │
   │                       │                       │ 3. Build query        │                         │
   │                       │                       │──────────────────────▶│                         │
   │                       │                       │                       │                         │
   │                       │                       │                       │ 4. COUNT query           │
   │                       │                       │                       │────────────────────────▶│
   │                       │                       │                       │◀────────────────────────│
   │                       │                       │                       │                         │
   │                       │                       │                       │ 5. SELECT paginated      │
   │                       │                       │                       │────────────────────────▶│
   │                       │                       │                       │◀────────────────────────│
   │                       │                       │                       │                         │
   │                       │                       │                       │ 6. Eager load users      │
   │                       │                       │                       │────────────────────────▶│
   │                       │                       │                       │◀────────────────────────│
   │                       │                       │                       │                         │
   │                       │                       │◀──────────────────────│                         │
   │                       │                       │                       │                         │
   │                       │                       │ 7. groupTransactionsByDate()                     │
   │                       │                       │   + TransactionResource                          │
   │                       │                       │   transform each                                 │
   │                       │                       │                       │                         │
   │                       │                       │ 8. ApiResponse::success()                        │
   │                       │◀──────────────────────│                       │                         │
   │◀──────────────────────│                       │                       │                         │
   │                       │                       │                       │                         │
   │  200 OK + JSON        │                       │                       │                         │
   │                       │                       │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition             | Location                                             |
| -------------------- | ---------------------------------------------------- |
| New filter parameter | `TransactionController::index()` validation + query  |
| New transaction type | `Transaction` constants + `TransactionResource` maps |
| New response field   | `TransactionResource::toArray()`                     |
| Custom sort field    | `TransactionController::index()` orderBy clause      |
| Search functionality | Add `search` param in controller validation + query  |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW QUERY PARAMETER (e.g., `currency` filter)

| Step  | File                                                            | What to Change                        |
| ----- | --------------------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Economy/TransactionController.php` | Add to inline validation array        |
| **2** | `TransactionController.php:40-70`                               | Add query filter logic                |
| **3** | `docs/api/Economy/transactions/README.md`                       | Update query parameters documentation |

```php
// Step 1: Add validation
$request->validate([
    // ... existing
    'currency' => 'sometimes|string|in:coins,diamonds',
]);

// Step 2: Add filter
if ($request->query('currency')) {
    $query->where('currency', $request->query('currency'));
}
```

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                    | What to Change                  |
| ----- | ------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Economy/TransactionResource.php` | Add field to `toArray()` return |
| **2** | `TransactionResource.php`                               | Add helper method if needed     |
| **3** | Documentation                                           | Update response schema          |

```php
// In TransactionResource::toArray()
return [
    // ... existing fields
    'new_field' => $this->computeNewField(),
];

// Add helper method
protected function computeNewField(): mixed
{
    return $this->some_column ?? 'default';
}
```

#### ➕ ADDING A NEW TYPE CATEGORY

| Step  | File                              | What to Change               |
| ----- | --------------------------------- | ---------------------------- |
| **1** | `TransactionController.php:50-58` | Add to `$typeMapping` array  |
| **2** | Documentation                     | Update type categories table |

```php
$typeMapping = [
    // ... existing
    'rewards' => [Transaction::TYPE_REWARD_CLAIM, Transaction::TYPE_SYSTEM_REWARD],
];
```

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                    | What to Change                 |
| ----- | ------------------------------------------------------- | ------------------------------ |
| **1** | `app/Http/Resources/V1/Economy/TransactionResource.php` | Remove from `toArray()` return |
| **2** | `TransactionResource.php`                               | Remove helper method if unused |
| **3** | Documentation                                           | Update response schema         |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        FIELD FLOW DIAGRAM                                │
│──────────────────────────────────────────────────────────────────────────│
│                                                                          │
│  Query Parameter                                                         │
│  ┌───────────────┐                                                       │
│  │ ?type=coins   │                                                       │
│  └───────┬───────┘                                                       │
│          │                                                               │
│          ▼                                                               │
│  ┌───────────────────────────────────────┐                               │
│  │ TransactionController.php:50-58       │                               │
│  │ $typeMapping → whereIn('type', [...]) │                               │
│  └───────┬───────────────────────────────┘                               │
│          │                                                               │
│          ▼                                                               │
│  ┌───────────────────────────────────────┐                               │
│  │ Transaction Model                     │                               │
│  │ Transaction::TYPE_* constants         │                               │
│  └───────┬───────────────────────────────┘                               │
│          │                                                               │
│          ▼                                                               │
│  ┌───────────────────────────────────────┐                               │
│  │ TransactionResource                   │                               │
│  │ getTransactionTitle()                 │◄── Uses TYPE_* for display    │
│  │ resolveDefaultThumbnail()             │◄── Uses TYPE_* for icon       │
│  │ formatOtherParty()                    │◄── Uses TYPE_* for null check │
│  └───────────────────────────────────────┘                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding New Transaction Type

- [ ] Add constant to `Transaction.php` (e.g., `TYPE_NEW_TYPE = 'new_type'`)
- [ ] Add to relevant category in `TransactionController::$typeMapping`
- [ ] Add title mapping in `TransactionResource::getTransactionTitle()`
- [ ] Add description in `TransactionResource::getDescriptionForPerspective()`
- [ ] Add icon mapping in `TransactionResource::resolveDefaultThumbnail()`
- [ ] Check if `formatOtherParty()` should exclude this type (system transactions)
- [ ] Update documentation type categories table

### ⚠️ What Should NOT Be Modified Casually

| Component                             | Reason                                                  |
| ------------------------------------- | ------------------------------------------------------- |
| `perspective_user_id` additional data | Core to perspective-aware formatting; breaks if changed |
| `user_id` / `beneficiary_id` filter   | Security: users can only see their own transactions     |
| `ApiResponse::success()` structure    | Many clients depend on consistent response format       |
| Transaction type constants            | Used across entire Economy domain; coordinate changes   |
| `formatOtherParty()` exclusion list   | Privacy: prevents exposing system transaction internals |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| N+1 query on relationships              | Always use `with(['user', 'beneficiary', 'transactionable'])` |
| Exposing other user's financial data    | TransactionResource only shows "my" balance data              |
| Large result sets causing memory issues | `per_page` capped at 50, use pagination                       |
| Date filter ignoring timezones          | Uses `whereDate()` for date-only comparison                   |
| Missing type in typeMapping             | Falls back to exact type match, may confuse users             |
| Grouping breaks with empty array        | `collect($transactions)->groupBy()` handles empty safely      |

### 📁 File Locations Quick Reference

```
routes/api/transactions.php                              ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── TransactionController.php                          ← Controller with index()
app/Models/Economy/
  └── Transaction.php                                    ← Transaction model
app/Http/Resources/V1/Economy/
  └── TransactionResource.php                            ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
database/migrations/
  └── 2025_12_08_000002_create_transactions_table.php    ← Table migration
```

---

## Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `GET /api/v1/transactions` |
| **Domain**          | Economy                    |
| **Author**          | System Documentation       |
| **Created**         | 2026-02-02                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4+                       |
