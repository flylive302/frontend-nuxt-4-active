# GET /api/v1/badges

> **Domain**: Progression  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

List all active badges in the system catalog, with optional filtering by category. This is a public endpoint used to display available badges to users.

### Responsibilities

- Return all active badges from the system
- Support filtering by badge category
- Cache results for performance optimization
- Transform badge data into consistent API format

### What It Owns

| Owned              | Description                                      |
| ------------------ | ------------------------------------------------ |
| Badge catalog read | Read-only access to active badges with filtering |

### External Dependencies

| Dependency | Type           | Purpose                                  |
| ---------- | -------------- | ---------------------------------------- |
| Redis      | Infrastructure | Caching badge lists (1 hour TTL)         |
| Database   | Infrastructure | Source of badge data from `badges` table |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/badges
```

### Authentication

❌ **None Required** - This is a public endpoint returning the badge catalog.

### Rate Limiting

| Limiter     | Key      | Config           |
| ----------- | -------- | ---------------- |
| Laravel API | IP-based | `config/app.php` |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Query Parameters

| Parameter  | Type     | Required | Description                                                     | Example  |
| ---------- | -------- | -------- | --------------------------------------------------------------- | -------- |
| `category` | `string` | ❌       | Filter by badge category (wealth, charm, room, agency, special) | `wealth` |

#### Valid Category Values

| Value     | Label   | Description           |
| --------- | ------- | --------------------- |
| `wealth`  | Wealth  | Wealth-related badges |
| `charm`   | Charm   | Charm-related badges  |
| `room`    | Room    | Room-related badges   |
| `agency`  | Agency  | Agency-related badges |
| `special` | Special | Special event badges  |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": 1, // integer, Badge unique ID
      "name": "Wealth Master", // string, Badge display name
      "description": "Earned by...", // string|null, Badge description
      "category": "wealth", // string, Category enum value
      "category_label": "Wealth", // string, Human-readable category
      "level": 5, // integer, Badge level/tier
      "image_url": "https://...", // string, Badge image URL
      "is_stackable": false, // boolean, Can be earned multiple times
      "metadata": null // object|null, Additional badge data
    }
  ]
}
```

#### Response Field Details

| Field            | Type           | Description                                |
| ---------------- | -------------- | ------------------------------------------ |
| `id`             | `integer`      | Unique badge identifier                    |
| `name`           | `string`       | Display name of the badge                  |
| `description`    | `string\|null` | Optional badge description                 |
| `category`       | `string`       | Badge category enum value                  |
| `category_label` | `string`       | Human-readable category label              |
| `level`          | `integer`      | Badge level/tier (0-based)                 |
| `image_url`      | `string`       | URL to badge image asset                   |
| `is_stackable`   | `boolean`      | Whether badge can be earned multiple times |
| `metadata`       | `object\|null` | Additional JSON metadata for the badge     |

### HTTP Status Codes

