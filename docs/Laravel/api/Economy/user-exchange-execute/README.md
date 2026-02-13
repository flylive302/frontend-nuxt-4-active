# POST /api/v1/user/exchange

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Allows authenticated users to exchange their diamonds for coins at a configurable exchange rate. This is a one-way conversion where users spend diamonds and receive coins.

### Responsibilities

- Validate diamond amount for exchange
- Check if exchange feature is enabled system-wide
- Deduct diamonds from user atomically
- Add coins to user atomically
- Create transaction record with complete state snapshot
- Return updated balances and exchange details

### What It Owns

| Owned                | Description                                        |
| -------------------- | -------------------------------------------------- |
| Exchange execution   | Deduct diamonds, add coins in atomic transaction   |
| Transaction creation | Creates `diamond_exchange` type transaction record |

### External Dependencies

| Dependency              | Type           | Purpose                                    |
| ----------------------- | -------------- | ------------------------------------------ |
| `system_settings` table | Database       | Store exchange rate and enabled flag       |
| Redis Cache             | Infrastructure | Cache exchange configuration (1 hour TTL)  |
| `users` table           | Database       | Store user coin and diamond balances       |
| `transactions` table    | Database       | Record exchange transaction with snapshots |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/exchange
```

### Authentication

✅ **Required** - Sanctum token authentication

### Rate Limiting

| Limiter    | Key    | Config                      |
| ---------- | ------ | --------------------------- |
| `throttle` | `10,1` | 10 requests/minute per user |

### Request Headers

| Header          | Required | Type               | Description         |
| --------------- | -------- | ------------------ | ------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format |
| `Accept`        | ✅       | `application/json` | Response format     |
| `Authorization` | ✅       | `Bearer {token}`   | Sanctum auth token  |

### Request Body Schema

```json
{
  "diamond_amount": "integer" // Required, min:1
}
```

#### Field Details

| Field            | Type      | Constraints      | Example |
| ---------------- | --------- | ---------------- | ------- |
| `diamond_amount` | `integer` | Required, min: 1 | `5`     |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Successfully exchanged 5 diamonds for 8750 coins",
  "data": {
    "diamonds_deducted": 5,
    "coins_received": 8750,
    "new_coin_balance": "12500.0000",
    "new_diamond_balance": 95,
    "exchange_rate": 1750
  },
  "meta": {
    "timestamp": "2026-02-02T19:45:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "The diamond amount field is required.",
  "data": null,
  "errors": {
    "diamond_amount": ["The diamond amount field is required."]
  }
}
```

#### ❌ Insufficient Balance (422)

```json
{
  "status": "error",
  "message": "Insufficient diamonds: required 100, available 50",
  "data": null,
  "errors": {}
}
```

#### ❌ Exchange Disabled (503)

