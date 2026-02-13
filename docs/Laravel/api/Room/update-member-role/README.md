# PATCH /api/v1/rooms/{room}/members/{userId}/role

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-31

---

## 1. Domain Overview

### Purpose

Updates the role of a room member (promote to admin or demote to member). Only room owners can perform this action on any member; admins cannot change roles.

### Responsibilities

- Validate that the target user is an active member of the room
- Validate the new role is either `admin` or `member` (not `owner`)
- Prevent changing the owner's role
- Update member role in a transaction with row locking
- Emit real-time event for role change notification

### What It Owns

| Owned                    | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| Member role update       | Updates `role` field in `room_members` table               |
| Role hierarchy           | Enforces that owner role cannot be assigned via this route |
| Real-time role broadcast | Emits `room.member_role_changed` event to room             |

### External Dependencies

| Dependency       | Type           | Purpose                             |
| ---------------- | -------------- | ----------------------------------- |
| PostgreSQL       | Database       | Stores room member records          |
| Redis/Valkey     | Infrastructure | Real-time event publishing via MSAB |
| MSABEventService | Service        | Broadcasts role change events       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PATCH /api/v1/rooms/{room}/members/{userId}/role
```

### Authentication

✅ **Required** - Must be authenticated via Sanctum bearer token

### Rate Limiting

| Limiter          | Key     | Config                      |
| ---------------- | ------- | --------------------------- |
| Default throttle | User ID | 60 requests/minute per user |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description             | Example |
| --------- | --------- | ----------------------- | ------- |
| `room`    | `integer` | Room ID (model binding) | `123`   |
| `userId`  | `integer` | Target member's user ID | `456`   |

### Request Body Schema

```json
{
  "role": "string" // Required, must be 'admin' or 'member'
}
```

#### Field Details

| Field  | Type     | Constraints                        | Example   |
| ------ | -------- | ---------------------------------- | --------- |
| `role` | `string` | Required, must be `admin`/`member` | `"admin"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Member role updated successfully",
  "data": {
    "id": 789,
    "user": {
      "id": 456,
      "name": "John Doe",
      "signature": "Hello world",
      "avatar": "https://example.com/avatar.jpg",
      "frame": null,
      "gender": 1,
      "email": "john@example.com",
      "phone": "+1234567890",
      "country": "US",
      "date_of_birth": "1990-01-01",
      "wealth_xp": "15000",
      "charm_xp": "8000"
    },
    "role": "admin",
    "role_label": "Admin",
    "status": "active",
    "joined_at": "2026-01-15T10:30:00+00:00"
  },
  "meta": {
    "timestamp": "2026-01-31T18:39:38.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
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
    "role": ["The role field is required."]
  }
}
```

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "role": ["Role must be either admin or member."]
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": []
}
```

#### ❌ Forbidden - Cannot Change Owner Role (403)

```json
{
  "status": "error",
  "message": "Cannot kick the room owner",
  "data": null,
  "errors": []
}
```

#### ❌ Not Found - Member Not Found (404)

```json
{
  "status": "error",
  "message": "User 456 is not a member of room 123",
  "data": null,
  "errors": []
}
```

#### ❌ Bad Request - Invalid Role (400)

