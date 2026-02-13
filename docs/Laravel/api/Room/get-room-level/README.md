# GET /api/v1/rooms/{room}/level

> **Domain**: Room  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves the current level status and XP progress for a specific room, including progress towards the next level.

### Responsibilities

- Fetch room's current level and XP from database
- Calculate progress percentage towards next level
- Return level progression data including next level threshold
- Utilize cached level definitions for performance

### What It Owns

| Owned                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| Room level progress query | Retrieves and calculates room level progress |

### External Dependencies

| Dependency | Type           | Purpose                                |
| ---------- | -------------- | -------------------------------------- |
| Database   | Infrastructure | Query room and level definitions       |
| Cache      | Infrastructure | Cached level definitions (24-hour TTL) |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/{room}/level
```

### Authentication

❌ **None Required** - This is a public endpoint

### Rate Limiting

| Limiter | Key      | Config    |
| ------- | -------- | --------- |
| Default | IP-based | 60/minute |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### URL Parameters

| Parameter | Type      | Required | Description                   |
| --------- | --------- | -------- | ----------------------------- |
| `room`    | `integer` | ✅       | Room ID (route model binding) |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "room_id": "integer", // Room's unique identifier
    "current_level": "integer", // Room's current level number
    "current_xp": "float", // Room's accumulated XP
    "next_level": "integer|null", // Next level number (null if max level)
    "xp_for_next": "float|null", // XP required for next level (null if max)
    "xp_needed": "float", // XP remaining to reach next level
    "progress_percentage": "float", // Progress to next level (0-100)
    "is_max_level": "boolean" // Whether room is at max level
  },
  "meta": {
    "timestamp": "2026-02-01T18:26:41.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Room\\Room]",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T18:26:41.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                       |
| ----- | ------------------------------- |
| `200` | Room level progress retrieved   |
| `404` | Room not found                  |
| `500` | Server error (database failure) |

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
│ Route Configuration:                                                        │
│   • Prefix: /api/v1/rooms                                                   │
│   • Route Model Binding: {room} → Room model                                │
│   • Middleware: None (public endpoint)                                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('rooms')->group(function () {                             │ │
│ │     Route::get('/{room}/members', [RoomMemberController::class, 'index']);│
│ │     Route::get('/{room}/level', [RoomController::class, 'level']);      │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel Framework: Implicit Route Model Binding                             │
│                                                                             │
│ The {room} parameter is automatically resolved to a Room model:             │
│   • Laravel fetches Room::findOrFail($roomId)                               │
│   • If not found, throws ModelNotFoundException → 404 response              │
│   • Room model injected into controller method                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Automatic binding by Laravel                                         │ │
│ │ $room = Room::findOrFail($roomId);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:285-294           │
│ Method: level(Room $room, RoomLevelService $levelService)                   │
│                                                                             │
│ STEP 1: Call RoomLevelService to get room progress                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function level(Room $room, RoomLevelService $levelService)       │ │
│ │ {                                                                       │ │
│ │     $progress = $levelService->getRoomProgress($room->id);              │ │
│ │                                                                         │ │
│ │     if (isset($progress['error'])) {                                    │ │
│ │         return ApiResponse::notFound($progress['error']);               │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return ApiResponse::success($progress);                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Dependencies Injected:                                                      │
│   • Room $room → Resolved via route model binding                           │
│   • RoomLevelService $levelService → Resolved via service container         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomLevelService.php:104-140                        │
│ Method: getRoomProgress(int $roomId): array                                 │
│                                                                             │
│ STEP 1: Fetch room entity                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::findOrFail($roomId);                                      │ │
│ │ $currentLevel = (int) $room->current_level;                             │ │
│ │ $currentXp = (float) $room->room_xp;                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get cached level definitions                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $allLevels = $this->getAllLevelDefinitions();                           │ │
│ │ $currentLevelDef = $allLevels->firstWhere('level', $currentLevel);      │ │
│ │ $nextLevelDef = $allLevels->where('level', '>', $currentLevel)->first();│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Calculate progress percentage                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($nextLevelDef) {                                                    │ │
│ │     $currentThreshold = $currentLevelDef?->required_xp ?? 0;            │ │
│ │     $nextThreshold = $nextLevelDef->required_xp;                        │ │
│ │     $xpNeeded = $nextThreshold - $currentXp;                            │ │
│ │                                                                         │ │
│ │     if ($nextThreshold > $currentThreshold) {                           │ │
│ │         $progress = (($currentXp - $currentThreshold) /                 │ │
│ │                      ($nextThreshold - $currentThreshold)) * 100;       │ │
│ │         $progress = max(0, min(100, $progress));                        │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Build and return progress array                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'room_id' => $roomId,                                               │ │
│ │     'current_level' => $currentLevel,                                   │ │
│ │     'current_xp' => $currentXp,                                         │ │
│ │     'next_level' => $nextLevelDef?->level,                              │ │
│ │     'xp_for_next' => $nextLevelDef?->required_xp,                       │ │
│ │     'xp_needed' => $xpNeeded > 0 ? $xpNeeded : 0,                       │ │
│ │     'progress_percentage' => round($progress, 1),                       │ │
│ │     'is_max_level' => $nextLevelDef === null,                           │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomLevelService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomLevelService.php                            │ │
│ │ Responsibility: Room level progression and XP calculations              │ │
│ │ Reusable: PARTIALLY (room-specific level logic)                         │ │
│ │ Why It Exists: Centralize room level calculations and caching           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getRoomProgress() → Returns room level, XP, and progress            │ │
│ │   • getAllLevelDefinitions() → Cached level definitions (24h TTL)       │ │
│ │   • processRoomLevelUp() → Handle level-up and badge distribution       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Room (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/Room.php                                          │ │
│ │ Responsibility: Room entity with level and XP attributes                │ │
│ │ Reusable: YES (core room model used everywhere)                         │ │
│ │ Why It Exists: Eloquent model for rooms table                           │ │
│ │                                                                         │ │
│ │ Key Attributes:                                                         │ │
│ │   • room_xp → Accumulated room experience points (decimal:4)            │ │
│ │   • current_level → Room's current level (integer)                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: LevelDefinition (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/LevelDefinition.php                        │ │
│ │ Responsibility: Unified level thresholds for wealth/charm/room          │ │
│ │ Reusable: YES (shared across all level types)                           │ │
│ │ Why It Exists: DRY level definitions with type discrimination           │ │
│ │                                                                         │ │
│ │ Key Attributes:                                                         │ │
│ │   • type → LevelType enum (WEALTH, CHARM, ROOM)                         │ │
│ │   • level → Level number                                                │ │
│ │   • required_xp → XP threshold for this level                           │ │
│ │   • badge_id → Optional badge reward for reaching level                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Helper Utility)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent API response structure                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Standard success response with data + meta              │ │
│ │   • notFound() → 404 error response                                     │ │
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
│ 1. SELECT (Route Model Binding): Fetch room by ID                           │
│    Query: SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL LIMIT 1   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET/SET: room:level_definitions (86400 seconds TTL)                      │
│    Source: RoomLevelService::getAllLevelDefinitions()                       │
│    Miss Query: SELECT * FROM level_definitions                              │
│                WHERE type = 'room' AND is_active = true                     │
│                ORDER BY level                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ Response built directly from service return array:                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Success',                                             │ │
│ │     'data' => $progress,  // Array from service                         │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ No API Resource used - raw array returned directly                          │
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

| File                   | Used By Endpoints                    | Reusable | Reasoning                                         |
| ---------------------- | ------------------------------------ | -------- | ------------------------------------------------- |
| `RoomController.php`   | Room CRUD, join, level               | ⭕       | Contains multiple room actions; `level` is simple |
| `RoomLevelService.php` | Room level, room level-up processing | ⭕       | Room-specific but reusable within room domain     |
| `LevelDefinition.php`  | Wealth, charm, room level endpoints  | ✅       | Unified model for all level types                 |
| `Room.php`             | All room endpoints                   | ✅       | Core room model                                   |
| `ApiResponse.php`      | All API endpoints                    | ✅       | Global response utility                           |

---

## 5. Error Handling & Edge Cases

### Not Found Errors (404)

| Error           | Source               | Condition                    |
| --------------- | -------------------- | ---------------------------- |
| Model not found | Route Model Binding  | Room with given ID not found |
| Room not found  | `Room::findOrFail()` | Room ID invalid in service   |

### System Errors (500)

| Error                      | Source                     | Condition               |
| -------------------------- | -------------------------- | ----------------------- |
| Database connection failed | Room/LevelDefinition query | Database unavailable    |
| Cache connection failed    | `getAllLevelDefinitions()` | Redis/cache unavailable |

### Edge Cases

| Case                        | Behavior                                             |
| --------------------------- | ---------------------------------------------------- |
| Room at max level           | `is_max_level: true`, `next_level: null`             |
| Room at level 0             | Progress calculated from 0 threshold                 |
| No level definitions cached | Fresh query to database, then cached                 |
| Room XP exceeds next level  | Progress clamped to 100%, awaits level-up processing |
| Deleted room (soft deleted) | Route model binding returns 404                      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                ROUTE BINDING           CONTROLLER           ROOMLEVELSERVICE            CACHE                  DATABASE
   │                        │                      │                       │                      │                        │
   │  GET /rooms/{id}/level │                      │                       │                      │                        │
   │───────────────────────▶│                      │                       │                      │                        │
   │                        │                      │                       │                      │                        │
   │                        │ 1. Room::findOrFail  │                       │                      │                        │
   │                        │──────────────────────────────────────────────────────────────────────────────────────────────▶│
   │                        │◀──────────────────────────────────────────────────────────────────────────────────────────────│
   │                        │     Room model       │                       │                      │                        │
   │                        │                      │                       │                      │                        │
   │                        │ 2. Inject Room       │                       │                      │                        │
   │                        │─────────────────────▶│                       │                      │                        │
   │                        │                      │                       │                      │                        │
   │                        │                      │ 3. getRoomProgress()  │                      │                        │
   │                        │                      │──────────────────────▶│                      │                        │
   │                        │                      │                       │                      │                        │
   │                        │                      │                       │ 4. Room::findOrFail  │                        │
   │                        │                      │                       │────────────────────────────────────────────────▶│
   │                        │                      │                       │◀────────────────────────────────────────────────│
   │                        │                      │                       │                      │                        │
   │                        │                      │                       │ 5. Cache::remember   │                        │
   │                        │                      │                       │─────────────────────▶│                        │
   │                        │                      │                       │                      │ (hit/miss)             │
   │                        │                      │                       │◀─────────────────────│                        │
   │                        │                      │                       │                      │                        │
   │                        │                      │                       │ 6. (If cache miss)   │                        │
   │                        │                      │                       │     LevelDefinition  │                        │
   │                        │                      │                       │───────────────────────────────────────────────▶│
   │                        │                      │                       │◀───────────────────────────────────────────────│
   │                        │                      │                       │                      │                        │
   │                        │                      │ 7. Progress array     │                      │                        │
   │                        │                      │◀──────────────────────│                      │                        │
   │                        │                      │                       │                      │                        │
   │                        │ 8. ApiResponse       │                       │                      │                        │
   │                        │◀─────────────────────│                       │                      │                        │
   │                        │                      │                       │                      │                        │
   │  200 + JSON            │                      │                       │                      │                        │
   │◀───────────────────────│                      │                       │                      │                        │
   │                        │                      │                       │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                                           |
| --------------------- | -------------------------------------------------- |
| New response field    | `RoomLevelService::getRoomProgress()` return array |
| Level-up notification | `RoomLevelService::processRoomLevelUp()`           |
| Cache invalidation    | Clear `room:level_definitions` cache key           |
| New level type        | Add to `LevelType` enum + seed data                |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                     | What to Change                                   |
| ----- | ---------------------------------------- | ------------------------------------------------ |
| **1** | `app/Services/Room/RoomLevelService.php` | Add field to return array in `getRoomProgress()` |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                     | What to Change                                  |
| ----- | ---------------------------------------- | ----------------------------------------------- |
| **1** | `app/Services/Room/RoomLevelService.php` | Remove from return array in `getRoomProgress()` |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          RESPONSE FIELD SOURCES                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Room Model (rooms table)         LevelDefinition (Cached)                  │
│   ├─ room_xp ────────────────────▶ current_xp                                │
│   └─ current_level ──────────────▶ current_level                             │
│                                                                              │
│   LevelDefinition (Cached)         Calculated Fields                         │
│   ├─ level ──────────────────────▶ next_level                                │
│   ├─ required_xp ────────────────▶ xp_for_next                               │
│   │                                                                          │
│   │   Calculation:                                                           │
│   │   ├─ xp_for_next - current_xp ─▶ xp_needed                               │
│   │   ├─ ((current_xp - threshold) / range) * 100 ─▶ progress_percentage     │
│   │   └─ next_level === null ─────▶ is_max_level                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                        |
| ---------------------------------- | --------------------------------------------- |
| Cache key `room:level_definitions` | Changing invalidates all cached level data    |
| Room model `room_xp` cast          | Must stay `decimal:4` for precision           |
| Progress calculation formula       | UI clients depend on 0-100 percentage range   |
| Route model binding                | Breaking change for all clients using room ID |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| Forgetting to clear cache after seeding | Run `php artisan cache:clear` after level definition changes  |
| Division by zero in progress calc       | Already guarded by `$nextThreshold > $currentThreshold` check |
| Duplicate room query                    | Service refetches room - consider passing model instead       |
| Stale level definitions                 | Cache TTL is 24 hours - plan deployments accordingly          |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php            ← Route definition (line 23)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                  ← Controller (lines 285-294)
app/Services/Room/
  └── RoomLevelService.php                ← Business logic (lines 104-140)
app/Models/Room/
  └── Room.php                            ← Room model
app/Models/Progression/
  └── LevelDefinition.php                 ← Level definitions model
app/Http/Utils/
  └── ApiResponse.php                     ← Response formatting
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/{room}/level` |
| **Domain**          | Room                             |
| **Author**          | System Documentation             |
| **Created**         | 2026-02-01                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4                              |
