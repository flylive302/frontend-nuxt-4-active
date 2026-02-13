# GET /api/v1/gifts/categories

> **Domain**: Gift  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Gift Categories endpoint retrieves all distinct gift categories with their respective counts. Used by frontends to populate category filter dropdowns and display category badges.

### Responsibilities

- Return distinct categories from active gifts
- Provide count of gifts per category
- Cache results for optimal performance

### What It Owns

| Owned                | Description                            |
| -------------------- | -------------------------------------- |
| Category aggregation | Groups gifts by category and counts    |
| Category cache       | Maintains `gifts:categories` cache key |

### External Dependencies

| Dependency | Type           | Purpose                                      |
| ---------- | -------------- | -------------------------------------------- |
| Redis      | Infrastructure | Cache storage for category data (1 hour TTL) |
| MySQL      | Database       | `gifts` table for category data              |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/gifts/categories
```

### Authentication

❌ **None Required** - Public endpoint

### Rate Limiting

| Limiter | Key      | Config                     |
| ------- | -------- | -------------------------- |
| Global  | IP-based | Laravel default throttling |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Request Body Schema

```
None - GET request with no body
```

### Query Parameters

```
None - No parameters accepted
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "categories": [
      {
        "name": "string", // Category name (e.g., "Luxury", "Fun", "Romantic")
        "count": "integer" // Number of active gifts in this category
      }
    ]
  },
  "meta": {
    "timestamp": "2026-02-02T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field                | Type      | Description                       |
| -------------------- | --------- | --------------------------------- |
| `categories`         | `array`   | Array of category objects         |
| `categories[].name`  | `string`  | Category identifier/name          |
| `categories[].count` | `integer` | Count of active gifts in category |

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "...",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Categories retrieved successfully |
| `500` | Database/cache connection failure |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/gifts/categories                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/gifts.php:22                                               │
│ Route: Route::get('/categories', [GiftController::class, 'categories'])     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. None - Public endpoint with no middleware                              │
│                                                                             │
│ Route registered via:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('gifts')->group(function () {                             │ │
│ │     // ...                                                              │ │
│ │     Route::get('/categories', [GiftController::class, 'categories']);   │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest - Controller method executes directly                        │
│ No request validation required (no input parameters)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Gift/GiftController.php:84-97             │
│ Method: categories(): JsonResponse                                          │
│                                                                             │
│ STEP 1: Check cache for existing category data                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $categories = Cache::remember(                                          │ │
│ │     'gifts:categories',                                                  │ │
│ │     config('cache.ttl.medium'),  // 3600 seconds = 1 hour               │ │
│ │     function () {                                                        │ │
│ │         // Closure executed only on cache miss                          │ │
│ │     }                                                                    │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: On cache miss - query database for categories                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return Gift::query()                                                     │ │
│ │     ->where('is_active', true)                                          │ │
│ │     ->selectRaw('category as name, COUNT(*) as count')                   │ │
│ │     ->groupBy('category')                                                │ │
│ │     ->orderBy('category')                                                │ │
│ │     ->get()                                                              │ │
│ │     ->toArray();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return response with categories                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(['categories' => $categories]);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No service layer - Direct controller implementation                         │
│ Logic is simple enough to remain in controller                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Gift (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Gift/Gift.php                                          │ │
│ │ Responsibility: Eloquent model for gifts table                          │ │
│ │ Reusable: YES (used by all gift endpoints)                              │ │
│ │ Why It Exists: Data access layer for gift entities                      │ │
│ │                                                                         │ │
│ │ Relevant Properties:                                                    │ │
│ │   • category (string) → Gift category classification                   │ │
│ │   • is_active (bool) → Whether gift is available                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure across API                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data) → Wraps data in standard success envelope           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET/SET: 'gifts:categories' (TTL: 3600s / 1 hour)                        │
│    Source: GiftController::categories()                                     │
│    Driver: Redis (config/cache.php → default: redis)                        │
│                                                                             │
│ DATABASE OPERATIONS (on cache miss only):                                   │
│                                                                             │
│ 1. SELECT: Get distinct categories with counts                              │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ SELECT category as name, COUNT(*) as count                            ││
│    │ FROM gifts                                                            ││
│    │ WHERE is_active = 1                                                   ││
│    │ GROUP BY category                                                     ││
│    │ ORDER BY category                                                     ││
│    └───────────────────────────────────────────────────────────────────────┘│
│    Source: GiftController::categories()                                     │
│    Table: gifts                                                             │
│    Index Used: idx_gifts_category (recommended)                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ Response built via ApiResponse::success():                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                                │ │
│ │     'status' => 'success',                                               │ │
│ │     'message' => 'Success',                                              │ │
│ │     'data' => ['categories' => $categories],                             │ │
│ │     'meta' => [                                                          │ │
│ │         'timestamp' => now()->toISOString(),                             │ │
│ │         'correlation_id' => /* from header or generated UUID */          │ │
│ │     ],                                                                   │ │
│ │ ], 200);                                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ No API Resource used - raw array directly from query                        │
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

| File                                                  | Used By Endpoints         | Reusable | Reasoning                                   |
| ----------------------------------------------------- | ------------------------- | -------- | ------------------------------------------- |
| `routes/api/gifts.php`                                | All gift endpoints        | ⭕       | Route file, extend only                     |
| `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Gift domain only          | ⭕       | Controller, methods are endpoint-specific   |
| `app/Models/Gift/Gift.php`                            | All gift-related features | ✅       | Core model, highly reusable                 |
| `app/Http/Utils/ApiResponse.php`                      | All API endpoints         | ✅       | Shared utility, do not modify per-endpoint  |
| `config/cache.php`                                    | Entire application        | ✅       | Centralized cache config, TTL values shared |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                   |
| ----- | ------ | ------------------------------------------- |
| N/A   | N/A    | No input validation - no request parameters |

### Business Logic Errors (400)

| Error | Source | Condition                         |
| ----- | ------ | --------------------------------- |
| N/A   | N/A    | No business logic errors possible |

### System Errors (500)

| Error            | Source            | Condition                         |
| ---------------- | ----------------- | --------------------------------- |
| Database failure | `Gift::query()`   | MySQL connection lost             |
| Cache failure    | `Cache::remember` | Redis unavailable (falls through) |

### Edge Cases

| Case                  | Behavior                                         |
| --------------------- | ------------------------------------------------ |
| No gifts in database  | Returns empty `categories: []` array             |
| All gifts inactive    | Returns empty `categories: []` array             |
| Some categories empty | Categories with 0 active gifts not returned      |
| Cache expired         | Rebuilds from database, re-caches                |
| Redis unavailable     | May fall back to file/array cache or throw 500   |
| New category added    | Visible after cache expires (up to 1 hour delay) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                                    CONTROLLER                         CACHE (Redis)                    DATABASE (MySQL)
    │                                           │                                   │                                 │
    │  GET /api/v1/gifts/categories             │                                   │                                 │
    │──────────────────────────────────────────▶│                                   │                                 │
    │                                           │                                   │                                 │
    │                                           │ 1. Cache::remember()              │                                 │
    │                                           │──────────────────────────────────▶│                                 │
    │                                           │                                   │                                 │
    │                                           │   [CACHE HIT]                     │                                 │
    │                                           │◀──────────────────────────────────│                                 │
    │                                           │   Returns cached array            │                                 │
    │                                           │                                   │                                 │
    │                                           │   [CACHE MISS]                    │                                 │
    │                                           │                                   │                                 │
    │                                           │ 2. Gift::query()->groupBy()       │                                 │
    │                                           │─────────────────────────────────────────────────────────────────────▶│
    │                                           │                                   │                                 │
    │                                           │◀─────────────────────────────────────────────────────────────────────│
    │                                           │   Returns category rows           │                                 │
    │                                           │                                   │                                 │
    │                                           │ 3. Store in cache                 │                                 │
    │                                           │──────────────────────────────────▶│                                 │
    │                                           │                                   │                                 │
    │                                           │ 4. ApiResponse::success()         │                                 │
    │                                           │                                   │                                 │
    │◀──────────────────────────────────────────│                                   │                                 │
    │   200 + JSON response                     │                                   │                                 │
    │                                           │                                   │                                 │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                                                         |
| --------------------- | ---------------------------------------------------------------- |
| New category metadata | Add columns to `gifts` table, update query in controller         |
| Category icons/images | Add to query select, or create dedicated `gift_categories` table |
| Category descriptions | Create `gift_categories` lookup table                            |
| Subcategory support   | Already exists in Gift model (`subcategory` field)               |
| Category filtering    | Already available via `index` endpoint                           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO CATEGORY RESPONSE

| Step  | File                                                  | What to Change                                  |
| ----- | ----------------------------------------------------- | ----------------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Modify `selectRaw()` to include new aggregate   |
| **2** | Clear cache                                           | Run `php artisan cache:forget gifts:categories` |

**Example: Adding average price per category**

```php
// In GiftController::categories()
return Gift::query()
    ->where('is_active', true)
    ->selectRaw('category as name, COUNT(*) as count, AVG(price) as avg_price')
    ->groupBy('category')
    ->orderBy('category')
    ->get()
    ->toArray();
```

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                  | What to Change                                  |
| ----- | ----------------------------------------------------- | ----------------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Remove from `selectRaw()`                       |
| **2** | Clear cache                                           | Run `php artisan cache:forget gifts:categories` |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CATEGORY DATA FLOW                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   gifts.category (DB)                                                        │
│          │                                                                   │
│          ▼                                                                   │
│   Gift::query()->groupBy('category')                                         │
│          │                                                                   │
│          ▼                                                                   │
│   Cache::remember('gifts:categories')                                        │
│          │                                                                   │
│          ▼                                                                   │
│   ApiResponse::success(['categories' => ...])                                │
│          │                                                                   │
│          ▼                                                                   │
│   JSON Response                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Cache Invalidation Checklist

When gift data changes that affects categories:

- [ ] When a gift's `is_active` status changes
- [ ] When a gift's `category` is modified
- [ ] When a gift is created/deleted

**Invalidation command:**

```bash
php artisan cache:forget gifts:categories
```

**Or in code:**

```php
Cache::forget('gifts:categories');
```

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `ApiResponse::success()`     | Shared by all endpoints, changes affect entire API         |
| Cache key `gifts:categories` | Must match everywhere categories are cached/invalidated    |
| Response structure           | Mobile apps may depend on exact `name`/`count` field names |
| TTL configuration            | Affects all features using `cache.ttl.medium`              |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                                    |
| ----------------------------------- | ------------------------------------------------------------- |
| Stale categories after gift changes | Implement cache invalidation on gift create/update/delete     |
| Missing categories for new gifts    | Ensure cache is cleared when adding gifts with new categories |
| Changed cache key naming            | Use constants for cache keys across application               |
| Inconsistent category naming        | Validate/normalize category values at gift creation           |
| Query without `is_active` filter    | Always use the `is_active` condition to exclude hidden gifts  |

### 📁 File Locations Quick Reference

```
routes/api/gifts.php                               ← Route definition (line 22)
app/Http/Controllers/Api/V1/Gift/
  └── GiftController.php                           ← Controller (categories method: 84-97)
app/Models/Gift/
  └── Gift.php                                     ← Eloquent model
app/Http/Utils/
  └── ApiResponse.php                              ← Response utility
config/
  └── cache.php                                    ← Cache TTL configuration (ttl.medium)
```

---

## Document Metadata

| Property            | Value                          |
| ------------------- | ------------------------------ |
| **Endpoint**        | `GET /api/v1/gifts/categories` |
| **Domain**          | Gift                           |
| **Author**          | System Documentation           |
| **Created**         | 2026-02-02                     |
| **Laravel Version** | 12.x                           |
| **PHP Version**     | 8.4                            |