```json
{
  "status": "error",
  "message": "Cannot assign role: owner",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                          |
| ----- | -------------------------------------------------- |
| `200` | Role updated successfully                          |
| `400` | Invalid role (e.g., attempting to assign `owner`)  |
| `401` | Not authenticated                                  |
| `403` | Attempting to change owner's role                  |
| `404` | Member not found or room not found                 |
| `422` | Validation failed (role field missing/invalid)     |
| `500` | Server error (database failure, Redis unavailable) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              PATCH /api/v1/rooms/{room}/members/{userId}/role               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:62                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::patch('/members/{userId}/role',                                  │ │
│ │     [RoomMemberController::class, 'updateRole'])                        │ │
│ │     ->whereNumber('userId');                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates bearer token, attaches user to request        │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Bound to Room model (App\Models\Room\Room)                     │
│   • {userId} → Passed as integer parameter                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/UpdateMemberRoleRequest.php             │
│                                                                             │
│ Authorization: Requires authenticated user (returns false → 401)            │
│                                                                             │
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
│ │     'role' => ['required', 'string', 'in:admin,member'],                │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Messages:                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'role.in' => 'Role must be either admin or member.'                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If validation fails → 422 response with validation errors                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomMemberController.php:102         │
│ Method: updateRole(UpdateMemberRoleRequest $request, Room $room, int $userId)│
│                                                                             │
│ STEP 1: Extract validated role from request                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $request->validated('role')  // 'admin' or 'member'                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to RoomMemberService                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member = $this->memberService->updateMemberRole(                       │ │
│ │     $room->id,                                                          │ │
│ │     $userId,                                                            │ │
│ │     $request->validated('role')                                         │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response with updated member                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomMemberResource($member),                                    │ │
│ │     'Member role updated successfully'                                  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:228                           │
│ Method: updateMemberRole(int $roomId, int $memberUserId, string $newRole)   │
│                                                                             │
│ STEP 1: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($roomId, $memberUserId,         │ │
│ │                                          $newRole) {                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find member with pessimistic locking                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member = RoomMember::where('room_id', $roomId)                         │ │
│ │     ->where('user_id', $memberUserId)                                   │ │
│ │     ->where('status', RoomMemberStatus::ACTIVE)                         │ │
│ │     ->lockForUpdate()  // SELECT ... FOR UPDATE                         │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate member exists                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$member) {                                                         │ │
│ │     throw new MemberNotFoundException($memberUserId, $roomId);          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Validate not owner                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($member->isOwner()) {                                               │ │
│ │     throw new CannotKickOwnerException();  // Reused exception          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Validate role value                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $role = RoomMemberRole::tryFrom($newRole);                              │ │
│ │                                                                         │ │
│ │ if (!$role || $role === RoomMemberRole::OWNER) {                        │ │
│ │     throw new InvalidRoleException($newRole);                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Capture previous role for event                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $previousRole = $member->role->value;                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Update role and save (triggers role_order update in model boot)    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $member->role = $role;                                                  │ │
│ │ $member->save();  // Auto-updates role_order via model boot             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Emit real-time event                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitRoomMemberRoleChanged(                     │ │
│ │     $roomId,                                                            │ │
│ │     $memberUserId,                                                      │ │
│ │     $previousRole,                                                      │ │
│ │     $role->value                                                        │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9: Return updated member                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return $member;                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Defines valid room member roles                         │ │
│ │ Reusable: YES (used across all room member operations)                  │ │
│ │ Why It Exists: Type-safe role values with helper methods                │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • OWNER = 'owner' (cannot be assigned via API)                        │ │
│ │   • ADMIN = 'admin' (can be assigned)                                   │ │
│ │   • MEMBER = 'member' (can be assigned)                                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable label ('Owner', 'Admin', 'Member')         │ │
│ │   • tryFrom() → Safe parsing from string                                │ │
│ │   • canManageMembers() → Permission check                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Represents room membership records                      │ │
│ │ Reusable: YES (used by all room membership endpoints)                   │ │
│ │ Why It Exists: Eloquent model with role helper methods                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isOwner() → Check if member has owner role                          │ │
│ │   • isAdmin() → Check if member has admin role                          │ │
│ │                                                                         │ │
│ │ Model Boot (auto role_order):                                           │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ static::updating(function (RoomMember $member) {                    │ │ │
│ │ │     if ($member->isDirty('role')) {                                 │ │ │
│ │ │         $member->role_order = self::getRoleOrder($member->role);    │ │ │
│ │ │     }                                                               │ │ │
│ │ │ });                                                                 │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ Role Order Mapping:                                                     │ │
│ │   • OWNER → 1 (highest)                                                 │ │
│ │   • ADMIN → 2                                                           │ │
│ │   • MEMBER → 3 (lowest)                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Event Emitter)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php:420                        │ │
│ │ Responsibility: Emits real-time events to MSAB server via Redis pub/sub│ │
│ │ Reusable: YES (central event emitter for all real-time events)          │ │
│ │ Why It Exists: Decouples real-time broadcasting from business logic     │ │
│ │                                                                         │ │
│ │ emitRoomMemberRoleChanged():                                            │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $this->emit('room.member_role_changed', [                           │ │ │
│ │ │     'user_id' => $userId,                                           │ │ │
│ │ │     'previous_role' => $previousRole,                               │ │ │
│ │ │     'new_role' => $newRole,                                         │ │ │
│ │ │ ], null, $roomId);                                                  │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ Redis Channel: flylive:msab:events                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: DomainException (Base Exception)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/DomainException.php                                │ │
│ │ Responsibility: Base exception for domain-specific errors              │ │
│ │ Reusable: YES (base class for all domain exceptions)                    │ │
│ │                                                                         │ │
│ │ Child Exceptions Used:                                                  │ │
│ │   • MemberNotFoundException → 404, MEMBER_NOT_FOUND                     │ │
│ │   • CannotKickOwnerException → 403, CANNOT_KICK_OWNER                   │ │
│ │   • InvalidRoleException → 400, INVALID_ROLE                            │ │
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
│ 1. SELECT (with lock): Find active room member                              │
│    Query: SELECT * FROM room_members                                        │
│           WHERE room_id = ? AND user_id = ? AND status = 'active'           │
│           FOR UPDATE                                                        │
│    Source: RoomMemberService::updateMemberRole()                            │
│                                                                             │
│ 2. UPDATE: Update member role and role_order                                │
│    Query: UPDATE room_members                                               │
│           SET role = ?, role_order = ?, updated_at = ?                      │
│           WHERE id = ?                                                      │
│    Source: RoomMember::save() with boot updating hook                       │
│                                                                             │
│ REDIS OPERATIONS:                                                           │
│                                                                             │
│ 1. PUBLISH: Real-time event to MSAB                                         │
│    Channel: flylive:msab:events                                             │
│    Payload: room.member_role_changed event                                  │
│    Source: MSABEventService::emit()                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Room/RoomMemberResource.php                     │
│                                                                             │
│ Transforms RoomMember model to JSON:                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'user' => new MinimalUserResource($this->whenLoaded('user')),       │ │
│ │     'role' => $this->role->value,                                       │ │
│ │     'role_label' => $this->role->label(),                               │ │
│ │     'status' => $this->status->value,                                   │ │
│ │     'joined_at' => $this->joined_at?->toIso8601String(),                │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Nested MinimalUserResource (12 fields):                                     │
│   id, name, signature, avatar, frame, gender, email, phone,                 │
│   country, date_of_birth, wealth_xp, charm_xp                               │
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Wraps in standard envelope:                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Member role updated successfully",                        │ │
│ │   "data": { ... RoomMemberResource ... },                               │ │
│ │   "meta": { "timestamp": "...", "correlation_id": "..." }               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                       200 OK + JSON Body                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints                    | Reusable | Reasoning                             |
| ------------------------------ | ------------------------------------ | -------- | ------------------------------------- |
| `UpdateMemberRoleRequest.php`  | This endpoint only                   | ❌       | Specific validation for role update   |
| `RoomMemberController.php`     | All room member endpoints            | ⭕       | Controller has multiple actions       |
| `RoomMemberService.php`        | All room member endpoints            | ✅       | Central service for member operations |
| `RoomMemberResource.php`       | members, kick, role update           | ✅       | Standard member response format       |
| `MinimalUserResource.php`      | Many endpoints (rooms, members, etc) | ✅       | Generic nested user representation    |
| `RoomMemberRole.php` (Enum)    | All room member operations           | ✅       | Centralized role definitions          |
| `RoomMember.php` (Model)       | All room membership features         | ✅       | Core membership model                 |
| `MSABEventService.php`         | All real-time features               | ✅       | Centralized event emitter             |
| `MemberNotFoundException.php`  | kick, role update, drop membership   | ✅       | Reusable domain exception             |
| `CannotKickOwnerException.php` | kick, role update                    | ✅       | Reusable owner protection             |
| `InvalidRoleException.php`     | Role update only                     | ❌       | Specific to role assignment           |
| `ApiResponse.php`              | All API endpoints                    | ✅       | Standard response wrapper             |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error           | Source                    | Condition                       |
| --------------- | ------------------------- | ------------------------------- |
| `role.required` | `UpdateMemberRoleRequest` | Role field not provided         |
| `role.string`   | `UpdateMemberRoleRequest` | Role is not a string            |
| `role.in`       | `UpdateMemberRoleRequest` | Role is not `admin` or `member` |

### Business Logic Errors (400)

| Error                        | Source                 | Condition                                |
| ---------------------------- | ---------------------- | ---------------------------------------- |
| "Cannot assign role: {role}" | `InvalidRoleException` | Attempted to assign `owner` role via API |

### Authorization Errors (401/403)

| Error                        | Source                     | Condition                       |
| ---------------------------- | -------------------------- | ------------------------------- |
| "Unauthenticated."           | `auth:sanctum` middleware  | No valid bearer token           |
| "Cannot kick the room owner" | `CannotKickOwnerException` | Target member is the room owner |

### Not Found Errors (404)

| Error                                    | Source                    | Condition                      |
| ---------------------------------------- | ------------------------- | ------------------------------ |
| "User {id} is not a member of room {id}" | `MemberNotFoundException` | Member not found or not active |
| Room not found                           | Route model binding       | Room ID doesn't exist          |

### System Errors (500)

| Error                     | Source           | Condition                             |
| ------------------------- | ---------------- | ------------------------------------- |
| Database connection error | DB::transaction  | PostgreSQL unavailable                |
| Redis publish error       | MSABEventService | Redis unavailable (logged, not fatal) |

### Edge Cases

| Case                       | Behavior                                   |
| -------------------------- | ------------------------------------------ |
| Same role as current       | Updates anyway (no-op but valid)           |
| Member already left/kicked | 404 - only active members found            |
| Concurrent role update     | Row locking prevents race conditions       |
| MSAB event fails           | Logged but doesn't affect response         |
| userId not a number        | Route constraint rejects before controller |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/REDIS
   │                       │                       │                       │                            │
   │  PATCH /rooms/{room}/members/{userId}/role    │                       │                            │
   │  { "role": "admin" }  │                       │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │    validate token     │                       │                            │
   │                       │───────────────────────│                       │                            │
   │                       │                       │                       │                            │
   │                       │ 2. Route model bind   │                       │                            │
   │                       │    resolve Room       │                       │                            │
   │                       │───────────────────────│                       │                            │
   │                       │                       │                       │                            │
   │                       │ 3. Request validation │                       │                            │
   │                       │    (role in:admin,member)                     │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 4. updateRole()       │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. BEGIN TRANSACTION       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 6. SELECT ... FOR UPDATE   │
   │                       │                       │                       │    (find member with lock) │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. Validate: not owner     │
   │                       │                       │                       │    Validate: role valid    │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. UPDATE room_members     │
   │                       │                       │                       │    SET role=?, role_order=?│
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. PUBLISH MSAB event      │
   │                       │                       │                       │    room.member_role_changed│
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │ (Redis)
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. COMMIT                 │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │ 11. Return member     │                            │
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │                       │                            │
   │                       │ 12. Build response    │                       │                            │
   │                       │    RoomMemberResource │                       │                            │
   │                       │◀──────────────────────│                       │                            │
   │                       │                       │                       │                            │
   │  200 OK + JSON        │                       │                       │                            │
   │◀──────────────────────│                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                        |
| -------------------------- | ----------------------------------------------- |
| New role type              | `RoomMemberRole.php` enum + validation rules    |
| Role change permissions    | `RoomMemberService::updateMemberRole()`         |
| Additional role event data | `MSABEventService::emitRoomMemberRoleChanged()` |
| Role change history/audit  | New table + service method                      |
| Response field             | `RoomMemberResource.php`                        |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO REQUEST

| Step  | File                                                        | What to Change                   |
| ----- | ----------------------------------------------------------- | -------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/UpdateMemberRoleRequest.php` | Add validation rule              |
| **2** | `app/Services/Room/RoomMemberService.php`                   | Accept field in method signature |
| **3** | Possibly `app/Models/Room/RoomMember.php`                   | Add to `$fillable` if persisted  |
| **4** | `app/Http/Resources/V1/Room/RoomMemberResource.php`         | Add to response if needed        |

