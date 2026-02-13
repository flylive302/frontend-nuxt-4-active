# GET /api/v1/internal/rooms/{roomId}/members/{userId}/role

> **Domain**: Internal Microservice API  
> **Type**: Protected Endpoint (Internal Key Required)  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

This endpoint retrieves a user's role in a specific room for internal admin/owner verification by the MSAB Audio Server.

### Responsibilities

- Validate internal authentication key
- Verify room exists
- Determine if user is room owner
- Retrieve active member role for non-owners

### What It Owns

| Owned          | Description                                            |
| -------------- | ------------------------------------------------------ |
| Role retrieval | Returns user's role (owner, admin, member) in the room |

### External Dependencies

| Dependency | Type           | Purpose                        |
| ---------- | -------------- | ------------------------------ |
| PostgreSQL | Database       | Room and member data retrieval |
| MSAB       | Infrastructure | Audio server consuming the API |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/internal/rooms/{roomId}/members/{userId}/role
```

### Authentication

✅ **Internal Key Required** - Request must include valid `X-Internal-Key` header

### Rate Limiting

| Limiter        | Key                         | Config                               |
| -------------- | --------------------------- | ------------------------------------ |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests per minute per service |

### Request Headers

| Header           | Required | Type               | Description                 |
| ---------------- | -------- | ------------------ | --------------------------- |
| `Accept`         | ✅       | `application/json` | Response format             |
| `X-Internal-Key` | ✅       | `string`           | Internal authentication key |

### URL Parameters

| Parameter | Type     | Constraints | Example | Description        |
| --------- | -------- | ----------- | ------- | ------------------ |
| `roomId`  | `string` | Required    | `"123"` | Room ID to check   |
| `userId`  | `string` | Required    | `"456"` | User ID to look up |

---

### Response Schemas

#### ✅ Success Response - Owner (200)

```json
{
  "role": "owner"
}
```

#### ✅ Success Response - Member/Admin (200)

```json
{
  "role": "admin" // or "member"
}
```

#### ❌ Room Not Found (404)

```json
{
  "message": "Room not found."
}
```

#### ❌ User Not In Room (404)

```json
{
  "message": "User not found in room."
}
```

#### ❌ Unauthorized (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

### HTTP Status Codes

| Code  | Condition                                      |
| ----- | ---------------------------------------------- |
| `200` | Role retrieved successfully                    |
| `403` | Invalid or missing internal key                |
| `404` | Room not found OR user is not an active member |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│         GET /api/v1/internal/rooms/{roomId}/members/{userId}/role           │
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
│   1. InternalAuth → Validates X-Internal-Key header                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE - INTERNAL AUTHENTICATION                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/InternalAuth.php:16-28                            │
│                                                                             │
│ Validates X-Internal-Key header against config value                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function handle(Request $request, Closure $next): Response       │ │
│ │ {                                                                       │ │
│ │     $internalKey = $request->header('X-Internal-Key');                  │ │
│ │     $expectedKey = config('services.msab.internal_key');                │ │
│ │                                                                         │ │
│ │     if ($internalKey === null || $expectedKey === null                  │ │
│ │         || ! hash_equals($expectedKey, $internalKey)) {                 │ │
│ │         return response()->json([                                       │ │
│ │             'message' => 'Unauthorized. Invalid internal key.',         │ │
│ │             'error_code' => 'INTERNAL_AUTH_FAILED',                     │ │
│ │         ], 403);                                                        │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return $next($request);                                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Security: Uses hash_equals() for timing-safe comparison                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/RoomController.php:68-92                │
│ Method: getMemberRole(string $roomId, string $userId): JsonResponse         │
│                                                                             │
│ STEP 1: Find room by ID                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($roomId);                                            │ │
│ │                                                                         │ │
│ │ if ($room === null) {                                                   │ │
│ │     return response()->json(['message' => 'Room not found.'], 404);     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if user is room owner                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ((int) $userId === $room->user_id) {                                 │ │
│ │     return response()->json(['role' => 'owner']);                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Query room membership with active status                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member = $room->members()                                              │ │
│ │     ->where('user_id', $userId)                                         │ │
│ │     ->where('status', RoomMemberStatus::ACTIVE)                         │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($member === null) {                                                 │ │
│ │     return response()->json(                                            │ │
│ │         ['message' => 'User not found in room.'], 404);                 │ │
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
│ 3.4 SERVICE LAYER (None - Direct Controller Logic)                          │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint uses direct controller logic without a service layer.         │
│ The logic is simple and internal-only, suitable for inline implementation.  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Room (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Represents room entity, owns members relationship       │ │
│ │ Reusable: YES (used by all room-related endpoints)                      │ │
│ │ Why It Exists: Core domain model for rooms                              │ │
│ │                                                                         │ │
│ │ Key Methods/Properties:                                                 │ │
│ │   • user_id        → Room owner's user ID                               │ │
│ │   • members()      → HasMany relationship to RoomMember                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Represents room membership with role and status         │ │
│ │ Reusable: YES (used by all member-related endpoints)                    │ │
│ │ Why It Exists: Tracks user membership in rooms                          │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • user_id        → Member's user ID                                   │ │
│ │   • role           → RoomMemberRole enum (owner, admin, member)         │ │
│ │   • status         → RoomMemberStatus enum (active, left, kicked, etc.) │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Defines possible member roles                           │ │
│ │ Reusable: YES (used across room features)                               │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • OWNER  = 'owner'                                                    │ │
│ │   • ADMIN  = 'admin'                                                    │ │
│ │   • MEMBER = 'member'                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberStatus.php                               │ │
│ │ Responsibility: Defines possible member statuses                        │ │
│ │ Reusable: YES (used across room features)                               │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • ACTIVE = 'active'                                                   │ │
│ │   • LEFT   = 'left'                                                     │ │
│ │   • KICKED = 'kicked'                                                   │ │
│ │   • BANNED = 'banned'                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: InternalAuth (Middleware)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Middleware/InternalAuth.php                              │ │
│ │ Responsibility: Validates X-Internal-Key header for internal routes     │ │
│ │ Reusable: YES (used by all internal microservice endpoints)             │ │
│ │ Why It Exists: Secures internal API from unauthorized access            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • handle() → Validates internal key, returns 403 if invalid           │ │
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
│ 1. SELECT (Room): Find room by ID                                           │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Room::find($roomId)                                              │
│                                                                             │
│ 2. SELECT (RoomMember): Find active member with matching user_id            │
│    Query: SELECT * FROM room_members                                        │
│           WHERE room_id = ? AND user_id = ? AND status = 'active'           │
│           LIMIT 1                                                           │
│    Source: $room->members()->where(...)->first()                            │
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
│ Response is constructed directly in controller using response()->json()    │
│                                                                             │
│ For owner:                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['role' => 'owner']);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ For member/admin:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(['role' => $member->role]);                     │ │
│ │ // Note: $member->role is RoomMemberRole enum, auto-casts to string     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Role enum is automatically serialized to its string value:                  │
│   • RoomMemberRole::ADMIN  → "admin"                                        │
│   • RoomMemberRole::MEMBER → "member"                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                       200 + JSON Body {"role": "..."}                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                          | Used By Endpoints                  | Reusable | Reasoning                          |
| ----------------------------- | ---------------------------------- | -------- | ---------------------------------- |
| `InternalAuth.php`            | All internal API endpoints         | ✅       | Generic internal auth middleware   |
| `Room.php`                    | All room-related endpoints         | ✅       | Core domain model                  |
| `RoomMember.php`              | All member-related endpoints       | ✅       | Core domain model                  |
| `RoomMemberRole.php`          | Member role endpoints, permissions | ✅       | Shared enum for role definitions   |
| `RoomMemberStatus.php`        | Member status endpoints, queries   | ✅       | Shared enum for status definitions |
| `Internal/RoomController.php` | Internal room endpoints only       | ⭕       | Internal-specific controller       |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                               |
| ----- | ------ | --------------------------------------- |
| N/A   | N/A    | No request validation (only URL params) |

### Authentication Errors (403)

| Error                                 | Source         | Condition                         |
| ------------------------------------- | -------------- | --------------------------------- |
| "Unauthorized. Invalid internal key." | `InternalAuth` | Missing or invalid X-Internal-Key |

### Business Logic Errors (404)

| Error                     | Source           | Condition                                |
| ------------------------- | ---------------- | ---------------------------------------- |
| "Room not found."         | `RoomController` | Room with given ID does not exist        |
| "User not found in room." | `RoomController` | User is not an active member of the room |

### System Errors (500)

| Error                    | Source   | Condition              |
| ------------------------ | -------- | ---------------------- |
| Database connection fail | Database | PostgreSQL unavailable |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User is room owner                | Returns `{"role": "owner"}` without member lookup  |
| User was previously member (LEFT) | Returns 404 (only ACTIVE status is matched)        |
| User was kicked from room         | Returns 404 (only ACTIVE status is matched)        |
| User was banned from room         | Returns 404 (only ACTIVE status is matched)        |
| Room is soft-deleted              | Returns 404 (soft delete is not handled specially) |
| String roomId/userId vs integer   | Controller casts userId to int for comparison      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT (MSAB)          MIDDLEWARE              CONTROLLER                MODEL                  DATABASE
    │                       │                       │                       │                       │
    │  GET /internal/rooms/{roomId}/members/{userId}/role                   │                       │
    │  Headers: X-Internal-Key                      │                       │                       │
    │──────────────────────▶│                       │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 1. Validate key       │                       │                       │
    │                       │   (hash_equals)       │                       │                       │
    │                       │──────────────────────▶│                       │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 2. Room::find()       │                       │
    │                       │                       │──────────────────────▶│                       │
    │                       │                       │                       │ 3. SELECT rooms       │
    │                       │                       │                       │──────────────────────▶│
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │◀──────────────────────│                       │
    │                       │                       │                       │                       │
    │                       │                       │ 4. Check owner        │                       │
    │                       │                       │   (userId == user_id) │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 5. room->members()    │                       │
    │                       │                       │──────────────────────▶│                       │
    │                       │                       │                       │ 6. SELECT room_members│
    │                       │                       │                       │──────────────────────▶│
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │◀──────────────────────│                       │
    │                       │                       │                       │                       │
    │                       │                       │ 7. Build response     │                       │
    │                       │◀──────────────────────│                       │                       │
    │◀──────────────────────│                       │                       │                       │
    │                       │                       │                       │                       │
    │  200 + {"role": "admin"}                      │                       │                       │
    │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                 |
| ------------------------ | ---------------------------------------- |
| New role type            | `app/Enums/Room/RoomMemberRole.php`      |
| Additional member status | `app/Enums/Room/RoomMemberStatus.php`    |
| Response metadata        | `RoomController::getMemberRole()`        |
| Internal auth changes    | `app/Http/Middleware/InternalAuth.php`   |
| Caching for role lookup  | Add to `RoomController::getMemberRole()` |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                               | What to Change                  |
| ----- | -------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Controllers/Internal/RoomController.php` | Add field to response()->json() |

