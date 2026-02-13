# GET /api/v1/bootstrap

> **Domain**: Infrastructure  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Bootstrap endpoint consolidates 6-8 initial API calls into a single request, providing all initialization data required for the mobile app startup. It returns authenticated user profile, level status, gift catalog, configuration, and user-specific data.

### Responsibilities

- Return authenticated user profile data
- Provide user's current level status (wealth and charm)
- Return gift catalog (cached)
- Provide system configuration and economy settings
- Return user's room data (if exists)
- Return user's displayed badges (max 5)
- Return agency membership info (if applicable)
- Return active income target (for agency members)

### What It Owns

| Owned              | Description                                            |
| ------------------ | ------------------------------------------------------ |
| Bootstrap Response | Aggregates data from multiple domains into one payload |
| Gift Catalog Cache | Caches active gifts for 15 minutes                     |
| Config Cache       | Caches system configuration for 1 hour                 |

### External Dependencies

| Dependency | Type           | Purpose                                  |
| ---------- | -------------- | ---------------------------------------- |
| Redis      | Infrastructure | Caching gifts, config, level definitions |
| Database   | Infrastructure | User data, gifts, levels, badges, agency |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/bootstrap
```

### Authentication

✅ **Required** - Bearer token via Sanctum middleware

### Rate Limiting

| Limiter   | Key       | Config              |
| --------- | --------- | ------------------- |
| (Default) | `user:id` | Laravel default API |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
No request body required (GET request)
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Bootstrap data retrieved successfully",
  "data": {
    "user": {
      "id": "integer",
      "name": "string",
      "signature": "string",
      "avatar": "string|null",
      "frame": "string|null",
      "phone": "string|null",          // E.164 format
      "country": "string|null",        // ISO 2-letter code
      "gender": "string|null",
      "date_of_birth": "string|null",  // YYYY-MM-DD
      "coins": "string",               // Integer as string
      "diamonds": "string",            // Integer as string
      "wealth_xp": "string",           // Integer as string
      "charm_xp": "string",            // Integer as string
      "is_profile_complete": "boolean",
      "is_blocked": "boolean",
      "blocked_at": "string|null",     // ISO 8601
      "blocked_reason": "string|null",
      "locked_until": "string|null"    // ISO 8601
    },
    "user_data": {
      "levels": {
        "wealth": {
          "current_level": "integer",
          "level_name": "string",
          "current_xp": "float",
          "xp_for_next_level": "float",
          "xp_remaining": "float",
          "progress_percentage": "float",
          "badge": {
            "id": "integer",
            "name": "string",
            "image_url": "string"
          },
          "next_level": {
            "level": "integer",
            "name": "string",
            "required_xp": "float"
          }
        },
        "charm": { "..." }  // Same structure as wealth
      },
      "active_income_target": "object|null",
      "room": "object|null",
      "badges": "array",     // Max 5 displayed badges
      "agency": "object|null"
    },
    "gifts": {
      "catalog": "array",
      "total": "integer"
    },
    "config": {
      "api_version": "string",
      "economy": {
        "room_owner_percentage": "float",
        "receiver_percentage": "float"
      },
      "wealth_levels": "array",
      "charm_levels": "array",
      "room_levels": "array",
      "level_badges": "array",
      "vapid_public_key": "string|null"
    }
  },
  "meta": {
    "timestamp": "2026-02-02T03:08:23.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                   |
| ----- | ------------------------------------------- |
| `200` | Success                                     |
| `401` | Missing or invalid authentication token     |
| `500` | Server error (DB connection, cache failure) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/bootstrap                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/bootstrap.php:17                                           │
│ Route: Route::get('bootstrap', [BootstrapController::class, 'index'])       │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Laravel Sanctum                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::get('bootstrap', [BootstrapController::class, 'index'])      │ │
│ │         ->name('bootstrap');                                            │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 NO FORM REQUEST (Direct Controller Entry)                               │
│─────────────────────────────────────────────────────────────────────────────│
│ No custom FormRequest class - uses standard Illuminate\Http\Request         │
│ Authentication is handled by auth:sanctum middleware                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Infrastructure/BootstrapController.php    │
│ Method: index(Request $request)                                             │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Load user relationships (eager loading)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->loadMissing([                                                    │ │
│ │     'room',                                                             │ │
│ │     'activeAgencyMembership.agency',                                    │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get active income target (if agency member)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $activeIncomeTarget = null;                                             │ │
│ │ $membership = $user->activeAgencyMembership;                            │ │
│ │                                                                         │ │
│ │ if ($membership?->isActive()) {                                         │ │
│ │     $activeIncomeTarget = $user->activeIncomeTarget()                   │ │
│ │         ?->with('definition')                                           │ │
│ │         ?->first();                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Build and return response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'user' => new BootstrapUserResource($user),                         │ │
│ │     'user_data' => [...],                                               │ │
│ │     'gifts' => $this->getGiftsData(),                                   │ │
│ │     'config' => $this->getConfig(),                                     │ │
│ │ ], 'Bootstrap data retrieved successfully');                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: LevelService                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/LevelService.php                         │ │
│ │                                                                         │ │
│ │ Method: getUserLevelStatus(User $user)                                  │ │
│ │   → Returns wealth and charm level status arrays                        │ │
│ │   → Calls getLevelStatusForType() for each level type                   │ │
│ │   → Uses LevelDefinition::getLevelForXp() to find current level         │ │
│ │   → Calculates progress percentage                                      │ │
│ │                                                                         │ │
│ │ Method: getLevelConfigurationWithBadgeRefs()                            │ │
│ │   → Returns wealth_levels, charm_levels, room_levels, level_badges      │ │
│ │   → Uses getLevelDefinitions() which queries DB (cached 24h)            │ │
│ │   → Deduplicates badges across all level types                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SERVICE: SystemSettingService                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/SystemSettingService.php                 │ │
│ │                                                                         │ │
│ │ Method: getRoomOwnerPercentage()                                        │ │
│ │   → Calls getGiftSettings() internally                                  │ │
│ │   → Returns cached gift.room_owner_percentage setting                   │ │
│ │                                                                         │ │
│ │ Method: getReceiverPercentage()                                         │ │
│ │   → Calls getGiftSettings() internally                                  │ │
│ │   → Returns cached gift.receiver_percentage setting                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: BootstrapUserResource (API Resource)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php              │ │
│ │ Responsibility: Transform User model for bootstrap response             │ │
│ │ Reusable: YES (used by bootstrap endpoint only but could be reused)     │ │
│ │ Why It Exists: Returns 19 fields optimized for app initialization       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns user fields with formatting                     │ │
│ │   • getRawPhone() → Formats phone to E.164                              │ │
│ │   • isProfileComplete() → Checks required fields                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: GiftResource (API Resource)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Gift/GiftResource.php                       │ │
│ │ Responsibility: Transform Gift model for API response                   │ │
│ │ Reusable: YES (used by multiple gift-related endpoints)                 │ │
│ │ Why It Exists: Consistent gift representation across API                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns 12 gift fields                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomResource (API Resource)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomResource.php                       │ │
│ │ Responsibility: Transform Room model for API response                   │ │
│ │ Reusable: YES (used by room listing, details, bootstrap)                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns 16 room fields with owner info                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserBadgeResource (API Resource)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Progression/UserBadgeResource.php           │ │
│ │ Responsibility: Transform UserBadge model for API response              │ │
│ │ Reusable: YES (used by badge endpoints and bootstrap)                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns badge with nested BadgeResource                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyIncomeTargetResource (API Resource)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyIncomeTargetResource.php       │ │
│ │ Responsibility: Transform income target for agency members              │ │
│ │ Reusable: YES (used by agency endpoints and bootstrap)                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Returns 18 income target fields                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardize API response format                         │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Returns JSON with status, message, data, meta           │ │
│ │   • error() → Returns error response format                             │ │
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
│ 1. SELECT: Get user's room                                                  │
│    Query: SELECT * FROM rooms WHERE user_id = ?                             │
│    Source: $user->loadMissing(['room'])                                     │
│                                                                             │
│ 2. SELECT: Get user's active agency membership                              │
│    Query: SELECT * FROM agency_members WHERE user_id = ? AND status = ?     │
│    Source: $user->loadMissing(['activeAgencyMembership.agency'])            │
│                                                                             │
│ 3. SELECT: Get active income target (conditional)                           │
│    Query: SELECT * FROM agency_income_targets WHERE user_id = ? AND ...     │
│    Source: $user->activeIncomeTarget()->with('definition')->first()         │
│                                                                             │
│ 4. SELECT: Get current wealth level                                         │
│    Query: SELECT * FROM level_definitions WHERE type = 'wealth' AND ...     │
│    Source: LevelDefinition::getLevelForXp(LevelType::WEALTH, $xp)           │
│                                                                             │
│ 5. SELECT: Get current charm level                                          │
│    Query: SELECT * FROM level_definitions WHERE type = 'charm' AND ...      │
│    Source: LevelDefinition::getLevelForXp(LevelType::CHARM, $xp)            │
│                                                                             │
│ 6. SELECT: Get user's displayed badges (max 5)                              │
│    Query: SELECT * FROM user_badges WHERE user_id = ? AND is_displayed ...  │
│    Source: UserBadge::where('user_id', $userId)->displayed()...             │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET/SET: bootstrap:gifts (TTL: 900s / 15 minutes)                        │
│    Source: BootstrapController::getGiftsData()                              │
│    Fallback: Gift::active()->orderBy('sort_order')->take(30)->get()         │
│                                                                             │
│ 2. GET/SET: bootstrap:gifts_total (TTL: 900s / 15 minutes)                  │
│    Source: BootstrapController::getGiftsData()                              │
│    Fallback: Gift::active()->count()                                        │
│                                                                             │
│ 3. GET/SET: bootstrap:config (TTL: 3600s / 1 hour)                          │
│    Source: BootstrapController::getConfig()                                 │
│    Fallback: Aggregates level config and system settings                    │
│                                                                             │
│ 4. GET/SET: levels:wealth:definitions (TTL: 86400s / 24 hours)              │
│    Source: LevelService::getLevelDefinitions()                              │
│    Fallback: LevelDefinition::ofType($type)->active()->ordered()...         │
│                                                                             │
│ 5. GET/SET: levels:charm:definitions (TTL: 86400s / 24 hours)               │
│    Source: LevelService::getLevelDefinitions()                              │
│                                                                             │
│ 6. GET/SET: levels:room:definitions (TTL: 86400s / 24 hours)                │
│    Source: LevelService::getLevelDefinitions()                              │
│                                                                             │
│ 7. GET/SET: gift_distribution_settings (TTL: 3600s / 1 hour)                │
│    Source: SystemSettingService::getGiftSettings()                          │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│   None                                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response is built via ApiResponse::success():                               │
│                                                                             │
│ 1. User data → BootstrapUserResource                                        │
│ 2. User levels → LevelService::getUserLevelStatus()                         │
│ 3. Income target → AgencyIncomeTargetResource (if applicable)               │
│ 4. Room → RoomResource (if user has room)                                   │
│ 5. Badges → UserBadgeResource::collection() (max 5)                         │
│ 6. Agency → Inline array construction in getAgencyMembershipData()          │
│ 7. Gifts → GiftResource::collection() + total count                         │
│ 8. Config → Inline array with level configs and economy settings            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'user' => new BootstrapUserResource($user),                         │ │
│ │     'user_data' => [                                                    │ │
│ │         'levels' => $this->levelService->getUserLevelStatus($user),     │ │
│ │         'active_income_target' => $activeIncomeTarget                   │ │
│ │             ? new AgencyIncomeTargetResource($activeIncomeTarget)       │ │
│ │             : null,                                                     │ │
│ │         'room' => $user->room                                           │ │
│ │             ? new RoomResource($user->room) : null,                     │ │
│ │         'badges' => $this->getUserDisplayedBadges($user->id),           │ │
│ │         'agency' => $this->getAgencyMembershipData($membership),        │ │
│ │     ],                                                                  │ │
│ │     'gifts' => $this->getGiftsData(),                                   │ │
│ │     'config' => $this->getConfig(),                                     │ │
│ │ ], 'Bootstrap data retrieved successfully');                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 + JSON Body                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                             | Used By Endpoints                      | Reusable | Reasoning                            |
| -------------------------------- | -------------------------------------- | -------- | ------------------------------------ |
| `BootstrapController.php`        | `/api/v1/bootstrap`                    | ❌       | Endpoint-specific aggregation logic  |
| `LevelService.php`               | Bootstrap, profile, room endpoints     | ✅       | Core level calculation logic         |
| `SystemSettingService.php`       | Bootstrap, gift processing, agency     | ✅       | System-wide settings access          |
| `BootstrapUserResource.php`      | `/api/v1/bootstrap`                    | ❌       | Optimized for bootstrap (19 fields)  |
| `GiftResource.php`               | Bootstrap, gift listing, gift sending  | ✅       | Generic gift transformation          |
| `RoomResource.php`               | Bootstrap, room listing, room details  | ✅       | Generic room transformation          |
| `UserBadgeResource.php`          | Bootstrap, badge listing, badge toggle | ✅       | Generic user badge transformation    |
| `AgencyIncomeTargetResource.php` | Bootstrap, agency dashboard            | ✅       | Generic income target transformation |
| `ApiResponse.php`                | ALL endpoints                          | ✅       | Standardized API response format     |
| `Gift.php` (Model)               | Bootstrap, gift endpoints              | ✅       | Core gift model with scopes          |
| `LevelDefinition.php` (Model)    | Bootstrap, level endpoints             | ✅       | Core level definition model          |
| `UserBadge.php` (Model)          | Bootstrap, badge endpoints             | ✅       | Core user badge model with scopes    |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                           |
| ----- | ------ | ----------------------------------- |
| N/A   | N/A    | No request body validation required |

### Business Logic Errors (400)

| Error | Source | Condition                    |
| ----- | ------ | ---------------------------- |
| N/A   | N/A    | No business logic validation |

### Authentication Errors (401)

| Error             | Source         | Condition                       |
| ----------------- | -------------- | ------------------------------- |
| "Unauthenticated" | `auth:sanctum` | Missing or invalid bearer token |
| "Unauthenticated" | `auth:sanctum` | Expired token                   |
| "Unauthenticated" | `auth:sanctum` | Token revoked                   |

### System Errors (500)

| Error                   | Source        | Condition             |
| ----------------------- | ------------- | --------------------- |
| "Database connection"   | Eloquent      | DB connection failure |
| "Redis connection"      | Cache facade  | Redis unavailable     |
| "Internal server error" | Any component | Unhandled exception   |

### Edge Cases

| Case                         | Behavior                                           |
| ---------------------------- | -------------------------------------------------- |
| User has no room             | `user_data.room` returns `null`                    |
| User not in agency           | `user_data.agency` returns `null`                  |
| User has no income target    | `user_data.active_income_target` returns `null`    |
| User has no displayed badges | `user_data.badges` returns empty array             |
| User at max level            | `levels.next_level` returns `null`, progress = 100 |
| User at level 0 (beginner)   | `current_level` = 0, `level_name` = "Beginner"     |
| Gifts cache empty            | Fresh query to DB, results cached                  |
| Config cache empty           | Fresh aggregation, results cached                  |
| Agency membership inactive   | Treated as non-agency user                         |
| User has more than 5 badges  | Only top 5 displayed badges returned               |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                AUTH:SANCTUM            CONTROLLER              LEVEL_SERVICE           SYSTEM_SETTINGS          CACHE                  DATABASE
   │                       │                       │                       │                       │                       │                       │
   │  GET /bootstrap       │                       │                       │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │                       │
   │                       │ 1. Validate token     │                       │                       │                       │                       │
   │                       │──────────────────────▶│                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │                       │
   │                       │                       │ 2. Get user from      │                       │                       │                       │
   │                       │                       │    request            │                       │                       │                       │
   │                       │                       │──────────────────────────────────────────────────────────────────────▶│                       │
   │                       │                       │◀──────────────────────────────────────────────────────────────────────│                       │
   │                       │                       │                       │                       │                       │                       │
   │                       │                       │ 3. Load relationships │                       │                       │                       │
   │                       │                       │    (room, agency)     │                       │                       │                       │
   │                       │                       │─────────────────────────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀─────────────────────────────────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                       │                       │                       │
   │                       │                       │ 4. Get user level status                      │                       │                       │
   │                       │                       │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │ 5. Query levels       │                       │                       │
   │                       │                       │                       │─────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                       │◀─────────────────────────────────────────────────────────────────────│
   │                       │                       │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │                       │                       │
   │                       │                       │ 6. Get displayed      │                       │                       │                       │
   │                       │                       │    badges             │                       │                       │                       │
   │                       │                       │─────────────────────────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀─────────────────────────────────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                       │                       │                       │
   │                       │                       │ 7. Get gifts (cache)  │                       │                       │                       │
   │                       │                       │─────────────────────────────────────────────────────────────────────▶│                       │
   │                       │                       │◀─────────────────────────────────────────────────────────────────────│ (cache hit)           │
   │                       │                       │                       │                       │                       │                       │
   │                       │                       │ 8. Get config (cache) │                       │                       │                       │
   │                       │                       │─────────────────────────────────────────────────────────────────────▶│                       │
   │                       │                       │                       │                       │                       │ (cache miss?)         │
   │                       │                       │                       │ 9. Get level config   │                       │                       │
   │                       │                       │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │ 10. Get settings      │                       │
   │                       │                       │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │◀──────────────────────│                       │                       │
   │                       │                       │◀─────────────────────────────────────────────────────────────────────│                       │
   │                       │                       │                       │                       │                       │                       │
   │                       │ 11. Return response   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │                       │                       │
   │◀──────────────────────│                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │                       │
   │  200 + JSON           │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                           |
| -------------------------- | -------------------------------------------------- |
| New user field in response | `BootstrapUserResource::toArray()`                 |
| New user_data section      | `BootstrapController::index()` → `user_data` array |
| New config value           | `BootstrapController::getConfig()`                 |
| New gift field             | `GiftResource::toArray()`                          |
| New level type             | `LevelType` enum + `LevelService` modifications    |
| New cache for bootstrap    | `BootstrapController` (use consistent TTL pattern) |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO USER RESPONSE

| Step  | File                                                   | What to Change                   |
| ----- | ------------------------------------------------------ | -------------------------------- |
| **1** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Add field to `toArray()` return  |
| **2** | `app/Models/User/User.php`                             | Ensure field exists (if from DB) |

#### ➕ ADDING A NEW SECTION TO user_data

| Step  | File                                                                 | What to Change                |
| ----- | -------------------------------------------------------------------- | ----------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Infrastructure/BootstrapController.php` | Add to `user_data` array      |
| **2** | Create Resource (if complex data)                                    | New resource in Resources/V1/ |
| **3** | Update this documentation                                            | Add new section details       |

