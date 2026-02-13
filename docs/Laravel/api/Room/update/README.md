# PUT/PATCH /api/v1/rooms/{room}

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

The Room Update endpoint handles updating an existing room's properties, including name, type (public/private), password, country, and logo.

### Responsibilities

- Validate room update data with support for partial updates
- Authorize that the current user owns the room or has `rooms.edit` permission
- Handle logo updates via pre-uploaded ImageKit URLs
- Delete old logos from ImageKit when replaced
- Dispatch `RoomUpdated` event for real-time updates and auditing

### What It Owns

| Owned                 | Description                                           |
| --------------------- | ----------------------------------------------------- |
| Room record updates   | Updates room properties in `rooms` table              |
| Logo replacement      | Deletes old logo from ImageKit and stores new URL     |
| Room type transitions | Handles public→private (adds password) and vice versa |

### External Dependencies

| Dependency | Type           | Purpose                                   |
| ---------- | -------------- | ----------------------------------------- |
| PostgreSQL | Database       | Primary storage for room data             |
| ImageKit   | Infrastructure | Logo storage and CDN                      |
| Redis      | Infrastructure | Cache invalidation for logo URLs          |
| Events     | Internal       | Dispatches `RoomUpdated` for broadcasting |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/rooms/{room}
PATCH /api/v1/rooms/{room}
```

Both methods behave identically, supporting partial updates.

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter       | Key             | Config                     |
| ------------- | --------------- | -------------------------- |
| `api_dynamic` | User ID + Route | `config/rate_limiting.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description       |
| --------- | --------- | ----------------- |
| `room`    | `integer` | Room ID to update |

### Request Body Schema

```json
{
  "name": "string", // Optional, 3-40 chars, alphanumeric + spaces/hyphens/underscores
  "type": "string", // Optional, "public" or "private"
  "password": "string|null", // Optional, 4-20 chars, required when type is "private"
  "country": "string", // Optional, 2-letter ISO country code (e.g., "US")
  "logo_url": "url|null", // Optional, ImageKit CDN URL
  "logo_file_id": "string" // Required with logo_url, ImageKit file ID for deletion
}
```

#### Field Details

