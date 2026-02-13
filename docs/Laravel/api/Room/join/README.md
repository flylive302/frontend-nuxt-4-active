# POST /api/v1/rooms/{room}/join

> **Domain**: Room  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

Verify password access for joining a room. Public rooms grant immediate access, while private rooms require password verification.

### Responsibilities

- Verify room type (public/private)
- Validate password for private rooms
- Return access granted/denied response
- Log access attempts for private rooms

### What It Owns

| Owned               | Description                                    |
| ------------------- | ---------------------------------------------- |
| Password validation | Verifies password against hashed room password |
| Access decision     | Determines if user can access the room         |

### External Dependencies

| Dependency | Type           | Purpose                                    |
| ---------- | -------------- | ------------------------------------------ |
| PostgreSQL | Database       | Stores room data including hashed password |
| Redis      | Infrastructure | Rate limiting via `api_dynamic` limiter    |

> **Note**: This endpoint only verifies password access. Member creation happens separately via the join-request flow.

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/rooms/{room}/join
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

| Header         | Required | Type               | Description         |
| -------------- | -------- | ------------------ | ------------------- |
| `Content-Type` | ✅       | `application/json` | Request body format |
| `Accept`       | ✅       | `application/json` | Response format     |

### Request Body Schema

```json
{
  "password": "string|null" // Optional, required only for private rooms
}
```

#### Field Details

| Field      | Type    | Constraints | Example              |
| ---------- | ------- | ----------- | -------------------- | --------------- |
| `password` | `string | null`       | Optional, any string | `"mySecret123"` |

---

### Response Schemas

#### ✅ Success Response - Public Room (200)

