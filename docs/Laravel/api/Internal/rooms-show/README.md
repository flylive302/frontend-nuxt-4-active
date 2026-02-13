# GET /api/internal/rooms/{id}

> **Domain**: Internal / Room  
> **Type**: Internal Endpoint (MSAB Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Fetches minimal room data for MSAB to verify room ownership and permissions before allowing certain actions.

### Responsibilities

- Return room ID and owner ID
- Enable MSAB to verify if a user owns a room
- Support permission checks for room management actions

### What It Owns

| Owned       | Description                 |
| ----------- | --------------------------- |
| Room Lookup | Simple room existence check |

### External Dependencies

| Dependency | Type     | Purpose          |
| ---------- | -------- | ---------------- |
| PostgreSQL | Database | Room data source |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/internal/rooms/{id}
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
| `Accept`         | ✅       | `application/json` | Response format           |
| `X-Internal-Key` | ✅       | `string`           | MSAB internal service key |

### Request Body Schema

No request body - GET request.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "id": 123,
  "owner_id": 456
}
```

#### ❌ Room Not Found (404)

```json
{
  "message": "Room not found."
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
| `200` | Room data returned     |
| `403` | Invalid X-Internal-Key |
| `404` | Room ID not found      |
| `429` | Rate limit exceeded    |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/internal/rooms/{id}                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:27                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/rooms/{id}', [RoomController::class, 'show']);             │ │
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
│ File: app/Http/Controllers/Internal/RoomController.php:52-66                │
│ Method: show(string $id)                                                    │
│                                                                             │
│ STEP 1: Find room by ID                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($id);                                                │ │
│ │                                                                         │ │
│ │ if ($room === null) {                                                   │ │
│ │     return response()->json(['message' => 'Room not found.'], 404);     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return minimal data                                                 │
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
│                         HTTP RESPONSE SENT                                  │
│                           200 + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                            | Used By Endpoints          | Reusable | Reasoning         |
| ------------------------------- | -------------------------- | -------- | ----------------- |
| `InternalAuth.php`              | All internal endpoints     | ✅       | Shared middleware |
| `RoomController.php` (Internal) | 3 room endpoints           | ⭕       | Internal-specific |
| `Room.php` Model                | All room-related endpoints | ✅       | Core domain model |

---

## 5. Error Handling & Edge Cases

### Business Logic Errors (404)

| Error             | Source     | Condition             |
| ----------------- | ---------- | --------------------- |
| "Room not found." | Controller | Room ID doesn't exist |

### Edge Cases

| Case              | Behavior                         |
| ----------------- | -------------------------------- |
| Room soft-deleted | 404 (find excludes soft-deleted) |
| Invalid ID format | 404 (no matching room)           |

---

## 6. Sequence Diagram (Textual)

```
 MSAB                    MIDDLEWARE              CONTROLLER              DATABASE
   │                         │                       │                      │
   │  GET /rooms/{id}        │                       │                      │
   │  + X-Internal-Key       │                       │                      │
   │────────────────────────▶│                       │                      │
   │                         │                       │                      │
   │                         │ 1. InternalAuth       │                      │
   │                         │ 2. throttle           │                      │
   │                         │──────────────────────▶│                      │
   │                         │                       │                      │
   │                         │                       │ 3. Room::find($id)   │
   │                         │                       │─────────────────────▶│
   │                         │                       │◀─────────────────────│
   │                         │                       │                      │
   │                         │◀──────────────────────│                      │
   │◀────────────────────────│                       │                      │
   │                         │                       │                      │
   │  200 {id, owner_id}     │                       │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location                        |
| ---------------------- | ------------------------------- |
| Additional room fields | Controller `show()` response    |
| Caching                | Add `Cache::remember()` wrapper |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                  | What to Change              |
| ----- | --------------------- | --------------------------- |
| **1** | `RoomController@show` | Add field to response array |
| **2** | Coordinate with MSAB  | Handle new field            |

### ⚠️ What Should NOT Be Modified Casually

| Component      | Reason                          |
| -------------- | ------------------------------- |
| `owner_id` key | MSAB uses for ownership checks  |
| Response shape | Breaking change for MSAB client |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Controllers/Internal/
  └── RoomController.php                             ← Controller
app/Models/Room/
  └── Room.php                                       ← Room model
```

---

## 8. MSAB Event Contracts

### Incoming (MSAB → Laravel)

Simple data fetch request. MSAB uses this to verify if a user is the room owner before allowing admin actions.

### Outgoing (Laravel → MSAB)

No events are emitted by this endpoint.

---

## Document Metadata

| Property            | Value                          |
| ------------------- | ------------------------------ |
| **Endpoint**        | `GET /api/internal/rooms/{id}` |
| **Domain**          | Internal / Room                |
| **Author**          | System Documentation           |
| **Created**         | 2026-02-04                     |
| **Laravel Version** | 12.x                           |
| **PHP Version**     | 8.4+                           |