| Field          | Type     | Constraints                                                  | Example                                 |
| -------------- | -------- | ------------------------------------------------------------ | --------------------------------------- |
| `name`         | `string` | Optional, 3-40 chars, regex: `/^[a-zA-Z0-9\s\-_]+$/`, unique | `"Gaming Hub"`                          |
| `type`         | `string` | Optional, enum: `public`, `private`                          | `"private"`                             |
| `password`     | `string` | Optional, 4-20 chars, required if type=private               | `"secret123"`                           |
| `country`      | `string` | Optional, 2 chars, alpha only                                | `"US"`                                  |
| `logo_url`     | `url`    | Optional, must match ImageKit URL endpoint                   | `"https://ik.imagekit.io/.../logo.png"` |
| `logo_file_id` | `string` | Required with logo_url, max 100 chars                        | `"6478abc123def"`                       |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Room updated successfully",
  "data": {
    "id": 1,
    "name": "Gaming Hub",
    "logo": "https://ik.imagekit.io/.../logo.png",
    "type": "private",
    "type_label": "Private",
    "is_private": true,
    "country": "US",
    "is_live": false,
    "participant_count": 0,
    "room_xp": "0.0000",
    "current_level": 1,
    "max_seats": 8,
    "sort_order": 0,
    "created_at": "2026-01-30T10:00:00.000000Z",
    "owner_id": 5,
    "owner": {
      "id": 5,
      "name": "John Doe",
      "signature": "ABC123",
      "avatar": "https://...",
      "frame": null,
      "current_level": 1,
      "country": "US",
      "is_live": false
    }
  },
  "meta": {
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
    "name": ["Room name must be at least 3 characters."],
    "password": ["Password is required for private rooms."]
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
  "errors": {},
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
  "message": "Room name already exists",
  "data": null,
  "errors": {
    "name": ["This room name is already taken"]
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Resource not found",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                       |
| ----- | ----------------------------------------------- |
| `200` | Room updated successfully                       |
| `400` | Business logic error (e.g., duplicate name)     |
| `401` | Unauthenticated (no valid token)                |
| `403` | Unauthorized (not owner and lacking permission) |
| `404` | Room not found or soft-deleted                  |
| `422` | Validation error                                |
| `429` | Rate limit exceeded                             |
| `500` | Server error (database, ImageKit API failure)   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                PUT/PATCH /api/v1/rooms/{room}                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:45                                               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::match(['put', 'patch'], '/{room}', [RoomController::class,       │ │
│ │     'update'])->name('update');                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum     → Validates Sanctum Bearer token                      │
│   2. throttle:api_dynamic → Rate limiting based on user ID                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/UpdateRoomRequest.php                   │
│                                                                             │
│ STEP 1: Prepare for Validation (prepareForValidation)                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Normalize country to uppercase                                       │ │
│ │ if ($this->has('country')) {                                            │ │
│ │     $this->merge(['country' => strtoupper($this->input('country'))]);   │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Normalize empty password strings to null                             │ │
│ │ if ($this->has('password') && $this->input('password') === '') {        │ │
│ │     $this->merge(['password' => null]);                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validation Rules                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name'         => ['sometimes', 'string', 'min:3', 'max:40',            │ │
│ │                    'regex:/^[a-zA-Z0-9\s\-_]+$/',                        │ │
│ │                    Rule::unique('rooms', 'name')->ignore($room)],       │ │
│ │ 'type'         => ['sometimes', 'string', new Enum(RoomType::class)],   │ │
│ │ 'password'     => ['nullable', 'string', 'min:4', 'max:20',             │ │
│ │                    'required_if:type,private'],                         │ │
│ │ 'country'      => ['sometimes', 'string', 'size:2', 'alpha'],           │ │
│ │ 'logo_url'     => ['nullable', 'url', 'regex:' . $urlPattern],          │ │
│ │ 'logo_file_id' => ['nullable', 'string', 'max:100',                     │ │
│ │                    'required_with:logo_url'],                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Features:                                                               │
│   • All fields use 'sometimes' → partial updates supported                  │
│   • Name uniqueness ignores current room (allows keeping same name)         │
│   • Password required only when type=private                                │
│   • logo_url must match ImageKit URL endpoint pattern                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:189-233           │
│ Method: update(UpdateRoomRequest $request, Room $room, UpdateRoomAction)    │
│                                                                             │
│ STEP 1: Authorization Check                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('update', $room);                                      │ │
│ │                                                                         │ │
│ │ // RoomPolicy::update() checks:                                         │ │
│ │ // - User is room owner ($user->id === $room->user_id)                  │ │
│ │ // - OR user has 'rooms.edit' permission                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build DTO from Validated Data                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ $dto = UpdateRoomDTO::fromArray($validated);                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Extract Logo Data (if provided)                                     │
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
│ STEP 4: Execute Action & Return Response                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($room, $dto, $logoData);                     │ │
│ │                                                                         │ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->message ?? 'Failed to update room',                    │ │
│ │         $result->errors ?? [],                                          │ │
│ │         400                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new RoomResource($result->data),                                    │ │
│ │     $result->message ?? 'Room updated successfully'                     │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ACTION: UpdateRoomAction                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/Room/UpdateRoomAction.php                             │ │
│ │ Responsibility: Orchestrate room update with logo handling              │ │
│ │ Reusable: YES (can be called from CLI commands, jobs, etc.)             │ │
│ │                                                                         │ │
│ │ Key Operations (inside DB::transaction):                                │ │
│ │                                                                         │ │
│ │ 1. Store original values for event tracking                             │ │
│ │    $originalValues = $room->getOriginal();                              │ │
│ │                                                                         │ │
│ │ 2. Check for duplicate name (if name changed)                           │ │
│ │    if ($dto->name !== null && $dto->name !== $room->name) {             │ │
│ │        if (Room::where('name', $dto->name)                              │ │
│ │                ->where('id', '!=', $room->id)->exists()) {              │ │
│ │            return ActionResult::failure(['name' => [...]]);             │ │
│ │        }                                                                │ │
│ │    }                                                                    │ │
│ │                                                                         │ │
│ │ 3. Build update data from DTO                                           │ │
│ │    $updateData = $dto->toModelArray();                                  │ │
│ │                                                                         │ │
│ │ 4. Handle logo update if provided                                       │ │
│ │    if ($logoData !== null) {                                            │ │
│ │        if ($room->logo !== null) {                                      │ │
│ │            $this->roomLogoService->deleteLogo($room);                   │ │
│ │        }                                                                │ │
│ │        $updateData['logo'] = $logoData['url'];                          │ │
│ │        $updateData['logo_file_id'] = $logoData['file_id'];              │ │
│ │    }                                                                    │ │
│ │                                                                         │ │
│ │ 5. Update room if changes exist                                         │ │
│ │    if ($updateData !== [] || $logoData !== null) {                      │ │
│ │        $room->update($updateData);                                      │ │
│ │        $room->refresh();                                                │ │
│ │    }                                                                    │ │
│ │                                                                         │ │
│ │ 6. Load relationships for response                                      │ │
│ │    $room->load('user');                                                 │ │
│ │                                                                         │ │
│ │ 7. Dispatch RoomUpdated event                                           │ │
│ │    event(new RoomUpdated($room, $actor, $changes, $originalValues));    │ │
│ │                                                                         │ │
│ │ 8. Return success result with updated room                              │ │
│ │    return ActionResult::success($room, 'Room updated successfully');    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SERVICE: RoomLogoService                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomLogoService.php                             │ │
│ │ Responsibility: Logo deletion and cache management                      │ │
│ │ Reusable: YES (used by create, update, delete actions)                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deleteLogo(Room $room) → Deletes from ImageKit, clears DB fields    │ │
│ │   • invalidateCache(Room $room) → Clears logo cache in Redis            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UpdateRoomDTO (Data Transfer Object)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Room/UpdateRoomDTO.php                                   │ │
│ │ Responsibility: Type-safe data container for room updates              │ │
│ │ Reusable: YES (can be instantiated from arrays, requests, etc.)        │ │
│ │ Why It Exists: Decouples request validation from business logic         │ │
│ │                                                                         │ │
│ │ Properties (all nullable for partial updates):                          │ │
│ │   • name: ?string                                                       │ │
│ │   • country: ?string                                                    │ │
│ │   • type: ?RoomType (enum)                                              │ │
│ │   • password: ?string                                                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray(array $data) → Creates DTO with type coercion             │ │
│ │   • toModelArray() → Returns only non-null values for update            │ │
│ │   • hasChanges() → Checks if any field has a value to update            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomPolicy (Authorization)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Room/RoomPolicy.php                                  │ │
│ │ Responsibility: Determine if user can update room                       │ │
│ │ Reusable: YES (used by all room actions)                                │ │
│ │                                                                         │ │
│ │ update(User $user, Room $room): bool                                    │ │
│ │   return $this->isOwner($user, $room) || $user->can('rooms.edit');      │ │
│ │                                                                         │ │
│ │ isOwner(): checks $user->id === $room->user_id                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized success/failure returns from actions       │ │
│ │ Reusable: YES (used by all actions in the system)                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta) → Success result                    │ │
│ │   • failure($errors, $message) → Failure result                         │ │
│ │   • fromException($e, $message) → Exception to failure                  │ │
│ │   • isSuccess() / isFailure() → Check outcome                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Room Model                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Eloquent model with casts and relationships             │ │
│ │                                                                         │ │
│ │ Key Cast:                                                               │ │
│ │   'password' => 'hashed'  ← Auto-hashes password on save                │ │
│ │   'type' => RoomType::class  ← Enum casting                             │ │
│ │                                                                         │ │
│ │ $hidden = ['password'] ← Never exposed in responses                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomUpdated Event                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Events/Room/RoomUpdated.php                                   │ │
│ │ Responsibility: Broadcast room changes for real-time updates            │ │
│ │ Reusable: N/A (event specific to room updates)                          │ │
│ │                                                                         │ │
│ │ Payload includes:                                                       │ │
│ │   • room: Updated room model                                            │ │
│ │   • actor: User who made the change                                     │ │
│ │   • changes: Array of changed field names                               │ │
│ │   • original: Original values before update                             │ │
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
│ 1. [SELECT]: Route Model Binding - Load room by ID                          │
│    Query: SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL           │
│    Source: Laravel Route Model Binding (implicit)                           │
│                                                                             │
│ 2. [SELECT]: Check for duplicate name (if name changed)                     │
│    Query: SELECT EXISTS(SELECT 1 FROM rooms WHERE name = ? AND id != ?)     │
│    Source: UpdateRoomAction::execute()                                      │
│                                                                             │
│ 3. [UPDATE]: Update room record                                             │
│    Query: UPDATE rooms SET name=?, type=?, password=?, ... WHERE id = ?     │
│    Source: Room::update() inside transaction                                │
│                                                                             │
│ 4. [SELECT]: Refresh room after update                                      │
│    Query: SELECT * FROM rooms WHERE id = ?                                  │
│    Source: $room->refresh()                                                 │
│                                                                             │
│ 5. [SELECT]: Load owner relationship                                        │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $room->load('user')                                              │
│                                                                             │
│ CACHE OPERATIONS (when logo changes):                                       │
│                                                                             │
│ 1. [DELETE]: Invalidate room logo cache                                     │
│    Key: room:{room_id}:logo                                                 │
│    Source: RoomLogoService::invalidateCache()                               │
│                                                                             │
│ 2. [FLUSH TAGS]: Flush room tag cache                                       │
│    Tags: ["room:{room_id}"]                                                 │
│    Source: CacheService::safeFlushTags()                                    │
│                                                                             │
│ EXTERNAL API CALLS (when logo replaced):                                    │
│                                                                             │
│ 1. [DELETE]: Delete old logo from ImageKit                                  │
│    API: DELETE imagekit.io/v1/files/{file_id}                               │
│    Source: ImageKitService::deleteFile()                                    │
│                                                                             │
│ 2. [PURGE]: Purge old logo from ImageKit CDN cache                          │
│    API: POST imagekit.io/v1/files/purge                                     │
│    Source: ImageKitService::purgeCache()                                    │
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
│ │     'logo' => $room->logo,  // Single URL, frontend handles transforms  │ │
│ │     'type' => $room->type,  // Enum value ("public" or "private")       │ │
│ │     'type_label' => $room->type->label(),  // Human-readable            │ │
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
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Room updated successfully',                           │ │
│ │     'data' => $roomResourceArray,                                       │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $request->header('X-Correlation-ID')        │ │
│ │                             ?? Str::uuid()->toString(),                 │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                        200 OK + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                      | Used By Endpoints                          | Reusable | Reasoning                                         |
| ------------------------- | ------------------------------------------ | -------- | ------------------------------------------------- |
| `UpdateRoomRequest.php`   | PUT/PATCH rooms/{room}                     | ❌       | Specific validation for room updates              |
| `UpdateRoomDTO.php`       | PUT/PATCH rooms/{room}, CLI commands       | ✅       | Can be instantiated from any data source          |
| `UpdateRoomAction.php`    | PUT/PATCH rooms/{room}, CLI, Jobs          | ✅       | Encapsulated business logic, framework-agnostic   |
| `RoomController.php`      | All room CRUD endpoints                    | ⭕       | Controller-specific, but `update` method isolated |
| `RoomPolicy.php`          | All room endpoints requiring authorization | ✅       | Centralized room authorization                    |
| `RoomResource.php`        | All endpoints returning room data          | ✅       | Standard room response transformer                |
| `MinimalUserResource.php` | All endpoints returning embedded user      | ✅       | Lightweight user representation                   |
| `RoomLogoService.php`     | Create, Update, Delete room                | ✅       | Centralized logo management                       |
| `ActionResult.php`        | All Action classes                         | ✅       | Framework-wide result pattern                     |
| `ApiResponse.php`         | All API endpoints                          | ✅       | Standardized JSON response formatting             |
| `Room.php` (Model)        | All room-related code                      | ✅       | Core Eloquent model                               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                        | Source              | Condition                              |
| ---------------------------- | ------------------- | -------------------------------------- |
| `name.min`                   | `UpdateRoomRequest` | Name less than 3 characters            |
| `name.max`                   | `UpdateRoomRequest` | Name exceeds 40 characters             |
| `name.regex`                 | `UpdateRoomRequest` | Name contains invalid characters       |
| `name.unique`                | `UpdateRoomRequest` | Name already taken by another room     |
| `type.Enum`                  | `UpdateRoomRequest` | Type not "public" or "private"         |
| `password.required_if`       | `UpdateRoomRequest` | Missing password when type=private     |
| `password.min`               | `UpdateRoomRequest` | Password less than 4 characters        |
| `password.max`               | `UpdateRoomRequest` | Password exceeds 20 characters         |
| `country.size`               | `UpdateRoomRequest` | Country not exactly 2 characters       |
| `country.alpha`              | `UpdateRoomRequest` | Country contains non-alpha characters  |
| `logo_url.url`               | `UpdateRoomRequest` | Logo URL is malformed                  |
| `logo_url.regex`             | `UpdateRoomRequest` | Logo URL not from ImageKit CDN         |
| `logo_file_id.required_with` | `UpdateRoomRequest` | Missing file ID when logo_url provided |

### Business Logic Errors (400)

| Error                      | Source             | Condition                                     |
| -------------------------- | ------------------ | --------------------------------------------- |
| "Room name already exists" | `UpdateRoomAction` | Race condition: name taken between validation |

### Authorization Errors (403)

| Error                          | Source       | Condition                                   |
| ------------------------------ | ------------ | ------------------------------------------- |
| "This action is unauthorized." | `RoomPolicy` | Not owner AND lacks `rooms.edit` permission |

### System Errors (500)

| Error                                            | Source             | Condition            |
| ------------------------------------------------ | ------------------ | -------------------- |
| "An unexpected error occurred while updating..." | `UpdateRoomAction` | Database exception   |
| "Failed to delete room logo"                     | `RoomLogoService`  | ImageKit API failure |

### Edge Cases

| Case                                | Behavior                                                |
| ----------------------------------- | ------------------------------------------------------- |
| Empty request body `{}`             | Success with no changes, event still dispatched         |
| Only password field sent            | Password updated, other fields unchanged                |
| `password: ""` (empty string)       | Normalized to `null`, ignored in update                 |
| Type changed from private to public | Password still stored (not auto-cleared)                |
| Logo replaced with new one          | Old logo deleted from ImageKit, new URL stored          |
| Updating with same values           | `$changes` array is empty, event still dispatched       |
| Room soft-deleted                   | 404 from route model binding                            |
| Concurrent update race condition    | Last write wins, name uniqueness checked in transaction |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/CACHE/IMAGEKIT
   │                       │                       │                       │                            │
   │ PUT /rooms/{room}     │                       │                       │                            │
   │ {name: "New Name"}    │                       │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │    validate token     │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 2. Route Model Binding│                            │
   │                       │                       │───────────────────────────────────────────────────▶│
   │                       │                       │                       │        SELECT room         │
   │                       │                       │◀──────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │ 3. UpdateRoomRequest  │                            │
   │                       │                       │    validation         │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 4. RoomPolicy::update │                            │
   │                       │                       │    (isOwner check)    │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 5. Build DTO          │                            │
   │                       │                       │    extract logo data  │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 6. UpdateRoomAction   │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. BEGIN TRANSACTION       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. Check duplicate name    │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │       SELECT EXISTS        │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. Handle logo (if new)    │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │   DELETE old from ImageKit │
   │                       │                       │                       │   Invalidate cache         │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. UPDATE rooms SET ...   │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. Refresh & load('user') │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │       SELECT room, user    │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 12. COMMIT                 │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 13. Dispatch RoomUpdated   │
   │                       │                       │                       │    event (async)           │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 14. Return ActionResult    │
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 15. RoomResource      │                            │
   │                       │                       │     transform         │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 16. ApiResponse       │                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  200 OK + JSON        │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                | Location(s)                                            |
| ----------------------- | ------------------------------------------------------ |
| New updatable field     | Request → DTO → Action → Model → Resource              |
| New validation rule     | `UpdateRoomRequest::rules()`                           |
| Pre-update hook         | `UpdateRoomAction::execute()` before `$room->update()` |
| Post-update side effect | Listen to `RoomUpdated` event                          |
| Conditional logic       | `UpdateRoomAction::execute()` with `ActionResult`      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW UPDATABLE FIELD (e.g., `description`)

| Step  | File                                                  | What to Change                                                         |
| ----- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| **1** | `database/migrations/*_add_description_to_rooms.php`  | Add column: `$table->text('description')->nullable();`                 |
| **2** | `app/Models/Room/Room.php`                            | Add to `$fillable` array                                               |
| **3** | `app/Http/Requests/Api/V1/Room/UpdateRoomRequest.php` | Add validation: `'description' => ['sometimes', 'string', 'max:1000']` |
| **4** | `app/DTOs/Room/UpdateRoomDTO.php`                     | Add property: `public readonly ?string $description = null`            |
| **5** | `app/DTOs/Room/UpdateRoomDTO.php`                     | Update `toModelArray()` to include description                         |
| **6** | `app/DTOs/Room/UpdateRoomDTO.php`                     | Update `fromArray()` to parse description                              |
| **7** | `app/Http/Resources/V1/Room/RoomResource.php`         | Add to response: `'description' => $room->description`                 |

#### ➖ REMOVING AN UPDATABLE FIELD (e.g., `country`)

| Step  | File                                                  | What to Change                              |
| ----- | ----------------------------------------------------- | ------------------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/UpdateRoomRequest.php` | Remove `country` rule and related methods   |
| **2** | `app/Http/Requests/Api/V1/Room/UpdateRoomRequest.php` | Remove from `prepareForValidation()`        |
| **3** | `app/DTOs/Room/UpdateRoomDTO.php`                     | Remove `country` property                   |
| **4** | `app/DTOs/Room/UpdateRoomDTO.php`                     | Update `toModelArray()` and `fromArray()`   |
| **5** | `app/Http/Resources/V1/Room/RoomResource.php`         | Remove from response array                  |
| **6** | **Database Migration**                                | Drop column (if safe, coordinate with team) |

### 🔗 Field Flow Dependency Chain

```
Request Body Field
        │
        ▼
┌─────────────────────────┐
│ UpdateRoomRequest       │ ← Validation rules
│   prepareForValidation  │ ← Input normalization
│   rules()               │ ← Field constraints
│   messages()            │ ← Custom error messages
│   attributes()          │ ← Field display names
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ UpdateRoomDTO           │ ← Type-safe container
│   $property             │ ← Nullable for partial
│   fromArray()           │ ← Parse with type coercion
│   toModelArray()        │ ← Filter nulls for update
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Room Model              │
│   $fillable             │ ← Must include field
│   casts()               │ ← Type casting (e.g., enum)
│   $hidden               │ ← Excluded from JSON
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ RoomResource            │ ← Response transformer
│   toArray()             │ ← Include in response
└─────────────────────────┘
```

### 📋 Field Modification Checklist

- [ ] Migration created and tested
- [ ] Model `$fillable` updated
- [ ] Request validation added
- [ ] DTO property and methods updated
- [ ] Resource response includes field
- [ ] Tests updated (if applicable)
- [ ] API documentation updated

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                       |
| ------------------------------ | -------------------------------------------- |
| `UpdateRoomAction` transaction | Ensures atomicity of update + logo deletion  |
| `RoomPolicy::update()`         | Security: ownership and permission checks    |
| `Room::$hidden`                | Security: prevents password exposure         |
| `Room::casts['password']`      | Security: auto-hashing must remain           |
| `ActionResult` pattern         | Framework-wide consistency                   |
| Unique name check in Action    | Prevents race condition bypassing validation |

### 🚨 Common Pitfalls

| Pitfall                                        | Prevention                                             |
| ---------------------------------------------- | ------------------------------------------------------ |
| Adding field to Request but not DTO            | Always update both; DTO is source of truth for Action  |
| Forgetting `sometimes` on new rules            | All update fields should be optional (partial updates) |
| Not clearing password when switching to public | Intentional: password is kept, just not required       |
| Logo deletion fails but room still updated     | Service handles gracefully, logs error, clears DB      |
| Duplicate name check race condition            | Checked inside transaction in Action, not just Request |
| Missing `load('user')` after update            | Required for RoomResource to include owner             |
| Not refreshing model after update              | Use `$room->refresh()` to get DB-generated values      |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                     ← Route definition (line 45)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                                 ← Controller (update method)
app/Http/Requests/Api/V1/Room/
  └── UpdateRoomRequest.php                              ← Request validation
app/DTOs/Room/
  └── UpdateRoomDTO.php                                  ← Data transfer object
app/Actions/Room/
  └── UpdateRoomAction.php                               ← Business logic
app/Services/Room/
  └── RoomLogoService.php                                ← Logo management
app/Policies/Room/
  └── RoomPolicy.php                                     ← Authorization
app/Http/Resources/V1/Room/
  └── RoomResource.php                                   ← Response transformer
app/Events/Room/
  └── RoomUpdated.php                                    ← Domain event
app/Models/Room/
  └── Room.php                                           ← Eloquent model
app/Actions/
  └── ActionResult.php                                   ← Result pattern
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `PUT/PATCH /api/v1/rooms/{room}` |
| **Domain**          | Room                             |
| **Author**          | System Documentation             |
| **Created**         | 2026-01-30                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4                              |