Example: Adding `permissions` to response:

```php
return response()->json([
    'role' => $member->role,
    'permissions' => [
        'can_manage_members' => $member->role->canManageMembers(),
        'can_kick' => $member->role->canKick(),
    ],
]);
```

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                               | What to Change                          |
| ----- | -------------------------------------------------- | --------------------------------------- |
| **1** | `app/Http/Controllers/Internal/RoomController.php` | Remove field from response()->json()    |
| **2** | MSAB Audio Server                                  | Update consumer to handle missing field |

### 🔗 Field Flow Dependency Chain

```
Request           Controller           Model              Response
   │                  │                   │                   │
   │   roomId    ────▶│                   │                   │
   │   userId    ────▶│                   │                   │
   │                  │                   │                   │
   │                  │    Room::find()   │                   │
   │                  │──────────────────▶│                   │
   │                  │                   │                   │
   │                  │   user_id         │                   │
   │                  │◀──────────────────│                   │
   │                  │                   │                   │
   │                  │   members()       │                   │
   │                  │──────────────────▶│                   │
   │                  │                   │                   │
   │                  │   role            │                   │
   │                  │◀──────────────────│                   │
   │                  │                   │                   │
   │                  │                   │     {"role": "..."}
   │                  │──────────────────────────────────────▶│
```

