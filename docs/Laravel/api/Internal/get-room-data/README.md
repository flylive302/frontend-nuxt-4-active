# GET /api/v1/internal/rooms/{id}

> **Domain**: Internal  
> **Type**: Internal Service Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Provides room ownership data to the MSAB Audio Server for verifying user permissions during socket connections and room operations.

### Responsibilities

- Validate internal authentication via X-Internal-Key header
- Retrieve room data by ID
- Return minimal ownership information for verification

### What It Owns

| Owned           | Description                                       |
| --------------- | ------------------------------------------------- |
| Room data fetch | Retrieves room ID and owner_id from `rooms` table |

### External Dependencies

| Dependency | Type     | Purpose                                  |
| ---------- | -------- | ---------------------------------------- |
| PostgreSQL | Database | Room data storage                        |
| MSAB       | Service  | Audio server that consumes this endpoint |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/internal/rooms/{id}
```

### Authentication

✅ **Required** - Internal service authentication via `X-Internal-Key` header

### Rate Limiting

| Limiter        | Key                         | Config                               |
| -------------- | --------------------------- | ------------------------------------ |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests per minute per service |

### Request Headers

| Header           | Required | Type               | Description                         |
| ---------------- | -------- | ------------------ | ----------------------------------- |
| `Accept`         | ✅       | `application/json` | Response format                     |
| `X-Internal-Key` | ✅       | `string`           | Internal service authentication key |

### URL Parameters

| Parameter | Type     | Constraints                       | Example |
| --------- | -------- | --------------------------------- | ------- |
| `id`      | `string` | Required, UUID or integer room ID | `123`   |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "id": "integer", // Room ID
  "owner_id": "integer" // User ID of room owner
}
```

#### ❌ Authentication Error (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

#### ❌ Not Found Error (404)

```json
{
  "message": "Room not found."
}
```

