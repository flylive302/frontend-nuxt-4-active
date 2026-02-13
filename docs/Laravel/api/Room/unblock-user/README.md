# DELETE /api/v1/rooms/{room}/blocks/{userId}

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

The Unblock User endpoint allows room owners and admins to remove a user from the room's block list, enabling them to rejoin or interact with the room again.

### Responsibilities

- Validate that the requesting user has permission to unblock users in the room
- Remove the block record from the database
- Invalidate the block cache for the user

### What It Owns

| Owned              | Description                                    |
| ------------------ | ---------------------------------------------- |
| Block Removal      | Deletes `room_user_blocks` record for the user |
| Cache Invalidation | Clears Redis cache for the user's block status |

### External Dependencies

| Dependency | Type           | Purpose                                    |
| ---------- | -------------- | ------------------------------------------ |
| MySQL      | Database       | Stores block records in `room_user_blocks` |
| Redis      | Infrastructure | Caches block status for performance        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/rooms/{room}/blocks/{userId}
```

### Authentication

✅ **Required** - User must be authenticated via Sanctum token

### Rate Limiting

| Limiter  | Key       | Config                |
| -------- | --------- | --------------------- |
| Standard | `user:id` | `config('auth.rate')` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description                   | Example |
| --------- | --------- | ----------------------------- | ------- |
| `room`    | `integer` | Room ID (route model binding) | `1`     |
| `userId`  | `integer` | User ID to unblock            | `42`    |

### Request Body Schema

No request body required for this endpoint.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User unblocked",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T04:16:27.000000Z",
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
    "timestamp": "2026-02-01T04:16:27.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not have permission to unblock users",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T04:16:27.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "User is not blocked from this room",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T04:16:27.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | User successfully unblocked                   |
| `401` | User not authenticated                        |
| `403` | User lacks permission to unblock in this room |
| `404` | Room not found OR user is not blocked         |
| `500` | Internal server error                         |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│          DELETE /api/v1/rooms/{room}/blocks/{userId}                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:72                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::delete('/blocks/{userId}', [RoomBlockController::class,          │ │
│ │     'destroy'])->whereNumber('userId');                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Authenticates user via Sanctum token                    │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Room model instance (auto-resolved by Laravel)                 │
│   • {userId} → Integer parameter (whereNumber constraint)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No Form Request - Uses standard Illuminate\Http\Request                     │
│                                                                             │
│ Validation is handled inline in controller and service layer.               │
│ Path parameters {room} and {userId} are validated by route constraints.     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomBlockController.php              │
│ Method: destroy(Request $request, Room $room, int $userId)                  │
│                                                                             │
│ STEP 1: Check if user is authenticated                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service for business logic                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->blockService->unblockUser($room->id, $userId, $user->id);        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'User unblocked');                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomBlockService.php                                │
│ Method: unblockUser(int $roomId, int $userId, int $unblockedById)           │
│                                                                             │
│ STEP 1: Fetch room from database                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::findOrFail($roomId);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if unblocker can manage room                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $this->canManageRoom($unblockedById, $room)) {                    │ │
│ │     throw new InsufficientPermissionException('unblock users');         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Delete block record via model                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $deleted = RoomUserBlock::unblockUser($roomId, $userId);                │ │
│ │                                                                         │ │
│ │ if (! $deleted) {                                                       │ │
│ │     throw new UserNotBlockedException;                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Invalidate block cache                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cache::forget("room:{$roomId}:blocked:{$userId}");                      │ │
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
│ │ Responsibility: Centralized authorization for room operations           │ │
│ │ Reusable: YES (used by multiple room services)                          │ │
│ │ Why It Exists: Eliminates duplicate owner/admin check pattern           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageRoom($userId, $room) → Check if user is owner or admin     │ │
│ │   • getMembershipForAuthorization() → Get cached membership             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: InsufficientPermissionException (Exception)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/InsufficientPermissionException.php           │ │
│ │ Responsibility: Domain exception for permission failures                │ │
│ │ Reusable: YES (used across room domain)                                 │ │
│ │ HTTP Code: 403                                                          │ │
│ │ Error Code: INSUFFICIENT_PERMISSION                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserNotBlockedException (Exception)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Exceptions/Room/UserNotBlockedException.php                   │ │
│ │ Responsibility: Domain exception when user is not blocked               │ │
│ │ Reusable: YES (unblock operations)                                      │ │
│ │ HTTP Code: 404                                                          │ │
│ │ Error Code: USER_NOT_BLOCKED                                            │ │
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
│ 1. SELECT (Room): Fetch room by ID                                          │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Room::findOrFail($roomId)                                        │
│                                                                             │
│ 2. SELECT (RoomMember): Check user's membership for authorization           │
│    Query: SELECT * FROM room_members                                        │
│           WHERE room_id = ? AND user_id = ? AND status = 'active' LIMIT 1   │
│    Source: RoomAuthorizationHelper::getMembershipForAuthorization()         │
│                                                                             │
│ 3. DELETE (RoomUserBlock): Remove block record                              │
│    Query: DELETE FROM room_user_blocks                                      │
│           WHERE room_id = ? AND blocked_user_id = ?                         │
│    Source: RoomUserBlock::unblockUser($roomId, $userId)                     │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. FORGET: Invalidate block status cache                                    │
│    Key: room:{roomId}:blocked:{userId}                                      │
│    Source: RoomBlockService::unblockUser()                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Response built via ApiResponse::success():                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'User unblocked',                                      │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
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

| File                                  | Used By Endpoints                        | Reusable | Reasoning                                         |
| ------------------------------------- | ---------------------------------------- | -------- | ------------------------------------------------- |
| `RoomBlockController.php`             | Block, Unblock, List Blocks              | ⭕       | Methods reusable, controller specific to blocking |
| `RoomBlockService.php`                | Block, Unblock, List Blocks, Join checks | ✅       | Core blocking logic used across room operations   |
| `RoomAuthorizationHelper.php`         | All room management endpoints            | ✅       | Shared authorization trait                        |
| `RoomUserBlock.php`                   | All blocking operations                  | ✅       | Model with reusable static methods                |
| `InsufficientPermissionException.php` | All room management endpoints            | ✅       | Generic permission exception                      |
| `UserNotBlockedException.php`         | Unblock endpoint only                    | ❌       | Specific to unblock operations                    |
| `ApiResponse.php`                     | All API endpoints                        | ✅       | Standardized response helper                      |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

This endpoint has no request body validation. Path parameters are validated by route constraints.

### Business Logic Errors (400/403/404)

| Error                                         | Source                            | Condition                           |
| --------------------------------------------- | --------------------------------- | ----------------------------------- |
| "You do not have permission to unblock users" | `InsufficientPermissionException` | User is not owner/admin of the room |
| "User is not blocked from this room"          | `UserNotBlockedException`         | No block record exists for the user |

### System Errors (500)

| Error            | Source | Condition                   |
| ---------------- | ------ | --------------------------- |
| Database failure | MySQL  | Connection or query failure |
| Cache failure    | Redis  | Redis connection issues     |

### Edge Cases

| Case                              | Behavior                                      |
| --------------------------------- | --------------------------------------------- |
| Room doesn't exist                | 404 from route model binding                  |
| User ID is not numeric            | Route constraint rejects request              |
| User is not blocked               | 404 with "User is not blocked from this room" |
| Admin tries to unblock            | Allowed if they have manage permissions       |
| Owner tries to unblock            | Always allowed                                |
| Block has expired (temporary ban) | Still unblocks (removes the record entirely)  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/CACHE
   │                       │                       │                       │                            │
   │  DELETE /rooms/{room}/blocks/{userId}         │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │   (validate token)    │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 2. Check user != null │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 3. Call unblockUser() │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 4. SELECT room             │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. canManageRoom()         │
   │                       │                       │                       │   SELECT room_members      │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 6. DELETE room_user_blocks │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. Cache::forget()         │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
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

| Addition                 | Location                                                |
| ------------------------ | ------------------------------------------------------- |
| Add unblock reason field | Add parameter to service method, update controller      |
| Emit real-time event     | Add event dispatch in `RoomBlockService::unblockUser()` |
| Add audit logging        | Add after successful unblock in service                 |
| Add unblock notification | Dispatch notification job after cache invalidation      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW PARAMETER (e.g., unblock reason)

| Step  | File                                                       | What to Change                            |
| ----- | ---------------------------------------------------------- | ----------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Room/RoomBlockController.php` | Accept new parameter from request         |
| **2** | `app/Services/Room/RoomBlockService.php`                   | Add parameter to `unblockUser()` method   |
| **3** | (Optional) Create Form Request                             | If validation is needed for new parameter |

