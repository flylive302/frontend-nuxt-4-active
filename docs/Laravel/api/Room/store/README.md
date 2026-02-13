# POST /api/v1/rooms

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

The Room Store endpoint allows authenticated users to create a new room (streaming/chat room). Each user can own only one room, and room names must be unique across the platform.

### Responsibilities

- Create a new room with validated data
- Enforce one-room-per-user business rule
- Enforce unique room name constraint
- Associate pre-uploaded ImageKit logo with room
- Hash passwords for private rooms automatically
- Dispatch `RoomCreated` event for downstream processing
- Return consistent API response with room data

### What It Owns

| Owned            | Description                                    |
| ---------------- | ---------------------------------------------- |
| Room creation    | Creates new `rooms` record in database         |
| Logo assignment  | Associates pre-uploaded ImageKit URL with room |
| Password hashing | Automatically hashes passwords via model cast  |

### External Dependencies

| Dependency   | Type           | Purpose                                   |
| ------------ | -------------- | ----------------------------------------- |
| PostgreSQL   | Database       | Primary data storage for rooms            |
| ImageKit     | Infrastructure | CDN for room logo storage (client upload) |
| Sanctum      | Package        | API token authentication                  |
| Spatie Roles | Package        | Permission checking (`rooms.create`)      |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/rooms
```

### Authentication

✅ **Required** - Requires valid Sanctum Bearer token

### Rate Limiting

| Limiter       | Key         | Config             |
| ------------- | ----------- | ------------------ |
| `api_dynamic` | `user:{id}` | Dynamic rate limit |

### Request Headers

| Header          | Required | Type               | Description         |
| --------------- | -------- | ------------------ | ------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format |
| `Accept`        | ✅       | `application/json` | Response format     |
| `Authorization` | ✅       | `Bearer {token}`   | Sanctum auth token  |

### Request Body Schema

```json
{
  "name": "string", // Required, 3-40 chars, alphanumeric with spaces/hyphens/underscores
  "type": "public|private", // Required, enum value
  "password": "string|null", // Required if type=private, 4-20 chars
  "country": "string", // Required, 2-letter ISO code (e.g., "US")
  "logo_url": "string|null", // Optional, must be ImageKit URL
  "logo_file_id": "string|null" // Required with logo_url, ImageKit file ID
}
```

#### Field Details

| Field          | Type     | Constraints                                          | Example                        |
| -------------- | -------- | ---------------------------------------------------- | ------------------------------ |
| `name`         | `string` | Required, 3-40 chars, regex: `/^[a-zA-Z0-9\s\-_]+$/` | `"My Cool Room"`               |
| `type`         | `string` | Required, enum: `public`, `private`                  | `"public"`                     |
| `password`     | `string` | Required if type=private, 4-20 chars                 | `"secretpass"`                 |
| `country`      | `string` | Required, 2-letter alpha, uppercased                 | `"US"`                         |
| `logo_url`     | `string` | Optional, valid URL, must match ImageKit endpoint    | `"https://ik.imagekit.io/..."` |
| `logo_file_id` | `string` | Required with logo_url, max 100 chars                | `"file_abc123"`                |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Room created successfully",
  "data": {
    "id": 1,
    "name": "My Cool Room",
    "logo": "https://ik.imagekit.io/flylive/rooms/logo.jpg",
    "type": "public",
    "type_label": "Public",
    "is_private": false,
    "country": "US",
    "is_live": false,
    "participant_count": 0,
    "room_xp": "0.0000",
    "current_level": 1,
    "max_seats": 10,
    "sort_order": 0,
    "created_at": "2026-01-30T12:00:00.000000Z",
    "owner_id": 123,
    "owner": {
      "id": 123,
      "name": "John Doe",
      "signature": "user123",
      "avatar": "https://...",
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
    "room_id": 1,
    "has_logo": true,
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "name": ["Room name is required."],
    "type": ["Room type must be either public or private."],
    "password": ["Password is required for private rooms."]
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Business Logic Error (400)

```json
{
  "status": "error",
  "message": "User already has a room",
  "data": null,
  "errors": {
    "room": ["You already have a room"]
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Authentication Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                               |
| ----- | ------------------------------------------------------- |
| `201` | Room created successfully                               |
| `400` | Business logic error (already has room, duplicate name) |
| `401` | Missing or invalid authentication token                 |
| `403` | User lacks `rooms.create` permission                    |
| `422` | Request validation failed                               |
| `500` | Unexpected server error                                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/rooms                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:42                                               │
│ Route: Route::post('/', [RoomController::class, 'store'])                   │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum     → Validates Bearer token, loads User model            │
│   2. throttle:api_dynamic → Rate limiting based on dynamic config           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED - Request Validation                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/CreateRoomRequest.php                   │
│                                                                             │
│ STEP 1: Prepare data for validation (prepareForValidation)                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($this->has('country')) {                                            │ │
│ │     $this->merge(['country' => strtoupper($this->input('country'))]);   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Apply validation rules                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name'      => required|string|min:3|max:40|regex|unique:rooms,name     │ │
│ │ 'type'      => required|string|Enum(RoomType)                           │ │
│ │ 'password'  => nullable|string|min:4|max:20|required_if:type,private    │ │
│ │ 'country'   => required|string|size:2|alpha                             │ │
│ │ 'logo_url'  => nullable|url|regex (ImageKit endpoint)                   │ │
│ │ 'logo_file_id' => nullable|string|max:100|required_with:logo_url        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If validation fails → 422 response with field-level errors                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:89-133            │
│ Method: store(CreateRoomRequest $request, CreateRoomAction $action)         │
│                                                                             │
│ STEP 1: Policy Authorization Check                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('create', Room::class);                                │ │
│ │ // Checks RoomPolicy::create() → $user->can('rooms.create')             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build DTO from validated data                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ $dto = CreateRoomDTO::fromArray($validated);                            │ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Extract logo data if provided                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $logoData = null;                                                       │ │
│ │ if (isset($validated['logo_url'])) {                                    │ │
│ │     $logoData = [                                                       │ │
│ │         'url' => $validated['logo_url'],                                │ │
│ │         'file_id' => $validated['logo_file_id'],                        │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Execute action and handle result                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($dto, $user, $logoData);                     │ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(..., 400);                                │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(new RoomResource($result->data), ..., 201); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 ACTION LAYER (Business Logic)                                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Room/CreateRoomAction.php:29-104                          │
│ Method: execute(CreateRoomDTO $dto, User $user, ?array $logoData)           │
│                                                                             │
│ All operations wrapped in DB::transaction()                                 │
│                                                                             │
│ STEP 1: Check if user already has a room                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $existingRoom = Room::where('user_id', $user->id)->first();             │ │
│ │ if ($existingRoom !== null) {                                           │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errors: ['room' => ['You already have a room']],                │ │
│ │         message: 'User already has a room'                              │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if room name already exists                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (Room::where('name', $dto->name)->exists()) {                        │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errors: ['name' => ['This room name is already taken']],        │ │
│ │         message: 'Room name already exists'                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Build model data and add logo if provided                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = $dto->toModelArray();         // name, country, type, password  │ │
│ │ $data['user_id'] = $user->id;                                           │ │
│ │ if ($logoData !== null) {                                               │ │
│ │     $data['logo'] = $logoData['url'];                                   │ │
│ │     $data['logo_file_id'] = $logoData['file_id'];                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Create room and load relationships                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::create($data);    // Password auto-hashed via 'hashed' cast│
│ │ $room->load('user');                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Dispatch RoomCreated event                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ event(new RoomCreated(                                                  │ │
│ │     room: $room,                                                        │ │
│ │     actor: Auth::check() ? Auth::user() : $user,                        │ │
│ │     roomData: $dto->toArray()                                           │ │
│ │ ));                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Log success and return result                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: $room,                                                        │ │
│ │     message: 'Room created successfully',                               │ │
│ │     meta: ['room_id' => $room->id, 'has_logo' => $room->logo !== null]  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CreateRoomDTO (Data Transfer Object)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Room/CreateRoomDTO.php                                   │ │
│ │ Responsibility: Type-safe data container for room creation              │ │
│ │ Reusable: YES (same DTO for API, admin, seeding)                        │ │
│ │ Why It Exists: Decouples validation from business logic                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray() → Creates DTO with RoomType enum conversion             │ │
│ │   • toModelArray() → Returns data ready for Eloquent (uppercase country)│ │
│ │   • toArray() → Returns data for event payload                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomPolicy (Authorization)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Room/RoomPolicy.php                                  │ │
│ │ Responsibility: Centralized room access control                         │ │
│ │ Reusable: YES (used by all room endpoints)                              │ │
│ │ Why It Exists: Single source of truth for room permissions              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • create($user) → $user->can('rooms.create')                          │ │
│ │   • update($user, $room) → Owner check OR 'rooms.edit' permission       │ │
│ │   • delete($user, $room) → Owner check OR 'rooms.delete' permission     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Wrapper)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action result with success/failure states  │ │
│ │ Reusable: YES (used by all Action classes)                              │ │
│ │ Why It Exists: Consistent error handling without exceptions             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta) → Success result                    │ │
│ │   • failure($errors, $message) → Failure with structured errors         │ │
│ │   • isFailure() → Check if operation failed                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomType (Enum)                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomType.php                                       │ │
│ │ Responsibility: Type-safe room visibility enum                          │ │
│ │ Reusable: YES (used in DTOs, models, validation, resources)             │ │
│ │ Why It Exists: Eliminates magic strings for room types                  │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PUBLIC = 'public'                                                   │ │
│ │   • PRIVATE = 'private'                                                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable label ("Public", "Private")                │ │
│ │   • requiresPassword() → Returns true for PRIVATE                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomCreated (Event)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Events/Room/RoomCreated.php                                   │ │
│ │ Responsibility: Domain event for room creation                          │ │
│ │ Reusable: NO (specific to room creation)                                │ │
│ │ Why It Exists: Decouples side effects (notifications, analytics, etc.)  │ │
│ │                                                                         │ │
│ │ Payload:                                                                │ │
│ │   • room → The created Room model                                       │ │
│ │   • actor → User who created the room                                   │ │
│ │   • roomData → Original creation data array                             │ │
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
│ 1. [SELECT]: Check if user already has a room                               │
│    Query: SELECT * FROM rooms WHERE user_id = ? LIMIT 1                     │
│    Source: CreateRoomAction::execute()                                      │
│                                                                             │
│ 2. [SELECT]: Check if room name already exists                              │
│    Query: SELECT EXISTS(SELECT 1 FROM rooms WHERE name = ?)                 │
│    Source: CreateRoomAction::execute()                                      │
│                                                                             │
│ 3. [INSERT]: Create new room record                                         │
│    Query: INSERT INTO rooms (user_id, name, type, country, password,        │
│           logo, logo_file_id, ...) VALUES (?, ?, ?, ?, ?, ?, ?, ...)        │
│    Source: Room::create($data)                                              │
│    Note: Password is auto-hashed via 'hashed' cast                          │
│                                                                             │
│ 4. [SELECT]: Load owner relationship                                        │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $room->load('user')                                              │
│                                                                             │
│ All wrapped in: DB::transaction()                                           │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None (RoomCreated event is synchronous)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Room/RoomResource.php                           │
│                                                                             │
│ STEP 1: Transform Room model to array                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $room->id,                                                  │ │
│ │     'name' => $room->name,                                              │ │
│ │     'logo' => $room->logo,            // Single URL, frontend transforms │
│ │     'type' => $room->type,            // RoomType enum serialized       │ │
│ │     'type_label' => $room->type->label(),                               │ │
│ │     'is_private' => $room->isPrivate(),                                 │ │
│ │     'country' => $room->country,                                        │ │
│ │     'is_live' => $room->is_live,      // false for new rooms            │ │
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
│ STEP 2: Wrap in ApiResponse::success() with 201 status                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomResource($result->data),                                    │ │
│ │     $result->message ?? 'Room created successfully',                    │ │
│ │     $result->meta ?? [],                                                │ │
│ │     201                                                                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│ Adds: status, message, data, meta (timestamp, correlation_id)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    201 Created + JSON Body                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                      | Used By Endpoints              | Reusable | Reasoning                                     |
| ------------------------- | ------------------------------ | -------- | --------------------------------------------- |
| `CreateRoomRequest.php`   | POST /rooms                    | ❌       | Specific to room creation validation          |
| `CreateRoomDTO.php`       | POST /rooms, admin, seeders    | ✅       | Generic data container for room creation      |
| `CreateRoomAction.php`    | POST /rooms, admin panel       | ✅       | Encapsulates all room creation business logic |
| `RoomController.php`      | All /rooms/\* endpoints        | ⭕       | Contains all room CRUD methods                |
| `RoomResource.php`        | All room endpoints             | ✅       | Consistent room serialization                 |
| `MinimalUserResource.php` | Room, RoomMember, Agency, etc. | ✅       | Lightweight user for nested references        |
| `RoomPolicy.php`          | All room endpoints             | ✅       | Centralized room authorization                |
| `ActionResult.php`        | All Action classes             | ✅       | Application-wide result pattern               |
| `ApiResponse.php`         | All API endpoints              | ✅       | Consistent response envelope                  |
| `Room.php` (Model)        | All room-related code          | ✅       | Core Eloquent model                           |
| `RoomType.php` (Enum)     | All room-related code          | ✅       | Type-safe room visibility values              |
| `RoomCreated.php` (Event) | POST /rooms                    | ❌       | Specific to room creation event               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                        | Source              | Condition                                  |
| ---------------------------- | ------------------- | ------------------------------------------ |
| `name.required`              | `CreateRoomRequest` | Name field missing                         |
| `name.min`                   | `CreateRoomRequest` | Name less than 3 characters                |
| `name.max`                   | `CreateRoomRequest` | Name exceeds 40 characters                 |
| `name.regex`                 | `CreateRoomRequest` | Name contains invalid characters           |
| `name.unique`                | `CreateRoomRequest` | Room name already exists (validation rule) |
| `type.required`              | `CreateRoomRequest` | Type field missing                         |
| `type.Enum`                  | `CreateRoomRequest` | Type not 'public' or 'private'             |
| `password.required_if`       | `CreateRoomRequest` | Private room without password              |
| `password.min`               | `CreateRoomRequest` | Password less than 4 characters            |
| `password.max`               | `CreateRoomRequest` | Password exceeds 20 characters             |
| `country.required`           | `CreateRoomRequest` | Country field missing                      |
| `country.size`               | `CreateRoomRequest` | Country not exactly 2 characters           |
| `country.alpha`              | `CreateRoomRequest` | Country contains non-alphabetic chars      |
| `logo_url.url`               | `CreateRoomRequest` | Logo URL is not valid URL format           |
| `logo_url.regex`             | `CreateRoomRequest` | Logo not from ImageKit CDN                 |
| `logo_file_id.required_with` | `CreateRoomRequest` | Logo URL provided without file ID          |

### Business Logic Errors (400)

| Error                      | Source             | Condition                         |
| -------------------------- | ------------------ | --------------------------------- |
| "User already has a room"  | `CreateRoomAction` | User already owns a room          |
| "Room name already exists" | `CreateRoomAction` | Another room has same name (race) |

### Authorization Errors (403)

| Error                          | Source       | Condition                            |
| ------------------------------ | ------------ | ------------------------------------ |
| "This action is unauthorized." | `RoomPolicy` | User lacks `rooms.create` permission |

### System Errors (500)

| Error                             | Source             | Condition                   |
| --------------------------------- | ------------------ | --------------------------- |
| "An unexpected error occurred..." | `CreateRoomAction` | Database failure, exception |

### Edge Cases

| Case                             | Behavior                                    |
| -------------------------------- | ------------------------------------------- |
| User not authenticated           | 401 before reaching controller              |
| Token expired                    | 401 with "Unauthenticated" message          |
| Concurrent room creation         | DB unique constraint fails → 400 error      |
| Logo URL from wrong CDN          | 422 validation error                        |
| Public room with password        | Password stored but not required for access |
| Country lowercase input          | Auto-uppercased in prepareForValidation     |
| Empty logo_file_id with logo_url | 422 "Logo file ID is required..."           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                 MIDDLEWARE               CONTROLLER              ACTION                  DATABASE
   │                        │                        │                      │                        │
   │  POST /api/v1/rooms    │                        │                      │                        │
   │  + Bearer Token        │                        │                      │                        │
   │───────────────────────▶│                        │                      │                        │
   │                        │                        │                      │                        │
   │                        │ 1. auth:sanctum        │                      │                        │
   │                        │   validate token       │                      │                        │
   │                        │ 2. throttle:api_dynamic│                      │                        │
   │                        │   check rate limit     │                      │                        │
   │                        │                        │                      │                        │
   │                        │ 3. CreateRoomRequest   │                      │                        │
   │                        │   validate body        │                      │                        │
   │                        │────────────────────────▶                      │                        │
   │                        │                        │                      │                        │
   │                        │                        │ 4. authorize('create')                        │
   │                        │                        │ → RoomPolicy::create()                        │
   │                        │                        │                      │                        │
   │                        │                        │ 5. Build DTO          │                        │
   │                        │                        │ 6. Extract logo data  │                        │
   │                        │                        │                      │                        │
   │                        │                        │ 7. $action->execute() │                        │
   │                        │                        │─────────────────────▶│                        │
   │                        │                        │                      │                        │
   │                        │                        │                      │ 8. DB::transaction()   │
   │                        │                        │                      │─────────────────────────▶
   │                        │                        │                      │                        │
   │                        │                        │                      │ 9. SELECT existing room │
   │                        │                        │                      │◀─────────────────────────
   │                        │                        │                      │                        │
   │                        │                        │                      │ 10. SELECT name exists  │
   │                        │                        │                      │◀─────────────────────────
   │                        │                        │                      │                        │
   │                        │                        │                      │ 11. INSERT room        │
   │                        │                        │                      │    (password hashed)   │
   │                        │                        │                      │─────────────────────────▶
   │                        │                        │                      │◀─────────────────────────
   │                        │                        │                      │                        │
   │                        │                        │                      │ 12. SELECT owner       │
   │                        │                        │                      │    ($room->load)       │
   │                        │                        │                      │─────────────────────────▶
   │                        │                        │                      │◀─────────────────────────
   │                        │                        │                      │                        │
   │                        │                        │                      │ 13. COMMIT transaction │
   │                        │                        │                      │─────────────────────────▶
   │                        │                        │                      │                        │
   │                        │                        │                      │ 14. event(RoomCreated) │
   │                        │                        │                      │                        │
   │                        │                        │ 15. ActionResult      │                        │
   │                        │                        │◀─────────────────────│                        │
   │                        │                        │                      │                        │
   │                        │                        │ 16. RoomResource      │                        │
   │                        │                        │ 17. ApiResponse::success(201)                 │
   │                        │                        │                      │                        │
   │                        │◀───────────────────────│                      │                        │
   │◀───────────────────────│                        │                      │                        │
   │                        │                        │                      │                        │
   │  201 Created + JSON    │                        │                      │                        │
   │                        │                        │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location(s)                                      |
| ------------------------- | ------------------------------------------------ |
| New validation rule       | `CreateRoomRequest::rules()`                     |
| New room field            | See Field Modification Guide below               |
| Custom creation logic     | `CreateRoomAction::execute()` inside transaction |
| Post-creation side effect | Create listener for `RoomCreated` event          |
| New room type             | `RoomType` enum + validation + DTO handling      |
| Permission check          | `RoomPolicy::create()`                           |
| Response modification     | `RoomResource::toArray()`                        |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `description`)

| Step  | File                                                  | What to Change                                                        |
| ----- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| **1** | **Database Migration**                                | Add column: `$table->text('description')->nullable();`                |
| **2** | `app/Models/Room/Room.php`                            | Add `'description'` to `$fillable`                                    |
| **3** | `app/Http/Requests/Api/V1/Room/CreateRoomRequest.php` | Add validation: `'description' => ['nullable', 'string', 'max:1000']` |
| **4** | `app/DTOs/Room/CreateRoomDTO.php`                     | Add constructor param + `toModelArray()`                              |
| **5** | `app/Http/Resources/V1/Room/RoomResource.php`         | Add `'description' => $room->description`                             |

#### ➖ REMOVING A FIELD (e.g., `logo_file_id`)

| Step  | File                                                  | What to Change                     |
| ----- | ----------------------------------------------------- | ---------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/CreateRoomRequest.php` | Remove validation rule             |
| **2** | `app/Http/Controllers/Api/V1/Room/RoomController.php` | Remove from `$logoData` extraction |
| **3** | `app/Actions/Room/CreateRoomAction.php`               | Remove from `$data` assignment     |
| **4** | `app/Models/Room/Room.php`                            | Remove from `$fillable`            |
| **5** | **Database Migration**                                | Drop column (if safe)              |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ CreateRoomRequest│────▶│   CreateRoomDTO  │────▶│CreateRoomAction  │
│ (validation)     │     │ (fromArray)      │     │ (toModelArray)   │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                                                           ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   RoomResource   │◀────│    Room Model    │◀────│  Room::create()  │
│ (to response)    │     │ ($fillable)      │     │ (database)       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### 📋 Field Modification Checklists

**Before deploying new field:**

- [ ] Migration created and tested
- [ ] Model `$fillable` updated
- [ ] DTO property added
- [ ] Request validation added
- [ ] Resource output includes field
- [ ] API documentation updated

### ⚠️ What Should NOT Be Modified Casually

| Component               | Reason                                      |
| ----------------------- | ------------------------------------------- |
| `DB::transaction()`     | Ensures atomicity of room creation          |
| Unique name check       | Race condition protection (duplicate rooms) |
| One-room-per-user check | Core business rule                          |
| `password` => 'hashed'  | Security: passwords must be hashed          |
| `RoomCreated` event     | Downstream listeners depend on it           |
| Policy authorization    | Security boundary - permission enforcement  |
| `ApiResponse` wrapper   | Consistent API contract expected by clients |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                            |
| --------------------------------- | ----------------------------------------------------- |
| Forgetting to update `$fillable`  | Mass assignment silently ignores new fields           |
| Adding required field without DTO | DTO::fromArray() will throw exception                 |
| Not wrapping in transaction       | Partial data on failure                               |
| Duplicate unique validation       | Request AND Action both check - trust Action for race |
| Hardcoding room type strings      | Always use `RoomType` enum                            |
| Not loading 'user' relationship   | Resource throws null reference on `owner`             |
| Skipping permission check         | Security vulnerability                                |
| Logo without file_id              | Can't delete from ImageKit later                      |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                  ← Route definition (line 42)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                              ← Controller (store method)
app/Http/Requests/Api/V1/Room/
  └── CreateRoomRequest.php                           ← Request validation
app/DTOs/Room/
  └── CreateRoomDTO.php                               ← Data transfer object
app/Actions/Room/
  └── CreateRoomAction.php                            ← Business logic
app/Policies/Room/
  └── RoomPolicy.php                                  ← Authorization (create method)
app/Models/Room/
  └── Room.php                                        ← Eloquent model
app/Enums/Room/
  └── RoomType.php                                    ← Room visibility enum
app/Events/Room/
  └── RoomCreated.php                                 ← Domain event
app/Http/Resources/V1/Room/
  └── RoomResource.php                                ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                         ← Owner resource
app/Actions/
  └── ActionResult.php                                ← Action result wrapper
app/Http/Utils/
  └── ApiResponse.php                                 ← Response utility
```

---

## Document Metadata

| Property            | Value                |
| ------------------- | -------------------- |
| **Endpoint**        | `POST /api/v1/rooms` |
| **Domain**          | Room                 |
| **Author**          | System Documentation |
| **Created**         | 2026-01-30           |
| **Laravel Version** | 12.x                 |
| **PHP Version**     | 8.4                  |
