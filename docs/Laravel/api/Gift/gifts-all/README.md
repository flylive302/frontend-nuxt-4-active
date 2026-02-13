# GET /api/v1/gifts/all

> **Domain**: Gift  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Returns a complete list of all active gifts in a single request, optimized for initial client-side cache population or small catalogs where virtual scrolling is unnecessary.

### Responsibilities

- Return all active gifts in a single response (no pagination)
- Cache the complete gift catalog for performance optimization
- Filter gifts by availability dates and active status
- Transform gift data using GiftResource for consistent API response format

### What It Owns

| Owned                 | Description                                           |
| --------------------- | ----------------------------------------------------- |
| Full catalog response | Returns entire active gift catalog in one request     |
| Catalog caching       | Manages cache key `gifts:catalog:all` with medium TTL |

### External Dependencies

| Dependency | Type           | Purpose                                   |
| ---------- | -------------- | ----------------------------------------- |
| Redis      | Infrastructure | Cache storage for `gifts:catalog:all` key |
| MySQL      | Database       | Source of truth for gifts table           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/gifts/all
```

### Authentication

❌ **None Required** - Public endpoint accessible without authentication

### Rate Limiting

| Limiter | Key      | Config  |
| ------- | -------- | ------- |
| Global  | IP-based | Default |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Request Body Schema

```
No request body required (GET request)
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "gifts": [
      {
        "id": "integer", // Gift unique identifier
        "name": "string", // Internal name (e.g., "rose_gift")
        "label": "string|null", // Display label (e.g., "Rose")
        "description": "string|null", // Gift description
        "price": "float", // Cost in coins (e.g., 100.00)
        "thumbnail_url": "string", // Proxied thumbnail URL
        "animation_url": "string|null", // Raw animation URL (for frontend)
        "asset_type": "string", // Enum: "image", "lottie", "gif", "video"
        "is_animated": "boolean", // Whether gift has animation
        "category": "string", // Category name (e.g., "Standard", "Premium")
        "rarity": "string", // Rarity level (e.g., "common", "rare")
        "sort_order": "integer" // Display ordering
      }
    ],
    "total": "integer" // Total count of gifts returned
  },
  "meta": {
    "timestamp": "2026-02-02T21:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T21:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                        |
| ----- | -------------------------------- |
| `200` | Success - gifts catalog returned |
| `500` | Database/cache connection error  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/gifts/all                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api.php:16                                                     │
│ Route prefix: /api/v1                                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('v1')->group(function () {                                │ │
│ │     require __DIR__ . '/api/gifts.php';                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ File: routes/api/gifts.php:25                                               │
│ Route: Route::get('/all', [GiftController::class, 'all'])                   │
│                                                                             │
│ Middleware Chain: None (public endpoint)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest validation required - endpoint has no input parameters.     │
│ Execution proceeds directly to controller.                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Gift/GiftController.php:117-143           │
│ Method: all()                                                               │
│                                                                             │
│ STEP 1: Check cache and retrieve/build gift catalog                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $gifts = Cache::remember(                                               │ │
│ │     'gifts:catalog:all',                                                │ │
│ │     config('cache.ttl.medium'),  // 1 hour (3600 seconds)              │ │
│ │     function () {                                                       │ │
│ │         return Gift::active()                                           │ │
│ │             ->select([...fields...])                                    │ │
│ │             ->orderBy('sort_order')                                     │ │
│ │             ->get();                                                    │ │
│ │     }                                                                   │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return response with gift collection and total count               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'gifts' => GiftResource::collection($gifts),                        │ │
│ │     'total' => $gifts->count(),                                         │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint has NO dedicated service layer - business logic is minimal   │
│ and handled directly in the controller via Cache::remember() pattern.      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Gift Model (Eloquent Model)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Gift/Gift.php                                          │ │
│ │ Responsibility: Data access and query scopes for gifts table            │ │
│ │ Reusable: YES (used by index, show, categories endpoints)               │ │
│ │ Why It Exists: Central data access for gift catalog                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopeActive() → Filters to is_active=true + date availability      │ │
│ │   • getFullThumbnailUrlAttribute() → Proxies thumbnail URL via /proxy  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: GiftAssetType Enum                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Gift/GiftAssetType.php                                  │ │
│ │ Responsibility: Defines allowed asset types (image, lottie, gif, video)│ │
│ │ Reusable: YES (used across gift domain)                                 │ │
│ │ Why It Exists: Type safety for asset_type field                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: GiftResource (API Resource)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Gift/GiftResource.php                       │ │
│ │ Responsibility: Transforms Gift model to API response format            │ │
│ │ Reusable: YES (used by index, show, all endpoints)                      │ │
│ │ Why It Exists: Consistent gift data serialization across endpoints     │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • id, name, label, description, price (cast to float)                │ │
│ │   • thumbnail_url → uses full_thumbnail_url accessor (proxied URL)     │ │
│ │   • animation_url → raw URL (frontend serves animation assets)         │ │
│ │   • asset_type → enum value extracted via ->value                       │ │
│ │   • is_animated, category, rarity, sort_order                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure across entire API         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Wraps data in {status, message, data, meta}            │ │
│ │   • getCorrelationId() → Generates/retrieves request tracking ID       │ │
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
│ 1. GET/SET: 'gifts:catalog:all' (TTL: 3600 seconds / 1 hour)               │
│    Source: GiftController::all()                                            │
│    Pattern: Cache::remember() - fetch from cache or compute & store         │
│                                                                             │
│ DATABASE OPERATIONS (only on cache miss):                                   │
│                                                                             │
│ 1. SELECT: Active gifts with selected fields                                │
│    Query:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT id, name, label, description, price, thumbnail_url,         │ │
│    │        animation_url, asset_type, is_animated, category,            │ │
│    │        rarity, sort_order                                           │ │
│    │ FROM gifts                                                          │ │
│    │ WHERE is_active = 1                                                 │ │
│    │   AND (available_from IS NULL OR available_from <= NOW())          │ │
│    │   AND (available_until IS NULL OR available_until >= NOW())        │ │
│    │ ORDER BY sort_order ASC                                             │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: Gift::active()->select([...])->orderBy('sort_order')->get()     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ STEP 1: Transform gift collection via GiftResource::collection()           │
│         - Each Gift model transformed using GiftResource::toArray()        │
│         - thumbnail_url uses getFullThumbnailUrlAttribute() accessor       │
│         - price cast to float, asset_type extracted as enum value          │
│                                                                             │
│ STEP 2: Wrap in ApiResponse::success()                                      │
│         - status: "success"                                                 │
│         - message: "Success"                                                │
│         - data: { gifts: [...], total: count }                              │
│         - meta: { timestamp, correlation_id }                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 + JSON Body                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                                  | Used By Endpoints                  | Reusable | Reasoning                                |
| ----------------------------------------------------- | ---------------------------------- | -------- | ---------------------------------------- |
| `app/Models/Gift/Gift.php`                            | index, show, all, categories, send | ✅       | Core gift data access model              |
| `app/Http/Resources/V1/Gift/GiftResource.php`         | index, show, all                   | ✅       | Standard gift response transformation    |
| `app/Http/Utils/ApiResponse.php`                      | All API endpoints                  | ✅       | Global response formatting utility       |
| `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Gift domain endpoints only         | ⭕       | Controller methods are endpoint-specific |
| `app/Enums/Gift/GiftAssetType.php`                    | All gift operations                | ✅       | Enum defining gift asset types           |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                        |
| ----- | ------ | -------------------------------- |
| None  | N/A    | Endpoint has no input validation |

### Business Logic Errors (400)

| Error | Source | Condition                                     |
| ----- | ------ | --------------------------------------------- |
| None  | N/A    | No business logic validation in this endpoint |

### System Errors (500)

| Error                   | Source   | Condition                           |
| ----------------------- | -------- | ----------------------------------- |
| "Internal server error" | Database | MySQL connection failure            |
| "Internal server error" | Cache    | Redis connection failure during GET |

### Edge Cases

| Case                     | Behavior                                          |
| ------------------------ | ------------------------------------------------- |
| No active gifts          | Returns `{ gifts: [], total: 0 }` with 200 status |
| Cache expired            | Database query executed, result cached for 1 hour |
| Cache unavailable        | Falls through to database query (no error)        |
| Gift with null animation | `animation_url` returns as `null` in response     |
| Gift with expired dates  | Excluded by `active()` scope automatically        |
| Gift with future dates   | Excluded by `active()` scope automatically        |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                CONTROLLER             CACHE (Redis)           DATABASE (MySQL)
   │                       │                       │                        │
   │  GET /gifts/all       │                       │                        │
   │──────────────────────▶│                       │                        │
   │                       │                       │                        │
   │                       │ 1. Check cache        │                        │
   │                       │   'gifts:catalog:all' │                        │
   │                       │──────────────────────▶│                        │
   │                       │                       │                        │
   │                       │      [CACHE HIT]      │                        │
   │                       │◀──────────────────────│                        │
   │                       │    (return cached)    │                        │
   │                       │                       │                        │
   │                       │      [CACHE MISS]     │                        │
   │                       │◀──────────────────────│                        │
   │                       │                       │                        │
   │                       │ 2. Query active gifts │                        │
   │                       │───────────────────────────────────────────────▶│
   │                       │                       │                        │
   │                       │    (Gift collection)  │                        │
   │                       │◀───────────────────────────────────────────────│
   │                       │                       │                        │
   │                       │ 3. Store in cache     │                        │
   │                       │   (TTL: 1 hour)       │                        │
   │                       │──────────────────────▶│                        │
   │                       │                       │                        │
   │                       │ 4. Transform via      │                        │
   │                       │    GiftResource       │                        │
   │                       │                       │                        │
   │                       │ 5. Wrap in            │                        │
   │                       │    ApiResponse        │                        │
   │                       │                       │                        │
   │  200 + JSON           │                       │                        │
   │◀──────────────────────│                       │                        │
   │                       │                       │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                              |
| -------------------------- | ----------------------------------------------------- |
| New gift field in response | `GiftResource::toArray()` + select list in controller |
| New filter parameter       | Add to controller method + update cache key strategy  |
| Change cache duration      | `config/cache.php` TTL settings or inline duration    |
| New gift scope             | `Gift` model + update controller query                |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                  | What to Change                                   |
| ----- | ----------------------------------------------------- | ------------------------------------------------ |
| **1** | **Database Migration**                                | Add column to `gifts` table                      |
| **2** | `app/Models/Gift/Gift.php`                            | Add to `$fillable` array                         |
| **3** | `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Add field to `select([...])` array               |
| **4** | `app/Http/Resources/V1/Gift/GiftResource.php`         | Add field to `toArray()` return                  |
| **5** | **Clear cache**                                       | Run `php artisan cache:forget gifts:catalog:all` |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                  | What to Change                                   |
| ----- | ----------------------------------------------------- | ------------------------------------------------ |
| **1** | `app/Http/Resources/V1/Gift/GiftResource.php`         | Remove from `toArray()` return                   |
| **2** | `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Remove from `select([...])` array (optional)     |
| **3** | **Clear cache**                                       | Run `php artisan cache:forget gifts:catalog:all` |

### 🔗 Field Flow Dependency Chain

```
┌─────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Database   │───▶│  Gift Model   │───▶│  Controller   │───▶│ GiftResource  │
│  (gifts)    │    │  (select)     │    │  (select[])   │    │  (toArray)    │
└─────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
                          │                     │                     │
                          │                     │                     │
                   Field must exist      Field must be         Field mapped
                   in $fillable          in select array       for API output
```

### 📋 Field Modification Checklist

- [ ] Update database schema if adding new field
- [ ] Update Gift model `$fillable` array
- [ ] Update controller `select()` to include field
- [ ] Update GiftResource `toArray()` for response
- [ ] Clear cache: `php artisan cache:forget gifts:catalog:all`
- [ ] Update API documentation (this file)
- [ ] Test with cleared cache to verify changes

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                              |
| ----------------------------- | --------------------------------------------------- |
| Cache key `gifts:catalog:all` | Other services may depend on this key               |
| `scopeActive()` logic         | Core filtering logic used across all gift endpoints |
| `GiftResource` structure      | Frontend depends on stable response structure       |
| `ApiResponse` format          | Breaking change affects all API consumers           |
| TTL configuration             | Affects cache invalidation strategy across system   |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                                |
| ------------------------------------ | --------------------------------------------------------- |
| Adding field but forgetting select() | Always add to both select array AND resource              |
| Cache returning stale data           | Clear cache after any gift data changes                   |
| Missing field in resource            | Check GiftResource when debugging missing response fields |
| Forgetting to clear cache            | Automate cache clearing in gift update workflows          |
| Adding heavy computed fields         | Avoid adding computed accessors to cached collections     |

### 📁 File Locations Quick Reference

```
routes/api/gifts.php                                ← Route definition (line 25)
app/Http/Controllers/Api/V1/Gift/
  └── GiftController.php                            ← Controller (all method: 117-143)
app/Models/Gift/
  └── Gift.php                                      ← Model + scopeActive()
app/Http/Resources/V1/Gift/
  └── GiftResource.php                              ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                               ← Response wrapper utility
app/Enums/Gift/
  └── GiftAssetType.php                             ← Asset type enum
config/cache.php                                    ← Cache TTL configuration
```

---

## Document Metadata

| Property            | Value                   |
| ------------------- | ----------------------- |
| **Endpoint**        | `GET /api/v1/gifts/all` |
| **Domain**          | Gift                    |
| **Author**          | System Documentation    |
| **Created**         | 2026-02-02              |
| **Laravel Version** | 12.x                    |
| **PHP Version**     | 8.4                     |
