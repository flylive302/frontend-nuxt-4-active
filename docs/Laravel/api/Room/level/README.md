# GET /api/v1/rooms/{room}/level

> **Domain**: Room  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

The Room Level endpoint retrieves the level progression information for a specific room, including current XP, level, progress percentage to the next level, and whether the room has reached maximum level.

### Responsibilities

- Retrieve room's current level and XP
- Calculate progress percentage to next level
- Determine XP needed for next level
- Identify if room has reached maximum level

### What It Owns

| Owned               | Description                              |
| ------------------- | ---------------------------------------- |
| Level Progress      | Returns room's level progression data    |
| Progress Percentage | Calculated percentage towards next level |
| XP Calculations     | Computes XP needed for next level        |

### External Dependencies

| Dependency | Type           | Purpose                                               |
| ---------- | -------------- | ----------------------------------------------------- |
| PostgreSQL | Database       | Stores rooms and level_definitions tables (type=room) |
| Redis      | Infrastructure | Caches level definitions for 24 hours                 |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/{room}/level
```

### Authentication

❌ **None Required** - This is a public endpoint

### Rate Limiting

| Limiter | Key        | Config                        |
| ------- | ---------- | ----------------------------- |
| Global  | IP address | Default Laravel rate limiting |

### Request Headers

| Header         | Required | Type               | Description     |
| -------------- | -------- | ------------------ | --------------- |
| `Accept`       | ✅       | `application/json` | Response format |
| `Content-Type` | ❌       | N/A                | No request body |

### Path Parameters

| Parameter | Type      | Constraints      | Example |
| --------- | --------- | ---------------- | ------- |
| `room`    | `integer` | Required, exists | `123`   |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "room_id": "integer", // Room ID
    "current_level": "integer", // Current level number
    "current_xp": "float", // Total XP accumulated
    "next_level": "integer|null", // Next level number (null if max)
    "xp_for_next": "float|null", // XP threshold for next level
    "xp_needed": "float", // XP still needed (0 if max)
    "progress_percentage": "float", // 0.0 to 100.0, rounded to 1 decimal
    "is_max_level": "boolean" // True if already at maximum level
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Example Success Response

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "room_id": 123,
    "current_level": 5,
    "current_xp": 2500.0,
    "next_level": 6,
    "xp_for_next": 5000.0,
    "xp_needed": 2500.0,
    "progress_percentage": 50.0,
    "is_max_level": false
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Example Max Level Response

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "room_id": 123,
    "current_level": 10,
    "current_xp": 50000.0,
    "next_level": null,
    "xp_for_next": null,
    "xp_needed": 0,
    "progress_percentage": 0.0,
    "is_max_level": true
  },
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "Resource not found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                            |
| ----- | ------------------------------------ |
| `200` | Level data retrieved successfully    |
| `404` | Room not found (route model binding) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms/{room}/level                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:23                                     │
│ Route: Route::get('/{room}/level', [RoomController::class, 'level'])        │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. api  → Default API middleware group                                    │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Room::findOrFail($id)                                          │
│   • Throws ModelNotFoundException if room not found                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php                   │
│                                                                             │
│ No dedicated Form Request - uses route model binding only                   │
│ Room model is automatically resolved by Laravel                             │
│ RoomLevelService is injected via method dependency injection                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:280-294           │
│ Method: level(Room $room, RoomLevelService $levelService): JsonResponse     │
│                                                                             │
│ STEP 1: Delegate to service for progress calculation                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function level(Room $room, RoomLevelService $levelService):     │ │
│ │     JsonResponse                                                       │ │
│ │ {                                                                       │ │
│ │     $progress = $levelService->getRoomProgress($room->id);              │ │
│ │                                                                         │ │
│ │     if (isset($progress['error'])) {                                   │ │
│ │         return ApiResponse::notFound($progress['error']);               │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return ApiResponse::success($progress);                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ The controller:                                                             │
│   1. Calls RoomLevelService::getRoomProgress() with room ID                 │
│   2. Checks for error in response (legacy pattern, not currently used)     │
│   3. Returns via ApiResponse::success() or ApiResponse::notFound()          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomLevelService.php:99-140                         │
│ Method: getRoomProgress(int $roomId): array                                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getRoomProgress(int $roomId): array                     │ │
│ │ {                                                                       │ │
│ │     $room = Room::findOrFail($roomId);                                  │ │
│ │                                                                         │ │
│ │     $currentLevel = (int) $room->current_level;                         │ │
│ │     $currentXp = (float) $room->room_xp;                                │ │
│ │                                                                         │ │
│ │     // Use cached level definitions instead of separate queries        │ │
│ │     $allLevels = $this->getAllLevelDefinitions();                       │ │
│ │     $currentLevelDef = $allLevels->firstWhere('level', $currentLevel);  │ │
│ │     $nextLevelDef = $allLevels->where('level', '>', $currentLevel)      │ │
│ │                               ->first();                                │ │
│ │                                                                         │ │
│ │     $progress = 0;                                                      │ │
│ │     $xpNeeded = 0;                                                      │ │
│ │                                                                         │ │
│ │     if ($nextLevelDef) {                                                │ │
│ │         $currentThreshold = $currentLevelDef?->required_xp ?? 0;        │ │
│ │         $nextThreshold = $nextLevelDef->required_xp;                    │ │
│ │         $xpNeeded = $nextThreshold - $currentXp;                        │ │
│ │                                                                         │ │
│ │         if ($nextThreshold > $currentThreshold) {                       │ │
│ │             $progress = (($currentXp - $currentThreshold) /             │ │
│ │                         ($nextThreshold - $currentThreshold)) * 100;    │ │
│ │             $progress = max(0, min(100, $progress));                    │ │
│ │         }                                                               │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return [                                                            │ │
│ │         'room_id' => $roomId,                                           │ │
│ │         'current_level' => $currentLevel,                               │ │
│ │         'current_xp' => $currentXp,                                     │ │
│ │         'next_level' => $nextLevelDef?->level,                          │ │
│ │         'xp_for_next' => $nextLevelDef?->required_xp,                   │ │
│ │         'xp_needed' => $xpNeeded > 0 ? $xpNeeded : 0,                   │ │
│ │         'progress_percentage' => round($progress, 1),                   │ │
│ │         'is_max_level' => $nextLevelDef === null,                       │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Calculation Logic:                                                          │
│   • Fetches room by ID (findOrFail)                                         │
│   • Gets current level and XP from room model                               │
│   • Uses cached level definitions (24-hour TTL)                             │
│   • Finds current and next level definitions                                │
│   • Calculates progress percentage: (current XP - current threshold) /      │
│     (next threshold - current threshold) * 100                              │
│   • Clamps progress between 0-100%                                          │
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
│ │ Responsibility: Room data including XP and level fields                 │ │
│ │ Reusable: YES (used by all room operations)                             │ │
│ │ Why It Exists: Central model for room data                              │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • room_xp → decimal:4, room's total experience points                 │ │
│ │   • current_level → integer, room's current level                       │ │
│ │                                                                         │ │
│ │ Casts:                                                                  │ │
│ │   • 'room_xp' => 'decimal:4'                                            │ │
│ │   • 'current_level' => 'integer'                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: LevelDefinition (Model - Room Scope)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/LevelDefinition.php                        │ │
│ │ Responsibility: Level configuration (thresholds, badges, rewards)       │ │
│ │ Reusable: YES (used by wealth/charm/room level progression)             │ │
│ │ Why It Exists: Unified model for all level types with LevelType enum    │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • type → LevelType enum (wealth, charm, room)                         │ │
│ │   • level → integer, level number                                       │ │
│ │   • name → string, level name                                           │ │
│ │   • required_xp → decimal:4, XP needed to reach this level              │ │
│ │   • badge_id → nullable, badge awarded when reaching this level         │ │
│ │   • is_active → boolean, whether level is active                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopeRoom() → Filter to room level definitions                      │ │
│ │   • scopeActive() → Filter only active definitions                      │ │
│ │   • scopeOrdered() → Order by level ascending                           │ │
│ │   • getNextLevel() → Get next level definition                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomLevelService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomLevelService.php                            │ │
│ │ Responsibility: Room level progression and badge distribution           │ │
│ │ Reusable: YES (used by level endpoints and gift processing)             │ │
│ │ Why It Exists: Centralizes level calculation and caching logic          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getRoomProgress($roomId) → Get progress to next level               │ │
│ │   • getAllLevelDefinitions() → Get cached level definitions             │ │
│ │   • processRoomLevelUp($roomId) → Process level-up and award badges     │ │
│ │                                                                         │ │
│ │ Dependencies:                                                           │ │
│ │   • BadgeService → For awarding badges on level-up                      │ │
│ │   • MSABEventService → For emitting level-up events                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Wrap data in standard success response                  │ │
│ │   • notFound() → Return 404 error response                              │ │
│ │   • Adds timestamp and correlation_id to all responses                  │ │
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
│ 1. SELECT (Route Model Binding): Find room by ID                            │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT (Service): Fetch room again for level data                        │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: RoomLevelService::getRoomProgress()                              │
│    Note: Redundant query - room already resolved by route binding           │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET/SET: Level definitions cache                                         │
│    Key: room:level_definitions                                              │
│    TTL: 86400 seconds (24 hours)                                            │
│    Source: RoomLevelService::getAllLevelDefinitions()                       │
│    Pattern: Cache::remember()                                               │
│                                                                             │
│    If cache miss:                                                           │
│    Query: SELECT * FROM level_definitions                              │
│           WHERE type = 'room' AND is_active = true ORDER BY level ASC  │
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
│ 1. Service returns plain array with calculated values                       │
│ 2. Controller passes array directly to ApiResponse::success()               │
│ 3. No resource transformer used - raw array returned                        │
│ 4. ApiResponse adds meta with timestamp and correlation_id                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($progress);                                 │ │
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

| File                   | Used By Endpoints                           | Reusable | Reasoning                                              |
| ---------------------- | ------------------------------------------- | -------- | ------------------------------------------------------ |
| `RoomController.php`   | Room CRUD, join, level operations           | ⭕       | Controller-specific, but methods are reusable patterns |
| `RoomLevelService.php` | Level endpoint, gift processing (XP awards) | ✅       | Central service for room level progression             |
| `Room.php` (Model)     | All room operations                         | ✅       | Core data access model                                 |
| `LevelDefinition.php`  | Level endpoint, level-up processing         | ✅       | Unified level configuration model (room scope)         |
| `ApiResponse.php`      | All API endpoints                           | ✅       | Universal response utility                             |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

This endpoint has no request body validation - no 422 errors possible.

### Business Logic Errors (400)

This endpoint has no business logic errors - it's a read-only operation.

### System Errors (404)

| Error                | Source                | Condition                          |
| -------------------- | --------------------- | ---------------------------------- |
| "Resource not found" | Route Model Binding   | Room ID doesn't exist              |
| "Resource not found" | findOrFail in service | Room deleted between binding/query |

### System Errors (500)

| Error                   | Source       | Condition                   |
| ----------------------- | ------------ | --------------------------- |
| "Internal server error" | Database/App | Database connection failure |
| "Internal server error" | Redis/Cache  | Cache connection failure    |
| "Internal server error" | Database/App | Unexpected query exception  |

### Edge Cases

| Case                            | Behavior                                       |
| ------------------------------- | ---------------------------------------------- |
| Room at level 0                 | Returns level 0, shows progress to level 1     |
| Room at max level               | `is_max_level: true`, `next_level: null`       |
| Room XP exceeds max level       | Capped at 100% progress, is_max_level true     |
| No level definitions exist      | next_level null, progress 0, is_max_level true |
| All level definitions inactive  | Same as above - treated as max level           |
| Negative XP (data corruption)   | Progress clamped to 0 via max(0, ...)          |
| Cache miss on level definitions | Database query executed, cached for 24 hours   |
| Soft-deleted room               | 404 via route model binding                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              LARAVEL ROUTER         CONTROLLER              SERVICE LAYER                CACHE/DATABASE
   │                       │                       │                       │                            │
   │ GET /rooms/{id}/level │                       │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. Route Model        │                       │                            │
   │                       │    Binding            │                       │                            │
   │                       │───────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                       │     SELECT room            │
   │                       │◀──────────────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                            │
   │                       │ 2. Call level()       │                       │                            │
   │                       │   + inject service    │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 3. getRoomProgress()  │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 4. Fetch room              │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │   SELECT * FROM rooms      │
   │                       │                       │                       │   WHERE id = ?             │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. Check cache for         │
   │                       │                       │                       │    level definitions       │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │   GET room:level_defs      │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ (if cache miss)            │
   │                       │                       │                       │ 6. Query level definitions │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │   SELECT * FROM            │
   │                       │                       │                       │   room_level_definitions   │
   │                       │                       │                       │   WHERE is_active = true   │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. Cache level definitions │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │   SET room:level_defs TTL  │
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. Calculate progress      │
   │                       │                       │                       │    percentage locally      │
   │                       │                       │                       │                            │
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │  Array (progress data)│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 9. Wrap in ApiResponse::success()                  │
   │                       │                       │                       │                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  200 OK + JSON        │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                             |
| -------------------------- | ---------------------------------------------------- |
| Additional progress fields | `RoomLevelService::getRoomProgress()` return array   |
| Badge info in response     | Modify service to include current/next level badges  |
| Level benefits info        | Query additional_rewards from LevelDefinition (room) |
| Response caching           | Add Cache::remember() wrapper in controller          |
| Authentication requirement | Add `auth:sanctum` middleware to route               |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                     | What to Change                                   |
| ----- | ---------------------------------------- | ------------------------------------------------ |
| **1** | `app/Services/Room/RoomLevelService.php` | Add field to return array in `getRoomProgress()` |

Example - Adding level name:

```php
return [
    // ... existing fields
    'level_name' => $currentLevelDef?->name ?? 'Newcomer',
];
```

#### ➕ ADDING A NEW LEVEL FIELD

| Step  | File                                         | What to Change                         |
| ----- | -------------------------------------------- | -------------------------------------- |
| **1** | **Database Migration**                       | Add column to `room_level_definitions` |
| **2** | `app/Models/Progression/LevelDefinition.php` | Add to `$fillable`, add cast if needed |
| **3** | `app/Services/Room/RoomLevelService.php`     | Include in return array                |
| **4** | Clear cache                                  | `redis-cli DEL room:level_definitions` |

#### ➖ REMOVING A FIELD

| Step  | File                                     | What to Change           |
| ----- | ---------------------------------------- | ------------------------ |
| **1** | `app/Services/Room/RoomLevelService.php` | Remove from return array |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────┐
│   Database Columns          │
│  (rooms.room_xp,            │
│   rooms.current_level)      │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐      ┌──────────────────────────┐
│ LevelDefinition (room)      │
│   ($room->room_xp,          │◀────▶│  (level thresholds)      │
│    $room->current_level)    │      │  CACHED 24 hours         │
└────────────┬────────────────┘      └──────────────────────────┘
             │
             ▼
┌─────────────────────────────┐
│   RoomLevelService          │
│   (getRoomProgress())       │
│   - Calculates percentage   │
│   - Determines XP needed    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│   Controller                │
│   (returns raw array)       │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│   ApiResponse::success()    │
│   (adds meta)               │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│   JSON Response             │
└─────────────────────────────┘
```

