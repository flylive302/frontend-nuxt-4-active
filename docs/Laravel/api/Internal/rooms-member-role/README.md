# GET /api/internal/rooms/{roomId}/members/{userId}/role

> **Domain**: Internal / Room  
> **Type**: Internal Endpoint (MSAB Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Verifies a user's role within a room for MSAB to enforce permission-based actions in voice rooms.

### Responsibilities

- Check if user is the room owner
- Query room membership for admins and regular members
- Return role string for MSAB permission decisions

### What It Owns

| Owned       | Description                          |
| ----------- | ------------------------------------ |
| Role Lookup | Determines owner/admin/member status |

### External Dependencies

| Dependency | Type     | Purpose             |
| ---------- | -------- | ------------------- |
| PostgreSQL | Database | Room members lookup |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/internal/rooms/{roomId}/members/{userId}/role
```

### Authentication

✅ **Required** - X-Internal-Key header only (no user token)

### Rate Limiting

| Limiter        | Key                         | Config               |
| -------------- | --------------------------- | -------------------- |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests/minute |

### Path Parameters

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `roomId`  | `string` | Room ID               |
| `userId`  | `string` | User ID to check role |

### Request Headers

| Header           | Required | Type               | Description               |
| ---------------- | -------- | ------------------ | ------------------------- |
| `Accept`         | ✅       | `application/json` | Response format           |
| `X-Internal-Key` | ✅       | `string`           | MSAB internal service key |

### Request Body Schema

No request body - GET request.

---

### Response Schemas

#### ✅ Success Response - Owner (200)

```json
{
  "role": "owner"
}
```

#### ✅ Success Response - Admin (200)

```json
{
  "role": "admin"
}
```

#### ✅ Success Response - Member (200)

```json
{
  "role": "member"
}
```

#### ❌ Room Not Found (404)

```json
{
  "message": "Room not found."
}
```

#### ❌ User Not Found in Room (404)

```json
{
  "message": "User not found in room."
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

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Role returned successfully        |
| `403` | Invalid X-Internal-Key            |
| `404` | Room or user membership not found |
| `429` | Rate limit exceeded               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│            GET /api/internal/rooms/{roomId}/members/{userId}/role           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:30                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/rooms/{roomId}/members/{userId}/role',                     │ │
│ │     [RoomController::class, 'getMemberRole']);                          │ │
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
│ File: app/Http/Controllers/Internal/RoomController.php:69-96                │
│ Method: getMemberRole(string $roomId, string $userId)                       │
│                                                                             │
│ STEP 1: Find room                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($roomId);                                            │ │
│ │                                                                         │ │
│ │ if ($room === null) {                                                   │ │
│ │     return response()->json(['message' => 'Room not found.'], 404);     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if user is owner (fast path)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ((int) $userId === $room->user_id) {                                 │ │
│ │     return response()->json(['role' => 'owner']);                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Query room membership                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member = $room->members()                                              │ │
│ │     ->where('user_id', $userId)                                         │ │
│ │     ->where('status', RoomMemberStatus::ACTIVE)                         │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($member === null) {                                                 │ │
│ │     return response()->json(['message' => 'User not found in room.'], 404); │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return member role                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['role' => $member->role]);                     │ │
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
| `RoomMemberStatus` Enum         | Room membership features   | ✅       | Status constants  |

---

## 5. Error Handling & Edge Cases

### Business Logic Errors (404)

| Error                     | Source     | Condition                     |
| ------------------------- | ---------- | ----------------------------- |
| "Room not found."         | Controller | Room ID doesn't exist         |
| "User not found in room." | Controller | User has no active membership |

### Edge Cases

| Case                    | Behavior                             |
| ----------------------- | ------------------------------------ |
| User is owner           | Returns "owner" (skips member query) |
| User is inactive member | 404 (only ACTIVE status checked)     |
| User was banned         | 404 (status not ACTIVE)              |
| Room soft-deleted       | 404 (Room::find excludes deleted)    |

---

## 6. Sequence Diagram (Textual)

```
 MSAB                    MIDDLEWARE              CONTROLLER              DATABASE
   │                         │                       │                      │
   │  GET /rooms/{roomId}/   │                       │                      │
   │    members/{userId}/role│                       │                      │
   │  + X-Internal-Key       │                       │                      │
   │────────────────────────▶│                       │                      │
   │                         │                       │                      │
   │                         │ 1. InternalAuth       │                      │
   │                         │ 2. throttle           │                      │
   │                         │──────────────────────▶│                      │
   │                         │                       │                      │
   │                         │                       │ 3. Room::find()      │
   │                         │                       │─────────────────────▶│
   │                         │                       │◀─────────────────────│
   │                         │                       │                      │
   │                         │                       │ 4. Check ownership   │
   │                         │                       │    (if owner → done) │
   │                         │                       │                      │
   │                         │                       │ 5. Query members     │
   │                         │                       │    (if not owner)    │
   │                         │                       │─────────────────────▶│
   │                         │                       │◀─────────────────────│
   │                         │                       │                      │
   │                         │◀──────────────────────│                      │
   │◀────────────────────────│                       │                      │
   │                         │                       │                      │
   │  200 {"role": "admin"}  │                       │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition          | Location                        |
| ----------------- | ------------------------------- |
| New role types    | `RoomMemberRole` enum           |
| Permission checks | Controller before returning     |
| Caching           | Add `Cache::remember()` wrapper |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW ROLE TYPE

| Step  | File                                | What to Change        |
| ----- | ----------------------------------- | --------------------- |
| **1** | `app/Enums/Room/RoomMemberRole.php` | Add new enum case     |
| **2** | Coordinate with MSAB                | Handle new role value |

### ⚠️ What Should NOT Be Modified Casually

| Component            | Reason                             |
| -------------------- | ---------------------------------- |
| "owner" string value | MSAB hardcodes permission checks   |
| Order of checks      | Owner check should be first (fast) |
| ACTIVE status filter | Prevents banned users from actions |

### 🚨 Common Pitfalls

| Pitfall                        | Prevention                         |
| ------------------------------ | ---------------------------------- |
| Returning role for inactive    | Always filter by ACTIVE status     |
| Case-sensitive role comparison | Keep role values lowercase         |
| Forgetting owner check         | Owner is not in room_members table |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Controllers/Internal/
  └── RoomController.php                             ← Controller
app/Models/Room/
  ├── Room.php                                       ← Room model
  └── RoomMember.php                                 ← Member model
app/Enums/Room/
  └── RoomMemberStatus.php                           ← Status enum
```

---

## 8. MSAB Event Contracts

### Incoming (MSAB → Laravel)

MSAB queries this endpoint to check if a user has permission to:

- Kick other users from voice room
- Mute/unmute participants
- Manage room settings
- Perform admin-only actions

| Role     | Permissions (in MSAB)         |
| -------- | ----------------------------- |
| `owner`  | Full control                  |
| `admin`  | Kick, mute, manage non-admins |
| `member` | Basic participant permissions |

### Outgoing (Laravel → MSAB)

No events are emitted by this endpoint.

---

## Document Metadata

| Property            | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **Endpoint**        | `GET /api/internal/rooms/{roomId}/members/{userId}/role` |
| **Domain**          | Internal / Room                                          |
| **Author**          | System Documentation                                     |
| **Created**         | 2026-02-04                                               |
| **Laravel Version** | 12.x                                                     |
| **PHP Version**     | 8.4+                                                     |
