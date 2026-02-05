# GET /api/v1/props

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Index endpoint provides the mall catalog functionality, allowing authenticated users to browse available virtual props with cursor-based pagination. This is the primary discovery mechanism for the FlyLive prop marketplace.

### Responsibilities

- List all active and currently available props
- Filter props by type (frames, chat bubbles, entry animations, signatures, room themes)
- Provide cursor-based pagination for infinite scroll UX
- Return prop summary data optimized for catalog display

### What It Owns

| Owned            | Description                                       |
| ---------------- | ------------------------------------------------- |
| Props catalog    | Read-only access to the `props` table             |
| Pagination state | Cursor encoding/decoding for stateless pagination |

### External Dependencies

| Dependency | Type           | Purpose                 |
| ---------- | -------------- | ----------------------- |
| PostgreSQL | Database       | Primary data store      |
| Sanctum    | Authentication | Bearer token validation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/props
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Rate Limiting

| Limiter | Key         | Config                    |
| ------- | ----------- | ------------------------- |
| `api`   | `user:{id}` | Default API rate limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ❌       | `application/json` | Not required for GET |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

```
?type=frame&per_page=20&cursor={encoded_cursor}
```

#### Parameter Details

| Parameter  | Type     | Constraints                                                            | Default | Example              |
| ---------- | -------- | ---------------------------------------------------------------------- | ------- | -------------------- |
| `type`     | `string` | Optional, in: `frame,chat_bubble,entry_animation,signature,room_theme` | `null`  | `frame`              |
| `per_page` | `int`    | Optional, min:1, max:100                                               | `20`    | `50`                 |
| `cursor`   | `string` | Optional, base64 encoded cursor from previous response                 | `null`  | `eyJpZCI6MTAsIl9...` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "props": [
      {
        "id": 1,
        "type": "frame", // string, PropType enum value
        "name": "Golden Crown Frame", // string, max 100 chars
        "description": "A majestic golden frame", // string|null
        "thumbnail_url": "https://cdn.fly.live/props/frame_001_thumb.png", // string, max 500
        "asset_url": "https://cdn.fly.live/props/frame_001.png", // string|null, max 500
        "price": 100.0, // float, decimal(18,4)
        "duration_days": 30, // int, prop validity period
        "inventory_count": 50, // int, remaining stock
        "is_giftable": true, // bool, can be gifted
        "sort_order": 1, // int, display order
        "vip_level_required": 0, // int, minimum VIP level
        "is_sold_out": false // bool, computed accessor
      }
    ],
    "pagination": {
      "next_cursor": "eyJpZCI6MTAsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0", // string|null
      "has_more": true, // bool
      "per_page": 20 // int
    }
  },
  "meta": {
    "timestamp": "2026-02-05T03:37:36.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
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
    "type": ["The selected type is invalid."],
    "per_page": ["The per page field must be between 1 and 100."]
  },
  "meta": {
    "timestamp": "2026-02-05T03:37:36.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:37:36.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully retrieved props list       |
| `401` | Missing or invalid authentication token |
| `422` | Validation failed (invalid type/params) |
| `500` | Server error (database/internal issue)  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/props?type=frame&per_page=20                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:31                                               │
│ Route: Route::get('/', [PropController::class, 'index'])                    │
│        ->name('props.index')                                                │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets auth()->user()            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::prefix('props')->group(function () {                         │ │
│ │         Route::get('/', [PropController::class, 'index'])               │ │
│ │             ->name('props.index');                                      │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (Request Validation)                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Prop/ListPropsRequest.php                           │
│                                                                             │
│ Form Request validates query parameters before controller action.           │
│ Authorization returns true (endpoint is public to authenticated users).     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'type' => [                                                     │ │
│ │             'nullable', 'string',                                       │ │
│ │             'in:' . implode(',', array_column(PropType::cases(), 'value'))│ │
│ │         ],                                                              │ │
│ │         'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],      │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Valid types: frame, chat_bubble, entry_animation, signature, room_theme     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/PropController.php                   │
│ Method: index(ListPropsRequest $request): JsonResponse                      │
│                                                                             │
│ STEP 1: Parse and normalize request parameters                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $type = $request->input('type')                                         │ │
│ │     ? PropType::from($request->input('type'))  // Cast to enum          │ │
│ │     : null;                                                             │ │
│ │ $perPage = min($request->integer('per_page', 20), 100);  // Cap at 100  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build Eloquent query with scopes                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = Prop::query()                                                  │ │
│ │     ->active()          // where is_active = true                       │ │
│ │     ->availableNow()    // within availability date window              │ │
│ │     ->orderBy('sort_order')                                             │ │
│ │     ->orderBy('id');    // secondary sort for stable pagination         │ │
│ │                                                                         │ │
│ │ if ($type) {                                                            │ │
│ │     $query->ofType($type);  // where type = $type                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute cursor pagination                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $props = $query->cursorPaginate($perPage);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return formatted response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'props' => PropSummaryResource::collection($props),                 │ │
│ │     'pagination' => [                                                   │ │
│ │         'next_cursor' => $props->nextCursor()?->encode(),               │ │
│ │         'has_more' => $props->hasMorePages(),                           │ │
│ │         'per_page' => $perPage,                                         │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service layer for this endpoint. Business logic is simple      │
│ enough to reside in the controller. The Prop model's query scopes handle    │
│ the filtering logic directly.                                               │
│                                                                             │
│ Model Query Scopes Used:                                                    │
│                                                                             │
│ SCOPE: active()                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:160-163                                  │ │
│ │ public function scopeActive($query)                                     │ │
│ │ {                                                                       │ │
│ │     return $query->where('is_active', true);                            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: availableNow()                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:182-196                                  │ │
│ │ public function scopeAvailableNow($query)                               │ │
│ │ {                                                                       │ │
│ │     $now = now();                                                       │ │
│ │     return $query                                                       │ │
│ │         ->where('is_active', true)                                      │ │
│ │         ->where(function ($q) use ($now) {                              │ │
│ │             $q->whereNull('available_from')                             │ │
│ │               ->orWhere('available_from', '<=', $now);                  │ │
│ │         })                                                              │ │
│ │         ->where(function ($q) use ($now) {                              │ │
│ │             $q->whereNull('available_until')                            │ │
│ │               ->orWhere('available_until', '>=', $now);                 │ │
│ │         });                                                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: ofType()                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:171-174                                  │ │
│ │ public function scopeOfType($query, PropType $type)                     │ │
│ │ {                                                                       │ │
│ │     return $query->where('type', $type);                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: PropType (Enum)                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Prop/PropType.php                                       │ │
│ │ Responsibility: Define valid prop type values                           │ │
│ │ Reusable: YES (used across Prop domain)                                 │ │
│ │ Why It Exists: Type safety and single source of truth for prop types    │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • FRAME = 'frame'                                                     │ │
│ │   • CHAT_BUBBLE = 'chat_bubble'                                         │ │
│ │   • ENTRY_ANIMATION = 'entry_animation'                                 │ │
│ │   • SIGNATURE = 'signature'                                             │ │
│ │   • ROOM_THEME = 'room_theme'                                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable name for display                           │ │
│ │   • options() → Array for form selects                                  │ │
│ │   • affectsUserTable() → Whether type updates user table                │ │
│ │   • targetColumn() → Column name to update on equip                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: PropSummaryResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Prop/PropSummaryResource.php                │ │
│ │ Responsibility: Transform Prop model to catalog-optimized JSON         │ │
│ │ Reusable: YES (used by index listing)                                   │ │
│ │ Why It Exists: Lighter payload than PropResource for list views         │ │
│ │                                                                         │ │
│ │ Output Fields:                                                          │ │
│ │   • id, type, name, description                                         │ │
│ │   • thumbnail_url, asset_url, price, duration_days                      │ │
│ │   • inventory_count, is_giftable, sort_order                            │ │
│ │   • vip_level_required, is_sold_out (computed)                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure across entire API          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200/201 with data                                       │ │
│ │   • error() → Error with status code                                    │ │
│ │   • validationError() → 422 response                                    │ │
│ │   • getCorrelationId() → Request tracking ID                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Abstract)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Base class for API resources with common meta           │ │
│ │ Reusable: YES (extended by all API resources)                           │ │
│ │ Why It Exists: DRY principle for meta fields and permission helpers     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • with() → Adds timestamp and correlation_id                          │ │
│ │   • userHasRole() → Permission checking                                 │ │
│ │   • formatTimestamp() → Consistent date formatting                      │ │
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
│ 1. SELECT: Cursor-paginated prop catalog                                    │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM props                                                 │  │
│    │ WHERE is_active = true                                              │  │
│    │   AND (available_from IS NULL OR available_from <= now())           │  │
│    │   AND (available_until IS NULL OR available_until >= now())         │  │
│    │   AND type = 'frame'  -- only if type filter provided               │  │
│    │ ORDER BY sort_order ASC, id ASC                                     │  │
│    │ LIMIT 21                                                            │  │
│    │ CURSOR (id > {last_id} OR (sort_order > {last_sort} AND id > ..))   │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: PropController::index()                                          │
│    Index: idx_props_type_active_sort (type, is_active, sort_order)          │
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
│ The response is built through these layers:                                 │
│                                                                             │
│ 1. PropSummaryResource::collection() transforms each Prop model             │
│ 2. Pagination metadata extracted from CursorPaginator                       │
│ 3. ApiResponse::success() wraps data in standard envelope                   │
│                                                                             │
│ Response Assembly:                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",          // from ApiResponse                     │ │
│ │   "message": "Success",         // from ApiResponse                     │ │
│ │   "data": {                                                             │ │
│ │     "props": [...],             // PropSummaryResource::collection()    │ │
│ │     "pagination": {             // Built manually in controller         │ │
│ │       "next_cursor": "...",     // CursorPaginator->nextCursor()        │ │
│ │       "has_more": true,         // CursorPaginator->hasMorePages()      │ │
│ │       "per_page": 20                                                    │ │
│ │     }                                                                   │ │
│ │   },                                                                    │ │
│ │   "meta": {                     // from ApiResponse                     │ │
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

| File                      | Used By Endpoints                                   | Reusable | Reasoning                             |
| ------------------------- | --------------------------------------------------- | -------- | ------------------------------------- |
| `ListPropsRequest.php`    | `GET /props` only                                   | ❌       | Endpoint-specific validation          |
| `PropController.php`      | `GET /props`, `GET /props/types`, `GET /props/{id}` | ⭕       | Mixed - methods are endpoint-specific |
| `Prop.php` (Model)        | All prop-related endpoints                          | ✅       | Core domain model                     |
| `PropType.php` (Enum)     | All prop-related endpoints                          | ✅       | Shared type definitions               |
| `PropSummaryResource.php` | `GET /props`, potentially other listings            | ✅       | Designed for list views               |
| `ApiResponse.php`         | All API endpoints                                   | ✅       | Global response utility               |
| `BaseResource.php`        | All API resources                                   | ✅       | Abstract base class                   |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error              | Source             | Condition                                                               |
| ------------------ | ------------------ | ----------------------------------------------------------------------- |
| `type.in`          | `ListPropsRequest` | Type not in: frame, chat_bubble, entry_animation, signature, room_theme |
| `per_page.integer` | `ListPropsRequest` | per_page is not a valid integer                                         |
| `per_page.min`     | `ListPropsRequest` | per_page < 1                                                            |
| `per_page.max`     | `ListPropsRequest` | per_page > 100                                                          |

### Authentication Errors (401)

| Error              | Source         | Condition                          |
| ------------------ | -------------- | ---------------------------------- |
| `Unauthenticated.` | `auth:sanctum` | Missing or invalid Bearer token    |
| Token expired      | `auth:sanctum` | Token has exceeded expiration time |

### System Errors (500)

| Error               | Source          | Condition                   |
| ------------------- | --------------- | --------------------------- |
| Database connection | PostgreSQL      | Database unavailable        |
| Query timeout       | Eloquent        | Query exceeds timeout limit |
| Invalid cursor      | CursorPaginator | Corrupted cursor string     |

### Edge Cases

| Case                     | Behavior                                         |
| ------------------------ | ------------------------------------------------ |
| Empty result set         | Returns `{ "props": [], "pagination": {...} }`   |
| No type filter           | Returns all prop types combined                  |
| per_page > 100           | Silently capped to 100                           |
| Invalid cursor           | Returns first page (Laravel default)             |
| All props inactive       | Returns empty array                              |
| Prop becomes unavailable | Excluded from results via `availableNow()` scope |
| Time-limited props       | Automatically filtered by `available_from/until` |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE           FORM REQUEST           CONTROLLER              MODEL/QUERY              DATABASE
   │                     │                     │                      │                      │                        │
   │  GET /props?type    │                     │                      │                      │                        │
   │─────────────────────▶                     │                      │                      │                        │
   │                     │                     │                      │                      │                        │
   │                     │ 1. auth:sanctum     │                      │                      │                        │
   │                     │ (validate token)    │                      │                      │                        │
   │                     │────────────────────▶│                      │                      │                        │
   │                     │                     │                      │                      │                        │
   │                     │                     │ 2. ListPropsRequest  │                      │                        │
   │                     │                     │ authorize() = true   │                      │                        │
   │                     │                     │ rules() validation   │                      │                        │
   │                     │                     │─────────────────────▶│                      │                        │
   │                     │                     │                      │                      │                        │
   │                     │                     │                      │ 3. Parse request     │                        │
   │                     │                     │                      │ type → PropType enum │                        │
   │                     │                     │                      │ per_page → min(x,100)│                        │
   │                     │                     │                      │                      │                        │
   │                     │                     │                      │ 4. Build query       │                        │
   │                     │                     │                      │─────────────────────▶│                        │
   │                     │                     │                      │ Prop::query()        │                        │
   │                     │                     │                      │ ->active()           │                        │
   │                     │                     │                      │ ->availableNow()     │                        │
   │                     │                     │                      │ ->ofType() if set    │                        │
   │                     │                     │                      │                      │                        │
   │                     │                     │                      │                      │ 5. SELECT props        │
   │                     │                     │                      │                      │ with cursor pagination │
   │                     │                     │                      │                      │───────────────────────▶│
   │                     │                     │                      │                      │◀───────────────────────│
   │                     │                     │                      │                      │ (Prop models)          │
   │                     │                     │                      │                      │                        │
   │                     │                     │                      │ 6. Transform to      │                        │
   │                     │                     │                      │ PropSummaryResource  │                        │
   │                     │                     │                      │◀─────────────────────│                        │
   │                     │                     │                      │                      │                        │
   │                     │                     │                      │ 7. ApiResponse::     │                        │
   │                     │                     │                      │ success()            │                        │
   │                     │                     │◀─────────────────────│                      │                        │
   │                     │◀────────────────────│                      │                      │                        │
   │◀────────────────────│                     │                      │                      │                        │
   │                     │                     │                      │                      │                        │
   │  200 OK + JSON      │                     │                      │                      │                        │
   │                     │                     │                      │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition             | Location                                             |
| -------------------- | ---------------------------------------------------- |
| New filter parameter | `ListPropsRequest.php` rules, `PropController` query |
| New response field   | `PropSummaryResource.php` toArray()                  |
| New prop type        | `PropType.php` enum case                             |
| Caching              | Wrap query in `Cache::remember()` in controller      |
| Search by name       | Add `scopeSearch()` to `Prop.php` model              |
| VIP level filtering  | Add `scopeForVipLevel()` to `Prop.php` model         |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                 | What to Change                          |
| ----- | ---------------------------------------------------- | --------------------------------------- |
| **1** | `database/migrations/*create_props_table.php`        | Add column definition (if new DB field) |
| **2** | `app/Models/Prop/Prop.php`                           | Add to `$fillable` and `$casts`         |
| **3** | `app/Http/Resources/V1/Prop/PropSummaryResource.php` | Add to `toArray()` return array         |

#### ➕ ADDING A NEW FILTER PARAMETER

| Step  | File                                                  | What to Change                     |
| ----- | ----------------------------------------------------- | ---------------------------------- |
| **1** | `app/Http/Requests/Prop/ListPropsRequest.php`         | Add validation rule                |
| **2** | `app/Http/Controllers/Api/V1/Prop/PropController.php` | Parse parameter, add to query      |
| **3** | `app/Models/Prop/Prop.php`                            | Add query scope (if complex logic) |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                 | What to Change                    |
| ----- | ---------------------------------------------------- | --------------------------------- |
| **1** | `app/Http/Resources/V1/Prop/PropSummaryResource.php` | Remove from `toArray()`           |
| **2** | Update API documentation                             | Note breaking change              |
| **3** | `app/Models/Prop/Prop.php`                           | Remove accessor if computed field |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FIELD DATA FLOW                                    │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  Database (props table)                                                      │
│         │                                                                    │
│         ▼                                                                    │
│  Prop Model ($fillable, $casts)                                              │
│         │                                                                    │
│         ├─────────────────┐                                                  │
│         ▼                 ▼                                                  │
│  Query Scopes          Accessors                                             │
│  (active, ofType)     (is_sold_out, is_available)                            │
│         │                 │                                                  │
│         └────────┬────────┘                                                  │
│                  ▼                                                           │
│         PropSummaryResource::toArray()                                       │
│                  │                                                           │
│                  ▼                                                           │
│         ApiResponse::success()                                               │
│                  │                                                           │
│                  ▼                                                           │
│         JSON Response                                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

**Adding Filter Parameter Checklist:**

- [ ] Add validation rule in `ListPropsRequest.php`
- [ ] Parse parameter in `PropController.php`
- [ ] Add query scope to `Prop.php` if complex
- [ ] Update this documentation
- [ ] Add test case in feature tests

**Adding Response Field Checklist:**

- [ ] Add database column if new field
- [ ] Add to model `$fillable` and `$casts`
- [ ] Add accessor if computed
- [ ] Add to `PropSummaryResource::toArray()`
- [ ] Update API contract in this doc
- [ ] Add test assertion

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                              |
| ---------------------------- | --------------------------------------------------- |
| `ApiResponse` envelope       | Breaking change for all API consumers               |
| Cursor pagination encoding   | Will break infinite scroll for mobile clients       |
| `sort_order` + `id` ordering | Cursor pagination depends on stable ordering        |
| `PropType` enum values       | Database stores string values; renaming breaks data |
| `is_active` scope logic      | Critical business logic for prop visibility         |
| `availableNow` scope logic   | Time-based availability for promotions              |

### 🚨 Common Pitfalls

| Pitfall                                       | Prevention                                              |
| --------------------------------------------- | ------------------------------------------------------- |
| Changing `per_page` max without client update | Clients may rely on current max of 100                  |
| Removing fields from response                 | Mobile clients cache responses; version API if removing |
| Adding required filters                       | Breaks existing clients; make filters optional          |
| Changing type enum values                     | Use migrations to update existing data                  |
| Modifying sort order mid-pagination           | Users get duplicate/missing items; clear client cache   |
| Not indexing new filter columns               | Performance degrades on large datasets                  |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (line 31)
app/Http/Controllers/Api/V1/Prop/
  └── PropController.php                             ← Controller (index method)
app/Http/Requests/Prop/
  └── ListPropsRequest.php                           ← Request validation
app/Models/Prop/
  └── Prop.php                                       ← Eloquent model with scopes
app/Enums/Prop/
  └── PropType.php                                   ← Type enum
app/Http/Resources/V1/Prop/
  └── PropSummaryResource.php                        ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
database/migrations/
  └── 2025_12_05_000001_create_props_table.php       ← Table schema
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit or receive MSAB events.

The Props Index endpoint is a pure read operation with no side effects that would trigger real-time notifications.

---

## 9. Document Metadata

| Property            | Value                |
| ------------------- | -------------------- |
| **Endpoint**        | `GET /api/v1/props`  |
| **Domain**          | Prop                 |
| **Author**          | System Documentation |
| **Created**         | 2026-02-05           |
| **Laravel Version** | 12.x                 |
| **PHP Version**     | 8.4                  |
