# POST /api/v1/rooms/{room}/blocks

> **Domain**: Room Membership  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Blocks a user from a room, preventing them from joining or participating. Supports temporary bans with duration options.

### Responsibilities

- Validate blocker has room management permissions (owner or admin)
- Prevent blocking room owner or admins (unless blocker is owner)
- Create/update block record with optional duration
- Ban user if currently a member
- Invalidate cache entries
- Emit real-time events to blocked user and room members

### What It Owns

| Owned              | Description                                     |
| ------------------ | ----------------------------------------------- |
| Block record       | Creates/updates `room_user_blocks` table entry  |
| Member ban         | Updates member status to `BANNED` if applicable |
| Cache invalidation | Clears block and membership cache keys          |

### External Dependencies

| Dependency       | Type           | Purpose                           |
| ---------------- | -------------- | --------------------------------- |
| Redis/Cache      | Infrastructure | Cache invalidation for blocks     |
| MSABEventService | Service        | Real-time WebSocket notifications |
| Database         | Infrastructure | Block records and member updates  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/rooms/{room}/blocks
```

### Authentication

✅ **Required** - Bearer token (Sanctum)

### Rate Limiting

| Limiter  | Key       | Config            |
| -------- | --------- | ----------------- |
| Standard | `user_id` | Default API limit |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type  | Description                 |
| --------- | ----- | --------------------------- |
| `room`    | `int` | Room ID (route model bound) |

### Request Body Schema

```json
{
  "user_id": "integer", // Required, must exist in users table
  "reason": "string|null", // Optional, max 500 chars
  "duration": "string|null" // Optional, one of: 2h, 24h, 7d, permanent
}
```

#### Field Details

| Field      | Type      | Constraints                                | Example  |
| ---------- | --------- | ------------------------------------------ | -------- |
| `user_id`  | `integer` | Required, exists in `users`                | `123`    |
| `reason`   | `string`  | Optional, nullable, max 500                | `"Spam"` |
| `duration` | `string`  | Optional, nullable, in:2h,24h,7d,permanent | `"24h"`  |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "User blocked successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T04:11:31.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "user_id": ["The specified user does not exist."],
    "duration": ["Duration must be 2h, 24h, 7d, or permanent."]
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not have permission to block users",
  "data": null,
  "errors": []
}
```

#### ❌ Cannot Block Owner (403)

