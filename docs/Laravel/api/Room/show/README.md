# GET /api/v1/rooms/{room}

> **Domain**: Room  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

Retrieve detailed information about a specific room by its ID. Returns full room data including owner information.

### Responsibilities

- Resolve room by ID via route model binding
- Return 404 if room not found or soft-deleted
- Transform room data with owner relationship
- Handle unexpected errors gracefully

### What It Owns

| Owned              | Description                                   |
| ------------------ | --------------------------------------------- |
| Single room lookup | Provides read access to a specific room by ID |
| Owner inclusion    | Loads owner relationship for response         |

### External Dependencies

| Dependency | Type           | Purpose                                 |
| ---------- | -------------- | --------------------------------------- |
| PostgreSQL | Database       | Stores room and user data               |
| Redis      | Infrastructure | Rate limiting via `api_dynamic` limiter |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/{room}
```

### URL Parameters

| Parameter | Type  | Required | Description           |
| --------- | ----- | -------- | --------------------- |
| `room`    | `int` | ✅       | The room ID (numeric) |

### Authentication

❌ **None Required** - This is a public endpoint. Guests and authenticated users can access it.

### Rate Limiting

| Limiter       | Key                         | Config                              |
| ------------- | --------------------------- | ----------------------------------- |
| `api_dynamic` | `guest:{ip}` or `user:{id}` | 30-500 req/min based on user's role |

**Rate Limits by Role:**

- Guest: 30 req/min
- User: 60 req/min
- Content Creator: 120 req/min
- Agency Manager: 180 req/min
- Moderator: 240 req/min
- Admin: 300 req/min
- Super Admin: 500 req/min

### Request Headers

| Header         | Required | Type               | Description        |
| -------------- | -------- | ------------------ | ------------------ |
| `Accept`       | ✅       | `application/json` | Response format    |
| `Content-Type` | ❌       | N/A                | Not needed for GET |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Room details retrieved successfully",
  "data": {
    "id": 1,
    "name": "Cool Music Room",
    "logo": "https://ik.imagekit.io/flylive/rooms/logo123.jpg",
    "type": "public",
    "type_label": "Public",
    "is_private": false,
    "country": "PK",
    "is_live": true,
    "participant_count": 25,
    "room_xp": "150.5000",
    "current_level": 3,
    "max_seats": 8,
    "sort_order": 100,
    "created_at": "2026-01-15T10:30:00.000000Z",
    "owner_id": 42,
    "owner": {
      "id": 42,
      "name": "John Doe",
      "signature": "ABC123",
      "avatar": "https://ik.imagekit.io/flylive/avatars/user42.jpg",
      "frame": null,
      "gender": "male",
      "email": "john@example.com",
      "phone": "+923001234567",
      "country": "PK",
      "date_of_birth": "1995-05-15",
      "wealth_xp": "5000",
      "charm_xp": "3500"
    }
  },
  "meta": {
    "timestamp": "2026-01-30T10:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "message": "No query results for model [App\\Models\\Room\\Room] 999"
}
```

> **Note**: Laravel's implicit route model binding throws `ModelNotFoundException` which is handled by the global exception handler, returning a 404 with the model not found message.

#### ❌ Rate Limit Error (429)

