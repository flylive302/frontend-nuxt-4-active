# POST /api/v1/rooms/{room}/invitations

> **Domain**: Room Membership  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Allows room owners and admins to send invitations to users to join their room.

### Responsibilities

- Validate that inviter has permission to invite to the room
- Check that invitee is not already a member
- Check that invitee is not blocked from the room
- Check that no pending invitation exists for this user
- Create a new pending invitation with 7-day expiration

### What It Owns

| Owned               | Description                            |
| ------------------- | -------------------------------------- |
| Invitation Creation | Creates new `room_invitations` record  |
| Expiration Setting  | Sets invitation to expire after 7 days |

### External Dependencies

| Dependency | Type           | Purpose                         |
| ---------- | -------------- | ------------------------------- |
| PostgreSQL | Database       | Stores invitation records       |
| Redis      | Infrastructure | Caching for block/member checks |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/rooms/{room}/invitations
```

### Authentication

✅ **Required** - Sanctum token required

### Rate Limiting

| Limiter | Key             | Config                    |
| ------- | --------------- | ------------------------- |
| API     | User ID + Route | Default API rate limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints      | Example |
| --------- | --------- | ---------------- | ------- |
| `room`    | `integer` | Required, exists | `42`    |

### Request Body Schema

```json
{
  "user_id": "integer", // Required, must exist in users table
  "message": "string|null" // Optional, max 500 characters
}
```

#### Field Details

| Field     | Type      | Constraints                 | Example                        |
| --------- | --------- | --------------------------- | ------------------------------ |
| `user_id` | `integer` | Required, exists:users,id   | `123`                          |
| `message` | `string`  | Optional, nullable, max:500 | `"Join our gaming community!"` |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Invitation sent",
  "data": {
    "id": 1,
    "room": {
      "id": 42,
      "name": "Gaming Room",
      "logo": "https://example.com/logo.png"
    },
    "inviter": {
      "id": 10,
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "status": "pending",
    "message": "Join our gaming community!",
    "expires_at": "2026-02-08T03:54:00+00:00",
    "responded_at": null,
    "created_at": "2026-02-01T03:54:00+00:00"
  },
  "meta": {
    "timestamp": "2026-02-01T03:54:00.000000Z",
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
    "user_id": ["The user_id field is required."],
    "message": ["The message must not be greater than 500 characters."]
  }
}
```

#### ❌ Permission Denied (403)

```json
{
  "status": "error",
  "message": "You do not have permission to invite users",
  "data": null,
  "errors": {
    "code": "INSUFFICIENT_PERMISSION",
    "context": {}
  }
}
```

#### ❌ User Already Invited (409)

```json
{
  "status": "error",
  "message": "User already has a pending invitation",
  "data": null,
  "errors": {
    "code": "PENDING_INVITATION_EXISTS",
    "context": {}
  }
}
```

#### ❌ User Already Member (409)

```json
{
  "status": "error",
  "message": "User is already a member of this room",
  "data": null,
  "errors": {
    "code": "ALREADY_MEMBER",
    "context": {}
  }
}
```

#### ❌ User Blocked (403)