#### ➕ ADDING AUDIT LOGGING

| Step  | File                                     | What to Change                         |
| ----- | ---------------------------------------- | -------------------------------------- |
| **1** | `app/Services/Room/RoomBlockService.php` | Add audit log after successful unblock |
| **2** | Create audit log migration if needed     | Add `room_audit_logs` table            |

### 🔗 Field Flow Dependency Chain

```
Request Path Parameter (userId)
           │
           ▼
┌─────────────────────────┐
│    Controller Layer     │
│  (extract from route)   │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│    Service Layer        │
│  (business logic)       │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│    Model Layer          │
│  (database operation)   │
└─────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│    Cache Layer          │
│  (invalidation)         │
└─────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                                   |
| ------------------------------ | -------------------------------------------------------- |
| `RoomAuthorizationHelper`      | Shared across all room management endpoints              |
| `RoomUserBlock::unblockUser()` | Core model method, changes affect all unblock operations |
| Cache key pattern              | Must match pattern used in `isBlocked()` check           |
| Exception classes              | Used by global exception handler for HTTP response codes |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                             |
| -------------------------------------- | ------------------------------------------------------ |
| Forgetting cache invalidation          | Always call `Cache::forget()` after unblocking         |
| Not checking if user is blocked first  | Service checks via `unblockUser()` return value        |
| Bypassing permission check             | Always use `canManageRoom()` before unblocking         |
| Incorrect cache key format             | Follow exact pattern: `room:{roomId}:blocked:{userId}` |
| Not handling `UserNotBlockedException` | Exception is auto-handled by global exception handler  |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                     ← Route definition (line 72)
app/Http/Controllers/Api/V1/Room/
  └── RoomBlockController.php                      ← Controller (destroy method)
app/Services/Room/
  ├── RoomBlockService.php                         ← Business logic (unblockUser)
  └── Helpers/
      └── RoomAuthorizationHelper.php              ← Authorization trait
app/Models/Room/
  └── RoomUserBlock.php                            ← Model with unblockUser()
app/Exceptions/Room/
  ├── InsufficientPermissionException.php          ← 403 exception
  └── UserNotBlockedException.php                  ← 404 exception
app/Http/Utils/
  └── ApiResponse.php                              ← Response helper
```

---

## Document Metadata

| Property            | Value                                         |
| ------------------- | --------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/rooms/{room}/blocks/{userId}` |
| **Domain**          | Room                                          |
| **Author**          | System Documentation                          |
| **Created**         | 2026-02-01                                    |
| **Laravel Version** | 12.x                                          |
| **PHP Version**     | 8.4                                           |