### 📋 Field Modification Checklists

**Adding caching:**

- [ ] Add Cache import to controller
- [ ] Create cache key pattern (e.g., `room:{roomId}:member:{userId}:role`)
- [ ] Wrap lookup in Cache::remember()
- [ ] Set appropriate TTL (consider MSAB polling frequency)
- [ ] Invalidate cache on role changes in other endpoints

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                 |
| ------------------------- | ------------------------------------------------------ |
| `InternalAuth` middleware | Security-critical, affects all internal endpoints      |
| Response structure        | MSAB Audio Server depends on exact JSON format         |
| Owner detection logic     | Comparison must remain `(int)` cast for type safety    |
| Active status filter      | Returns only active members, changing affects behavior |

### 🚨 Common Pitfalls

| Pitfall                                      | Prevention                                          |
| -------------------------------------------- | --------------------------------------------------- |
| Returning role for inactive members          | Always filter by `status = ACTIVE`                  |
| Type mismatch in owner check                 | Keep `(int)$userId === $room->user_id` cast         |
| Forgetting owner is not in room_members      | Owner check must happen BEFORE member query         |
| Storing owner role in room_members           | Owner is determined by room.user_id, not membership |
| Changing response format without MSAB update | Coordinate with Audio Server team                   |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Middleware/
  └── InternalAuth.php                               ← Internal auth middleware
app/Http/Controllers/Internal/
  └── RoomController.php                             ← Controller
app/Models/Room/
  ├── Room.php                                       ← Room model
  └── RoomMember.php                                 ← RoomMember model
app/Enums/Room/
  ├── RoomMemberRole.php                             ← Role enum
  └── RoomMemberStatus.php                           ← Status enum
config/services.php                                  ← msab.internal_key config
```

---

## Document Metadata

| Property            | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Endpoint**        | `GET /api/v1/internal/rooms/{roomId}/members/{userId}/role` |
| **Domain**          | Internal                                                    |
| **Author**          | System Documentation                                        |
| **Created**         | 2026-02-01                                                  |
| **Laravel Version** | 12.x                                                        |
| **PHP Version**     | 8.4+                                                        |
