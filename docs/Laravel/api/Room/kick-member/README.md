# DELETE /api/v1/rooms/{room}/members/{userId}

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-31

---

## 1. Domain Overview

### Purpose

The Kick Member endpoint allows room owners and admins to forcefully remove a member from a room, preventing them from continuing participation until they rejoin.

### Responsibilities

- Validate that the requesting user has permission to kick members
- Verify the target user is an active member of the room
- Change member status from ACTIVE to KICKED
- Invalidate membership cache for the kicked user
- Emit real-time events to notify the kicked user and room members

### What It Owns

| Owned                       | Description                                   |
| --------------------------- | --------------------------------------------- |
| Kick Member Logic           | Enforces permission hierarchy for kicking     |
| Membership Status Transition| Changes member status to KICKED               |
| Real-time Event Emission    | Broadcasts kick events via MSAB               |

### External Dependencies

| Dependency | Type           | Purpose                                |
| ---------- | -------------- | -------------------------------------- |
| PostgreSQL | Database       | Stores room_members records            |
| Redis      | Cache          | Invalidates membership cache           |
| MSAB       | Real-time      | Broadcasts kick events to users        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/rooms/{room}/members/{userId}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter   | Key                  | Config               |
| --------- | -------------------- | -------------------- |
| `default` | `user_id:route_name` | Standard API limits  |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type     | Constraints                      | Example |
| --------- | -------- | -------------------------------- | ------- |
| `room`    | `int`    | Required, must exist             | `42`    |
| `userId`  | `int`    | Required, must be numeric        | `15`    |

### Request Body Schema

_No request body required._

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Member kicked successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-01-31T18:17:53.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-31T18:17:53.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Cannot Kick Owner (403)