```json
{
  "status": "error",
  "message": "User is blocked from this room",
  "data": null,
  "errors": {
    "code": "ROOM_BLOCKED",
    "context": {}
  }
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `201` | Invitation sent successfully                        |
| `401` | Missing or invalid authentication token             |
| `403` | User lacks permission to invite OR invitee blocked  |
| `404` | Room not found                                      |
| `409` | Pending invitation exists OR invitee already member |
| `422` | Validation failed (invalid user_id, etc.)           |
| `500` | Database or system error                            |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/rooms/{room}/invitations                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:66                                     │
│ Route: Route::post('/invitations', [RoomInvitationController::class,        │
│                                     'send']);                               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Sanctum token                   │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Room::findOrFail() via implicit binding                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/SendInvitationRequest.php               │
│                                                                             │
│ STEP 1: Authorization Check                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validation Rules                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'user_id' => ['required', 'integer', 'exists:users,id'],        │ │
│ │         'message' => ['sometimes', 'nullable', 'string', 'max:500'],    │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Error Message:                                                       │
│   • user_id.exists → "The specified user does not exist."                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php         │
│ Method: send(SendInvitationRequest $request, Room $room)                    │
│                                                                             │
│ STEP 1: Get Authenticated User                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to Service                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation = $this->invitationService->sendInvitation(                 │ │
│ │     $room->id,                                                          │ │
│ │     $user->id,                                                          │ │
│ │     $request->validated('user_id'),                                     │ │
│ │     $request->validated('message')                                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Response                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomInvitationResource($invitation->load('invitee', 'room')),   │ │
│ │     'Invitation sent',                                                  │ │
│ │     [],                                                                 │ │
│ │     201                                                                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: RoomInvitationService                                              │
│ File: app/Services/Room/RoomInvitationService.php                           │
│ Method: sendInvitation(int $roomId, int $inviterId, int $inviteeId,         │
│                        ?string $message = null)                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($roomId, $inviterId,            │ │
│ │                                         $inviteeId, $message) {         │ │
│ │     // 1. Load room                                                     │ │
│ │     $room = Room::findOrFail($roomId);                                  │ │
│ │                                                                         │ │
│ │     // 2. Check if inviter can invite to room                           │ │
│ │     if (! $this->canInviteToRoom($inviterId, $room)) {                  │ │
│ │         throw new InsufficientPermissionException('invite users');      │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // 3. Check if already invited                                      │ │
│ │     if (RoomInvitation::hasPending($roomId, $inviteeId)) {              │ │
│ │         throw new PendingInvitationExistsException;                     │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // 4. Check if user is blocked                                      │ │
│ │     if (RoomUserBlock::isBlocked($roomId, $inviteeId)) {                │ │
│ │         throw new RoomBlockedException;                                 │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // 5. Check if user is already a member                             │ │
│ │     if (RoomMember::isMemberOfRoom($inviteeId, $roomId)) {              │ │
│ │         throw new AlreadyMemberException;                               │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // 6. Create invitation                                             │ │
│ │     return RoomInvitation::create([                                     │ │
│ │         'room_id' => $roomId,                                           │ │
│ │         'inviter_id' => $inviterId,                                     │ │
│ │         'invitee_id' => $inviteeId,                                     │ │
│ │         'status' => RoomInvitationStatus::PENDING,                      │ │
│ │         'message' => $message,                                          │ │
│ │         'expires_at' => now()->addDays(7),                              │ │
│ │     ]);                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
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
│ │ Responsibility: Centralized permission checking for room operations     │ │
│ │ Reusable: YES (trait used across multiple services)                     │ │
│ │ Why It Exists: Eliminates duplicate owner/admin check patterns          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canInviteToRoom($userId, $room) → Checks invite permission          │ │
│ │   • canManageRoom($userId, $room) → Checks owner/admin status           │ │
│ │                                                                         │ │
│ │ Logic for canInviteToRoom:                                              │ │
│ │   1. Owner can always invite                                            │ │
│ │   2. Check membership role's canInvite() permission                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Define room member roles and permissions                │ │
│ │ Reusable: YES (used across all room operations)                         │ │
│ │                                                                         │ │
│ │ Roles: OWNER, ADMIN, MEMBER                                             │ │
│ │ canInvite(): true for OWNER and ADMIN                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitationStatus (Enum)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomInvitationStatus.php                           │ │
│ │ Responsibility: Define invitation status values                         │ │
│ │ Reusable: YES (used across all invitation operations)                   │ │
│ │                                                                         │ │
│ │ Values: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED                 │ │
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
│ 1. SELECT: Load room by ID                                                  │
│    Query: SELECT * FROM rooms WHERE id = ?                                  │
│    Source: Room::findOrFail($roomId)                                        │
│                                                                             │
│ 2. SELECT: Check if user is owner or get membership                         │
│    Query: SELECT * FROM room_members                                        │
│           WHERE room_id = ? AND user_id = ? AND status = 'active'           │
│    Source: RoomAuthorizationHelper::canInviteToRoom()                       │
│    Cache: Uses once() for request-level memoization                         │
│                                                                             │
│ 3. SELECT: Check for pending invitation (PostgreSQL unique index)           │
│    Query: SELECT 1 FROM room_invitations                                    │
│           WHERE room_id = ? AND invitee_id = ? AND status = 'pending'       │
│    Source: RoomInvitation::hasPending()                                     │
│                                                                             │
│ 4. SELECT: Check if invitee is blocked                                      │
│    Query: SELECT 1 FROM room_user_blocks                                    │
│           WHERE room_id = ? AND blocked_user_id = ?                         │
│    Source: RoomUserBlock::isBlocked()                                       │
│    Cache: Redis, 5-minute TTL, key: room:{roomId}:blocked:{userId}          │
│                                                                             │
│ 5. SELECT: Check if invitee is already a member                             │
│    Query: SELECT 1 FROM room_members                                        │
│           WHERE user_id = ? AND room_id = ? AND status = 'active'           │
│    Source: RoomMember::isMemberOfRoom()                                     │
│    Cache: Redis, 2-minute TTL, key: room:{roomId}:member:{userId}           │
│                                                                             │
│ 6. INSERT: Create invitation record                                         │
│    Query: INSERT INTO room_invitations                                      │
│           (room_id, inviter_id, invitee_id, status, message, expires_at)    │
│           VALUES (?, ?, ?, 'pending', ?, ?)                                 │
│    Source: RoomInvitation::create()                                         │
│                                                                             │
│ 7. SELECT: Load relationships for response                                  │
│    Query: SELECT * FROM users WHERE id IN (?, ?)  (invitee, inviter)        │
│           SELECT * FROM rooms WHERE id = ?                                  │
│    Source: $invitation->load('invitee', 'room')                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ RESOURCE: RoomInvitationResource                                            │
│ File: app/Http/Resources/V1/Room/RoomInvitationResource.php                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'room' => $this->whenLoaded('room', fn () => [                      │ │
│ │         'id' => $this->room->id,                                        │ │
│ │         'name' => $this->room->name,                                    │ │
│ │         'logo' => $this->room->logo ?? null,                            │ │
│ │     ]),                                                                 │ │
│ │     'inviter' => $this->whenLoaded('inviter', fn () => [                │ │
│ │         'id' => $this->inviter->id,                                     │ │
│ │         'name' => $this->inviter->name,                                 │ │
│ │         'avatar' => $this->inviter->avatar,                             │ │
│ │     ]),                                                                 │ │
│ │     'status' => $this->status->value,                                   │ │
│ │     'message' => $this->message,                                        │ │
│ │     'expires_at' => $this->expires_at?->toIso8601String(),              │ │
│ │     'responded_at' => $this->responded_at?->toIso8601String(),          │ │
│ │     'created_at' => $this->created_at->toIso8601String(),               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: invitee is loaded but not included in response (room context)         │
│                                                                             │
│ API RESPONSE WRAPPER: ApiResponse::success()                                │
│ File: app/Http/Utils/ApiResponse.php                                        │
│ Adds: status, message, meta (timestamp, correlation_id)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         201 Created + JSON Body                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                   | Used By Endpoints                     | Reusable | Reasoning                                    |
| -------------------------------------- | ------------------------------------- | -------- | -------------------------------------------- |
| `SendInvitationRequest.php`            | POST /rooms/{room}/invitations only   | ❌       | Specific validation for send invitation      |
| `RoomInvitationController.php`         | All invitation endpoints              | ⭕       | Controller holds multiple invitation methods |
| `RoomInvitationService.php`            | All invitation/join request endpoints | ✅       | Centralized invitation logic                 |
| `RoomAuthorizationHelper.php`          | All room management services          | ✅       | Shared permission checking trait             |
| `RoomInvitationResource.php`           | All invitation GET/POST endpoints     | ✅       | Standard invitation response format          |
| `RoomInvitation.php`                   | All invitation operations             | ✅       | Model with scopes and helper methods         |
| `RoomMemberRole.php`                   | All room member operations            | ✅       | Enum with permission checking methods        |
| `RoomInvitationStatus.php`             | All invitation operations             | ✅       | Enum for invitation status values            |
| `RoomUserBlock.php`                    | Block operations, join/invite checks  | ✅       | Block status checking with caching           |
| `RoomMember.php`                       | All room member operations            | ✅       | Member model with permission methods         |
| `ApiResponse.php`                      | All API endpoints                     | ✅       | Standard API response wrapper                |
| `DomainException.php`                  | All domain exceptions                 | ✅       | Base exception with JSON rendering           |
| `InsufficientPermissionException.php`  | Permission-denied scenarios           | ✅       | Reusable 403 permission exception            |
| `PendingInvitationExistsException.php` | Duplicate invitation checks           | ✅       | Specific 409 conflict exception              |
| `AlreadyMemberException.php`           | Join/invite operations                | ✅       | Member conflict exception                    |
| `RoomBlockedException.php`             | Block-related checks                  | ✅       | Blocked user exception                       |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error              | Source                  | Condition                            |
| ------------------ | ----------------------- | ------------------------------------ |
| `user_id.required` | `SendInvitationRequest` | user_id missing from request         |
| `user_id.integer`  | `SendInvitationRequest` | user_id not a valid integer          |
| `user_id.exists`   | `SendInvitationRequest` | user_id doesn't exist in users table |
| `message.string`   | `SendInvitationRequest` | message is not a string              |
| `message.max`      | `SendInvitationRequest` | message exceeds 500 characters       |

### Authorization Errors (403)

| Error                                     | Source                            | Condition                        |
| ----------------------------------------- | --------------------------------- | -------------------------------- |
| "You do not have permission to invite..." | `InsufficientPermissionException` | User is not owner/admin of room  |
| "User is blocked from room"               | `RoomBlockedException`            | Invitee is blocked from the room |

### Conflict Errors (409)

| Error                                   | Source                             | Condition                                |
| --------------------------------------- | ---------------------------------- | ---------------------------------------- |
| "User already has a pending invitation" | `PendingInvitationExistsException` | Pending invitation exists for this user  |
| "User is already a member of this room" | `AlreadyMemberException`           | Invitee is already an active room member |

### Not Found Errors (404)

| Error            | Source              | Condition             |
| ---------------- | ------------------- | --------------------- |
| "Room not found" | Route Model Binding | Room ID doesn't exist |

### System Errors (500)

| Error                  | Source              | Condition                        |
| ---------------------- | ------------------- | -------------------------------- |
| Database exception     | PostgreSQL/Eloquent | Connection failure               |
| Transaction rollback   | DB::transaction()   | Any exception within transaction |
| Redis connection error | Cache operations    | Cache unavailable                |

### Edge Cases

| Case                                      | Behavior                                          |
| ----------------------------------------- | ------------------------------------------------- |
| Inviting yourself                         | Blocked by 'already a member' check               |
| Room at max capacity                      | Invitation still created (checked at accept time) |
| Invitation to recently unblocked user     | May fail due to Redis cache (5-min TTL)           |
| Concurrent invitations (same user)        | PostgreSQL unique index prevents duplicates       |
| Null message                              | Creates invitation with null message field        |
| Expired cache showing wrong member status | Member check has 2-min cache TTL                  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/CACHE
   │                       │                       │                       │                            │
   │  POST /rooms/{room}/  │                       │                       │                            │
   │  invitations          │                       │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │   (validate token)    │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 2. Route Model Bind   │                            │
   │                       │                       │    (load Room)        │                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │◀───────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 3. SendInvitationRequest                           │
   │                       │                       │    (validate body)    │                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │◀───────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 4. Call sendInvitation                             │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. Begin Transaction       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 6. Load Room               │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. Check invite permission │
   │                       │                       │                       │   (check membership)       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. Check pending invite    │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. Check if blocked        │
   │                       │                       │                       │   (Redis cache)            │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. Check if member        │
   │                       │                       │                       │    (Redis cache)           │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. INSERT invitation      │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 12. Commit Transaction     │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 13. Load relationships │                            │
   │                       │                       │    (invitee, room)     │                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │◀───────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 14. Transform to       │                            │
   │                       │                       │     Resource           │                            │
   │                       │                       │                       │                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  201 Created + JSON   │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                       |
| ------------------------ | ---------------------------------------------- |
| New validation rule      | `SendInvitationRequest.php` → rules()          |
| New business rule        | `RoomInvitationService.php` → sendInvitation() |
| New response field       | `RoomInvitationResource.php` → toArray()       |
| New invitation status    | `RoomInvitationStatus.php` enum                |
| Notification on invite   | `RoomInvitationService.php` after create()     |
| Rate limiting on invites | Route middleware or custom throttle            |
| Audit logging            | `RoomInvitationService.php` after create()     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD

| Step  | File                                                      | What to Change                       |
| ----- | --------------------------------------------------------- | ------------------------------------ |
| **1** | **Database Migration**                                    | Add column to room_invitations table |
| **2** | `app/Models/Room/RoomInvitation.php`                      | Add to `$fillable` array             |
| **3** | `app/Http/Requests/Api/V1/Room/SendInvitationRequest.php` | Add validation rule                  |
| **4** | `app/Services/Room/RoomInvitationService.php`             | Pass to RoomInvitation::create()     |
| **5** | `app/Http/Resources/V1/Room/RoomInvitationResource.php`   | Add to response array                |

#### ➖ REMOVING A FIELD

| Step  | File                                                      | What to Change            |
| ----- | --------------------------------------------------------- | ------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/SendInvitationRequest.php` | Remove validation rule    |
| **2** | `app/Services/Room/RoomInvitationService.php`             | Remove from create() call |
| **3** | `app/Http/Resources/V1/Room/RoomInvitationResource.php`   | Remove from response      |
| **4** | `app/Models/Room/RoomInvitation.php`                      | Remove from `$fillable`   |
| **5** | **Database Migration**                                    | Drop column (if safe)     |