#### ➕ ADDING A NEW ALLOWED ROLE

| Step  | File                                                        | What to Change                  |
| ----- | ----------------------------------------------------------- | ------------------------------- |
| **1** | `app/Enums/Room/RoomMemberRole.php`                         | Add new case + methods          |
| **2** | `app/Http/Requests/Api/V1/Room/UpdateMemberRoleRequest.php` | Update `in:` rule               |
| **3** | `app/Services/Room/RoomMemberService.php`                   | Update owner check if needed    |
| **4** | `app/Models/Room/RoomMember.php`                            | Update `getRoleOrder()` mapping |

#### ➖ REMOVING ROLE OPTION

| Step  | File                                                        | What to Change            |
| ----- | ----------------------------------------------------------- | ------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/UpdateMemberRoleRequest.php` | Remove from `in:` rule    |
| **2** | Database migration                                          | Consider existing records |

### 🔗 Field Flow Dependency Chain

```
Request Input
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ UpdateMemberRoleRequest                                                     │
│ Validates: role (required, string, in:admin,member)                         │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RoomMemberController                                                        │
│ Extracts: $request->validated('role')                                       │
│ Passes: $room->id, $userId, $role                                           │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RoomMemberService::updateMemberRole()                                       │
│ Converts: string → RoomMemberRole enum                                      │
│ Updates: $member->role                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RoomMember (Model boot)                                                     │
│ Auto-sets: role_order based on role                                         │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MSABEventService                                                            │
│ Emits: previous_role, new_role (string values)                              │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RoomMemberResource                                                          │
│ Outputs: role (value), role_label (label)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklist

