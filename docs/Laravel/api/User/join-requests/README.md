# GET /api/v1/user/room/join-requests

> **Domain**: User / Room Management  
> **Type**: Protected Endpoint (Admin)  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves all pending join requests for the room owned by the authenticated user. This is an administrative endpoint for room owners to manage incoming membership requests.

### Responsibilities

- Authenticate the requesting user
- Verify user owns a room
- Fetch all pending join requests for that room
- Return formatted join request data with user details

### What It Owns

| Owned                 | Description                                      |
| --------------------- | ------------------------------------------------ |
| Join request listing  | Retrieves pending join requests for owner's room |
| User relation loading | Eager loads user data for each request           |

### External Dependencies

| Dependency | Type     | Purpose                            |
| ---------- | -------- | ---------------------------------- |
| PostgreSQL | Database | Stores join requests and room data |
| Sanctum    | Package  | Token-based authentication         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/room/join-requests
```

### Authentication

✅ **Required** - User must be authenticated via Sanctum token and own a room

### Rate Limiting

| Limiter | Key          | Config             |
| ------- | ------------ | ------------------ |
| `api`   | IP + User ID | 60 requests/minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

_No request body required - this is a GET request_

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "id": "integer", // Join request ID
      "room_id": "integer", // Room ID
      "user": {
        // Requesting user (when loaded)
        "id": "integer",
        "name": "string",
        "signature": "string",
        "avatar": "string|null"
      },
      "status": "string", // Always "pending" for this endpoint
      "message": "string|null", // Optional message from requester
      "reviewed_at": "string|null", // ISO 8601 timestamp (null for pending)
      "rejection_reason": "string|null", // Null for pending requests
      "created_at": "string" // ISO 8601 timestamp
    }
  ],
  "meta": {
    "timestamp": "2026-02-01T01:41:39.000000Z",
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
  "errors": []
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not have permission",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                            |
| ----- | ------------------------------------ |
| `200` | Join requests retrieved successfully |
| `401` | User not authenticated               |
| `403` | User does not own a room             |
| `500` | Internal server error                |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/room/join-requests                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:50                                     │
│ Route: Route::get('/join-requests', [RoomJoinRequestController, 'forRoom']) │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Verifies Bearer token, sets authenticated user         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 NO FORM REQUEST                                                         │
│─────────────────────────────────────────────────────────────────────────────│
│ This endpoint uses the base Illuminate\Http\Request class.                  │
│ No custom validation is required - it's a simple GET with no parameters.    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:104    │
│ Method: forRoom(Request $request)                                           │
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
│ STEP 2: Check if user owns a room                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $ownedRoom = Room::where('user_id', $user->id)->first();                │ │
│ │                                                                         │ │
│ │ if (! $ownedRoom) {                                                     │ │
│ │     return ApiResponse::forbidden('You do not have permission');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get pending join requests and return response                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $requests = RoomJoinRequest::getPendingForRoom($ownedRoom->id);         │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     RoomJoinRequestResource::collection($requests)                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint does NOT use a service layer.                                 │
│ Business logic is handled directly in controller using model static method. │
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
│ │ Reusable: YES (used by all join request endpoints)                      │ │
│ │ Why It Exists: Encapsulates join request data and query logic           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getPendingForRoom($roomId) → Returns pending requests with users    │ │
│ │   • user() → BelongsTo relationship to User model                       │ │
│ │   • room() → BelongsTo relationship to Room model                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Room (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Eloquent model for rooms table                          │ │
│ │ Reusable: YES (used across all room endpoints)                          │ │
│ │ Why It Exists: Encapsulates room data, used here to verify ownership    │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • user_id → Owner of the room                                         │ │
│ │   • id → Used to fetch join requests                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestResource (API Resource)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomJoinRequestResource.php            │ │
│ │ Responsibility: Transform RoomJoinRequest model to API response         │ │
│ │ Reusable: YES (used by all join request endpoints)                      │ │
│ │ Why It Exists: Consistent JSON structure and data formatting            │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • Conditionally includes room when loaded                             │ │
│ │   • Conditionally includes user when loaded                             │ │
│ │   • Formats dates as ISO 8601                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestStatus (Enum)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomJoinRequestStatus.php                          │ │
│ │ Responsibility: Enum for join request status values                     │ │
│ │ Reusable: YES (used across all join request logic)                      │ │
│ │ Why It Exists: Type-safe status values                                  │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure across API                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 response with data                   │ │
│ │   • unauthorized($message) → 401 response                               │ │
│ │   • forbidden($message) → 403 response                                  │ │
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
│ 1. SELECT: Find room owned by user                                          │
│    Query: SELECT * FROM rooms WHERE user_id = ? LIMIT 1                     │
│    Source: Controller (Room::where('user_id', $user->id)->first())          │
│                                                                             │
│ 2. SELECT: Get pending join requests with eager-loaded users                │
│    Query: SELECT * FROM room_join_requests                                  │
│           WHERE room_id = ? AND status = 'pending'                          │
│           ORDER BY created_at ASC                                           │
│    Source: RoomJoinRequest::getPendingForRoom($roomId)                      │
│                                                                             │
│ 3. SELECT: Eager load users for join requests                               │
│    Query: SELECT * FROM users WHERE id IN (?, ?, ...)                       │
│    Source: ->with('user') in getPendingForRoom()                            │
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
│ File: app/Http/Resources/V1/Room/RoomJoinRequestResource.php                │
│                                                                             │
│ The resource transforms each RoomJoinRequest model:                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'room_id' => $this->room_id,                                        │ │
│ │     'room' => $this->when($this->relationLoaded('room'), [...]),        │ │
│ │     'user' => $this->when($this->relationLoaded('user'), [              │ │
│ │         'id' => $this->user->id,                                        │ │
│ │         'name' => $this->user->name,                                    │ │
│ │         'signature' => $this->user->signature ?? $this->user->username, │ │
│ │         'avatar' => $this->user->avatar,                                │ │
│ │     ]),                                                                 │ │
│ │     'status' => $this->status->value,                                   │ │
│ │     'message' => $this->message,                                        │ │
│ │     'reviewed_at' => $this->reviewed_at?->toIso8601String(),            │ │
│ │     'rejection_reason' => $this->rejection_reason,                      │ │
│ │     'created_at' => $this->created_at->toIso8601String(),               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: For this endpoint, 'user' is eager-loaded, so user data is included.  │
│       'room' is NOT loaded, so it's omitted from response.                  │
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

| File                            | Used By Endpoints                                          | Reusable | Reasoning                                    |
| ------------------------------- | ---------------------------------------------------------- | -------- | -------------------------------------------- |
| `RoomJoinRequestController.php` | join-requests (admin), join-requests/mine, approve, reject | ✅       | Controller for all join request operations   |
| `RoomJoinRequest.php`           | All join request endpoints                                 | ✅       | Core model for join request operations       |
| `RoomJoinRequestResource.php`   | All join request endpoints                                 | ✅       | Standard resource for join request responses |
| `Room.php`                      | All room endpoints                                         | ✅       | Core room model                              |
| `RoomJoinRequestStatus.php`     | All join request logic                                     | ✅       | Enum for type-safe status handling           |
| `ApiResponse.php`               | All API endpoints                                          | ✅       | Standardized response utility                |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error          | Source                | Condition              |
| -------------- | --------------------- | ---------------------- |
| "Unauthorized" | `Controller::forRoom` | User not authenticated |

### Authorization Errors (403)

| Error                        | Source                | Condition                  |
| ---------------------------- | --------------------- | -------------------------- |
| "You do not have permission" | `Controller::forRoom` | User does not own any room |

### System Errors (500)

| Error                   | Source    | Condition                |
| ----------------------- | --------- | ------------------------ |
| "Internal server error" | Framework | Database connection fail |

### Edge Cases

| Case                              | Behavior                                    |
| --------------------------------- | ------------------------------------------- |
| User owns room with no requests   | Returns empty array `[]`                    |
| User owns multiple rooms          | Returns requests for FIRST room found       |
| User is room member but not owner | Returns 403 Forbidden                       |
| All requests already processed    | Returns empty array (only pending returned) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            MODEL LAYER              DATABASE
   │                       │                       │                       │                       │
   │  GET /user/room/      │                       │                       │                       │
   │  join-requests        │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │    validate token     │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. Get user           │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. Find owned room    │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. SELECT rooms       │
   │                       │                       │                       │    WHERE user_id = ?  │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │ 5. getPendingForRoom  │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 6. SELECT join_reqs   │
   │                       │                       │                       │    WHERE room_id = ?  │
   │                       │                       │                       │    AND status = pend  │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 7. SELECT users       │
   │                       │                       │                       │    WHERE id IN (...)  │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 8. Format via         │                       │
   │                       │                       │    Resource           │                       │
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

| Addition           | Location                                       |
| ------------------ | ---------------------------------------------- |
| New response field | `RoomJoinRequestResource.php`                  |
| Filter by date     | Controller + add query parameter handling      |
| Pagination         | Change `get()` to `paginate()` in model method |
| Include room data  | Add `->with('room')` to model query            |
| Rate limiting      | Route middleware in `room-membership.php`      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                     | What to Change                   |
| ----- | -------------------------------------------------------- | -------------------------------- |
| **1** | **Database Migration**                                   | Add column to room_join_requests |
| **2** | `app/Models/Room/RoomJoinRequest.php`                    | Add to `$fillable` array         |
| **3** | `app/Http/Resources/V1/Room/RoomJoinRequestResource.php` | Add field to `toArray()` return  |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                     | What to Change                 |
| ----- | -------------------------------------------------------- | ------------------------------ |
| **1** | `app/Http/Resources/V1/Room/RoomJoinRequestResource.php` | Remove from `toArray()` return |
| **2** | **Database Migration**                                   | Drop column (if safe)          |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
│   Database      │────▶│  Model          │────▶│  Resource                   │
│   room_join_    │     │  RoomJoin-      │     │  RoomJoinRequest-           │
│   requests      │     │  Request.php    │     │  Resource.php               │
└─────────────────┘     └─────────────────┘     └─────────────────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Controller     │
                        │  forRoom()      │
                        └─────────────────┘
```