```json
{
  "status": "error",
  "message": "Too Many Attempts.",
  "data": null,
  "errors": {}
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to retrieve room details",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-01-30T10:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                              |
| ----- | -------------------------------------- |
| `200` | Room retrieved successfully            |
| `404` | Room not found (or soft-deleted)       |
| `429` | Rate limit exceeded                    |
| `500` | Database error or unexpected exception |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms/123                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:24-27                                            │
│ Route: Route::get('/{room}', [RoomController::class, 'show'])               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. throttle:api_dynamic  → Role-based rate limiting (30-500 req/min)      │
│                                                                             │
│ Route Constraints:                                                          │
│   • ->whereNumber('room')  → Ensures {room} is numeric                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('rooms')->name('rooms.')->group(function () {             │ │
│ │     Route::get('/{room}', [RoomController::class, 'show'])              │ │
│ │         ->name('show')                                                  │ │
│ │         ->whereNumber('room')                                           │ │
│ │         ->middleware('throttle:api_dynamic');                           │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 RATE LIMITING (api_dynamic)                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Providers/AppServiceProvider.php:171-197                          │
│                                                                             │
│ Dynamic rate limiting based on user's highest role.                         │
│ For guests (unauthenticated): 30 req/min by IP                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ RateLimiter::for('api_dynamic', function (Request $request) {           │ │
│ │     $user = $request->user();                                           │ │
│ │     if ($user === null) {                                               │ │
│ │         return Limit::perMinute(30)->by("guest:{$request->ip()}");      │ │
│ │     }                                                                   │ │
│ │     // Role-based limits: Super Admin=500, Admin=300, etc.              │ │
│ │     return Limit::perMinute($maxLimit)->by("dynamic:{$user->id}");      │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel's Implicit Route Model Binding                                      │
│                                                                             │
│ Laravel automatically resolves {room} to a Room model instance:             │
│   1. Extracts the {room} parameter value (e.g., "123")                      │
│   2. Queries: SELECT * FROM rooms WHERE id = 123 AND deleted_at IS NULL     │
│   3. If found → Injects Room instance into controller                       │
│   4. If not found → Throws ModelNotFoundException → 404 response            │
│                                                                             │
│ Key Behavior:                                                               │
│   • SoftDeletes trait on Room model → Auto-filters soft-deleted rooms       │
│   • whereNumber('room') → Route returns 404 for non-numeric IDs             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Internal Laravel behavior:                                           │ │
│ │ $room = Room::findOrFail($routeParameter['room']);                      │ │
│ │ // Equivalent to:                                                       │ │
│ │ SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL LIMIT 1         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:136-154           │
│ Method: show(Room $room): JsonResponse                                      │
│                                                                             │
│ The controller is minimal - the Room is already resolved by route binding.  │
│                                                                             │
│ STEP 1: Wrap in try-catch for error handling                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     return ApiResponse::success(                                        │ │
│ │         new RoomResource($room),                                        │ │
│ │         'Room details retrieved successfully'                           │ │
│ │     );                                                                  │ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     Log::error('Failed to show room', [                                 │ │
│ │         'room_id' => $room->id,                                         │ │
│ │         'error' => $e->getMessage(),                                    │ │
│ │     ]);                                                                 │ │
│ │     return ApiResponse::serverError('Failed to retrieve room details'); │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Observations:                                                           │
│   • No service layer involved - direct model to resource transformation     │
│   • No eager loading in controller (owner loaded lazily in resource)        │
│   • No validation needed (ID validated by route constraint)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Room Model                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Eloquent model for rooms table                          │ │
│ │ Reusable: YES (used by all Room domain endpoints)                       │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • Soft deletes enabled (auto-filtered in queries)                     │ │
│ │   • Casts: type → RoomType enum, password → hashed                      │ │
│ │   • Hidden: password (never exposed in serialization)                   │ │
│ │   • Relationships: user() → BelongsTo<User>                             │ │
│ │   • Methods: isPrivate(), isPublic(), hasLogo(), requiresPassword()     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomType Enum                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomType.php                                       │ │
│ │ Responsibility: Room visibility type enum                               │ │
│ │ Reusable: YES (used in Room model, resources, and requests)             │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PUBLIC = 'public'                                                   │ │
│ │   • PRIVATE = 'private'                                                 │ │
│ │                                                                         │ │
│ │ Methods:                                                                │ │
│ │   • label() → "Public" or "Private"                                     │ │
│ │   • requiresPassword() → bool                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Base class for all API resources                        │ │
│ │ Reusable: YES (all resources extend this)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • formatTimestamp() → Consistent datetime formatting                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (PostgreSQL):                                           │
│                                                                             │
│ 1. SELECT: Fetch room by ID (Route Model Binding)                           │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT * FROM rooms                                                  │ │
│    │   WHERE id = 123                                                     │ │
│    │   AND deleted_at IS NULL                                             │ │
│    │   LIMIT 1                                                            │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT: Lazy load room owner (when accessed in RoomResource)             │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT * FROM users WHERE id = ? LIMIT 1                             │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: Room::user() relationship (lazy loaded)                          │
│    Note: This triggers when RoomResource accesses whenLoaded('user').       │
│          Since user is not eager-loaded, it performs a lazy load.           │
│                                                                             │
│ CACHE OPERATIONS (Redis):                                                   │
│                                                                             │
│ 1. CHECK: Rate limit counter                                                │
│    Key: laravel_cache:throttle:api_dynamic:guest:<ip>                       │
│    Source: ThrottleRequests middleware                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:142-145           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomResource($room),                                            │ │
│ │     'Room details retrieved successfully'                               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomResource                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomResource.php                       │ │
│ │ Responsibility: Transform Room model to API response                    │ │
│ │ Reusable: YES (used by show, index, myRoom, update endpoints)           │ │
│ │                                                                         │ │
│ │ Output Fields (16 total):                                               │ │
│ │   • id, name, logo, type, type_label, is_private                        │ │
│ │   • country, is_live, participant_count, room_xp                        │ │
│ │   • current_level, max_seats, sort_order, created_at                    │ │
│ │   • owner_id, owner (nested MinimalUserResource)                        │ │
│ │                                                                         │ │
│ │ Key Implementation:                                                     │ │
│ │   • 'type' => $room->type               (RoomType enum)                 │ │
│ │   • 'type_label' => $room->type->label() ("Public"/"Private")           │ │
│ │   • 'is_private' => $room->isPrivate()  (boolean helper)                │ │
│ │   • 'owner' => new MinimalUserResource($this->whenLoaded('user'))       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Minimal user data for nested embedding                  │ │
│ │ Reusable: YES (Room.owner, RoomMember.user, AgencyMember.user)          │ │
│ │                                                                         │ │
│ │ Output Fields (12 total):                                               │ │
│ │   • id, name, signature, avatar, frame, gender                          │ │
│ │   • email, phone, country, date_of_birth, wealth_xp, charm_xp           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response wrapper                       │ │
│ │ Reusable: YES (all API endpoints use this)                              │ │
│ │                                                                         │ │
│ │ Key Method: success()                                                   │ │
│ │   • Wraps data in standard success response structure                   │ │
│ │   • Adds timestamp and correlation_id to meta                           │ │
│ │   • Sets status = "success" and HTTP 200 (default)                      │ │
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

| File                      | Used By Endpoints                                    | Reusable | Reasoning                          |
| ------------------------- | ---------------------------------------------------- | -------- | ---------------------------------- |
| `RoomController.php`      | Room CRUD endpoints                                  | ⭕       | Contains endpoint-specific methods |
| `Room.php` (Model)        | All Room domain endpoints                            | ✅       | Core model for room data           |
| `RoomType.php` (Enum)     | Room model, resources, requests                      | ✅       | Shared enum for room visibility    |
| `RoomResource.php`        | `GET /rooms`, `GET /rooms/{id}`, `POST /rooms`, etc. | ✅       | Standard room response transformer |
| `MinimalUserResource.php` | Room, RoomMember, Agency endpoints                   | ✅       | Lightweight user embedding         |
| `ApiResponse.php`         | All API endpoints                                    | ✅       | Standard response wrapper          |
| `BaseResource.php`        | All API resources                                    | ✅       | Common resource utilities          |
| `AppServiceProvider.php`  | Application-wide                                     | ✅       | Rate limiter definitions           |

---

## 5. Error Handling & Edge Cases

### Not Found Errors (404)

| Error           | Source              | Condition                           |
| --------------- | ------------------- | ----------------------------------- |
| Model not found | Route Model Binding | Room ID doesn't exist in database   |
| Model not found | Route Model Binding | Room is soft-deleted                |
| Route not found | Laravel Router      | Non-numeric ID (e.g., `/rooms/abc`) |

### System Errors (500)

| Error                             | Source           | Condition                   |
| --------------------------------- | ---------------- | --------------------------- |
| "Failed to retrieve room details" | `RoomController` | Database connection failure |
| "Failed to retrieve room details" | `RoomController` | Unexpected exception        |

### Rate Limit Errors (429)

| Error                | Source             | Condition                       |
| -------------------- | ------------------ | ------------------------------- |
| "Too Many Attempts." | `ThrottleRequests` | Request rate exceeds role limit |

### Edge Cases

| Case                         | Behavior                                              |
| ---------------------------- | ----------------------------------------------------- |
| Room soft-deleted            | Returns 404 (SoftDeletes trait filters automatically) |
| Room ID = 0 or negative      | Returns 404 (no room with that ID)                    |
| Room with no owner (user_id) | N/A (user_id is required, FK constraint)              |
| Owner user soft-deleted      | Owner still loaded (no cascade filter on User)        |
| Room without logo            | `logo` field returns `null`                           |
| Very large room ID           | Returns 404 if not found                              |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              ROUTE BINDING           CONTROLLER                RESOURCE/MODEL              DATABASE
   │                       │                       │                       │                           │                        │
   │  GET /api/v1/rooms/123│                       │                       │                           │                        │
   │──────────────────────▶│                       │                       │                           │                        │
   │                       │                       │                       │                           │                        │
   │                       │ 1. Check rate limit   │                       │                           │                        │
   │                       │────────────────────── REDIS ─────────────────────────────────────────────────────────────────────▶│
   │                       │◀─────────────────────────────────────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                           │                        │
   │                       │ 2. Resolve route      │                       │                           │                        │
   │                       │──────────────────────▶│                       │                           │                        │
   │                       │                       │                       │                           │                        │
   │                       │                       │ 3. SELECT room by ID  │                           │                        │
   │                       │                       │─────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀─────────────────────────────────────────────────────────────────────────│
   │                       │                       │   Room Model          │                           │                        │
   │                       │                       │                       │                           │                        │
   │                       │                       │ 4. Inject Room        │                           │                        │
   │                       │                       │──────────────────────▶│                           │                        │
   │                       │                       │                       │                           │                        │
   │                       │                       │                       │ 5. Create RoomResource    │                        │
   │                       │                       │                       │──────────────────────────▶│                        │
   │                       │                       │                       │                           │                        │
   │                       │                       │                       │                           │ 6. Access user relation│
   │                       │                       │                       │                           │ (lazy load)            │
   │                       │                       │                       │                           │───────────────────────▶│
   │                       │                       │                       │                           │◀───────────────────────│
   │                       │                       │                       │                           │                        │
   │                       │                       │                       │◀──────────────────────────│                        │
   │                       │                       │                       │   Transformed array       │                        │
   │                       │                       │                       │                           │                        │
   │                       │                       │                       │ 7. Wrap with ApiResponse  │                        │
   │                       │                       │◀──────────────────────│                           │                        │
   │                       │◀──────────────────────│                       │                           │                        │
   │◀──────────────────────│                       │                       │                           │                        │
   │                       │                       │                       │                           │                        │
   │  200 OK + JSON        │                       │                       │                           │                        │
   │                       │                       │                       │                           │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                            |
| ------------------------ | --------------------------------------------------- |
| Additional room data     | `RoomResource.toArray()`                            |
| Eager load relationships | Add `->load()` in controller before resource        |
| Authorization check      | Add `$this->authorize('view', $room)` in controller |
| Caching layer            | Cache the room in controller before resource        |
| Custom 404 message       | Create route model binding customization            |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                          | What to Change                     |
| ----- | --------------------------------------------- | ---------------------------------- |
| **1** | Database Migration                            | Add column (if new data)           |
| **2** | `app/Models/Room/Room.php`                    | Add to `$fillable` (if new column) |
| **3** | `app/Http/Resources/V1/Room/RoomResource.php` | Add to `toArray()` return array    |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                          | What to Change                    |
| ----- | --------------------------------------------- | --------------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomResource.php` | Remove from `toArray()` return    |
| **2** | Update API documentation                      | Remove field from response schema |

