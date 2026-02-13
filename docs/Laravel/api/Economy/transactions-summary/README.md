# GET /api/v1/transactions/summary

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Returns aggregated transaction statistics for the authenticated user, including totals for coins earned/spent, diamonds earned, and gifts sent/received.

### Responsibilities

- Aggregate coin transaction totals (earned, spent, count)
- Aggregate diamond transaction totals (earned, count)
- Count gifts sent and received by the user

### What It Owns

| Owned                   | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| Transaction aggregation | Calculates summary statistics from transaction records |

### External Dependencies

| Dependency | Type           | Purpose                       |
| ---------- | -------------- | ----------------------------- |
| MySQL      | Database       | Stores transaction records    |
| Sanctum    | Authentication | Validates user authentication |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/transactions/summary
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config            |
| ------- | ------- | ----------------- |
| `api`   | User ID | `config/auth.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

No request body required. This is a GET endpoint with no query parameters.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Transaction summary retrieved",
  "data": {
    "coins": {
      "total_earned": 15000.5, // float - Total coins received (positive amounts)
      "total_spent": 8500.25, // float - Total coins spent (absolute of negative amounts)
      "transaction_count": 125 // int - Number of coin transactions
    },
    "diamonds": {
      "total_earned": 500, // int - Total diamonds earned
      "transaction_count": 45 // int - Number of diamond transactions
    },
    "gifts": {
      "total_sent": 75, // int - Total gift quantity sent
      "total_received": 120 // int - Total gift quantity received
    }
  },
  "meta": {
    "timestamp": "2026-02-02T20:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T20:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Summary successfully retrieved          |
| `401` | Missing or invalid authentication token |
| `500` | Database error during aggregation       |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/transactions/summary                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/transactions.php:17                                        │
│ Route: Route::get('/summary', [TransactionController::class, 'summary'])    │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, loads authenticated user       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/TransactionController.php:93-154  │
│ Method: summary(Request $request)                                           │
│                                                                             │
│ No Form Request - Uses standard Request with no validation needed           │
│ (endpoint has no query parameters or body)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/TransactionController.php         │
│ Method: summary(Request $request)                                           │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ │ $userId = $user->id;                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Aggregate coin transactions                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinTransactions = Transaction::where(function ($q) use ($userId) {    │ │
│ │     $q->where('user_id', $userId)->orWhere('beneficiary_id', $userId);  │ │
│ │ })                                                                      │ │
│ │     ->where('currency', 'coins')                                        │ │
│ │     ->selectRaw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)       │ │
│ │                  as total_in')                                          │ │
│ │     ->selectRaw('SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)  │ │
│ │                  as total_out')                                         │ │
│ │     ->selectRaw('COUNT(*) as count')                                    │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Aggregate diamond transactions                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $diamondTransactions = Transaction::where(function ($q) use ($userId) { │ │
│ │     $q->where('user_id', $userId)->orWhere('beneficiary_id', $userId);  │ │
│ │ })                                                                      │ │
│ │     ->where('currency', 'diamonds')                                     │ │
│ │     ->selectRaw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)       │ │
│ │                  as total_in')                                          │ │
│ │     ->selectRaw('COUNT(*) as count')                                    │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Count gifts sent and received                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $giftsSent = Transaction::where('user_id', $userId)                     │ │
│ │     ->where('type', Transaction::TYPE_GIFT)                             │ │
│ │     ->sum('quantity');                                                  │ │
│ │                                                                         │ │
│ │ $giftsReceived = Transaction::where('beneficiary_id', $userId)          │ │
│ │     ->where('type', Transaction::TYPE_GIFT)                             │ │
│ │     ->sum('quantity');                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ⚠️  NO SERVICE LAYER                                                        │
│                                                                             │
│ This endpoint performs all aggregation logic directly in the controller.    │
│ No service classes are invoked. All database queries are made via the       │
│ Transaction model's query builder.                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Transaction (Eloquent Model)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/Transaction.php                                │ │
│ │ Responsibility: Represents transaction records for financial events    │ │
│ │ Reusable: YES (used by all transaction endpoints)                      │ │
│ │ Why It Exists: Central model for all financial operations              │ │
│ │                                                                         │ │
│ │ Key Constants Used:                                                     │ │
│ │   • TYPE_GIFT = 'gift' → Used for gift transaction filtering            │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • user_id → Transaction initiator                                     │ │
│ │   • beneficiary_id → Transaction recipient                              │ │
│ │   • currency → 'coins' or 'diamonds'                                    │ │
│ │   • amount → Transaction amount (positive/negative)                     │ │
│ │   • quantity → Gift quantity                                            │ │
│ │   • type → Transaction type constant                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Ensures consistent response structure across API         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → Returns 200 with standard structure      │ │
│ │   • unauthorized($message) → Returns 401 error response                 │ │
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
│ 1. AGGREGATE (Coins): Get coin transaction totals                           │
│    Query:                                                                   │
│    SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_in,     │
│           SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_out│
│           COUNT(*) as count                                                 │
│    FROM transactions                                                        │
│    WHERE (user_id = ? OR beneficiary_id = ?)                                │
│      AND currency = 'coins'                                                 │
│    Source: TransactionController::summary()                                 │
│                                                                             │
│ 2. AGGREGATE (Diamonds): Get diamond transaction totals                     │
│    Query:                                                                   │
│    SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_in,     │
│           COUNT(*) as count                                                 │
│    FROM transactions                                                        │
│    WHERE (user_id = ? OR beneficiary_id = ?)                                │
│      AND currency = 'diamonds'                                              │
│    Source: TransactionController::summary()                                 │
│                                                                             │
│ 3. SUM (Gifts Sent): Count gift quantities sent                             │
│    Query:                                                                   │
│    SELECT SUM(quantity) FROM transactions                                   │
│    WHERE user_id = ? AND type = 'gift'                                      │
│    Source: TransactionController::summary()                                 │
│                                                                             │
│ 4. SUM (Gifts Received): Count gift quantities received                     │
│    Query:                                                                   │
│    SELECT SUM(quantity) FROM transactions                                   │
│    WHERE beneficiary_id = ? AND type = 'gift'                               │
│    Source: TransactionController::summary()                                 │
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
│ File: app/Http/Controllers/Api/V1/Economy/TransactionController.php:134-151 │
│                                                                             │
│ Response is built directly in controller:                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'coins' => [                                                        │ │
│ │         'total_earned' => (float) ($coinTransactions->total_in ?? 0),   │ │
│ │         'total_spent' => (float) ($coinTransactions->total_out ?? 0),   │ │
│ │         'transaction_count' => (int) ($coinTransactions->count ?? 0),   │ │
│ │     ],                                                                  │ │
│ │     'diamonds' => [                                                     │ │
│ │         'total_earned' => (int) ($diamondTransactions->total_in ?? 0),  │ │
│ │         'total_count' => (int) ($diamondTransactions->count ?? 0),      │ │
│ │     ],                                                                  │ │
│ │     'gifts' => [                                                        │ │
│ │         'total_sent' => (int) $giftsSent,                               │ │
│ │         'total_received' => (int) $giftsReceived,                       │ │
│ │     ],                                                                  │ │
│ │ ], 'Transaction summary retrieved');                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ No Resource class used - response built as plain array                      │
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

| File                          | Used By Endpoints                        | Reusable | Reasoning                                      |
| ----------------------------- | ---------------------------------------- | -------- | ---------------------------------------------- |
| `TransactionController.php`   | `/transactions`, `/transactions/summary` | ⭕ Mixed | Controller is reused, but methods are specific |
| `Transaction.php`             | All transaction endpoints                | ✅       | Core model for financial operations            |
| `ApiResponse.php`             | All API endpoints                        | ✅       | Standardized response utility                  |
| `routes/api/transactions.php` | Transaction routes only                  | ❌       | Route-specific configuration                   |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                  |
| ----- | ------ | ------------------------------------------ |
| N/A   | N/A    | No validation requirements (no parameters) |

### Business Logic Errors (400)

| Error | Source | Condition                         |
| ----- | ------ | --------------------------------- |
| N/A   | N/A    | No business logic errors possible |

### Authentication Errors (401)

| Error          | Source                           | Condition                  |
| -------------- | -------------------------------- | -------------------------- |
| "Unauthorized" | `TransactionController::summary` | `$request->user()` is null |

### System Errors (500)

| Error                     | Source | Condition                                |
| ------------------------- | ------ | ---------------------------------------- |
| Database connection error | MySQL  | Database unavailable                     |
| Query timeout             | MySQL  | Aggregation takes too long on large data |

### Edge Cases

| Case                                   | Behavior                                |
| -------------------------------------- | --------------------------------------- |
| User has no transactions               | Returns all zeros for totals and counts |
| User has only coin transactions        | Diamond and gift sections return zeros  |
| User has only gift transactions        | Coin and diamond sections return zeros  |
| Negative coin amounts                  | Treated as "spent" via `total_out`      |
| User is both initiator and beneficiary | Transaction counted in both directions  |
| Deleted transactions (soft deletes)    | Not included due to SoftDeletes trait   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                 MIDDLEWARE              CONTROLLER                    DATABASE
   │                        │                        │                            │
   │  GET /transactions/    │                        │                            │
   │       summary          │                        │                            │
   │───────────────────────▶│                        │                            │
   │                        │                        │                            │
   │                        │ 1. auth:sanctum        │                            │
   │                        │   Validate token       │                            │
   │                        │   Load user            │                            │
   │                        │───────────────────────▶│                            │
   │                        │                        │                            │
   │                        │                        │ 2. Check user              │
   │                        │                        │    $request->user()        │
   │                        │                        │                            │
   │                        │                        │ 3. Coin aggregation query  │
   │                        │                        │───────────────────────────▶│
   │                        │                        │◀───────────────────────────│
   │                        │                        │                            │
   │                        │                        │ 4. Diamond aggregation     │
   │                        │                        │    query                   │
   │                        │                        │───────────────────────────▶│
   │                        │                        │◀───────────────────────────│
   │                        │                        │                            │
   │                        │                        │ 5. Gifts sent sum query    │
   │                        │                        │───────────────────────────▶│
   │                        │                        │◀───────────────────────────│
   │                        │                        │                            │
   │                        │                        │ 6. Gifts received sum      │
   │                        │                        │    query                   │
   │                        │                        │───────────────────────────▶│
   │                        │                        │◀───────────────────────────│
   │                        │                        │                            │
   │                        │                        │ 7. Build response array    │
   │                        │                        │                            │
   │                        │◀───────────────────────│                            │
   │◀───────────────────────│                        │                            │
   │                        │                        │                            │
   │  200 + JSON response   │                        │                            │
   │                        │                        │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                         |
| ------------------------- | ------------------------------------------------ |
| New currency type summary | Add query block in `summary()` method            |
| Date range filtering      | Add query parameter validation and where clauses |
| Caching                   | Wrap queries with `Cache::remember()` blocks     |
| New gift statistics       | Add SUM/COUNT query in `summary()` method        |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW SUMMARY FIELD

| Step  | File                                                            | What to Change              |
| ----- | --------------------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Economy/TransactionController.php` | Add aggregation query       |
| **2** | `app/Http/Controllers/Api/V1/Economy/TransactionController.php` | Add field to response array |
| **3** | API Documentation                                               | Update response schema      |