#### ➕ ADDING A NEW CONFIG VALUE

| Step  | File                                                                 | What to Change                      |
| ----- | -------------------------------------------------------------------- | ----------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Infrastructure/BootstrapController.php` | Add to `getConfig()` return         |
| **2** | Clear cache                                                          | `Cache::forget('bootstrap:config')` |

#### ➖ REMOVING A FIELD

| Step  | File                                                     | What to Change                 |
| ----- | -------------------------------------------------------- | ------------------------------ |
| **1** | `BootstrapUserResource.php` or `BootstrapController.php` | Remove field from array        |
| **2** | Clear relevant cache                                     | `Cache::forget('bootstrap:*')` |
| **3** | Update frontend                                          | Remove field usage             |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BOOTSTRAP RESPONSE FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Model ──────────▶ BootstrapUserResource ──────────▶ response.user     │
│       │                                                                     │
│       ├── room ─────────────▶ RoomResource ─────────────▶ user_data.room    │
│       │                                                                     │
│       ├── activeAgencyMembership ──▶ inline array ──────▶ user_data.agency  │
│       │                                                                     │
│       └── activeIncomeTarget ───▶ AgencyIncomeTargetResource               │
│                                  └──────────────────────▶ user_data.active_income_target
│                                                                             │
│  LevelService ─────────────────────────────────────────▶ user_data.levels   │
│       └── LevelDefinition model (cached)                                    │
│                                                                             │
│  UserBadge Model ─────▶ UserBadgeResource ─────────────▶ user_data.badges   │
│       └── Badge model (eager loaded)                                        │
│                                                                             │
│  Gift Model (cached) ──▶ GiftResource ─────────────────▶ gifts.catalog      │
│                                                                             │
│  LevelService ─────────────────────────────────────────▶ config.wealth_levels
│       │                                                  config.charm_levels
│       │                                                  config.room_levels
│       └──────────────────────────────────────────────▶ config.level_badges  │
│                                                                             │
│  SystemSettingService ─────────────────────────────────▶ config.economy     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Cache Handling Checklist

- [ ] Identify affected cache key (`bootstrap:gifts`, `bootstrap:config`, etc.)
- [ ] Clear cache after modification: `Cache::forget('key')`
- [ ] Update cache TTL if needed (in controller)
- [ ] Test cache hit/miss scenarios

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                              |
| ------------------------- | --------------------------------------------------- |
| Response structure        | Mobile apps depend on exact structure               |
| Cache keys                | Would orphan existing cached data                   |
| `auth:sanctum` middleware | Security - authentication requirement               |
| `ApiResponse::success()`  | Used by ALL endpoints - changes affect everything   |
| Level calculation logic   | Core business logic - affects XP/progression system |
| Gift `active()` scope     | Determines which gifts are shown to users           |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                           |
| --------------------------------------- | ---------------------------------------------------- |
| Forgetting to clear cache after changes | Always clear relevant cache keys after modifications |
| Adding N+1 queries                      | Use `loadMissing()` or `with()` for relationships    |
| Breaking mobile app compatibility       | Coordinate response structure changes with frontend  |
| Exceeding response payload size         | Keep gift limit reasonable (default: 30)             |
| Cache TTL too long for dynamic data     | Use shorter TTL for frequently changing data         |
| Not handling null agency membership     | Always check `$membership?->isActive()` before use   |

### 📁 File Locations Quick Reference

```
routes/api/bootstrap.php                                     ← Route definition

