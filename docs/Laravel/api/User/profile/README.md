# GET /api/v1/users/profile/{signature}

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-27

---

## 1. Domain Overview

### Purpose

Retrieves a user's public profile by their unique signature. Includes aggregated statistics, agency affiliation, current room, and cursor-paginated gifts received. Each profile view is recorded for visit tracking with daily deduplication per visitor.

### Responsibilities

- Find user by unique signature identifier
- Load profile visit count aggregate
- Load agency membership with agency details
- Load user's current room (if any)
- Record profile visit (deduplicated per visitor per day)
- Return cursor-paginated gifts received aggregated by gift type
- Return comprehensive public profile data

### What It Owns

| Owned                   | Description                                     |
| ----------------------- | ----------------------------------------------- |
| Profile visit tracking  | Records and deduplicates daily visitor visits   |
| Gift aggregation        | Aggregates gifts received by type with quantity |
| Public profile response | Complete public-safe user info with statistics  |

### External Dependencies

| Dependency                  | Type           | Purpose                           |
| --------------------------- | -------------- | --------------------------------- |
| Database (`users`)          | Eloquent       | User lookup by signature          |
| Database (`profile_visits`) | Eloquent       | Visit tracking and count          |
| Database (`transactions`)   | Eloquent       | Gift aggregation via JOIN         |
| Database (`gifts`)          | Eloquent       | Gift details for aggregation      |
| Database (`agencies`)       | Eloquent       | Agency info for membership        |
| Database (`rooms`)          | Eloquent       | User's room info                  |
| Laravel Sanctum             | Package        | Authentication verification       |
| Rate Limiter                | Infrastructure | `throttle:api_dynamic` middleware |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/users/profile/{signature}
```

### Authentication

✅ **Required** - Sanctum Bearer token required

### Rate Limiting

| Limiter       | Key         | Config                     |
| ------------- | ----------- | -------------------------- |
| `api_dynamic` | `user:{id}` | Dynamic based on user role |

### Middleware Stack

```
1. auth:sanctum        → Verifies authentication token
2. throttle:api_dynamic → Dynamic rate limiting based on user role
```

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter   | Type     | Constraints        | Example     |
| ----------- | -------- | ------------------ | ----------- |
| `signature` | `string` | Required, 7 digits | `"3592010"` |

### Query Parameters

| Parameter  | Type     | Constraints                   | Example        |
| ---------- | -------- | ----------------------------- | -------------- |
| `per_page` | `int`    | Optional, default 20, max 100 | `15`           |
| `cursor`   | `string` | Optional, pagination token    | `"eyJpZCI..."` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User profile retrieved successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "3592010",
    "avatar": "https://cdn.example.com/avatars/123.jpg",
    "frame": "frames/8",
    "gender": 1,
    "wealth_xp": "12500.000",
    "charm_xp": "8750.000",
    "profile_visits": 1542,
    "agency": {
      "id": 45,
      "name": "Elite Agency",
      "country": "PK",
      "logo": "https://cdn.example.com/agencies/45/logo.png",
      "total_member_count": 128
    },
    "room_id": 789,
    "gifts_received": [
      {
        "label": "Golden Rose",
        "thumbnail_url": "http://localhost/proxy/image/gifts/golden-rose.png",
        "rarity": "legendary",
        "total_quantity_received": 156
      },
      {
        "label": "Diamond Heart",
        "thumbnail_url": "http://localhost/proxy/image/gifts/diamond-heart.png",
        "rarity": "epic",
        "total_quantity_received": 89
      }
    ]
  },
  "meta": {
    "pagination": {
      "path": "http://localhost/api/v1/users/profile/3592010",
      "per_page": 20,
      "next_cursor": "eyJpZCI6MTAwLCJfcG9pbn...",
      "prev_cursor": null
    },
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### User Without Agency or Room

```json
{
  "status": "success",
  "message": "User profile retrieved successfully",
  "data": {
    "id": 456,
    "name": "Jane Smith",
    "signature": "1234567",
    "avatar": null,
    "frame": "frames/5",
    "gender": 2,
    "wealth_xp": "500.000",
    "charm_xp": "250.000",
    "profile_visits": 42,
    "agency": null,
    "gifts_received": []
  },
  "meta": {
    "pagination": {
      "path": "http://localhost/api/v1/users/profile/1234567",
      "per_page": 20,
      "next_cursor": null,
      "prev_cursor": null
    },
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

> **Note**: `room_id` is omitted entirely when user has no room (uses `when()` conditional).

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "User not found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 404,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 401,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Rate Limited (429)

```json
{
  "status": "error",
  "message": "Too many requests. Please try again later.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 429,
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Profile retrieved successfully          |
| `401` | Missing or invalid authentication token |
| `404` | User with given signature not found     |
| `429` | Rate limit exceeded                     |
| `500` | Unexpected server error                 |

---

## 3. Response Field Reference

### UserPublicProfileResource Fields

| Field            | Type                    | Source                        | Description                                     |
| ---------------- | ----------------------- | ----------------------------- | ----------------------------------------------- |
| `id`             | `integer`               | `users.id`                    | User primary key                                |
| `name`           | `string`                | `users.name`                  | Display name                                    |
| `signature`      | `string`                | `users.signature`             | Unique 7-digit public identifier                |
| `avatar`         | `string\|null`          | `users.avatar`                | CDN URL for avatar image                        |
| `frame`          | `string`                | Static `"frames/5"`           | Avatar frame (hardcoded for now)                |
| `gender`         | `integer`               | `users.gender`                | 1=male, 2=female, 3=non-binary, 4=not specified |
| `wealth_xp`      | `string`                | `users.wealth_xp`             | Formatted with 3 decimal places                 |
| `charm_xp`       | `string`                | `users.charm_xp`              | Formatted with 3 decimal places                 |
| `profile_visits` | `integer`               | `COUNT(profile_visits)`       | Total profile visit count                       |
| `agency`         | `object\|null`          | Computed from membership      | Agency details if user is active member         |
| `room_id`        | `integer` (conditional) | `rooms.id`                    | User's room ID, omitted if no room              |
| `gifts_received` | `array<GiftReceived>`   | `gifts` + `transactions` JOIN | Cursor-paginated aggregated gifts               |

### Agency Nested Object Fields

| Field                | Type           | Source                  | Description                  |
| -------------------- | -------------- | ----------------------- | ---------------------------- |
| `id`                 | `integer`      | `agencies.id`           | Agency primary key           |
| `name`               | `string`       | `agencies.name`         | Agency display name          |
| `country`            | `string`       | `agencies.country`      | 2-char ISO country code      |
| `logo`               | `string\|null` | `agencies.logo`         | CDN URL for agency logo      |
| `total_member_count` | `integer`      | `COUNT(active_members)` | Live count of active members |

### GiftReceivedResource Fields

| Field                     | Type      | Source                          | Description                               |
| ------------------------- | --------- | ------------------------------- | ----------------------------------------- |
| `label`                   | `string`  | `gifts.label` ?? `gifts.name`   | Gift display name (label preferred)       |
| `thumbnail_url`           | `string`  | `gifts.thumbnail_url` (proxied) | Proxied thumbnail URL via `/proxy/image/` |
| `rarity`                  | `string`  | `gifts.rarity`                  | common, uncommon, rare, epic, legendary   |
| `total_quantity_received` | `integer` | `SUM(transactions.quantity)`    | Total gifts of this type received         |

---

## 4. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/users/profile/3592010                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:21                                               │
│ Route: Route::get('/users/profile/{signature}',                             │
│            [UserController::class, 'showPublicProfile'])                    │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_dynamic → Dynamic rate limiting by user role              │
│                                                                             │
│ Route Group Context:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->group(function () {                │ │
│ │     Route::middleware('throttle:api_dynamic')->group(function () {      │ │
│ │         Route::get('/users/profile/{signature}', [...]);                │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.2 CONTROLLER METHOD - showPublicProfile()                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:270-303           │
│ Method: showPublicProfile(Request $request, string $signature): JsonResponse│
│                                                                             │
│ Dependencies (injected via constructor):                                    │
│   • ApiErrorResponder $errorResponder                                       │
│   • ProfileVisitService $profileVisitService                                │
│   • UserProfileService $userProfileService                                  │
│                                                                             │
│ STEP 1: Get authenticated viewer                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $viewer = $request->user();                                             │ │
│ │                                                                         │ │
│ │ if ($viewer === null) {                                                 │ │
│ │     return $this->errorResponder->unauthorized('Authentication required');│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find user by signature with aggregates and relations                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = User::query()                                                   │ │
│ │     ->where('signature', $signature)                                    │ │
│ │     ->withCount('profileVisits as profile_visits_count')                │ │
│ │     ->with([                                                            │ │
│ │         'activeAgencyMembership.agency',                                │ │
│ │         'room',                                                         │ │
│ │     ])                                                                  │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle user not found                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user === null) {                                                   │ │
│ │     return $this->errorResponder->notFound('User');                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Record profile visit                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->profileVisitService->recordVisit($viewer, $user);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Get cursor-paginated gifts received                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $perPage = (int) $request->input('per_page', 20);                       │ │
│ │ $giftsReceived = $this->userProfileService                              │ │
│ │     ->getGiftsReceived($user->id, $perPage);                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Return paginated response with resource                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::paginated(                                          │ │
│ │     (new UserPublicProfileResource($user))                              │ │
│ │         ->additional(['gifts_received' => $giftsReceived]),             │ │
│ │     'User profile retrieved successfully'                               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.3 SERVICE LAYER - ProfileVisitService                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/ProfileVisitService.php:23-46                       │
│ Method: recordVisit(User $visitor, User $target): void                      │
│                                                                             │
│ STEP 1: Skip self-visits                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($visitor->id === $target->id) {                                     │ │
│ │     return;  // Don't record self-visits                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Upsert with daily deduplication                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $today = now()->toDateString();                                         │ │
│ │                                                                         │ │
│ │ ProfileVisit::upsert(                                                   │ │
│ │     [[                                                                  │ │
│ │         'visitor_id' => $visitor->id,                                   │ │
│ │         'visited_user_id' => $target->id,                               │ │
│ │         'visited_at' => $today,                                         │ │
│ │         'created_at' => now(),                                          │ │
│ │         'updated_at' => now(),                                          │ │
│ │     ]],                                                                 │ │
│ │     ['visitor_id', 'visited_user_id', 'visited_at'], // Unique key      │ │
│ │     ['updated_at']  // Only update timestamp if exists                  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Deduplication Logic:                                                        │
│   • Unique constraint: visitor_id + visited_user_id + visited_at           │
│   • Same visitor can only create ONE visit per target per day              │
│   • Upsert is atomic and race-condition safe                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.4 SERVICE LAYER - UserProfileService                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/UserProfileService.php:28-49                        │
│ Method: getGiftsReceived(int $userId, int $perPage): CursorPaginator        │
│                                                                             │
│ Optimized single-query approach with JOIN:                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return Gift::query()                                                    │ │
│ │     ->select([                                                          │ │
│ │         'gifts.*',                                                      │ │
│ │         DB::raw('COALESCE(SUM(t.quantity), 0) as total_quantity'),      │ │
│ │     ])                                                                  │ │
│ │     ->join('transactions as t', function ($join) use ($userId) {        │ │
│ │         $join->on('gifts.id', '=', 't.transactionable_id')              │ │
│ │             ->where('t.transactionable_type', '=', 'App\\Models\\Gift') │ │
│ │             ->where('t.beneficiary_id', '=', $userId)                   │ │
│ │             ->where('t.type', '=', Transaction::TYPE_GIFT)              │ │
│ │             ->where('t.status', '=', Transaction::STATUS_COMPLETED);    │ │
│ │     })                                                                  │ │
│ │     ->groupBy('gifts.id')                                               │ │
│ │     ->orderByDesc('total_quantity')                                     │ │
│ │     ->cursorPaginate($perPage);                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Query Explanation:                                                          │
│   • JOINs gifts with transactions for the target user                       │
│   • Filters to TYPE_GIFT and STATUS_COMPLETED transactions only             │
│   • Groups by gift.id to aggregate quantities per gift type                 │
│   • Orders by most received gifts first (total_quantity DESC)               │
│   • Uses cursor pagination for efficient large datasets                     │
│   • Leverages idx_transactions_gift_query index for performance             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.5 RESOURCE LAYER - UserPublicProfileResource                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/UserPublicProfileResource.php:25-47             │
│ Method: toArray(Request $request): array                                    │
│                                                                             │
│ FIELD MAPPING:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->resource->id,                                        │ │
│ │     'name' => $this->resource->name,                                    │ │
│ │     'signature' => $this->resource->signature,                          │ │
│ │     'avatar' => $this->resource->avatar,                                │ │
│ │     'frame' => 'frames/5',  // Static for now                           │ │
│ │     'gender' => $this->resource->gender,                                │ │
│ │     'wealth_xp' => number_format(                                       │ │
│ │         (float) $this->resource->wealth_xp, 3, '.', ''                  │ │
│ │     ),                                                                  │ │
│ │     'charm_xp' => number_format(                                        │ │
│ │         (float) $this->resource->charm_xp, 3, '.', ''                   │ │
│ │     ),                                                                  │ │
│ │     'profile_visits' => (int) ($this->resource->profile_visits_count ?? 0),  │ │
│ │     'agency' => $this->getAgencyData(),                                 │ │
│ │     'room_id' => $this->when(                                           │ │
│ │         $this->resource->relationLoaded('room'),                        │ │
│ │         fn () => $this->resource->room?->id                             │ │
│ │     ),                                                                  │ │
│ │     'gifts_received' => $this->when(                                    │ │
│ │         isset($this->additional['gifts_received']),                     │ │
│ │         fn () => GiftReceivedResource::collection(                      │ │
│ │             $this->additional['gifts_received']                         │ │
│ │         )                                                               │ │
│ │     ),                                                                  │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ AGENCY DATA LOGIC (getAgencyData method):                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Check if activeAgencyMembership relation is loaded        → null    │ │
│ │ 2. Check if membership exists                                → null    │ │
│ │ 3. Check if agency relation is loaded                        → null    │ │
│ │ 4. Return agency object:                                               │ │
│ │    {                                                                   │ │
│ │        'id' => $agency->id,                                            │ │
│ │        'name' => $agency->name,                                        │ │
│ │        'country' => $agency->country,                                  │ │
│ │        'logo' => $agency->logo,                                        │ │
│ │        'total_member_count' => $agency->activeMembers()->count(),      │ │
│ │    }                                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.6 RESOURCE LAYER - GiftReceivedResource                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/GiftReceivedResource.php:23-31                  │
│ Method: toArray(Request $request): array                                    │
│                                                                             │
│ FIELD MAPPING:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'label' => $this->resource->label ?? $this->resource->name,         │ │
│ │     'thumbnail_url' => $this->resource->full_thumbnail_url,             │ │
│ │     'rarity' => $this->resource->rarity,                                │ │
│ │     'total_quantity_received' => (int) $this->resource->total_quantity, │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Notes:                                                                      │
│   • 'label' falls back to 'name' if label is null                          │
│   • 'thumbnail_url' uses full_thumbnail_url accessor (proxied URL)         │
│   • 'total_quantity' comes from GROUP BY SUM() in service query            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.7 DATA ACCESS / DATABASE QUERIES                                          │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ QUERY 1: Find user by signature with counts and relations                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT users.*,                                                         │ │
│ │        (SELECT COUNT(*) FROM profile_visits                             │ │
│ │         WHERE visited_user_id = users.id) as profile_visits_count       │ │
│ │ FROM users                                                              │ │
│ │ WHERE signature = '3592010'                                             │ │
│ │ LIMIT 1                                                                 │ │
│ │                                                                         │ │
│ │ + Eager load: activeAgencyMembership.agency, room                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: UserController::showPublicProfile()                                 │
│                                                                             │
│ QUERY 2: Upsert profile visit (atomic)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ INSERT INTO profile_visits (visitor_id, visited_user_id, visited_at,    │ │
│ │                             created_at, updated_at)                     │ │
│ │ VALUES (viewer_id, target_id, '2026-01-27', now(), now())              │ │
│ │ ON CONFLICT (visitor_id, visited_user_id, visited_at)                   │ │
│ │ DO UPDATE SET updated_at = now();                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: ProfileVisitService::recordVisit()                                  │
│                                                                             │
│ QUERY 3: Aggregated gifts received with cursor pagination                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT gifts.*, COALESCE(SUM(t.quantity), 0) as total_quantity          │ │
│ │ FROM gifts                                                              │ │
│ │ INNER JOIN transactions AS t                                            │ │
│ │     ON gifts.id = t.transactionable_id                                  │ │
│ │     AND t.transactionable_type = 'App\Models\Gift'                      │ │
│ │     AND t.beneficiary_id = 123                                          │ │
│ │     AND t.type = 'gift'                                                 │ │
│ │     AND t.status = 'completed'                                          │ │
│ │ GROUP BY gifts.id                                                       │ │
│ │ ORDER BY total_quantity DESC                                            │ │
│ │ LIMIT 21  -- per_page + 1 for cursor detection                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: UserProfileService::getGiftsReceived()                              │
│ Index Used: idx_transactions_gift_query                                     │
│                                                                             │
│ QUERY 4: Agency active member count (N+1 potential)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT COUNT(*) FROM agency_members                                     │ │
│ │ WHERE agency_id = 45 AND status = 'active'                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Source: UserPublicProfileResource::getAgencyData()                          │
│ Note: Executed only if user has active agency membership                    │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
│ EXTERNAL API CALLS: None                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ RESPONSE FLOW:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. UserPublicProfileResource wraps User model                           │ │
│ │         ↓                                                               │ │
│ │ 2. additional(['gifts_received' => $cursorPaginator]) attached          │ │
│ │         ↓                                                               │ │
│ │ 3. GiftReceivedResource::collection() wraps gifts paginator            │ │
│ │         ↓                                                               │ │
│ │ 4. ApiResponse::paginated() extracts cursor pagination meta            │ │
│ │         ↓                                                               │ │
│ │ 5. Final JSON envelope with status, message, data, meta                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL OUTPUT:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "User profile retrieved successfully",                     │ │
│ │   "data": { ... UserPublicProfileResource ... },                        │ │
│ │   "meta": {                                                             │ │
│ │     "pagination": { path, per_page, next_cursor, prev_cursor },        │ │
│ │     "timestamp": "...",                                                 │ │
│ │     "correlation_id": "..."                                             │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
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

## 5. Reusability Matrix

| File                            | Used By Endpoints             | Reusable    | Reasoning                                 |
| ------------------------------- | ----------------------------- | ----------- | ----------------------------------------- |
| `UserController.php`            | Multiple `/users/*` endpoints | ⭕ Mixed    | Controller bound to User domain           |
| `UserPublicProfileResource.php` | This endpoint only            | ⭕ Limited  | Specific to public profile structure      |
| `GiftReceivedResource.php`      | This endpoint only            | ⭕ Limited  | Specific to gift aggregation display      |
| `ProfileVisitService.php`       | This endpoint only            | ⭕ Limited  | Could be reused for visit analytics       |
| `UserProfileService.php`        | This endpoint only            | ⭕ Limited  | Gift aggregation reusable for other views |
| `ApiResponse.php`               | All API endpoints             | ✅ Reusable | Global response envelope                  |
| `ApiErrorResponder.php`         | All API endpoints             | ✅ Reusable | Centralized error formatting              |
| `User.php` (Model)              | Entire application            | ✅ Reusable | Core entity model                         |
| `ProfileVisit.php` (Model)      | Visit tracking                | ✅ Reusable | Core visit tracking entity                |
| `Gift.php` (Model)              | Gift operations               | ✅ Reusable | Core gift entity                          |
| `Agency.php` (Model)            | Agency domain                 | ✅ Reusable | Core agency entity                        |

---

## 6. Error Handling & Edge Cases

### Authentication Errors (401)

| Error                     | Source                | Condition                       |
| ------------------------- | --------------------- | ------------------------------- |
| "Authentication required" | Controller null check | `$request->user()` returns null |

### Not Found Errors (404)

| Error            | Source           | Condition                        |
| ---------------- | ---------------- | -------------------------------- |
| "User not found" | `errorResponder` | Signature doesn't match any user |

### Rate Limit Errors (429)

| Error                                  | Source                 | Condition           |
| -------------------------------------- | ---------------------- | ------------------- |
| "Too many requests. Please try again." | `throttle:api_dynamic` | Rate limit exceeded |

### System Errors (500)

| Error                          | Source               | Condition              |
| ------------------------------ | -------------------- | ---------------------- |
| Database connection failure    | User query           | DB unavailable         |
| Gift aggregation query failure | `getGiftsReceived()` | JOIN or GROUP BY error |
| Visit upsert failure           | `recordVisit()`      | Constraint violation   |

### Edge Cases

| Case                           | Behavior                                               |
| ------------------------------ | ------------------------------------------------------ |
| Viewing own profile            | Visit NOT recorded (self-visit check)                  |
| Same visitor, same day         | Visit deduplicated via UPSERT                          |
| Same visitor, different day    | New visit record created                               |
| User with no agency membership | `agency` field returns `null`                          |
| User with no room              | `room_id` field omitted entirely                       |
| User with no gifts received    | `gifts_received` returns empty array                   |
| Non-existent signature         | 404 "User not found"                                   |
| Empty signature in URL         | Route won't match (404 from router)                    |
| Very large per_page value      | No explicit cap, returns requested amount              |
| Invalid cursor parameter       | Laravel throws exception → 500 error                   |
| Soft-deleted user              | Still returned (no `deleted_at` filter)                |
| Agency member but inactive     | `activeAgencyMembership` returns null → `agency: null` |

---

## 7. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICES                DATABASE
   │                       │                       │                       │                       │
   │ GET /users/profile/   │                       │                       │                       │
   │     3592010           │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │    verify token       │                       │                       │
   │                       │────────┐              │                       │                       │
   │                       │◀───────┘              │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 2. throttle check     │                       │                       │
   │                       │────────┐              │                       │                       │
   │                       │◀───────┘              │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 3. dispatch           │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 4. get viewer user    │                       │
   │                       │                       │────────┐              │                       │
   │                       │                       │◀───────┘              │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 5. User::where(sig)   │                       │
   │                       │                       │   ->withCount()       │                       │
   │                       │                       │   ->with(relations)   │                       │
   │                       │                       │   ->first()           │                       │
   │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │ 6. profileVisitService│                       │
   │                       │                       │   ->recordVisit()     │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 7. UPSERT             │
   │                       │                       │                       │    profile_visits     │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 8. userProfileService │                       │
   │                       │                       │   ->getGiftsReceived()│                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │ 9. JOIN gifts +       │
   │                       │                       │                       │    transactions       │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │  CursorPaginator<Gift>│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 10. UserPublicProfile │                       │
   │                       │                       │     Resource          │                       │
   │                       │                       │────────┐              │                       │
   │                       │                       │◀───────┘              │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 11. getAgencyData()   │                       │
   │                       │                       │     (if membership)   │                       │
   │                       │                       │─────────────────────────────────────────────▶ │
   │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │ 12. GiftReceived      │                       │
   │                       │                       │     Resource::        │                       │
   │                       │                       │     collection()      │                       │
   │                       │                       │────────┐              │                       │
   │                       │                       │◀───────┘              │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 13. ApiResponse::     │                       │
   │                       │                       │     paginated()       │                       │
   │                       │                       │────────┐              │                       │
   │                       │                       │◀───────┘              │                       │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  200 OK + JSON        │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 8. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                         | Location                                            |
| -------------------------------- | --------------------------------------------------- |
| New profile field                | `UserPublicProfileResource::toArray()`              |
| New gift aggregation field       | `GiftReceivedResource::toArray()`                   |
| Different visit deduplication    | `ProfileVisitService::recordVisit()`                |
| Gift filtering (by rarity, etc.) | `UserProfileService::getGiftsReceived()` parameters |
| Agency details expansion         | `UserPublicProfileResource::getAgencyData()`        |
| Profile caching                  | Add cache layer in controller before DB query       |
| Visit analytics                  | Extend `ProfileVisitService` with analytics methods |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO PUBLIC PROFILE

| Step  | File                                                  | What to Change                        |
| ----- | ----------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Resources/V1/UserPublicProfileResource.php` | Add field to `toArray()` return array |
| **2** | If field needs eager load, update controller query    | Add to `->with([...])` if relation    |
| **3** | Update this documentation                             | Add field to response schema          |

Example: Adding `follower_count` field:

```diff
// UserController.php (if aggregate needed)
$user = User::query()
    ->where('signature', $signature)
    ->withCount('profileVisits as profile_visits_count')
+   ->withCount('followers as follower_count')
    ->with([...])

// UserPublicProfileResource.php
return [
    ...existing fields...
+   'follower_count' => (int) ($this->resource->follower_count ?? 0),
];
```

#### ➕ ADDING A NEW GIFT FIELD

| Step  | File                                             | What to Change                            |
| ----- | ------------------------------------------------ | ----------------------------------------- |
| **1** | `app/Http/Resources/V1/GiftReceivedResource.php` | Add field to `toArray()` return array     |
| **2** | `app/Services/User/UserProfileService.php`       | Ensure field is selected in query         |
| **3** | Update this documentation                        | Add field to GiftReceivedResource section |

Example: Adding `animation_url` field:

```diff
// GiftReceivedResource.php
return [
    'label' => $this->resource->label ?? $this->resource->name,
    'thumbnail_url' => $this->resource->full_thumbnail_url,
+   'animation_url' => $this->resource->full_animation_url,
    'rarity' => $this->resource->rarity,
    'total_quantity_received' => (int) $this->resource->total_quantity,
];
```

#### ➖ REMOVING A FIELD

| Step  | File                                  | What to Change               |
| ----- | ------------------------------------- | ---------------------------- |
| **1** | `UserPublicProfileResource.php`       | Remove from `toArray()`      |
| **2** | Remove from eager loads if applicable | Update controller `->with()` |
| **3** | Update this documentation             | Remove from response schema  |

### 🔗 Field Flow Dependency Chain

```
Request: GET /users/profile/3592010?per_page=15
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Controller: showPublicProfile()                                             │
│                                                                             │
│   $viewer = $request->user()                                                │
│   $signature = "3592010" (from route parameter)                             │
│                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           ▼                    ▼                    ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ User Query          │ │ProfileVisitService  │ │UserProfileService   │
│                     │ │                     │ │                     │
│ ->where(signature)  │ │ ->recordVisit(      │ │ ->getGiftsReceived( │
│ ->withCount()       │ │     $viewer,        │ │     $user->id,      │
│ ->with(relations)   │ │     $user           │ │     $perPage        │
│ ->first()           │ │ )                   │ │ )                   │
└─────────┬───────────┘ └─────────┬───────────┘ └─────────┬───────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ User model with:    │ │ ProfileVisit UPSERT │ │ CursorPaginator     │
│ - profile_visits_   │ │ (deduplicated)      │ │ <Gift> with         │
│   count             │ │                     │ │ total_quantity      │
│ - activeAgency...   │ └─────────────────────┘ │ aggregate           │
│ - room              │                         └─────────┬───────────┘
└─────────┬───────────┘                                   │
          │                                               │
          └───────────────────────┬───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ UserPublicProfileResource(user)->additional(['gifts_received' => paginator])│
│                                                                             │
│   Maps to: { id, name, signature, avatar, frame, gender, wealth_xp,         │
│              charm_xp, profile_visits, agency, room_id, gifts_received }    │
│                                                                             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ApiResponse::paginated() → HTTP 200 JSON                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                                  |
| --------------------------------- | ------------------------------------------------------- |
| `frame` hardcoded value           | Currently static; requires frontend coordination        |
| `wealth_xp`/`charm_xp` formatting | Uses 3 decimals; changing breaks API contract           |
| Profile visit deduplication logic | Daily window is intentional; changing affects analytics |
| Gift aggregation JOIN conditions  | Changing type/status filters affects data integrity     |
| `activeAgencyMembership` scope    | Only shows active memberships, by design                |

### 🚨 Common Pitfalls

| Pitfall                                          | Prevention                                                  |
| ------------------------------------------------ | ----------------------------------------------------------- |
| N+1 query for agency member count                | Consider caching or denormalizing count                     |
| Gift query slow for users with many transactions | Index `idx_transactions_gift_query` should be maintained    |
| Profile visit race conditions                    | UPSERT handles atomically; don't replace with select+insert |
| Including private user fields                    | `UserPublicProfileResource` explicitly whitelists fields    |
| Returning soft-deleted users                     | Add `->whereNull('deleted_at')` if privacy required         |
| Gift resource including id/price                 | `GiftReceivedResource` intentionally omits for privacy      |
| Agency member count on every request             | Consider adding `withCount` to agency relation or caching   |

### 📁 File Locations Quick Reference

```
routes/api/users.php                                  ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserController.php                              ← Controller with showPublicProfile()
app/Services/User/
  ├── ProfileVisitService.php                         ← Visit tracking with deduplication
  └── UserProfileService.php                          ← Gift aggregation service
app/Http/Resources/V1/
  ├── UserPublicProfileResource.php                   ← Main profile response transformer
  └── GiftReceivedResource.php                        ← Gift item transformer
app/Http/Responses/
  └── ApiErrorResponder.php                           ← Standardized error responses
app/Http/Utils/
  └── ApiResponse.php                                 ← Response envelope utility
app/Models/User/
  ├── User.php                                        ← User entity model
  └── ProfileVisit.php                                ← Visit tracking model
app/Models/Gift/
  └── Gift.php                                        ← Gift entity model
app/Models/Agency/
  └── Agency.php                                      ← Agency entity model
```

---

## Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `GET /api/v1/users/profile/{signature}` |
| **Domain**          | User                                    |
| **Author**          | System Documentation                    |
| **Created**         | 2026-01-27                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