### HTTP Status Codes

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Room found and data returned      |
| `403` | Invalid or missing X-Internal-Key |
| `404` | Room with given ID does not exist |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/internal/rooms/{id}                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:27                                            │
│ Route: Route::get('/rooms/{id}', [RoomController::class, 'show'])           │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth  → Validates X-Internal-Key header                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('internal')->middleware([InternalAuth::class])->group(   │ │
│ │     function () {                                                       │ │
│ │         // ...                                                          │ │
│ │         Route::get('/rooms/{id}', [RoomController::class, 'show']);     │ │
│ │     }                                                                   │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE EXECUTION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/InternalAuth.php:16-28                            │
│                                                                             │
│ Validates the X-Internal-Key header against config value                    │
│ Uses hash_equals for timing-safe comparison                                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function handle(Request $request, Closure $next): Response       │ │
│ │ {                                                                       │ │
│ │     $internalKey = $request->header('X-Internal-Key');                  │ │
│ │     $expectedKey = config('services.msab.internal_key');                │ │
│ │                                                                         │ │
│ │     if ($internalKey === null || $expectedKey === null ||               │ │
│ │         !hash_equals($expectedKey, $internalKey)) {                     │ │
│ │         return response()->json([                                       │ │
│ │             'message' => 'Unauthorized. Invalid internal key.',         │ │
│ │             'error_code' => 'INTERNAL_AUTH_FAILED',                     │ │
│ │         ], 403);                                                        │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return $next($request);                                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:51-63                │
│ Method: show(string $id)                                                    │
│                                                                             │
│ STEP 1: Find room by ID                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($id);                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if room exists                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($room === null) {                                                   │ │
│ │     return response()->json(['message' => 'Room not found.'], 404);     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return minimal ownership data                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'id' => $room->id,                                                  │ │
│ │     'owner_id' => $room->user_id,                                       │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Find room by ID                                                  │
│    Query: SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL LIMIT 1   │
│    Source: Room::find($id)                                                  │
│    Model: app/Models/Room/Room.php                                          │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response is constructed directly in controller (no Resource class used)     │
│                                                                             │
│ Fields returned:                                                            │
│   • id        → Room's primary key                                          │
│   • owner_id  → Room's user_id (owner)                                      │
│                                                                             │
│ Note: Response is intentionally minimal for performance and security        │
│       Only ownership data needed for MSAB verification is exposed           │
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

| File                          | Used By Endpoints            | Reusable | Reasoning                                       |
| ----------------------------- | ---------------------------- | -------- | ----------------------------------------------- |
| `InternalAuth.php`            | All internal endpoints       | ✅       | Generic middleware for internal service auth    |
| `Internal/RoomController.php` | Internal room endpoints only | ⭕       | Mixed - contains multiple internal room methods |
| `Room.php` (Model)            | All room-related endpoints   | ✅       | Core model used across entire application       |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (403)

| Error                                 | Source         | Condition                                |
| ------------------------------------- | -------------- | ---------------------------------------- |
| `Unauthorized. Invalid internal key.` | `InternalAuth` | Missing or invalid X-Internal-Key header |

### Not Found Errors (404)

| Error             | Source     | Condition                        |
| ----------------- | ---------- | -------------------------------- |
| `Room not found.` | Controller | Room with given ID doesn't exist |

### System Errors (500)

| Error               | Source   | Condition                     |
| ------------------- | -------- | ----------------------------- |
| Database connection | Eloquent | PostgreSQL connection failure |

### Edge Cases

| Case               | Behavior                                      |
| ------------------ | --------------------------------------------- |
| Soft-deleted room  | Returns 404 (SoftDeletes trait filters them)  |
| Non-numeric ID     | Eloquent handles gracefully, returns null/404 |
| Empty ID parameter | Route may not match, returns 404              |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT (MSAB)          MIDDLEWARE              CONTROLLER              DATABASE
    │                       │                       │                       │
    │  GET /internal/       │                       │                       │
    │  rooms/{id}           │                       │                       │
    │  X-Internal-Key: xxx  │                       │                       │
    │──────────────────────▶│                       │                       │
    │                       │                       │                       │
    │                       │ 1. Validate           │                       │
    │                       │    X-Internal-Key     │                       │
    │                       │    (hash_equals)      │                       │
    │                       │                       │                       │
    │                       │ 2. Pass if valid      │                       │
    │                       │──────────────────────▶│                       │
    │                       │                       │                       │
    │                       │                       │ 3. Room::find($id)    │
    │                       │                       │──────────────────────▶│
    │                       │                       │                       │
    │                       │                       │ 4. Return Room or null│
    │                       │                       │◀──────────────────────│
    │                       │                       │                       │
    │                       │                       │ 5. Build response     │
    │                       │                       │    {id, owner_id}     │
    │                       │                       │                       │
    │                       │◀──────────────────────│                       │
    │◀──────────────────────│                       │                       │
    │                       │                       │                       │
    │  200 OK + JSON        │                       │                       │
    │  {id, owner_id}       │                       │                       │
    │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                    |
| ------------------------ | ------------------------------------------- |
| New response field       | `Internal/RoomController.php:show()` method |
| Additional internal auth | `InternalAuth.php` middleware               |
| Caching                  | Add to controller before Room::find()       |
| Logging                  | Add to controller or middleware             |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                               | What to Change                        |
| ----- | -------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Controllers/Internal/RoomController.php` | Add field to response array in show() |

**Example: Adding `name` field**

```php
return response()->json([
    'id' => $room->id,
    'owner_id' => $room->user_id,
    'name' => $room->name,  // Add new field
]);
```

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                               | What to Change                           |
| ----- | -------------------------------------------------- | ---------------------------------------- |
| **1** | `app/Http/Controllers/Internal/RoomController.php` | Remove field from response array         |
| **2** | Notify MSAB team                                   | Coordinate breaking change with consumer |

### 🔗 Field Flow Dependency Chain

```
Request URL Parameter ({id})
         │
         ▼
┌─────────────────────┐
│    RoomController   │
│    show($id)        │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│     Room::find()    │
│   (Eloquent Query)  │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   Direct JSON       │
│   Response Build    │
└─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component               | Reason                                          |
| ----------------------- | ----------------------------------------------- |
| `X-Internal-Key` header | MSAB depends on this authentication mechanism   |
| Response field names    | MSAB socket server parses these fields          |
| `owner_id` mapping      | Used for ownership verification in audio server |
| Route path              | MSAB configuration depends on exact path        |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                         |
| ------------------------------------------ | -------------------------------------------------- |
| Changing `owner_id` to `user_id`           | MSAB expects `owner_id` - would break verification |
| Adding rate limiting                       | May cause socket connection failures at scale      |
| Removing `hash_equals` timing-safe compare | Opens timing attack vulnerability                  |
| Adding eager loading for unused relations  | Unnecessary performance overhead                   |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Middleware/
  └── InternalAuth.php                               ← Internal auth middleware
app/Http/Controllers/Internal/
  └── RoomController.php                             ← Controller
app/Models/Room/
  └── Room.php                                       ← Room model
config/services.php                                  ← MSAB internal_key config
```

---

## Document Metadata

| Property            | Value                             |
| ------------------- | --------------------------------- |
| **Endpoint**        | `GET /api/v1/internal/rooms/{id}` |
| **Domain**          | Internal                          |
| **Author**          | System Documentation              |
| **Created**         | 2026-02-01                        |
| **Laravel Version** | 12.x                              |
| **PHP Version**     | 8.4+                              |