### 📋 Field Modification Checklists

**Adding a new filter parameter:**

1. [ ] Add query parameter handling in `forRoom()` method
2. [ ] Add scope or modify static method in `RoomJoinRequest.php`
3. [ ] Update API documentation

**Adding pagination:**

1. [ ] Change `get()` to `paginate($perPage)` in `getPendingForRoom()`
2. [ ] Use `ApiResponse::paginated()` instead of `ApiResponse::success()`
3. [ ] Update response schema documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                              |
| ----------------------------------- | --------------------------------------------------- |
| `RoomJoinRequestStatus` enum values | Used across multiple endpoints and stored in DB     |
| `getPendingForRoom()` status filter | Other endpoints depend on correct pending filtering |
| `ApiResponse` structure             | All API consumers expect consistent format          |
| User relation loading               | Frontend expects user data in responses             |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                         |
| --------------------------------- | -------------------------------------------------- |
| Forgetting to eager load user     | Always use `->with('user')` for this endpoint      |
| Showing non-pending requests      | Ensure `PENDING` status filter is maintained       |
| Multiple room ownership edge case | Currently returns first room found - document this |
| Missing authorization check       | Always verify room ownership before returning data |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                           ← Route definition (line 50)
app/Http/Controllers/Api/V1/Room/
  └── RoomJoinRequestController.php                      ← Controller (forRoom method)
app/Models/Room/
  ├── Room.php                                           ← Room model (ownership check)
  └── RoomJoinRequest.php                                ← Join request model
app/Http/Resources/V1/Room/
  └── RoomJoinRequestResource.php                        ← Response transformer
app/Enums/Room/
  └── RoomJoinRequestStatus.php                          ← Status enum
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
database/migrations/
  └── 2025_12_29_100003_create_room_join_requests_table.php  ← Table schema
```

---

## Document Metadata

| Property            | Value                                 |
| ------------------- | ------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/room/join-requests` |
| **Domain**          | User / Room Management                |
| **Author**          | System Documentation                  |
| **Created**         | 2026-02-01                            |
| **Laravel Version** | 12.x                                  |
| **PHP Version**     | 8.4                                   |