### 📋 Field Modification Checklist

- [ ] Update service return array
- [ ] Clear level definitions cache if structure changed
- [ ] Update this documentation
- [ ] Test with room at level 0
- [ ] Test with room at max level
- [ ] Test with room mid-progress

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| `room:level_definitions` cache key | Other services may depend on this exact key            |
| 24-hour cache TTL                  | Shorter TTL increases DB load; longer risks stale data |
| Progress calculation formula       | Clients may depend on percentage accuracy              |
| Response field names               | Breaking change for API consumers                      |
| `is_max_level` logic               | Client UI may depend on this flag                      |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                                   |
| --------------------------------- | ------------------------------------------------------------ |
| Forgetting to clear cache         | Run `redis-cli DEL room:level_definitions` after changes     |
| Duplicate room query              | Consider refactoring to pass Room model to service           |
| Division by zero in progress calc | Already guarded by `if ($nextThreshold > $currentThreshold)` |
| Returning raw floats              | XP values cast to float, rounded appropriately               |
| Cache not warming after deploy    | First request will be slower (DB query)                      |
| Adding new level, cache stale     | Cache clears naturally in 24h or clear manually              |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:23                    ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                             ← Controller (level method)
app/Services/Room/
  └── RoomLevelService.php                           ← Service (getRoomProgress)
app/Models/Room/
  ├── Room.php                                       ← Room model (room_xp, current_level)
   └── LevelDefinition.php                                  ← Unified level configuration model
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/{room}/level` |
| **Domain**          | Room                             |
| **Author**          | System Documentation             |
| **Created**         | 2026-01-30                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4+                             |
