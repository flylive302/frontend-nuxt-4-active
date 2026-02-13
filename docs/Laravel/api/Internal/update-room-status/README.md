# POST /api/v1/internal/rooms/{id}/status

> **Domain**: Internal  
> **Type**: Internal Microservice Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Update the live status and participant count of a room. This internal endpoint is called by the MSAB Audio Server to synchronize room state (live/offline, participant count) with the backend.

### Responsibilities

- Validate internal service authentication via `X-Internal-Key` header
- Validate incoming room status payload
- Update room's `is_live`, `participant_count`, and `last_activity_at` fields
- Return success confirmation to the calling microservice

### What It Owns

| Owned             | Description                                          |
| ----------------- | ---------------------------------------------------- |
| Room live state   | Updates `is_live` boolean flag                       |
| Participant count | Updates `participant_count` integer                  |
| Last activity     | Auto-updates `last_activity_at` to current timestamp |

### External Dependencies

| Dependency  | Type         | Purpose                                    |
| ----------- | ------------ | ------------------------------------------ |
| PostgreSQL  | Database     | Stores room data in `rooms` table          |
| MSAB Server | Microservice | Caller of this endpoint for status updates |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/internal/rooms/{id}/status
```

### Authentication

❌ **No User Authentication** - Internal service authentication via `X-Internal-Key` header

### Rate Limiting

| Limiter        | Key                         | Config                               |
| -------------- | --------------------------- | ------------------------------------ |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests per minute per service |

### Request Headers

| Header           | Required | Type               | Description                    |
| ---------------- | -------- | ------------------ | ------------------------------ |
| `Content-Type`   | ✅       | `application/json` | Request body format            |
| `Accept`         | ✅       | `application/json` | Response format                |
| `X-Internal-Key` | ✅       | `string`           | Internal microservice auth key |

### Path Parameters

| Parameter | Type     | Description           | Example   |
| --------- | -------- | --------------------- | --------- |
| `id`      | `string` | Room ID (primary key) | `"12345"` |

### Request Body Schema

```json
{
  "is_live": "boolean", // Required, room's live state
  "participant_count": "integer", // Required, number of participants (min: 0)
  "started_at": "datetime|null", // Optional, when room went live
  "ended_at": "datetime|null" // Optional, when room went offline
}
```

#### Field Details

| Field               | Type       | Constraints        | Example                  |
| ------------------- | ---------- | ------------------ | ------------------------ |
| `is_live`           | `boolean`  | Required           | `true`                   |
| `participant_count` | `integer`  | Required, min: 0   | `15`                     |
| `started_at`        | `datetime` | Optional, nullable | `"2026-02-01T10:00:00Z"` |
| `ended_at`          | `datetime` | Optional, nullable | `"2026-02-01T12:00:00Z"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "success": true
}
```

#### ❌ Validation Error (422)

```json
{
  "message": "The is_live field is required.",
  "errors": {
    "is_live": ["The is_live field is required."],
    "participant_count": ["The participant_count field is required."]
  }
}
```

#### ❌ Authentication Error (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

#### ❌ Room Not Found (404)

```json
{
  "message": "Room not found."
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `200` | Room status updated successfully           |
| `403` | Invalid or missing `X-Internal-Key` header |
| `404` | Room with specified ID not found           |
| `422` | Validation failed (missing/invalid fields) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│               POST /api/v1/internal/rooms/{id}/status                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:24                                            │
│ Route: Route::post('/rooms/{id}/status', [RoomController::class,            │
│        'updateStatus'])                                                     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth  → Validates X-Internal-Key header                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('internal')->middleware([InternalAuth::class])            │ │
│ │     ->group(function () {                                               │ │
│ │     Route::post('/rooms/{id}/status',                                   │ │
│ │         [RoomController::class, 'updateStatus']);                       │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE: INTERNAL AUTHENTICATION                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/InternalAuth.php:16-28                            │
│                                                                             │
│ Validates the X-Internal-Key header against configured key.                 │
│ Returns 403 if key is missing, null, or doesn't match.                      │
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
│ │     return $next($request);                                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:19-46                │
│ Method: updateStatus(Request $request, string $id)                          │
│                                                                             │
│ STEP 1: Validate Request Payload                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = Validator::make($request->all(), [                         │ │
│ │     'is_live' => 'required|boolean',                                    │ │
│ │     'participant_count' => 'required|integer|min:0',                    │ │
│ │     'started_at' => 'nullable|date',                                    │ │
│ │     'ended_at' => 'nullable|date',                                      │ │
│ │ ])->validate();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find Room by ID                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($id);                                                │ │
│ │                                                                         │ │
│ │ if ($room === null) {                                                   │ │
│ │     return response()->json(['message' => 'Room not found.'], 404);     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Prepare Update Data                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $updateData = [                                                         │ │
│ │     'is_live' => $validated['is_live'],                                 │ │
│ │     'participant_count' => $validated['participant_count'],             │ │
│ │     'last_activity_at' => now(),                                        │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Update Room and Return                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room->update($updateData);                                             │ │
│ │                                                                         │ │
│ │ return response()->json(['success' => true]);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No service layer is used for this endpoint.                                 │
│ All logic is handled directly in the controller.                            │
│                                                                             │
│ Note: This is an internal endpoint with simple update logic.                │
│ The controller directly interacts with the Room model.                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Room (Eloquent Model)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Represents room data and database operations            │ │
│ │ Reusable: YES (used across all room-related endpoints)                  │ │
│ │ Why It Exists: Core domain model for room management                    │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • is_live        → boolean, room's live state                         │ │
│ │   • participant_count → integer, number of participants                 │ │
│ │   • last_activity_at  → datetime, last activity timestamp               │ │
│ │                                                                         │ │
│ │ Fillable Fields:                                                        │ │
│ │   'is_live', 'participant_count', 'last_activity_at', ...               │ │
│ │                                                                         │ │
│ │ Casts:                                                                  │ │
│ │   'is_live' => 'boolean',                                               │ │
│ │   'participant_count' => 'integer',                                     │ │
│ │   'last_activity_at' => 'datetime',                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: InternalAuth (Middleware)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Middleware/InternalAuth.php                              │ │
│ │ Responsibility: Validate internal microservice authentication           │ │
│ │ Reusable: YES (used for all internal API routes)                        │ │
│ │ Why It Exists: Secure internal API from unauthorized access             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • handle() → Validates X-Internal-Key header using hash_equals        │ │
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
│ 1. SELECT: Find room by ID                                                  │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Room::find($id)                                                  │
│                                                                             │
│ 2. UPDATE: Update room status fields                                        │
│    Query: UPDATE rooms SET is_live = ?, participant_count = ?,              │
│           last_activity_at = ?, updated_at = ? WHERE id = ?                 │
│    Source: $room->update($updateData)                                       │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│   None                                                                      │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│   None                                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Simple JSON response with success flag:                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['success' => true]);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ No API Resource is used - response is directly constructed in controller.   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                        200 OK + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                          | Used By Endpoints            | Reusable | Reasoning                                               |
| ----------------------------- | ---------------------------- | -------- | ------------------------------------------------------- |
| `InternalAuth.php`            | All internal API routes      | ✅       | Generic middleware for internal service auth            |
| `Room.php` (Model)            | All room-related endpoints   | ✅       | Core domain model                                       |
| `Internal/RoomController.php` | Internal room endpoints only | ⭕       | Specific to internal API but contains reusable patterns |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                        | Source    | Condition                              |
| ---------------------------- | --------- | -------------------------------------- |
| `is_live.required`           | Validator | `is_live` field not provided           |
| `is_live.boolean`            | Validator | `is_live` is not a boolean             |
| `participant_count.required` | Validator | `participant_count` field not provided |
| `participant_count.integer`  | Validator | `participant_count` is not an integer  |
| `participant_count.min`      | Validator | `participant_count` is less than 0     |
| `started_at.date`            | Validator | `started_at` is not a valid date       |
| `ended_at.date`              | Validator | `ended_at` is not a valid date         |

### Authentication Errors (403)

| Error                                 | Source       | Condition                                  |
| ------------------------------------- | ------------ | ------------------------------------------ |
| "Unauthorized. Invalid internal key." | InternalAuth | Missing or invalid `X-Internal-Key` header |

### Not Found Errors (404)

| Error             | Source     | Condition                             |
| ----------------- | ---------- | ------------------------------------- |
| "Room not found." | Controller | Room with specified ID does not exist |

### System Errors (500)

| Error              | Source    | Condition                             |
| ------------------ | --------- | ------------------------------------- |
| "Database error"   | Database  | Database connection failure           |
| "Unexpected error" | Framework | Unhandled exception during processing |

### Edge Cases

| Case                             | Behavior                                        |
| -------------------------------- | ----------------------------------------------- |
| Room was soft-deleted            | Returns 404 (soft deletes excluded by default)  |
| Concurrent status updates        | Last update wins (no locking mechanism)         |
| `started_at`/`ended_at` provided | Currently ignored (noted for future use)        |
| Negative participant_count       | Rejected by validation (min:0 rule)             |
| Non-numeric room ID              | Passed as string, Room::find handles gracefully |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT (MSAB)          MIDDLEWARE              CONTROLLER                    DATABASE
    │                       │                       │                            │
    │  POST /internal/      │                       │                            │
    │  rooms/{id}/status    │                       │                            │
    │  + X-Internal-Key     │                       │                            │
    │──────────────────────▶│                       │                            │
    │                       │                       │                            │
    │                       │ 1. Validate           │                            │
    │                       │    X-Internal-Key     │                            │
    │                       │    header             │                            │
    │                       │                       │                            │
    │                       │ [If invalid: 403]     │                            │
    │                       │                       │                            │
    │                       │ 2. Pass to controller │                            │
    │                       │──────────────────────▶│                            │
    │                       │                       │                            │
    │                       │                       │ 3. Validate request        │
    │                       │                       │    payload                 │
    │                       │                       │                            │
    │                       │                       │ [If invalid: 422]          │
    │                       │                       │                            │
    │                       │                       │ 4. SELECT room by ID       │
    │                       │                       │───────────────────────────▶│
    │                       │                       │◀───────────────────────────│
    │                       │                       │                            │
    │                       │                       │ [If not found: 404]        │
    │                       │                       │                            │
    │                       │                       │ 5. UPDATE room status      │
    │                       │                       │───────────────────────────▶│
    │                       │                       │◀───────────────────────────│
    │                       │                       │                            │
    │                       │                       │ 6. Build success response  │
    │                       │◀──────────────────────│                            │
    │◀──────────────────────│                       │                            │
    │                       │                       │                            │
    │  200 OK               │                       │                            │
    │  {"success": true}    │                       │                            │
    │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                         |
| -------------------------- | ------------------------------------------------ |
| New status field           | Validator rules, `$updateData` array, Room model |
| Broadcasting status change | After `$room->update()` in controller            |
| Logging status transitions | After `$room->update()` in controller            |
| Live session tracking      | Create `live_sessions` table and service         |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW STATUS FIELD (e.g., `peak_participants`)

| Step  | File                                               | What to Change                             |
| ----- | -------------------------------------------------- | ------------------------------------------ |
| **1** | **Database Migration**                             | Add column to `rooms` table                |
| **2** | `app/Models/Room/Room.php`                         | Add to `$fillable` and `casts()` if needed |
| **3** | `app/Http/Controllers/Internal/RoomController.php` | Add validation rule and to `$updateData`   |

**Example:**

```php
// Step 3: In RoomController.php updateStatus()

// Add to validation rules
'peak_participants' => 'nullable|integer|min:0',

// Add to $updateData
$updateData = [
    'is_live' => $validated['is_live'],
    'participant_count' => $validated['participant_count'],
    'peak_participants' => $validated['peak_participants'] ?? null,
    'last_activity_at' => now(),
];
```

#### ➖ REMOVING A STATUS FIELD

| Step  | File                                               | What to Change                           |
| ----- | -------------------------------------------------- | ---------------------------------------- |
| **1** | `app/Http/Controllers/Internal/RoomController.php` | Remove from validation and `$updateData` |
| **2** | `app/Models/Room/Room.php`                         | Remove from `$fillable` and `casts()`    |
| **3** | **Database Migration**                             | Drop column (if safe)                    |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIELD FLOW: is_live                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Request Body                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  Validator::make()          'is_live' => 'required|boolean'                 │
│  (RoomController.php:21)                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  $updateData array          'is_live' => $validated['is_live']              │
│  (RoomController.php:35)                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  $room->update()            Mass assignment via $fillable                   │
│       │                                                                     │
│       ▼                                                                     │
│  Database                   rooms.is_live column                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                               | Reason                                             |
| --------------------------------------- | -------------------------------------------------- |
| `InternalAuth` middleware               | Security-critical; protects all internal endpoints |
| `X-Internal-Key` validation             | Uses `hash_equals` for timing-attack protection    |
| Config key `services.msab.internal_key` | Must match MSAB server configuration               |
| Response format                         | MSAB server depends on `success` key in response   |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                      |
| -------------------------------------- | ----------------------------------------------- |
| Forgetting to add field to `$fillable` | Always update Room model when adding new fields |
| Changing response structure            | MSAB server expects `{"success": true}` format  |
| Removing required validation rules     | Could cause database integrity issues           |
| Hardcoding internal key                | Always use config('services.msab.internal_key') |
| Not casting boolean fields             | Add to model's `casts()` method                 |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                             ← Route definition
app/Http/Middleware/
  └── InternalAuth.php                              ← Internal auth middleware
app/Http/Controllers/Internal/
  └── RoomController.php                            ← Controller with updateStatus()
app/Models/Room/
  └── Room.php                                      ← Room Eloquent model
config/services.php                                 ← MSAB internal key config
```

---

## Document Metadata

| Property            | Value                                     |
| ------------------- | ----------------------------------------- |
| **Endpoint**        | `POST /api/v1/internal/rooms/{id}/status` |
| **Domain**          | Internal                                  |
| **Author**          | System Documentation                      |
| **Created**         | 2026-02-01                                |
| **Laravel Version** | 12.x                                      |
| **PHP Version**     | 8.4                                       |