**Example: Adding average transaction amount**

```php
// Step 1: Add query
$avgAmount = Transaction::where(function ($q) use ($userId) {
    $q->where('user_id', $userId)->orWhere('beneficiary_id', $userId);
})
    ->where('currency', 'coins')
    ->avg('amount');

// Step 2: Add to response
return ApiResponse::success([
    'coins' => [
        // ... existing fields
        'average_amount' => (float) ($avgAmount ?? 0),  // NEW
    ],
    // ...
], 'Transaction summary retrieved');
```

#### ➖ REMOVING A FIELD

| Step  | File                                                            | What to Change                   |
| ----- | --------------------------------------------------------------- | -------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Economy/TransactionController.php` | Remove query if no longer needed |
| **2** | `app/Http/Controllers/Api/V1/Economy/TransactionController.php` | Remove field from response array |
| **3** | API Documentation                                               | Update response schema           |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RESPONSE FIELDS                                    │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  coins.total_earned ◄─── Aggregation: SUM(amount) WHERE amount > 0          │
│                          AND currency = 'coins'                              │
│                                                                             │
│  coins.total_spent ◄──── Aggregation: SUM(ABS(amount)) WHERE amount < 0     │
│                          AND currency = 'coins'                              │
│                                                                             │
│  coins.transaction_count ◄── Aggregation: COUNT(*) WHERE currency = 'coins' │
│                                                                             │
│  diamonds.total_earned ◄── Aggregation: SUM(amount) WHERE amount > 0        │
│                            AND currency = 'diamonds'                         │
│                                                                             │
│  diamonds.transaction_count ◄── Aggregation: COUNT(*)                       │
│                                 WHERE currency = 'diamonds'                  │
│                                                                             │
│  gifts.total_sent ◄────── SUM(quantity) WHERE user_id = $userId             │
│                           AND type = 'gift'                                  │
│                                                                             │
│  gifts.total_received ◄── SUM(quantity) WHERE beneficiary_id = $userId      │
│                           AND type = 'gift'                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                              |
| ---------------------------------- | --------------------------------------------------- |
| User ID filtering logic            | Must include both `user_id` and `beneficiary_id`    |
| Currency filtering                 | Critical for separating coin vs diamond stats       |
| `ApiResponse::success()` structure | Changes affect all API clients                      |
| Transaction constants              | Used by multiple components for type identification |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| Forgetting `beneficiary_id` in query    | Always use OR condition for both user roles                   |
| Null pointer on empty result            | Use null coalescing (`?? 0`) for all aggregation results      |
| Performance on large transaction tables | Consider adding database indexes on user_id/beneficiary_id    |
| Mixing currency types in aggregation    | Always filter by currency before aggregating                  |
| Not casting to proper types             | Always cast: `(float)` for coins, `(int)` for diamonds/counts |

### 📁 File Locations Quick Reference

```
routes/api/transactions.php                          ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── TransactionController.php                      ← Controller (summary method)
app/Models/Economy/
  └── Transaction.php                                ← Transaction model
app/Http/Utils/
  └── ApiResponse.php                                ← Response formatting utility
```

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `GET /api/v1/transactions/summary` |
| **Domain**          | Economy                            |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-02                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4                                |
