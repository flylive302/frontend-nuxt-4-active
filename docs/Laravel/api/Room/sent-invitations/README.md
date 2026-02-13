# GET /api/v1/rooms/{room}/invitations

> **Domain**: Room  
> **Type**: Protected Endpoint (Owner/Admin Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves all pending (non-expired) invitations that have been sent from a specific room. This endpoint allows room owners and admins to view outstanding invitations.

### Responsibilities

- Authenticate the requesting user
- Verify user has owner/admin permissions for the room
- Fetch all pending, non-expired invitations for the room
- Return invitation list with invitee information

### What It Owns

| Owned              | Description                                        |
| ------------------ | -------------------------------------------------- |
| Invitation listing | Retrieves sent invitations for a specific room     |
| Permission check   | Validates user has `canManageMembers()` permission |

### External Dependencies

| Dependency | Type           | Purpose                                         |
| ---------- | -------------- | ----------------------------------------------- |
| Database   | Infrastructure | Query `room_invitations`, `room_members` tables |
| Cache      | Infrastructure | Membership cache via `once()` memoization       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/{room}/invitations
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config               |
| ------- | ------- | -------------------- |
| Default | User ID | `config/sanctum.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type  | Constraints      | Example |
| --------- | ----- | ---------------- | ------- |
| `room`    | `int` | Required, exists | `42`    |

### Request Body Schema

```
No request body required.
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "id": 123,
      "room": null, // Not loaded for sent invitations
      "inviter": null, // Not loaded for sent invitations
      "invitee": {
        // Loaded via with('invitee')
        "id": 456,
        "name": "John Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "status": "pending",
      "message": "Join our room!", // string|null
      "expires_at": "2026-02-08T00:00:00+00:00", // ISO8601|null
      "responded_at": null, // ISO8601|null
      "created_at": "2026-02-01T00:00:00+00:00"
    }
  ],
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
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
    "timestamp": "2026-02-01T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not have permission",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Not Found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `200` | Successfully retrieved invitations         |
