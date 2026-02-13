# GET /api/v1/gifts/{id}

> **Domain**: Gift  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

This endpoint retrieves a single gift by its ID from the gift catalog for display in the gift picker or gift detail views.

### Responsibilities

- Retrieve a single gift record from the database
- Validate that the gift exists and is active
- Return 404 if the gift is not found or inactive
- Transform the gift data using a resource class for consistent API response

### What It Owns

| Owned            | Description                                             |
| ---------------- | ------------------------------------------------------- |
| Gift Read Access | Reads from `gifts` table using `id` with active filters |

### External Dependencies

| Dependency  | Type          | Purpose                           |
| ----------- | ------------- | --------------------------------- |
| MySQL       | Database      | Gift data storage                 |
| ApiResponse | Utility Class | Standardized JSON response format |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/gifts/{id}
```

### Authentication

❌ **None Required** - This is a public endpoint

### Rate Limiting

| Limiter | Key      | Config                          |
| ------- | -------- | ------------------------------- |
| Default | IP-based | Laravel default (60 per minute) |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### URL Parameters

| Parameter | Type      | Constraints       | Example |
| --------- | --------- | ----------------- | ------- |
| `id`      | `integer` | Required, numeric | `42`    |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "gift": {
      "id": 42,
      "name": "Heart Balloon",
      "label": "Love",
      "description": "A romantic heart-shaped balloon",
      "price": 50.0,
      "thumbnail_url": "https://example.com/proxy/image/gifts/heart-balloon.png",
      "animation_url": "gifts/heart-balloon.json", // Raw URL for frontend asset handling
      "asset_type": "lottie",
      "is_animated": true,
      "category": "romantic",
      "rarity": "common",
      "sort_order": 10
    }
  },
  "meta": {
    "timestamp": "2026-02-02T21:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Gift not found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T21:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ System Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T21:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                          |
| ----- | -------------------------------------------------- |
| `200` | Gift found and returned successfully               |
| `404` | Gift not found or is inactive/outside availability |
| `500` | Unexpected database or system error                |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/gifts/{id}                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/gifts.php:28                                               │
│ Route: Route::get('/{id}', [GiftController::class, 'show'])->whereNumber('id')│
│                                                                             │
│ Parent Route Groups:                                                        │
│   • routes/api.php:16 → Route::prefix('v1')                                 │
│   • routes/api/gifts.php:17 → Route::prefix('gifts')                        │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. api (default)  → Stateless session, JSON responses                     │
│                                                                             │
│ Route Constraint:                                                           │
│   • whereNumber('id') → Ensures {id} is numeric only                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No dedicated FormRequest class - parameter is extracted directly            │
│                                                                             │
│ The {id} parameter is passed directly to the controller method              │
│ as an integer due to type hinting: show(int $id)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Gift/GiftController.php:99-111            │
│ Method: show(int $id): JsonResponse                                         │
│                                                                             │
│ STEP 1: Query gift by ID with active scope                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $gift = Gift::active()->find($id);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if gift exists                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($gift === null) {                                                   │ │
│ │     return ApiResponse::notFound('Gift not found');                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response with gift resource                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(['gift' => new GiftResource($gift)]);       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint does NOT use a dedicated service layer.                       │
│ Business logic is handled directly in the controller due to simplicity.     │
│                                                                             │
│ The only business rule is the "active" scope which is defined in the        │
│ Gift model itself.                                                          │
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
│ │ Responsibility: Eloquent model for gifts table with scopes              │ │
│ │ Reusable: YES (used by all gift endpoints)                              │ │
│ │ Why It Exists: Central data access layer for gift data                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopeActive() → Filters to active gifts within availability window  │ │
│ │   • getFullThumbnailUrlAttribute() → Proxied thumbnail URL              │ │
│ │   • getFullAnimationUrlAttribute() → Proxied animation URL              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: GiftResource (API Resource)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Gift/GiftResource.php                       │ │
│ │ Responsibility: Transform Gift model to API response format             │ │
│ │ Reusable: YES (used by all gift endpoints)                              │ │
│ │ Why It Exists: Consistent gift representation across API                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns formatted gift data with proxied URLs           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure across entire API          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 response with data                                  │ │
│ │   • notFound() → 404 response with message                              │ │
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
│ 1. SELECT: Find active gift by ID                                           │
│    Query: SELECT * FROM `gifts`                                             │
│           WHERE `id` = ?                                                    │
│           AND `is_active` = 1                                               │
│           AND (`available_from` IS NULL OR `available_from` <= NOW())       │
│           AND (`available_until` IS NULL OR `available_until` >= NOW())     │
│           LIMIT 1                                                           │
│    Source: Gift::active()->find($id)                                        │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ None - Gift show endpoint does not use caching                              │
│ (Individual gift lookups are not cached for real-time availability)         │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ None                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Gift/GiftResource.php:21-36                     │
│                                                                             │
│ GiftResource transforms the Gift model:                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'label' => $this->label,                                            │ │
│ │     'description' => $this->description,                                │ │
│ │     'price' => (float) $this->price,                                    │ │
│ │     'thumbnail_url' => $this->full_thumbnail_url,  // Proxied URL       │ │
│ │     'animation_url' => $this->animation_url,       // Raw URL           │ │
│ │     'asset_type' => $this->asset_type->value,                           │ │
│ │     'is_animated' => $this->is_animated,                                │ │
│ │     'category' => $this->category,                                      │ │
│ │     'rarity' => $this->rarity,                                          │ │
│ │     'sort_order' => $this->sort_order,                                  │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Wrapped by ApiResponse::success():                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Success",                                                 │ │
│ │   "data": { "gift": { ... } },                                          │ │
│ │   "meta": { "timestamp": "...", "correlation_id": "..." }               │ │
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

| File                   | Used By Endpoints                                          | Reusable | Reasoning                           |
| ---------------------- | ---------------------------------------------------------- | -------- | ----------------------------------- |
| `routes/api/gifts.php` | All gift endpoints                                         | ⭕       | Gift routes only                    |
| `GiftController.php`   | `/gifts`, `/gifts/categories`, `/gifts/all`, `/gifts/{id}` | ⭕       | Gift domain specific                |
| `Gift.php` (Model)     | All gift-related endpoints                                 | ✅       | Central model for gift data access  |
| `Gift::scopeActive()`  | All gift endpoints                                         | ✅       | Reusable scope for active filtering |
| `GiftResource.php`     | All gift endpoints                                         | ✅       | Consistent gift serialization       |
| `ApiResponse.php`      | ALL API endpoints                                          | ✅       | Global response utility             |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source           | Condition                        |
| ----- | ---------------- | -------------------------------- |
| N/A   | Route constraint | `whereNumber('id')` handles this |

> **Note**: Invalid non-numeric IDs result in a 404 due to route constraints.

### Business Logic Errors (400)

| Error | Source | Condition                                 |
| ----- | ------ | ----------------------------------------- |
| N/A   | N/A    | No business logic errors in this endpoint |

### Not Found Errors (404)

| Error            | Source           | Condition                                     |
| ---------------- | ---------------- | --------------------------------------------- |
| "Gift not found" | `GiftController` | Gift ID doesn't exist in database             |
| "Gift not found" | `GiftController` | Gift exists but `is_active = false`           |
| "Gift not found" | `GiftController` | Gift exists but `available_from` is in future |
| "Gift not found" | `GiftController` | Gift exists but `available_until` is in past  |

### System Errors (500)

| Error                   | Source    | Condition                    |
| ----------------------- | --------- | ---------------------------- |
| "Internal server error" | Exception | Database connection failure  |
| "Internal server error" | Exception | Unexpected runtime exception |

### Edge Cases

| Case                         | Behavior                                             |
| ---------------------------- | ---------------------------------------------------- |
| ID = 0                       | 404 Not Found (no gift with ID 0)                    |
| Very large ID                | 404 Not Found (gift doesn't exist)                   |
| Gift just became inactive    | 404 Not Found (real-time availability check)         |
| Non-numeric ID (e.g., "abc") | Route doesn't match due to `whereNumber('id')` → 404 |
| Negative ID                  | Route doesn't match → 404                            |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              LARAVEL ROUTER          CONTROLLER              MODEL                   DATABASE
   │                       │                       │                    │                        │
   │  GET /api/v1/gifts/42 │                       │                    │                        │
   │──────────────────────▶│                       │                    │                        │
   │                       │                       │                    │                        │
   │                       │ 1. Match route        │                    │                        │
   │                       │    Apply api middleware                    │                        │
   │                       │──────────────────────▶│                    │                        │
   │                       │                       │                    │                        │
   │                       │                       │ 2. Call show(42)   │                        │
   │                       │                       │───────────────────▶│                        │
   │                       │                       │                    │                        │
   │                       │                       │                    │ 3. Gift::active()      │
   │                       │                       │                    │    ->find(42)          │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │                    │                        │
   │                       │                       │                    │ 4. SELECT * FROM gifts │
   │                       │                       │                    │    WHERE id=42         │
   │                       │                       │                    │    AND is_active=1     │
   │                       │                       │                    │    AND availability... │
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                        │
   │                       │                       │ 5. Return Gift or null                      │
   │                       │                       │◀───────────────────│                        │
   │                       │                       │                    │                        │
   │                       │                       │ 6. If null → ApiResponse::notFound()        │
   │                       │                       │    Else → new GiftResource($gift)           │
   │                       │                       │         → ApiResponse::success()            │
   │                       │                       │                    │                        │
   │                       │◀──────────────────────│                    │                        │
   │◀──────────────────────│                       │                    │                        │
   │                       │                       │                    │                        │
   │  200 OK + JSON        │                       │                    │                        │
   │  (or 404 Not Found)   │                       │                    │                        │
   │                       │                       │                    │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location                                      |
| ---------------------------- | --------------------------------------------- |
| New gift field in response   | `GiftResource.php`                            |
| New filter condition         | `Gift::scopeActive()` in `Gift.php`           |
| Gift-specific validation     | Create `ShowGiftRequest.php` FormRequest      |
| Caching for individual gifts | `GiftController::show()` with Cache::remember |
| Gift view tracking           | Add event dispatch in controller              |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                          | What to Change                  |
| ----- | --------------------------------------------- | ------------------------------- |
| **1** | Database Migration                            | Add column to `gifts` table     |
| **2** | `app/Models/Gift/Gift.php`                    | Add to `$fillable` array        |
| **3** | `app/Models/Gift/Gift.php`                    | Add to `$casts` if needed       |
| **4** | `app/Http/Resources/V1/Gift/GiftResource.php` | Add to `toArray()` return array |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                          | What to Change                       |
| ----- | --------------------------------------------- | ------------------------------------ |
| **1** | `app/Http/Resources/V1/Gift/GiftResource.php` | Remove from `toArray()` return array |
| **2** | Verify no frontend dependency                 | Check with frontend team             |
| **3** | Database Migration (optional)                 | Drop column if no longer needed      |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────┐     ┌─────────────────────┐     ┌───────────────────────┐
│  Database Column     │────▶│  Gift Model         │────▶│  GiftResource         │
│  gifts.column_name   │     │  $fillable/$casts   │     │  toArray()            │
└──────────────────────┘     └─────────────────────┘     └───────────────────────┘
                                      │
                                      ▼
                             ┌─────────────────────┐
                             │  Accessor (optional)│
                             │  getXxxAttribute()  │
                             └─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `ApiResponse.php`              | Used by ALL endpoints - changes affect entire API            |
| `Gift::scopeActive()`          | Used by all gift endpoints - affects gift availability logic |
| `GiftResource.php`             | Used by all gift endpoints - breaking changes affect clients |
| Route constraint `whereNumber` | Security measure to prevent non-numeric IDs                  |

### 🚨 Common Pitfalls

| Pitfall                                      | Prevention                                                |
| -------------------------------------------- | --------------------------------------------------------- |
| Removing a field from GiftResource           | Check frontend dependencies first                         |
| Changing `scopeActive()` logic               | Test all gift endpoints after changes                     |
| Adding cache without invalidation            | Gifts have availability windows - be careful with caching |
| Returning raw `thumbnail_url`                | Use `full_thumbnail_url` accessor for CORS proxy          |
| Not updating `$casts` for new decimal fields | Always cast decimal fields to avoid string responses      |

### 📁 File Locations Quick Reference

```
routes/api/gifts.php                           ← Route definition (line 28)
routes/api.php                                 ← Parent route group (line 16)

app/Http/Controllers/Api/V1/Gift/
  └── GiftController.php                       ← Controller (show method)

app/Models/Gift/
  └── Gift.php                                 ← Gift model with scopeActive

app/Http/Resources/V1/Gift/
  └── GiftResource.php                         ← Response transformer

app/Http/Utils/
  └── ApiResponse.php                          ← Response utility

app/Enums/Gift/
  └── GiftAssetType.php                        ← Asset type enum
```

---

## Document Metadata

| Property            | Value                    |
| ------------------- | ------------------------ |
| **Endpoint**        | `GET /api/v1/gifts/{id}` |
| **Domain**          | Gift                     |
| **Author**          | System Documentation     |
| **Created**         | 2026-02-02               |
| **Laravel Version** | 12.x                     |
| **PHP Version**     | 8.4                      |
