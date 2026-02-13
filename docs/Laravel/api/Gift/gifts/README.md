# GET /api/v1/gifts

> **Domain**: Gift  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Retrieves a paginated list of active gifts optimized for virtual scroll in the frontend gift catalog. Supports filtering by category and custom sorting.

### Responsibilities

- Return active gifts with cursor-based pagination for efficient virtual scroll
- Filter gifts by category
- Support multiple sorting options (sort_order, price, name, created_at)
- Apply availability window validation (available_from/available_until)

### What It Owns

| Owned                  | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| Gift catalog retrieval | Provides paginated gift data for frontend consumption      |
| Category filtering     | Filters gifts by category parameter                        |
| Cursor pagination      | Efficient pagination for large datasets and virtual scroll |

### External Dependencies

| Dependency | Type     | Purpose                                   |
| ---------- | -------- | ----------------------------------------- |
| MySQL      | Database | Gifts table storage                       |
| None       | -        | No services, cache, or external APIs used |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/gifts
```

### Authentication

❌ **None Required** - Public endpoint, no authentication needed

### Rate Limiting

| Limiter | Key | Config                   |
| ------- | --- | ------------------------ |
| None    | -   | No rate limiting applied |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Query Parameters

```json
{
  "per_page": "integer", // Optional, default 20, max 100
  "cursor": "string", // Optional, cursor for pagination
  "category": "string", // Optional, filter by category
  "sort_by": "string", // Optional, default "sort_order" (allowed: sort_order, price, name, created_at)
  "sort_dir": "string" // Optional, default "asc" (allowed: asc, desc)
}
```

#### Parameter Details

| Parameter  | Type     | Constraints                 | Example        |
| ---------- | -------- | --------------------------- | -------------- |
| `per_page` | `int`    | Optional, 1-100, default 20 | `50`           |
| `cursor`   | `string` | Optional, encoded cursor    | `eyJpZCI6MTB9` |
| `category` | `string` | Optional                    | `"romantic"`   |
| `sort_by`  | `string` | Optional, allowed values    | `"price"`      |
| `sort_dir` | `string` | Optional, asc/desc          | `"desc"`       |

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
        "id": 1,
        "name": "rose",
        "label": "Rose",
        "description": "A beautiful red rose",
        "price": 10.0,
        "thumbnail_url": "http://localhost/proxy/image/gifts/rose.png",
        "animation_url": "gifts/rose.svga",
        "asset_type": "svga",
        "is_animated": true,
        "category": "romantic",
        "rarity": "common",
        "sort_order": 1
      }
    ],
    "pagination": {
      "next_cursor": "eyJpZCI6MTB9",
      "prev_cursor": null,
      "per_page": 20,
      "has_more": true
    }
  },
  "meta": {
    "timestamp": "2026-02-02T20:53:30.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field           | Type      | Description                                     |
| --------------- | --------- | ----------------------------------------------- |
| `id`            | `int`     | Gift unique identifier                          |
| `name`          | `string`  | Gift internal name (slug-like)                  |
| `label`         | `string?` | Display name for the gift                       |
| `description`   | `string?` | Gift description                                |
| `price`         | `float`   | Price in coins                                  |
| `thumbnail_url` | `string`  | Proxied thumbnail URL (full URL via accessor)   |
| `animation_url` | `string?` | Raw animation URL (served from frontend assets) |
| `asset_type`    | `string`  | Asset format: `video`, `svga`, or `image`       |
| `is_animated`   | `bool`    | Whether the gift has animation                  |
| `category`      | `string`  | Gift category for filtering                     |
| `rarity`        | `string`  | Gift rarity level                               |
| `sort_order`    | `int`     | Display order position                          |

### HTTP Status Codes

| Code  | Condition                    |
| ----- | ---------------------------- |
| `200` | Gifts retrieved successfully |
| `500` | Database/server error        |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/gifts                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/gifts.php:19                                               │
│ Route: Route::get('/', [GiftController::class, 'index'])                    │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. api                → Stateless session, throttle:api                   │
│   2. SubstituteBindings → Parameter binding                                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('gifts')->group(function () {                             │ │
│ │     Route::get('/', [GiftController::class, 'index']);                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: No FormRequest validation - uses generic Request with inline checks  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Gift/GiftController.php:25-79            │
│ Method: index(Request $request)                                            │
│                                                                             │
│ STEP 1: Parse and validate query parameters                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $perPage = min((int) $request->input('per_page', 20), 100);             │ │
│ │ $category = $request->input('category');                                │ │
│ │ $sortBy = $request->input('sort_by', 'sort_order');                     │ │
│ │ $sortDir = $request->input('sort_dir', 'asc');                          │ │
│ │                                                                         │ │
│ │ // Validate sort options                                                │ │
│ │ $allowedSorts = ['sort_order', 'price', 'name', 'created_at'];          │ │
│ │ if (! in_array($sortBy, $allowedSorts, true)) {                         │ │
│ │     $sortBy = 'sort_order';                                             │ │
│ │ }                                                                       │ │
│ │ if (! in_array($sortDir, ['asc', 'desc'], true)) {                      │ │
│ │     $sortDir = 'asc';                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build query with active scope and field selection                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = Gift::active()                                                 │ │
│ │     ->select([                                                          │ │
│ │         'id', 'name', 'label', 'description', 'price',                  │ │
│ │         'thumbnail_url', 'animation_url', 'asset_type',                 │ │
│ │         'is_animated', 'category', 'rarity', 'sort_order',              │ │
│ │     ]);                                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Apply optional category filter                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($category !== null && $category !== '') {                           │ │
│ │     $query->where('category', $category);                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Apply sorting and cursor pagination                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query->orderBy($sortBy, $sortDir);                                     │ │
│ │ $gifts = $query->cursorPaginate($perPage);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 MODEL LAYER                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Gift Model (Eloquent Model)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Gift/Gift.php                                          │ │
│ │ Responsibility: Gift entity with active scope and URL accessors         │ │
│ │ Reusable: YES (used across gift endpoints and admin)                    │ │
│ │ Why It Exists: Encapsulates gift data and availability logic            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopeActive() → Filters active gifts within availability window     │ │
│ │   • getFullThumbnailUrlAttribute() → Proxied thumbnail URL              │ │
│ │   • getFullAnimationUrlAttribute() → Proxied animation URL              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: scopeActive() - Lines 102-111                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function scopeActive(Builder $query): Builder                    │ │
│ │ {                                                                       │ │
│ │     return $query->where('is_active', true)                             │ │
│ │         ->where(function ($q) {                                         │ │
│ │             $q->whereNull('available_from')                             │ │
│ │               ->orWhere('available_from', '<=', now());                 │ │
│ │         })                                                              │ │
│ │         ->where(function ($q) {                                         │ │
│ │             $q->whereNull('available_until')                            │ │
│ │               ->orWhere('available_until', '>=', now());                │ │
│ │         });                                                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ACCESSOR: getFullThumbnailUrlAttribute() - Lines 127-132                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getFullThumbnailUrlAttribute(): string                  │ │
│ │ {                                                                       │ │
│ │     $path = ltrim($this->thumbnail_url, '/');                           │ │
│ │     return url('/proxy/image/' . $path);                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (single query):                                         │
│                                                                             │
│ 1. SELECT (cursor paginated): Fetch active gifts                            │
│    Query pattern:                                                           │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ SELECT id, name, label, description, price, thumbnail_url,           ││
│    │        animation_url, asset_type, is_animated, category, rarity,     ││
│    │        sort_order                                                    ││
│    │ FROM gifts                                                           ││
│    │ WHERE is_active = 1                                                  ││
│    │   AND (available_from IS NULL OR available_from <= NOW())            ││
│    │   AND (available_until IS NULL OR available_until >= NOW())          ││
│    │   [AND category = ?]  -- if category filter provided                 ││
│    │ ORDER BY {sort_by} {sort_dir}                                        ││
│    │ LIMIT {per_page + 1}  -- extra row for has_more detection            ││
│    │ [WHERE id > ?]  -- if cursor provided                                ││
│    └───────────────────────────────────────────────────────────────────────┘│
│    Source: GiftController::index()                                          │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: GiftResource (API Resource)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Gift/GiftResource.php                       │ │
│ │ Responsibility: Transform Gift model to JSON response format            │ │
│ │ Reusable: YES (used by index, show, all, send endpoints)               │ │
│ │ Why It Exists: Consistent gift representation across all endpoints      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns formatted gift array                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Resource Transform: Lines 21-37                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function toArray(Request $request): array                        │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'id' => $this->id,                                              │ │
│ │         'name' => $this->name,                                          │ │
│ │         'label' => $this->label,                                        │ │
│ │         'description' => $this->description,                            │ │
│ │         'price' => (float) $this->price,                                │ │
│ │         'thumbnail_url' => $this->full_thumbnail_url,  // accessor      │ │
│ │         'animation_url' => $this->animation_url,       // raw URL       │ │
│ │         'asset_type' => $this->asset_type->value,      // enum value    │ │
│ │         'is_animated' => $this->is_animated,                            │ │
│ │         'category' => $this->category,                                  │ │
│ │         'rarity' => $this->rarity,                                      │ │
│ │         'sort_order' => $this->sort_order,                              │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: GiftAssetType (Enum)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Gift/GiftAssetType.php                                  │ │
│ │ Responsibility: Defines valid asset types (video, svga, image)          │ │
│ │ Reusable: YES (used across gift system)                                │ │
│ │ Why It Exists: Type-safe asset format identification                    │ │
│ │                                                                         │ │
│ │ Values: VIDEO = 'video', SVGA = 'svga', IMAGE = 'image'                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                              │ │
│ │ Why It Exists: Consistent API response structure with metadata          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Returns 200 OK with data and meta                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Gift/GiftController.php:70-78            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'gifts' => GiftResource::collection($gifts->items()),              │ │
│ │     'pagination' => [                                                   │ │
│ │         'next_cursor' => $gifts->nextCursor()?->encode(),              │ │
│ │         'prev_cursor' => $gifts->previousCursor()?->encode(),          │ │
│ │         'per_page' => $perPage,                                        │ │
│ │         'has_more' => $gifts->hasMorePages(),                          │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: Uses cursor pagination for efficient virtual scroll navigation        │
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

| File                                                  | Used By Endpoints                              | Reusable | Reasoning                                                         |
| ----------------------------------------------------- | ---------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `app/Models/Gift/Gift.php`                            | `/gifts`, `/gifts/all`, `/gifts/{id}`, `/send` | ✅       | Core gift entity used across all gift APIs                        |
| `app/Http/Resources/V1/Gift/GiftResource.php`         | `/gifts`, `/gifts/all`, `/gifts/{id}`, `/send` | ✅       | Standard gift JSON representation                                 |
| `app/Http/Utils/ApiResponse.php`                      | All API endpoints                              | ✅       | Global response utility                                           |
| `app/Enums/Gift/GiftAssetType.php`                    | Gift model, admin panel                        | ✅       | Enum shared across gift system                                    |
| `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Gift domain only                               | ⭕       | Controller logic endpoint-specific, index method reusable pattern |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                               |
| ----- | ------ | ------------------------------------------------------- |
| N/A   | -      | No FormRequest validation - parameters sanitized inline |