| `401` | User not authenticated                     |
| `403` | User lacks owner/admin permission for room |
| `404` | Room not found (route model binding)       |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms/{room}/invitations                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:65                                     │
│ Route: Route::get('/invitations', [RoomInvitationController::class, 'sent'])│
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, loads authenticated user       │
│                                                                             │
│ Route Model Binding: {room} → Room::class (auto-resolved)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php:98-114  │
│                                                                             │
│ No FormRequest - uses standard Request for this read-only endpoint          │
│ Room is resolved via route model binding before controller is called        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php         │
│ Method: sent(Request $request, Room $room)                                  │
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
│ STEP 2: Check permission via RoomMemberService                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membership = $this->memberService->getMembershipForRoom(               │ │
│ │     $user->id,                                                          │ │
│ │     $room->id                                                           │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ if (!$membership || !$membership->canManageMembers()) {                 │ │
│ │     return ApiResponse::forbidden('You do not have permission');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Fetch sent invitations                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitations = $this->invitationService->getSentInvitations($room->id); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     RoomInvitationResource::collection($invitations)                    │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: RoomMemberService                                                  │
│ File: app/Services/Room/RoomMemberService.php:49-55                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getMembershipForRoom(int $userId, int $roomId): ?Member │ │
│ │ {                                                                       │ │
│ │     return RoomMember::where('user_id', $userId)                        │ │
│ │         ->where('room_id', $roomId)                                     │ │
│ │         ->where('status', RoomMemberStatus::ACTIVE)                     │ │
│ │         ->first();                                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SERVICE: RoomInvitationService                                              │
│ File: app/Services/Room/RoomInvitationService.php:186-194                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getSentInvitations(int $roomId): Collection             │ │
│ │ {                                                                       │ │
│ │     return RoomInvitation::where('room_id', $roomId)                    │ │
│ │         ->pending()           // status = 'pending'                     │ │
│ │         ->notExpired()        // expires_at > now() OR NULL             │ │
│ │         ->with('invitee')     // Eager load invitee user                │ │
│ │         ->orderBy('created_at', 'desc')                                 │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
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
│ │ Responsibility: Room membership records with role-based permissions     │ │
│ │ Reusable: YES (used by all room member operations)                      │ │
│ │ Why It Exists: Central membership model for multi-room support          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageMembers() → Checks if role is OWNER or ADMIN               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Defines role values and permission checks               │ │
│ │ Reusable: YES (used throughout room system)                             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageMembers() → true for OWNER, ADMIN                          │ │
│ │   • canInvite() → true for OWNER, ADMIN                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitation (Model)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomInvitation.php                                │ │
│ │ Responsibility: Room invitation records with status management          │ │
│ │ Reusable: YES (used by all invitation operations)                       │ │
│ │                                                                         │ │
│ │ Key Scopes:                                                             │ │
│ │   • pending() → status = 'pending'                                      │ │
│ │   • notExpired() → expires_at IS NULL OR expires_at > now()             │ │
│ │                                                                         │ │
│ │ Relationships:                                                          │ │
│ │   • invitee() → belongsTo(User::class, 'invitee_id')                    │ │
│ │   • inviter() → belongsTo(User::class, 'inviter_id')                    │ │
│ │   • room() → belongsTo(Room::class)                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitationStatus (Enum)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomInvitationStatus.php                           │ │
│ │ Values: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED                 │ │
│ │ Reusable: YES (used throughout invitation system)                       │ │
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
│ 1. SELECT (Room): Route model binding resolves room                         │
│    Query: SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL LIMIT 1   │
│    Source: Route Model Binding                                              │
│                                                                             │
│ 2. SELECT (Membership Check): Check user's membership and role              │
│    Query: SELECT * FROM room_members                                        │
│           WHERE user_id = ? AND room_id = ? AND status = 'active'           │
│           LIMIT 1                                                           │
│    Source: RoomMemberService::getMembershipForRoom()                        │
│                                                                             │
│ 3. SELECT (Invitations): Fetch pending invitations with invitees            │
│    Query: SELECT * FROM room_invitations                                    │
│           WHERE room_id = ? AND status = 'pending'                          │
│           AND (expires_at IS NULL OR expires_at > NOW())                    │
│           ORDER BY created_at DESC                                          │
│    Source: RoomInvitationService::getSentInvitations()                      │
│                                                                             │
│ 4. SELECT (Users): Eager load invitee relationships                         │
│    Query: SELECT * FROM users WHERE id IN (?, ?, ...)                       │
│    Source: with('invitee') eager loading                                    │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ None - This endpoint does not use caching.                                  │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ None - This is a read-only endpoint.                                        │
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
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'room' => $this->whenLoaded('room', fn () => [...]),                │ │
│ │     'inviter' => $this->whenLoaded('inviter', fn () => [...]),          │ │
│ │     'invitee' => $this->whenLoaded('invitee', fn () => [                │ │
│ │         'id' => $this->invitee->id,                                     │ │
│ │         'name' => $this->invitee->name,                                 │ │
│ │         'avatar' => $this->invitee->avatar,                             │ │
│ │     ]),                                                                 │ │
│ │     'status' => $this->status->value,                                   │ │
│ │     'message' => $this->message,                                        │ │
│ │     'expires_at' => $this->expires_at?->toIso8601String(),              │ │
│ │     'responded_at' => $this->responded_at?->toIso8601String(),          │ │
│ │     'created_at' => $this->created_at->toIso8601String(),               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: For 'sent' invitations, only 'invitee' is eager loaded.               │
│       'room' and 'inviter' will be null in the response.                    │
│                                                                             │
│ WRAPPER: ApiResponse::success()                                             │
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Success',                                             │ │
│ │     'data' => $data,  // RoomInvitationResource collection              │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $correlationId,                             │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                           | Used By Endpoints               | Reusable | Reasoning                                   |
| ------------------------------ | ------------------------------- | -------- | ------------------------------------------- |
| `RoomInvitationController.php` | All room invitation endpoints   | ⭕       | Controller methods are endpoint-specific    |
| `RoomInvitationService.php`    | All invitation operations       | ✅       | Service layer for invitation business logic |
| `RoomMemberService.php`        | All member operations           | ✅       | Service layer for membership checks         |
| `RoomInvitationResource.php`   | All invitation responses        | ✅       | Shared response transformer                 |
| `RoomInvitation.php`           | All invitation operations       | ✅       | Core invitation model with scopes           |
| `RoomMember.php`               | All room member operations      | ✅       | Core membership model with role checks      |
| `RoomMemberRole.php`           | All role-based permission logic | ✅       | Enum with permission methods                |
| `RoomInvitationStatus.php`     | All invitation status logic     | ✅       | Enum for invitation states                  |
| `ApiResponse.php`              | All API endpoints               | ✅       | Standardized API response wrapper           |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error          | Source                          | Condition                         |
| -------------- | ------------------------------- | --------------------------------- |
| "Unauthorized" | `RoomInvitationController@sent` | `$request->user()` returns `null` |

### Authorization Errors (403)

| Error                        | Source                          | Condition                       |
| ---------------------------- | ------------------------------- | ------------------------------- |
| "You do not have permission" | `RoomInvitationController@sent` | User is not owner/admin of room |

### Not Found Errors (404)

| Error       | Source              | Condition                                |
| ----------- | ------------------- | ---------------------------------------- |
| "Not Found" | Route Model Binding | Room ID doesn't exist or is soft-deleted |

### Edge Cases

| Case                            | Behavior                                            |
| ------------------------------- | --------------------------------------------------- |
| Room has no pending invitations | Returns empty array `[]`                            |
| All invitations expired         | Returns empty array (notExpired scope filters them) |
| User is member but not admin    | Returns 403 Forbidden                               |
| Room owner (not in members)     | May fail if owner not in room_members (edge case)   |
| Deleted room                    | Returns 404 (SoftDeletes filter)                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                       │                       │                       │
   │  GET /rooms/{id}/     │                       │                       │                       │
   │     invitations       │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │    (validate token)   │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. Route Model Binding │                       │
   │                       │                       │    (resolve {room})    │                       │
   │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │    Room model loaded   │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. getMembershipForRoom│                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 4. SELECT room_members │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │    membership/null    │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 5. canManageMembers() │                       │
   │                       │                       │    (check role)        │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. getSentInvitations  │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 7. SELECT invitations  │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 8. SELECT users        │
   │                       │                       │                       │    (eager load)        │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │    invitations        │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 9. Resource transform  │                       │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │   200 OK + JSON       │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                                                  |
| --------------------- | --------------------------------------------------------- |
| New filter parameters | `RoomInvitationController@sent` + `RoomInvitationService` |
| Pagination            | `RoomInvitationService::getSentInvitations()`             |
| Additional eager load | `getSentInvitations()` - add to `with()`                  |
| New response field    | `RoomInvitationResource`                                  |
| Caching invitations   | `RoomInvitationService::getSentInvitations()`             |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                    | What to Change                    |
| ----- | ------------------------------------------------------- | --------------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomInvitationResource.php` | Add field to `toArray()` return   |
| **2** | `app/Models/Room/RoomInvitation.php`                    | Add to `$fillable` if model field |

#### ➕ ADDING INVITER TO RESPONSE (Currently Not Loaded)

| Step  | File                                              | What to Change                     |
| ----- | ------------------------------------------------- | ---------------------------------- |
| **1** | `app/Services/Room/RoomInvitationService.php:191` | Add `'inviter'` to `with()` clause |

```php
// Before
->with('invitee')

// After
->with(['invitee', 'inviter'])
```

#### ➕ ADDING PAGINATION

| Step  | File                                                  | What to Change                     |
| ----- | ----------------------------------------------------- | ---------------------------------- |
| **1** | `app/Services/Room/RoomInvitationService.php:186-194` | Change `->get()` to `->paginate()` |
| **2** | `RoomInvitationController.php:114`                    | Use `ApiResponse::paginated()`     |

```php
// Service
public function getSentInvitations(int $roomId, int $perPage = 15)
{
    return RoomInvitation::where('room_id', $roomId)
        ->pending()
        ->notExpired()
        ->with('invitee')
        ->orderBy('created_at', 'desc')
        ->paginate($perPage);
}

// Controller
return ApiResponse::paginated(
    RoomInvitationResource::collection($invitations)
);
```

### 🔗 Field Flow Dependency Chain

```
Request Path Parameter
         │
         ▼
    ┌─────────┐
    │  {room} │ ──▶ Route Model Binding ──▶ Room Model
    └─────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────────┐
    │ RoomMemberService::getMembershipForRoom()           │
    │ - Queries room_members table                        │
    │ - Returns RoomMember or null                        │
    └─────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────────┐
    │ RoomMember::canManageMembers()                      │
    │ - Delegates to RoomMemberRole::canManageMembers()   │
    │ - Returns true for OWNER/ADMIN                      │
    └─────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────────┐
    │ RoomInvitationService::getSentInvitations()         │
    │ - Queries room_invitations with scopes              │
    │ - Eager loads invitee relationship                  │
    └─────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────────┐
    │ RoomInvitationResource::collection()                │
    │ - Transforms each invitation to JSON                │
    │ - Conditionally includes loaded relationships       │
    └─────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────────┐
    │ ApiResponse::success()                              │
    │ - Wraps data in standard response format            │
    │ - Adds meta (timestamp, correlation_id)             │
    └─────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding a query filter (e.g., status filter)

- [ ] Add query parameter to controller method
- [ ] Add filtering logic to service method
- [ ] Update scope if needed in model
- [ ] Add documentation

#### Adding search functionality

- [ ] Add `search` query parameter to controller
- [ ] Add search scope to `RoomInvitation` model
- [ ] Apply scope in service method
- [ ] Test with various search terms

### ⚠️ What Should NOT Be Modified Casually

| Component                            | Reason                                              |
| ------------------------------------ | --------------------------------------------------- |
| `RoomInvitation::pending()` scope    | Affects all invitation queries application-wide     |
| `RoomInvitation::notExpired()` scope | Critical for filtering expired invitations          |
| `canManageMembers()` permission      | Used by multiple endpoints for authorization        |
| `RoomMemberRole` enum values         | Database stores string values; changing breaks data |
| `ApiResponse` structure              | All clients expect this format                      |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                          |
| --------------------------------- | --------------------------------------------------- |
| N+1 query on invitee              | Always use `with('invitee')` in service             |
| Checking wrong permission method  | Use `canManageMembers()` not `canInvite()`          |
| Not filtering expired invitations | Always use `notExpired()` scope                     |
| Owner not in room_members table   | Consider checking `room.user_id` directly for owner |
| Forgetting soft delete on rooms   | Route model binding handles this automatically      |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:65                    ← Route definition

app/Http/Controllers/Api/V1/Room/
  └── RoomInvitationController.php                   ← Controller (sent method)

app/Services/Room/
  ├── RoomInvitationService.php                      ← Invitation service
  └── RoomMemberService.php                          ← Membership service

app/Models/Room/
  ├── Room.php                                       ← Room model
  ├── RoomInvitation.php                             ← Invitation model
  └── RoomMember.php                                 ← Membership model

app/Enums/Room/
  ├── RoomMemberRole.php                             ← Role enum with permissions
  └── RoomInvitationStatus.php                       ← Invitation status enum

app/Http/Resources/V1/Room/
  └── RoomInvitationResource.php                     ← Response transformer

app/Http/Utils/
  └── ApiResponse.php                                ← Standardized response wrapper
```

---

## Document Metadata

| Property            | Value                                  |
| ------------------- | -------------------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/{room}/invitations` |
| **Domain**          | Room                                   |
| **Author**          | System Documentation                   |
| **Created**         | 2026-02-01                             |
| **Laravel Version** | 12.x                                   |
| **PHP Version**     | 8.4                                    |