```json
{
  "status": "success",
  "message": "Room access granted",
  "data": {
    "access": true
  },
  "meta": {
    "timestamp": "2026-01-30T10:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ✅ Success Response - Private Room with Correct Password (200)

```json
{
  "status": "success",
  "message": "Room access granted",
  "data": {
    "access": true
  },
  "meta": {
    "timestamp": "2026-01-30T10:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Forbidden Error - Invalid Password (403)

```json
{
  "status": "error",
  "message": "Invalid password",
  "data": null,
  "errors": {
    "password": ["Incorrect password"]
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

> **Note**: Laravel's implicit route model binding throws `ModelNotFoundException` which is handled by the global exception handler.

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "password": ["The password field must be a string."]
  }
}
```

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
  "message": "Failed to verify room access",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-01-30T10:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                   |
| ----- | ------------------------------------------- |
| `200` | Access granted (public or correct password) |
| `403` | Invalid password for private room           |
| `404` | Room not found (or soft-deleted)            |
| `422` | Validation error (invalid password type)    |
| `429` | Rate limit exceeded                         |
| `500` | Database error or unexpected exception      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/rooms/123/join                              │
│                    Body: { "password": "secret" }                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:29-32                                            │
│ Route: Route::post('/{room}/join', [RoomController::class, 'join'])         │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. throttle:api_dynamic  → Role-based rate limiting (30-500 req/min)      │
│                                                                             │
│ Route Constraints:                                                          │
│   • ->whereNumber('room')  → Ensures {room} is numeric                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('rooms')->name('rooms.')->group(function () {             │ │
│ │     Route::post('/{room}/join', [RoomController::class, 'join'])        │ │
│ │         ->name('join')                                                  │ │
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
│ 3.4 FIRST CODE EXECUTED - REQUEST VALIDATION                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/JoinRoomRequest.php                     │
│                                                                             │
│ Validates request body before controller receives it.                       │
│ Password is optional because public rooms don't require one.                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ class JoinRoomRequest extends FormRequest                               │ │
│ │ {                                                                       │ │
│ │     public function authorize(): bool                                   │ │
│ │     {                                                                   │ │
│ │         return true;  // Public endpoint, anyone can attempt            │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     public function rules(): array                                      │ │
│ │     {                                                                   │ │
│ │         return [                                                        │ │
│ │             'password' => ['nullable', 'string'],                       │ │
│ │         ];                                                              │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Possible Validation Errors:                                                 │
│   • password must be a string (if array or object provided)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:255-278           │
│ Method: join(Room $room, JoinRoomRequest $request, VerifyRoomPasswordAction)│
│                                                                             │
│ STEP 1: Create DTO from validated request                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = JoinRoomDTO::fromRequest($request);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Execute password verification action                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($room, $dto);                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle result and build response                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->success) {                                               │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->message ?? 'Failed to verify room access',             │ │
│ │         $result->errors ?? [],                                          │ │
│ │         $result->meta['status'] ?? 400                                  │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     $result->data,                                                      │ │
│ │     $result->message ?? 'Room access granted'                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Observations:                                                           │
│   • Thin controller - delegates to Action class                             │
│   • No service layer - uses Action pattern                                  │
│   • DTO ensures type-safe password handling                                 │
│   • Result-based error handling (not exceptions)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DTO LAYER                                                               │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: JoinRoomDTO                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Room/JoinRoomDTO.php                                     │ │
│ │ Responsibility: Type-safe password data transfer                        │ │
│ │ Reusable: YES (used for any room join operation)                        │ │
│ │                                                                         │ │
│ │ SECURITY WARNING in Docblock:                                           │ │
│ │   • Password must NEVER be logged                                       │ │
│ │   • Never serialize to JSON for API responses                           │ │
│ │   • Only use for authentication/verification flows                      │ │
│ │                                                                         │ │
│ │ Implementation:                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ class JoinRoomDTO                                                   │ │ │
│ │ │ {                                                                   │ │ │
│ │ │     public function __construct(                                    │ │ │
│ │ │         public readonly string $password,  // Never log this!       │ │ │
│ │ │     ) {}                                                            │ │ │
│ │ │                                                                     │ │ │
│ │ │     public static function fromRequest(FormRequest $request): self  │ │ │
│ │ │     {                                                               │ │ │
│ │ │         $validated = $request->validated();                         │ │ │
│ │ │         return new self(                                            │ │ │
│ │ │             password: $validated['password'] ?? '',                 │ │ │
│ │ │         );                                                          │ │ │
│ │ │     }                                                               │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 ACTION LAYER FLOW                                                       │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: VerifyRoomPasswordAction                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/Room/VerifyRoomPasswordAction.php                     │ │
│ │ Responsibility: Core business logic for password verification           │ │
│ │ Reusable: YES (can be used by any password-protected room flow)         │ │
│ │ Why It Exists: Separates business logic from controller                 │ │
│ │                                                                         │ │
│ │ Key Method: execute(Room $room, JoinRoomDTO $dto): ActionResult         │ │
│ │                                                                         │ │
│ │ Decision Flow:                                                          │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ 1. CHECK ROOM TYPE                                                  │ │ │
│ │ │    if ($room->type === RoomType::PUBLIC) {                          │ │ │
│ │ │        return ActionResult::success(                                │ │ │
│ │ │            data: ['access' => true],                                │ │ │
│ │ │            message: 'Room access granted'                           │ │ │
│ │ │        );                                                           │ │ │
│ │ │    }                                                                │ │ │
│ │ │                                                                     │ │ │
│ │ │ 2. VERIFY PASSWORD (for private rooms)                              │ │ │
│ │ │    if ($room->password === null ||                                  │ │ │
│ │ │        ! Hash::check($dto->password ?? '', $room->password)) {      │ │ │
│ │ │        return ActionResult::failure(                                │ │ │
│ │ │            errors: ['password' => ['Incorrect password']],          │ │ │
│ │ │            message: 'Invalid password',                             │ │ │
│ │ │            meta: ['status' => 403]                                  │ │ │
│ │ │        );                                                           │ │ │
│ │ │    }                                                                │ │ │
│ │ │                                                                     │ │ │
│ │ │ 3. LOG SUCCESS & RETURN                                             │ │ │
│ │ │    Log::info('User granted access to private room', [               │ │ │
│ │ │        'room_id' => $room->id                                       │ │ │
│ │ │    ]);                                                              │ │ │
│ │ │    return ActionResult::success(['access' => true], ...);           │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action result wrapper                      │ │
│ │ Reusable: YES (all Actions use this)                                    │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • success: bool       → Was action successful?                        │ │
│ │   • data: mixed         → Result data (e.g., ['access' => true])        │ │
│ │   • message: ?string    → Human-readable message                        │ │
│ │   • errors: array       → Field-specific errors                         │ │
│ │   • meta: array         → Additional metadata (e.g., status code)       │ │
│ │                                                                         │ │
│ │ Static Constructors:                                                    │ │
│ │   • ActionResult::success($data, $message, $meta)                       │ │
│ │   • ActionResult::failure($errors, $message, $data, $meta)              │ │
│ │   • ActionResult::fromException($exception, $message, $meta)            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Room Model                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Eloquent model for rooms table                          │ │
│ │ Reusable: YES (used by all Room domain endpoints)                       │ │
│ │                                                                         │ │
│ │ Key Features for this endpoint:                                         │ │
│ │   • type: RoomType enum cast                                            │ │
│ │   • password: hashed cast (never exposed raw)                           │ │
│ │   • Hidden: password (never in serialization)                           │ │
│ │   • SoftDeletes: Auto-filters deleted rooms                             │ │
│ │                                                                         │ │
│ │ Relevant Properties:                                                    │ │
│ │   • $room->type      → RoomType::PUBLIC or RoomType::PRIVATE            │ │
│ │   • $room->password  → Hashed password (null for public)                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomType Enum                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomType.php                                       │ │
│ │ Responsibility: Room visibility type enum                               │ │
│ │ Reusable: YES (used in Room model, resources, and requests)             │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PUBLIC = 'public'   → No password required                          │ │
│ │   • PRIVATE = 'private' → Password required                             │ │
│ │                                                                         │ │
│ │ Methods:                                                                │ │
│ │   • requiresPassword() → bool                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Hash Facade                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Part of: Illuminate\Support\Facades\Hash                                │ │
│ │ Used for: Hash::check($plaintext, $hashed)                              │ │
│ │ Algorithm: bcrypt (Laravel default)                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.9 DATA ACCESS / EXTERNAL CALLS                                            │
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
│    Returns: Room model with type and password columns                        │
│                                                                             │
│ CACHE OPERATIONS (Redis):                                                   │
│                                                                             │
│ 1. CHECK/INCREMENT: Rate limit counter                                      │
│    Key: laravel_cache:throttle:api_dynamic:guest:<ip>                       │
│    Source: ThrottleRequests middleware                                      │
│                                                                             │
│ NO ADDITIONAL QUERIES:                                                      │
│   • Password check is done in-memory using Hash::check()                    │
│   • No relationships loaded                                                 │
│   • No writes to database                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.10 RESPONSE CONSTRUCTION                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:271-277           │
│                                                                             │
│ SUCCESS PATH:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     $result->data,              // ['access' => true]                   │ │
│ │     $result->message ?? 'Room access granted'                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FAILURE PATH:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::error(                                              │ │
│ │     $result->message ?? 'Failed to verify room access',                 │ │
│ │     $result->errors ?? [],      // ['password' => ['Incorrect...']]     │ │
│ │     $result->meta['status'] ?? 400  // Uses 403 from ActionResult       │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response wrapper                       │ │
│ │ Reusable: YES (all API endpoints use this)                              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Wraps data with status="success"                        │ │
│ │   • error()   → Wraps with status="error"                               │ │
│ │   • Both add timestamp and correlation_id to meta                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK or 403 Forbidden + JSON Body                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints                  | Reusable | Reasoning                                       |
| ------------------------------ | ---------------------------------- | -------- | ----------------------------------------------- |
| `RoomController.php`           | Room CRUD endpoints                | ⭕       | Contains endpoint-specific methods              |
| `JoinRoomRequest.php`          | `POST /rooms/{room}/join` only     | ❌       | Specific to join operation                      |
| `JoinRoomDTO.php`              | Room join/password flows           | ✅       | Can be reused for any password-protected access |
| `VerifyRoomPasswordAction.php` | Room join, potentially gate checks | ✅       | Encapsulates password verification logic        |
| `ActionResult.php`             | All Action classes                 | ✅       | Standard result wrapper                         |
| `Room.php` (Model)             | All Room domain endpoints          | ✅       | Core model for room data                        |
| `RoomType.php` (Enum)          | Room model, resources, requests    | ✅       | Shared enum for room visibility                 |
| `ApiResponse.php`              | All API endpoints                  | ✅       | Standard response wrapper                       |
| `AppServiceProvider.php`       | Application-wide                   | ✅       | Rate limiter definitions                        |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error             | Source            | Condition                                    |
| ----------------- | ----------------- | -------------------------------------------- |
| `password.string` | `JoinRoomRequest` | Password field is not a string (e.g., array) |

### Business Logic Errors (403)

| Error              | Source                     | Condition                         |
| ------------------ | -------------------------- | --------------------------------- |
| "Invalid password" | `VerifyRoomPasswordAction` | Wrong password for private room   |
| "Invalid password" | `VerifyRoomPasswordAction` | Missing password for private room |
| "Invalid password" | `VerifyRoomPasswordAction` | Room has no password set (null)   |

### Not Found Errors (404)

| Error           | Source              | Condition                           |
| --------------- | ------------------- | ----------------------------------- |
| Model not found | Route Model Binding | Room ID doesn't exist in database   |
| Model not found | Route Model Binding | Room is soft-deleted                |
| Route not found | Laravel Router      | Non-numeric ID (e.g., `/rooms/abc`) |

### Rate Limit Errors (429)

| Error                | Source             | Condition                       |
| -------------------- | ------------------ | ------------------------------- |
| "Too Many Attempts." | `ThrottleRequests` | Request rate exceeds role limit |

### System Errors (500)

| Error                          | Source                     | Condition                         |
| ------------------------------ | -------------------------- | --------------------------------- |
| "Failed to verify room access" | `VerifyRoomPasswordAction` | Unexpected exception in try/catch |
| "Failed to verify room access" | `RoomController`           | Database connection failure       |

### Edge Cases

| Case                                | Behavior                                              |
| ----------------------------------- | ----------------------------------------------------- |
| Public room, no password sent       | Access granted (200)                                  |
| Public room, password sent          | Access granted (200) - password ignored               |
| Private room, correct password      | Access granted (200)                                  |
| Private room, empty string password | 403 if room expects a password                        |
| Private room, null password in DB   | 403 - nullish password always fails Hash::check       |
| Room soft-deleted                   | Returns 404 (SoftDeletes trait filters automatically) |
| Room ID = 0 or negative             | Returns 404 (no room with that ID)                    |
| Very large room ID                  | Returns 404 if not found                              |
| SQL injection attempt in room ID    | Safe - `whereNumber()` + route model binding          |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              ROUTE BINDING           CONTROLLER                ACTION                   MODEL/DB
   │                       │                       │                       │                        │                        │
   │  POST /api/v1/rooms/123/join                  │                       │                        │                        │
   │  Body: {"password":"secret"}                  │                       │                        │                        │
   │───────────────────────▶│                       │                       │                        │                        │
   │                       │                       │                       │                        │                        │
   │                       │ 1. Check rate limit   │                       │                        │                        │
   │                       │────────────────────── REDIS ───────────────────────────────────────────────────────────────────▶│
   │                       │◀────────────────────────────────────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                        │                        │
   │                       │ 2. Resolve route      │                       │                        │                        │
   │                       │──────────────────────▶│                       │                        │                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │ 3. SELECT room by ID  │                        │                        │
   │                       │                       │────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀────────────────────────────────────────────────────────────────────────│
   │                       │                       │   Room Model          │                        │                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │ 4. Validate request   │                        │                        │
   │                       │                       │   (JoinRoomRequest)   │                        │                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │ 5. Inject Room + Request                       │                        │
   │                       │                       │──────────────────────▶│                        │                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │ 6. Create JoinRoomDTO  │                        │
   │                       │                       │                       │   from validated input │                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │ 7. Execute action      │                        │
   │                       │                       │                       │───────────────────────▶│                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │                        │ 8. Check room type     │
   │                       │                       │                       │                        │ (in-memory)            │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │                        │ 9. Hash::check()       │
   │                       │                       │                       │                        │ (if private)           │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │                        │ 10. Log access         │
   │                       │                       │                       │                        │ (if success + private) │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │◀───────────────────────│                        │
   │                       │                       │                       │   ActionResult         │                        │
   │                       │                       │                       │                        │                        │
   │                       │                       │                       │ 11. Build response     │                        │
   │                       │                       │                       │ (ApiResponse::success  │                        │
   │                       │                       │                       │  or ::error)           │                        │
   │                       │                       │◀──────────────────────│                        │                        │
   │                       │◀──────────────────────│                       │                        │                        │
   │◀──────────────────────│                       │                       │                        │                        │
   │                       │                       │                       │                        │                        │
   │  200 OK / 403 Forbidden + JSON                │                       │                        │                        │
   │                       │                       │                       │                        │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                                 |
| ------------------------- | -------------------------------------------------------- |
| Additional validation     | `JoinRoomRequest.rules()`                                |
| Pre-check before password | `VerifyRoomPasswordAction.execute()` (before type check) |
| Brute force protection    | Add attempt tracking in `VerifyRoomPasswordAction`       |
| Event dispatching         | After success in `VerifyRoomPasswordAction`              |
| Audit logging             | After success/failure in `VerifyRoomPasswordAction`      |
| Custom error messages     | `ActionResult::failure()` in action                      |
| Rate limit customization  | `AppServiceProvider` rate limiter                        |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUEST FIELD

| Step  | File                                                | What to Change                   |
| ----- | --------------------------------------------------- | -------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/JoinRoomRequest.php` | Add validation rule to `rules()` |
| **2** | `app/DTOs/Room/JoinRoomDTO.php`                     | Add property to constructor      |
| **3** | `app/DTOs/Room/JoinRoomDTO.php`                     | Map field in `fromRequest()`     |
| **4** | `app/Actions/Room/VerifyRoomPasswordAction.php`     | Use the new field in `execute()` |

**Example: Adding a `device_id` field:**

```php
// JoinRoomRequest.php
return [
    'password' => ['nullable', 'string'],
    'device_id' => ['required', 'string', 'max:255'],  // NEW
];

// JoinRoomDTO.php
public function __construct(
    public readonly string $password,
    public readonly string $deviceId,  // NEW
) {}

public static function fromRequest(FormRequest $request): self
{
    $validated = $request->validated();
    return new self(
        password: $validated['password'] ?? '',
        deviceId: $validated['device_id'],  // NEW
    );
}
```

#### ➖ REMOVING A REQUEST FIELD

| Step  | File                                                | What to Change              |
| ----- | --------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Requests/Api/V1/Room/JoinRoomRequest.php` | Remove from `rules()`       |
| **2** | `app/DTOs/Room/JoinRoomDTO.php`                     | Remove property             |
| **3** | `app/DTOs/Room/JoinRoomDTO.php`                     | Remove from `fromRequest()` |
| **4** | `app/Actions/Room/VerifyRoomPasswordAction.php`     | Remove usage of field       |
| **5** | Update API documentation                            | Remove from request schema  |

#### 🔄 ADDING A RESPONSE FIELD

| Step  | File                                            | What to Change                         |
| ----- | ----------------------------------------------- | -------------------------------------- |
| **1** | `app/Actions/Room/VerifyRoomPasswordAction.php` | Add to `data` array in success/failure |

**Example: Adding `room_name` to response:**

```php
// VerifyRoomPasswordAction.php
return ActionResult::success(
    data: [
        'access' => true,
        'room_name' => $room->name,  // NEW
    ],
    message: 'Room access granted'
);
```

### 🔗 Field Flow Dependency Chain

```
Request Body (password)
        │
        ▼
┌─────────────────────┐
│ JoinRoomRequest     │
│ rules() validation  │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ JoinRoomDTO         │
│ fromRequest()       │
└─────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ VerifyRoomPasswordAction    │
│ execute($room, $dto)        │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────┐
│ ActionResult        │
│ data/errors/meta    │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ ApiResponse         │
│ success() / error() │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ JSON Response       │
└─────────────────────┘
```

### 📋 Field Modification Checklists

#### ✅ Adding Request Field Checklist

- [ ] Add validation rule in `JoinRoomRequest`
- [ ] Add property in `JoinRoomDTO`
- [ ] Map in `JoinRoomDTO::fromRequest()`
- [ ] Use in `VerifyRoomPasswordAction` if needed
- [ ] Update this documentation
- [ ] Update OpenAPI/Swagger if applicable

#### ✅ Adding Response Field Checklist

- [ ] Add to `data` array in `ActionResult::success()` or `failure()`
- [ ] Update this documentation
- [ ] Update OpenAPI/Swagger if applicable

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `ApiResponse` structure          | Breaking change: all API consumers depend on this format      |
| Response `access` field          | Breaking change: clients depend on this to know access status |
| `ActionResult` status code logic | May break error handling for all Actions                      |
| `Hash::check()` call             | Security: must use Laravel's secure comparison                |
| Password logging in DTO          | SECURITY: password must NEVER be logged                       |
| `whereNumber('room')` constraint | Security: prevents invalid route parameters                   |
| Room `$hidden` array             | Security: `password` hash should never be exposed             |
| Rate limiter keys                | May cause cache key collisions or limits not applying         |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                           |
| ----------------------------------- | ---------------------------------------------------- |
| Logging password in DTO             | Read security warning in `JoinRoomDTO` docblock      |
| Comparing password with `===`       | Always use `Hash::check()` for hashed comparison     |
| Exposing password hash in response  | `password` is in Room `$hidden`, never access it     |
| Forgetting to handle null password  | Action handles `$room->password === null` explicitly |
| Changing success response structure | Will break clients checking `data.access === true`   |
| Not testing public vs private rooms | Test both paths - very different behavior            |
| Rate limit bypass                   | Don't remove or weaken throttle middleware           |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                 ← Route definition (line 29-32)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                             ← Controller (join method, L255-278)
app/Http/Requests/Api/V1/Room/
  └── JoinRoomRequest.php                            ← Request validation
app/DTOs/Room/
  └── JoinRoomDTO.php                                ← Data transfer object
app/Actions/Room/
  └── VerifyRoomPasswordAction.php                   ← Business logic action
app/Actions/
  └── ActionResult.php                               ← Action result wrapper
app/Models/Room/
  └── Room.php                                       ← Eloquent model
app/Enums/Room/
  └── RoomType.php                                   ← Room type enum
app/Http/Utils/
  └── ApiResponse.php                                ← Response wrapper utility
app/Providers/
  └── AppServiceProvider.php                         ← Rate limiter config (L171-197)
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `POST /api/v1/rooms/{room}/join` |
| **Domain**          | Room                             |
| **Author**          | System Documentation             |
| **Created**         | 2026-01-30                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4                              |
