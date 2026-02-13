# GET /api/v1/user/exchange

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Returns the diamond-to-coin exchange rate and the authenticated user's current coin and diamond balances.

### Responsibilities

- Retrieve exchange configuration from system settings
- Return user's current coin and diamond balances
- Indicate whether exchange feature is enabled or disabled

### What It Owns

| Owned         | Description                                |
| ------------- | ------------------------------------------ |
| Exchange Info | Aggregates exchange config + user balances |

### External Dependencies

| Dependency        | Type           | Purpose                             |
| ----------------- | -------------- | ----------------------------------- |
| `system_settings` | Database       | Stores configurable exchange rate   |
| Redis/Cache       | Infrastructure | Caches exchange config (1 hour TTL) |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/exchange
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter    | Key              | Config                       |
| ---------- | ---------------- | ---------------------------- |
| `throttle` | User ID (10/min) | `throttle:10,1` (per minute) |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

_No request body required_ — This is a GET endpoint.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Exchange info retrieved",
  "data": {
    "coins_per_diamond": 1750, // int, exchange rate
    "is_enabled": true, // bool, feature toggle
    "user_coins_balance": 5000.0, // float, user's coins
    "user_diamonds_balance": 100 // int, user's diamonds
  },
  "meta": {
    "timestamp": "2026-02-02T19:41:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

#### ❌ Too Many Requests (429)

```json
{
  "message": "Too Many Attempts."
}
```

### HTTP Status Codes

| Code  | Condition                       |
| ----- | ------------------------------- |
| `200` | Exchange info retrieved         |
| `401` | Missing or invalid bearer token |
| `429` | Rate limit exceeded             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/exchange                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/exchange.php:19                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/', [ExchangeController::class, 'info'])                    │ │
│ │     ->name('user.exchange.info');                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Bearer token                    │
│   2. throttle:10,1 → Rate limits to 10 requests per minute                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest — Uses base Illuminate\Http\Request                          │
│ No request body validation needed for this GET endpoint                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ExchangeController.php            │
│ Method: info(Request $request)                                              │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call service to get exchange info                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $info = $this->exchangeService->getExchangeInfo($user);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($info, 'Exchange info retrieved');          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Economy/ExchangeService.php                              │
│ Method: getExchangeInfo(User $user)                                         │
│                                                                             │
│ STEP 1: Get exchange configuration (cached)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $config = $this->getExchangeConfig();                                   │ │
│ │                                                                         │ │
│ │ // getExchangeConfig() implementation:                                  │ │
│ │ return Cache::remember('exchange:config', 3600, function () {           │ │
│ │     return [                                                            │ │
│ │         'coins_per_diamond' => (int) $this->settingService              │ │
│ │             ->get('exchange.coins_per_diamond', 1750),                  │ │
│ │         'is_enabled' => (bool) $this->settingService                    │ │
│ │             ->get('exchange.enabled', true),                            │ │
│ │     ];                                                                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Merge config with user balances                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'coins_per_diamond' => $config['coins_per_diamond'],                │ │
│ │     'is_enabled' => $config['is_enabled'],                              │ │
│ │     'user_coins_balance' => (float) $user->coins,                       │ │
│ │     'user_diamonds_balance' => (int) $user->diamonds,                   │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: SystemSettingService                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/SystemSettingService.php                 │ │
│ │ Responsibility: Retrieves system settings from database with caching   │ │
│ │ Reusable: YES (used across entire application)                          │ │
│ │ Why It Exists: Centralized settings management with caching             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • get($key, $default) → retrieves setting value from DB/cache        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User Model                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: Provides user's coin and diamond balances               │ │
│ │ Reusable: YES (core application model)                                  │ │
│ │ Why It Exists: Central user entity with financial attributes            │ │
│ │                                                                         │ │
│ │ Key Properties (casted):                                                │ │
│ │   • coins    → decimal:4 (user's coin balance)                          │ │
│ │   • diamonds → decimal:4 (user's diamond balance)                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse Utility                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent API response structure with metadata          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → returns {"status":"success",...}         │ │
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
│ 1. READ: User record (already loaded by auth middleware)                    │
│    Source: auth:sanctum middleware                                          │
│                                                                             │
│ 2. READ: System settings (only if cache miss)                               │
│    Query: SELECT * FROM system_settings WHERE key IN (...)                  │
│    Source: SystemSettingService::get()                                      │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET: 'exchange:config' (TTL: 3600s / 1 hour)                             │
│    Source: ExchangeService::getExchangeConfig()                             │
│    On miss: Fetches from database and caches                                │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ None — This is a read-only endpoint                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Exchange info retrieved',                             │ │
│ │     'data' => [                                                         │ │
│ │         'coins_per_diamond' => 1750,        // from config              │ │
│ │         'is_enabled' => true,               // from config              │ │
│ │         'user_coins_balance' => 5000.0000,  // from User model          │ │
│ │         'user_diamonds_balance' => 100,     // from User model          │ │
│ │     ],                                                                  │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => '2026-02-02T19:41:00.000000Z',                   │ │
│ │         'correlation_id' => 'uuid',                                     │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                           200 + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                       | Used By Endpoints        | Reusable | Reasoning                                  |
| -------------------------- | ------------------------ | -------- | ------------------------------------------ |
| `ExchangeController.php`   | user/exchange (GET/POST) | ⭕       | Partially reusable within exchange feature |
| `ExchangeService.php`      | user/exchange (GET/POST) | ✅       | Core exchange logic, can be used elsewhere |
| `SystemSettingService.php` | Many endpoints           | ✅       | App-wide settings management               |
| `User.php`                 | All authenticated        | ✅       | Core user model                            |
| `ApiResponse.php`          | All API endpoints        | ✅       | Standardized response utility              |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

_None_ — This endpoint has no request body validation.

### Business Logic Errors (400)

_None_ — This is a read-only endpoint with no business logic errors.

### System Errors (500)

| Error                     | Source               | Condition                        |
| ------------------------- | -------------------- | -------------------------------- |
| Database connection error | SystemSettingService | Cannot connect to database       |
| Cache failure             | ExchangeService      | Redis unavailable (fallback: DB) |

### Edge Cases

| Case               | Behavior                                              |
| ------------------ | ----------------------------------------------------- |
| No settings in DB  | Uses defaults: 1750 coins/diamond, enabled = true     |
| User has 0 balance | Returns 0 for both balances (valid response)          |
| Cache miss         | Fetches from DB, caches for 1 hour                    |
| Exchange disabled  | `is_enabled: false` (client should check before POST) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER              EXCHANGE SERVICE         SYSTEM SETTINGS        CACHE
    │                     │                       │                        │                        │                  │
    │  GET /user/exchange │                       │                        │                        │                  │
    │────────────────────▶│                       │                        │                        │                  │
    │                     │                       │                        │                        │                  │
    │                     │ 1. auth:sanctum       │                        │                        │                  │
    │                     │   (validate token)    │                        │                        │                  │
    │                     │──────────────────────▶│                        │                        │                  │
    │                     │                       │                        │                        │                  │
    │                     │                       │ 2. getExchangeInfo()   │                        │                  │
    │                     │                       │───────────────────────▶│                        │                  │
    │                     │                       │                        │                        │                  │
    │                     │                       │                        │ 3. Cache::remember()   │                  │
    │                     │                       │                        │ 'exchange:config'      │                  │
    │                     │                       │                        │────────────────────────────────────────────▶│
    │                     │                       │                        │                        │                  │
    │                     │                       │                        │                        │ (HIT: return)    │
    │                     │                       │                        │◀────────────────────────────────────────────│
    │                     │                       │                        │                        │                  │
    │                     │                       │                        │   (MISS: query DB)     │                  │
    │                     │                       │                        │───────────────────────▶│                  │
    │                     │                       │                        │◀───────────────────────│                  │
    │                     │                       │                        │                        │                  │
    │                     │                       │ 4. return [config +    │                        │                  │
    │                     │                       │    user balances]      │                        │                  │
    │                     │                       │◀───────────────────────│                        │                  │
    │                     │                       │                        │                        │                  │
    │                     │ 5. ApiResponse::success                        │                        │                  │
    │                     │◀──────────────────────│                        │                        │                  │
    │◀────────────────────│                       │                        │                        │                  │
    │                     │                       │                        │                        │                  │
    │  200 + JSON         │                       │                        │                        │                  │
    │                     │                       │                        │                        │                  │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                                          |
| --------------------- | ------------------------------------------------- |
| New response field    | `ExchangeService::getExchangeInfo()` return array |
| New exchange setting  | Add to `getExchangeConfig()` + system_settings    |
| Additional auth check | Controller or new middleware                      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                       | What to Change                     |
| ----- | ------------------------------------------ | ---------------------------------- |
| **1** | `app/Services/Economy/ExchangeService.php` | Add field to `getExchangeInfo()`   |
| **2** | (Optional) User model or other source      | If field comes from another source |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                       | What to Change                    |
| ----- | ------------------------------------------ | --------------------------------- |
| **1** | `app/Services/Economy/ExchangeService.php` | Remove from `getExchangeInfo()`   |
| **2** | Update API consumers                       | Ensure clients don't depend on it |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────┐
│   system_settings DB     │
│ exchange.coins_per_diamond│
│ exchange.enabled         │
└───────────┬──────────────┘
            │ cached
            ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│   ExchangeService        │       │      User Model          │
│   getExchangeConfig()    │       │   coins, diamonds        │
└───────────┬──────────────┘       └───────────┬──────────────┘
            │                                   │
            └───────────────┬───────────────────┘
                            ▼
              ┌──────────────────────────┐
              │  getExchangeInfo()       │
              │  (combines both sources) │
              └───────────┬──────────────┘
                          ▼
              ┌──────────────────────────┐
              │  ApiResponse::success()  │
              │  (final JSON structure)  │
              └──────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                          |
| --------------------------- | ----------------------------------------------- |
| `ApiResponse` structure     | Breaking change for all API consumers           |
| Cache key `exchange:config` | Used by POST endpoint too; coordinate changes   |
| User balance column types   | Financial precision depends on `decimal:4` cast |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                       |
| -------------------------------------- | ------------------------------------------------ |
| Changing field names in response       | Check mobile app compatibility first             |
| Removing cache without updating POST   | Both endpoints share `exchange:config` cache key |
| Forgetting default values for settings | Always provide defaults in `get()` calls         |
| Not casting user balances              | Ensure proper type in response (float/int)       |

### 📁 File Locations Quick Reference

```
routes/api/exchange.php                           ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── ExchangeController.php                      ← Controller
app/Services/Economy/
  └── ExchangeService.php                         ← Business logic & caching
app/Services/Progression/
  └── SystemSettingService.php                    ← System settings access
app/Models/User/
  └── User.php                                    ← User model (coins, diamonds)
app/Http/Utils/
  └── ApiResponse.php                             ← Response formatter
```

---

## Document Metadata

| Property            | Value                       |
| ------------------- | --------------------------- |
| **Endpoint**        | `GET /api/v1/user/exchange` |
| **Domain**          | Economy                     |
| **Author**          | System Documentation        |
| **Created**         | 2026-02-02                  |
| **Laravel Version** | 12.x                        |
| **PHP Version**     | 8.4                         |