### Business Logic Errors (400)

| Error | Source | Condition                                     |
| ----- | ------ | --------------------------------------------- |
| N/A   | -      | No business logic errors - read-only endpoint |

### System Errors (500)

| Error                       | Source                 | Condition            |
| --------------------------- | ---------------------- | -------------------- |
| "Database connection error" | MySQL/Eloquent         | Database unreachable |
| "Query execution error"     | Gift::cursorPaginate() | Invalid query state  |

### Edge Cases

| Case                                   | Behavior                                   |
| -------------------------------------- | ------------------------------------------ |
| No active gifts exist                  | Returns empty array with `has_more: false` |
| Invalid `sort_by` value                | Falls back to default `sort_order`         |
| Invalid `sort_dir` value               | Falls back to default `asc`                |
| `per_page` > 100                       | Capped at 100                              |
| `per_page` <= 0                        | Uses minimum (cast to 0, may cause issues) |
| Non-existent category                  | Returns empty array                        |
| Expired gifts (`available_until` past) | Excluded by `scopeActive()`                |
| Future gifts (`available_from` future) | Excluded by `scopeActive()`                |
| Invalid cursor                         | Laravel throws cursor decode exception     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                  MIDDLEWARE              CONTROLLER            GIFT MODEL               DATABASE
   │                         │                       │                       │                       │
   │  GET /api/v1/gifts      │                       │                       │                       │
   │  ?per_page=20           │                       │                       │                       │
   │  &category=romantic     │                       │                       │                       │
   │────────────────────────▶│                       │                       │                       │
   │                         │                       │                       │                       │
   │                         │ 1. Route middleware   │                       │                       │
   │                         │    (api group)        │                       │                       │
   │                         │──────────────────────▶│                       │                       │
   │                         │                       │                       │                       │
   │                         │                       │ 2. Parse query params │                       │
   │                         │                       │    (per_page, sort,   │                       │
   │                         │                       │     category)         │                       │
   │                         │                       │                       │                       │
   │                         │                       │ 3. Gift::active()     │                       │
   │                         │                       │──────────────────────▶│                       │
   │                         │                       │                       │                       │
   │                         │                       │                       │ 4. SELECT with        │
   │                         │                       │                       │    active scope       │
   │                         │                       │                       │    + category filter  │
   │                         │                       │                       │   + cursorPaginate()  │
   │                         │                       │                       │──────────────────────▶│
   │                         │                       │                       │◀──────────────────────│
   │                         │                       │                       │                       │
   │                         │                       │◀──────────────────────│                       │
   │                         │                       │                       │                       │
   │                         │                       │ 5. GiftResource::     │                       │
   │                         │                       │    collection()       │                       │
   │                         │                       │    (transforms gifts) │                       │
   │                         │                       │                       │                       │
   │                         │                       │ 6. ApiResponse::      │                       │
   │                         │                       │    success()          │                       │
   │                         │                       │    (wrap with meta)   │                       │
   │                         │                       │                       │                       │
   │                         │◀──────────────────────│                       │                       │
   │◀────────────────────────│                       │                       │                       │
   │                         │                       │                       │                       │
   │  200 OK + JSON          │                       │                       │                       │
   │  {status, data, meta}   │                       │                       │                       │
   │                         │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition           | Location                                         |
