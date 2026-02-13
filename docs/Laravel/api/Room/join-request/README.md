# POST /api/v1/rooms/{room}/join-request

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Allows authenticated users to submit a join request to a private room, notifying the room owner in real-time for approval/rejection.

### Responsibilities

- Validate user eligibility to join the room
- Create a pending join request record
- Emit real-time event to room owner via MSAB

### What It Owns

| Owned             | Description                                             |
| ----------------- | ------------------------------------------------------- |
| Room Join Request | Creates `room_join_requests` record with pending status |

### External Dependencies

| Dependency | Type           | Purpose                                |
| ---------- | -------------- | -------------------------------------- |
| PostgreSQL | Database       | Store join request records             |
| MSAB       | Infrastructure | Real-time event emission to room owner |
| Sanctum    | Package        | Authentication via Bearer token        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/rooms/{room}/join-request
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config              |
| ------- | ------- | ------------------- |
| `api`   | User ID | `config.rate_limit` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description                   |
| --------- | --------- | ----------------------------- |
| `room`    | `integer` | Room ID (route model binding) |

### Request Body Schema

```json
{
  "message": "string|null" // Optional, max 500 characters
}
```

#### Field Details

| Field     | Type     | Constraints                 | Example              |
| --------- | -------- | --------------------------- | -------------------- |
| `message` | `string` | Optional, nullable, max 500 | `"Hey, can I join?"` |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Join request submitted",
  "data": {
    "id": 123,
    "room_id": 456,
    "status": "pending",
    "message": "Hey, can I join?",
    "reviewed_at": null,
    "rejection_reason": null,
    "created_at": "2026-02-01T00:00:00+00:00"
  },
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
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
    "message": ["The message field must not be greater than 500 characters."]
  }
}
```

#### ❌ Already Member (409)

```json
{
  "status": "error",
  "message": "User {userId} is already a member of room {roomId}",
  "data": null,
  "errors": {
    "code": "ALREADY_MEMBER",
    "context": {}
  }
}
```

#### ❌ Room Full (409)

```json
{
  "status": "error",
  "message": "Room {roomId} has reached maximum capacity of {capacity} members",
  "data": null,
  "errors": {
    "code": "ROOM_FULL",
    "context": {}
  }
}
```

#### ❌ Blocked from Room (403)

```json
{
  "status": "error",
  "message": "User {userId} is blocked from room {roomId}",
  "data": null,
  "errors": {
    "code": "ROOM_BLOCKED",
    "context": {}
  }
}
```

#### ❌ Pending Request Exists (409)

```json
{
  "status": "error",
  "message": "You already have a pending join request",
  "data": null,
  "errors": {
    "code": "PENDING_JOIN_REQUEST_EXISTS",
    "context": {}
  }
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `201` | Join request created successfully                   |
| `401` | Unauthenticated                                     |
| `403` | User is blocked from room                           |
| `404` | Room not found                                      |
| `409` | Already member / Room full / Pending request exists |
| `422` | Validation error (message too long)                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/rooms/{room}/join-request                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:30                                     │
│ Route: Route::post('/join-request', [RoomJoinRequestController::class,      │
│                                       'store'])                             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticate user via Sanctum token                    │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Resolves to App\Models\Room\Room instance                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/SubmitJoinRequestRequest.php            │
│                                                                             │
│ Authorization:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;  // Must be authenticated            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'message' => ['sometimes', 'nullable', 'string', 'max:500'],        │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:36-52  │
│ Method: store(SubmitJoinRequestRequest $request, Room $room)                │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest = $this->invitationService->submitJoinRequest(             │ │
│ │     $room->id,                                                          │ │
│ │     $user->id,                                                          │ │
│ │     $request->validated('message')                                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomJoinRequestResource($joinRequest),                          │ │
│ │     'Join request submitted',                                           │ │
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
│ File: app/Services/Room/RoomInvitationService.php:204-258                   │
│ Method: submitJoinRequest(int $roomId, int $userId, ?string $message)       │
│                                                                             │
│ STEP 1: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($roomId, $userId, $message) {   │ │
│ │     $room = Room::findOrFail($roomId);                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check join eligibility via RoomMemberService                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $canJoin = $this->memberService->canJoinRoom($userId, $room);           │ │
│ │                                                                         │ │
│ │ if (! $canJoin['can_join']) {                                           │ │
│ │     // Throws: RoomBlockedException, RoomFullException,                 │ │
│ │     //         AlreadyMemberException, InsufficientPermissionException  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check for existing pending request                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (RoomJoinRequest::hasPending($roomId, $userId)) {                    │ │
│ │     throw new PendingJoinRequestExistsException;                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Create join request record                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $request = RoomJoinRequest::create([                                    │ │
│ │     'room_id' => $roomId,                                               │ │
│ │     'user_id' => $userId,                                               │ │
│ │     'message' => $message,                                              │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Emit real-time event to room owner                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = User::find($userId);                                            │ │
│ │ if ($user) {                                                            │ │
│ │     $this->msabEventService->emitRoomJoinRequestCreated(                │ │
│ │         $roomId, $request->id, $room->user_id, $userId,                 │ │
│ │         $user->name, $user->avatar, $user->signature,                   │ │
│ │         $user->gender, $message                                         │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Return created request                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return $request;                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomMemberService (Service)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomMemberService.php                           │ │
│ │ Responsibility: Check if user can join a room                           │ │
│ │ Reusable: YES (used by join, invitation, join-request flows)            │ │
│ │ Why It Exists: Centralized join eligibility logic                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canJoinRoom(int $userId, Room $room) → array{can_join, reason}      │ │
│ │     Checks: member status, blocked status, room capacity                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequest (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomJoinRequest.php                               │ │
│ │ Responsibility: Eloquent model for room_join_requests table             │ │
│ │ Reusable: YES (used across all join request operations)                 │ │
│ │ Why It Exists: Data persistence and business rules                      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • hasPending(int $roomId, int $userId) → bool                         │ │
│ │   • isPending() → bool                                                  │ │
│ │   • approve(int $reviewerId) → void                                     │ │
│ │   • reject(int $reviewerId, ?string $reason) → void                     │ │
│ │   • cancel() → void                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emit real-time events via MSAB                          │ │
│ │ Reusable: YES (used across entire application for real-time events)     │ │
│ │ Why It Exists: Centralized real-time event emission                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitRoomJoinRequestCreated(...) → void                              │ │
│ │     Notifies room owner of new join request                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestResource (Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomJoinRequestResource.php            │ │
│ │ Responsibility: Transform RoomJoinRequest model to JSON                 │ │
│ │ Reusable: YES (used by all join request endpoints)                      │ │
│ │ Why It Exists: Consistent API response format                           │ │
│ │                                                                         │ │
│ │ Output Fields:                                                          │ │
│ │   • id, room_id, status, message, reviewed_at, rejection_reason,        │ │
│ │     created_at, room (conditional), user (conditional)                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestStatus (Enum)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomJoinRequestStatus.php                          │ │
│ │ Responsibility: Define possible join request states                     │ │
│ │ Reusable: YES                                                           │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
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
│ 1. SELECT (Route Model Binding): Find room by ID                            │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT: Check if user is member of room                                  │
│    Query: SELECT EXISTS(SELECT 1 FROM room_members WHERE user_id = ?        │
│                         AND room_id = ?)                                    │
│    Source: RoomMember::isMemberOfRoom()                                     │
│                                                                             │
│ 3. SELECT: Check if user is blocked from room                               │
│    Query: SELECT EXISTS(SELECT 1 FROM room_user_blocks WHERE room_id = ?    │
│                         AND user_id = ?)                                    │
│    Source: RoomUserBlock::isBlocked()                                       │
│                                                                             │
│ 4. SELECT: Check room capacity                                              │
│    Query: Uses cached participant_count from Room model                     │
│    Source: RoomMember::roomHasCapacity()                                    │
│                                                                             │
│ 5. SELECT: Check for pending join request                                   │
│    Query: SELECT EXISTS(SELECT 1 FROM room_join_requests WHERE room_id = ?  │
│                         AND user_id = ? AND status = 'pending')             │
│    Source: RoomJoinRequest::hasPending()                                    │
│                                                                             │
│ 6. INSERT: Create join request record                                       │
│    Query: INSERT INTO room_join_requests (room_id, user_id, message, ...)   │
│    Source: RoomJoinRequest::create()                                        │
│                                                                             │
│ 7. SELECT: Fetch user for event emission                                    │
│    Query: SELECT * FROM users WHERE id = ? LIMIT 1                          │
│    Source: User::find()                                                     │
│                                                                             │
│ EXTERNAL SERVICE CALLS:                                                     │
│                                                                             │
│ 1. EMIT: room.join_request_created event to room owner via MSAB             │
│    Target: Owner's user ID                                                  │
│    Payload: request_id, room_id, user info (id, name, avatar, etc), message │
│    Source: MSABEventService::emitRoomJoinRequestCreated()                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Room/RoomJoinRequestResource.php                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'room_id' => $this->room_id,                                        │ │
│ │     'room' => $this->when($this->relationLoaded('room'), [...]),        │ │
│ │     'user' => $this->when($this->relationLoaded('user'), [...]),        │ │
│ │     'status' => $this->status->value,                                   │ │
│ │     'message' => $this->message,                                        │ │
│ │     'reviewed_at' => $this->reviewed_at?->toIso8601String(),            │ │
│ │     'rejection_reason' => $this->rejection_reason,                      │ │
│ │     'created_at' => $this->created_at->toIso8601String(),               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php (success method)                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Join request submitted',                              │ │
│ │     'data' => $resource,                                                │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 201);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                            | Used By Endpoints                    | Reusable | Reasoning                                    |
| ------------------------------- | ------------------------------------ | -------- | -------------------------------------------- |
| `RoomJoinRequestController.php` | All join request endpoints           | ⭕       | General structure reusable, methods specific |
| `SubmitJoinRequestRequest.php`  | POST /rooms/{room}/join-request only | ❌       | Endpoint-specific validation                 |
| `RoomInvitationService.php`     | Join request + invitation endpoints  | ✅       | Shared invitation/request logic              |
| `RoomMemberService.php`         | All room membership endpoints        | ✅       | Core membership checks                       |
| `RoomJoinRequest.php`           | All join request operations          | ✅       | Model used everywhere                        |
| `RoomJoinRequestResource.php`   | All join request responses           | ✅       | Consistent response format                   |
| `MSABEventService.php`          | All real-time event endpoints        | ✅       | Centralized event emission                   |
| `ApiResponse.php`               | All API endpoints                    | ✅       | Unified response format                      |
| `RoomJoinRequestStatus.php`     | All join request operations          | ✅       | Status enum                                  |
| `DomainException.php`           | All domain exceptions                | ✅       | Base exception class                         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error            | Source                     | Condition                      |
| ---------------- | -------------------------- | ------------------------------ |
| `message.max`    | `SubmitJoinRequestRequest` | Message exceeds 500 characters |
| `message.string` | `SubmitJoinRequestRequest` | Message is not a string        |

### Authorization Errors (401/403)

| Error           | Source                    | Condition                 |
| --------------- | ------------------------- | ------------------------- |
| Unauthenticated | `auth:sanctum` middleware | No valid Bearer token     |
| `ROOM_BLOCKED`  | `RoomBlockedException`    | User is blocked from room |

### Business Logic Errors (409)

| Error                         | Source                              | Condition                              |
| ----------------------------- | ----------------------------------- | -------------------------------------- |
| `ALREADY_MEMBER`              | `AlreadyMemberException`            | User is already a room member          |
| `ROOM_FULL`                   | `RoomFullException`                 | Room has reached member capacity       |
| `PENDING_JOIN_REQUEST_EXISTS` | `PendingJoinRequestExistsException` | User has pending request for this room |

### System Errors (404/500)

| Error                 | Source              | Condition                         |
| --------------------- | ------------------- | --------------------------------- |
| Room not found        | Route Model Binding | Room ID does not exist            |
| Internal server error | Exception handler   | Unexpected database/service error |

### Edge Cases

| Case                       | Behavior                                     |
| -------------------------- | -------------------------------------------- |
| Empty request body         | Valid - message is optional                  |
| Null message               | Valid - saved as null in database            |
| Room owner submits request | Fails - already a member (owner is member)   |
| User has rejected request  | Can submit new request (only pending blocks) |
| User has cancelled request | Can submit new request                       |
| MSAB service unavailable   | Request still created, event silently fails  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER           INVITATION_SERVICE        MEMBER_SERVICE           DATABASE               MSAB
   │                     │                       │                       │                       │                      │                     │
   │  POST /rooms/{room}/join-request            │                       │                       │                      │                     │
   │─────────────────────▶│                      │                       │                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │ 1. auth:sanctum       │                       │                       │                      │                     │
   │                     │   (verify token)      │                       │                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │ 2. Bind {room} model  │                       │                       │                      │                     │
   │                     │───────────────────────────────────────────────────────────────────────▶│                     │
   │                     │                       │                       │                       │  SELECT rooms        │                     │
   │                     │◀───────────────────────────────────────────────────────────────────────│                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │ 3. Validate request   │                       │                       │                      │                     │
   │                     │──────────────────────▶│                       │                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │ 4. submitJoinRequest()│                       │                      │                     │
   │                     │                       │──────────────────────▶│                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │ 5. canJoinRoom()      │                      │                     │
   │                     │                       │                       │──────────────────────▶│                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │                       │ 6. isMemberOfRoom    │                     │
   │                     │                       │                       │                       │─────────────────────▶│                     │
   │                     │                       │                       │                       │◀─────────────────────│                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │                       │ 7. isBlocked         │                     │
   │                     │                       │                       │                       │─────────────────────▶│                     │
   │                     │                       │                       │                       │◀─────────────────────│                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │                       │ 8. roomHasCapacity   │                     │
   │                     │                       │                       │                       │  (cached)            │                     │
   │                     │                       │                       │◀──────────────────────│                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │ 9. hasPending         │                      │                     │
   │                     │                       │                       │─────────────────────────────────────────────▶│                     │
   │                     │                       │                       │◀─────────────────────────────────────────────│                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │ 10. INSERT request    │                      │                     │
   │                     │                       │                       │─────────────────────────────────────────────▶│                     │
   │                     │                       │                       │◀─────────────────────────────────────────────│                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │ 11. User::find()      │                      │                     │
   │                     │                       │                       │─────────────────────────────────────────────▶│                     │
   │                     │                       │                       │◀─────────────────────────────────────────────│                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │                       │ 12. emitRoomJoinRequestCreated()             │                     │
   │                     │                       │                       │────────────────────────────────────────────────────────────────────▶│
   │                     │                       │                       │◀────────────────────────────────────────────────────────────────────│
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │◀──────────────────────│                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │                       │ 13. Transform to Resource                     │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │                     │◀──────────────────────│                       │                       │                      │                     │
   │◀────────────────────│                       │                       │                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
   │  201 Created + JSON │                       │                       │                       │                      │                     │
   │                     │                       │                       │                       │                      │                     │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location(s)                                          |
| ---------------------- | ---------------------------------------------------- |
| New validation rule    | `SubmitJoinRequestRequest::rules()`                  |
| New eligibility check  | `RoomMemberService::canJoinRoom()`                   |
| New response field     | `RoomJoinRequestResource::toArray()`                 |
| New real-time event    | `MSABEventService` + call in `submitJoinRequest()`   |
| Rate limiting per room | Route middleware in `routes/api/room-membership.php` |
| Notification on submit | After `create()` in `submitJoinRequest()`            |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD

| Step  | File                                                         | What to Change                           |
| ----- | ------------------------------------------------------------ | ---------------------------------------- |
| **1** | **Database Migration**                                       | Add column to `room_join_requests` table |
| **2** | `app/Models/Room/RoomJoinRequest.php`                        | Add to `$fillable` array                 |
| **3** | `app/Http/Requests/Api/V1/Room/SubmitJoinRequestRequest.php` | Add validation rule                      |
| **4** | `app/Services/Room/RoomInvitationService.php`                | Pass field in `create()` array           |
| **5** | `app/Http/Resources/V1/Room/RoomJoinRequestResource.php`     | Add to response array                    |

#### ➖ REMOVING A FIELD

| Step  | File                                                         | What to Change               |
| ----- | ------------------------------------------------------------ | ---------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/SubmitJoinRequestRequest.php` | Remove validation rule       |
| **2** | `app/Services/Room/RoomInvitationService.php`                | Remove from `create()` array |
| **3** | `app/Http/Resources/V1/Room/RoomJoinRequestResource.php`     | Remove from response array   |
| **4** | `app/Models/Room/RoomJoinRequest.php`                        | Remove from `$fillable`      |
| **5** | **Database Migration**                                       | Drop column (if safe)        |

### 🔗 Field Flow Dependency Chain

```
Request Body (message)
        │
        ▼
┌───────────────────────────────────────┐
│ SubmitJoinRequestRequest              │
│ validates: message (optional, max:500)│
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequestController::store()    │
│ $request->validated('message')        │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomInvitationService::submitJoinRequest() │
│ RoomJoinRequest::create([..., 'message'])  │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequest Model                 │
│ $fillable includes 'message'          │
│ Stored in room_join_requests table    │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequestResource               │
│ 'message' => $this->message           │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ API Response                          │
│ { "data": { "message": "..." } }      │
└───────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                              |
| ----------------------------------- | --------------------------------------------------- |
| `RoomJoinRequest::hasPending()`     | Prevents duplicate requests; critical business rule |
| `RoomMemberService::canJoinRoom()`  | Core eligibility logic used by multiple flows       |
| `DB::transaction()` in service      | Ensures atomicity of request creation + event       |
| `RoomJoinRequestStatus` enum values | Database stores these values; changing breaks data  |
| Route model binding for `{room}`    | Automatic 404 handling for invalid room IDs         |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                       |
| ----------------------------------------- | ------------------------------------------------ |
| Removing transaction wrapper              | Keep transaction - ensures atomicity             |
| Adding blocking operations in transaction | Keep external calls (MSAB) at end of transaction |
| Not updating MSABEventService             | If adding user fields, update event payload too  |
| Changing exception constructors           | Exceptions are self-rendering; test error format |
| Ignoring `canJoinRoom` return format      | Always check `can_join` boolean, read `reason`   |
| Not loading relations for resource        | Resource conditionally includes room/user        |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:30                       ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomJoinRequestController.php:36-52               ← Controller store method
app/Http/Requests/Api/V1/Room/
  └── SubmitJoinRequestRequest.php                      ← Request validation
app/Services/Room/
  ├── RoomInvitationService.php:204-258                 ← Main business logic
  └── RoomMemberService.php:62-89                       ← Join eligibility check
app/Models/Room/
  └── RoomJoinRequest.php                               ← Eloquent model
app/Http/Resources/V1/Room/
  └── RoomJoinRequestResource.php                       ← Response transformer
app/Services/Gift/
  └── MSABEventService.php:433-460                      ← Real-time event emission
app/Enums/Room/
  └── RoomJoinRequestStatus.php                         ← Status enum
app/Exceptions/Room/
  ├── AlreadyMemberException.php                        ← 409 exception
  ├── RoomBlockedException.php                          ← 403 exception
  ├── RoomFullException.php                             ← 409 exception
  └── PendingJoinRequestExistsException.php             ← 409 exception
app/Http/Utils/
  └── ApiResponse.php                                   ← Response utility
```

---

## Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `POST /api/v1/rooms/{room}/join-request` |
| **Domain**          | Room                                     |
| **Author**          | System Documentation                     |
| **Created**         | 2026-02-01                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4                                      |