| Code  | Condition                     |
| ----- | ----------------------------- |
| `200` | Success - Returns badge array |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/badges?category=wealth                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:15                                              │
│ Route: Route::get('/', [BadgeController::class, 'index'])                   │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. api group middleware → Rate limiting, JSON responses                   │
│   (No auth middleware - public endpoint)                                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('badges')->group(function () {                            │ │
│ │     Route::get('/', [BadgeController::class, 'index']);                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED - NO FORM REQUEST                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint uses the generic Illuminate\Http\Request class.               │
│ No custom Form Request validation is needed as:                             │
│   - Category is an optional query parameter                                 │
│   - Invalid categories are silently ignored (returns all badges)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php           │
│ Method: index(Request $request): AnonymousResourceCollection                │
│                                                                             │
│ STEP 1: Extract optional category query parameter                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $category = $request->query('category');                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate category and delegate to service                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($category && BadgeCategory::tryFrom($category)) {                   │ │
│ │     $badges = $this->badgeService->getByCategory(                       │ │
│ │         BadgeCategory::from($category)                                  │ │
│ │     );                                                                  │ │
│ │ } else {                                                                │ │
│ │     $badges = $this->badgeService->getAllActive();                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return transformed collection                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return BadgeResource::collection($badges);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/BadgeService.php                             │
│                                                                             │
│ PATH A: getAllActive() (when no category or invalid category)               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getAllActive(): Collection                              │ │
│ │ {                                                                       │ │
│ │     return Cache::remember(                                             │ │
│ │         self::CACHE_PREFIX . 'all_active',                              │ │
│ │         self::CACHE_TTL,  // 3600 seconds = 1 hour                      │ │
│ │         function () {                                                   │ │
│ │             return Badge::active()->ordered()->get();                   │ │
│ │         }                                                               │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PATH B: getByCategory() (when valid category provided)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getByCategory(BadgeCategory $category): Collection      │ │
│ │ {                                                                       │ │
│ │     $cacheKey = self::CACHE_PREFIX . 'category:' . $category->value;    │ │
│ │                                                                         │ │
│ │     return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($category) { │
│ │         return Badge::getByCategory($category);                         │ │
│ │     });                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Cache Keys:                                                                 │
│   • badges:all_active          → All active badges                          │
│   • badges:category:wealth     → Wealth category badges                     │
│   • badges:category:charm      → Charm category badges                      │
│   • badges:category:room       → Room category badges                       │
│   • badges:category:agency     → Agency category badges                     │
│   • badges:category:special    → Special category badges                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: BadgeCategory (Enum)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/BadgeCategory.php                           │ │
│ │ Responsibility: Defines valid badge categories with metadata            │ │
│ │ Reusable: YES (used across badges, resources, filtering)                │ │
│ │ Why It Exists: Type-safe category handling with UI metadata             │ │
│ │                                                                         │ │
│ │ Cases: WEALTH, CHARM, ROOM, AGENCY, SPECIAL                             │ │
│ │ Key Methods:                                                            │ │
│ │   • label()  → Human-readable name                                      │ │
│ │   • color()  → UI color (warning, danger, info, success, purple)        │ │
│ │   • icon()   → Heroicon identifier                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Badge (Model)                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/Badge.php                                  │ │
│ │ Responsibility: Badge entity with scopes for querying                   │ │
│ │ Reusable: YES (used across badge-related endpoints)                     │ │
│ │ Why It Exists: Eloquent model for badges table                          │ │
│ │                                                                         │ │
│ │ Key Scopes:                                                             │ │
│ │   • scopeActive($query)   → Filters is_active = true                    │ │
│ │   • scopeOrdered($query)  → Orders by sort_order, then level            │ │
│ │   • scopeCategory($query) → Filters by category enum                    │ │
│ │                                                                         │ │
│ │ Static Methods:                                                         │ │
│ │   • getByCategory()  → Combined active + category + ordered             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeResource (API Resource)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Progression/BadgeResource.php               │ │
│ │ Responsibility: Transform Badge model to API response format            │ │
│ │ Reusable: YES (used in list, show, and category endpoints)              │ │
│ │ Why It Exists: Consistent badge JSON structure across endpoints         │ │
│ │                                                                         │ │
│ │ Fields Exposed:                                                         │ │
│ │   • id, name, description, category, category_label                     │ │
│ │   • level, image_url, is_stackable, metadata                            │ │
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
│ 1. GET: badges:all_active OR badges:category:{category} (TTL: 1 hour)       │
│    Source: BadgeService::getAllActive() / getByCategory()                   │
│    Hit: Returns cached Collection immediately                               │
│    Miss: Executes database query and stores result                          │
│                                                                             │
│ DATABASE OPERATIONS (only on cache miss):                                   │
│                                                                             │
│ 1. SELECT (All Active):                                                     │
│    Query: SELECT * FROM badges WHERE is_active = 1                          │
│           ORDER BY sort_order ASC, level ASC                                │
│    Source: Badge::active()->ordered()->get()                                │
│                                                                             │
│ 2. SELECT (By Category):                                                    │
│    Query: SELECT * FROM badges WHERE is_active = 1                          │
│           AND category = '{category}'                                       │
│           ORDER BY sort_order ASC, level ASC                                │
│    Source: Badge::getByCategory($category)                                  │
│                                                                             │
│ Database Table: badges                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ id              │ bigint unsigned, PK                                   │ │
│ │ name            │ varchar(100)                                          │ │
│ │ description     │ text, nullable                                        │ │
│ │ category        │ varchar(50), indexed                                  │ │
│ │ level           │ int, default 0                                        │ │
│ │ image_url       │ text                                                  │ │
│ │ is_active       │ boolean, default true, indexed                        │ │
│ │ is_stackable    │ boolean, default false                                │ │
│ │ sort_order      │ unsigned int, default 0, indexed                      │ │
│ │ metadata        │ json, nullable                                        │ │
│ │ created_at      │ timestamp                                             │ │
│ │ updated_at      │ timestamp                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Indexes: (category, level), is_active, sort_order                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Progression/BadgeResource.php                   │
│                                                                             │
│ The response uses Laravel's AnonymousResourceCollection:                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'description' => $this->description,                                │ │
│ │     'category' => $this->category->value,                               │ │
│ │     'category_label' => $this->category->label(),                       │ │
│ │     'level' => $this->level,                                            │ │
│ │     'image_url' => $this->image_url,                                    │ │
│ │     'is_stackable' => $this->is_stackable,                              │ │
│ │     'metadata' => $this->metadata,                                      │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Uses Laravel's default collection wrapper with "data" key             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 + JSON Body (data array)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                    | Used By Endpoints                             | Reusable | Reasoning                               |
| ----------------------- | --------------------------------------------- | -------- | --------------------------------------- |
| `BadgeController.php`   | All badge endpoints                           | ✅       | Central controller for badge operations |
| `BadgeService.php`      | All badge endpoints, award systems            | ✅       | Core badge business logic with caching  |
| `Badge.php`             | All badge-related features                    | ✅       | Model used across progression domain    |
| `BadgeResource.php`     | GET /badges, GET /badges/{id}                 | ✅       | Consistent badge response format        |
| `BadgeCategory.php`     | Badges, filtering, UI display, Filament admin | ✅       | Shared enum for category handling       |
| `routes/api/badges.php` | All badge API routes                          | ❌       | Route registration only                 |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

This endpoint does not produce validation errors - no required parameters.

### Business Logic Errors (400)

This endpoint does not produce business logic errors.

### System Errors (500)

| Error               | Source          | Condition                          |
| ------------------- | --------------- | ---------------------------------- |
| Database connection | Badge::get()    | Database unavailable               |
| Cache connection    | Cache::remember | Redis unavailable (will fall back) |

### Edge Cases

| Case                       | Behavior                                   |
| -------------------------- | ------------------------------------------ |
| No badges in database      | Returns empty array `{ "data": [] }`       |
| Invalid category parameter | Ignored - returns all active badges        |
| Empty category parameter   | Treated as no filter - returns all badges  |
| All badges inactive        | Returns empty array                        |
| Cache miss                 | Queries database, caches result for 1 hour |
| Redis unavailable          | Falls back to database query each time     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                 ROUTE                CONTROLLER              SERVICE                 CACHE                   DATABASE
   │                      │                      │                      │                      │                        │
   │  GET /api/v1/badges  │                      │                      │                      │                        │
   │  ?category=wealth    │                      │                      │                      │                        │
   │─────────────────────▶│                      │                      │                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │ 1. Route match       │                      │                      │                        │
   │                      │─────────────────────▶│                      │                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │ 2. Extract category  │                      │                        │
   │                      │                      │    from query        │                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │ 3. Validate category │                      │                        │
   │                      │                      │    enum              │                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │ 4. getByCategory()   │                      │                        │
   │                      │                      │─────────────────────▶│                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │                      │ 5. Cache::remember   │                        │
   │                      │                      │                      │─────────────────────▶│                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │                      │                      │ 6a. HIT: Return cached │
   │                      │                      │                      │◀─────────────────────│                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │                      │ 6b. MISS: Query DB   │                        │
   │                      │                      │                      │───────────────────────────────────────────────▶│
   │                      │                      │                      │◀──────────────────────────────────────────────│
   │                      │                      │                      │                      │                        │
   │                      │                      │                      │ 7. Store in cache    │                        │
   │                      │                      │                      │─────────────────────▶│                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │◀─────────────────────│                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │                      │ 8. BadgeResource     │                      │                        │
   │                      │                      │    ::collection()    │                      │                        │
   │                      │                      │                      │                      │                        │
   │                      │◀─────────────────────│                      │                      │                        │
   │◀─────────────────────│                      │                      │                      │                        │
   │                      │                      │                      │                      │                        │
   │  200 + JSON          │                      │                      │                      │                        │
   │                      │                      │                      │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition           | Location                                              |
| ------------------ | ----------------------------------------------------- |
| New badge category | `app/Enums/Progression/BadgeCategory.php`             |
| New response field | `app/Http/Resources/V1/Progression/BadgeResource.php` |
| New query filter   | `BadgeController::index()` + `BadgeService`           |
| New badge scope    | `app/Models/Progression/Badge.php`                    |
| Modify cache TTL   | `BadgeService::CACHE_TTL` constant                    |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD

| Step  | File                                                  | What to Change                 |
| ----- | ----------------------------------------------------- | ------------------------------ |
| **1** | **Database Migration**                                | Add column to `badges` table   |
| **2** | `app/Models/Progression/Badge.php`                    | Add to `$fillable` array       |
| **3** | `app/Models/Progression/Badge.php`                    | Add to `$casts` if needed      |
| **4** | `app/Http/Resources/V1/Progression/BadgeResource.php` | Add to `toArray()` return      |
| **5** | `BadgeService::clearCache()`                          | Call to invalidate cached data |

#### ➖ REMOVING A FIELD

| Step  | File                                                  | What to Change                    |
| ----- | ----------------------------------------------------- | --------------------------------- |
| **1** | `app/Http/Resources/V1/Progression/BadgeResource.php` | Remove from `toArray()` return    |
| **2** | `app/Models/Progression/Badge.php`                    | Remove from `$fillable`, `$casts` |
| **3** | **Database Migration**                                | Drop column (if safe)             |
| **4** | `BadgeService::clearCache()`                          | Call to invalidate cached data    |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW: badges table                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  DATABASE (badges)                                                          │
│       │                                                                     │
│       ▼                                                                     │
│  CACHE (badges:all_active, badges:category:*)                               │
│       │                                                                     │
│       ▼                                                                     │
│  MODEL (Badge.php)                                                          │
│    • $fillable                                                              │
│    • $casts                                                                 │
│       │                                                                     │
│       ▼                                                                     │
│  RESOURCE (BadgeResource.php)                                               │
│    • toArray() return                                                       │
│       │                                                                     │
│       ▼                                                                     │
│  JSON RESPONSE                                                              │
│                                                                             │
│  ⚠️ CRITICAL: Clear cache after any schema changes!                        │
│     Call: BadgeService::clearCache() or flush badges:* keys                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklist

- [ ] Update database migration if adding/removing columns
- [ ] Update `Badge::$fillable` for mass assignment
- [ ] Update `Badge::$casts` for type casting
- [ ] Update `BadgeResource::toArray()` for API response
- [ ] Clear badge cache after deployment
- [ ] Update API documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                   |
| --------------------------- | -------------------------------------------------------- |
| `BadgeCategory` enum values | Breaking change - existing badges reference these values |
| Cache key format            | Would cause cache misses on deployment                   |
| `BadgeResource` field names | Breaking API change - clients depend on these            |
| `is_active` scope logic     | Affects all badge visibility across the system           |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                            |
| -------------------------------------- | ----------------------------------------------------- |
| Adding category without enum case      | Always add to `BadgeCategory` enum first              |
| Forgetting to clear cache              | Call `BadgeService::clearCache()` after badge changes |
| Changing category enum value           | Never change - use new category instead               |
| Removing category with existing badges | Update all badges first, then remove category         |
| N+1 queries in resource                | Resource only uses model attributes, no relations     |

### 📁 File Locations Quick Reference

```
routes/api/badges.php                                ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php                            ← Controller
app/Services/Progression/
  └── BadgeService.php                               ← Business logic + caching
app/Models/Progression/
  └── Badge.php                                      ← Eloquent model
app/Enums/Progression/
  └── BadgeCategory.php                              ← Category enum
app/Http/Resources/V1/Progression/
  └── BadgeResource.php                              ← Response transformer
database/migrations/
  └── 2025_12_29_000002_create_badges_table.php      ← Database schema
```

---

## Document Metadata

| Property            | Value                |
| ------------------- | -------------------- |
| **Endpoint**        | `GET /api/v1/badges` |
| **Domain**          | Progression          |
| **Author**          | System Documentation |
| **Created**         | 2026-02-01           |
| **Laravel Version** | 12.x                 |
| **PHP Version**     | 8.4+                 |
