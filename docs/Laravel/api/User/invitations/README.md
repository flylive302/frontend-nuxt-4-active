# GET /api/v1/user/room/invitations

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves all pending room invitations for the authenticated user, allowing users to see which rooms have invited them to join.

### Responsibilities

- Authenticate user via Sanctum token
- Retrieve all pending, non-expired invitations for the user
- Load related room and inviter data
- Return formatted invitation collection

### What It Owns

| Owned                | Description                                        |
| -------------------- | -------------------------------------------------- |
| Invitation retrieval | Fetches pending invitations for authenticated user |
| Data transformation  | Converts invitations to API response format        |

### External Dependencies

| Dependency | Type           | Purpose                   |
| ---------- | -------------- | ------------------------- |
| PostgreSQL | Database       | Stores invitation records |
| Sanctum    | Authentication | Validates Bearer token    |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/room/invitations
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter   | Key       | Config                     |
| --------- | --------- | -------------------------- |
| (default) | IP + User | `config('api.rate_limit')` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
None - GET request with no body
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
      "id": "integer", // Invitation ID
      "room": {
        // Room data (when loaded)
        "id": "integer", // Room ID
        "name": "string", // Room name
        "logo": "string|null" // Room logo URL
      },
      "inviter": {
        // Inviter user data (when loaded)
        "id": "integer", // Inviter user ID
        "name": "string", // Inviter name
        "avatar": "string|null" // Inviter avatar URL
      },
      "status": "string", // Always "pending" for this endpoint
      "message": "string|null", // Optional invitation message
      "expires_at": "string|null", // ISO8601 expiration timestamp
      "responded_at": "string|null", // ISO8601 response timestamp (null for pending)
      "created_at": "string" // ISO8601 creation timestamp
    }
  ],
  "meta": {
    "timestamp": "2026-02-01T02:30:00.000000Z",
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
    "timestamp": "2026-02-01T02:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully retrieved invitations      |
| `401` | User not authenticated or token invalid |
| `500` | Server error during retrieval           |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/room/invitations                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:42                                     │
│ Route: Route::get('/invitations', [RoomInvitationController::class, 'index'])
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, sets $request->user()           │
│                                                                             │
│ Route Group: /user/room (lines 38-53)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::prefix('user/room')->group(function () {                     │ │
│ │         Route::get('/invitations', [RoomInvitationController::class,    │ │
│ │                                      'index']);                         │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php:35-46   │
│ Method: index(Request $request): JsonResponse                               │
│                                                                             │
│ No FormRequest - Uses standard Illuminate\Http\Request                      │
│ No request body or query parameters expected                                │
│                                                                             │
│ STEP 1: Retrieve authenticated user                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php:43-45   │
│                                                                             │
│ STEP 2: Retrieve pending invitations                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitations = RoomInvitation::getPendingForUser($user->id);            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     RoomInvitationResource::collection($invitations)                    │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 MODEL LAYER - DATA RETRIEVAL                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Room/RoomInvitation.php:101-109                            │
│ Method: getPendingForUser(int $userId): Collection                          │
│                                                                             │
│ Static method that builds and executes the query:                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public static function getPendingForUser(int $userId): Collection       │ │
│ │ {                                                                       │ │
│ │     return static::where('invitee_id', $userId)                         │ │
│ │         ->where('status', RoomInvitationStatus::PENDING)                │ │
│ │         ->notExpired()                                                  │ │
│ │         ->with(['room', 'inviter'])                                     │ │
│ │         ->orderBy('created_at', 'desc')                                 │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Uses notExpired() scope (lines 73-79):                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function scopeNotExpired(Builder $query): Builder                │ │
│ │ {                                                                       │ │
│ │     return $query->where(function ($q) {                                │ │
│ │         $q->whereNull('expires_at')                                     │ │
│ │             ->orWhere('expires_at', '>', now());                        │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomInvitation (Eloquent Model)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomInvitation.php                                │ │
│ │ Responsibility: Represents room invitations with relationships          │ │
│ │ Reusable: YES (used across all invitation endpoints)                    │ │
│ │ Why It Exists: Encapsulates invitation data and logic                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getPendingForUser() → Retrieves pending invitations for user        │ │
│ │   • scopeNotExpired() → Filters out expired invitations                 │ │
│ │   • scopePending() → Filters for pending status                         │ │
│ │                                                                         │ │
│ │ Relationships:                                                          │ │
│ │   • room() → BelongsTo Room                                             │ │
│ │   • inviter() → BelongsTo User (who sent invitation)                    │ │
│ │   • invitee() → BelongsTo User (who received invitation)                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitationStatus (Enum)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomInvitationStatus.php                           │ │
│ │ Responsibility: Defines invitation status values                        │ │
│ │ Reusable: YES (used across all invitation endpoints)                    │ │
│ │ Why It Exists: Type-safe status handling                                │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PENDING = 'pending'                                                 │ │
│ │   • ACCEPTED = 'accepted'                                               │ │
│ │   • DECLINED = 'declined'                                               │ │
│ │   • EXPIRED = 'expired'                                                 │ │
│ │   • CANCELLED = 'cancelled'                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitationResource (API Resource)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomInvitationResource.php             │ │
│ │ Responsibility: Transforms invitation model to JSON response            │ │
│ │ Reusable: YES (used for all invitation responses)                       │ │
│ │ Why It Exists: Consistent invitation data formatting                    │ │
│ │                                                                         │ │
│ │ Fields returned:                                                        │ │
│ │   • id, room (conditional), inviter (conditional)                       │ │
│ │   • status, message, expires_at, responded_at, created_at               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Ensures consistent response structure                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Returns success response with data                      │ │
│ │   • unauthorized() → Returns 401 error response                         │ │
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
│ 1. SELECT: Retrieve pending invitations for user                            │
│    Query:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM room_invitations                                      │  │
│    │ WHERE invitee_id = ?                                                │  │
│    │   AND status = 'pending'                                            │  │
│    │   AND (expires_at IS NULL OR expires_at > NOW())                    │  │
│    │ ORDER BY created_at DESC;                                           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: RoomInvitation::getPendingForUser()                              │
│                                                                             │
│ 2. EAGER LOAD: Room relationship                                            │
│    Query:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM rooms WHERE id IN (?, ?, ...);                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: ->with(['room'])                                                 │
│                                                                             │
│ 3. EAGER LOAD: Inviter (User) relationship                                  │
│    Query:                                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM users WHERE id IN (?, ?, ...);                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: ->with(['inviter'])                                              │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None                                                                      │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None                                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Room/RoomInvitationResource.php:15-35           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function toArray(Request $request): array                        │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'id' => $this->id,                                              │ │
│ │         'room' => $this->whenLoaded('room', fn () => [                  │ │
│ │             'id' => $this->room->id,                                    │ │
│ │             'name' => $this->room->name,                                │ │
│ │             'logo' => $this->room->logo ?? null,                        │ │
│ │         ]),                                                             │ │
│ │         'inviter' => $this->whenLoaded('inviter', fn () => [            │ │
│ │             'id' => $this->inviter->id,                                 │ │
│ │             'name' => $this->inviter->name,                             │ │
│ │             'avatar' => $this->inviter->avatar,                         │ │
│ │         ]),                                                             │ │
│ │         'status' => $this->status->value,                               │ │
│ │         'message' => $this->message,                                    │ │
│ │         'expires_at' => $this->expires_at?->toIso8601String(),          │ │
│ │         'responded_at' => $this->responded_at?->toIso8601String(),      │ │
│ │         'created_at' => $this->created_at->toIso8601String(),           │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ApiResponse::success() wraps the resource collection:                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Success',                                             │ │
│ │     'data' => [...invitations...],                                      │ │
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
│                          200 + JSON Body                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints          | Reusable | Reasoning                                |
| ------------------------------ | -------------------------- | -------- | ---------------------------------------- |
| `RoomInvitationController.php` | All invitation endpoints   | ⭕       | Controller methods are endpoint-specific |
| `RoomInvitation.php`           | All invitation endpoints   | ✅       | Model with reusable scopes and methods   |
| `RoomInvitationResource.php`   | All invitation endpoints   | ✅       | Consistent invitation JSON formatting    |
| `RoomInvitationStatus.php`     | All invitation endpoints   | ✅       | Enum for type-safe status values         |
| `ApiResponse.php`              | All API endpoints          | ✅       | Standardized response utility            |
| `Room.php`                     | All room-related endpoints | ✅       | Core room model                          |
| `User.php`                     | All user-related endpoints | ✅       | Core user model                          |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error          | Source                        | Condition                        |
| -------------- | ----------------------------- | -------------------------------- |
| "Unauthorized" | `RoomInvitationController:40` | User is null (not authenticated) |
| "Unauthorized" | `auth:sanctum` middleware     | Invalid or missing Bearer token  |

### System Errors (500)

| Error                   | Source              | Condition                       |
| ----------------------- | ------------------- | ------------------------------- |
| "Internal server error" | Database connection | PostgreSQL connection failure   |
| "Internal server error" | Query execution     | Database query throws exception |

### Edge Cases

| Case                              | Behavior                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| User has no pending invitations   | Returns empty array `[]` with 200 status                    |
| Invitation expired but not marked | `notExpired()` scope filters it out                         |
| Room was deleted                  | CASCADE delete removes invitation, won't appear             |
| Inviter was deleted               | CASCADE delete removes invitation, won't appear             |
| Multiple invitations same room    | Partial unique index prevents duplicate pending invitations |
| All invitations responded to      | Returns empty array `[]` with 200 status                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            MODEL                   DATABASE
   │                       │                       │                   │                         │
   │  GET /user/room/invitations                   │                   │                         │
   │──────────────────────▶│                       │                   │                         │
   │                       │                       │                   │                         │
   │                       │ 1. auth:sanctum       │                   │                         │
   │                       │   validate token      │                   │                         │
   │                       │───────────────────────│                   │                         │
   │                       │                       │                   │                         │
   │                       │ 2. Pass to controller │                   │                         │
   │                       │──────────────────────▶│                   │                         │
   │                       │                       │                   │                         │
   │                       │                       │ 3. Get user       │                         │
   │                       │                       │   from request    │                         │
   │                       │                       │                   │                         │
   │                       │                       │ 4. getPendingForUser()                      │
   │                       │                       │──────────────────▶│                         │
   │                       │                       │                   │                         │
   │                       │                       │                   │ 5. SELECT invitations   │
   │                       │                       │                   │    WHERE invitee_id = ? │
   │                       │                       │                   │    AND status = pending │
   │                       │                       │                   │    AND not expired      │
   │                       │                       │                   │────────────────────────▶│
   │                       │                       │                   │◀────────────────────────│
   │                       │                       │                   │                         │
   │                       │                       │                   │ 6. EAGER LOAD rooms     │
   │                       │                       │                   │────────────────────────▶│
   │                       │                       │                   │◀────────────────────────│
   │                       │                       │                   │                         │
   │                       │                       │                   │ 7. EAGER LOAD inviters  │
   │                       │                       │                   │────────────────────────▶│
   │                       │                       │                   │◀────────────────────────│
   │                       │                       │                   │                         │
   │                       │                       │◀──────────────────│                         │
   │                       │                       │  Collection       │                         │
   │                       │                       │                   │                         │
   │                       │                       │ 8. Transform via  │                         │
   │                       │                       │    Resource       │                         │
   │                       │                       │                   │                         │
   │                       │◀──────────────────────│                   │                         │
   │◀──────────────────────│                       │                   │                         │
   │                       │                       │                   │                         │
   │  200 + JSON           │                       │                   │                         │
   │  {status,message,data,meta}                   │                   │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                           |
| ------------------------- | -------------------------------------------------- |
| New response field        | `RoomInvitationResource.php`                       |
| Filter by date/status     | `RoomInvitationController::index()` + query params |
| Pagination support        | `RoomInvitationController::index()` + `paginate()` |
| Additional eager loading  | `RoomInvitation::getPendingForUser()` `->with()`   |
| Cache pending invitations | `RoomInvitationController::index()` with Redis     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                    | What to Change                   |
| ----- | ------------------------------------------------------- | -------------------------------- |
| **1** | **Database Migration**                                  | Add column to `room_invitations` |
| **2** | `app/Models/Room/RoomInvitation.php`                    | Add to `$fillable` array         |
| **3** | `app/Models/Room/RoomInvitation.php`                    | Add to `$casts` if needed        |
| **4** | `app/Http/Resources/V1/Room/RoomInvitationResource.php` | Add field to `toArray()` return  |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                    | What to Change                      |
| ----- | ------------------------------------------------------- | ----------------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomInvitationResource.php` | Remove from `toArray()` return      |
| **2** | `app/Models/Room/RoomInvitation.php`                    | Remove from `$fillable` (if needed) |
| **3** | **Database Migration**                                  | Drop column (if no longer needed)   |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DATABASE (room_invitations table)                                           │
│   • id, room_id, inviter_id, invitee_id, status, message                    │
│   • expires_at, responded_at, created_at, updated_at                        │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MODEL: RoomInvitation                                                       │
│   $fillable: room_id, inviter_id, invitee_id, status, message,              │
│              expires_at, responded_at                                       │
│   $casts: status → RoomInvitationStatus, expires_at → datetime,             │
│           responded_at → datetime                                           │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RESOURCE: RoomInvitationResource                                            │
│   Returns: id, room{}, inviter{}, status, message, expires_at,              │
│            responded_at, created_at                                         │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API RESPONSE                                                                │
│   JSON: { status, message, data: [...invitations], meta: {...} }            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

**Adding Pagination:**

- [ ] Modify `getPendingForUser()` to return paginator instead of collection
- [ ] Update controller to use `ApiResponse::paginated()` instead of `success()`
- [ ] Update API documentation to include pagination meta

**Adding Filters:**

- [ ] Add query parameters to controller method
- [ ] Create scopes in model if reusable
- [ ] Update documentation with filter parameters

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| `RoomInvitation::getPendingForUser` | Core query logic, affects all consumers                  |
| `scopeNotExpired()`                 | Security filter - prevents expired invitations appearing |
| `RoomInvitationStatus` enum values  | Breaking change for existing data                        |
| `ApiResponse` structure             | Breaking change for all API consumers                    |
| `room_invitations` table indexes    | Performance impact on all invitation queries             |

### 🚨 Common Pitfalls

| Pitfall                                        | Prevention                                 |
| ---------------------------------------------- | ------------------------------------------ |
| Forgetting to filter expired invitations       | Always use `notExpired()` scope            |
| N+1 query on room/inviter                      | Always use `->with(['room', 'inviter'])`   |
| Not handling null user                         | Check `$request->user()` before using      |
| Modifying enum without migration               | Enum values must match database values     |
| Returning all statuses instead of pending only | Use `getPendingForUser()` not custom query |
| Breaking response format                       | Test API consumers after resource changes  |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                       ← Route definition (line 42)
app/Http/Controllers/Api/V1/Room/
  └── RoomInvitationController.php                   ← Controller (index method)
app/Models/Room/
  └── RoomInvitation.php                             ← Model with getPendingForUser()
app/Enums/Room/
  └── RoomInvitationStatus.php                       ← Status enum
app/Http/Resources/V1/Room/
  └── RoomInvitationResource.php                     ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
database/migrations/
  └── 2025_12_29_100002_create_room_invitations_table.php ← Table schema
```

---

## Document Metadata

| Property            | Value                               |
| ------------------- | ----------------------------------- |
| **Endpoint**        | `GET /api/v1/user/room/invitations` |
| **Domain**          | User                                |
| **Author**          | System Documentation                |
| **Created**         | 2026-02-01                          |
| **Laravel Version** | 12.x                                |
| **PHP Version**     | 8.4                                 |
