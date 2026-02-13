# GET /api/v1/rooms

> **Domain**: Room  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

List all rooms with optional filtering, sorting, and pagination support. Returns paginated room data with eager-loaded owner information.

### Responsibilities

- Accept and validate query parameters for filtering
- Apply country, type, search, and user_id filters
- Sort results by configurable columns
- Paginate results with configurable page size
- Return transformed room data with owner details

### What It Owns

| Owned          | Description                                           |
| -------------- | ----------------------------------------------------- |
| Room listing   | Provides read access to all rooms                     |
| Filter parsing | Transforms query params into validated filter objects |
| Pagination     | Controls page size and navigation                     |

### External Dependencies

| Dependency | Type           | Purpose                                 |
| ---------- | -------------- | --------------------------------------- |
| PostgreSQL | Database       | Stores room and user data               |
| Redis      | Infrastructure | Rate limiting via `api_dynamic` limiter |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms
```

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
| `Accept`       | ✅       | `application/json` | Response format     |
| `Content-Type` | ❌       | N/A                | Not needed for GET  |

### Query Parameters

```
?country=PK&type=public&search=music&user_id=123&per_page=15&sort_by=created_at&sort_direction=desc
```

#### Parameter Details

| Parameter        | Type     | Constraints                                                       | Default      | Example     |
| ---------------- | -------- | ----------------------------------------------------------------- | ------------ | ----------- |
| `country`        | `string` | Optional, ISO 3166-1 alpha-2, case-insensitive                    | -            | `"PK"`      |
| `type`           | `string` | Optional, enum: `public`, `private`                               | -            | `"public"`  |
| `search`         | `string` | Optional, searches room name (case-insensitive, partial match)    | -            | `"music"`   |
| `user_id`        | `int`    | Optional, filter by room owner                                    | -            | `123`       |
| `per_page`       | `int`    | Optional, 1-100                                                   | `15`         | `20`        |
| `sort_by`        | `string` | Optional, enum: `id`, `user_id`, `name`, `created_at`, `country`  | `created_at` | `"name"`    |
| `sort_direction` | `string` | Optional, enum: `asc`, `desc`                                     | `desc`       | `"asc"`     |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Rooms retrieved successfully",
  "data": [
    {
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
    }
  ],
  "meta": {
    "pagination": {
      "current_page": 1,
      "per_page": 15,
      "total": 150,
      "last_page": 10,
      "from": 1,
      "to": 15,
      "path": "http://localhost/api/v1/rooms",
      "first_page_url": "http://localhost/api/v1/rooms?page=1",
      "last_page_url": "http://localhost/api/v1/rooms?page=10",
      "next_page_url": "http://localhost/api/v1/rooms?page=2",
      "prev_page_url": null
    },
    "timestamp": "2026-01-30T10:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
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
  "message": "Failed to retrieve rooms",
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
| `200` | Rooms retrieved successfully           |
| `429` | Rate limit exceeded                    |
| `500` | Database error or unexpected exception |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms?country=PK&type=public                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:20                                               │
│ Route: Route::get('/', [RoomController::class, 'index'])                    │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. throttle:api_dynamic  → Role-based rate limiting (30-500 req/min)      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('rooms')->name('rooms.')->group(function () {             │ │
│ │     Route::get('/', [RoomController::class, 'index'])                   │ │
│ │         ->name('index')                                                 │ │
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
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:34-81             │
│ Method: index(Request $request): JsonResponse                               │
│                                                                             │
│ STEP 1: Create RoomFilterDTO from query parameters                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $filterDto = RoomFilterDTO::fromArray($request->query());               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build Eloquent query with eager loading                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = Room::query()->with(['user']);                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Apply filters from DTO                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $filters = $filterDto->getQueryFilters();                               │ │
│ │                                                                         │ │
│ │ if (isset($filters['country']) && $filters['country'] !== '') {         │ │
│ │     $query->where('country', strtoupper($filters['country']));          │ │
│ │ }                                                                       │ │
│ │ if (isset($filters['type']) && $filters['type'] !== '') {               │ │
│ │     $query->where('type', $filters['type']);                            │ │
│ │ }                                                                       │ │
│ │ if (isset($filters['search']) && $filters['search'] !== '') {           │ │
│ │     $query->whereRaw('name ilike ?', ["%{$filters['search']}%"]);       │ │
│ │ }                                                                       │ │
│ │ if (isset($filters['user_id'])) {                                       │ │
│ │     $query->where('user_id', $filters['user_id']);                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Apply sorting                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $sortBy = $filters['sort_by'] ?? 'created_at';                          │ │
│ │ $sortDirection = $filters['sort_direction'] ?? 'desc';                  │ │
│ │ $query->orderBy($sortBy, $sortDirection);                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Execute paginated query                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $rooms = $query->paginate($filterDto->getPerPage());                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DTO LAYER: RoomFilterDTO                                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/DTOs/Room/RoomFilterDTO.php                                       │
│                                                                             │
│ Validates and normalizes all filter parameters with safe defaults:          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ALLOWED_SORT_COLUMNS = ['id', 'user_id', 'name', 'created_at',          │ │
│ │                         'updated_at', 'country', 'type']                │ │
│ │ ALLOWED_SORT_DIRECTIONS = ['asc', 'desc']                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray(array $data) → Creates DTO from query params              │ │
│ │   • getQueryFilters() → Returns validated filter array                  │ │
│ │   • getPerPage() → Returns clamped page size (1-100)                    │ │
│ │                                                                         │ │
│ │ Security Features:                                                      │ │
│ │   • Whitelist validation for sort columns (prevents SQL injection)     │ │
│ │   • Type coercion with safe defaults                                    │ │
│ │   • RoomType enum validation via tryFrom()                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│ │   • Soft deletes enabled                                                │ │
│ │   • Casts: type → RoomType enum, password → hashed                      │ │
│ │   • Relationships: user() → BelongsTo<User>                             │ │
│ │   • Query Scopes: byCountry(), public(), private(), search()            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomType Enum                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomType.php                                       │ │
│ │ Responsibility: Room visibility type enum                               │ │
│ │ Reusable: YES (used in Room model, DTO, and resources)                  │ │
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
│ COMPONENT: BaseDTO                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/BaseDTO.php                                              │ │
│ │ Responsibility: Abstract base class for all DTOs                        │ │
│ │ Reusable: YES (all DTOs extend this)                                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray() → Reflection-based instantiation                        │ │
│ │   • toArray() → Array conversion (abstract)                             │ │
│ │   • camelToSnake() → Parameter name conversion                          │ │
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
│ 1. SELECT: Fetch rooms with filters                                         │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT * FROM rooms                                                  │ │
│    │   WHERE deleted_at IS NULL                                           │ │
│    │   [AND country = 'PK']              -- if country filter             │ │
│    │   [AND type = 'public']             -- if type filter                │ │
│    │   [AND name ILIKE '%search%']       -- if search filter              │ │
│    │   [AND user_id = 123]               -- if user_id filter             │ │
│    │   ORDER BY created_at DESC                                           │ │
│    │   LIMIT 15 OFFSET 0                                                  │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: RoomController@index                                             │
│                                                                             │
│ 2. SELECT: Eager load room owners (N+1 prevention)                          │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT * FROM users WHERE id IN (1, 2, 3, ...)                       │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: Room::with(['user'])                                             │
│                                                                             │
│ 3. COUNT: Total rooms for pagination                                        │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ SELECT COUNT(*) FROM rooms WHERE deleted_at IS NULL [+ filters]      │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: LengthAwarePaginator                                             │
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
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:70-72             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     RoomResource::collection($rooms),                                   │ │
│ │     'Rooms retrieved successfully'                                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomResource                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomResource.php                       │ │
│ │ Responsibility: Transform Room model to API response                    │ │
│ │ Reusable: YES (used by show, myRoom, update endpoints)                  │ │
│ │                                                                         │ │
│ │ Output Fields (16 total):                                               │ │
│ │   • id, name, logo, type, type_label, is_private                        │ │
│ │   • country, is_live, participant_count, room_xp                        │ │
│ │   • current_level, max_seats, sort_order, created_at                    │ │
│ │   • owner_id, owner (nested MinimalUserResource)                        │ │
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
│ │ Key Method: paginated()                                                 │ │
│ │   • Extracts pagination metadata from LengthAwarePaginator              │ │
│ │   • Adds timestamp and correlation_id to meta                           │ │
│ │   • Wraps data in standard success response structure                   │ │
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

| File                         | Used By Endpoints                                  | Reusable | Reasoning                                          |
| ---------------------------- | -------------------------------------------------- | -------- | -------------------------------------------------- |
| `RoomController.php`         | Room CRUD endpoints                                | ⭕       | Contains endpoint-specific methods                 |
| `RoomFilterDTO.php`          | `GET /rooms` only                                  | ❌       | Specific to room listing filters                   |
| `Room.php` (Model)           | All Room domain endpoints                          | ✅       | Core model for room data                           |
| `RoomType.php` (Enum)        | Room model, DTOs, resources                        | ✅       | Shared enum for room visibility                    |
| `RoomResource.php`           | `GET /rooms`, `GET /rooms/{id}`, `POST /rooms`     | ✅       | Standard room response transformer                 |
| `MinimalUserResource.php`    | Room, RoomMember, Agency endpoints                 | ✅       | Lightweight user embedding                         |
| `ApiResponse.php`            | All API endpoints                                  | ✅       | Standard response wrapper                          |
| `BaseResource.php`           | All API resources                                  | ✅       | Common resource utilities                          |
| `BaseDTO.php`                | All DTOs                                           | ✅       | Reflection-based DTO instantiation                 |
| `AppServiceProvider.php`     | Application-wide                                   | ✅       | Rate limiter definitions                           |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

This endpoint does **not** use FormRequest validation. Invalid query parameters are handled gracefully with defaults.

| Input Issue               | Behavior                                   |
| ------------------------- | ------------------------------------------ |
| Invalid `type` value      | Ignored (filter not applied)               |
| Non-numeric `user_id`     | Ignored (filter not applied)               |
| Invalid `sort_by` column  | Falls back to `created_at`                 |
| Invalid `sort_direction`  | Falls back to `desc`                       |
| `per_page` < 1 or > 100   | Clamped to valid range (1-100)             |

### Business Logic Errors (400)

None - this is a read-only listing endpoint with no business rule violations.

### System Errors (500)

| Error                     | Source               | Condition                          |
| ------------------------- | -------------------- | ---------------------------------- |
| "Failed to retrieve rooms"| `RoomController`     | Database connection failure        |
| "Failed to retrieve rooms"| `RoomController`     | Unexpected exception during query  |

### Rate Limit Errors (429)

| Error               | Source                   | Condition                       |
| ------------------- | ------------------------ | ------------------------------- |
| "Too Many Attempts."| `ThrottleRequests`       | Request rate exceeds role limit |

### Edge Cases

| Case                        | Behavior                                           |
| --------------------------- | -------------------------------------------------- |
| No rooms exist              | Returns empty array with pagination meta           |
| All rooms soft-deleted      | Returns empty array (soft deletes auto-filtered)   |
| Invalid page number         | Returns empty array for page > last_page           |
| Empty search string         | Filter not applied                                 |
| Country in lowercase        | Normalized to uppercase (e.g., "pk" → "PK")        |
| Owner user soft-deleted     | Owner relationship still loads (no cascade filter) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            DTO                    MODEL/DB                 RESOURCE
   │                       │                       │                   │                        │                        │
   │  GET /api/v1/rooms    │                       │                   │                        │                        │
   │──────────────────────▶│                       │                   │                        │                        │
   │                       │                       │                   │                        │                        │
   │                       │ 1. Check rate limit   │                   │                        │                        │
   │                       │─────────────────────▶ REDIS               │                        │                        │
   │                       │◀─────────────────────│                   │                        │                        │
   │                       │                       │                   │                        │                        │
   │                       │ 2. Forward request    │                   │                        │                        │
   │                       │──────────────────────▶│                   │                        │                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │ 3. Create DTO     │                        │                        │
   │                       │                       │──────────────────▶│                        │                        │
   │                       │                       │◀──────────────────│                        │                        │
   │                       │                       │   RoomFilterDTO   │                        │                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │ 4. Build query with filters               │                        │
   │                       │                       │──────────────────────────────────────────▶│                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │                   │  5. SELECT rooms       │                        │
   │                       │                       │                   │  ────────────────────▶ PostgreSQL               │
   │                       │                       │                   │  ◀────────────────────│                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │                   │  6. SELECT users (eager)                       │
   │                       │                       │                   │  ────────────────────▶ PostgreSQL               │
   │                       │                       │                   │  ◀────────────────────│                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │◀──────────────────────────────────────────│                        │
   │                       │                       │   LengthAwarePaginator                    │                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │ 7. Transform to collection                                        │
   │                       │                       │────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀────────────────────────────────────────────────────────────────────│
   │                       │                       │   RoomResource::collection                │                        │
   │                       │                       │                   │                        │                        │
   │                       │                       │ 8. Wrap with ApiResponse::paginated()     │                        │
   │                       │                       │                   │                        │                        │
   │                       │◀──────────────────────│                   │                        │                        │
   │◀──────────────────────│                       │                   │                        │                        │
   │                       │                       │                   │                        │                        │
   │  200 OK + JSON        │                       │                   │                        │                        │
   │                       │                       │                   │                        │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                             |
| ------------------------ | ---------------------------------------------------- |
| New filter parameter     | `RoomFilterDTO`, then apply in `RoomController@index`|
| New response field       | `RoomResource.toArray()`                             |
| New sort column          | `RoomFilterDTO::ALLOWED_SORT_COLUMNS`                |
| New room relationship    | `Room` model, then eager load in controller          |
| Cache layer              | Before DB query in `RoomController@index`            |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FILTER PARAMETER

| Step  | File                              | What to Change                                    |
| ----- | --------------------------------- | ------------------------------------------------- |
| **1** | `app/DTOs/Room/RoomFilterDTO.php` | Add public readonly property                      |
| **2** | `app/DTOs/Room/RoomFilterDTO.php` | Add to constructor with default value             |
| **3** | `app/DTOs/Room/RoomFilterDTO.php` | Add validation in `fromArray()`                   |
| **4** | `app/DTOs/Room/RoomFilterDTO.php` | Add to `getQueryFilters()` return                 |
| **5** | `RoomController.php`              | Apply filter to query with `if (isset(...))`      |

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                      | What to Change                         |
| ----- | ----------------------------------------- | -------------------------------------- |
| **1** | Database Migration                        | Add column (if new data)               |
| **2** | `app/Models/Room/Room.php`                | Add to `$fillable` (if new column)     |
| **3** | `app/Http/Resources/V1/Room/RoomResource.php` | Add to `toArray()` return array    |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                      | What to Change                         |
| ----- | ----------------------------------------- | -------------------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomResource.php` | Remove from `toArray()` return     |
| **2** | Update API documentation                  | Remove field from response schema      |