### 🔗 Field Flow Dependency Chain

```
Request Body
    │
    ▼
┌─────────────────────────────────────────┐
│ SendInvitationRequest                   │
│   'user_id' => required, exists:users   │
│   'message' => optional, max:500        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomInvitationController::send()        │
│   $request->validated('user_id')        │
│   $request->validated('message')        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomInvitationService::sendInvitation() │
│   $inviteeId (from validated user_id)   │
│   $message (from validated message)     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomInvitation::create()                │
│   'room_id' => from route binding       │
│   'inviter_id' => authenticated user    │
│   'invitee_id' => from request          │
│   'message' => from request             │
│   'status' => PENDING (hardcoded)       │
│   'expires_at' => now()->addDays(7)     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ RoomInvitationResource                  │
│   id, room{}, inviter{}, status,        │
│   message, expires_at, responded_at,    │
│   created_at                            │
└─────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding `priority` Field (Example)

- [ ] Create migration: `php artisan make:migration add_priority_to_room_invitations`
- [ ] Add enum `InvitationPriority` if needed
- [ ] Add `'priority'` to `RoomInvitation::$fillable`
- [ ] Add cast if enum: `'priority' => InvitationPriority::class`
- [ ] Add to `SendInvitationRequest::rules()`: `'priority' => ['sometimes', 'string', 'in:low,normal,high']`
- [ ] Pass to service: `$request->validated('priority', 'normal')`
- [ ] Add to create array in service
- [ ] Add to `RoomInvitationResource::toArray()`: `'priority' => $this->priority`
- [ ] Run migration: `php artisan migrate`
- [ ] Update tests

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                     |
| --------------------------- | ---------------------------------------------------------- |
| `DB::transaction()` wrapper | Ensures atomicity of all checks before creating invitation |
| PostgreSQL unique index     | Prevents race conditions for duplicate pending invitations |
| Permission check order      | Must happen before other checks to fail fast               |
| `expires_at` calculation    | 7-day expiration is a business requirement                 |
| Status enum values          | Breaking changes affect existing records                   |
| Redis cache keys            | Other services depend on the key format                    |
| `DomainException` rendering | All domain exceptions use consistent JSON format           |

### 🚨 Common Pitfalls

| Pitfall                                         | Prevention                                         |
| ----------------------------------------------- | -------------------------------------------------- |
| Forgetting to add field to `$fillable`          | MassAssignmentException will occur                 |
| Not wrapping in transaction                     | Could create orphaned invitations on failure       |
| Checking member status after invitation created | Wrong order; check BEFORE creating                 |
| Not loading relationships before Resource       | Response will be missing `room` and `inviter` data |
| Changing cache TTL without consideration        | Stale data issues for block/member checks          |
| Adding validation without exists: rule          | Invalid user_id could be passed to service         |
| Forgetting to handle new exception types        | 500 errors instead of proper domain errors         |
| Removing status enum value                      | Existing records with that status will break       |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                             ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomInvitationController.php                         ← Controller
app/Http/Requests/Api/V1/Room/
  └── SendInvitationRequest.php                            ← Request validation
app/Services/Room/
  └── RoomInvitationService.php                            ← Business logic
app/Services/Room/Helpers/
  └── RoomAuthorizationHelper.php                          ← Permission trait
app/Models/Room/
  ├── Room.php                                             ← Room model
  ├── RoomInvitation.php                                   ← Invitation model
  ├── RoomMember.php                                       ← Member model
  └── RoomUserBlock.php                                    ← Block model
app/Http/Resources/V1/Room/
  └── RoomInvitationResource.php                           ← Response transformer
app/Enums/Room/
  ├── RoomInvitationStatus.php                             ← Status enum
  └── RoomMemberRole.php                                   ← Role enum
app/Exceptions/Room/
  ├── InsufficientPermissionException.php                  ← 403 exception
  ├── PendingInvitationExistsException.php                 ← 409 exception
  ├── AlreadyMemberException.php                           ← 409 exception
  └── RoomBlockedException.php                             ← 403 exception
app/Http/Utils/
  └── ApiResponse.php                                      ← Response wrapper
database/migrations/
  └── 2025_12_29_100002_create_room_invitations_table.php  ← Migration
```

---

## Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `POST /api/v1/rooms/{room}/invitations` |
| **Domain**          | Room Membership                         |
| **Author**          | System Documentation                    |
| **Created**         | 2026-02-01                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