```json
{
  "status": "error",
  "message": "Exchange is currently disabled",
  "data": null,
  "errors": {}
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "An unexpected error occurred",
  "data": null,
  "errors": {}
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Exchange completed successfully           |
| `401` | Missing or invalid authentication         |
| `422` | Validation failed or insufficient balance |
| `429` | Rate limit exceeded                       |
| `503` | Exchange feature is disabled              |
| `500` | Unexpected server error                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/user/exchange                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/exchange.php:22                                            │
│ Route: Route::post('/', [ExchangeController::class, 'exchange'])            │
│        ->name('user.exchange.execute')                                      │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum   → Validates Bearer token, loads user                    │
│   2. throttle:10,1  → Rate limits to 10 requests per minute                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ExchangeController.php:52-59      │
│                                                                             │
│ Controller performs inline validation (no FormRequest):                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validate([                                       │ │
│ │     'diamond_amount' => ['required', 'integer', 'min:1'],               │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Throws ValidationException (422) if:                                        │
│   • diamond_amount is missing                                               │
│   • diamond_amount is not an integer                                        │
│   • diamond_amount < 1                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ExchangeController.php            │
│ Method: exchange(Request $request)                                          │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call ExchangeService to perform exchange                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->exchangeService->exchangeDiamondsForCoins(             │ │
│ │     $user->id,                                                          │ │
│ │     (int) $validated['diamond_amount']                                  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle exceptions and return appropriate response                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ catch (ExchangeDisabledException $e)     → 503 response                 │ │
│ │ catch (InsufficientBalanceException $e)  → 422 response                 │ │
│ │ catch (InvalidAmountException $e)        → 422 response                 │ │
│ │ catch (\Exception $e)                    → 500 response                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: ExchangeService                                                    │
│ File: app/Services/Economy/ExchangeService.php                              │
│ Method: exchangeDiamondsForCoins(int $userId, int $diamondAmount)           │
│                                                                             │
│ STEP 1: Get exchange configuration (cached)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $config = $this->getExchangeConfig();                                   │ │
│ │ // Returns: ['coins_per_diamond' => 1750, 'is_enabled' => true]         │ │
│ │ // Cache key: 'exchange:config', TTL: 1 hour                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate exchange is enabled                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $config['is_enabled']) {                                          │ │
│ │     throw new ExchangeDisabledException;                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate amount                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($diamondAmount < 1) {                                               │ │
│ │     throw new InvalidAmountException($diamondAmount);                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Calculate coins to receive                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinsToAdd = $diamondAmount * $config['coins_per_diamond'];            │ │
│ │ // Example: 5 * 1750 = 8750 coins                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Execute atomic DB transaction                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () {                                    │ │
│ │     // Deduct diamonds (with lockForUpdate)                             │ │
│ │     $diamondResult = $this->coinService->deductDiamondsFromUser(...)    │ │
│ │                                                                         │ │
│ │     // Add coins (with lockForUpdate)                                   │ │
│ │     $coinResult = $this->coinService->addToUser(...)                    │ │
│ │                                                                         │ │
│ │     // Create transaction record                                        │ │
│ │     Transaction::create([...])                                          │ │
│ │                                                                         │ │
│ │     return [...result...];                                              │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CoinDistributionService (Service)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Economy/CoinDistributionService.php                  │ │
│ │ Responsibility: Canonical service for all coin/diamond balance changes  │ │
│ │ Reusable: YES (used by all economy operations)                          │ │
│ │ Why It Exists: Enforces balance invariants and prevents race conditions │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deductDiamondsFromUser() → Atomic diamond deduction with lock       │ │
│ │   • addToUser() → Atomic coin addition with lock                        │ │
│ │                                                                         │ │
│ │ Balance Invariants:                                                     │ │
│ │   • All amounts must be positive integers                               │ │
│ │   • Balances MUST NEVER go negative                                     │ │
│ │   • Uses lockForUpdate() for race condition prevention                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SystemSettingService (Service)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/SystemSettingService.php                 │ │
│ │ Responsibility: Retrieve system settings from database with caching    │ │
│ │ Reusable: YES (used across domains)                                     │ │
│ │ Why It Exists: Centralizes configurable settings management             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • get($key, $default) → Retrieves setting value                       │ │
│ │                                                                         │ │
│ │ Settings Used:                                                          │ │
│ │   • exchange.coins_per_diamond (default: 1750)                          │ │
│ │   • exchange.enabled (default: true)                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Transaction (Model)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/Transaction.php                                │ │
│ │ Responsibility: Records all financial events with state snapshots      │ │
│ │ Reusable: YES (used by all transaction types)                           │ │
│ │ Why It Exists: Audit trail and balance reconciliation                   │ │
│ │                                                                         │ │
│ │ Key Fields for Exchange:                                                │ │
│ │   • type: Transaction::TYPE_DIAMOND_EXCHANGE                            │ │
│ │   • currency: 'diamonds'                                                │ │
│ │   • amount: -diamondAmount (negative for spending)                      │ │
│ │   • initiator_coin_balance_before/after                                 │ │
│ │   • initiator_diamond_balance_before/after                              │ │
│ │   • metadata: {coins_received, diamonds_spent, exchange_rate}           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardizes JSON response format                       │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → Format successful response               │ │
│ │   • error($message, $errors, $code) → Format error response             │ │
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
│ 1. GET: 'exchange:config' (TTL: 1 hour)                                     │
│    Source: ExchangeService::getExchangeConfig()                             │
│    Miss → Query SystemSetting::getValue() for exchange.* keys               │
│                                                                             │
│ DATABASE OPERATIONS (inside DB::transaction):                               │
│                                                                             │
│ 1. SELECT FOR UPDATE: users (diamonds check)                                │
│    Query: SELECT * FROM users WHERE id = ? FOR UPDATE                       │
│    Source: CoinDistributionService::deductDiamondsFromUser()                │
│                                                                             │
│ 2. UPDATE: users (diamonds deduction)                                       │
│    Query: UPDATE users SET diamonds = ? WHERE id = ?                        │
│    Source: CoinDistributionService::deductDiamondsFromUser()                │
│                                                                             │
│ 3. SELECT FOR UPDATE: users (coins check)                                   │
│    Query: SELECT * FROM users WHERE id = ? FOR UPDATE                       │
│    Source: CoinDistributionService::addToUser()                             │
│                                                                             │
│ 4. UPDATE: users (coins addition)                                           │
│    Query: UPDATE users SET coins = ? WHERE id = ?                           │
│    Source: CoinDistributionService::addToUser()                             │
│                                                                             │
│ 5. INSERT: transactions                                                     │
│    Query: INSERT INTO transactions (user_id, type, currency, amount, ...)   │
│    Source: ExchangeService::exchangeDiamondsForCoins()                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Controller builds response directly from service result:                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'diamonds_deducted' => $result['diamonds_deducted'],                │ │
│ │     'coins_received' => $result['coins_received'],                      │ │
│ │     'new_coin_balance' => number_format($result['new_coin_balance'],    │ │
│ │                                         4, '.', ''),                    │ │
│ │     'new_diamond_balance' => $result['new_diamond_balance'],            │ │
│ │     'exchange_rate' => $result['exchange_rate'],                        │ │
│ │ ], "Successfully exchanged X diamonds for Y coins");                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: No Resource class used—response built inline in controller            │
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

| File                               | Used By Endpoints           | Reusable | Reasoning                             |
| ---------------------------------- | --------------------------- | -------- | ------------------------------------- |
| `ExchangeController.php`           | `user/exchange` (GET, POST) | ⭕       | Controller specific, service reusable |
| `ExchangeService.php`              | `user/exchange` endpoints   | ✅       | Can be called from admin/CLI          |
| `CoinDistributionService.php`      | All economy operations      | ✅       | Canonical balance mutation service    |
| `SystemSettingService.php`         | All configurable features   | ✅       | System-wide settings service          |
| `Transaction.php`                  | All financial operations    | ✅       | Core audit model                      |
| `ApiResponse.php`                  | All API endpoints           | ✅       | Standard response formatter           |
| `ExchangeDisabledException.php`    | Exchange operations         | ✅       | Reusable exception                    |
| `InsufficientBalanceException.php` | All balance operations      | ✅       | Reusable exception                    |
| `InvalidAmountException.php`       | All amount validations      | ✅       | Reusable exception                    |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                     | Source     | Condition               |
| ------------------------- | ---------- | ----------------------- |
| `diamond_amount.required` | Controller | Field not provided      |
| `diamond_amount.integer`  | Controller | Value is not an integer |
| `diamond_amount.min`      | Controller | Value is less than 1    |

### Business Logic Errors (422)

| Error                                            | Source                         | Condition                   |
| ------------------------------------------------ | ------------------------------ | --------------------------- |
| "Insufficient diamonds: required X, available Y" | `InsufficientBalanceException` | User's diamonds < requested |
| "Amount must be a positive integer, got: X"      | `InvalidAmountException`       | Amount ≤ 0 (backup check)   |

### Service Errors (503)

| Error                            | Source                      | Condition                   |
| -------------------------------- | --------------------------- | --------------------------- |
| "Exchange is currently disabled" | `ExchangeDisabledException` | `exchange.enabled` is false |

### System Errors (500)

| Error                     | Source               | Condition                        |
| ------------------------- | -------------------- | -------------------------------- |
| Generic exception message | Controller catch-all | Database failure, deadlock, etc. |

### Edge Cases

| Case                              | Behavior                                     |
| --------------------------------- | -------------------------------------------- |
| User has exactly enough diamonds  | Exchange succeeds, balance becomes 0         |
| Concurrent exchange requests      | lockForUpdate() serializes operations        |
| Exchange rate changes mid-request | Uses cached rate from start of request       |
| Very large diamond amount         | Checked against actual balance (no overflow) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            EXCHANGE SERVICE          COIN SERVICE              DATABASE
   │                       │                       │                       │                       │                          │
   │  POST /user/exchange  │                       │                       │                       │                          │
   │  {diamond_amount: 5}  │                       │                       │                       │                          │
   │──────────────────────▶│                       │                       │                       │                          │
   │                       │                       │                       │                       │                          │
   │                       │ 1. auth:sanctum       │                       │                       │                          │
   │                       │    (validate token)   │                       │                       │                          │
   │                       │──────────────────────▶│                       │                       │                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │ 2. validate input     │                       │                          │
   │                       │                       │    (inline rules)     │                       │                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │ 3. exchangeDiamonds   │                       │                          │
   │                       │                       │    ForCoins()         │                       │                          │
   │                       │                       │──────────────────────▶│                       │                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │ 4. CACHE GET          │                          │
   │                       │                       │                       │    exchange:config    │                          │
   │                       │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────────────────────────────│
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │ 5. BEGIN TRANSACTION  │                          │
   │                       │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │ 6. deductDiamonds     │                          │
   │                       │                       │                       │    FromUser()         │                          │
   │                       │                       │                       │──────────────────────▶│                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │                       │ 7. SELECT FOR UPDATE     │
   │                       │                       │                       │                       │    users (diamonds)      │
   │                       │                       │                       │                       │─────────────────────────▶│
   │                       │                       │                       │                       │◀─────────────────────────│
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │                       │ 8. UPDATE users          │
   │                       │                       │                       │                       │    (deduct diamonds)     │
   │                       │                       │                       │                       │─────────────────────────▶│
   │                       │                       │                       │                       │◀─────────────────────────│
   │                       │                       │                       │◀──────────────────────│                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │ 9. addToUser()        │                          │
   │                       │                       │                       │──────────────────────▶│                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │                       │ 10. SELECT FOR UPDATE    │
   │                       │                       │                       │                       │     users (coins)        │
   │                       │                       │                       │                       │─────────────────────────▶│
   │                       │                       │                       │                       │◀─────────────────────────│
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │                       │ 11. UPDATE users         │
   │                       │                       │                       │                       │     (add coins)          │
   │                       │                       │                       │                       │─────────────────────────▶│
   │                       │                       │                       │                       │◀─────────────────────────│
   │                       │                       │                       │◀──────────────────────│                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │ 12. INSERT            │                          │
   │                       │                       │                       │     transactions      │                          │
   │                       │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────────────────────────────│
   │                       │                       │                       │                       │                          │
   │                       │                       │                       │ 13. COMMIT            │                          │
   │                       │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │                       │                       │                          │
   │                       │                       │◀──────────────────────│                       │                          │
   │                       │                       │                       │                       │                          │
   │                       │                       │ 14. Build response    │                       │                          │
   │                       │                       │     with balances     │                       │                          │
   │                       │◀──────────────────────│                       │                       │                          │
   │◀──────────────────────│                       │                       │                       │                          │
   │                       │                       │                       │                       │                          │
   │  200 OK + JSON        │                       │                       │                       │                          │
   │                       │                       │                       │                       │                          │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location(s)                                            |
| ------------------------------- | ------------------------------------------------------ |
| New exchange validation         | `ExchangeController::exchange()` validation rules      |
| Change exchange rate            | Update `exchange.coins_per_diamond` in system_settings |
| Disable/enable exchange         | Update `exchange.enabled` in system_settings           |
| Add exchange limits (daily cap) | `ExchangeService::exchangeDiamondsForCoins()`          |
| Add webhook notification        | `ExchangeService` after Transaction::create()          |
| Add response fields             | `ExchangeController::exchange()` response array        |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUEST FIELD

| Step  | File                                          | What to Change                    |
| ----- | --------------------------------------------- | --------------------------------- |
| **1** | `ExchangeController.php`                      | Add to validation rules array     |
| **2** | `ExchangeService::exchangeDiamondsForCoins()` | Add parameter or use from context |
| **3** | `Transaction` metadata                        | Add to metadata array if needed   |

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                     | What to Change              |
| ----- | ------------------------ | --------------------------- |
| **1** | `ExchangeService.php`    | Add to return array         |
| **2** | `ExchangeController.php` | Include in ApiResponse data |

#### ➖ REMOVING A FIELD

| Step  | File                     | What to Change                  |
| ----- | ------------------------ | ------------------------------- |
| **1** | `ExchangeController.php` | Remove from validation/response |
| **2** | `ExchangeService.php`    | Remove from return array        |

### 🔗 Field Flow Dependency Chain

```
Request → Controller → ExchangeService → CoinDistributionService → User Model → Database
           (validate)   (orchestrate)     (atomic mutations)       (save)

                                       → Transaction Model → Database
                                         (audit record)
