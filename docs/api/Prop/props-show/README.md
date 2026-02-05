# GET /api/v1/props/{prop}

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Show endpoint returns detailed information about a single prop from the mall catalog. This powers the prop detail view where users can see full information before purchasing or gifting.

### Responsibilities

- Retrieve a single prop by ID using Route Model Binding
- Verify the prop is active and currently available
- Return detailed prop data including optional metadata
- Return 404 if prop doesn't exist or is unavailable

### What It Owns

| Owned          | Description                           |
| -------------- | ------------------------------------- |
| Prop retrieval | Single prop lookup from `props` table |
| Availability   | Business logic check for visibility   |

### External Dependencies

| Dependency | Type           | Purpose                 |
| ---------- | -------------- | ----------------------- |
| PostgreSQL | Database       | Primary data store      |
| Sanctum    | Authentication | Bearer token validation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/props/{prop}
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
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type  | Constraints                       | Example |
| --------- | ----- | --------------------------------- | ------- |
| `prop`    | `int` | Required, exists in `props` table | `42`    |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "prop": {
      "id": 42,
      "type": "frame", // string, PropType enum value
      "name": "Golden Crown Frame", // string, max 100 chars
      "description": "A majestic golden frame that...", // string|null
      "thumbnail_url": "https://cdn.fly.live/props/frame_001_thumb.png",
      "asset_url": "https://cdn.fly.live/props/frame_001.png", // string|null
      "price": 100.0, // float, decimal(18,4)
      "duration_days": 30, // int, prop validity period
      "inventory_count": 50, // int, remaining stock
      "is_giftable": true, // bool
      "is_sold_out": false, // bool, computed accessor
      "vip_level_required": 0, // int, minimum VIP level
      "metadata": {
        // object|null, conditional
        "animation_url": "https://cdn.fly.live/props/frame_001.webm",
        "rarity": "legendary"
      }
    }
  },
  "meta": {
    "timestamp": "2026-02-05T03:53:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found (404) - Prop Doesn't Exist

```json
{
  "status": "error",
  "message": "Not Found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:53:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found (404) - Prop Inactive/Unavailable

```json
{
  "status": "error",
  "message": "Prop not found.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:53:08.000000Z",
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
    "timestamp": "2026-02-05T03:53:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Successfully retrieved prop details       |
| `401` | Missing or invalid authentication token   |
| `404` | Prop not found OR inactive OR unavailable |
| `500` | Server error (database issue)             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/props/42                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:37-39                                            │
│ Route: Route::get('/{prop}', [PropController::class, 'show'])               │
│        ->whereNumber('prop')                                                │
│        ->name('props.show')                                                 │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets auth()->user()            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::prefix('props')->group(function () {                         │ │
│ │         Route::get('/{prop}', [PropController::class, 'show'])          │ │
│ │             ->whereNumber('prop')                                       │ │
│ │             ->name('props.show');                                       │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {prop} → Prop::findOrFail($prop) executed automatically                │
│   • Returns 404 if no matching record exists                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (Route Model Binding)                               │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Laravel's implicit Route Model Binding:                                     │
│                                                                             │
│ 1. Extracts {prop} parameter value (e.g., "42")                             │
│ 2. Executes: Prop::where('id', 42)->first()                                 │
│ 3. If null, throws ModelNotFoundException → 404 response                    │
│ 4. If found, injects Prop model instance into controller method             │
│                                                                             │
│ No Form Request class - validation happens via Route Model Binding          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/PropController.php:79-92             │
│ Method: show(Prop $prop): JsonResponse                                      │
│                                                                             │
│ STEP 1: Verify prop availability (business logic check)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $prop->is_active || ! $prop->is_available) {                      │ │
│ │     return ApiResponse::error('Prop not found.', 404);                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // is_active: Database column (boolean)                                 │ │
│ │ // is_available: Computed accessor checking:                            │ │
│ │ //   - is_active = true                                                 │ │
│ │ //   - inventory_count > 0 (not sold out)                               │ │
│ │ //   - available_from <= now (or null)                                  │ │
│ │ //   - available_until >= now (or null)                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return formatted response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'prop' => new PropResource($prop),                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service layer for this endpoint. Prop model provides           │
│ availability checking via accessors.                                        │
│                                                                             │
│ Model Accessors Used:                                                       │
│                                                                             │
│ ACCESSOR: is_available                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:119-140                                  │ │
│ │ public function getIsAvailableAttribute(): bool                         │ │
│ │ {                                                                       │ │
│ │     if (! $this->is_active) return false;                               │ │
│ │     if ($this->is_sold_out) return false;                               │ │
│ │     $now = now();                                                       │ │
│ │     if ($this->available_from !== null && $now->lt($this->available_from))│ │
│ │         return false;                                                   │ │
│ │     if ($this->available_until !== null && $now->gt($this->available_until))││
│ │         return false;                                                   │ │
│ │     return true;                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ACCESSOR: is_sold_out                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:111-114                                  │ │
│ │ public function getIsSoldOutAttribute(): bool                           │ │
│ │ {                                                                       │ │
│ │     return $this->inventory_count <= 0;                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: PropResource (API Resource)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Prop/PropResource.php                       │ │
│ │ Responsibility: Transform Prop model to detailed JSON                   │ │
│ │ Reusable: YES (used by show endpoint)                                   │ │
│ │ Why It Exists: Full prop details for detail view                        │ │
│ │                                                                         │ │
│ │ Output Fields (13 total):                                               │ │
│ │   • id, type, name, description                                         │ │
│ │   • thumbnail_url, asset_url, price, duration_days                      │ │
│ │   • inventory_count, is_giftable, is_sold_out                           │ │
│ │   • vip_level_required                                                  │ │
│ │   • metadata (conditional - only if not null)                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT: Single prop by ID (via Route Model Binding)                      │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM props WHERE id = 42 LIMIT 1                           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: Laravel Route Model Binding                                      │
│    Index: Primary key (id)                                                  │
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
│ Response is built through:                                                  │
│ 1. PropResource::toArray() transforms model to response                     │
│ 2. Conditional metadata field (uses $this->when())                          │
│ 3. ApiResponse::success() wraps in standard envelope                        │
│                                                                             │
│ PropResource::toArray() Implementation:                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'type' => $this->type->value,                                       │ │
│ │     'name' => $this->name,                                              │ │
│ │     'description' => $this->description,                                │ │
│ │     'thumbnail_url' => $this->thumbnail_url,                            │ │
│ │     'asset_url' => $this->asset_url,                                    │ │
│ │     'price' => (float) $this->price,                                    │ │
│ │     'duration_days' => $this->duration_days,                            │ │
│ │     'inventory_count' => $this->inventory_count,                        │ │
│ │     'is_giftable' => $this->is_giftable,                                │ │
│ │     'is_sold_out' => $this->is_sold_out,                                │ │
│ │     'vip_level_required' => $this->vip_level_required,                  │ │
│ │     'metadata' => $this->when($this->metadata !== null, $this->metadata),│ │
│ │ ];                                                                      │ │
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

| File                 | Used By Endpoints                                   | Reusable | Reasoning                         |
| -------------------- | --------------------------------------------------- | -------- | --------------------------------- |
| `PropController.php` | `GET /props`, `GET /props/types`, `GET /props/{id}` | ⭕       | Mixed - methods endpoint-specific |
| `Prop.php` (Model)   | All prop-related endpoints                          | ✅       | Core domain model with accessors  |
| `PropResource.php`   | `GET /props/{id}`, potentially purchase response    | ✅       | Full prop details resource        |
| `ApiResponse.php`    | All API endpoints                                   | ✅       | Global response utility           |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| `Unauthenticated.` | `auth:sanctum` | Missing or invalid Bearer token |

### Not Found Errors (404)

| Error             | Source                   | Condition                              |
| ----------------- | ------------------------ | -------------------------------------- |
| `Not Found`       | Route Model Binding      | Prop ID doesn't exist in database      |
| `Prop not found.` | `PropController::show()` | Prop exists but `is_active = false`    |
| `Prop not found.` | `PropController::show()` | Prop exists but `is_available = false` |

### System Errors (500)

| Error               | Source     | Condition            |
| ------------------- | ---------- | -------------------- |
| Database connection | PostgreSQL | Database unavailable |

### Edge Cases

| Case                          | Behavior                                |
| ----------------------------- | --------------------------------------- |
| Prop ID = 0                   | 404 Not Found                           |
| Prop ID negative              | `whereNumber` constraint blocks request |
| Prop ID non-numeric           | `whereNumber` constraint blocks request |
| Prop active but sold out      | 404 (is_available = false)              |
| Prop active but before window | 404 (available_from not reached)        |
| Prop active but after window  | 404 (available_until passed)            |
| Prop has null metadata        | `metadata` field omitted from response  |
| Prop has non-null metadata    | `metadata` field included in response   |
| Very large prop ID            | 404 Not Found                           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE            ROUTE BINDING           CONTROLLER              MODEL                 DATABASE
   │                     │                      │                      │                      │                        │
   │  GET /props/42      │                      │                      │                      │                        │
   │─────────────────────▶                      │                      │                      │                        │
   │                     │                      │                      │                      │                        │
   │                     │ 1. auth:sanctum      │                      │                      │                        │
   │                     │ (validate token)     │                      │                      │                        │
   │                     │─────────────────────▶│                      │                      │                        │
   │                     │                      │                      │                      │                        │
   │                     │                      │ 2. Route Model       │                      │                        │
   │                     │                      │ Binding: {prop}      │                      │                        │
   │                     │                      │ Prop::findOrFail(42) │                      │                        │
   │                     │                      │─────────────────────────────────────────────────────────────────────▶│
   │                     │                      │◀─────────────────────────────────────────────────────────────────────│
   │                     │                      │                      │                      │                        │
   │                     │                      │      [IF NOT FOUND → 404]                   │                        │
   │                     │                      │                      │                      │                        │
   │                     │                      │ 3. Inject Prop model │                      │                        │
   │                     │                      │─────────────────────▶│                      │                        │
   │                     │                      │                      │                      │                        │
   │                     │                      │                      │ 4. Check is_active   │                        │
   │                     │                      │                      │    Check is_available│                        │
   │                     │                      │                      │ (accessor computation)                        │
   │                     │                      │                      │─────────────────────▶│                        │
   │                     │                      │                      │◀─────────────────────│                        │
   │                     │                      │                      │                      │                        │
   │                     │                      │                      │      [IF UNAVAILABLE → 404]                   │
   │                     │                      │                      │                      │                        │
   │                     │                      │                      │ 5. PropResource      │                        │
   │                     │                      │                      │ transforms model     │                        │
   │                     │                      │                      │                      │                        │
   │                     │                      │                      │ 6. ApiResponse::     │                        │
   │                     │                      │                      │ success()            │                        │
   │                     │                      │◀─────────────────────│                      │                        │
   │                     │◀────────────────────│                       │                      │                        │
   │◀────────────────────│                      │                      │                      │                        │
   │                     │                      │                      │                      │                        │
   │  200 OK + JSON      │                      │                      │                      │                        │
   │                     │                      │                      │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                       |
| ----------------------------- | ---------------------------------------------- |
| New response field            | `PropResource.php` toArray()                   |
| Cache prop details            | Wrap in `Cache::remember()` in controller      |
| Include user ownership status | Add conditional field in `PropResource`        |
| Related props                 | Add relationship to model, include in resource |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                          | What to Change                  |
| ----- | --------------------------------------------- | ------------------------------- |
| **1** | `database/migrations/*create_props_table.php` | Add column (if new DB field)    |
| **2** | `app/Models/Prop/Prop.php`                    | Add to `$fillable` and `$casts` |
| **3** | `app/Http/Resources/V1/Prop/PropResource.php` | Add to `toArray()` return array |

#### ➕ ADDING A CONDITIONAL FIELD

| Step  | File                                          | What to Change                      |
| ----- | --------------------------------------------- | ----------------------------------- |
| **1** | `app/Http/Resources/V1/Prop/PropResource.php` | Use `$this->when(condition, value)` |

Example:

```php
'special_badge' => $this->when($this->type->value === 'frame', $this->metadata['badge'] ?? null),
```

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                          | What to Change                       |
| ----- | --------------------------------------------- | ------------------------------------ |
| **1** | `app/Http/Resources/V1/Prop/PropResource.php` | Remove from `toArray()` return array |
| **2** | Update this documentation                     | Note breaking change                 |

### 🔗 PropResource vs PropSummaryResource

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RESOURCE COMPARISON                                       │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  PropSummaryResource (list views):    PropResource (detail view):            │
│  ├─ id                                ├─ id                                  │
│  ├─ type                              ├─ type                                │
│  ├─ name                              ├─ name                                │
│  ├─ description                       ├─ description                         │
│  ├─ thumbnail_url                     ├─ thumbnail_url                       │
│  ├─ asset_url                         ├─ asset_url                           │
│  ├─ price                             ├─ price                               │
│  ├─ duration_days                     ├─ duration_days                       │
│  ├─ inventory_count                   ├─ inventory_count                     │
│  ├─ is_giftable                       ├─ is_giftable                         │
│  ├─ sort_order          ✗             ├─ is_sold_out                         │
│  ├─ vip_level_required                ├─ vip_level_required                  │
│  └─ is_sold_out                       └─ metadata (conditional)   ✓          │
│                                                                              │
│  ✗ = Only in Summary    ✓ = Only in Full Resource                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component               | Reason                                         |
| ----------------------- | ---------------------------------------------- |
| Route Model Binding     | Changes URL structure, breaks client bookmarks |
| `is_available` accessor | Core business logic for prop visibility        |
| `is_sold_out` accessor  | Used by purchase flow for validation           |
| `whereNumber('prop')`   | Security constraint, prevents injection        |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                        |
| ----------------------------------- | ------------------------------------------------- |
| Changing availability check order   | `is_active` must be checked before `is_available` |
| Exposing inactive props             | Never remove the availability check               |
| Forgetting `whereNumber` constraint | Always use for numeric ID routes                  |
| Adding eager loading unnecessarily  | Single prop doesn't need relationship loading     |
| Returning different 404 messages    | Clients may parse error messages; keep consistent |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 37-39)
app/Http/Controllers/Api/V1/Prop/
  └── PropController.php                             ← Controller (show method, lines 79-92)
app/Models/Prop/
  └── Prop.php                                       ← Model with is_available accessor
app/Http/Resources/V1/Prop/
  └── PropResource.php                               ← Response transformer (13 fields)
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit or receive MSAB events.

The Props Show endpoint is a pure read operation. No real-time notifications are triggered.

---

## 9. Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `GET /api/v1/props/{prop}` |
| **Domain**          | Prop                       |
| **Author**          | System Documentation       |
| **Created**         | 2026-02-05                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4                        |
