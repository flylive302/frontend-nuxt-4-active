# GET /api/v1/user/room/join-requests/mine

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves all pending join requests submitted by the authenticated user across all rooms, ordered by most recent first.

### Responsibilities

- Authenticate the requesting user
- Fetch all pending join requests for the user
- Include room details for each request
- Return formatted response collection

### What It Owns

| Owned                | Description                                 |
| -------------------- | ------------------------------------------- |
| User's join requests | Reads `room_join_requests` for current user |

### External Dependencies

| Dependency | Type     | Purpose                          |
| ---------- | -------- | -------------------------------- |
| PostgreSQL | Database | Store and retrieve join requests |
| Sanctum    | Package  | Authentication via Bearer token  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/room/join-requests/mine
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

### Request Body Schema

```
No request body - this is a GET request
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
      "room_id": 456,
      "room": {
        "id": 456,
        "name": "Room Name"
      },
      "status": "pending",
      "message": "Hey, can I join?",
      "reviewed_at": null,
      "rejection_reason": null,
      "created_at": "2026-02-01T00:00:00+00:00"
    }
  ],
  "meta": {
    "timestamp": "2026-02-01T00:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Empty Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": [],
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
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                       |
| ----- | ------------------------------- |
| `200` | Successfully retrieved requests |
| `401` | No valid authentication token   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/room/join-requests/mine                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:47                                     │
│ Route: Route::get('/join-requests/mine', [RoomJoinRequestController::class, │
│                                           'mine'])                          │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticate user via Sanctum token                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:86-97  │
│                                                                             │
│ No FormRequest - uses standard Illuminate\Http\Request                      │
│ Authentication is verified via middleware                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:86-97  │
│ Method: mine(Request $request)                                              │
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
│ STEP 2: Fetch user's pending requests                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $requests = RoomJoinRequest::getUserPendingRequests($user->id);         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     RoomJoinRequestResource::collection($requests)                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 MODEL LAYER FLOW                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Room/RoomJoinRequest.php:102-109                           │
│ Method: getUserPendingRequests(int $userId)                                 │
│                                                                             │
│ Static method that fetches user's pending requests:                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public static function getUserPendingRequests(int $userId)              │ │
│ │ {                                                                       │ │
│ │     return static::where('user_id', $userId)                            │ │
│ │         ->where('status', RoomJoinRequestStatus::PENDING)               │ │
│ │         ->with('room')                                                  │ │
│ │         ->orderBy('created_at', 'desc')                                 │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│ │ Why It Exists: Data persistence and query encapsulation                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getUserPendingRequests(int $userId) → Collection                    │ │
│ │     Fetches all pending requests for a user with room eager-loaded      │ │
│ │   • scopePending(Builder $query) → Builder                              │ │
│ │     Filters by pending status                                           │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • room() → BelongsTo Room (eager loaded in this endpoint)             │ │
│ │   • user() → BelongsTo User                                             │ │
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
│ │     created_at                                                          │ │
│ │   • room (conditional) - included when relation is loaded               │ │
│ │   • user (conditional) - NOT loaded in this endpoint                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestStatus (Enum)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomJoinRequestStatus.php                          │ │
│ │ Responsibility: Define possible join request states                     │ │
│ │ Reusable: YES                                                           │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
│ │ Used: Filter only PENDING status in getUserPendingRequests()            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent API response structure                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(mixed $data, ...) → JsonResponse                            │ │
│ │   • unauthorized() → JsonResponse (401)                                 │ │
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
│ 1. SELECT: Fetch user's pending join requests with rooms                    │
│    Query: SELECT * FROM room_join_requests                                  │
│           WHERE user_id = ? AND status = 'pending'                          │
│           ORDER BY created_at DESC                                          │
│    Source: RoomJoinRequest::getUserPendingRequests()                        │
│                                                                             │
│ 2. SELECT: Eager load room relationships                                    │
│    Query: SELECT * FROM rooms WHERE id IN (?, ?, ...)                       │
│    Source: ->with('room') in getUserPendingRequests()                       │
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
│ File: app/Http/Resources/V1/Room/RoomJoinRequestResource.php                │
│                                                                             │
│ Each request is transformed via the resource:                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'room_id' => $this->room_id,                                        │ │
│ │     'room' => $this->when($this->relationLoaded('room'), [              │ │
│ │         'id' => $this->room->id,                                        │ │
│ │         'name' => $this->room->name,                                    │ │
│ │     ]),                                                                 │ │
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
│ │     'message' => 'Success',                                             │ │
│ │     'data' => $resourceCollection,                                      │ │
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

| File                            | Used By Endpoints           | Reusable | Reasoning                              |
| ------------------------------- | --------------------------- | -------- | -------------------------------------- |
| `RoomJoinRequestController.php` | All join request endpoints  | ⭕       | Contains multiple methods for requests |
| `RoomJoinRequest.php`           | All join request operations | ✅       | Model used everywhere                  |
| `RoomJoinRequestResource.php`   | All join request responses  | ✅       | Consistent response format             |
| `RoomJoinRequestStatus.php`     | All join request operations | ✅       | Status enum                            |
| `ApiResponse.php`               | All API endpoints           | ✅       | Unified response format                |
| `Room.php`                      | All room-related endpoints  | ✅       | Core room model                        |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                |
| ----- | ------ | ---------------------------------------- |
| N/A   | N/A    | No validation - GET request without body |

### Authorization Errors (401)

| Error           | Source                    | Condition             |
| --------------- | ------------------------- | --------------------- |
| Unauthenticated | `auth:sanctum` middleware | No valid Bearer token |

### Business Logic Errors (400)

| Error | Source | Condition                             |
| ----- | ------ | ------------------------------------- |
| N/A   | N/A    | Endpoint has no business logic errors |

### System Errors (500)

| Error                 | Source            | Condition                 |
| --------------------- | ----------------- | ------------------------- |
| Internal server error | Exception handler | Unexpected database error |

### Edge Cases

| Case                                          | Behavior                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| User has no pending requests                  | Returns empty array `[]`                                                 |
| User has approved/rejected/cancelled requests | Not returned (only pending status)                                       |
| Room was deleted                              | Request still returned (foreign key constraint may prevent)              |
| Multiple requests to same room                | All pending requests returned (shouldn't happen due to hasPending check) |
| Token expired mid-request                     | 401 Unauthorized returned                                                |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER                MODEL                   DATABASE
   │                     │                       │                       │                         │
   │  GET /user/room/join-requests/mine          │                       │                         │
   │─────────────────────▶│                      │                       │                         │
   │                     │                       │                       │                         │
   │                     │ 1. auth:sanctum       │                       │                         │
   │                     │   (verify token)      │                       │                         │
   │                     │                       │                       │                         │
   │                     │──────────────────────▶│                       │                         │
   │                     │                       │                       │                         │
   │                     │                       │ 2. $request->user()   │                         │
   │                     │                       │   (get authenticated user)                      │
   │                     │                       │                       │                         │
   │                     │                       │ 3. getUserPendingRequests()                     │
   │                     │                       │──────────────────────▶│                         │
   │                     │                       │                       │                         │
   │                     │                       │                       │ 4. SELECT requests      │
   │                     │                       │                       │─────────────────────────▶│
   │                     │                       │                       │◀─────────────────────────│
   │                     │                       │                       │                         │
   │                     │                       │                       │ 5. SELECT rooms (eager) │
   │                     │                       │                       │─────────────────────────▶│
   │                     │                       │                       │◀─────────────────────────│
   │                     │                       │                       │                         │
   │                     │                       │◀──────────────────────│                         │
   │                     │                       │                       │                         │
   │                     │                       │ 6. Transform via Resource::collection()         │
   │                     │                       │                       │                         │
   │                     │                       │ 7. ApiResponse::success()                       │
   │                     │                       │                       │                         │
   │                     │◀──────────────────────│                       │                         │
   │◀────────────────────│                       │                       │                         │
   │                     │                       │                       │                         │
   │  200 OK + JSON      │                       │                       │                         │
   │                     │                       │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location(s)                                     |
| ------------------------- | ----------------------------------------------- |
| Filter by status          | Add query parameter handling in `mine()` method |
| Pagination                | Change `get()` to `paginate()` in model method  |
| Include more room details | Modify eager load in `getUserPendingRequests()` |
| Add caching               | Wrap model query with Cache::remember()         |
| Rate limiting             | Add middleware in route definition              |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                     | What to Change                                 |
| ----- | -------------------------------------------------------- | ---------------------------------------------- |
| **1** | `app/Models/Room/RoomJoinRequest.php`                    | Ensure field exists on model (or add accessor) |
| **2** | `app/Http/Resources/V1/Room/RoomJoinRequestResource.php` | Add field to `toArray()` return                |

#### ➕ ADDING ROOM DETAILS TO RESPONSE

| Step  | File                                                     | What to Change                                                    |
| ----- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **1** | `app/Models/Room/RoomJoinRequest.php:106`                | Modify `->with('room')` to `->with('room:id,name,field1,field2')` |
| **2** | `app/Http/Resources/V1/Room/RoomJoinRequestResource.php` | Add new fields to `room` conditional block                        |

#### ➕ ADDING PAGINATION

| Step  | File                                                                | What to Change                                        |
| ----- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| **1** | `app/Models/Room/RoomJoinRequest.php:107`                           | Change `->get()` to `->paginate(15)`                  |
| **2** | `app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:96` | Use `ApiResponse::paginated()` instead of `success()` |

### 🔗 Field Flow Dependency Chain

```
Database (room_join_requests table)
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequest Model                 │
│ $fillable, $casts                     │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ getUserPendingRequests()              │
│ ->with('room') eager loads relation   │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ RoomJoinRequestResource               │
│ Transforms model to JSON              │
│ Conditionally includes 'room'         │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ ApiResponse::success()                │
│ Wraps in standard response envelope   │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ API Response                          │
│ { "status": "success", "data": [...] }│
└───────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                              | Reason                                              |
| -------------------------------------- | --------------------------------------------------- |
| `RoomJoinRequestStatus::PENDING` value | Database stores this; changing breaks existing data |
| `getUserPendingRequests()` query logic | Core method used by this endpoint                   |
| `->with('room')` eager loading         | Removing causes N+1 queries                         |
| `auth:sanctum` middleware              | Required for authentication                         |
| `RoomJoinRequestResource` structure    | Breaking change for API consumers                   |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                           |
| ------------------------------------ | ---------------------------------------------------- |
| Removing `->with('room')`            | Causes N+1 queries and missing room data in response |
| Returning non-pending requests       | Users expect only actionable (pending) requests      |
| Changing order to ASC                | Users expect newest first                            |
| Not checking null user               | Middleware handles it, but controller double-checks  |
| Adding complex filters without index | Add database index for filtered columns              |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:47                       ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomJoinRequestController.php:86-97               ← Controller mine method
app/Models/Room/
  └── RoomJoinRequest.php:102-109                       ← getUserPendingRequests()
app/Http/Resources/V1/Room/
  └── RoomJoinRequestResource.php                       ← Response transformer
app/Enums/Room/
  └── RoomJoinRequestStatus.php                         ← Status enum
app/Http/Utils/
  └── ApiResponse.php                                   ← Response utility
```

---

## Document Metadata

| Property            | Value                                      |
| ------------------- | ------------------------------------------ |
| **Endpoint**        | `GET /api/v1/user/room/join-requests/mine` |
| **Domain**          | User                                       |
| **Author**          | System Documentation                       |
| **Created**         | 2026-02-01                                 |
| **Laravel Version** | 12.x                                       |
| **PHP Version**     | 8.4                                        |