```

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                  |
| ------------------------- | ------------------------------------------------------- |
| `CoinDistributionService` | Balance invariants—changing can cause negative balances |
| `DB::transaction()` scope | Atomic guarantee—partial changes = data corruption      |
| `lockForUpdate()` calls   | Race condition prevention—removing = balance errors     |
| Transaction record fields | Audit trail—modifying breaks reconciliation             |
| Exchange rate cache key   | Changing invalidates existing cached configs            |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                             |
| -------------------------------------- | ------------------------------------------------------ |
| Not using CoinDistributionService      | ALL balance changes MUST go through this service       |
| Modifying balances outside transaction | Use DB::transaction() for atomicity                    |
| Forgetting to clear exchange cache     | Call `Cache::forget('exchange:config')` after updates  |
| Integer overflow on coin calculation   | PHP handles large ints; use BCMath if precision needed |
| Missing lockForUpdate()                | Always use for balance reads before updates            |

### 📁 File Locations Quick Reference

```
routes/api/exchange.php                                 ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── ExchangeController.php                            ← Controller
app/Services/Economy/
  ├── ExchangeService.php                               ← Exchange orchestration
  └── CoinDistributionService.php                       ← Balance mutations
app/Services/Progression/
  └── SystemSettingService.php                          ← Settings retrieval
app/Models/Economy/
  └── Transaction.php                                   ← Transaction model
app/Exceptions/Economy/
  ├── ExchangeDisabledException.php                     ← Exchange disabled error
  ├── InsufficientBalanceException.php                  ← Insufficient balance error
  └── InvalidAmountException.php                        ← Invalid amount error
app/Http/Utils/
  └── ApiResponse.php                                   ← Response formatter
```

---

## Document Metadata

| Property            | Value                        |
| ------------------- | ---------------------------- |
| **Endpoint**        | `POST /api/v1/user/exchange` |
| **Domain**          | Economy                      |
| **Author**          | System Documentation         |
| **Created**         | 2026-02-02                   |
| **Laravel Version** | 12.x                         |
| **PHP Version**     | 8.4+                         |