| ------------------ | ------------------------------------------------ |
| New query filter   | `GiftController::index()` - add before orderBy() |
| New response field | `GiftResource::toArray()` + update select()      |
| New sort option    | `$allowedSorts` array in controller              |
| Cache layer        | Wrap query in `Cache::remember()` in controller  |
| Authentication     | Add `auth:sanctum` middleware to route           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                  | What to Change                        |
| ----- | ----------------------------------------------------- | ------------------------------------- |
| **1** | **Database Migration**                                | Add column if new DB field            |
| **2** | `app/Models/Gift/Gift.php`                            | Add to `$fillable` and `$casts`       |
| **3** | `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Add field to `select()` array         |
| **4** | `app/Http/Resources/V1/Gift/GiftResource.php`         | Add field to `toArray()` return array |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                  | What to Change                          |
| ----- | ----------------------------------------------------- | --------------------------------------- |
| **1** | `app/Http/Resources/V1/Gift/GiftResource.php`         | Remove from `toArray()` return array    |
| **2** | `app/Http/Controllers/Api/V1/Gift/GiftController.php` | Remove from `select()` array (optional) |
| **3** | **Database Migration**                                | Drop column if no longer needed         |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FIELD FLOW: Gift Response                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Database: gifts table]                                                    │
│         │                                                                   │
│         ▼                                                                   │
│  [Gift Model: $fillable, $casts]                                           │
│         │                                                                   │
│         ▼                                                                   │
│  [Controller: select() columns]  ◄─── MUST include field for query         │
│         │                                                                   │
│         ▼                                                                   │
│  [Model: Accessor (if needed)]   ◄─── full_thumbnail_url, etc.             │
│         │                                                                   │
│         ▼                                                                   │
│  [GiftResource::toArray()]       ◄─── Maps model to JSON                   │
│         │                                                                   │
│         ▼                                                                   │
│  [ApiResponse::success()]        ◄─── Wraps with status/meta               │
│         │                                                                   │
│         ▼                                                                   │
│  [HTTP Response: JSON body]                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                            |
| --------------------------- | ------------------------------------------------- |
| `Gift::scopeActive()`       | Affects gift visibility across entire system      |
| `GiftResource::toArray()`   | Changes affect all endpoints using this resource  |
| `ApiResponse::success()`    | Global utility - changes affect all API responses |
| Cursor pagination structure | Frontend depends on exact format                  |
| `thumbnail_url` accessor    | Proxied URL format expected by frontend           |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                          |
| -------------------------------------- | --------------------------------------------------- |
| Forgetting to add field to `select()`  | Always update select() when adding resource fields  |
| Changing sort column without index     | Ensure database index exists for sort columns       |
| Modifying cursor format                | Frontend virtual scroll depends on cursor stability |
| Removing `full_thumbnail_url` accessor | Frontend expects proxied URL format                 |
| Adding heavy computed fields           | Will slow down pagination - consider caching        |
| Not handling null `animation_url`      | Check for null in frontend display logic            |

### 📁 File Locations Quick Reference

```
routes/api/gifts.php                                 ← Route definition
app/Http/Controllers/Api/V1/Gift/
  └── GiftController.php                             ← Controller (index method)
app/Models/Gift/
  └── Gift.php                                       ← Model with scopeActive()
app/Http/Resources/V1/Gift/
  └── GiftResource.php                               ← Response transformer
app/Enums/Gift/
  └── GiftAssetType.php                              ← Asset type enum
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
```

---

## Document Metadata

| Property            | Value                |
| ------------------- | -------------------- |
| **Endpoint**        | `GET /api/v1/gifts`  |
| **Domain**          | Gift                 |
| **Author**          | System Documentation |
| **Created**         | 2026-02-02           |
| **Laravel Version** | 12.x                 |
| **PHP Version**     | 8.4                  |