```json
{
  "status": "error",
  "message": "Cannot kick the room owner",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `201` | User blocked successfully                     |
| `403` | Insufficient permissions / cannot block owner |
| `404` | Room not found                                |
| `422` | Validation failed                             |
| `500` | Server error (database/transaction failure)   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/rooms/{room}/blocks                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:71                                     │
│ Route: Route::post('/blocks', [RoomBlockController::class, 'store'])        │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets Auth::user()              │
│                                                                             │
│ Route Group: prefix('rooms/{room}')                                         │
│   - {room} parameter uses implicit route model binding                      │
│   - Resolves to Room model instance                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/BlockUserRequest.php                    │
│                                                                             │
│ Authorization Check:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'user_id' => ['required', 'integer', 'exists:users,id'],            │ │
│ │     'reason' => ['sometimes', 'nullable', 'string', 'max:500'],         │ │
│ │     'duration' => ['sometimes', 'nullable', 'string',                   │ │
│ │                    'in:2h,24h,7d,permanent'],                           │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Messages:                                                            │
│   • user_id.exists → "The specified user does not exist."                   │
│   • duration.in → "Duration must be 2h, 24h, 7d, or permanent."             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomBlockController.php:61           │
│ Method: store(BlockUserRequest $request, Room $room)                        │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service layer                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->blockService->blockUser(                                         │ │
│ │     $room->id,                                                          │ │
│ │     $request->validated('user_id'),                                     │ │
│ │     $user->id,                                                          │ │
│ │     $request->validated('reason'),                                      │ │
│ │     $request->validated('duration')                                     │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'User blocked successfully', [], 201);│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomBlockService.php:40                             │
│ Method: blockUser($roomId, $userId, $blockedById, $reason, $duration)       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use (...) {                          │ │
│ │     $room = Room::findOrFail($roomId);                                  │ │
│ │                                                                         │ │
│ │     // STEP 1: Check authorization                                      │ │
│ │     if (!$this->canManageRoom($blockedById, $room)) {                   │ │
│ │         throw new InsufficientPermissionException('block users');       │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // STEP 2: Check if target is owner (cannot block)                  │ │
│ │     $targetMember = RoomMember::where('room_id', $roomId)               │ │
│ │         ->where('user_id', $userId)                                     │ │
│ │         ->where('status', RoomMemberStatus::ACTIVE)                     │ │
│ │         ->first();                                                      │ │
│ │                                                                         │ │
│ │     if ($targetMember && $targetMember->isOwner()) {                    │ │
│ │         throw new CannotKickOwnerException;                             │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // STEP 3: Admin cannot block other admins                          │ │
│ │     if ($targetMember && $targetMember->isAdmin() && !$isOwner) {       │ │
│ │         throw new InsufficientPermissionException('block admins');      │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // STEP 4: Calculate banned_until based on duration                 │ │
│ │     $bannedUntil = match ($duration) {                                  │ │
│ │         '2h'  => now()->addHours(2),                                    │ │
│ │         '24h' => now()->addHours(24),                                   │ │
│ │         '7d'  => now()->addDays(7),                                     │ │
│ │         default => null, // permanent                                   │ │
│ │     };                                                                  │ │
│ │                                                                         │ │
│ │     // STEP 5: Create or update block record                            │ │
│ │     $block = RoomUserBlock::updateOrCreate(...);                        │ │
│ │                                                                         │ │
│ │     // STEP 6: Ban member if currently active                           │ │
│ │     if ($targetMember) {                                                │ │
│ │         $targetMember->ban();                                           │ │
│ │         Cache::forget("room:{$roomId}:member:{$userId}");               │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // STEP 7: Invalidate block cache                                   │ │
│ │     Cache::forget("room:{$roomId}:blocked:{$userId}");                  │ │
│ │                                                                         │ │
│ │     // STEP 8: Emit real-time event                                     │ │
│ │     $this->msabEventService->emitRoomMemberBlocked(...);                │ │
│ │                                                                         │ │
│ │     return $block;                                                      │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomAuthorizationHelper (Trait)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/Helpers/RoomAuthorizationHelper.php             │ │
│ │ Responsibility: Centralized authorization checks for room services      │ │
│ │ Reusable: YES (shared across room services)                             │ │
│ │ Why It Exists: Eliminates duplicate owner/admin check patterns          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageRoom() → Checks if user is owner or admin                  │ │
│ │   • getMembershipForAuthorization() → Cached membership lookup          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Room membership with role and status management         │ │
│ │ Reusable: YES (core model)                                              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isOwner() → Check if member has OWNER role                          │ │
│ │   • isAdmin() → Check if member has ADMIN role                          │ │
│ │   • canManageMembers() → Check if role allows member management         │ │
│ │   • ban() → Sets status to BANNED and left_at timestamp                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Real-time event emission via WebSocket                  │ │
│ │ Reusable: YES (used by multiple room actions)                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitRoomMemberBlocked() → Notifies blocked user and room members    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: InsufficientPermissionException (Exception)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/InsufficientPermissionException.php           │ │
│ │ Responsibility: Permission denied errors with specific action context   │ │
│ │ Reusable: YES (shared across room operations)                           │ │
│ │ Error Code: INSUFFICIENT_PERMISSION, HTTP 403                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CannotKickOwnerException (Exception)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/CannotKickOwnerException.php                  │ │
│ │ Responsibility: Error when attempting to block/kick room owner          │ │
│ │ Reusable: YES (used by kick and block operations)                       │ │
│ │ Error Code: CANNOT_KICK_OWNER, HTTP 403                                 │ │
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
│ 1. SELECT: Room lookup (implicit via route model binding)                   │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Route Model Binding                                              │
│                                                                             │
│ 2. SELECT: Room findOrFail (service layer verification)                     │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: RoomBlockService::blockUser                                      │
│                                                                             │
│ 3. SELECT: Authorization membership lookup                                  │
│    Query: SELECT * FROM room_members WHERE room_id = ? AND                  │
│           user_id = ? AND status = 'active' LIMIT 1                         │
│    Source: RoomAuthorizationHelper::getMembershipForAuthorization           │
│                                                                             │
│ 4. SELECT: Target member lookup                                             │
│    Query: SELECT * FROM room_members WHERE room_id = ? AND                  │
│           user_id = ? AND status = 'active' LIMIT 1                         │
│    Source: RoomBlockService::blockUser                                      │
│                                                                             │
│ 5. INSERT/UPDATE: Block record (upsert)                                     │
│    Query: INSERT INTO room_user_blocks (...) ON DUPLICATE KEY UPDATE ...    │
│    Source: RoomUserBlock::updateOrCreate                                    │
│                                                                             │
│ 6. UPDATE: Ban member (if active member exists)                             │
│    Query: UPDATE room_members SET status = 'banned', left_at = NOW()        │
│           WHERE id = ?                                                      │
│    Source: RoomMember::ban                                                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. FORGET: room:{roomId}:member:{userId} (if member exists)                 │
│    Source: RoomBlockService::blockUser                                      │
│                                                                             │
│ 2. FORGET: room:{roomId}:blocked:{userId}                                   │
│    Source: RoomBlockService::blockUser                                      │
│                                                                             │
│ REAL-TIME EVENTS:                                                           │
│                                                                             │
│ 1. EMIT: room.member_blocked (to blocked user)                              │
│    Payload: { room_id, blocked_by, duration, banned_until }                 │
│    Source: MSABEventService::emitRoomMemberBlocked                          │
│                                                                             │
│ 2. EMIT: room.member_blocked (to room members)                              │
│    Payload: { user_id, duration }                                           │
│    Source: MSABEventService::emitRoomMemberBlocked                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Response is built using ApiResponse::success() with null data:              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'User blocked successfully', [], 201);│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Produces:                                                                   │
│ {                                                                           │
│   "status": "success",                                                      │
│   "message": "User blocked successfully",                                   │
│   "data": null,                                                             │
│   "meta": {                                                                 │
│     "timestamp": "ISO8601",                                                 │
│     "correlation_id": "uuid"                                                │
│   }                                                                         │
│ }                                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    201 Created + JSON Body                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                  | Used By Endpoints    | Reusable | Reasoning                      |
| ------------------------------------- | -------------------- | -------- | ------------------------------ |
| `BlockUserRequest.php`                | POST blocks only     | ❌       | Endpoint-specific validation   |
| `RoomBlockController.php`             | Block endpoints      | ⭕       | All block CRUD methods         |
| `RoomBlockService.php`                | Block endpoints      | ✅       | Centralized blocking logic     |
| `RoomUserBlock.php` (Model)           | All block operations | ✅       | Core model                     |
| `RoomUserBlockResource.php`           | GET blocks (list)    | ✅       | Not used by store but reusable |
| `RoomAuthorizationHelper.php`         | All room management  | ✅       | Shared authorization trait     |
| `ApiResponse.php`                     | All API endpoints    | ✅       | Standardized responses         |
| `MSABEventService.php`                | All room events      | ✅       | Real-time event service        |
| `InsufficientPermissionException.php` | Room permissions     | ✅       | Reusable exception             |
| `CannotKickOwnerException.php`        | Kick/block endpoints | ✅       | Reusable exception             |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error              | Source             | Condition                       |
| ------------------ | ------------------ | ------------------------------- |
| `user_id.required` | `BlockUserRequest` | user_id not provided            |
| `user_id.integer`  | `BlockUserRequest` | user_id not an integer          |
| `user_id.exists`   | `BlockUserRequest` | User does not exist in database |
| `reason.string`    | `BlockUserRequest` | reason is not a string          |
| `reason.max`       | `BlockUserRequest` | reason exceeds 500 characters   |
| `duration.in`      | `BlockUserRequest` | Invalid duration value          |

### Business Logic Errors (403)

| Error                                        | Source                            | Condition                           |
| -------------------------------------------- | --------------------------------- | ----------------------------------- |
| "You do not have permission to block users"  | `InsufficientPermissionException` | User is not owner or admin          |
| "Cannot kick the room owner"                 | `CannotKickOwnerException`        | Attempting to block room owner      |
| "You do not have permission to block admins" | `InsufficientPermissionException` | Admin trying to block another admin |

### System Errors (404/500)

| Error          | Source              | Condition              |
| -------------- | ------------------- | ---------------------- |
| Room not found | Route Model Binding | Invalid room ID in URL |
| Database error | DB Transaction      | Transaction failure    |

### Edge Cases

| Case                        | Behavior                                     |
| --------------------------- | -------------------------------------------- |
| User already blocked        | Updates existing block record (upsert)       |
| Blocked user not a member   | Block created, no member ban performed       |
| Null duration provided      | Treated as permanent ban (banned_until=null) |
| Member banned while in room | Status set to BANNED, kicked immediately     |
| Admin blocks another admin  | Throws InsufficientPermissionException       |
| Owner blocks admin          | Allowed, admin is banned                     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/CACHE
   │                       │                       │                       │                            │
   │  POST /rooms/{room}/blocks                    │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │   (verify token)      │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 2. Route Model Binding│                            │
   │                       │                       │   Load Room           │                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 3. BlockUserRequest   │                            │
   │                       │                       │   validate()          │                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 4. Call blockService  │                            │
   │                       │                       │   ->blockUser()       │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. DB::transaction()       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 6. Room::findOrFail        │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. canManageRoom()         │
   │                       │                       │                       │   (auth check)             │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. Get target member       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. updateOrCreate block    │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. member->ban() if       │
   │                       │                       │                       │     member exists          │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. Cache::forget (x2)     │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 12. Emit WebSocket event   │
   │                       │                       │                       │   (room.member_blocked)    │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │◀──────────────────────│                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  201 Created + JSON   │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location(s)                                                  |
| ------------------------- | ------------------------------------------------------------ |
| New validation rule       | `BlockUserRequest::rules()`                                  |
| New duration option       | `BlockUserRequest` (validation) + `RoomBlockService` (match) |
| Additional block metadata | `RoomUserBlock` model + migration                            |
| Block notification        | `MSABEventService::emitRoomMemberBlocked()`                  |
| Block audit logging       | `RoomBlockService::blockUser()` after transaction            |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `block_type`)

| Step  | File                                                   | What to Change                         |
| ----- | ------------------------------------------------------ | -------------------------------------- |
| **1** | **Database Migration**                                 | Add column to `room_user_blocks` table |
| **2** | `app/Models/Room/RoomUserBlock.php`                    | Add to `$fillable`                     |
| **3** | `app/Http/Requests/Api/V1/Room/BlockUserRequest.php`   | Add validation rule                    |
| **4** | `app/Services/Room/RoomBlockService.php`               | Pass to `updateOrCreate()`             |
| **5** | `app/Http/Resources/V1/Room/RoomUserBlockResource.php` | Add to response (for list endpoint)    |

#### ➖ REMOVING A FIELD (e.g., `reason`)

| Step  | File                                                       | What to Change                               |
| ----- | ---------------------------------------------------------- | -------------------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/BlockUserRequest.php`       | Remove validation rule                       |
| **2** | `app/Services/Room/RoomBlockService.php`                   | Remove from method parameters/updateOrCreate |
| **3** | `app/Http/Controllers/Api/V1/Room/RoomBlockController.php` | Remove from `validated()` call               |
| **4** | `app/Http/Resources/V1/Room/RoomUserBlockResource.php`     | Remove from response                         |
| **5** | **Database Migration**                                     | Drop column (if safe)                        |

