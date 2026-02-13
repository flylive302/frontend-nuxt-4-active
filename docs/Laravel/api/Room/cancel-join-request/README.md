# DELETE /api/v1/rooms/{room}/join-request

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Allows authenticated users to cancel their own pending join request for a specific room.

### Responsibilities

- Find user's pending join request for the specified room
- Update request status to CANCELLED
- Return confirmation response

### What It Owns

| Owned             | Description                                             |
| ----------------- | ------------------------------------------------------- |
| Room Join Request | Updates `room_join_requests` record status to cancelled |

### External Dependencies

| Dependency | Type     | Purpose                         |
| ---------- | -------- | ------------------------------- |
| PostgreSQL | Database | Store/update join request state |
| Sanctum    | Package  | Authentication via Bearer token |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/rooms/{room}/join-request
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
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description                   |
| --------- | --------- | ----------------------------- |
| `room`    | `integer` | Room ID (route model binding) |

### Request Body Schema

No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Request cancelled",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No pending request",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
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
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Join request cancelled              |
| `401` | Unauthenticated                     |
| `404` | No pending request / Room not found |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                DELETE /api/v1/rooms/{room}/join-request                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:31                                     │
│ Route: Route::delete('/join-request', [RoomJoinRequestController::class,    │
│                                        'cancel'])                           │
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
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:59-79  │
│ Method: cancel(Request $request, Room $room)                                │
│                                                                             │
│ Note: This endpoint uses Illuminate\Http\Request directly (no FormRequest) │
│       as there is no request body to validate.                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:59-79  │
│ Method: cancel(Request $request, Room $room)                                │
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
│ STEP 2: Query for pending join request                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest = RoomJoinRequest::where('room_id', $room->id)             │ │
│ │     ->where('user_id', $user->id)                                       │ │
│ │     ->pending()                                                         │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check if request exists                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $joinRequest) {                                                   │ │
│ │     return ApiResponse::notFound('No pending request');                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Cancel the request                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest->cancel();                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Request cancelled');                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Note: This endpoint does NOT use a service layer. All logic is in          │
│ the controller and model, keeping the flow simple and direct.              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomJoinRequest (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomJoinRequest.php                               │ │
│ │ Responsibility: Eloquent model for room_join_requests table             │ │
│ │ Reusable: YES (used across all join request operations)                 │ │
│ │ Why It Exists: Data persistence and business rules                      │ │
│ │                                                                         │ │
│ │ Key Methods (used by this endpoint):                                    │ │
│ │   • scopePending(Builder $query) → Builder                              │ │
│ │     Filters to status = 'pending'                                       │ │
│ │   • cancel() → void                                                     │ │
│ │     Sets status to CANCELLED and saves                                  │ │
│ │                                                                         │ │
│ │ cancel() Implementation:                                                │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ public function cancel(): void                                      │ │ │
│ │ │ {                                                                   │ │ │
│ │ │     $this->status = RoomJoinRequestStatus::CANCELLED;               │ │ │
│ │ │     $this->save();                                                  │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
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
│                                                                             │
│ COMPONENT: Room (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Room model used for route model binding                 │ │
│ │ Reusable: YES (core model for all room operations)                      │ │
│ │ Why It Exists: Represents room entity                                   │ │
│ │                                                                         │ │
│ │ Used in this endpoint:                                                  │ │
│ │   • Route model binding resolves {room} to Room instance                │ │
│ │   • $room->id used to query join requests                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Consistent API response formatting                      │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Unified response structure                               │ │
│ │                                                                         │ │
│ │ Key Methods (used by this endpoint):                                    │ │
│ │   • success(mixed $data, string $message, ...) → JsonResponse           │ │
│ │   • notFound(string $message, ...) → JsonResponse                       │ │
│ │   • unauthorized(string $message, ...) → JsonResponse                   │ │
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
│    Query: SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL LIMIT 1   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT: Find pending join request for user/room                          │
│    Query: SELECT * FROM room_join_requests                                  │
│           WHERE room_id = ?                                                 │
│           AND user_id = ?                                                   │
│           AND status = 'pending'                                            │
│           LIMIT 1                                                           │
│    Source: RoomJoinRequest::where(...)->pending()->first()                  │
│                                                                             │
│ 3. UPDATE: Set status to cancelled                                          │
│    Query: UPDATE room_join_requests                                         │
│           SET status = 'cancelled', updated_at = NOW()                      │
│           WHERE id = ?                                                      │
│    Source: RoomJoinRequest::cancel()                                        │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
│ EXTERNAL SERVICE CALLS: None                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php (success method)                       │
│                                                                             │
│ Note: This endpoint returns null data, only a success message.              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Request cancelled',                                   │ │
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
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                            | Used By Endpoints           | Reusable | Reasoning                     |
| ------------------------------- | --------------------------- | -------- | ----------------------------- |
| `RoomJoinRequestController.php` | All join request endpoints  | ⭕       | Methods are endpoint-specific |
| `RoomJoinRequest.php`           | All join request operations | ✅       | Model used everywhere         |
| `RoomJoinRequestStatus.php`     | All join request operations | ✅       | Status enum                   |
| `Room.php`                      | All room endpoints          | ✅       | Core room model               |
| `ApiResponse.php`               | All API endpoints           | ✅       | Unified response format       |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (401)

| Error           | Source                    | Condition                  |
| --------------- | ------------------------- | -------------------------- |
| Unauthenticated | `auth:sanctum` middleware | No valid Bearer token      |
| Unauthenticated | Controller null check     | `$request->user()` is null |

### Not Found Errors (404)

| Error              | Source              | Condition                             |
| ------------------ | ------------------- | ------------------------------------- |
| Room not found     | Route Model Binding | Room ID does not exist                |
| No pending request | Controller          | No pending join request for user/room |

### System Errors (500)

| Error                 | Source            | Condition                   |
| --------------------- | ----------------- | --------------------------- |
| Internal server error | Exception handler | Database connection failure |

### Edge Cases

| Case                                | Behavior                                  |
| ----------------------------------- | ----------------------------------------- |
| Request already approved            | 404 - pending scope excludes approved     |
| Request already rejected            | 404 - pending scope excludes rejected     |
| Request already cancelled           | 404 - pending scope excludes cancelled    |
| User has no request for room        | 404 - no matching record found            |
| User has request for different room | 404 - room_id filter excludes other rooms |
| Room soft-deleted                   | 404 - route model binding fails           |
| Multiple approved/rejected requests | Only pending can be cancelled             |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER              MODEL                   DATABASE
   │                     │                       │                     │                         │
   │  DELETE /rooms/{room}/join-request          │                     │                         │
   │─────────────────────▶│                      │                     │                         │
   │                     │                       │                     │                         │
   │                     │ 1. auth:sanctum       │                     │                         │
   │                     │   (verify token)      │                     │                         │
   │                     │                       │                     │                         │
   │                     │ 2. Bind {room} model  │                     │                         │
   │                     │──────────────────────────────────────────────────────────────────────▶│
   │                     │                       │                     │  SELECT rooms           │
   │                     │◀──────────────────────────────────────────────────────────────────────│
   │                     │                       │                     │                         │
   │                     │ 3. To controller      │                     │                         │
   │                     │──────────────────────▶│                     │                         │
   │                     │                       │                     │                         │
   │                     │                       │ 4. Get user         │                         │
   │                     │                       │ $request->user()    │                         │
   │                     │                       │                     │                         │
   │                     │                       │ 5. Query pending    │                         │
   │                     │                       │ request             │                         │
   │                     │                       │────────────────────▶│                         │
   │                     │                       │                     │ 6. SELECT               │
   │                     │                       │                     │ room_join_requests      │
   │                     │                       │                     │────────────────────────▶│
   │                     │                       │                     │◀────────────────────────│
   │                     │                       │◀────────────────────│                         │
   │                     │                       │                     │                         │
   │                     │                       │ 7. cancel()         │                         │
   │                     │                       │────────────────────▶│                         │
   │                     │                       │                     │ 8. UPDATE status        │
   │                     │                       │                     │────────────────────────▶│
   │                     │                       │                     │◀────────────────────────│
   │                     │                       │◀────────────────────│                         │
   │                     │                       │                     │                         │
   │                     │                       │ 9. ApiResponse::    │                         │
   │                     │                       │    success()        │                         │
   │                     │◀──────────────────────│                     │                         │
   │◀────────────────────│                       │                     │                         │
   │                     │                       │                     │                         │
   │  200 OK + JSON      │                       │                     │                         │
   │                     │                       │                     │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location(s)                                            |
| ------------------------- | ------------------------------------------------------ |
| Pre-cancellation checks   | `RoomJoinRequestController::cancel()` before cancel()  |
| Real-time event on cancel | After `$joinRequest->cancel()` in controller           |
| Audit logging             | After `$joinRequest->cancel()` in controller           |
| Rate limiting             | Route middleware in `routes/api/room-membership.php`   |
| Return cancelled request  | Replace `null` with `new RoomJoinRequestResource(...)` |

### 📝 Field Modification Guide

This endpoint does not accept a request body, so field modification primarily applies to the model.

#### ➕ ADDING A NEW FIELD TO CANCEL BEHAVIOR

| Step  | File                                  | What to Change                        |
| ----- | ------------------------------------- | ------------------------------------- |
| **1** | **Database Migration**                | Add column to table                   |
| **2** | `app/Models/Room/RoomJoinRequest.php` | Add to `$fillable`, modify `cancel()` |

#### ➖ MODIFYING CANCEL BEHAVIOR

| Step  | File                                  | What to Change           |
| ----- | ------------------------------------- | ------------------------ |
| **1** | `app/Models/Room/RoomJoinRequest.php` | Modify `cancel()` method |

### 🔗 Field Flow Dependency Chain

```
Path Parameter: {room}
        │
        ▼
┌───────────────────────────────────────┐
│ Route Model Binding                   │
│ Resolves to Room instance             │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Controller: cancel()                  │
│ Uses $room->id to query requests      │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequest Query                 │
│ WHERE room_id = ? AND user_id = ?     │
│ AND status = 'pending'                │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequest::cancel()             │
│ Sets status to CANCELLED              │
│ Calls save()                          │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ Database                              │
│ UPDATE room_join_requests             │
│ SET status = 'cancelled'              │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ ApiResponse::success()                │
│ { "data": null, "message": "..." }    │
└───────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                           |
| ----------------------------------- | ------------------------------------------------ |
| `scopePending()` filter             | Ensures only pending requests can be cancelled   |
| `RoomJoinRequestStatus::CANCELLED`  | Database stores this value; changing breaks data |
| Route model binding for `{room}`    | Automatic 404 handling for invalid room IDs      |
| User ID check (`$user->id`)         | Ensures users can only cancel their own requests |
| `cancel()` method status assignment | Core cancellation logic                          |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                       |
| --------------------------------------- | ------------------------------------------------ |
| Allowing cancel of non-pending requests | `pending()` scope already prevents this          |
| Skipping user ownership check           | Query includes `user_id` = authenticated user    |
| Returning request data after cancel     | Currently returns null; add resource if needed   |
| Not checking for null user              | Controller has explicit null check before query  |
| Removing `pending()` scope              | Would allow cancelling already-resolved requests |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:31                        ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomJoinRequestController.php:59-79                ← Controller cancel method
app/Models/Room/
  ├── Room.php                                           ← Room model (route binding)
  └── RoomJoinRequest.php:57-60, 137-141                 ← Model with scope & cancel
app/Enums/Room/
  └── RoomJoinRequestStatus.php                          ← Status enum
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
```

---

## Document Metadata

| Property            | Value                                      |
| ------------------- | ------------------------------------------ |
| **Endpoint**        | `DELETE /api/v1/rooms/{room}/join-request` |
| **Domain**          | Room                                       |
| **Author**          | System Documentation                       |
| **Created**         | 2026-02-01                                 |
| **Laravel Version** | 12.x                                       |
| **PHP Version**     | 8.4                                        |
