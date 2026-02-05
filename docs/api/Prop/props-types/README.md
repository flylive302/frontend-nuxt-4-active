# GET /api/v1/props/types

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Types endpoint returns all available prop categories with their active item counts. This powers the category navigation/filter UI in the prop mall, allowing users to see how many props are available in each category before browsing.

### Responsibilities

- Return all prop type categories with human-readable labels
- Include count of active, currently-available props per type
- Cache results for 5 minutes to reduce database load
- Provide consistent ordering based on enum definition order

### What It Owns

| Owned            | Description                                  |
| ---------------- | -------------------------------------------- |
| Type aggregation | COUNT grouped by type from `props` table     |
| Cache management | 5-minute cache with key `props:types:counts` |

### External Dependencies

| Dependency | Type           | Purpose                 |
| ---------- | -------------- | ----------------------- |
| PostgreSQL | Database       | Aggregation query       |
| Redis      | Cache          | 5-minute cache storage  |
| Sanctum    | Authentication | Bearer token validation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/props/types
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

### Query Parameters

None required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "types": [
      {
        "type": "frame", // string, PropType enum value
        "count": 15, // int, number of active props
        "label": "Frames" // string, human-readable label
      },
      {
        "type": "chat_bubble",
        "count": 8,
        "label": "Chat Bubbles"
      },
      {
        "type": "entry_animation",
        "count": 12,
        "label": "Entry Animations"
      },
      {
        "type": "signature",
        "count": 5,
        "label": "Signatures"
      },
      {
        "type": "room_theme",
        "count": 3,
        "label": "Room Themes"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-02-05T03:46:08.000000Z",
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
    "timestamp": "2026-02-05T03:46:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully retrieved prop types       |
| `401` | Missing or invalid authentication token |
| `500` | Server error (database/cache issue)     |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/props/types                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:34-35                                            │
│ Route: Route::get('/types', [PropController::class, 'types'])               │
│        ->name('props.types')                                                │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets auth()->user()            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::prefix('props')->group(function () {                         │ │
│ │         Route::get('/types', [PropController::class, 'types'])          │ │
│ │             ->name('props.types');                                      │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (No Form Request)                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint has NO Form Request class - it accepts no parameters.         │
│ Control passes directly to the controller method after middleware.          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/PropController.php:51-77             │
│ Method: types(): JsonResponse                                               │
│                                                                             │
│ STEP 1: Define cache key                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $cacheKey = 'props:types:counts';                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Attempt cache retrieval or execute query                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $types = Cache::remember($cacheKey, 300, function () {                  │ │
│ │     // Cache miss → execute database query                              │ │
│ │     // TTL: 300 seconds (5 minutes)                                     │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3 (on cache miss): Build aggregation query                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $counts = Prop::query()                                                 │ │
│ │     ->active()              // WHERE is_active = true                   │ │
│ │     ->availableNow()        // Within date window                       │ │
│ │     ->selectRaw('type, COUNT(*) as count')                              │ │
│ │     ->groupBy('type')                                                   │ │
│ │     ->pluck('count', 'type')                                            │ │
│ │     ->toArray();                                                        │ │
│ │                                                                         │ │
│ │ // Result: ['frame' => 15, 'chat_bubble' => 8, ...]                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4 (on cache miss): Map enum cases to response format                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return collect(PropType::cases())->map(function (PropType $type) use   │ │
│ │     ($counts) {                                                         │ │
│ │     return [                                                            │ │
│ │         'type' => $type->value,           // 'frame'                    │ │
│ │         'count' => $counts[$type->value] ?? 0,  // 15 or 0 if none      │ │
│ │         'label' => $type->label(),        // 'Frames'                   │ │
│ │     ];                                                                  │ │
│ │ })->values();                                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return formatted response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(['types' => $types]);                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service layer for this endpoint. Business logic resides in     │
│ the controller. The Prop model's query scopes handle filtering.             │
│                                                                             │
│ Model Query Scopes Used:                                                    │
│                                                                             │
│ SCOPE: active()                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:160-163                                  │ │
│ │ return $query->where('is_active', true);                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: availableNow()                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Prop/Prop.php:182-196                                  │ │
│ │ Filters by is_active = true AND available_from/until date window        │ │
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
│ │ Responsibility: Define valid prop type values and labels                │ │
│ │ Reusable: YES (used across Prop domain)                                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • cases() → Returns all 5 enum cases in definition order              │ │
│ │   • value → String value ('frame', 'chat_bubble', etc.)                 │ │
│ │   • label() → Human-readable name ('Frames', 'Chat Bubbles', etc.)      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Cache Facade (Laravel)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: Illuminate\Support\Facades\Cache                                  │ │
│ │ Responsibility: Redis-backed caching                                    │ │
│ │ Reusable: YES (Laravel core)                                            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • remember($key, $ttl, $callback) → Get or compute and cache          │ │
│ │   • forget($key) → Invalidate cache entry                               │ │
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
│ CACHE OPERATIONS (checked first):                                           │
│                                                                             │
│ 1. GET: Redis key `props:types:counts`                                      │
│    Hit: Return cached array immediately, skip database                      │
│    Miss: Execute database query, cache result for 300 seconds               │
│                                                                             │
│ DATABASE OPERATIONS (on cache miss):                                        │
│                                                                             │
│ 1. SELECT: Aggregation query                                                │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT type, COUNT(*) as count                                      │  │
│    │ FROM props                                                          │  │
│    │ WHERE is_active = true                                              │  │
│    │   AND (available_from IS NULL OR available_from <= now())           │  │
│    │   AND (available_until IS NULL OR available_until >= now())         │  │
│    │ GROUP BY type                                                       │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: PropController::types()                                          │
│    Index: idx_props_type_active_sort (type, is_active, sort_order)          │
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
│ Response is built from:                                                     │
│ 1. PropType::cases() provides the 5 enum values in fixed order              │
│ 2. Database counts (or zeros) merged with enum values and labels            │
│ 3. ApiResponse::success() wraps in standard envelope                        │
│                                                                             │
│ Response always contains exactly 5 types, even if count is 0                │
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

| File                  | Used By Endpoints                                   | Reusable | Reasoning                         |
| --------------------- | --------------------------------------------------- | -------- | --------------------------------- |
| `PropController.php`  | `GET /props`, `GET /props/types`, `GET /props/{id}` | ⭕       | Mixed - methods endpoint-specific |
| `Prop.php` (Model)    | All prop-related endpoints                          | ✅       | Core domain model                 |
| `PropType.php` (Enum) | All prop-related endpoints                          | ✅       | Shared type definitions           |
| `ApiResponse.php`     | All API endpoints                                   | ✅       | Global response utility           |
| Cache key pattern     | This endpoint only                                  | ❌       | Specific to type counts           |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| `Unauthenticated.` | `auth:sanctum` | Missing or invalid Bearer token |
| Token expired      | `auth:sanctum` | Token has exceeded expiration   |

### System Errors (500)

| Error               | Source     | Condition                          |
| ------------------- | ---------- | ---------------------------------- |
| Database connection | PostgreSQL | Database unavailable               |
| Redis connection    | Cache      | Redis unavailable (degrades to DB) |
| Query timeout       | Eloquent   | Aggregation exceeds timeout        |

### Edge Cases

| Case                          | Behavior                                       |
| ----------------------------- | ---------------------------------------------- |
| No props in database          | All types returned with count: 0               |
| All props inactive            | All types returned with count: 0               |
| Redis unavailable             | Falls back to database query (no caching)      |
| New PropType enum added       | Automatically included with count 0            |
| Cache stale after prop update | Stale counts for up to 5 minutes               |
| Concurrent requests           | Safe - Cache::remember handles race conditions |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE            CONTROLLER                 CACHE                  DATABASE
   │                     │                      │                       │                        │
   │  GET /props/types   │                      │                       │                        │
   │─────────────────────▶                      │                       │                        │
   │                     │                      │                       │                        │
   │                     │ 1. auth:sanctum      │                       │                        │
   │                     │ (validate token)     │                       │                        │
   │                     │─────────────────────▶│                       │                        │
   │                     │                      │                       │                        │
   │                     │                      │ 2. Cache::remember    │                        │
   │                     │                      │ key: props:types:counts                        │
   │                     │                      │──────────────────────▶│                        │
   │                     │                      │                       │                        │
   │                     │                      │     [CACHE HIT]       │                        │
   │                     │                      │◀──────────────────────│                        │
   │                     │                      │ Return cached types   │                        │
   │                     │                      │                       │                        │
   │                     │                      │     [CACHE MISS]      │                        │
   │                     │                      │                       │                        │
   │                     │                      │ 3. Prop::query()      │                        │
   │                     │                      │ ->active()->availableNow()                     │
   │                     │                      │ ->selectRaw('type, COUNT(*)')                  │
   │                     │                      │ ->groupBy('type')     │                        │
   │                     │                      │───────────────────────────────────────────────▶│
   │                     │                      │◀───────────────────────────────────────────────│
   │                     │                      │                       │                        │
   │                     │                      │ 4. Map PropType::cases()                       │
   │                     │                      │ with counts and labels│                        │
   │                     │                      │                       │                        │
   │                     │                      │ 5. Store in cache     │                        │
   │                     │                      │    TTL: 300s          │                        │
   │                     │                      │──────────────────────▶│                        │
   │                     │                      │                       │                        │
   │                     │                      │ 6. ApiResponse::      │                        │
   │                     │                      │ success()             │                        │
   │                     │◀─────────────────────│                       │                        │
   │◀────────────────────│                      │                       │                        │
   │                     │                      │                       │                        │
   │  200 OK + JSON      │                      │                       │                        │
   │                     │                      │                       │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location                                   |
| ---------------------------- | ------------------------------------------ |
| New prop type                | `PropType.php` - add new enum case         |
| Include inactive type counts | Modify controller query, remove `active()` |
| Change cache TTL             | `PropController::types()` line 58          |
| Add icon URL per type        | `PropType.php` - add `icon()` method       |
| Filter by user VIP level     | Add scope and modify aggregation query     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW PROP TYPE

| Step  | File                                               | What to Change                               |
| ----- | -------------------------------------------------- | -------------------------------------------- |
| **1** | `app/Enums/Prop/PropType.php`                      | Add new case (e.g., `case BADGE = 'badge';`) |
| **2** | `app/Enums/Prop/PropType.php`                      | Add label in `label()` match expression      |
| **3** | Clear cache: `Cache::forget('props:types:counts')` | Or wait 5 minutes for expiry                 |

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                  | What to Change                   |
| ----- | ----------------------------------------------------- | -------------------------------- |
| **1** | `app/Enums/Prop/PropType.php`                         | Add new method (e.g., `icon()`)  |
| **2** | `app/Http/Controllers/Api/V1/Prop/PropController.php` | Add to map callback              |
| **3** | Clear cache: `Cache::forget('props:types:counts')`    | To pick up new field immediately |

#### 📋 CACHE INVALIDATION

| Event                      | Action Needed                         |
| -------------------------- | ------------------------------------- |
| Prop created               | `Cache::forget('props:types:counts')` |
| Prop activated/deactivated | `Cache::forget('props:types:counts')` |
| Prop availability changed  | Automatic expiry handles this (5 min) |

### 🔗 Cache Invalidation Reference

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CACHE KEY: props:types:counts                      │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  TTL: 300 seconds (5 minutes)                                                │
│                                                                              │
│  Should be invalidated when:                                                 │
│    • New prop created                                                        │
│    • Prop activated/deactivated                                              │
│    • Prop available_from/until changed                                       │
│                                                                              │
│  Invalidation via:                                                           │
│    Cache::forget('props:types:counts')                                       │
│                                                                              │
│  Currently invalidated by:                                                   │
│    app/Listeners/Prop/InvalidatePropCacheListener.php (if exists)            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component            | Reason                                              |
| -------------------- | --------------------------------------------------- |
| Cache key string     | External systems may depend on key format           |
| PropType enum values | Database stores string values; renaming breaks data |
| Response structure   | Mobile clients depend on exact format               |
| Enum case order      | Clients may rely on fixed ordering                  |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                          |
| --------------------------------------- | --------------------------------------------------- |
| Forgetting to clear cache after changes | Use InvalidatePropCacheListener for prop events     |
| Adding a type without label             | Always update `label()` match when adding enum case |
| Assuming fresh counts                   | Counts can be up to 5 minutes stale                 |
| Changing TTL too low                    | Database hit on every request; keep >= 60s          |
| Changing TTL too high                   | Stale counts frustrate users on prop changes        |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (line 34-35)
app/Http/Controllers/Api/V1/Prop/
  └── PropController.php                             ← Controller (types method, lines 51-77)
app/Models/Prop/
  └── Prop.php                                       ← Eloquent model with scopes
app/Enums/Prop/
  └── PropType.php                                   ← Type enum with labels
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
app/Listeners/Prop/
  └── InvalidatePropCacheListener.php                ← Cache invalidation (if exists)
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit or receive MSAB events.

The Props Types endpoint is a pure read operation with caching. No real-time notifications are triggered.

---

## 9. Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `GET /api/v1/props/types` |
| **Domain**          | Prop                      |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-05                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
