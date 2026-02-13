# GET /api/internal/gifts/active

> **Domain**: Gift  
> **Type**: Internal (Microservice) Endpoint  
> **Version**: Internal  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Returns the full catalog of active gifts for the MSAB Audio Server to cache locally. This endpoint is used by internal microservices only and is protected by an internal API key.

### Responsibilities

- Authenticate requests via internal API key (`X-Internal-Key` header)
- Return all currently active gifts with caching (60 second TTL)
- Provide gift data for Audio Server to validate gift transactions in real-time

### What It Owns

| Owned              | Description                           |
| ------------------ | ------------------------------------- |
| Gift catalog cache | Maintains 60s cached gift list        |
| Active gift filter | Filters by is_active and availability |

### External Dependencies

| Dependency    | Type           | Purpose                                    |
| ------------- | -------------- | ------------------------------------------ |
| Redis Cache   | Infrastructure | Cache gift catalog for 60 seconds          |
| MySQL `gifts` | Database       | Source of truth for gift data              |
| MSAB Server   | Microservice   | Consumer of this endpoint for gift catalog |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/internal/gifts/active
```

### Authentication

✅ **Required** - Internal API Key via `X-Internal-Key` header

> [!IMPORTANT]  
> This is NOT a public endpoint. It uses internal microservice authentication via the `X-Internal-Key` header, not Sanctum tokens.

### Rate Limiting

| Limiter        | Key                         | Config                               |
| -------------- | --------------------------- | ------------------------------------ |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests per minute per service |

### Request Headers

| Header           | Required | Type               | Description                   |
| ---------------- | -------- | ------------------ | ----------------------------- |
| `Accept`         | ✅       | `application/json` | Response format               |
| `X-Internal-Key` | ✅       | `string`           | Internal microservice API key |

### Request Body Schema

```json
(No request body required - GET request)
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "gifts": [
    {
      "id": "integer", // Gift ID
      "name": "string", // Gift name
      "label": "string|null", // Display label
      "description": "string|null", // Gift description
      "price": "decimal(10,2)", // Price in coins
      "thumbnail_url": "string", // Thumbnail image path
      "animation_url": "string|null", // Animation file path
      "sound_url": "string|null", // Sound file path
      "asset_type": "string", // video, svga, image
      "is_animated": "boolean", // Has animation
      "category": "string", // flowers, animals, etc.
      "subcategory": "string|null", // Sub-category
      "rarity": "string", // common, rare, epic, legendary
      "wealth_xp_multiplier": "decimal", // Sender XP multiplier
      "charm_xp_multiplier": "decimal", // Receiver XP multiplier
      "vip_level_required": "integer", // 0 = no VIP required
      "country_specific": "array|null", // Country restrictions
      "min_level_required": "integer", // Minimum user level
      "is_active": "boolean", // Always true (filtered)
      "is_featured": "boolean", // Featured gift flag
      "sort_order": "integer", // Display order
      "available_from": "datetime|null", // Start availability
      "available_until": "datetime|null", // End availability
      "total_sent": "integer", // Total times sent
      "total_revenue": "decimal", // Total revenue generated
      "popularity_score": "integer", // Popularity metric
      "created_at": "datetime", // Creation timestamp
      "updated_at": "datetime" // Last update timestamp
    }
  ]
}
```

#### ❌ Authentication Error (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

### HTTP Status Codes

| Code  | Condition                                       |
| ----- | ----------------------------------------------- |
| `200` | Success - gifts returned from cache or database |
| `403` | Missing or invalid `X-Internal-Key` header      |
| `500` | Database/cache error                            |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/internal/gifts/active                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:33                                            │
│ Route: Route::get('/gifts/active', [GiftController::class, 'active'])       │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth → Validates X-Internal-Key header                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('internal')->middleware([InternalAuth::class])->group(   │ │
│ │     function () {                                                      │ │
│ │         Route::get('/gifts/active', [GiftController::class, 'active']);│ │
│ │     }                                                                  │ │
│ │ );                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE: INTERNAL AUTHENTICATION                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/InternalAuth.php                                  │
│                                                                             │
│ Validates the X-Internal-Key header against config('services.msab.         │
│ internal_key'). Uses timing-safe comparison via hash_equals().              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $internalKey = $request->header('X-Internal-Key');                     │ │
│ │ $expectedKey = config('services.msab.internal_key');                   │ │
│ │                                                                        │ │
│ │ if ($internalKey === null || $expectedKey === null ||                  │ │
│ │     !hash_equals($expectedKey, $internalKey)) {                        │ │
│ │     return response()->json([                                          │ │
│ │         'message' => 'Unauthorized. Invalid internal key.',            │ │
│ │         'error_code' => 'INTERNAL_AUTH_FAILED',                        │ │
│ │     ], 403);                                                           │ │
│ │ }                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PASSES IF: Valid X-Internal-Key header matches config value                 │
│ FAILS IF: Missing header, null config, or key mismatch → 403               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER: active()                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:25-34                │
│ Method: active(): JsonResponse                                              │
│                                                                             │
│ STEP 1: Check cache for active gifts                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $gifts = Cache::remember('internal:gifts:active', 60, function () {    │ │
│ │     return Gift::active()                                              │ │
│ │         ->orderBy('price', 'asc')                                      │ │
│ │         ->get();                                                       │ │
│ │ });                                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return JSON response                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['gifts' => $gifts]);                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 MODEL SCOPE: Gift::active()                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Gift/Gift.php:102-111                                      │
│                                                                             │
│ Filters to only return gifts that are:                                      │
│   • is_active = true                                                        │
│   • available_from is NULL OR <= now()                                      │
│   • available_until is NULL OR >= now()                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function scopeActive(Builder $query): Builder                   │ │
│ │ {                                                                      │ │
│ │     return $query->where('is_active', true)                            │ │
│ │         ->where(function ($q) {                                        │ │
│ │             $q->whereNull('available_from')                            │ │
│ │               ->orWhere('available_from', '<=', now());                │ │
│ │         })                                                             │ │
│ │         ->where(function ($q) {                                        │ │
│ │             $q->whereNull('available_until')                           │ │
│ │               ->orWhere('available_until', '>=', now());               │ │
│ │         });                                                            │ │
│ │ }                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. [GET]: 'internal:gifts:active' (60 second TTL)                           │
│    Source: Controller::active()                                             │
│    Hit: Returns cached collection immediately                               │
│    Miss: Executes database query and caches result                          │
│                                                                             │
│ DATABASE OPERATIONS (on cache miss):                                        │
│                                                                             │
│ 1. [SELECT]: All active gifts ordered by price                              │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ SELECT * FROM gifts                                                   ││
│    │ WHERE is_active = 1                                                   ││
│    │   AND (available_from IS NULL OR available_from <= NOW())             ││
│    │   AND (available_until IS NULL OR available_until >= NOW())           ││
│    │ ORDER BY price ASC                                                    ││
│    └───────────────────────────────────────────────────────────────────────┘│
│    Source: Gift::active()->orderBy('price', 'asc')->get()                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response is a simple JSON wrapper around the Gift collection.               │
│ No Resource class is used - raw Eloquent models are serialized.             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['gifts' => $gifts]);                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: All Gift model attributes are included in the response.               │
│ The Gift model casts ensure proper type serialization.                      │
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

| File                                               | Used By Endpoints                                 | Reusable | Reasoning                                   |
| -------------------------------------------------- | ------------------------------------------------- | -------- | ------------------------------------------- |
| `app/Http/Middleware/InternalAuth.php`             | All `/api/internal/*` endpoints                   | ✅       | Generic internal auth for all microservices |
| `app/Http/Controllers/Internal/GiftController.php` | `/internal/gifts/active`, `/internal/gifts/batch` | ⭕       | Internal gift operations only               |
| `app/Models/Gift/Gift.php`                         | All gift endpoints (V1 + Internal)                | ✅       | Core Gift model used everywhere             |
| `Gift::scopeActive()`                              | `GET /gifts`, `GET /gifts/all`, this endpoint     | ✅       | Reusable scope for filtering active gifts   |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (403)

| Error                                 | Source         | Condition                                   |
| ------------------------------------- | -------------- | ------------------------------------------- |
| `Unauthorized. Invalid internal key.` | `InternalAuth` | Missing or invalid `X-Internal-Key` header  |
| `Unauthorized. Invalid internal key.` | `InternalAuth` | Config `services.msab.internal_key` not set |

### System Errors (500)

| Error                     | Source        | Condition                               |
| ------------------------- | ------------- | --------------------------------------- |
| Database connection error | `Gift::get()` | MySQL unavailable on cache miss         |
| Cache connection error    | `Cache`       | Redis unavailable (falls through to DB) |

### Edge Cases

| Case                         | Behavior                                        |
| ---------------------------- | ----------------------------------------------- |
| No active gifts in database  | Returns `{"gifts": []}` (empty array)           |
| All gifts have expired       | Returns empty array (filtered by availability)  |
| Cache key exists but expired | Re-fetches from database, caches new result     |
| Redis down, cache miss       | Queries database directly, no caching           |
| Gift activated mid-request   | Not visible until cache expires (60s max delay) |

---

## 6. Sequence Diagram (Textual)

```
 AUDIO SERVER           MIDDLEWARE              CONTROLLER                CACHE                DATABASE
    │                       │                       │                       │                       │
    │  GET /internal/       │                       │                       │                       │
    │  gifts/active         │                       │                       │                       │
    │  X-Internal-Key: xxx  │                       │                       │                       │
    │──────────────────────▶│                       │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 1. Validate           │                       │                       │
    │                       │    X-Internal-Key     │                       │                       │
    │                       │    vs config          │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 2. Auth passes        │                       │                       │
    │                       │──────────────────────▶│                       │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 3. Cache::remember()  │                       │
    │                       │                       │    'internal:gifts:   │                       │
    │                       │                       │     active'           │                       │
    │                       │                       │──────────────────────▶│                       │
    │                       │                       │                       │                       │
    │                       │                       │      [CACHE HIT]      │                       │
    │                       │                       │◀──────────────────────│                       │
    │                       │                       │    Return cached data │                       │
    │                       │                       │                       │                       │
    │                       │                       │      [CACHE MISS]     │                       │
    │                       │                       │                       │ 4. Gift::active()    │
    │                       │                       │                       │    ->orderBy('price')│
    │                       │                       │                       │    ->get()           │
    │                       │                       │                       │──────────────────────▶│
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │                       │                       │
    │                       │                       │                       │ 5. Store in cache    │
    │                       │                       │                       │    TTL: 60s          │
    │                       │                       │◀──────────────────────│                       │
    │                       │                       │                       │                       │
    │                       │                       │ 6. Build JSON         │                       │
    │                       │                       │    response           │                       │
    │                       │◀──────────────────────│                       │                       │
    │◀──────────────────────│                       │                       │                       │
    │                       │                       │                       │                       │
    │  200 OK + JSON        │                       │                       │                       │
    │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                            |
| ----------------------------- | --------------------------------------------------- |
| New filter criteria           | `Gift::scopeActive()` in `app/Models/Gift/Gift.php` |
| Response transformation       | Create `InternalGiftResource` if needed             |
| Modify cache TTL              | `GiftController::active()` - change `60` parameter  |
| Add new gift fields           | Migration + `Gift` model `$fillable` + `$casts`     |
| Additional internal endpoints | `routes/api/internal.php`                           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                       | What to Change                     |
| ----- | -------------------------- | ---------------------------------- |
| **1** | **Database Migration**     | Add column to `gifts` table        |
| **2** | `app/Models/Gift/Gift.php` | Add to `$fillable` array           |
| **3** | `app/Models/Gift/Gift.php` | Add to `$casts` if needed          |
| **4** | **(Optional)** Clear cache | Delete `internal:gifts:active` key |

> [!NOTE]  
> The response automatically includes all model attributes since no Resource class is used.

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                              | What to Change                    |
| ----- | --------------------------------- | --------------------------------- |
| **1** | Create `InternalGiftResource.php` | Explicitly define returned fields |
| **2** | `GiftController::active()`        | Use Resource instead of raw JSON  |

#### 🔧 MODIFYING CACHE BEHAVIOR

| Change           | Location                      | Code Change                        |
| ---------------- | ----------------------------- | ---------------------------------- |
| Change TTL       | `GiftController::active():27` | Modify `60` to desired seconds     |
| Change cache key | `GiftController::active():27` | Modify `'internal:gifts:active'`   |
| Disable caching  | `GiftController::active()`    | Remove `Cache::remember()` wrapper |

### 🔗 Field Flow Dependency Chain

```
                    ┌─────────────────────────────────────┐
                    │         DATABASE (gifts)            │
                    │   All columns in gifts table        │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │          Gift Model                 │
                    │   $fillable, $casts define schema   │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │      Gift::active() scope           │
                    │   Filters by is_active,             │
                    │   available_from, available_until   │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │     Redis Cache (60s TTL)           │
                    │   Key: internal:gifts:active        │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │        JSON Response                │
                    │   { "gifts": [...] }                │
                    └─────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                                   |
| --------------------------------- | -------------------------------------------------------- |
| `InternalAuth` middleware         | Security: protects all internal microservice endpoints   |
| `X-Internal-Key` header name      | MSAB Audio Server depends on this exact header name      |
| Cache key `internal:gifts:active` | Audio Server may rely on this key for cache invalidation |
| `scopeActive()` logic             | Affects all gift endpoints, not just this one            |
| Response structure `{gifts:[]}`   | Audio Server expects this exact structure                |

### 🚨 Common Pitfalls

| Pitfall                                            | Prevention                                           |
| -------------------------------------------------- | ---------------------------------------------------- |
| Changing response structure without notifying MSAB | Coordinate API changes with Audio Server team        |
| Forgetting to clear cache after gift updates       | Gift admin should bust `internal:gifts:active` cache |
| Setting TTL too high                               | Gifts may be stale; 60s is a reasonable balance      |
| Setting TTL too low                                | Increases database load during high traffic          |
| Modifying `scopeActive()` without testing          | Run tests: affects V1 public endpoints too           |
| Exposing internal endpoints publicly               | Never add public route aliases to internal routes    |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition (line 33)
app/Http/Middleware/
  └── InternalAuth.php                               ← Internal API key validation
app/Http/Controllers/Internal/
  └── GiftController.php                             ← Controller (active method: line 25-34)
app/Models/Gift/
  └── Gift.php                                       ← Model + scopeActive() (line 102-111)
config/services.php                                  ← services.msab.internal_key config
database/migrations/
  └── 2025_12_08_000001_create_gifts_table.php       ← Database schema
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `GET /api/internal/gifts/active` |
| **Domain**          | Gift                             |
| **Author**          | System Documentation             |
| **Created**         | 2026-02-02                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4                              |
