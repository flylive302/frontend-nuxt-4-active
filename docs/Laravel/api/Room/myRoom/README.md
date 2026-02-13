# GET /api/v1/rooms/myRoom

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

This endpoint retrieves the authenticated user's own room. It returns the room details if the user owns a room, or a success response with `null` data if they don't.

### Responsibilities

- Authenticate the user via Sanctum token
- Query the database for a room owned by the authenticated user
- Return room details with owner information
- Handle the case when user has no room

### What It Owns

| Owned          | Description                                     |
| -------------- | ----------------------------------------------- |
| Room Retrieval | Fetches the room where `user_id` = current user |

### External Dependencies

| Dependency | Type           | Purpose                         |
| ---------- | -------------- | ------------------------------- |
| PostgreSQL | Database       | Stores room and user data       |
| Sanctum    | Authentication | Validates bearer token          |
| Redis      | Infrastructure | Rate limiting via `api_dynamic` |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/myRoom
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter       | Key       | Config                     |
| ------------- | --------- | -------------------------- |
| `api_dynamic` | `user.id` | `config/rate-limiting.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

**No request body** - This is a GET endpoint with no parameters.

---

### Response Schemas

#### ✅ Success Response (200) - User Has a Room

```json
{
  "status": "success",
  "message": "Room details retrieved successfully",
  "data": {
    "id": 1, // integer, Room ID
    "name": "My Awesome Room", // string, Room name
    "logo": "https://ik.imagekit.io/...", // string|null, Logo URL
    "type": "public", // string, "public" | "private"
    "type_label": "Public", // string, Human-readable type
    "is_private": false, // boolean, Convenience flag
    "country": "US", // string, ISO 3166-1 alpha-2
    "is_live": true, // boolean, Live streaming status
    "participant_count": 5, // integer, Current participants
    "room_xp": "1234.5678", // string, XP as decimal string
    "current_level": 3, // integer, Current level
    "max_seats": 8, // integer, Maximum seat capacity
    "sort_order": 0, // integer, Display order
    "created_at": "2026-01-30T12:00:00.000000Z", // ISO 8601 timestamp
    "owner_id": 42, // integer, Owner's user ID
    "owner": {
      // MinimalUserResource
      "id": 42,
      "name": "John Doe",
      "signature": "ABC123",
      "avatar": "https://ik.imagekit.io/...",
      "frame": null,
      "gender": "male",
      "email": "john@example.com",
      "phone": "+1234567890",
      "country": "US",
      "date_of_birth": "1990-01-15",
      "wealth_xp": "1000",
      "charm_xp": "500"
    }
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ✅ Success Response (200) - User Has No Room

```json
{
  "status": "success",
  "message": "You do not have a room",
  "data": null,
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "User not authenticated",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to retrieve room details",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Success (with or without room data) |
| `401` | User not authenticated              |
| `429` | Rate limit exceeded                 |
| `500` | Database or unexpected error        |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms/myRoom                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:36-39                                            │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum', 'throttle:api_dynamic'])             │ │
│ │     ->prefix('rooms')->name('rooms.')->group(function () {              │ │
│ │         Route::get('/myRoom', [RoomController::class, 'showOwner'])     │ │
│ │             ->name('my-room');                                          │ │
│ │     });                                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates bearer token, attaches user to request      │
│   2. throttle:api_dynamic  → Applies rate limiting per config              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (Middleware)                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: vendor/laravel/sanctum/src/Http/Middleware/EnsureFrontendRequestsAreStateful.php │
│                                                                             │
│ Sanctum Authentication:                                                     │
│   • Validates the Bearer token from Authorization header                    │
│   • Retrieves user from personal_access_tokens table                        │
│   • Attaches User instance to $request->user()                              │
│   • Returns 401 if token is invalid or missing                              │
│                                                                             │
│ Rate Limiting:                                                              │
│   • Checks request count against configured limits                          │
│   • Returns 429 if limit exceeded                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:156-187           │
│ Method: showOwner(Request $request)                                         │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('User not authenticated');         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Query room owned by user with eager loading                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::where('user_id', $user->id)->with(['user'])->first();     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle case when user has no room                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($room === null) {                                                   │ │
│ │     return ApiResponse::success(null, 'You do not have a room');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return room details with resource transformation                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomResource($room),                                            │ │
│ │     'Room details retrieved successfully'                               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint does NOT use any service layer.                               │
│ All logic is contained directly in the controller.                          │
│                                                                             │
│ The query is a simple Eloquent query:                                       │
│   Room::where('user_id', $user->id)->with(['user'])->first()                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Room (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Eloquent model for rooms table                          │ │
│ │ Reusable: YES (used by all room endpoints)                              │ │
│ │ Why It Exists: Core domain model for room entity                        │ │
│ │                                                                         │ │
│ │ Key Methods/Relationships:                                              │ │
│ │   • user() → BelongsTo relationship to User model                       │ │
│ │   • isPrivate() → Returns true if type is 'private'                     │ │
│ │   • Casts 'type' to RoomType enum                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomResource (Resource)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomResource.php                       │ │
│ │ Responsibility: Transform Room model to API response format             │ │
│ │ Reusable: YES (used by all room endpoints returning room data)          │ │
│ │ Why It Exists: Consistent room JSON serialization                       │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • Transforms RoomType enum to string value + label                    │ │
│ │   • Includes is_private convenience flag                                │ │
│ │   • Casts room_xp to string for precision                               │ │
│ │   • Embeds MinimalUserResource for owner                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Lightweight user representation (12 fields)             │ │
│ │ Reusable: YES (used wherever nested user data is needed)                │ │
│ │ Why It Exists: Avoid full UserResource overhead in nested contexts      │ │
│ │                                                                         │ │
│ │ Fields Returned:                                                        │ │
│ │   id, name, signature, avatar, frame, gender, email, phone,             │ │
│ │   country, date_of_birth, wealth_xp, charm_xp                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomType (Enum)                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomType.php                                       │ │
│ │ Responsibility: Define room visibility types                            │ │
│ │ Reusable: YES (used by Room model and all room operations)              │ │
│ │ Why It Exists: Type-safe room type handling                             │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PUBLIC = 'public' → label() returns "Public"                        │ │
│ │   • PRIVATE = 'private' → label() returns "Private"                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Consistent API response formatting                      │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │ Why It Exists: Standardized response structure across API               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 response                             │ │
│ │   • unauthorized($message) → 401 response                               │ │
│ │   • serverError($message) → 500 response                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Abstract Resource)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Common resource functionality                           │ │
│ │ Reusable: YES (parent class for all resources)                          │ │
│ │ Why It Exists: DRY principle for resource utilities                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • formatTimestamp() → Format dates to ISO 8601                        │ │
│ │   • with() → Adds meta (timestamp, correlation_id)                      │ │
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
│ 1. SELECT: Fetch room by user_id with eager-loaded user                     │
│    Query: SELECT * FROM rooms WHERE user_id = ? AND deleted_at IS NULL      │
│           LIMIT 1                                                           │
│    Source: RoomController::showOwner()                                      │
│                                                                             │
│ 2. SELECT: Eager load owner user (if room exists)                           │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: with(['user']) eager loading                                     │
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
│ File: app/Http/Resources/V1/Room/RoomResource.php                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $room->id,                                                  │ │
│ │     'name' => $room->name,                                              │ │
│ │     'logo' => $room->logo,                                              │ │
│ │     'type' => $room->type,              // RoomType enum → string       │ │
│ │     'type_label' => $room->type->label(), // "Public" or "Private"      │ │
│ │     'is_private' => $room->isPrivate(),                                 │ │
│ │     'country' => $room->country,                                        │ │
│ │     'is_live' => $room->is_live,                                        │ │
│ │     'participant_count' => $room->participant_count,                    │ │
│ │     'room_xp' => (string) $room->room_xp,                               │ │
│ │     'current_level' => $room->current_level,                            │ │
│ │     'max_seats' => $room->max_seats,                                    │ │
│ │     'sort_order' => $room->sort_order,                                  │ │
│ │     'created_at' => $this->formatTimestamp($room->created_at),          │ │
│ │     'owner_id' => $room->user_id,                                       │ │
│ │     'owner' => new MinimalUserResource($this->whenLoaded('user')),      │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Final response wrapped by ApiResponse::success():                           │
│   { status, message, data: RoomResource, meta: {timestamp, correlation_id} }│
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

| File                      | Used By Endpoints                     | Reusable | Reasoning                                |
| ------------------------- | ------------------------------------- | -------- | ---------------------------------------- |
| `RoomController.php`      | Room domain only                      | ⭕       | Controller methods are endpoint-specific |
| `Room.php` (Model)        | All room endpoints                    | ✅       | Core domain model                        |
| `RoomResource.php`        | index, show, showOwner, store, update | ✅       | Standard room JSON serialization         |
| `MinimalUserResource.php` | Room, Agency, Message endpoints       | ✅       | Lightweight user embedding               |
| `RoomType.php` (Enum)     | All room operations                   | ✅       | Type-safe room type handling             |
| `ApiResponse.php`         | ALL API endpoints                     | ✅       | Global response utility                  |
| `BaseResource.php`        | ALL resources                         | ✅       | Parent class for resources               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                      |
| ----- | ------ | ---------------------------------------------- |
| N/A   | N/A    | No request validation - GET with no parameters |

### Authentication Errors (401)

| Error                    | Source                      | Condition                         |
| ------------------------ | --------------------------- | --------------------------------- |
| "User not authenticated" | `RoomController::showOwner` | `$request->user()` returns `null` |
| "Unauthenticated"        | `auth:sanctum` middleware   | Missing or invalid Bearer token   |

### System Errors (500)

| Error                             | Source                      | Condition                  |
| --------------------------------- | --------------------------- | -------------------------- |
| "Failed to retrieve room details" | `RoomController::showOwner` | Any exception during query |

### Edge Cases

| Case                   | Behavior                                                           |
| ---------------------- | ------------------------------------------------------------------ |
| User has no room       | Returns 200 with `data: null` and message "You do not have a room" |
| Token expired          | Returns 401 via Sanctum middleware                                 |
| Room soft-deleted      | `deleted_at IS NULL` filter excludes it; returns "no room"         |
| User relationship null | `whenLoaded('user')` returns empty for owner field                 |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER               MODEL                   DATABASE
   │                       │                       │                       │                        │
   │  GET /api/v1/rooms/myRoom                     │                       │                        │
   │  Authorization: Bearer {token}                │                       │                        │
   │──────────────────────▶│                       │                       │                        │
   │                       │                       │                       │                        │
   │                       │ 1. auth:sanctum       │                       │                        │
   │                       │    validate token     │                       │                        │
   │                       │───────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                       │                        │
   │                       │◀───────────────────────────────────────────────────────────────────────│
   │                       │    User instance      │                       │                        │
   │                       │                       │                       │                        │
   │                       │ 2. throttle:api_dynamic                       │                        │
   │                       │    check rate limit   │                       │                        │
   │                       │                       │                       │                        │
   │                       │ 3. Call showOwner()   │                       │                        │
   │                       │──────────────────────▶│                       │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 4. $request->user()   │                        │
   │                       │                       │    get auth user      │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 5. Room::where(...)   │                        │
   │                       │                       │    ->with(['user'])   │                        │
   │                       │                       │    ->first()          │                        │
   │                       │                       │──────────────────────▶│                        │
   │                       │                       │                       │                        │
   │                       │                       │                       │ 6. SELECT * FROM rooms │
   │                       │                       │                       │    WHERE user_id = ?   │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │                       │ 7. SELECT * FROM users │
   │                       │                       │                       │    WHERE id = ?        │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │◀──────────────────────│                        │
   │                       │                       │    Room + User        │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 8. new RoomResource() │                        │
   │                       │                       │    Transform room     │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 9. ApiResponse::success()                      │
   │                       │                       │    Build final JSON   │                        │
   │                       │                       │                       │                        │
   │                       │◀──────────────────────│                       │                        │
   │◀──────────────────────│                       │                       │                        │
   │                       │                       │                       │                        │
   │  200 OK + JSON        │                       │                       │                        │
   │  {status, message,    │                       │                       │                        │
   │   data: RoomResource} │                       │                       │                        │
   │                       │                       │                       │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                               |
| ----------------------------- | -------------------------------------- |
| New room field in response    | `RoomResource.php`                     |
| New owner fields in response  | `MinimalUserResource.php`              |
| Caching for room data         | `RoomController::showOwner` method     |
| Additional room relationships | `Room.php` model + eager load in query |
| Access control logic          | Add authorization check in controller  |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO ROOM RESPONSE

| Step  | File                                          | What to Change                             |
| ----- | --------------------------------------------- | ------------------------------------------ |
| **1** | **Database Migration**                        | Add column to `rooms` table                |
| **2** | `app/Models/Room/Room.php`                    | Add to `$fillable`, add to casts if needed |
| **3** | `app/Http/Resources/V1/Room/RoomResource.php` | Add field to `toArray()` return            |

Example - Adding `description` field:

```php
// 1. Migration
Schema::table('rooms', function (Blueprint $table) {
    $table->text('description')->nullable()->after('name');
});

// 2. Room.php - add to $fillable
protected $fillable = [
    // ... existing fields
    'description',
];

// 3. RoomResource.php - add to toArray()
return [
    // ... existing fields
    'description' => $room->description,
];
```

#### ➖ REMOVING A FIELD FROM ROOM RESPONSE

| Step  | File                                          | What to Change                                  |
| ----- | --------------------------------------------- | ----------------------------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomResource.php` | Remove from `toArray()` return                  |
| **2** | `app/Models/Room/Room.php`                    | Remove from `$fillable` (optional)              |
| **3** | **Database Migration**                        | Drop column (if safe, coordinate with frontend) |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW: rooms table → API Response              │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│   rooms table                                                               │
│       │                                                                     │
│       ▼                                                                     │
│   Room Model (app/Models/Room/Room.php)                                     │
│       │  $fillable, $casts, $hidden                                         │
│       │                                                                     │
│       ▼                                                                     │
│   RoomResource (app/Http/Resources/V1/Room/RoomResource.php)                │
│       │  toArray() transformation                                           │
│       │                                                                     │
│       ├──▶ Direct fields (id, name, logo, country, etc.)                    │
│       │                                                                     │
│       ├──▶ Computed fields (is_private, type_label)                         │
│       │                                                                     │
│       └──▶ Nested resource (owner → MinimalUserResource)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklist

- [ ] Check if field exists in database schema
- [ ] Verify field is in model's `$fillable` array
- [ ] If removing, ensure no frontend dependencies
- [ ] Update RoomResource to add/remove the field
- [ ] Test endpoint response includes/excludes field

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                                 |
| ---------------------------- | ------------------------------------------------------ |
| `ApiResponse` utility        | Used by all endpoints - changes affect entire API      |
| `BaseResource.with()` method | Alters metadata structure for all resources            |
| Room model `$hidden` array   | Password field must stay hidden for security           |
| `auth:sanctum` middleware    | Core authentication - misconfiguration breaks all auth |
| Route name (`rooms.my-room`) | May be used in frontend or other backend services      |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                           |
| ----------------------------------------- | ---------------------------------------------------- |
| Forgetting eager load causes N+1          | Always use `with(['user'])` when owner is needed     |
| Exposing hashed password                  | Password is in `$hidden` - never manually include    |
| Breaking RoomResource for other endpoints | Test all room endpoints after modifying RoomResource |
| Null user relationship                    | Use `whenLoaded('user')` for safe null handling      |
| Empty correlation_id                      | `ApiResponse` handles this automatically             |
| Missing rate limiting                     | Protected routes already have `throttle:api_dynamic` |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                    ← Route definition (line 38)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                                ← Controller (showOwner method)
app/Models/Room/
  └── Room.php                                          ← Room model
app/Http/Resources/V1/Room/
  └── RoomResource.php                                  ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                           ← Owner nested resource
app/Http/Resources/
  └── BaseResource.php                                  ← Resource parent class
app/Enums/Room/
  └── RoomType.php                                      ← Room type enum
app/Http/Utils/
  └── ApiResponse.php                                   ← Response utility
```

---

## Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/myRoom` |
| **Domain**          | Room                       |
| **Author**          | System Documentation       |
| **Created**         | 2026-01-30                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4                        |