### 🔗 Field Flow Dependency Chain

```
Query Parameter (country)
        │
        ▼
┌─────────────────────┐
│ RoomFilterDTO       │
│ fromArray()         │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ getQueryFilters()   │
│ → ['country' => 'PK']│
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ RoomController      │
│ $query->where(...)  │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Room Model          │
│ Eloquent Query      │
└─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `ALLOWED_SORT_COLUMNS` whitelist   | Security: prevents SQL injection via sort parameter       |
| `ApiResponse` structure            | Breaking change: all API consumers depend on this format  |
| `RoomResource` field names         | Breaking change: mobile/web apps depend on these keys     |
| Rate limiter keys                  | May cause cache key collisions or limits not applying     |
| `Room` model `$hidden` array       | Security: `password` hash should never be exposed         |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                              |
| ------------------------------------------ | ------------------------------------------------------- |
| Adding sort column without whitelist       | Always add new columns to `ALLOWED_SORT_COLUMNS`        |
| N+1 queries on new relationships           | Use `->with(['newRelation'])` in controller query       |
| Forgetting soft delete scope               | Room model uses `SoftDeletes`, filtered automatically   |
| Exposing sensitive owner data              | Use `MinimalUserResource`, not full `UserResource`      |
| Not handling null owner                    | `whenLoaded()` handles missing relationship gracefully  |
| Breaking pagination by changing meta keys  | Pagination structure is defined in `ApiResponse`        |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                 ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                             ← Controller (index method)
app/DTOs/Room/
  └── RoomFilterDTO.php                              ← Filter validation/normalization
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

| Property            | Value                    |
| ------------------- | ------------------------ |
| **Endpoint**        | `GET /api/v1/rooms`      |
| **Domain**          | Room                     |
| **Author**          | System Documentation     |
| **Created**         | 2026-01-30               |
| **Laravel Version** | 12.x                     |
| **PHP Version**     | 8.4                      |