**Adding role validation:**

- [ ] Update `UpdateMemberRoleRequest::rules()`
- [ ] Update `UpdateMemberRoleRequest::messages()` if custom error
- [ ] Test validation errors return properly

**Adding role permission logic:**

- [ ] Update `RoomMemberService::updateMemberRole()`
- [ ] Consider who can perform the role change
- [ ] Add appropriate exception if needed

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                         |
| -------------------------------- | ---------------------------------------------- |
| `RoomMemberRole::OWNER`          | Owner role should never be assignable via API  |
| `lockForUpdate()` in service     | Prevents race conditions in concurrent updates |
| Transaction wrapper              | Ensures atomicity of role + event              |
| `CannotKickOwnerException` reuse | Intentional - same protection pattern          |
| `role_order` auto-update in boot | Keeps member sorting consistent                |

### 🚨 Common Pitfalls

| Pitfall                               | Prevention                                          |
| ------------------------------------- | --------------------------------------------------- |
| Adding `owner` to allowed roles       | Never add - use ownership transfer endpoint instead |
| Removing transaction                  | Always use transaction for data + event consistency |
| Skipping member existence check       | Always validate member exists before update         |
| Forgetting role_order                 | Model boot handles automatically - don't override   |
| Assuming event delivery is guaranteed | Event failures are logged but not fatal             |
| Checking permissions on wrong user    | Verify YOU are checking the CALLER's permissions    |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:62                       ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomMemberController.php:102                      ← Controller method
app/Http/Requests/Api/V1/Room/
  └── UpdateMemberRoleRequest.php                       ← Request validation
app/Services/Room/
  └── RoomMemberService.php:228                         ← Business logic
app/Models/Room/
  └── RoomMember.php                                    ← Member model
app/Enums/Room/
  └── RoomMemberRole.php                                ← Role enum
app/Http/Resources/V1/Room/
  └── RoomMemberResource.php                            ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                           ← Nested user resource
app/Exceptions/Room/
  ├── MemberNotFoundException.php                       ← 404 exception
  ├── CannotKickOwnerException.php                      ← 403 exception
  └── InvalidRoleException.php                          ← 400 exception
app/Services/Gift/
  └── MSABEventService.php:420                          ← Real-time events
app/Http/Utils/
  └── ApiResponse.php                                   ← Response wrapper
```

---

## Document Metadata

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Endpoint**        | `PATCH /api/v1/rooms/{room}/members/{userId}/role` |
| **Domain**          | Room                                               |
| **Author**          | System Documentation                               |
| **Created**         | 2026-01-31                                         |
| **Laravel Version** | 12.x                                               |
| **PHP Version**     | 8.4                                                |
