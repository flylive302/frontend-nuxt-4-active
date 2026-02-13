# DELETE /api/v1/rooms/{room}/membership

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

Allows authenticated users to voluntarily drop their membership from a specific room, enabling multi-room support where users can leave individual rooms without affecting other memberships.

### Responsibilities

- Verify user authentication
- Validate room exists (via route model binding)
- Remove user's active membership from the specified room
- Prevent room owners from leaving (must transfer ownership first)
- Invalidate membership cache
- Emit real-time event to room participants

### What It Owns

| Owned                  | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| Membership removal     | Updates `room_members.status` to `LEFT`                    |
| Cache invalidation     | Clears `room:{roomId}:member:{userId}` cache key           |
| Real-time notification | Emits `room.membership_dropped` event via MSABEventService |

### External Dependencies

| Dependency       | Type           | Purpose                                    |
| ---------------- | -------------- | ------------------------------------------ |
| PostgreSQL       | Database       | Store and update room membership records   |
| Redis/Valkey     | Cache          | Membership status caching (2-min TTL)      |
| MSABEventService | Infrastructure | Real-time event broadcasting to room users |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/rooms/{room}/membership
```

### Authentication

✅ **Required** - Sanctum Bearer Token

### Rate Limiting

| Limiter | Key         | Config                |
| ------- | ----------- | --------------------- |
| Default | `user:{id}` | Laravel default rates |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints          | Example |
| --------- | --------- | -------------------- | ------- |
| `room`    | `integer` | Required, must exist | `42`    |

### Request Body Schema

No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Membership dropped successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-01-30T17:59:09.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T17:59:09.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Owner Cannot Leave Error (403)

```json
{
  "status": "error",
  "message": "Room owner cannot leave. Transfer ownership first.",
  "data": null,
  "errors": {
    "code": "OWNER_CANNOT_LEAVE",
    "context": []
  },
  "meta": {
    "timestamp": "2026-01-30T17:59:09.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Room Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Room\\Room]",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T17:59:09.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Member Not Found (404)

```json
{
  "status": "error",
  "message": "User {userId} is not a member of room {roomId}",
  "data": null,
  "errors": {
    "code": "MEMBER_NOT_FOUND",
    "context": []
  },
  "meta": {
    "timestamp": "2026-01-30T17:59:09.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                    |
| ----- | -------------------------------------------- |
| `200` | Membership dropped successfully              |
| `401` | User not authenticated                       |
| `403` | User is room owner and cannot leave          |
| `404` | Room not found or user is not a member       |
| `500` | Database transaction failure or system error |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/rooms/{room}/membership                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:34                                     │
│ Route: Route::delete('/membership', [RoomMemberController::class,           │
│                                      'dropMembership'])                     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, attaches user to request       │
│                                                                             │
│ Route Groups:                                                               │
│   • prefix('rooms/{room}') - Line 29                                        │
│   • middleware('auth:sanctum') - Line 27                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Model: App\Models\Room\Room                                                 │
│                                                                             │
│ Laravel automatically resolves {room} to a Room instance via implicit      │
│ route model binding. If room not found, throws ModelNotFoundException →    │
│ HTTP 404.                                                                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Implicit binding in controller method signature                     │ │
│ │ public function dropMembership(Request $request, Room $room)           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomMemberController.php             │
│ Method: dropMembership(Request $request, Room $room): JsonResponse          │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Unauthenticated');                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service layer                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->memberService->dropMembership($user->id, $room->id);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Membership dropped successfully');  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php                               │
│ Method: dropMembership(int $userId, int $roomId): void                      │
│                                                                             │
│ STEP 1: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ DB::transaction(function () use ($userId, $roomId) {                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find and lock membership record                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membership = RoomMember::where('user_id', $userId)                     │ │
│ │     ->where('room_id', $roomId)                                         │ │
│ │     ->where('status', RoomMemberStatus::ACTIVE)                         │ │
│ │     ->lockForUpdate()  // Prevents concurrent modifications             │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (! $membership) {                                                    │ │
│ │     throw new MemberNotFoundException($userId, $roomId);                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate user is not owner                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($membership->isOwner()) {                                           │ │
│ │     throw new OwnerCannotLeaveException;                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Update membership status                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membership->drop();  // Sets status=LEFT, left_at=now()                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Invalidate cache                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cache::forget("room:{$roomId}:member:{$userId}");                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Emit real-time event                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitRoomMembershipDropped($roomId, $userId);   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomMember (Eloquent Model)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Room membership data model                              │ │
│ │ Reusable: YES (used by all membership operations)                       │ │
│ │ Why It Exists: Central representation of user-room relationship        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isOwner() → Check if member holds OWNER role                        │ │
│ │   • drop() → Update status to LEFT, set left_at timestamp               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MemberNotFoundException (Exception)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/MemberNotFoundException.php                   │ │
│ │ Responsibility: Represents user-not-member error condition              │ │
│ │ Reusable: YES (used by kick, role update, drop operations)              │ │
│ │ Why It Exists: Domain-specific exception for clear error handling       │ │
│ │                                                                         │ │
│ │ Error Code: MEMBER_NOT_FOUND                                            │ │
│ │ HTTP Code: 404                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: OwnerCannotLeaveException (Exception)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/OwnerCannotLeaveException.php                 │ │
│ │ Responsibility: Prevents owner from abandoning room                     │ │
│ │ Reusable: YES (business rule for ownership integrity)                   │ │
│ │ Why It Exists: Ensures rooms always have an owner                       │ │
│ │                                                                         │ │
│ │ Error Code: OWNER_CANNOT_LEAVE                                          │ │
│ │ HTTP Code: 403                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emit real-time events to room participants              │ │
│ │ Reusable: YES (used by all room membership events)                      │ │
│ │ Why It Exists: Centralized real-time event broadcasting                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitRoomMembershipDropped($roomId, $userId) → Notify room           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response wrapper                      │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent API response format                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 OK response                          │ │
│ │   • unauthorized($message) → 401 response                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT with FOR UPDATE: Find active membership                           │
│    Query: SELECT * FROM room_members                                        │
│           WHERE user_id = ? AND room_id = ? AND status = 'active'           │
│           FOR UPDATE                                                        │
│    Source: RoomMemberService::dropMembership()                              │
│                                                                             │
│ 2. UPDATE: Change membership status                                         │
│    Query: UPDATE room_members                                               │
│           SET status = 'left', left_at = NOW(), updated_at = NOW()          │
│           WHERE id = ?                                                      │
│    Source: RoomMember::drop()                                               │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. DELETE: Invalidate membership cache                                      │
│    Key: room:{roomId}:member:{userId}                                       │
│    Source: RoomMemberService::dropMembership()                              │
│                                                                             │
│ REAL-TIME OPERATIONS:                                                       │
│                                                                             │
│ 1. EMIT: Broadcast membership dropped event                                 │
│    Event: room.membership_dropped                                           │
│    Payload: { user_id: userId }                                             │
│    Target: All users in room {roomId}                                       │
│    Source: MSABEventService::emitRoomMembershipDropped()                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│ Method: success(null, 'Membership dropped successfully')                    │
│                                                                             │
│ Response structure:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Membership dropped successfully",                         │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "ISO8601 timestamp",                                   │ │
│ │     "correlation_id": "from header or generated UUID"                   │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: No data returned as membership is simply removed, not modified.       │
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

| File                            | Used By Endpoints                  | Reusable | Reasoning                                |
| ------------------------------- | ---------------------------------- | -------- | ---------------------------------------- |
| `RoomMemberController.php`      | All room member operations         | ⭕       | Controller methods are endpoint-specific |
| `RoomMemberService.php`         | All room member operations         | ✅       | Centralized membership business logic    |
| `RoomMember.php`                | All room membership features       | ✅       | Core model for room memberships          |
| `Room.php`                      | All room endpoints                 | ✅       | Central room model                       |
| `MemberNotFoundException.php`   | kick, updateRole, dropMembership   | ✅       | Reused for member validation             |
| `OwnerCannotLeaveException.php` | dropMembership, delete room checks | ✅       | Ownership protection                     |
| `MSABEventService.php`          | All real-time room events          | ✅       | Centralized event broadcasting           |
| `ApiResponse.php`               | All API endpoints                  | ✅       | Standard response utility                |
| `DomainException.php`           | All domain exceptions              | ✅       | Base exception with render()             |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error           | Source                | Condition                       |
| --------------- | --------------------- | ------------------------------- |
| Unauthenticated | `auth:sanctum`        | Missing or invalid Bearer token |
| Unauthenticated | Controller null check | `$request->user()` returns null |

### Business Logic Errors (403)

| Error                   | Source                      | Condition          |
| ----------------------- | --------------------------- | ------------------ |
| "Owner cannot leave..." | `OwnerCannotLeaveException` | User is room owner |

### Not Found Errors (404)

| Error                    | Source                    | Condition                          |
| ------------------------ | ------------------------- | ---------------------------------- |
| Model not found          | Route model binding       | Room ID doesn't exist              |
| "User X is not a member" | `MemberNotFoundException` | No active membership for user+room |

### System Errors (500)

| Error                | Source            | Condition                           |
| -------------------- | ----------------- | ----------------------------------- |
| Database error       | DB::transaction() | PostgreSQL connection/query failure |
| Cache error          | Cache::forget()   | Redis/Valkey connection failure     |
| Event emission error | MSABEventService  | Real-time service unavailable       |

### Edge Cases

| Case                          | Behavior                                             |
| ----------------------------- | ---------------------------------------------------- |
| User not member of room       | MemberNotFoundException (404)                        |
| User is owner                 | OwnerCannotLeaveException (403)                      |
| Concurrent drop attempts      | `lockForUpdate()` ensures only one succeeds          |
| Already dropped (status=LEFT) | Treated as not found, throws MemberNotFoundException |
| Soft-deleted room             | Route model binding fails (404)                      |
| Cache already invalidated     | No-op, `forget()` doesn't error on missing keys      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/CACHE
   │                       │                       │                       │                            │
   │  DELETE /rooms/{room}/membership              │                       │                            │
   │  Authorization: Bearer {token}                │                       │                            │
   │───────────────────────────────────────────────▶                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │   validate token      │                       │                            │
   │                       │───────────────────────▶                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 2. Route model binding│                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │                       │   SELECT * FROM rooms      │
   │                       │                       │                       │   WHERE id = {room}        │
   │                       │                       │◀──────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 3. Get authenticated  │                            │
   │                       │                       │    user from request  │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 4. dropMembership()   │                            │
   │                       │                       │───────────────────────▶                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. BEGIN TRANSACTION       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 6. SELECT ... FOR UPDATE   │
   │                       │                       │                       │   Find active membership   │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. Check isOwner()         │
   │                       │                       │                       │   (if true → throw 403)    │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. UPDATE membership       │
   │                       │                       │                       │   status = 'left'          │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. Cache::forget()         │
   │                       │                       │                       │   room:{id}:member:{uid}   │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. Emit real-time event   │
   │                       │                       │                       │    room.membership_dropped │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. COMMIT TRANSACTION     │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 12. ApiResponse::     │                            │
   │                       │                       │     success(null,     │                            │
   │                       │                       │     'Membership...')  │                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  200 OK + JSON        │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                              |
| ----------------------------- | ----------------------------------------------------- |
| Pre-drop validation           | `RoomMemberService::dropMembership()` before `drop()` |
| Custom drop reason            | Add parameter to controller and service               |
| Notification to room owner    | After `emitRoomMembershipDropped()` in service        |
| Soft-delete instead of status | Modify `RoomMember::drop()` method                    |
| Cooldown before rejoining     | Add check in `RoomMemberService::canJoinRoom()`       |

### 📝 Field Modification Guide

#### ➕ ADDING: Tracking "drop reason"

| Step  | File                             | What to Change                           |
| ----- | -------------------------------- | ---------------------------------------- |
| **1** | **Database Migration**           | Add `drop_reason` column to room_members |
| **2** | `app/Models/Room/RoomMember.php` | Add to `$fillable` array                 |
| **3** | `RoomMemberController.php`       | Accept optional reason in request        |
| **4** | `RoomMemberService.php`          | Pass reason to `drop()` method           |
| **5** | `RoomMember::drop()`             | Accept and save reason parameter         |

#### ➖ REMOVING: The left_at timestamp

| Step  | File                                    | What to Change                      |
| ----- | --------------------------------------- | ----------------------------------- |
| **1** | `app/Models/Room/RoomMember.php`        | Remove from `$fillable`, `$casts`   |
| **2** | `RoomMember::drop()`, `kick()`, `ban()` | Remove `left_at = now()` assignment |
| **3** | Any queries filtering by `left_at`      | Update or remove                    |
| **4** | **Database Migration**                  | Drop column (if safe)               |

### 🔗 Field Flow Dependency Chain

```
DELETE Request
     │
     └──▶ Route Model Binding (Room)
              │
              └──▶ Controller
                       │
                       ├──▶ $request->user() → Authentication check
                       │
                       └──▶ RoomMemberService::dropMembership()
                                 │
                                 ├──▶ DB Query (lockForUpdate)
                                 │
                                 ├──▶ RoomMember::isOwner() → Role check
                                 │
                                 ├──▶ RoomMember::drop() → Status update
                                 │
                                 ├──▶ Cache::forget() → Cache invalidation
                                 │
                                 └──▶ MSABEventService → Real-time event
```

### ⚠️ What Should NOT Be Modified Casually

| Component               | Reason                                                   |
| ----------------------- | -------------------------------------------------------- |
| `lockForUpdate()` call  | Prevents race conditions in concurrent drop attempts     |
| Owner check before drop | Critical business rule - rooms must always have an owner |
| Transaction wrapper     | Ensures atomicity of status update + cache invalidation  |
| Exception error codes   | Frontend may depend on `OWNER_CANNOT_LEAVE` etc.         |
| Cache key format        | Must match format used in `isMemberOfRoom()` checks      |

### 🚨 Common Pitfalls

| Pitfall                       | Prevention                                         |
| ----------------------------- | -------------------------------------------------- |
| Removing transaction wrapper  | Always keep for data consistency                   |
| Forgetting cache invalidation | Always invalidate after membership changes         |
| Not emitting real-time event  | Other clients won't see the member left            |
| Allowing owner to leave       | Check `isOwner()` before any drop operation        |
| Missing `lockForUpdate()`     | Can cause double-drops in concurrent requests      |
| Checking wrong status column  | Always check `status = ACTIVE`, not just existence |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php              ← Route definition (line 34)
app/Http/Controllers/Api/V1/Room/
  └── RoomMemberController.php              ← Controller (dropMembership method)
app/Services/Room/
  └── RoomMemberService.php                 ← Business logic
app/Models/Room/
  ├── Room.php                              ← Room model (route binding)
  └── RoomMember.php                        ← Membership model
app/Exceptions/Room/
  ├── MemberNotFoundException.php           ← 404 exception
  └── OwnerCannotLeaveException.php         ← 403 exception
app/Services/Gift/
  └── MSABEventService.php                  ← Real-time events
app/Http/Utils/
  └── ApiResponse.php                       ← Response helper
```

---

## Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/rooms/{room}/membership` |
| **Domain**          | Room                                     |
| **Author**          | System Documentation                     |
| **Created**         | 2026-01-30                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4                                      |
