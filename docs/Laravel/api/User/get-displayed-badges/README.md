# GET /api/v1/user/badges/displayed

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Returns only the badges that the authenticated user has chosen to display on their profile. This filters from all earned badges to show only those with `is_displayed = true`.

### Responsibilities

- Authenticate user via Sanctum token
- Retrieve user's displayed badges from database
- Eager load badge details for each user badge
- Transform data through API resources

### What It Owns

| Owned                 | Description                                         |
| --------------------- | --------------------------------------------------- |
| Displayed badge query | Queries `user_badges` where `is_displayed = true`   |
| User badge collection | Returns collection of displayed `UserBadge` records |

### External Dependencies

| Dependency | Type           | Purpose                              |
| ---------- | -------------- | ------------------------------------ |
| MySQL      | Database       | Store user badges and badge metadata |
| Sanctum    | Authentication | Validate Bearer token                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/badges/displayed
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key          | Config             |
| ------- | ------------ | ------------------ |
| `api`   | IP / User ID | 60 requests/minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
No request body - GET request
```

### Query Parameters

```
None
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": "integer", // UserBadge ID
      "badge": {
        "id": "integer", // Badge ID
        "name": "string", // Badge name
        "description": "string", // Badge description
        "category": "string", // Badge category value (e.g., "social")
        "category_label": "string", // Human-readable category (e.g., "Social")
        "level": "integer", // Badge level
        "image_url": "string|null", // URL to badge image
        "is_stackable": "boolean", // Whether badge can be earned multiple times
        "metadata": "object|null" // Additional badge metadata
      },
      "source_type": "string", // How badge was earned (e.g., "room_participation")
      "source_id": "integer|null", // ID of related source entity
      "earned_at": "string", // ISO 8601 timestamp
      "is_displayed": true // Always true for this endpoint
    }
  ]
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                       |
| ----- | ------------------------------- |
| `200` | Displayed badges retrieved      |
| `401` | Missing or invalid Bearer token |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/badges/displayed                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:22                                              │
│ Route: Route::get('/displayed', [BadgeController::class, 'displayedBadges'])│
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token via Laravel Sanctum             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 AUTHENTICATION MIDDLEWARE                                               │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel Sanctum validates the Authorization header Bearer token.            │
│ If invalid/missing → 401 Unauthenticated response                           │
│ If valid → User instance attached to request                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php:98-110    │
│ Method: displayedBadges(Request $request)                                   │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return UserBadgeResource::collection([]);                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Retrieve displayed badges via service                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userId = $user->id;                                                    │ │
│ │ $badges = $this->badgeService->getDisplayedBadges($userId);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return as resource collection                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return UserBadgeResource::collection($badges);                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/BadgeService.php:135-144                     │
│ Method: getDisplayedBadges(int $userId)                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getDisplayedBadges(int $userId): Collection             │ │
│ │ {                                                                       │ │
│ │     return UserBadge::where('user_id', $userId)                         │ │
│ │         ->displayed()                                                   │ │
│ │         ->with('badge')                                                 │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key operations:                                                             │
│   • Filter by user_id                                                       │
│   • Apply displayed() scope (is_displayed = true)                           │
│   • Eager load badge relationship to avoid N+1                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UserBadge (Model)                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/UserBadge.php                              │ │
│ │ Responsibility: Represents user badge ownership                         │ │
│ │ Reusable: YES (used across badge endpoints)                             │ │
│ │ Why It Exists: Track which badges a user has earned                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopeDisplayed() → Filter where is_displayed = true                 │ │
│ │   • badge() → BelongsTo relationship to Badge model                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Badge (Model)                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/Badge.php                                  │ │
│ │ Responsibility: Represents badge definition                             │ │
│ │ Reusable: YES (used by all badge endpoints)                             │ │
│ │ Why It Exists: Define badge metadata and categories                     │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • name, description, category, level                                  │ │
│ │   • image_url, is_stackable, metadata                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeCategory (Enum)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/BadgeCategory.php                           │ │
│ │ Responsibility: Define badge category types                             │ │
│ │ Reusable: YES                                                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable category name                              │ │
│ │   • color() → Category color                                            │ │
│ │   • icon() → Category icon                                              │ │
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
│ 1. SELECT: Get displayed user badges                                        │
│    Query: SELECT * FROM user_badges                                         │
│           WHERE user_id = ? AND is_displayed = true                         │
│    Source: BadgeService::getDisplayedBadges()                               │
│                                                                             │
│ 2. SELECT: Eager load badge relationship                                    │
│    Query: SELECT * FROM badges WHERE id IN (...)                            │
│    Source: with('badge') eager loading                                      │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ None - Displayed badges are user-specific and not cached                    │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ None                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UserBadgeResource                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Progression/UserBadgeResource.php           │ │
│ │                                                                         │ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'badge' => new BadgeResource($this->whenLoaded('badge')),           │ │
│ │     'source_type' => $this->source_type,                                │ │
│ │     'source_id' => $this->source_id,                                    │ │
│ │     'earned_at' => $this->earned_at->toIso8601String(),                 │ │
│ │     'is_displayed' => $this->is_displayed,                              │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeResource (nested)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Progression/BadgeResource.php               │ │
│ │                                                                         │ │
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

| File                           | Used By Endpoints                 | Reusable | Reasoning                                  |
| ------------------------------ | --------------------------------- | -------- | ------------------------------------------ |
| `BadgeController.php`          | All badge endpoints               | ⭕       | Controller is shared; methods are distinct |
| `BadgeService.php`             | All badge endpoints               | ✅       | Service layer encapsulates badge logic     |
| `UserBadge.php` (Model)        | All user badge endpoints          | ✅       | Core model for user badge ownership        |
| `Badge.php` (Model)            | All badge endpoints               | ✅       | Core model for badge definitions           |
| `UserBadgeResource.php`        | User badge list, displayed badges | ✅       | Shared resource for user badge responses   |
| `BadgeResource.php`            | All badge endpoints               | ✅       | Shared resource for badge details          |
| `scopeDisplayed()` (UserBadge) | Displayed badges endpoint only    | ❌       | Single purpose - filters displayed badges  |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                      |
| ----- | ------ | ---------------------------------------------- |
| N/A   | N/A    | No validation - GET request with no parameters |

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| `Unauthenticated.` | `auth:sanctum` | Missing or invalid Bearer token |

### Business Logic Errors (400)

| Error | Source | Condition                                                                      |
| ----- | ------ | ------------------------------------------------------------------------------ |
| N/A   | N/A    | No business logic errors - returns empty array if user has no displayed badges |

### System Errors (500)

| Error                     | Source   | Condition            |
| ------------------------- | -------- | -------------------- |
| Database connection error | Eloquent | Database unavailable |

### Edge Cases

| Case                            | Behavior                                    |
| ------------------------------- | ------------------------------------------- |
| User has no badges              | Returns empty data array `[]`               |
| User has badges, none displayed | Returns empty data array `[]`               |
| User is null (impossible case)  | Returns empty array (handled in controller) |
| Badge relationship deleted      | `badge` field will be empty object `{}`     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                       │                       │                       │
   │  GET /user/badges/    │                       │                       │                       │
   │     displayed         │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │    validate token     │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. Get user ID        │                       │
   │                       │                       │    from request       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. Call service       │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. Query user_badges  │
   │                       │                       │                       │    with displayed()   │
   │                       │                       │                       │───────────────────────▶
   │                       │                       │                       │◀───────────────────────
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. Eager load badges  │
   │                       │                       │                       │───────────────────────▶
   │                       │                       │                       │◀───────────────────────
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. Transform via      │                       │
   │                       │                       │    UserBadgeResource  │                       │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  200 OK + JSON        │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                         | Location                                               |
| -------------------------------- | ------------------------------------------------------ |
| New filter (e.g., by category)   | Controller method + Service method                     |
| New response field               | `UserBadgeResource.php` or `BadgeResource.php`         |
| Caching displayed badges         | `BadgeService::getDisplayedBadges()`                   |
| Sorting options                  | Controller query parameters + Service method           |
| Limit number of displayed badges | `BadgeService::getDisplayedBadges()` - add query limit |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                      | What to Change                          |
| ----- | --------------------------------------------------------- | --------------------------------------- |
| **1** | Database Migration                                        | Add column to `user_badges` or `badges` |
| **2** | `app/Models/Progression/UserBadge.php` or `Badge.php`     | Add to `$fillable` and `$casts`         |
| **3** | `app/Http/Resources/V1/Progression/UserBadgeResource.php` | Add field to `toArray()` output         |
| **4** | Or `app/Http/Resources/V1/Progression/BadgeResource.php`  | Add field if it belongs to badge        |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                      | What to Change                  |
| ----- | --------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Progression/UserBadgeResource.php` | Remove from `toArray()` output  |
| **2** | Or `app/Http/Resources/V1/Progression/BadgeResource.php`  | Remove from nested badge output |
| **3** | Database Migration (if safe)                              | Drop column                     |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────┐
│ user_badges table   │
│  • id               │
│  • user_id          │
│  • badge_id         │──────────┐
│  • source_type      │          │
│  • source_id        │          │
│  • earned_at        │          │
│  • is_displayed ◄───────── Scope filter
└─────────────────────┘          │
          │                      │
          ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│ UserBadgeResource   │  │ badges table        │
│  • id               │  │  • id               │
│  • badge────────────┼─▶│  • name             │
│  • source_type      │  │  • description      │
│  • source_id        │  │  • category         │──▶ BadgeCategory enum
│  • earned_at        │  │  • level            │
│  • is_displayed     │  │  • image_url        │
└─────────────────────┘  │  • is_stackable     │
                         │  • metadata         │
                         └─────────────────────┘
                                  │
                                  ▼
                         ┌─────────────────────┐
                         │ BadgeResource       │
                         │  • id               │
                         │  • name             │
                         │  • description      │
                         │  • category         │
                         │  • category_label   │
                         │  • level            │
                         │  • image_url        │
                         │  • is_stackable     │
                         │  • metadata         │
                         └─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                          |
| ----------------------------- | ----------------------------------------------- |
| `scopeDisplayed()` logic      | Changes filter criteria for displayed badges    |
| `is_displayed` column         | Core toggle functionality depends on this       |
| `badge()` relationship        | Breaking change affects nested badge data       |
| `UserBadgeResource` structure | Mobile/web clients depend on response structure |
| `BadgeResource` structure     | Used across multiple badge endpoints            |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| N+1 query on badge relationship          | Always use `with('badge')` for eager loading         |
| Breaking response structure              | Add fields, don't rename/remove existing ones        |
| Forgetting `is_displayed` filtering      | Use `displayed()` scope, not manual where clause     |
| Modifying BadgeController for single use | Create new method instead of changing existing flow  |
| Not handling null user case              | Controller already handles this - don't remove check |

### 📁 File Locations Quick Reference

```
routes/api/badges.php                                    ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php                                ← Controller
app/Services/Progression/
  └── BadgeService.php                                   ← Business logic
app/Models/Progression/
  ├── UserBadge.php                                      ← UserBadge model
  └── Badge.php                                          ← Badge model
app/Http/Resources/V1/Progression/
  ├── UserBadgeResource.php                              ← User badge transformer
  └── BadgeResource.php                                  ← Badge transformer
app/Enums/Progression/
  └── BadgeCategory.php                                  ← Badge category enum
```

---

## Document Metadata

| Property            | Value                               |
| ------------------- | ----------------------------------- |
| **Endpoint**        | `GET /api/v1/user/badges/displayed` |
| **Domain**          | User                                |
| **Author**          | System Documentation                |
| **Created**         | 2026-02-01                          |
| **Laravel Version** | 12.x                                |
| **PHP Version**     | 8.4                                 |
