# GET /api/v1/user/room

> **Domain**: User / Room Membership  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

Retrieves all active room memberships for the currently authenticated user, supporting multi-room participation where users can be members of multiple rooms simultaneously.

### Responsibilities

- Authenticate the requesting user via Sanctum token
- Fetch all active room memberships for the authenticated user
- Eager load related user and room data to prevent N+1 queries
- Return formatted membership data with user and room details

### What It Owns

| Owned                     | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| User Membership Retrieval | Fetches the authenticated user's active room memberships |

### External Dependencies

| Dependency | Type     | Purpose                     |
| ---------- | -------- | --------------------------- |
| PostgreSQL | Database | Stores room_members records |
| Sanctum    | Package  | Token-based authentication  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/room
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter     | Key     | Config             |
| ----------- | ------- | ------------------ |
| Default API | User ID | 60 requests/minute |

### Request Headers

| Header          | Required | Type               | Description         |
| --------------- | -------- | ------------------ | ------------------- |
| `Content-Type`  | ❌       | `application/json` | Request body format |
| `Accept`        | ✅       | `application/json` | Response format     |
| `Authorization` | ✅       | `Bearer {token}`   | Sanctum auth token  |

### Request Body Schema

**None** - This is a GET request with no body.

---

### Response Schemas

#### ✅ Success Response (200) - Has Memberships