### 🔗 Field Flow Dependency Chain

```
Request Body
    │
    ▼
┌─────────────────────────────────────────┐
│ BlockUserRequest                        │
│ • user_id (required, exists)            │
│ • reason (optional, max:500)            │
│ • duration (optional, in:2h,24h,7d...)  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomBlockController::store()            │
│ • Extracts validated fields             │
│ • Passes all to service                 │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomBlockService::blockUser()           │
│ • Calculates banned_until from duration │
│ • Updates/creates block record          │
│ • Bans member if exists                 │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomUserBlock (Model)                   │
│ • room_id, blocked_user_id (key)        │
│ • blocked_by_id, reason, banned_until   │
└─────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                       | Reason                                          |
| ------------------------------- | ----------------------------------------------- |
| `RoomUserBlock::updateOrCreate` | Core upsert logic, affects block uniqueness     |
| `DB::transaction()` wrapper     | Ensures atomicity of block + ban operations     |
| `canManageRoom()` checks        | Security gate, protects unauthorized blocking   |
| Exception throwing order        | Owner check must occur before admin check       |
| Cache key format                | Must match keys used elsewhere for invalidation |
| Real-time event payloads        | Client apps depend on consistent structure      |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                     |
| -------------------------------------- | ---------------------------------------------- |
| Forgetting cache invalidation          | Always invalidate both block and member caches |
| Missing transaction                    | All DB operations must be in transaction       |
| Checking admin before owner            | Owner check must come first (order matters)    |
| Not handling null duration             | Null means permanent, match expression handles |
| Skipping validation for user_id exists | User might not exist, always validate          |
| Blocking self                          | Consider adding self-block prevention          |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                              ← Route definition (line 71)
app/Http/Controllers/Api/V1/Room/
  └── RoomBlockController.php                               ← Controller
app/Http/Requests/Api/V1/Room/
  └── BlockUserRequest.php                                  ← Request validation
app/Services/Room/
  ├── RoomBlockService.php                                  ← Business logic
  └── Helpers/
      └── RoomAuthorizationHelper.php                       ← Authorization trait
app/Models/Room/
  ├── RoomUserBlock.php                                     ← Block model
  └── RoomMember.php                                        ← Member model
app/Exceptions/Room/
  ├── InsufficientPermissionException.php                   ← Permission exception
  └── CannotKickOwnerException.php                          ← Owner protection exception
app/Http/Utils/
  └── ApiResponse.php                                       ← Response helper
app/Services/Gift/
  └── MSABEventService.php                                  ← Real-time events
```

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `POST /api/v1/rooms/{room}/blocks` |
| **Domain**          | Room Membership                    |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-01                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4                                |
