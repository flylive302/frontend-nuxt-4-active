# GET /api/v1/internal/gifts/active

> **Domain**: Internal / Gift  
> **Type**: Internal Endpoint (MSAB Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Returns the active gift catalog for MSAB to cache and display gift options in voice rooms.

### Responsibilities

- Fetch all currently active gifts
- Apply availability date filters
- Cache results for performance (60s TTL)
- Order by price ascending

### What It Owns

| Owned        | Description                         |
| ------------ | ----------------------------------- |
| Gift Catalog | Active gifts with prices and assets |

### External Dependencies

| Dependency | Type           | Purpose          |
| ---------- | -------------- | ---------------- |
| PostgreSQL | Database       | Gift data source |
| Redis      | Infrastructure | Response caching |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/internal/gifts/active
```

### Authentication

✅ **Required** - X-Internal-Key header only (no user token)

### Rate Limiting

| Limiter        | Key                         | Config               |
| -------------- | --------------------------- | -------------------- |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests/minute |

### Request Headers

| Header           | Required | Type               | Description               |
| ---------------- | -------- | ------------------ | ------------------------- |
| `Accept`         | ✅       | `application/json` | Response format           |
| `X-Internal-Key` | ✅       | `string`           | MSAB internal service key |

### Request Body Schema

No request body - GET request.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "gifts": [
    {
      "id": 1,
      "name": "Heart",
      "label": "Love",
      "description": "Send some love",
      "price": "10.00",
      "thumbnail_url": "/gifts/heart.png",
      "animation_url": "/gifts/heart.lottie",
      "sound_url": "/gifts/heart.mp3",
      "asset_type": "lottie",
      "is_animated": true,
      "category": "love",
      "subcategory": "basic",
      "rarity": "common",
      "wealth_xp_multiplier": "1.00",
      "charm_xp_multiplier": "1.00",
      "vip_level_required": 0,
      "country_specific": null,
      "min_level_required": 0,
      "is_active": true,
      "is_featured": false,
      "sort_order": 1,
      "available_from": null,
      "available_until": null,
      "total_sent": 15000,
      "total_revenue": "150000.00",
      "value": "5.00",
      "popularity_score": 95,
      "created_at": "2026-01-01T00:00:00.000000Z",
      "updated_at": "2026-02-01T00:00:00.000000Z"
    }
  ]
}
```

#### ❌ Invalid Internal Key (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

### HTTP Status Codes

| Code  | Condition              |
| ----- | ---------------------- |
| `200` | Gift catalog returned  |
| `403` | Invalid X-Internal-Key |
| `429` | Rate limit exceeded    |

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
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/gifts/active', [GiftController::class, 'active']);         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth          → Validates X-Internal-Key header                │
│   2. throttle:internal_api → 1000 req/min per service key                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:25-34                │
│ Method: active()                                                            │
│                                                                             │
│ STEP 1: Cache-aside pattern with 60s TTL                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $gifts = Cache::remember('internal:gifts:active', 60, function () {     │ │
│ │     return Gift::active()                                               │ │
│ │         ->orderBy('price', 'asc')                                       │ │
│ │         ->get();                                                        │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return wrapped response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['gifts' => $gifts]);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 MODEL SCOPE                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Gift/Gift.php:96-111                                       │
│ Scope: scopeActive()                                                        │
│                                                                             │
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
│ Query: SELECT * FROM gifts                                                  │
│        WHERE is_active = true                                               │
│        AND (available_from IS NULL OR available_from <= NOW())              │
│        AND (available_until IS NULL OR available_until >= NOW())            │
│        ORDER BY price ASC                                                   │
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

| File                 | Used By Endpoints            | Reusable | Reasoning            |
| -------------------- | ---------------------------- | -------- | -------------------- |
| `InternalAuth.php`   | All internal endpoints       | ✅       | Shared middleware    |
| `Gift.php` Model     | Gift-related endpoints       | ✅       | Core domain model    |
| `scopeActive()`      | Gift listing, transactions   | ✅       | Reusable query scope |
| `GiftController.php` | Internal gift endpoints only | ⭕       | Internal-specific    |

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case              | Behavior                             |
| ----------------- | ------------------------------------ |
| No active gifts   | Returns `{"gifts": []}`              |
| All gifts expired | Returns empty array                  |
| Cache miss        | Queries DB, caches for 60s           |
| Cache hit         | Returns cached data immediately      |
| Gift deactivated  | Excluded from result after cache TTL |

---

## 6. Sequence Diagram (Textual)

```
 MSAB                    MIDDLEWARE              CONTROLLER              CACHE/DATABASE
   │                         │                       │                         │
   │  GET /gifts/active      │                       │                         │
   │  + X-Internal-Key       │                       │                         │
   │────────────────────────▶│                       │                         │
   │                         │                       │                         │
   │                         │ 1. InternalAuth       │                         │
   │                         │ 2. throttle           │                         │
   │                         │──────────────────────▶│                         │
   │                         │                       │                         │
   │                         │                       │ 3. Cache::remember()    │
   │                         │                       │────────────────────────▶│
   │                         │                       │                         │
   │                         │                       │ (cache hit)             │
   │                         │                       │◀────────────────────────│
   │                         │                       │                         │
   │                         │                       │ OR (cache miss)         │
   │                         │                       │ 4. Gift::active()->get()│
   │                         │                       │────────────────────────▶│
   │                         │                       │◀────────────────────────│
   │                         │                       │ 5. Store in cache       │
   │                         │                       │────────────────────────▶│
   │                         │                       │                         │
   │                         │◀──────────────────────│                         │
   │◀────────────────────────│                       │                         │
   │                         │                       │                         │
   │  200 {"gifts": [...]}   │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition             | Location               |
| -------------------- | ---------------------- |
| New gift fields      | Gift model `$fillable` |
| Different ordering   | Controller query       |
| Longer/shorter cache | Controller TTL value   |
| Gift filtering       | Add query parameters   |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW GIFT FIELD

| Step  | File                       | What to Change             |
| ----- | -------------------------- | -------------------------- |
| **1** | Database Migration         | Add column to `gifts`      |
| **2** | `app/Models/Gift/Gift.php` | Add to `$fillable`         |
| **3** | Coordinate with MSAB       | Handle new field in client |

### ⚠️ What Should NOT Be Modified Casually

| Component        | Reason                                |
| ---------------- | ------------------------------------- |
| Cache key        | GiftObserver uses it for invalidation |
| Response wrapper | MSAB expects `{"gifts": [...]}`       |
| Price ordering   | UI depends on price sort              |

### 🚨 Common Pitfalls

| Pitfall                      | Prevention                         |
| ---------------------------- | ---------------------------------- |
| Stale gift data after update | GiftObserver clears cache on save  |
| Missing availability checks  | scopeActive() handles dates        |
| Large payload size           | Consider pagination if >1000 gifts |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Controllers/Internal/
  └── GiftController.php                             ← Controller
app/Models/Gift/
  └── Gift.php                                       ← Gift model + scopes
app/Observers/
  └── GiftObserver.php                               ← Cache invalidation
```

---

## 8. MSAB Event Contracts

### Incoming (MSAB → Laravel)

MSAB fetches this catalog periodically to populate gift selection UI in voice rooms.

### Outgoing (Laravel → MSAB)

When gifts are modified, `config:invalidate` event is emitted to notify MSAB to refresh:

```json
{
  "event": "config:invalidate",
  "payload": {
    "type": "gifts",
    "version": null
  },
  "timestamp": "2026-02-04T01:30:00+00:00"
}
```

This is emitted by `MSABEventService::emitConfigInvalidate('gifts')` when gifts change.

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `GET /api/internal/gifts/active` |
| **Domain**          | Internal / Gift                  |
| **Author**          | System Documentation             |
| **Created**         | 2026-02-04                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4+                             |