```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "id": 123, // integer, membership ID
      "user": {
        // MinimalUserResource (12 fields)
        "id": 456,
        "name": "John Doe",
        "signature": "johndoe123",
        "avatar": "https://cdn.example.com/avatars/user.jpg",
        "frame": null, // string|null
        "gender": "male",
        "email": "john@example.com",
        "phone": "+1234567890",
        "country": "US",
        "date_of_birth": "1990-05-15",
        "wealth_xp": "15000",
        "charm_xp": "8500"
      },
      "role": "member", // "owner" | "admin" | "member"
      "role_label": "Member", // Human-readable role
      "status": "active", // Always "active" for returned records
      "joined_at": "2026-01-15T10:30:00+00:00" // ISO8601 timestamp|null
    }
  ],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ✅ Success Response (200) - No Memberships

```json
{
  "status": "success",
  "message": "Not a member of any room",
  "data": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-string"
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
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

### HTTP Status Codes

| Code  | Condition                              |
| ----- | -------------------------------------- |
| `200` | Memberships retrieved (or empty array) |
| `401` | Missing or invalid authentication      |
| `500` | Database or server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/room                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:39                                     │
│ Route: Route::get('/', [RoomMemberController::class, 'myMembership'])       │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads authenticated user       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('user/room')->group(function () {                         │ │
│ │     Route::get('/', [RoomMemberController::class, 'myMembership']);     │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 AUTHENTICATION MIDDLEWARE                                               │
│─────────────────────────────────────────────────────────────────────────────│
│ Middleware: auth:sanctum (Laravel\Sanctum\Http\Middleware\EnsureFrontend...)│
│                                                                             │
│ Validates the Bearer token and loads the authenticated user.                │
│ If invalid: Returns 401 Unauthorized via exception handler.                 │
│ If valid: Adds user to $request->user()                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomMemberController.php:43-58       │
│ Method: myMembership(Request $request)                                      │
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
│ STEP 2: Call service to fetch memberships                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $memberships = $this->memberService->getActiveRoomsForUser($user->id);  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle empty memberships case                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($memberships->isEmpty()) {                                          │ │
│ │     return ApiResponse::success([], 'Not a member of any room');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success with resource collection                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     RoomMemberResource::collection($memberships->load('user', 'room'))  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:34-42                         │
│ Method: getActiveRoomsForUser(int $userId)                                  │
│                                                                             │
│ The service acts as a thin wrapper, delegating to the model's static method:│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getActiveRoomsForUser(int $userId): Collection          │ │
│ │ {                                                                       │ │
│ │     return RoomMember::getActiveRoomsForUser($userId);                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php:124-135                            │ │
│ │ Responsibility: Query active memberships for a user                     │ │
│ │ Reusable: YES (used by multiple endpoints)                              │ │
│ │ Why It Exists: Encapsulates membership query logic in the model         │ │
│ │                                                                         │ │
│ │ Static Method:                                                          │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ public static function getActiveRoomsForUser(int $userId): Collection│ │
│ │ │ {                                                                   │ │ │
│ │ │     return static::where('user_id', $userId)                        │ │ │
│ │ │         ->where('status', RoomMemberStatus::ACTIVE)                 │ │ │
│ │ │         ->with('room')                                              │ │ │
│ │ │         ->get();                                                    │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberResource (API Resource)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomMemberResource.php                 │ │
│ │ Responsibility: Transform RoomMember model to JSON response             │ │
│ │ Reusable: YES (used by members, myMembership endpoints)                 │ │
│ │ Why It Exists: Consistent response formatting across endpoints          │ │
│ │                                                                         │ │
│ │ Output Fields:                                                          │ │
│ │   • id → Membership ID                                                  │ │
│ │   • user → MinimalUserResource (nested, when loaded)                    │ │
│ │   • role → Role enum value ("owner", "admin", "member")                 │ │
│ │   • role_label → Human-readable role label                              │ │
│ │   • status → Status enum value ("active")                               │ │
│ │   • joined_at → ISO8601 timestamp or null                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Minimal user data for nested references                 │ │
│ │ Reusable: YES (used by Room, Agency, and other resources)               │ │
│ │ Why It Exists: Provides consistent 12-field user snapshot               │ │
│ │                                                                         │ │
│ │ Output Fields:                                                          │ │
│ │   • id, name, signature, avatar, frame, gender                          │ │
│ │   • email, phone, country, date_of_birth                                │ │
│ │   • wealth_xp, charm_xp                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Define valid member roles                               │ │
│ │ Reusable: YES (used across all room membership logic)                   │ │
│ │                                                                         │ │
│ │ Values: OWNER, ADMIN, MEMBER                                            │ │
│ │ Methods: label(), color(), canManageMembers(), isHigherThan()           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberStatus.php                               │ │
│ │ Responsibility: Define membership statuses                              │ │
│ │ Reusable: YES (used across all room membership logic)                   │ │
│ │                                                                         │ │
│ │ Values: ACTIVE, LEFT, KICKED, BANNED                                    │ │
│ │ Methods: label(), color(), canRejoin()                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 response with data                                  │ │
│ │   • unauthorized() → 401 response                                       │ │
│ │   • serverError() → 500 response                                        │ │
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
│ 1. SELECT: Fetch active memberships for user                                │
│    Query: SELECT * FROM room_members                                        │
│           WHERE user_id = ? AND status = 'active'                           │
│    Source: RoomMember::getActiveRoomsForUser()                              │
│                                                                             │
│ 2. SELECT: Eager load rooms                                                 │
│    Query: SELECT * FROM rooms WHERE id IN (...)                             │
│    Source: ->with('room') in getActiveRoomsForUser()                        │
│                                                                             │
│ 3. SELECT: Eager load users (for response)                                  │
│    Query: SELECT * FROM users WHERE id IN (...)                             │
│    Source: $memberships->load('user', 'room') in controller                 │
│                                                                             │
│ CACHE OPERATIONS: None for this endpoint                                    │
│                                                                             │
│ QUEUE OPERATIONS: None for this endpoint                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ The response is built using Laravel's API Resource pattern:                 │
│                                                                             │
│ 1. RoomMemberResource::collection() wraps each RoomMember model             │
│ 2. Each RoomMemberResource includes MinimalUserResource for the user        │
│ 3. ApiResponse::success() wraps the collection with standard envelope       │
│                                                                             │
│ Response Building Flow:                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $memberships->load('user', 'room')                                      │ │
│ │      ↓                                                                  │ │
│ │ RoomMemberResource::collection()                                        │ │
│ │      ↓                                                                  │ │
│ │ For each RoomMember:                                                    │ │
│ │   → id, role, role_label, status, joined_at                             │ │
│ │   → new MinimalUserResource($this->whenLoaded('user'))                  │ │
│ │      ↓                                                                  │ │
│ │ ApiResponse::success() wraps with status, message, meta                 │ │
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

| File                       | Used By Endpoints                | Reusable | Reasoning                                 |
| -------------------------- | -------------------------------- | -------- | ----------------------------------------- |
| `RoomMemberController.php` | user/room, rooms/{room}/members  | ⭕       | Controller-specific but shares service    |
| `RoomMemberService.php`    | All room member endpoints        | ✅       | Centralized membership business logic     |
| `RoomMember.php`           | All room-related endpoints       | ✅       | Core model for room membership            |
| `RoomMemberResource.php`   | user/room, rooms/{room}/members  | ✅       | Standard membership response format       |
| `MinimalUserResource.php`  | Room, Agency, many other domains | ✅       | Consistent user representation across app |
| `RoomMemberRole.php`       | All room membership logic        | ✅       | Core enum for role definitions            |
| `RoomMemberStatus.php`     | All room membership logic        | ✅       | Core enum for status definitions          |
| `ApiResponse.php`          | All API endpoints                | ✅       | Global response utility                   |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

_None_ - This endpoint has no request body or validation.

### Business Logic Errors (400)

_None_ - This endpoint only retrieves data, no business logic errors.

### Authentication Errors (401)

| Error          | Source                    | Condition                       |
| -------------- | ------------------------- | ------------------------------- |
| "Unauthorized" | `auth:sanctum` middleware | Missing or invalid Bearer token |
| "Unauthorized" | Controller null check     | `$request->user()` returns null |

### System Errors (500)

| Error                   | Source              | Condition                         |
| ----------------------- | ------------------- | --------------------------------- |
| "Internal server error" | Database connection | PostgreSQL unavailable            |
| "Internal server error" | Query execution     | SQL error during membership fetch |

### Edge Cases

| Case                          | Behavior                                               |
| ----------------------------- | ------------------------------------------------------ |
| User has no memberships       | Returns `200` with empty array, custom message         |
| User has multiple memberships | Returns array of all active memberships                |
| User left/kicked/banned       | Those memberships NOT included (status != ACTIVE)      |
| User is owner of a room       | Included with `role: "owner"`                          |
| Deleted room                  | Soft-deleted rooms still included if membership active |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                       │                       │                        │
   │  GET /user/room       │                       │                       │                        │
   │  Authorization: Bearer│                       │                       │                        │
   │──────────────────────▶│                       │                       │                        │
   │                       │                       │                       │                        │
   │                       │ 1. auth:sanctum       │                       │                        │
   │                       │  (validate token)     │                       │                        │
   │                       │──────────────────────▶│                       │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 2. Get user from      │                        │
   │                       │                       │    request            │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 3. getActiveRoomsFor  │                        │
   │                       │                       │    User($userId)      │                        │
   │                       │                       │──────────────────────▶│                        │
   │                       │                       │                       │                        │
   │                       │                       │                       │ 4. SELECT room_members │
   │                       │                       │                       │    WHERE user_id = ?   │
   │                       │                       │                       │    AND status = active │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │                       │ 5. SELECT rooms        │
   │                       │                       │                       │    WHERE id IN (...)   │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │◀──────────────────────│                        │
   │                       │                       │                       │                        │
   │                       │                       │ 6. Load users for     │                        │
   │                       │                       │    resource           │                        │
   │                       │                       │                       │ 7. SELECT users        │
   │                       │                       │                       │    WHERE id IN (...)   │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │ 8. Build response     │                        │
   │                       │                       │    RoomMemberResource │                        │
   │                       │                       │    ::collection()     │                        │
   │                       │◀──────────────────────│                       │                        │
   │◀──────────────────────│                       │                       │                        │
   │                       │                       │                       │                        │
   │  200 OK + JSON        │                       │                       │                        │
   │                       │                       │                       │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition             | Location                                        |
| -------------------- | ----------------------------------------------- |
| New membership field | `RoomMemberResource`, `RoomMember` model        |
| Filter by role       | Add query parameter handling in controller      |
| Include room details | Already eager loads `room`, expose via resource |
| Pagination           | Convert collection to paginator in controller   |
| Cache memberships    | Add Redis caching in `getActiveRoomsForUser`    |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                | What to Change                     |
| ----- | --------------------------------------------------- | ---------------------------------- |
| **1** | Database Migration                                  | Add column to `room_members` table |
| **2** | `app/Models/Room/RoomMember.php`                    | Add to `$fillable` and `$casts`    |
| **3** | `app/Http/Resources/V1/Room/RoomMemberResource.php` | Add field to `toArray()` return    |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                | What to Change                  |
| ----- | --------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomMemberResource.php` | Remove from `toArray()` return  |
| **2** | Check other endpoints                               | Verify field not used elsewhere |
| **3** | Database Migration (optional)                       | Drop column if no longer needed |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW DIAGRAM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Database (room_members)                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  RoomMember Model ($fillable, $casts)                                       │
│       │                                                                     │
│       ▼                                                                     │
│  RoomMemberService (getActiveRoomsForUser)                                  │
│       │                                                                     │
│       ▼                                                                     │
│  Controller ($memberships->load('user', 'room'))                            │
│       │                                                                     │
│       ▼                                                                     │
│  RoomMemberResource (toArray)                                               │
│       │                                                                     │
│       ▼                                                                     │
│  API Response (JSON)                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

**Before Adding a Field:**

- [ ] Determine if field should be nullable
- [ ] Consider if field needs casting (enum, date, etc.)
- [ ] Check if field should be in MinimalUserResource vs RoomMemberResource

**Before Removing a Field:**

- [ ] Check if field is used by other endpoints
- [ ] Verify frontend doesn't depend on the field
- [ ] Consider deprecation period

### ⚠️ What Should NOT Be Modified Casually

| Component                       | Reason                                                  |
| ------------------------------- | ------------------------------------------------------- |
| `RoomMemberStatus::ACTIVE`      | Core constant used in all membership queries            |
| `MinimalUserResource` structure | Used across many domains, changes affect whole app      |
| User eager loading              | Removing causes N+1 queries                             |
| `auth:sanctum` middleware       | Security-critical, protects all authenticated endpoints |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                               |
| ------------------------------------ | -------------------------------------------------------- |
| N+1 queries when listing memberships | Always use `->with('room')` and `->load('user', 'room')` |
| Including inactive memberships       | Query always filters by `status = ACTIVE`                |
| Forgetting null user check           | Controller explicitly checks `$request->user() === null` |
| Breaking MinimalUserResource         | Test all endpoints using this resource after changes     |
| Exposing sensitive user data         | MinimalUserResource is pre-approved set of safe fields   |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:39            ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomMemberController.php              ← Controller
app/Services/Room/
  └── RoomMemberService.php                 ← Service layer
app/Models/Room/
  └── RoomMember.php                        ← Model with static query
app/Http/Resources/V1/Room/
  └── RoomMemberResource.php                ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php               ← Nested user resource
app/Enums/Room/
  ├── RoomMemberRole.php                    ← Role enum
  └── RoomMemberStatus.php                  ← Status enum
app/Http/Utils/
  └── ApiResponse.php                       ← Response utility
```

---

## Document Metadata

| Property            | Value                   |
| ------------------- | ----------------------- |
| **Endpoint**        | `GET /api/v1/user/room` |
| **Domain**          | User / Room Membership  |
| **Author**          | System Documentation    |
| **Created**         | 2026-01-30              |
| **Laravel Version** | 12.x                    |
| **PHP Version**     | 8.4                     |
