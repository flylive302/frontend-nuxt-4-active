# POST /api/v1/user/room/invitations/{id}/accept

> **Domain**: User / Room Membership  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

The Accept Invitation endpoint allows authenticated users to accept a pending room invitation, joining them as a member of the room.

### Responsibilities

- Validate the invitation exists and belongs to the user
- Check invitation status (must be pending)
- Verify the invitation has not expired
- Confirm the user can still join the room (not blocked, room not full, not already a member)
- Accept the invitation by updating its status
- Add the user as a member of the room with `member` role
- Return success response confirming room join

### What It Owns

| Owned               | Description                                       |
| ------------------- | ------------------------------------------------- |
| Invitation Status   | Updates `room_invitations.status` to `accepted`   |
| Membership Record   | Creates `room_members` record for the user        |
| Invitation Response | Updates `room_invitations.responded_at` timestamp |

### External Dependencies

| Dependency | Type     | Purpose                            |
| ---------- | -------- | ---------------------------------- |
| MySQL      | Database | Stores invitation and member data  |
| Redis      | Cache    | Caches membership and block checks |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/room/invitations/{id}/accept
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter    | Key         | Config                  |
| ---------- | ----------- | ----------------------- |
| `throttle` | `user:{id}` | Default API rate limits |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type      | Constraints       | Example |
| --------- | --------- | ----------------- | ------- |
| `id`      | `integer` | Required, numeric | `123`   |

### Request Body

