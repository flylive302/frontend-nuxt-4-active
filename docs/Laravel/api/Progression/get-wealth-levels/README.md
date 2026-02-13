# GET /api/v1/levels/wealth

> **Domain**: Progression  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves all wealth level definitions, providing threshold requirements and associated badge references for the progression system.

### Responsibilities

- Return all active wealth level configurations
- Provide XP thresholds for each level
- Include badge_id references for level rewards
- Cache responses for optimal performance (24-hour TTL)

### What It Owns

| Owned             | Description                                  |
| ----------------- | -------------------------------------------- |
| Level Definitions | Read-only access to `level_definitions` data |
| Cache Key         | `levels:wealth:definitions`                  |

### External Dependencies

| Dependency | Type           | Purpose                      |
| ---------- | -------------- | ---------------------------- |
| Redis      | Infrastructure | 24-hour cache for level data |
| MySQL      | Database       | Level definitions source     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/levels/wealth
```

### Authentication

❌ **None Required** - Level thresholds are public information

### Rate Limiting

| Limiter | Key      | Config             |
| ------- | -------- | ------------------ |
| Default | IP-based | Standard API limit |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Request Body Schema

```
No request body - GET request
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Wealth levels retrieved",
  "data": {
    "levels": [
      {
        "level": 1,
        "name": "string",
        "required_xp": 0.0,
        "badge_id": "integer|null"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-02-01T18:13:51.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field                  | Type      | Description                       |
| ---------------------- | --------- | --------------------------------- | --------------------------- |
| `levels`               | `array`   | Array of level definition objects |
| `levels[].level`       | `integer` | Level number (1, 2, 3, ...)       |
| `levels[].name`        | `string`  | Display name for the level        |
| `levels[].required_xp` | `float`   | XP threshold to reach this level  |
| `levels[].badge_id`    | `integer  | null`                             | Associated badge ID, if any |

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-02-01T18:13:51.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                            |
| ----- | ------------------------------------ |
| `200` | Levels retrieved successfully        |
| `500` | Database or cache connection failure |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/levels/wealth                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/levels.php:18                                              │
│ Route: Route::get('/wealth', [LevelController::class, 'wealthLevels'])     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('levels')->group(function () {                            │ │
│ │     Route::get('/wealth', [LevelController::class, 'wealthLevels'])     │ │
│ │         ->name('levels.wealth');                                        │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain: NONE (public endpoint)                                    │
│ Authentication: NOT REQUIRED                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/LevelController.php:44        │
│                                                                             │
│ No Form Request - this is a simple GET endpoint with no parameters          │
│ Controller method is invoked directly                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/LevelController.php           │
│ Method: wealthLevels()                                                      │
│                                                                             │
│ STEP 1: Constructor injects LevelService via dependency injection           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function __construct(                                            │ │
│ │     protected LevelService $levelService                                │ │
│ │ ) {}                                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call service to get full level configuration                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $config = $this->levelService->getLevelConfiguration();                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Extract wealth_levels and return via ApiResponse                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'levels' => $config['wealth_levels'],                               │ │
│ │ ], 'Wealth levels retrieved');                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: LevelService                                                       │
│ File: app/Services/Progression/LevelService.php                             │
│                                                                             │
│ Method: getLevelConfiguration():111-117                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getLevelConfiguration(): array                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'wealth_levels' => $this->formatLevelDefinitions(               │ │
│ │             $this->getLevelDefinitions(LevelType::WEALTH)               │ │
│ │         ),                                                              │ │
│ │         'charm_levels' => $this->formatLevelDefinitions(                │ │
│ │             $this->getLevelDefinitions(LevelType::CHARM)                │ │
│ │         ),                                                              │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Method: getLevelDefinitions(LevelType $type):83-90 (CACHED)                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getLevelDefinitions(LevelType $type): Collection        │ │
│ │ {                                                                       │ │
│ │     $cacheKey = self::CACHE_PREFIX . $type->value . ':definitions';     │ │
│ │     // Cache key: "levels:wealth:definitions"                           │ │
│ │                                                                         │ │
│ │     return Cache::remember($cacheKey, self::CACHE_TTL, function () {    │ │
│ │         return LevelDefinition::ofType($type)                           │ │
│ │             ->active()                                                  │ │
│ │             ->ordered()                                                 │ │
│ │             ->with('badge')                                             │ │
│ │             ->get();                                                    │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Method: formatLevelDefinitions(Collection $levels):149-157                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ protected function formatLevelDefinitions(Collection $levels): array    │ │
│ │ {                                                                       │ │
│ │     return $levels->map(fn (LevelDefinition $level) => [                │ │
│ │         'level' => $level->level,                                       │ │
│ │         'name' => $level->name,                                         │ │
│ │         'required_xp' => (float) $level->required_xp,                   │ │
│ │         'badge_id' => $level->badge_id,                                 │ │
│ │     ])->values()->toArray();                                            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: LevelType (Enum)                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/LevelType.php                               │ │
│ │ Responsibility: Define level type constants (WEALTH, CHARM, ROOM)       │ │
│ │ Reusable: YES (used across entire progression system)                   │ │
│ │ Why It Exists: Type-safe level categorization                           │ │
│ │                                                                         │ │
│ │ Key Values:                                                             │ │
│ │   • WEALTH = 'wealth'                                                   │ │
│ │   • CHARM = 'charm'                                                     │ │
│ │   • ROOM = 'room'                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: LevelDefinition (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/LevelDefinition.php                        │ │
│ │ Responsibility: Unified level definition model for all level types     │ │
│ │ Reusable: YES (used by all level-related endpoints)                     │ │
│ │ Why It Exists: Single source of truth for level configurations         │ │
│ │                                                                         │ │
│ │ Key Scopes Used:                                                        │ │
│ │   • scopeOfType(LevelType) → filter by level type                       │ │
│ │   • scopeActive() → only is_active=true records                         │ │
│ │   • scopeOrdered() → order by level number                              │ │
│ │                                                                         │ │
│ │ Relationships:                                                          │ │
│ │   • badge() → BelongsTo Badge (eager loaded in service)                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used across entire API)                                  │ │
│ │ Why It Exists: Consistent response structure with metadata              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → wrap data in success response with meta                 │ │
│ │   • getCorrelationId() → generate/extract request correlation ID        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET: "levels:wealth:definitions" (TTL: 86400 seconds / 24 hours)         │
│    Source: LevelService::getLevelDefinitions()                              │
│    Hit: Return cached Collection<LevelDefinition>                           │
│    Miss: Execute database query and cache result                            │
│                                                                             │
│ DATABASE OPERATIONS (only on cache miss):                                   │
│                                                                             │
│ 1. SELECT: Level definitions for wealth type                                │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM level_definitions                                     │  │
│    │ WHERE type = 'wealth'                                               │  │
│    │   AND is_active = 1                                                 │  │
│    │ ORDER BY level ASC                                                  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: LevelDefinition::ofType()->active()->ordered()                   │
│                                                                             │
│ 2. SELECT (Eager Load): Associated badges                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM badges                                                │  │
│    │ WHERE id IN (badge_ids from level_definitions)                      │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│    Source: ->with('badge') eager loading                                    │
│                                                                             │
│ NOTE: This endpoint fetches BOTH wealth and charm levels due to             │
│ getLevelConfiguration() implementation, but only returns wealth.            │
│ This is an optimization opportunity if needed.                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ Controller returns ApiResponse::success() with:                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Wealth levels retrieved',                             │ │
│ │     'data' => [                                                         │ │
│ │         'levels' => [...formatted level definitions...]                 │ │
│ │     ],                                                                  │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
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

| File                  | Used By Endpoints                                   | Reusable | Reasoning                                      |
| --------------------- | --------------------------------------------------- | -------- | ---------------------------------------------- |
| `LevelController.php` | `/levels/wealth`, `/levels/charm`, `/levels/config` | ⭕       | Controller contains multiple related endpoints |
| `LevelService.php`    | All level endpoints, user profile, bootstrap        | ✅       | Central service for all level operations       |
| `LevelDefinition.php` | Progression system, badges, user leveling           | ✅       | Core model for level data                      |
| `LevelType.php`       | Entire progression domain                           | ✅       | Enum used across all level-related code        |
| `ApiResponse.php`     | All API endpoints                                   | ✅       | Global utility for response formatting         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                    |
| ----- | ------ | -------------------------------------------- |
| N/A   | N/A    | No input validation - GET with no parameters |

### Business Logic Errors (400)

| Error | Source | Condition                         |
| ----- | ------ | --------------------------------- |
| N/A   | N/A    | No business logic errors possible |

### System Errors (500)

| Error                   | Source          | Condition                       |
| ----------------------- | --------------- | ------------------------------- |
| "Internal server error" | Database        | Connection failure              |
| "Internal server error" | Redis           | Cache connection failure        |
| "Internal server error" | LevelDefinition | Invalid data format in database |

### Edge Cases

| Case                         | Behavior                                         |
| ---------------------------- | ------------------------------------------------ |
| No wealth levels in database | Returns empty `levels` array                     |
| All levels are inactive      | Returns empty `levels` array                     |
| Cache miss                   | Queries database, caches result for 24 hours     |
| Level without badge          | `badge_id` is `null` in response                 |
| Multiple concurrent requests | First request populates cache, others use cached |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                CONTROLLER              LEVEL SERVICE              CACHE                   DATABASE
    │                       │                       │                       │                         │
    │  GET /levels/wealth   │                       │                       │                         │
    │──────────────────────▶│                       │                       │                         │
    │                       │                       │                       │                         │
    │                       │ 1. wealthLevels()     │                       │                         │
    │                       │──────────────────────▶│                       │                         │
    │                       │                       │                       │                         │
    │                       │                       │ 2. getLevelConfiguration()                      │
    │                       │                       │ calls getLevelDefinitions()                     │
    │                       │                       │                       │                         │
    │                       │                       │ 3. Cache::remember()  │                         │
    │                       │                       │──────────────────────▶│                         │
    │                       │                       │                       │                         │
    │                       │                       │   [CACHE HIT]         │                         │
    │                       │                       │◀──────────────────────│                         │
    │                       │                       │   return cached data  │                         │
    │                       │                       │                       │                         │
    │                       │                       │   [CACHE MISS]        │                         │
    │                       │                       │                       │ 4. SELECT level_definitions
    │                       │                       │                       │────────────────────────▶│
    │                       │                       │                       │◀────────────────────────│
    │                       │                       │                       │ 5. SELECT badges        │
    │                       │                       │                       │────────────────────────▶│
    │                       │                       │                       │◀────────────────────────│
    │                       │                       │                       │ 6. Store in cache       │
    │                       │                       │◀──────────────────────│                         │
    │                       │                       │                       │                         │
    │                       │                       │ 7. formatLevelDefinitions()                     │
    │                       │                       │                       │                         │
    │                       │ 8. Return config      │                       │                         │
    │                       │◀──────────────────────│                       │                         │
    │                       │                       │                       │                         │
    │                       │ 9. Extract wealth_levels                      │                         │
    │                       │    ApiResponse::success()                     │                         │
    │                       │                       │                       │                         │
    │  200 + JSON           │                       │                       │                         │
    │◀──────────────────────│                       │                       │                         │
    │                       │                       │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                           |
| --------------------------- | -------------------------------------------------- |
| New level field in response | `LevelService::formatLevelDefinitions()`           |
| Additional metadata         | `LevelController::wealthLevels()` response object  |
| Filtering by level range    | Add request params + filter in service             |
| Include full badge data     | Modify `formatLevelDefinitions()` to include badge |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                         | What to Change                          |
| ----- | -------------------------------------------- | --------------------------------------- |
| **1** | **Database Migration**                       | Add column to `level_definitions`       |
| **2** | `app/Models/Progression/LevelDefinition.php` | Add to `$fillable` and `$casts`         |
| **3** | `app/Services/Progression/LevelService.php`  | Add to `formatLevelDefinitions()` array |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                        | What to Change                         |
| ----- | ------------------------------------------- | -------------------------------------- |
| **1** | `app/Services/Progression/LevelService.php` | Remove from `formatLevelDefinitions()` |
| **2** | **Database Migration**                      | Drop column (if safe)                  |

### 🔗 Field Flow Dependency Chain

```
Database (level_definitions)
         │
         ▼
┌─────────────────────────────┐
│ LevelDefinition Model       │
│ $fillable, $casts           │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ LevelService                │
│ formatLevelDefinitions()    │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ LevelController             │
│ wealthLevels()              │
└─────────────────────────────┘
         │
         ▼
    API Response
```

### ⚠️ What Should NOT Be Modified Casually

| Component                               | Reason                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| `LevelService::getLevelConfiguration()` | Shared by multiple endpoints (wealth, charm, config)        |
| Cache key format                        | Changing key format will cause cache invalidation issues    |
| `ApiResponse` structure                 | Global response format used by all endpoints                |
| `LevelType` enum values                 | Database stores these values; changing breaks existing data |

### 🚨 Common Pitfalls

| Pitfall                                        | Prevention                                             |
| ---------------------------------------------- | ------------------------------------------------------ |
| Forgetting to clear cache after level changes  | Use `LevelService::clearCache()` in admin operations   |
| Adding eager loads without updating cache      | Regenerate cache after model relationship changes      |
| Modifying response without versioning          | Consider API versioning for breaking changes           |
| Fetching both level types when only one needed | Optimization: create separate cached methods if needed |

### 📁 File Locations Quick Reference

```
routes/api/levels.php                                       ← Route definition
app/Http/Controllers/Api/V1/Progression/
   └── LevelController.php                                  ← Controller
app/Services/Progression/
   └── LevelService.php                                     ← Business logic + caching
app/Models/Progression/
   └── LevelDefinition.php                                  ← Eloquent model
app/Enums/Progression/
   └── LevelType.php                                        ← Level type enum
app/Http/Utils/
   └── ApiResponse.php                                      ← Response utility
```

---

## Document Metadata

| Property            | Value                       |
| ------------------- | --------------------------- |
| **Endpoint**        | `GET /api/v1/levels/wealth` |
| **Domain**          | Progression                 |
| **Author**          | System Documentation        |
| **Created**         | 2026-02-01                  |
| **Laravel Version** | 12.x                        |
| **PHP Version**     | 8.4                         |
