# POST /api/internal/rooms/{id}/status

> **Domain**: Internal / Room  
> **Type**: Internal Endpoint (MSAB Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Updates room live state and participant count in real-time as MSAB manages voice room sessions.

### Responsibilities

- Update room `is_live` status when sessions start/end
- Track `participant_count` for active room display
- Invalidate room cache to reflect changes immediately
- Update `last_activity_at` timestamp

### What It Owns

| Owned               | Description                                        |
| ------------------- | -------------------------------------------------- |
| Room Status Updates | `is_live`, `participant_count`, `last_activity_at` |
| Cache Invalidation  | `room:{id}:live` cache key                         |

### External Dependencies

| Dependency | Type           | Purpose                        |
| ---------- | -------------- | ------------------------------ |
| Redis      | Infrastructure | Cache storage and invalidation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/internal/rooms/{id}/status
```

### Authentication

✅ **Required** - X-Internal-Key header only (no user token)

### Rate Limiting

| Limiter        | Key                         | Config               |
| -------------- | --------------------------- | -------------------- |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests/minute |

### Path Parameters

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `id`      | `string` | Room ID     |

### Request Headers

| Header           | Required | Type               | Description               |
| ---------------- | -------- | ------------------ | ------------------------- |
| `Content-Type`   | ✅       | `application/json` | Request body format       |
| `Accept`         | ✅       | `application/json` | Response format           |
| `X-Internal-Key` | ✅       | `string`           | MSAB internal service key |

### Request Body Schema

```json
{
  "is_live": "boolean", // Required, current live state
  "participant_count": "integer", // Required, current user count (min: 0)
  "started_at": "datetime|null", // Optional, session start time
  "ended_at": "datetime|null" // Optional, session end time
}
```

#### Field Details

| Field               | Type       | Constraints        | Example                  |
| ------------------- | ---------- | ------------------ | ------------------------ |
| `is_live`           | `boolean`  | Required           | `true`                   |
| `participant_count` | `integer`  | Required, min: 0   | `15`                     |
| `started_at`        | `datetime` | Optional, nullable | `"2026-02-04T01:30:00Z"` |
| `ended_at`          | `datetime` | Optional, nullable | `"2026-02-04T02:00:00Z"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "success": true
}
```

#### ❌ Room Not Found (404)

```json
{
  "message": "Room not found."
}
```

#### ❌ Validation Error (422)

```json
{
  "message": "The is_live field is required.",
  "errors": {
    "is_live": ["The is_live field is required."]
  }
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

| Code  | Condition                        |
| ----- | -------------------------------- |
| `200` | Room status updated successfully |
| `403` | Invalid X-Internal-Key           |
| `404` | Room ID not found                |
| `422` | Validation failed                |
| `429` | Rate limit exceeded              |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/internal/rooms/{id}/status                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:24                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/rooms/{id}/status', [RoomController::class, 'updateStatus']); │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth          → Validates X-Internal-Key header                │
│   2. throttle:internal_api → 1000 req/min per service key                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER VALIDATION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:19-27                │
│ Method: updateStatus(Request $request, string $id)                          │
│                                                                             │
│ STEP 1: Inline validation using Validator facade                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = Validator::make($request->all(), [                         │ │
│ │     'is_live' => 'required|boolean',                                    │ │
│ │     'participant_count' => 'required|integer|min:0',                    │ │
│ │     'started_at' => 'nullable|date',                                    │ │
│ │     'ended_at' => 'nullable|date',                                      │ │
│ │ ])->validate();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If validation fails → 422 with field errors                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 ROOM LOOKUP                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:29-32                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($id);                                                │ │
│ │                                                                         │ │
│ │ if ($room === null) {                                                   │ │
│ │     return response()->json(['message' => 'Room not found.'], 404);     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DATABASE UPDATE                                                         │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:34-43                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $updateData = [                                                         │ │
│ │     'is_live' => $validated['is_live'],                                 │ │
│ │     'participant_count' => $validated['participant_count'],             │ │
│ │     'last_activity_at' => now(),                                        │ │
│ │ ];                                                                      │ │
│ │                                                                         │ │
│ │ $room->update($updateData);                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Query: UPDATE rooms SET is_live=?, participant_count=?,                     │
│        last_activity_at=?, updated_at=? WHERE id=?                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 CACHE INVALIDATION                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:46                   │
│ Comment: INT-003 - Invalidate room cache after status update                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cache::forget("room:{$id}:live");                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ This ensures gift transactions will query fresh room data.                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:48                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['success' => true]);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                            | Used By Endpoints          | Reusable | Reasoning                    |
| ------------------------------- | -------------------------- | -------- | ---------------------------- |
| `InternalAuth.php`              | All internal endpoints     | ✅       | Shared middleware            |
| `RoomController.php` (Internal) | 3 room endpoints           | ⭕       | Internal-specific controller |
| `Room.php` Model                | All room-related endpoints | ✅       | Core domain model            |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                        | Source    | Condition             |
| ---------------------------- | --------- | --------------------- |
| `is_live.required`           | Validator | Missing is_live field |
| `is_live.boolean`            | Validator | Invalid boolean value |
| `participant_count.required` | Validator | Missing count field   |
| `participant_count.integer`  | Validator | Non-integer value     |
| `participant_count.min`      | Validator | Negative count        |
| `started_at.date`            | Validator | Invalid date format   |

### Business Logic Errors (404)

| Error             | Source     | Condition             |
| ----------------- | ---------- | --------------------- |
| "Room not found." | Controller | Room ID doesn't exist |

### Edge Cases

| Case                         | Behavior                                     |
| ---------------------------- | -------------------------------------------- |
| Room soft-deleted            | 404 (Room::find excludes deleted)            |
| Rapid status updates         | Each update invalidates cache                |
| Concurrent updates           | Last write wins (no locking)                 |
| `started_at`/`ended_at` sent | Currently ignored (future use noted in code) |

---

## 6. Sequence Diagram (Textual)

```
 MSAB                    MIDDLEWARE              CONTROLLER              DATABASE/CACHE
   │                         │                       │                         │
   │  POST /rooms/{id}/status│                       │                         │
   │  + X-Internal-Key       │                       │                         │
   │  + is_live, count       │                       │                         │
   │────────────────────────▶│                       │                         │
   │                         │                       │                         │
   │                         │ 1. InternalAuth       │                         │
   │                         │    hash_equals(key)   │                         │
   │                         │                       │                         │
   │                         │ 2. throttle:internal  │                         │
   │                         │────────────────────── │                         │
   │                         │                       │                         │
   │                         │                       │ 3. Validator::make()    │
   │                         │                       │                         │
   │                         │                       │ 4. Room::find($id)      │
   │                         │                       │────────────────────────▶│
   │                         │                       │◀────────────────────────│
   │                         │                       │                         │
   │                         │                       │ 5. $room->update()      │
   │                         │                       │────────────────────────▶│
   │                         │                       │◀────────────────────────│
   │                         │                       │                         │
   │                         │                       │ 6. Cache::forget()      │
   │                         │                       │────────────────────────▶│
   │                         │                       │◀────────────────────────│
   │                         │                       │                         │
   │                         │◀──────────────────────│                         │
   │◀────────────────────────│                       │                         │
   │                         │                       │                         │
   │  200 {"success": true}  │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition             | Location                             |
| -------------------- | ------------------------------------ |
| New status fields    | `updateStatus()` validation + update |
| Session tracking     | New `live_sessions` table            |
| Status change events | Add after `$room->update()`          |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW STATUS FIELD

| Step  | File                          | What to Change             |
| ----- | ----------------------------- | -------------------------- |
| **1** | Database Migration            | Add column to `rooms`      |
| **2** | `app/Models/Room/Room.php`    | Add to `$fillable`         |
| **3** | `RoomController@updateStatus` | Add to validation + update |
| **4** | Coordinate with MSAB          | Send new field             |

### ⚠️ What Should NOT Be Modified Casually

| Component        | Reason                               |
| ---------------- | ------------------------------------ |
| Cache key format | GiftTransactionService depends on it |
| Validation rules | MSAB expects specific contract       |
| Response format  | MSAB parses `success` field          |

### 🚨 Common Pitfalls

| Pitfall                            | Prevention                              |
| ---------------------------------- | --------------------------------------- |
| Forgetting cache invalidation      | Always clear `room:{id}:live` on update |
| Adding locking                     | Not needed - eventual consistency OK    |
| Processing `started_at`/`ended_at` | These are for future use, log planned   |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Middleware/InternalAuth.php                 ← Internal key validation
app/Http/Controllers/Internal/
  └── RoomController.php                             ← Controller
app/Models/Room/
  └── Room.php                                       ← Room model
```

---

## 8. MSAB Event Contracts

### Incoming (MSAB → Laravel)

MSAB pushes room status whenever:

- Voice room session starts (`is_live: true`)
- Participants join/leave (updated `participant_count`)
- Voice room session ends (`is_live: false`)

| Field               | Type     | Description                |
| ------------------- | -------- | -------------------------- |
| `is_live`           | boolean  | Current session state      |
| `participant_count` | integer  | Active user count          |
| `started_at`        | datetime | Session start (future use) |
| `ended_at`          | datetime | Session end (future use)   |

### Outgoing (Laravel → MSAB)

No events are emitted by this endpoint.

---

## Document Metadata

| Property            | Value                                  |
| ------------------- | -------------------------------------- |
| **Endpoint**        | `POST /api/internal/rooms/{id}/status` |
| **Domain**          | Internal / Room                        |
| **Author**          | System Documentation                   |
| **Created**         | 2026-02-04                             |
| **Laravel Version** | 12.x                                   |
| **PHP Version**     | 8.4+                                   |
