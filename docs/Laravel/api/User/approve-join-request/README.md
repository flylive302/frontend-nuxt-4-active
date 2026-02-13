# POST /api/v1/user/room/join-requests/{id}/approve

> **Domain**: User / Room Membership  
> **Type**: Protected Endpoint (Admin/Owner)  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Approves a pending join request and adds the requesting user as a member of the room. Only room owners or admins with manage permissions can approve join requests.

### Responsibilities

- Validate the join request exists and is pending
- Verify the approver has permission to manage the room
- Check if the requester can still join (not blocked, room not full)
- Approve the request and add requester as member
- Emit real-time notification to the requester

### What It Owns

| Owned                      | Description                                         |
| -------------------------- | --------------------------------------------------- |
| Join Request Status Update | Changes status from `pending` to `approved`         |
| Room Member Creation       | Creates new `room_members` record for approved user |
| Real-time Event Emission   | Notifies requester of approval via MSAB             |

### External Dependencies

| Dependency       | Type           | Purpose                               |
| ---------------- | -------------- | ------------------------------------- |
| MSABEventService | Service        | Emits real-time approval notification |
| Database (MySQL) | Infrastructure | Transaction for request + member      |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/room/join-requests/{id}/approve
```

### Authentication

✅ **Required** - Bearer token via Sanctum. User must be room owner or admin.

### Rate Limiting

| Limiter  | Key       | Config               |
| -------- | --------- | -------------------- |
| Standard | `user:id` | Default API throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type  | Constraints       | Example | Description     |
| --------- | ----- | ----------------- | ------- | --------------- |
| `id`      | `int` | Required, numeric | `42`    | Join request ID |

### Request Body Schema

```json
// No request body required
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Request approved",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T01:52:26.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": []
}
```

#### ❌ Forbidden (403)

```json
{
  "status": "error",
  "message": "You do not have permission to approve join requests",
  "data": null,
  "errors": []
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "Join request not found",
  "data": null,
  "errors": []
}
```

#### ❌ Room Full (409)

```json
{
  "status": "error",
  "message": "Room has reached maximum capacity",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | Request approved successfully                 |
| `401` | User not authenticated                        |
| `403` | User lacks permission or requester is blocked |
| `404` | Join request not found or not pending         |
| `409` | Room is full (cannot add more members)        |
| `500` | Database or server error                      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│             POST /api/v1/user/room/join-requests/{id}/approve               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:51                                     │
│ Route: Route::post('/join-requests/{id}/approve',                           │
│            [RoomJoinRequestController::class, 'approve'])->whereNumber('id')│
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token and loads user                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:129    │
│                                                                             │
│ No FormRequest - uses basic Request. Authorization check delegated to      │
│ service layer.                                                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function approve(Request $request, int $id): JsonResponse       │ │
│ │ {                                                                       │ │
│ │     $user = $request->user();                                           │ │
│ │     if ($user === null) {                                               │ │
│ │         return ApiResponse::unauthorized();                             │ │
│ │     }                                                                   │ │
│ │     $this->invitationService->approveJoinRequest($id, $user->id);       │ │
│ │     return ApiResponse::success(null, 'Request approved');              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php        │
│ Method: approve(Request $request, int $id)                                  │
│                                                                             │
│ STEP 1: Check user authentication                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service layer                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->invitationService->approveJoinRequest($id, $user->id);           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Request approved');                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomInvitationService.php:267-315                   │
│ Method: approveJoinRequest(int $requestId, int $reviewerId): RoomMember     │
│                                                                             │
│ STEP 1: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($requestId, $reviewerId) {      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find and lock join request                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $request = RoomJoinRequest::where('id', $requestId)                     │ │
│ │     ->lockForUpdate()                                                   │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (! $request || ! $request->isPending()) {                            │ │
│ │     throw new JoinRequestNotFoundException;                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Verify reviewer permissions via trait                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::findOrFail($request->room_id);                            │ │
│ │ if (! $this->canManageRoom($reviewerId, $room)) {                       │ │
│ │     throw new InsufficientPermissionException('approve join requests'); │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Check if requester can still join                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $canJoin = $this->memberService->canJoinRoom($request->user_id, $room); │ │
│ │                                                                         │ │
│ │ if (! $canJoin['can_join']) {                                           │ │
│ │     $request->reject($reviewerId, $canJoin['reason']);                  │ │
│ │     // Throw RoomFullException or RoomBlockedException                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Approve request and add member                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $request->approve($reviewerId);                                         │ │
│ │ $member = $this->memberService->addMember(                              │ │
│ │     $request->room_id,                                                  │ │
│ │     $request->user_id                                                   │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Emit real-time notification                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitRoomJoinRequestApproved(                   │ │
│ │     $request->user_id,                                                  │ │
│ │     $request->room_id,                                                  │ │
│ │     $room->name                                                         │ │
│ │ );                                                                      │ │
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
│ │ Responsibility: Centralized permission checks for room management       │ │
│ │ Reusable: YES (used by RoomInvitationService, RoomMemberService)        │ │
│ │ Why It Exists: Eliminates duplicate owner/admin check pattern           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageRoom($userId, $room) → bool (owner OR admin w/ perms)      │ │
│ │   • getMembershipForAuthorization() → uses once() for memoization       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberService (Service)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomMemberService.php                           │ │
│ │ Responsibility: Room member lifecycle management                        │ │
│ │ Reusable: YES (used by multiple endpoints)                              │ │
│ │ Why It Exists: Centralizes member operations with validation            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canJoinRoom($userId, $room) → {can_join: bool, reason: string|null} │ │
│ │   • addMember($roomId, $userId, $role, $invitedBy) → RoomMember         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequest (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomJoinRequest.php                               │ │
│ │ Responsibility: Join request data and status management                 │ │
│ │ Reusable: YES (used across join request endpoints)                      │ │
│ │ Why It Exists: Encapsulates join request state transitions              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isPending() → bool                                                  │ │
│ │   • approve($reviewerId) → updates status, reviewer, timestamp          │ │
│ │   • reject($reviewerId, $reason) → updates status with reason           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestStatus (Enum)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomJoinRequestStatus.php                          │ │
│ │ Responsibility: Type-safe status values for join requests               │ │
│ │ Reusable: YES (used across all join request operations)                 │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Real-time event emission via MSAB                       │ │
│ │ Reusable: YES (used across many features)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitRoomJoinRequestApproved($userId, $roomId, $roomName)            │ │
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
│ 1. SELECT + LOCK: Find join request with pessimistic lock                   │
│    Query: SELECT * FROM room_join_requests WHERE id = ? FOR UPDATE          │
│    Source: RoomInvitationService::approveJoinRequest()                      │
│                                                                             │
│ 2. SELECT: Find room by ID                                                  │
│    Query: SELECT * FROM rooms WHERE id = ?                                  │
│    Source: Room::findOrFail($request->room_id)                              │
│                                                                             │
│ 3. SELECT: Check reviewer membership (memoized)                             │
│    Query: SELECT * FROM room_members WHERE room_id = ? AND user_id = ?      │
│           AND status = 'active'                                             │
│    Source: RoomAuthorizationHelper::getMembershipForAuthorization()         │
│                                                                             │
│ 4. SELECT: Check if requester is already member                             │
│    Query: SELECT EXISTS(...) FROM room_members                              │
│    Source: RoomMemberService::canJoinRoom()                                 │
│                                                                             │
│ 5. SELECT: Check if requester is blocked                                    │
│    Query: SELECT EXISTS(...) FROM room_user_blocks                          │
│    Source: RoomMemberService::canJoinRoom()                                 │
│                                                                             │
│ 6. UPDATE: Approve join request                                             │
│    Query: UPDATE room_join_requests SET status = 'approved',                │
│           reviewed_by = ?, reviewed_at = ? WHERE id = ?                     │
│    Source: RoomJoinRequest::approve()                                       │
│                                                                             │
│ 7. INSERT: Create room member                                               │
│    Query: INSERT INTO room_members (room_id, user_id, role, status,         │
│           joined_at, ...) VALUES (...)                                      │
│    Source: RoomMemberService::addMember()                                   │
│                                                                             │
│ REAL-TIME OPERATIONS:                                                       │
│                                                                             │
│ 1. EMIT: Room join request approved event                                   │
│    Target: Requester user                                                   │
│    Source: MSABEventService::emitRoomJoinRequestApproved()                  │
│                                                                             │
│ TRANSACTION BOUNDARY:                                                       │
│                                                                             │
│ All database operations wrapped in DB::transaction() for atomicity.         │
│ If any step fails, all changes are rolled back.                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Controller returns simple success with null data:                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Request approved');                  │ │
│ │                                                                         │ │
│ │ // Produces:                                                            │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Request approved",                                        │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "...",                                                 │ │
│ │     "correlation_id": "..."                                             │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
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

| File                                   | Used By Endpoints                               | Reusable | Reasoning                                      |
| -------------------------------------- | ----------------------------------------------- | -------- | ---------------------------------------------- |
| `RoomInvitationService.php`            | Invite, Accept, Cancel, Submit, Approve, Reject | ✅       | Central service for all invitation/request ops |
| `RoomMemberService.php`                | Join, Leave, Kick, Role update                  | ✅       | Shared member lifecycle management             |
| `RoomAuthorizationHelper.php`          | All room member/invitation services             | ✅       | Trait for permission checking                  |
| `RoomJoinRequest.php`                  | Submit, Cancel, Approve, Reject, List           | ✅       | Model for all join request operations          |
| `RoomJoinRequestStatus.php`            | All join request operations                     | ✅       | Type-safe enum for status values               |
| `MSABEventService.php`                 | Many features across app                        | ✅       | Central real-time event emission               |
| `ApiResponse.php`                      | All API endpoints                               | ✅       | Standardized response formatting               |
| `RoomJoinRequestController::approve()` | This endpoint only                              | ❌       | Endpoint-specific orchestration                |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error          | Source     | Condition                  |
| -------------- | ---------- | -------------------------- |
| "Unauthorized" | Controller | `$request->user()` is null |

### Not Found Errors (404)

| Error                    | Source                       | Condition                               |
| ------------------------ | ---------------------------- | --------------------------------------- |
| "Join request not found" | JoinRequestNotFoundException | Request ID doesn't exist or not pending |

### Permission Errors (403)

| Error                                      | Source                          | Condition                                |
| ------------------------------------------ | ------------------------------- | ---------------------------------------- |
| "You do not have permission to approve..." | InsufficientPermissionException | User is not owner/admin of room          |
| "You are blocked from this room"           | RoomBlockedException            | Requester became blocked before approval |

### Conflict Errors (409)

| Error                                  | Source            | Condition                        |
| -------------------------------------- | ----------------- | -------------------------------- |
| "Room has reached maximum capacity..." | RoomFullException | Room became full before approval |

### System Errors (500)

| Error                     | Source           | Condition                      |
| ------------------------- | ---------------- | ------------------------------ |
| Database transaction fail | DB::transaction  | Deadlock or connection failure |
| MSAB event emission fail  | MSABEventService | External service unavailable   |

### Edge Cases

| Case                               | Behavior                                              |
| ---------------------------------- | ----------------------------------------------------- |
| Request already approved           | Returns 404 (isPending() check fails)                 |
| Request was rejected               | Returns 404 (isPending() check fails)                 |
| Request was cancelled              | Returns 404 (isPending() check fails)                 |
| Requester blocked after submitting | Auto-rejects with reason, throws RoomBlockedException |
| Room became full after submitting  | Auto-rejects with reason, throws RoomFullException    |
| Requester already a member         | canJoinRoom returns false (already member case)       |
| Concurrent approval attempts       | Pessimistic lock prevents race condition              |
| Approver owns room                 | Allowed (owner always has permission)                 |
| Approver is admin                  | Allowed if admin role has manage permissions          |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                AUTH MIDDLEWARE        CONTROLLER             SERVICE LAYER           DATABASE
   │                       │                       │                       │                    │
   │ POST /join-requests/  │                       │                       │                    │
   │ {id}/approve          │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 1. Validate token     │                       │                    │
   │                       │   Load user           │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 2. Check user exists  │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 3. BEGIN TRANSACTION│
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 4. SELECT ... FOR  │
   │                       │                       │                       │    UPDATE request  │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 5. SELECT room     │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 6. SELECT membership│
   │                       │                       │                       │    (authorization) │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 7. Check can join  │
   │                       │                       │                       │    (member/block)  │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 8. UPDATE request  │
   │                       │                       │                       │    (approved)      │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 9. INSERT member   │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 10. COMMIT         │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 11. Emit MSAB event│
   │                       │                       │                       │    (async)         │
   │                       │                       │                       │                    │
   │                       │                       │◀──────────────────────│                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │                       │                       │                       │                    │
   │  200 + JSON           │                       │                       │                    │
   │                       │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location(s)                                   |
| ------------------------ | --------------------------------------------- |
| New validation rules     | Create FormRequest in `app/Http/Requests/`    |
| Pre-approval checks      | `RoomInvitationService::approveJoinRequest()` |
| Post-approval actions    | After `addMember()` call in service           |
| Additional notifications | After `emitRoomJoinRequestApproved()` call    |
| Custom approval message  | Add to request body, pass to service          |
| Approval audit logging   | Add observer to `RoomJoinRequest` model       |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., approval_note)

| Step  | File                                          | What to Change                      |
| ----- | --------------------------------------------- | ----------------------------------- |
| **1** | **Database Migration**                        | Add `approval_note` column          |
| **2** | `app/Models/Room/RoomJoinRequest.php`         | Add to `$fillable` array            |
| **3** | `app/Http/Requests/.../ApproveRequest.php`    | Create FormRequest with validation  |
| **4** | `app/Http/Controllers/.../Controller.php`     | Accept FormRequest, pass to service |
| **5** | `app/Services/Room/RoomInvitationService.php` | Accept and use in `approve()` call  |

#### ➖ REMOVING A FIELD

| Step  | File                                          | What to Change             |
| ----- | --------------------------------------------- | -------------------------- |
| **1** | `app/Http/Requests/...`                       | Remove validation rule     |
| **2** | `app/Services/Room/RoomInvitationService.php` | Remove from service method |
| **3** | `app/Models/Room/RoomJoinRequest.php`         | Remove from `$fillable`    |
| **4** | **Database Migration**                        | Drop column (if safe)      |

### 🔗 Field Flow Dependency Chain

```
                    ┌─────────────────┐
                    │  Path Param     │
                    │  {id}           │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Controller     │
                    │  $id (int)      │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  RoomInvitationService       │
              │  approveJoinRequest($id, ..) │
              └──────────────┬───────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ RoomJoinRequest │ │ RoomMemberSvc   │ │ MSABEventSvc    │
│ Model Update    │ │ addMember()     │ │ emit()          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                  |
| --------------------------- | ------------------------------------------------------- |
| `DB::transaction()` wrapper | Ensures atomicity of request approval + member creation |
| `lockForUpdate()` call      | Prevents race conditions on concurrent approvals        |
| Status transition order     | Must update request BEFORE adding member                |
| Permission check order      | Must verify permissions BEFORE any mutations            |
| `canJoinRoom()` checks      | Prevents invalid member additions                       |

### 🚨 Common Pitfalls

| Pitfall                       | Prevention                                               |
| ----------------------------- | -------------------------------------------------------- |
| Approving without transaction | Always wrap in `DB::transaction()`                       |
| Skipping permission check     | Always call `canManageRoom()` before mutations           |
| Not checking if still pending | Always verify `isPending()` before approval              |
| Ignoring canJoinRoom result   | Handle all failure cases (blocked, full, already member) |
| Removing lockForUpdate        | Causes race conditions, keep pessimistic locking         |
| Emitting event before commit  | Event would fire even if transaction rolls back          |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                           ← Route definition (line 51)
app/Http/Controllers/Api/V1/Room/
  └── RoomJoinRequestController.php                      ← Controller (approve method)
app/Services/Room/
  ├── RoomInvitationService.php                          ← Main service logic
  ├── RoomMemberService.php                              ← Member operations
  └── Helpers/RoomAuthorizationHelper.php                ← Permission trait
app/Models/Room/
  ├── RoomJoinRequest.php                                ← Join request model
  ├── RoomMember.php                                     ← Room member model
  └── Room.php                                           ← Room model
app/Enums/Room/
  └── RoomJoinRequestStatus.php                          ← Status enum
app/Exceptions/Room/
  ├── JoinRequestNotFoundException.php                   ← 404 exception
  ├── InsufficientPermissionException.php                ← 403 exception
  ├── RoomFullException.php                              ← 409 exception
  └── RoomBlockedException.php                           ← 403 exception
app/Http/Utils/
  └── ApiResponse.php                                    ← Response helper
app/Services/Gift/
  └── MSABEventService.php                               ← Real-time events
```

---

## Document Metadata

| Property            | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/room/join-requests/{id}/approve` |
| **Domain**          | User / Room Membership                              |
| **Author**          | System Documentation                                |
| **Created**         | 2026-02-01                                          |
| **Laravel Version** | 12.x                                                |
| **PHP Version**     | 8.4                                                 |