```json
{
  "status": "error",
  "message": "Cannot kick the room owner",
  "data": null,
  "errors": {
    "code": "CANNOT_KICK_OWNER"
  },
  "meta": {
    "timestamp": "2026-01-31T18:17:53.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Insufficient Permission (403)

```json
{
  "status": "error",
  "message": "You do not have permission to kick admins",
  "data": null,
  "errors": {
    "code": "INSUFFICIENT_PERMISSION"
  },
  "meta": {
    "timestamp": "2026-01-31T18:17:53.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Room Not Found (404)

```json
{
  "status": "error",
  "message": "Resource not found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-31T18:17:53.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Member Not Found (404)

```json
{
  "status": "error",
  "message": "User 15 is not a member of room 42",
  "data": null,
  "errors": {
    "code": "MEMBER_NOT_FOUND"
  },
  "meta": {
    "timestamp": "2026-01-31T18:17:53.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Member successfully kicked from room                |
| `401` | User not authenticated                              |
| `403` | Attempting to kick owner or admin lacks permission  |
| `404` | Room not found or user not an active member         |
| `500` | Unexpected server error                             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│               DELETE /api/v1/rooms/{room}/members/{userId}                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:61                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::delete('/members/{userId}', [RoomMemberController::class,       │ │
│ │     'kick'])->whereNumber('userId');                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum     → Authenticates user via Sanctum token                │
│   2. throttle:api     → Standard API rate limiting                          │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Resolves to Room model via implicit binding                    │
│   • {userId} → Passed as int parameter (constrained to numeric)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest class - uses standard Request                                │
│                                                                             │
│ Path Parameters:                                                            │
│   • room: int (via route model binding)                                     │
│   • userId: int (constrained via ->whereNumber())                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomMemberController.php:84-95       │
│ Method: kick(Request $request, Room $room, int $userId)                     │
│                                                                             │
│ STEP 1: Verify authenticated user                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Execute kick via service                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->memberService->kickMember($room->id, $userId, $user->id);        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Member kicked successfully');        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:153-195                       │
│ Method: kickMember(int $roomId, int $memberUserId, int $kickedByUserId)     │
│                                                                             │
│ All operations wrapped in DB::transaction():                                │
│                                                                             │
│ STEP 1: Load room and check if requester is owner                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::findOrFail($roomId);                                      │ │
│ │ $isOwner = $room->user_id === $kickedByUserId;                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find target member with pessimistic lock                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member = RoomMember::where('room_id', $roomId)                         │ │
│ │     ->where('user_id', $memberUserId)                                   │ │
│ │     ->where('status', RoomMemberStatus::ACTIVE)                         │ │
│ │     ->lockForUpdate()                                                   │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (!$member) {                                                         │ │
│ │     throw new MemberNotFoundException($memberUserId, $roomId);          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate permission hierarchy                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Cannot kick owner                                                    │ │
│ │ if ($member->isOwner()) {                                               │ │
│ │     throw new CannotKickOwnerException();                               │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Admin cannot kick other admins (only owner can)                      │ │
│ │ if ($member->isAdmin() && !$isOwner) {                                  │ │
│ │     throw new InsufficientPermissionException('kick admins');           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Cleanup old kicked/left/banned records (unique constraint)          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ RoomMember::where('user_id', $memberUserId)                             │ │
│ │     ->where('room_id', $roomId)                                         │ │
│ │     ->where('id', '!=', $member->id)                                    │ │
│ │     ->whereIn('status', [RoomMemberStatus::LEFT,                        │ │
│ │         RoomMemberStatus::KICKED, RoomMemberStatus::BANNED])            │ │
│ │     ->delete();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Update member status to KICKED                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member->kick();  // Sets status=KICKED, left_at=now(), saves           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Invalidate cache                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cache::forget("room:{$roomId}:member:{$memberUserId}");                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Emit real-time event                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitRoomMemberKicked(                          │ │
│ │     $roomId, $memberUserId, $kickedByUserId                             │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Member status management and role checks                │ │
│ │ Reusable: YES (used by all room membership operations)                  │ │
│ │ Why It Exists: Core model for room-user relationships                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isOwner() → Returns true if role === RoomMemberRole::OWNER          │ │
│ │   • isAdmin() → Returns true if role === RoomMemberRole::ADMIN          │ │
│ │   • kick()    → Sets status=KICKED, left_at=now(), saves model          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberStatus.php                               │ │
│ │ Responsibility: Defines member status values                            │ │
│ │ Reusable: YES (used across all membership operations)                   │ │
│ │ Values: ACTIVE, LEFT, KICKED, BANNED                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Defines member roles and permissions                    │ │
│ │ Reusable: YES (used across all membership operations)                   │ │
│ │ Values: OWNER, ADMIN, MEMBER                                            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canKick() → Returns true for OWNER and ADMIN                        │ │
│ │   • isHigherThan(role) → Compares role hierarchy                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php:375-388                    │ │
│ │ Responsibility: Broadcasts real-time events via MSAB                    │ │
│ │ Reusable: YES (used for all real-time room events)                      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitRoomMemberKicked(roomId, userId, kickedById)                    │ │
│ │     → Emits 'room.member_kicked' to kicked user                         │ │
│ │     → Emits 'room.member_kicked' to all room members                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CannotKickOwnerException (Exception)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/CannotKickOwnerException.php                  │ │
│ │ Responsibility: Thrown when attempting to kick room owner               │ │
│ │ HTTP Code: 403                                                          │ │
│ │ Error Code: CANNOT_KICK_OWNER                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: InsufficientPermissionException (Exception)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/InsufficientPermissionException.php           │ │
│ │ Responsibility: Thrown when user lacks permission for action            │ │
│ │ HTTP Code: 403                                                          │ │
│ │ Error Code: INSUFFICIENT_PERMISSION                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MemberNotFoundException (Exception)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/MemberNotFoundException.php                   │ │
│ │ Responsibility: Thrown when target user is not a room member            │ │
│ │ HTTP Code: 404                                                          │ │
│ │ Error Code: MEMBER_NOT_FOUND                                            │ │
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
│ 1. [SELECT]: Find room by ID                                                │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Room::findOrFail($roomId)                                        │
│                                                                             │
│ 2. [SELECT FOR UPDATE]: Find active member with lock                        │
│    Query: SELECT * FROM room_members                                        │
│           WHERE room_id = ? AND user_id = ? AND status = 'active'           │
│           FOR UPDATE                                                        │
│    Source: RoomMember::where(...)->lockForUpdate()->first()                 │
│                                                                             │
│ 3. [DELETE]: Remove old non-active membership records                       │
│    Query: DELETE FROM room_members                                          │
│           WHERE user_id = ? AND room_id = ? AND id != ?                     │
│           AND status IN ('left', 'kicked', 'banned')                        │
│    Source: RoomMember::where(...)->delete()                                 │
│                                                                             │
│ 4. [UPDATE]: Set member status to KICKED                                    │
│    Query: UPDATE room_members                                               │
│           SET status = 'kicked', left_at = NOW()                            │
│           WHERE id = ?                                                      │
│    Source: $member->kick()                                                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. [DELETE]: Invalidate membership cache                                    │
│    Key: room:{roomId}:member:{userId}                                       │
│    Source: Cache::forget(...)                                               │
│                                                                             │
│ REAL-TIME EVENTS:                                                           │
│                                                                             │
│ 1. [EMIT]: Notify kicked user                                               │
│    Event: 'room.member_kicked'                                              │
│    Target: Specific user (userId)                                           │
│    Payload: { room_id, kicked_by }                                          │
│                                                                             │
│ 2. [EMIT]: Notify room members                                              │
│    Event: 'room.member_kicked'                                              │
│    Target: Room (roomId)                                                    │
│    Payload: { user_id, kicked_by }                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ The controller returns ApiResponse::success(null, 'Member kicked            │
│ successfully') which constructs:                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Member kicked successfully',                          │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                          200 + JSON Body                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                   | Used By Endpoints                              | Reusable | Reasoning                              |
| -------------------------------------- | ---------------------------------------------- | -------- | -------------------------------------- |
| `RoomMemberController.php`             | Kick, UpdateRole, Index, MyMembership          | ⭕       | Controller-specific but shares service |
| `RoomMemberService.php`                | All room member operations                     | ✅       | Centralized membership logic           |
| `RoomMember.php`                       | All endpoints involving room members           | ✅       | Core model for memberships             |
| `RoomMemberStatus.php`                 | Join, Leave, Kick, Ban operations              | ✅       | Enum for status values                 |
| `RoomMemberRole.php`                   | Join, Kick, UpdateRole, permission checks      | ✅       | Enum for role hierarchy                |
| `MSABEventService.php`                 | All real-time room events                      | ✅       | Centralized event broadcasting         |
| `CannotKickOwnerException.php`         | Kick member only                               | ❌       | Specific to kick operation             |
| `InsufficientPermissionException.php`  | Kick, UpdateRole, management operations        | ✅       | Reused for permission errors           |
| `MemberNotFoundException.php`          | Kick, UpdateRole, membership operations        | ✅       | Generic member lookup failure          |
| `ApiResponse.php`                      | All API endpoints                              | ✅       | Standard response utility              |

---

## 5. Error Handling & Edge Cases

### Permission Errors (403)

| Error                      | Source                              | Condition                                        |
| -------------------------- | ----------------------------------- | ------------------------------------------------ |
| `CANNOT_KICK_OWNER`        | `CannotKickOwnerException`          | Target user has OWNER role                       |
| `INSUFFICIENT_PERMISSION`  | `InsufficientPermissionException`   | Admin trying to kick another admin               |

### Not Found Errors (404)

| Error              | Source                     | Condition                                    |
| ------------------ | -------------------------- | -------------------------------------------- |
| `MEMBER_NOT_FOUND` | `MemberNotFoundException`  | User not an active member of the room        |
| Room not found     | Route model binding        | Room ID doesn't exist or is soft-deleted     |

### Authentication Errors (401)

| Error          | Source                       | Condition                    |
| -------------- | ---------------------------- | ---------------------------- |
| `Unauthorized` | `ApiResponse::unauthorized`  | No valid Sanctum token       |

### Edge Cases

| Case                                   | Behavior                                                  |
| -------------------------------------- | --------------------------------------------------------- |
| Kicking already kicked user            | Returns 404 (status check filters to ACTIVE only)         |
| Owner kicking admin                    | Allowed - owner has full permissions                      |
| Admin kicking member                   | Allowed - admins can kick members                         |
| Admin kicking admin                    | Denied - throws `InsufficientPermissionException`         |
| Kicking self                           | Allowed (use `/membership` DELETE for graceful leave)     |
| Concurrent kick attempts               | Pessimistic lock (`lockForUpdate`) prevents race          |
| Multiple old kicked records exist      | Cleaned up before status update (unique constraint)       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/REDIS/MSAB
   │                       │                       │                       │                            │
   │  DELETE /rooms/42     │                       │                       │                            │
   │  /members/15          │                       │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. Authenticate       │                       │                            │
   │                       │    (auth:sanctum)     │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │ 2. Route Model        │                       │                            │
   │                       │    Binding (Room)     │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 3. Verify user auth   │                            │
   │                       │                       │ 4. Call kickMember()  │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. BEGIN TRANSACTION       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 6. SELECT room             │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. SELECT member FOR UPDATE│
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. DELETE old records      │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. UPDATE status=KICKED    │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. COMMIT TRANSACTION     │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. Cache::forget()        │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 12. MSAB emit to user      │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 13. MSAB emit to room      │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │◀──────────────────────│                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  200 + JSON           │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                           | Location                                       |
| ---------------------------------- | ---------------------------------------------- |
| New kick validation rules          | `RoomMemberService::kickMember()`              |
| Additional real-time events        | `MSABEventService`                             |
| Kick reason tracking               | Add column to model, pass through service      |
| Kick audit logging                 | Add after `$member->kick()` in service         |
| Ban user after kick                | Call `RoomBlockService` after kick             |

### 📝 Field Modification Guide

#### ➕ ADDING KICK REASON FIELD

| Step  | File                                       | What to Change                            |
| ----- | ------------------------------------------ | ----------------------------------------- |
| **1** | **Database Migration**                     | Add `kicked_reason` column to `room_members` |
| **2** | `app/Models/Room/RoomMember.php`           | Add to `$fillable`                        |
| **3** | New request class if validating reason     | Add `KickMemberRequest.php`               |
| **4** | `app/Http/Controllers/.../RoomMemberController.php` | Accept reason, pass to service   |
| **5** | `app/Services/Room/RoomMemberService.php`  | Accept and store reason parameter         |
| **6** | `MSABEventService.php`                     | Include reason in event payload           |

#### ➖ REMOVING AN EVENT EMISSION

| Step  | File                                           | What to Change                     |
| ----- | ---------------------------------------------- | ---------------------------------- |
| **1** | `app/Services/Room/RoomMemberService.php`      | Remove emit call                   |
| **2** | `app/Services/Realtime/MSABEventService.php`       | Remove method if unused elsewhere  |
| **3** | Frontend                                       | Stop listening for event           |

### 🔗 Field Flow Dependency Chain

```
Path Parameters (room, userId)
         │
         ▼
┌─────────────────────────────┐
│ Controller                  │
│ • Extracts user from request│
│ • Passes room->id, userId   │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ RoomMemberService           │
│ • Loads Room model          │
│ • Validates permissions     │
│ • Updates RoomMember        │
└─────────────────────────────┘
         │
         ├────────────────────────┐
         ▼                        ▼
┌─────────────────┐    ┌─────────────────────┐
│ Cache           │    │ MSABEventService    │
│ Invalidation    │    │ Real-time events    │
└─────────────────┘    └─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                              |
| ------------------------------ | --------------------------------------------------- |
| `lockForUpdate()` in service   | Prevents race conditions in concurrent kicks        |
| Owner check in `kickMember()`  | Security - owner must never be kickable             |
| Transaction wrapping           | Ensures data consistency across operations          |
| Delete old records logic       | Prevents unique constraint violations               |
| Exception error codes          | Frontend may depend on these specific codes         |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                              |
| ---------------------------------------- | ------------------------------------------------------- |
| Modifying kick without transaction       | Always wrap in `DB::transaction()`                      |
| Removing `lockForUpdate()`               | Required for concurrent request safety                  |
| Forgetting cache invalidation            | Always invalidate after membership changes              |
| Not emitting real-time events            | Users won't know they were kicked in real-time          |
| Bypassing permission checks              | Always use service layer, never direct model updates    |
| Allowing kick without admin/owner check  | Frontend-only checks are insufficient                   |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:61                ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomMemberController.php:84-95             ← Controller method
app/Services/Room/
  └── RoomMemberService.php:153-195              ← Service logic
app/Models/Room/
  ├── Room.php                                   ← Room model
  └── RoomMember.php                             ← Member model with kick()
app/Enums/Room/
  ├── RoomMemberStatus.php                       ← Status enum (KICKED)
  └── RoomMemberRole.php                         ← Role enum (permissions)
app/Exceptions/Room/
  ├── CannotKickOwnerException.php               ← Owner protection
  ├── InsufficientPermissionException.php        ← Permission error
  └── MemberNotFoundException.php                ← Member lookup failure
app/Services/Gift/
  └── MSABEventService.php:375-388               ← Real-time event emission
app/Http/Utils/
  └── ApiResponse.php                            ← Response utility
```

---

## Document Metadata

| Property            | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/rooms/{room}/members/{userId}`  |
| **Domain**          | Room                                            |
| **Author**          | System Documentation                            |
| **Created**         | 2026-01-31                                      |
| **Laravel Version** | 12.x                                            |
| **PHP Version**     | 8.4                                             |