app/Http/Controllers/Api/V1/Infrastructure/
  └── BootstrapController.php                                ← Controller

app/Services/Progression/
  ├── LevelService.php                                       ← Level calculations
  └── SystemSettingService.php                               ← System settings

app/Http/Resources/V1/Auth/
  └── BootstrapUserResource.php                              ← User transformer

app/Http/Resources/V1/Gift/
  └── GiftResource.php                                       ← Gift transformer

app/Http/Resources/V1/Room/
  └── RoomResource.php                                       ← Room transformer

app/Http/Resources/V1/Progression/
  └── UserBadgeResource.php                                  ← Badge transformer

app/Http/Resources/V1/Agency/
  └── AgencyIncomeTargetResource.php                         ← Income target transformer

app/Http/Utils/
  └── ApiResponse.php                                        ← Response utility

app/Models/Gift/
  └── Gift.php                                               ← Gift model

app/Models/Progression/
  ├── LevelDefinition.php                                    ← Level definition model
  └── UserBadge.php                                          ← User badge model
```

---

## Document Metadata

| Property            | Value                   |
| ------------------- | ----------------------- |
| **Endpoint**        | `GET /api/v1/bootstrap` |
| **Domain**          | Infrastructure          |
| **Author**          | System Documentation    |
| **Created**         | 2026-02-02              |
| **Laravel Version** | 12.x                    |
| **PHP Version**     | 8.4                     |