No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Joined room successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T02:48:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T02:48:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You are blocked from this room",
  "data": null,
  "errors": {
    "code": "ROOM_BLOCKED",
    "context": {}
  },
  "meta": {
    "timestamp": "2026-02-01T02:48:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Invitation not found",
  "data": null,
  "errors": {
    "code": "INVITATION_NOT_FOUND",
    "context": {}
  },
  "meta": {
    "timestamp": "2026-02-01T02:48:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Conflict Error (409)

```json
{
  "status": "error",
  "message": "You are already a member of this room",
  "data": null,
  "errors": {
    "code": "ALREADY_MEMBER",
    "context": {}
  },
  "meta": {
    "timestamp": "2026-02-01T02:48:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Gone Error (410)

```json
{
  "status": "error",
  "message": "Invitation has expired",
  "data": null,
  "errors": {
    "code": "INVITATION_EXPIRED",
    "context": {}
  },
  "meta": {
    "timestamp": "2026-02-01T02:48:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | Invitation accepted successfully, user joined |
| `401` | User not authenticated                        |
| `403` | User is blocked from the room                 |
| `404` | Invitation not found or not for this user     |
| `409` | User already a member OR Room full            |
| `410` | Invitation has expired                        |
| `500` | Unexpected server error                       |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/user/room/invitations/{id}/accept                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:43                                     │
│ Route: Route::post('/invitations/{id}/accept',                              │
│        [RoomInvitationController::class, 'accept'])->whereNumber('id')      │
│                                                                             │
│ Route Group: prefix('user/room') + middleware('auth:sanctum')               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads authenticated user       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::prefix('user/room')->group(function () {                     │ │
│ │         Route::post('/invitations/{id}/accept',                         │ │
│ │             [RoomInvitationController::class, 'accept'])                │ │
│ │             ->whereNumber('id');                                        │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER HANDLES REQUEST                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php:53-64   │
│ Method: accept(Request $request, int $id)                                   │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to invitation service                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->invitationService->acceptInvitation($id, $user->id);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Joined room successfully');          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomInvitationService.php:94-148                    │
│ Method: acceptInvitation(int $invitationId, int $userId): RoomMember        │
│                                                                             │
│ Wrapped in DB::transaction() for atomicity                                  │
│                                                                             │
│ STEP 1: Find and lock invitation                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation = RoomInvitation::where('id', $invitationId)                │ │
│ │     ->where('invitee_id', $userId)                                      │ │
│ │     ->lockForUpdate()                                                   │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (!$invitation) {                                                     │ │
│ │     throw new InvitationNotFoundException;                              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate invitation is pending                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$invitation->isPending()) {                                        │ │
│ │     throw new InvitationNotFoundException;                              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check expiration                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($invitation->isExpired()) {                                         │ │
│ │     $invitation->expire();  // Update status to 'expired'               │ │
│ │     throw new InvitationExpiredException;                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Check if user can join room (via RoomMemberService)                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::findOrFail($invitation->room_id);                         │ │
│ │ $canJoin = $this->memberService->canJoinRoom($userId, $room);           │ │
│ │                                                                         │ │
│ │ if (!$canJoin['can_join']) {                                            │ │
│ │     // Determine specific exception based on reason                     │ │
│ │     if (str_contains($canJoin['reason'], 'blocked')) {                  │ │
│ │         throw new RoomBlockedException;                                 │ │
│ │     }                                                                   │ │
│ │     if (str_contains($canJoin['reason'], 'full')) {                     │ │
│ │         throw new RoomFullException;                                    │ │
│ │     }                                                                   │ │
│ │     if (str_contains($canJoin['reason'], 'member')) {                   │ │
│ │         throw new AlreadyMemberException;                               │ │
│ │     }                                                                   │ │
│ │     throw new InsufficientPermissionException('join room');             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Accept the invitation                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation->accept();  // Sets status='accepted', responded_at=now()   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Add user as member                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return $this->memberService->addMember(                                 │ │
│ │     $invitation->room_id,                                               │ │
│ │     $userId,                                                            │ │
│ │     RoomMemberRole::MEMBER,                                             │ │
│ │     $invitation->inviter_id  // Tracks who invited                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 MEMBER SERVICE (canJoinRoom)                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:62-89                         │
│ Method: canJoinRoom(int $userId, Room $room): array                         │
│                                                                             │
│ CHECK 1: Already a member?                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (RoomMember::isMemberOfRoom($userId, $room->id)) {                   │ │
│ │     return [                                                            │ │
│ │         'can_join' => false,                                            │ │
│ │         'reason' => 'You are already a member of this room'             │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CHECK 2: Is user blocked?                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (RoomUserBlock::isBlocked($room->id, $userId)) {                     │ │
│ │     return [                                                            │ │
│ │         'can_join' => false,                                            │ │
│ │         'reason' => 'You are blocked from this room'                    │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CHECK 3: Room at capacity?                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!RoomMember::roomHasCapacity($room)) {                              │ │
│ │     return [                                                            │ │
│ │         'can_join' => false,                                            │ │
│ │         'reason' => 'Room is full'                                      │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ All checks passed:                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ['can_join' => true, 'reason' => null];                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 MEMBER SERVICE (addMember)                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:94-108                        │
│ Method: addMember(int $roomId, int $userId, RoomMemberRole $role,           │
│                   ?int $invitedBy): RoomMember                              │
│                                                                             │
│ Creates new RoomMember record:                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return RoomMember::create([                                             │ │
│ │     'room_id' => $roomId,                                               │ │
│ │     'user_id' => $userId,                                               │ │
│ │     'role' => RoomMemberRole::MEMBER,                                   │ │
│ │     'status' => RoomMemberStatus::ACTIVE,                               │ │
│ │     'joined_at' => now(),                                               │ │
│ │     'invited_by' => $inviterId,  // References inviter                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Model boot auto-sets role_order based on role (MEMBER = 3)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomInvitation (Model)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomInvitation.php                                │ │
│ │ Responsibility: Represents invitation records                           │ │
│ │ Reusable: YES (used across invitation operations)                       │ │
│ │ Why It Exists: Encapsulates invitation state and behavior               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isPending() → checks if status == PENDING                           │ │
│ │   • isExpired() → checks if expires_at is in the past                   │ │
│ │   • accept() → sets status to ACCEPTED, responded_at to now             │ │
│ │   • expire() → sets status to EXPIRED                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Represents room membership records                      │ │
│ │ Reusable: YES (used across all membership operations)                   │ │
│ │ Why It Exists: Encapsulates membership state and behavior               │ │
│ │                                                                         │ │
│ │ Key Static Methods:                                                     │ │
│ │   • isMemberOfRoom() → checks membership with 2-min cache               │ │
│ │   • roomHasCapacity() → checks participant_count < max_seats            │ │
│ │                                                                         │ │
│ │ Auto-sets role_order on create/update via boot()                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomUserBlock (Model)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomUserBlock.php                                 │ │
│ │ Responsibility: Represents room block records                           │ │
│ │ Reusable: YES (used across all room access checks)                      │ │
│ │ Why It Exists: Encapsulates blocking logic                              │ │
│ │                                                                         │ │
│ │ Key Static Methods:                                                     │ │
│ │   • isBlocked() → checks block status with 5-min cache                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitationStatus (Enum)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomInvitationStatus.php                           │ │
│ │ Responsibility: Defines invitation status values                        │ │
│ │ Reusable: YES (type-safe status handling)                               │ │
│ │                                                                         │ │
│ │ Values: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Defines member role values                              │ │
│ │ Reusable: YES (type-safe role handling)                                 │ │
│ │                                                                         │ │
│ │ Values: OWNER, ADMIN, MEMBER                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: DomainException (Base Exception)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/DomainException.php                                │ │
│ │ Responsibility: Base class for domain-specific exceptions               │ │
│ │ Reusable: YES (extended by all room exceptions)                         │ │
│ │ Why It Exists: Provides consistent error response formatting            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • render(Request) → returns formatted JSON error response             │ │
│ │   • getErrorCode() → returns machine-readable error code                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT + LOCK: Find invitation with row lock                             │
│    Query: SELECT * FROM room_invitations                                    │
│           WHERE id = ? AND invitee_id = ?                                   │
│           FOR UPDATE                                                        │
│    Source: RoomInvitationService::acceptInvitation()                        │
│                                                                             │
│ 2. SELECT: Find room by invitation's room_id                                │
│    Query: SELECT * FROM rooms WHERE id = ?                                  │
│    Source: Room::findOrFail()                                               │
│                                                                             │
│ 3. CACHE CHECK: Check if user is already a member                           │
│    Cache Key: room:{roomId}:member:{userId}                                 │
│    TTL: 2 minutes                                                           │
│    Source: RoomMember::isMemberOfRoom()                                     │
│                                                                             │
│ 4. CACHE CHECK: Check if user is blocked                                    │
│    Cache Key: room:{roomId}:blocked:{userId}                                │
│    TTL: 5 minutes                                                           │
│    Source: RoomUserBlock::isBlocked()                                       │
│                                                                             │
│ 5. UPDATE: Accept invitation                                                │
│    Query: UPDATE room_invitations                                           │
│           SET status = 'accepted', responded_at = NOW(), updated_at = NOW() │
│           WHERE id = ?                                                      │
│    Source: RoomInvitation::accept()                                         │
│                                                                             │
│ 6. INSERT: Create room member                                               │
│    Query: INSERT INTO room_members                                          │
│           (room_id, user_id, role, role_order, status, joined_at,           │
│            invited_by, created_at, updated_at)                              │
│           VALUES (?, ?, 'member', 3, 'active', NOW(), ?, NOW(), NOW())      │
│    Source: RoomMemberService::addMember()                                   │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET: room:{roomId}:member:{userId} (membership check)                    │
│    Source: RoomMember::isMemberOfRoom()                                     │
│                                                                             │
│ 2. GET: room:{roomId}:blocked:{userId} (block check)                        │
│    Source: RoomUserBlock::isBlocked()                                       │
│                                                                             │
│ Note: Both use Cache::remember() with fallback to DB query                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│ Method: ApiResponse::success(null, 'Joined room successfully')              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Joined room successfully',                            │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $correlationId                              │ │
│ │     ]                                                                   │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         200 + JSON Body                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                              | Used By Endpoints                         | Reusable | Reasoning                                   |
| --------------------------------- | ----------------------------------------- | -------- | ------------------------------------------- |
| `RoomInvitationController.php`    | All invitation endpoints                  | ⭕       | Controller methods are endpoint-specific    |
| `RoomInvitationService.php`       | Accept, Send, Cancel invitation endpoints | ✅       | Core invitation business logic              |
| `RoomMemberService.php`           | All membership endpoints                  | ✅       | Core membership logic, room join validation |
| `RoomInvitation.php`              | All invitation operations                 | ✅       | Model with status helpers                   |
| `RoomMember.php`                  | All membership operations                 | ✅       | Model with membership checks                |
| `RoomUserBlock.php`               | Join, Accept invitation, Join request     | ✅       | Block checking with cache                   |
| `Room.php`                        | All room endpoints                        | ✅       | Core room model                             |
| `RoomInvitationStatus.php`        | All invitation operations                 | ✅       | Type-safe status enum                       |
| `RoomMemberRole.php`              | All membership operations                 | ✅       | Type-safe role enum                         |
| `ApiResponse.php`                 | All API endpoints                         | ✅       | Consistent response formatting              |
| `DomainException.php`             | All domain exceptions                     | ✅       | Base exception with render()                |
| `InvitationNotFoundException.php` | Accept, Decline, Cancel invitation        | ✅       | Specific exception                          |
| `InvitationExpiredException.php`  | Accept invitation                         | ✅       | Specific exception                          |
| `RoomBlockedException.php`        | Accept invitation, Join, Join request     | ✅       | Specific exception                          |
| `RoomFullException.php`           | Accept invitation, Join, Approve request  | ✅       | Specific exception                          |
| `AlreadyMemberException.php`      | Accept invitation, Join, Approve request  | ✅       | Specific exception                          |

---

## 5. Error Handling & Edge Cases

### Business Logic Errors (4xx)

| Error                                | Code | Source                            | Condition                             |
| ------------------------------------ | ---- | --------------------------------- | ------------------------------------- |
| `Unauthorized`                       | 401  | Controller                        | User not authenticated                |
| `Invitation not found`               | 404  | `InvitationNotFoundException`     | ID doesn't exist or not for this user |
| `Invitation not found` (not pending) | 404  | `InvitationNotFoundException`     | Status not 'pending'                  |
| `You are blocked from this room`     | 403  | `RoomBlockedException`            | User in room_user_blocks              |
| `You are already a member`           | 409  | `AlreadyMemberException`          | Active membership exists              |
| `Room is full`                       | 409  | `RoomFullException`               | participant_count >= max_seats        |
| `Invitation has expired`             | 410  | `InvitationExpiredException`      | expires_at < now()                    |
| `You do not have permission`         | 403  | `InsufficientPermissionException` | Generic join permission failure       |

### System Errors (500)

| Error                     | Source           | Condition                      |
| ------------------------- | ---------------- | ------------------------------ |
| Database connection error | DB operations    | Database unreachable           |
| Cache unavailable         | Redis operations | Redis unreachable (falls back) |
| Unexpected exception      | Any component    | Unhandled error                |

### Edge Cases

| Case                                      | Behavior                                            |
| ----------------------------------------- | --------------------------------------------------- |
| Same invitation accepted twice            | Second attempt returns 404 (status already changed) |
| Invitation expired during request         | Status updated to 'expired', 410 returned           |
| Room becomes full during transaction      | 409 returned, transaction rolled back               |
| User blocked between invite and accept    | 403 returned, transaction rolled back               |
| User becomes member via other means first | 409 AlreadyMemberException                          |
| Concurrent accept requests                | lockForUpdate() prevents race, one succeeds         |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            INVITATION SERVICE        MEMBER SERVICE           DATABASE/CACHE
   │                       │                       │                       │                       │                       │
   │  POST /user/room/     │                       │                       │                       │                       │
   │  invitations/{id}/    │                       │                       │                       │                       │
   │  accept               │                       │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │                       │
   │                       │   (verify token)      │                       │                       │                       │
   │                       │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │ 2. Get user           │                       │                       │
   │                       │                       │   $request->user()    │                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │ 3. acceptInvitation() │                       │                       │
   │                       │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 4. BEGIN TRANSACTION  │                       │
   │                       │                       │                       │───────────────────────┼──────────────────────▶│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 5. SELECT...FOR UPDATE│                       │
   │                       │                       │                       │   room_invitations    │                       │
   │                       │                       │                       │───────────────────────┼──────────────────────▶│
   │                       │                       │                       │◀──────────────────────┼───────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 6. isPending()?       │                       │
   │                       │                       │                       │ 7. isExpired()?       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 8. SELECT room        │                       │
   │                       │                       │                       │───────────────────────┼──────────────────────▶│
   │                       │                       │                       │◀──────────────────────┼───────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 9. canJoinRoom()      │                       │
   │                       │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 10. CACHE: member?    │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 11. CACHE: blocked?   │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 12. roomHasCapacity?  │
   │                       │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 13. UPDATE invitation │                       │
   │                       │                       │                       │   (status='accepted') │                       │
   │                       │                       │                       │───────────────────────┼──────────────────────▶│
   │                       │                       │                       │◀──────────────────────┼───────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 14. addMember()       │                       │
   │                       │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 15. INSERT room_member│
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 16. COMMIT TRANSACTION│                       │
   │                       │                       │                       │───────────────────────┼──────────────────────▶│
   │                       │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │ 17. ApiResponse::     │                       │                       │
   │                       │                       │   success(null,...)   │                       │                       │
   │                       │◀──────────────────────│                       │                       │                       │
   │◀──────────────────────│                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │
   │  200 + JSON           │                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location(s)                                                   |
| --------------------------- | ------------------------------------------------------------- |
| Post-accept notification    | `RoomInvitationService::acceptInvitation()` after addMember() |
| Invitation expiry extension | `RoomInvitation` model + migration                            |
| Accept with custom role     | Add parameter to `addMember()` call                           |
| Real-time event on accept   | After `addMember()` in service                                |
| Rate limit accept attempts  | Middleware or controller                                      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                    | What to Change                 |
| ----- | ------------------------------------------------------- | ------------------------------ |
| **1** | `app/Services/Room/RoomInvitationService.php`           | Return RoomMember in response  |
| **2** | `app/Http/Controllers/.../RoomInvitationController.php` | Pass RoomMember to ApiResponse |
| **3** | `app/Http/Resources/V1/Room/RoomMemberResource.php`     | Include new field (if needed)  |

#### ➕ ADDING A NEW VALIDATION CHECK

| Step  | File                                          | What to Change                     |
| ----- | --------------------------------------------- | ---------------------------------- |
| **1** | `app/Services/Room/RoomMemberService.php`     | Add check in `canJoinRoom()`       |
| **2** | `app/Exceptions/Room/`                        | Create new exception if needed     |
| **3** | `app/Services/Room/RoomInvitationService.php` | Handle new reason in exception map |

#### ➖ REMOVING EXPIRATION CHECK

| Step  | File                                          | What to Change                    |
| ----- | --------------------------------------------- | --------------------------------- |
| **1** | `app/Services/Room/RoomInvitationService.php` | Remove `isExpired()` check        |
| **2** | `app/Models/Room/RoomInvitation.php`          | Remove `expires_at` from fillable |
| **3** | **Database Migration**                        | Drop `expires_at` column          |

### 🔗 Field Flow Dependency Chain

```
URL Parameter {id}
       │
       ▼
┌──────────────────┐
│ room_invitations │
│ - id             │───────────────────────────────────────────────────┐
│ - invitee_id     │────────────────────────────────┐                  │
│ - room_id        │──────────────────┐             │                  │
│ - inviter_id     │────────┐         │             │                  │
│ - status         │        │         │             │                  │
│ - expires_at     │        │         │             │                  │
│ - responded_at   │        │         │             │                  │
└──────────────────┘        │         │             │                  │
                            ▼         ▼             ▼                  ▼
                      ┌─────────┐  ┌───────┐  ┌──────────┐      ┌─────────────┐
                      │ users   │  │ rooms │  │ users    │      │ room_members│
                      │(inviter)│  │       │  │(invitee) │      │ (created)   │
                      └─────────┘  └───────┘  └──────────┘      │ - room_id   │
                                       │                        │ - user_id   │
                                       │                        │ - role      │
                                       ▼                        │ - invited_by│
                              ┌────────────────┐                └─────────────┘
                              │ room_user_blocks│
                              │ (checked)       │
                              └────────────────┘
```

### 📋 Field Modification Checklists

#### [ ] New Check in canJoinRoom Checklist

- [ ] Add check logic in `RoomMemberService::canJoinRoom()`
- [ ] Create exception in `app/Exceptions/Room/`
- [ ] Add reason mapping in `RoomInvitationService::acceptInvitation()`
- [ ] Document error in this file
- [ ] Add test case

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                              |
| ---------------------------------- | --------------------------------------------------- |
| `DB::transaction()` wrapper        | Ensures atomicity of invitation accept + member add |
| `lockForUpdate()` on invitation    | Prevents race conditions on concurrent accepts      |
| Exception type mapping logic       | Maps canJoin reasons to specific exception types    |
| `RoomMemberRole::MEMBER` default   | Invitees should always join as regular members      |
| Status check order (pending first) | Must validate status before expiration              |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| Checking expiration before pending       | Always check `isPending()` first                     |
| Not handling cache misses                | Cache::remember() falls back to DB                   |
| Forgetting to update invitation status   | Called before addMember() in transaction             |
| Not setting invited_by on RoomMember     | Passed from invitation.inviter_id                    |
| Transaction not rolled back on exception | DB::transaction() auto-rolls back on exception throw |
| Race condition on concurrent accepts     | lockForUpdate() prevents this                        |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                 ← Route definition (line 43)
app/Http/Controllers/Api/V1/Room/
  └── RoomInvitationController.php             ← Controller (accept method)
app/Services/Room/
  ├── RoomInvitationService.php                ← Core invitation logic
  ├── RoomMemberService.php                    ← Membership operations
  └── Helpers/
      └── RoomAuthorizationHelper.php          ← Authorization trait
app/Models/Room/
  ├── RoomInvitation.php                       ← Invitation model
  ├── RoomMember.php                           ← Member model
  ├── RoomUserBlock.php                        ← Block model
  └── Room.php                                 ← Room model
app/Enums/Room/
  ├── RoomInvitationStatus.php                 ← Status enum
  └── RoomMemberRole.php                       ← Role enum
app/Exceptions/Room/
  ├── InvitationNotFoundException.php          ← 404 exception
  ├── InvitationExpiredException.php           ← 410 exception
  ├── RoomBlockedException.php                 ← 403 exception
  ├── RoomFullException.php                    ← 409 exception
  ├── AlreadyMemberException.php               ← 409 exception
  └── InsufficientPermissionException.php      ← 403 exception
app/Exceptions/DomainException.php             ← Base exception class
app/Http/Utils/ApiResponse.php                 ← Response utilities
```

---

## Document Metadata

| Property            | Value                                            |
| ------------------- | ------------------------------------------------ |
| **Endpoint**        | `POST /api/v1/user/room/invitations/{id}/accept` |
| **Domain**          | User / Room Membership                           |
| **Author**          | System Documentation                             |
| **Created**         | 2026-02-01                                       |
| **Laravel Version** | 12.x                                             |
| **PHP Version**     | 8.4                                              |
