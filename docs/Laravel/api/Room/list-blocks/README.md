# GET /api/v1/rooms/{room}/blocks

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves the list of blocked users for a specific room. This endpoint allows room owners and admins to view all currently blocked users, including their block details such as reason, duration, and who blocked them.

### Responsibilities

- Authenticate and authorize the requesting user
- Verify the user has permission to view blocked users (owner or admin)
- Query all blocked user records for the room
- Transform blocked user data through resource serialization

### What It Owns

| Owned                 | Description                                               |
| --------------------- | --------------------------------------------------------- |
| Blocked users listing | Reads from `room_user_blocks` table for the specific room |

### External Dependencies

| Dependency | Type           | Purpose                                |
| ---------- | -------------- | -------------------------------------- |
| MySQL      | Database       | Stores room_user_blocks and users data |
| Sanctum    | Authentication | Bearer token authentication            |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/{room}/blocks
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key       | Config                     |
| ------- | --------- | -------------------------- |
| API     | `user:id` | `config('api.rate_limit')` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints      | Example |
| --------- | --------- | ---------------- | ------- |
| `room`    | `integer` | Required, exists | `123`   |

### Request Body Schema

No request body required for this endpoint.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "id": "integer", // Block record ID
      "user": {
        // Blocked user details
        "id": "integer",
        "name": "string",
        "avatar": "string|null",
        "signature": "string"
      },
      "reason": "string|null", // Block reason (if provided)
      "banned_until": "string|null", // ISO8601 datetime for temp bans
      "is_permanent": "boolean", // true if permanent block
      "blocked_at": "string" // ISO8601 datetime when blocked
    }
  ],
  "meta": {
    "timestamp": "2026-02-01T04:06:47.000000Z",
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
    "timestamp": "2026-02-01T04:06:47.000000Z",
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
    "timestamp": "2026-02-01T04:06:47.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Room\\Room]",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T04:06:47.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Successfully retrieved blocked users list |
| `401` | User is not authenticated                 |
| `403` | User lacks permission (not owner/admin)   |
| `404` | Room not found                            |
| `500` | Unexpected server error                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms/{room}/blocks                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:70                                     │
│ Route: Route::get('/blocks', [RoomBlockController::class, 'index']);        │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Bearer token                    │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} parameter → Automatically resolves to Room model                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomBlockController.php:34           │
│                                                                             │
│ No Form Request - Uses standard Illuminate\Http\Request                     │
│ Route model binding resolves Room from {room} parameter                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function index(Request $request, Room $room): JsonResponse       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomBlockController.php:34-54        │
│ Method: index(Request $request, Room $room)                                 │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check authorization (owner or admin with manage permissions)        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $isOwner = $room->user_id === $user->id;                                │ │
│ │ $membership = $this->memberService->getMembershipForRoom(               │ │
│ │     $user->id, $room->id                                                │ │
│ │ );                                                                      │ │
│ │ $canManage = $membership && $membership->canManageMembers();            │ │
│ │                                                                         │ │
│ │ if (! $isOwner && ! $canManage) {                                       │ │
│ │     return ApiResponse::forbidden('You do not have permission');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get blocked users via service                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $blocks = $this->blockService->getBlockedUsers($room->id);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(RoomUserBlockResource::collection($blocks));│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: RoomMemberService (Permission Check)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomMemberService.php:49-55                     │ │
│ │ Method: getMembershipForRoom($userId, $roomId)                          │ │
│ │                                                                         │ │
│ │ return RoomMember::where('user_id', $userId)                            │ │
│ │     ->where('room_id', $roomId)                                         │ │
│ │     ->where('status', RoomMemberStatus::ACTIVE)                         │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│ SERVICE: RoomBlockService                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomBlockService.php:145-151                    │ │
│ │ Method: getBlockedUsers($roomId)                                        │ │
│ │                                                                         │ │
│ │ return RoomUserBlock::where('room_id', $roomId)                         │ │
│ │     ->with('blockedUser')  // Eager load user relationship              │ │
│ │     ->orderBy('created_at', 'desc')                                     │ │
│ │     ->get();                                                            │ │
│ │                                                                         │ │
│ │ Returns: Collection<int, RoomUserBlock>                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomUserBlock (Model)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomUserBlock.php                                 │ │
│ │ Responsibility: Eloquent model for room_user_blocks table               │ │
│ │ Reusable: YES (used by RoomBlockService and other services)             │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • $with = ['blockedUser'] → Auto-eager loads user relationship        │ │
│ │   • Relationships: room(), blockedUser(), blockedBy()                   │ │
│ │   • Scopes: forRoom()                                                   │ │
│ │   • Casts: 'banned_until' => 'datetime'                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Eloquent model for room_members table                   │ │
│ │ Reusable: YES (used across room-related operations)                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageMembers() → Checks if member has management permissions    │ │
│ │   • isOwner() / isAdmin() → Role checking                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Standard success response with data                     │ │
│ │   • unauthorized() → 401 response                                       │ │
│ │   • forbidden() → 403 response                                          │ │
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
│ 1. SELECT: Get authenticated user's room membership                         │
│    Query: SELECT * FROM room_members                                        │
│           WHERE user_id = ? AND room_id = ? AND status = 'active'           │
│           LIMIT 1                                                           │
│    Source: RoomMemberService::getMembershipForRoom()                        │
│                                                                             │
│ 2. SELECT: Get all blocked users for room with user details                 │
│    Query: SELECT * FROM room_user_blocks                                    │
│           WHERE room_id = ? ORDER BY created_at DESC                        │
│    Eager Load: SELECT * FROM users WHERE id IN (...)                        │
│    Source: RoomBlockService::getBlockedUsers()                              │
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
│ RESOURCE: RoomUserBlockResource                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomUserBlockResource.php:22-37        │ │
│ │                                                                         │ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'user' => $this->whenLoaded('blockedUser', fn () => [               │ │
│ │         'id' => $this->blockedUser->id,                                 │ │
│ │         'name' => $this->blockedUser->name,                             │ │
│ │         'avatar' => $this->blockedUser->avatar,                         │ │
│ │         'signature' => $this->blockedUser->signature,                   │ │
│ │     ]),                                                                 │ │
│ │     'reason' => $this->reason,                                          │ │
│ │     'banned_until' => $this->banned_until?->toIso8601String(),          │ │
│ │     'is_permanent' => $this->banned_until === null,                     │ │
│ │     'blocked_at' => $this->created_at->toIso8601String(),               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Final response wrapped by ApiResponse::success()                            │
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

| File                        | Used By Endpoints                | Reusable | Reasoning                                   |
| --------------------------- | -------------------------------- | -------- | ------------------------------------------- |
| `RoomBlockController.php`   | blocks endpoints only            | ⭕       | Methods reused, but class is block-specific |
| `RoomBlockService.php`      | blocks endpoints                 | ✅       | Contains all block-related business logic   |
| `RoomMemberService.php`     | All room member endpoints        | ✅       | Shared across membership operations         |
| `RoomUserBlock.php`         | All block operations             | ✅       | Model used for all block data access        |
| `RoomUserBlockResource.php` | Block listing and block creation | ✅       | Consistent block serialization              |
| `ApiResponse.php`           | All API endpoints                | ✅       | Standardized response formatting            |
| `RoomMember.php`            | All room membership endpoints    | ✅       | Model for all room member operations        |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (401)

| Error          | Source                | Condition                                    |
| -------------- | --------------------- | -------------------------------------------- |
| "Unauthorized" | `RoomBlockController` | User is not authenticated (`$user === null`) |

### Forbidden Errors (403)

| Error                        | Source                | Condition                                                 |
| ---------------------------- | --------------------- | --------------------------------------------------------- |
| "You do not have permission" | `RoomBlockController` | User is not room owner and doesn't have admin permissions |

### Not Found Errors (404)

| Error                               | Source              | Condition                        |
| ----------------------------------- | ------------------- | -------------------------------- |
| "No query results for model [Room]" | Route Model Binding | Room with given ID doesn't exist |

### System Errors (500)

| Error                   | Source         | Condition                   |
| ----------------------- | -------------- | --------------------------- |
| "Internal server error" | Database/Model | Database connection failure |
| "Internal server error" | PHP            | Unexpected exception        |

### Edge Cases

| Case                        | Behavior                                  |
| --------------------------- | ----------------------------------------- |
| Room has no blocked users   | Returns empty array `[]`                  |
| User is owner               | Always granted access                     |
| User is admin without perms | Access denied (403)                       |
| Deleted room                | 404 from route model binding              |
| Expired temp bans remain    | Still returned; app decides display logic |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                       │                       │                       │
   │  GET /rooms/{room}/   │                       │                       │                       │
   │       blocks          │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │   (verify token)      │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │ 2. Resolve {room}     │                       │                       │
   │                       │   via Route Model     │                       │                       │
   │                       │   Binding             │                       │                       │
   │                       │      ─────────────────────────────────────────────────────────────────▶│
   │                       │      │◀────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                       │
   │                       │ 3. Call index()       │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 4. getMembershipForRoom│                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 5. SELECT membership  │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. Check permission   │                       │
   │                       │                       │   (isOwner OR canManage)                      │
   │                       │                       │                       │                       │
   │                       │                       │ 7. getBlockedUsers()  │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 8. SELECT blocks      │
   │                       │                       │                       │   + eager load users  │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 9. Transform via      │                       │
   │                       │                       │   RoomUserBlockResource│                      │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  200 OK + JSON        │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                                      |
| --------------------- | --------------------------------------------- |
| New block fields      | `RoomUserBlock` model, migration, resource    |
| New filter parameters | Controller `index()`, service method params   |
| Pagination support    | Controller + service + change to `paginate()` |
| Search blocked users  | Add query parameter in controller             |
| Include block count   | Add to response `meta` in controller          |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO BLOCKED USER RESPONSE

| Step  | File                                                   | What to Change                   |
| ----- | ------------------------------------------------------ | -------------------------------- |
| **1** | **Database Migration**                                 | Add column to `room_user_blocks` |
| **2** | `app/Models/Room/RoomUserBlock.php`                    | Add to `$fillable` array         |
| **3** | `app/Http/Resources/V1/Room/RoomUserBlockResource.php` | Add field to `toArray()` method  |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                   | What to Change                       |
| ----- | ------------------------------------------------------ | ------------------------------------ |
| **1** | `app/Http/Resources/V1/Room/RoomUserBlockResource.php` | Remove field from `toArray()` method |
| **2** | **Database Migration** (optional)                      | Drop column if no longer needed      |

#### ➕ ADDING PAGINATION

| Step  | File                                                       | What to Change                         |
| ----- | ---------------------------------------------------------- | -------------------------------------- |
| **1** | `app/Services/Room/RoomBlockService.php`                   | Change `get()` to `paginate($perPage)` |
| **2** | `app/Http/Controllers/Api/V1/Room/RoomBlockController.php` | Use `ApiResponse::paginated()` instead |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FIELD FLOW CHAIN                                  │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│   Database Column (room_user_blocks)                                        │
│         │                                                                   │
│         ▼                                                                   │
│   RoomUserBlock Model ($fillable, $casts, relationships)                    │
│         │                                                                   │
│         ▼                                                                   │
│   RoomBlockService (getBlockedUsers query, with() calls)                    │
│         │                                                                   │
│         ▼                                                                   │
│   RoomUserBlockResource (toArray transformation)                            │
│         │                                                                   │
│         ▼                                                                   │
│   JSON Response                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                | Reason                                            |
| ------------------------ | ------------------------------------------------- |
| `ApiResponse` format     | Breaking change for all API consumers             |
| Route path/method        | Breaking change for API clients                   |
| `$with` in RoomUserBlock | Affects N+1 prevention across all block queries   |
| Authorization logic      | Security-critical; could expose blocked user data |
| Resource field names     | Breaking change for frontend consumers            |

### 🚨 Common Pitfalls

| Pitfall                         | Prevention                                               |
| ------------------------------- | -------------------------------------------------------- |
| Forgetting to check permissions | Always verify isOwner or canManage before returning data |
| N+1 queries on blockedUser      | Model has `$with = ['blockedUser']` - don't remove it    |
| Not handling null user          | Controller explicitly checks `$user === null`            |
| Exposing sensitive user data    | Resource limits fields to id, name, avatar, signature    |
| Missing eager load              | Service explicitly calls `->with('blockedUser')`         |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                        ← Route definition (line 70)
app/Http/Controllers/Api/V1/Room/
  └── RoomBlockController.php                         ← Controller (index method)
app/Services/Room/
  └── RoomBlockService.php                            ← Block business logic
  └── RoomMemberService.php                           ← Membership permission check
app/Models/Room/
  └── RoomUserBlock.php                               ← Block model
  └── RoomMember.php                                  ← Member model (for permissions)
app/Http/Resources/V1/Room/
  └── RoomUserBlockResource.php                       ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                 ← Standard response utility
```

---

## Document Metadata

| Property            | Value                             |
| ------------------- | --------------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/{room}/blocks` |
| **Domain**          | Room                              |
| **Author**          | System Documentation              |
| **Created**         | 2026-02-01                        |
| **Laravel Version** | 12.x                              |
| **PHP Version**     | 8.4                               |