#### 🔀 ADDING EAGER LOADING

| Step  | File                                                  | What to Change                                   |
| ----- | ----------------------------------------------------- | ------------------------------------------------ |
| **1** | `app/Http/Controllers/Api/V1/Room/RoomController.php` | Add `$room->load(['user', ...])` before resource |

### 🔗 Field Flow Dependency Chain

```
URL Parameter ({room})
        │
        ▼
┌─────────────────────┐
│ Route Model Binding │
│ Room::findOrFail()  │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Controller          │
│ show(Room $room)    │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ RoomResource        │
│ toArray()           │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ MinimalUserResource │
│ (nested owner)      │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ ApiResponse::success│
│ JSON output         │
└─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                                   |
| -------------------------------- | -------------------------------------------------------- |
| `ApiResponse` structure          | Breaking change: all API consumers depend on this format |
| `RoomResource` field names       | Breaking change: mobile/web apps depend on these keys    |
| Route model binding behavior     | Affects all room endpoints using `{room}` parameter      |
| Rate limiter keys                | May cause cache key collisions or limits not applying    |
| `Room` model `$hidden` array     | Security: `password` hash should never be exposed        |
| `whereNumber('room')` constraint | Security/validation: prevents invalid route parameters   |

### 🚨 Common Pitfalls

| Pitfall                            | Prevention                                             |
| ---------------------------------- | ------------------------------------------------------ |
| N+1 query on owner relationship    | Use `$room->load(['user'])` for eager loading          |
| Exposing room password             | `password` is in `$hidden`, never add to resource      |
| Soft-deleted rooms appearing       | `SoftDeletes` trait filters automatically              |
| Breaking response format           | Don't change `ApiResponse` structure                   |
| Missing owner in response          | `whenLoaded()` gracefully handles missing relationship |
| Forgetting to update documentation | Always update this doc when changing response          |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                 ← Route definition (line 24-27)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                             ← Controller (show method, L136-154)
app/Models/Room/
  └── Room.php                                       ← Eloquent model
app/Enums/Room/
  └── RoomType.php                                   ← Room type enum
app/Http/Resources/V1/Room/
  └── RoomResource.php                               ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                        ← Nested owner transformer
app/Http/Utils/
  └── ApiResponse.php                                ← Response wrapper utility
app/Providers/
  └── AppServiceProvider.php                         ← Rate limiter config (L171-197)
```

---

## Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/{room}` |
| **Domain**          | Room                       |
| **Author**          | System Documentation       |
| **Created**         | 2026-01-30                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4                        |
