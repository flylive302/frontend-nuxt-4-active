# GET /api/v1/user/badges

> **Domain**: User / Progression  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves all badges earned by the currently authenticated user, ordered by most recently earned.

### Responsibilities

- Authenticate the user via Sanctum token
- Fetch all user badges with their associated badge details
- Transform the data using API resources for consistent output

### What It Owns

| Owned               | Description                                |
| ------------------- | ------------------------------------------ |
| User badges listing | Retrieves `user_badges` records for a user |
| Badge eager loading | Loads associated `badges` data efficiently |

### External Dependencies

| Dependency | Type           | Purpose                         |
| ---------- | -------------- | ------------------------------- |
| Database   | Infrastructure | Queries `user_badges`, `badges` |
| Sanctum    | Package        | Token-based authentication      |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/badges
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter  | Key         | Config               |
| -------- | ----------- | -------------------- |
| Standard | `user:{id}` | `config/sanctum.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

**No request body** - This is a GET endpoint.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": "integer", // user_badge.id
      "badge": {
        "id": "integer", // badge.id
        "name": "string", // badge.name
        "description": "string", // badge.description
        "category": "string", // badge.category (enum value)
        "category_label": "string", // Human-readable category
        "level": "integer", // badge.level
        "image_url": "string|null", // badge.image_url
        "is_stackable": "boolean", // badge.is_stackable
        "metadata": "object|null" // badge.metadata (JSON)
      },
      "source_type": "string", // How the badge was earned
      "source_id": "integer|null", // Related entity ID (if any)
      "earned_at": "string", // ISO8601 timestamp
      "is_displayed": "boolean" // Whether badge is displayed on profile
    }
  ]
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                |
| ----- | ------------------------ |
| `200` | Badges retrieved         |
| `401` | Missing or invalid token |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/badges                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:20-21                                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->prefix('user/badges')->group(...);  │ │
│ │     Route::get('/', [BadgeController::class, 'userBadges']);           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, sets Auth user                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (No Form Request)                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ No custom FormRequest - uses base Illuminate\Http\Request                   │
│ Middleware handles authentication before controller executes                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php:79-91     │
│ Method: userBadges(Request $request)                                        │
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
│ STEP 2: Call service to fetch user badges                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userId = $user->id;                                                    │ │
│ │ $badges = $this->badgeService->getUserBadges($userId);                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return resource collection                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return UserBadgeResource::collection($badges);                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/BadgeService.php:124-133                     │
│ Method: getUserBadges(int $userId)                                          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getUserBadges(int $userId): Collection                  │ │
│ │ {                                                                       │ │
│ │     return UserBadge::where('user_id', $userId)                         │ │
│ │         ->with('badge')                                                 │ │
│ │         ->orderBy('earned_at', 'desc')                                  │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Behaviors:                                                              │
│   • Eager loads 'badge' relationship (prevents N+1 queries)                 │
│   • Orders by earned_at DESC (most recent first)                            │
│   • Returns Eloquent Collection of UserBadge models                         │
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
│ │ Responsibility: Represents a badge earned by a user                     │ │
│ │ Reusable: YES (used across badge/progression endpoints)                 │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user() → BelongsTo User                                             │ │
│ │   • badge() → BelongsTo Badge                                           │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • user_id, badge_id, source_type, source_id, earned_at, is_displayed  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Badge (Model)                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/Badge.php                                  │ │
│ │ Responsibility: Represents a badge definition                           │ │
│ │ Reusable: YES (catalog, user badges, admin)                             │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • name, description, category (enum), level, image_url,               │ │
│ │   • is_active, is_stackable, sort_order, metadata                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeCategory (Enum)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/BadgeCategory.php                           │ │
│ │ Responsibility: Badge categorization                                    │ │
│ │ Reusable: YES (shared across all badge endpoints)                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable name                                       │ │
│ │   • color() → Associated color                                          │ │
│ │   • icon() → Associated icon                                            │ │
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
│ 1. SELECT: Fetch user badges                                                │
│    Query: SELECT * FROM user_badges                                         │
│           WHERE user_id = ?                                                 │
│           ORDER BY earned_at DESC                                           │
│    Source: BadgeService::getUserBadges()                                    │
│                                                                             │
│ 2. SELECT: Eager load badges (single query for all badge_ids)               │
│    Query: SELECT * FROM badges                                              │
│           WHERE id IN (?, ?, ...)                                           │
│    Source: Eloquent ->with('badge')                                         │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UserBadgeResource                                                │
│ File: app/Http/Resources/V1/Progression/UserBadgeResource.php:15-30         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function toArray(Request $request): array                        │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'id' => $this->id,                                              │ │
│ │         'badge' => new BadgeResource($this->whenLoaded('badge')),       │ │
│ │         'source_type' => $this->source_type,                            │ │
│ │         'source_id' => $this->source_id,                                │ │
│ │         'earned_at' => $this->earned_at->toIso8601String(),             │ │
│ │         'is_displayed' => $this->is_displayed,                          │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeResource (Nested)                                           │
│ File: app/Http/Resources/V1/Progression/BadgeResource.php:15-33             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function toArray(Request $request): array                        │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'id' => $this->id,                                              │ │
│ │         'name' => $this->name,                                          │ │
│ │         'description' => $this->description,                            │ │
│ │         'category' => $this->category->value,                           │ │
│ │         'category_label' => $this->category->label(),                   │ │
│ │         'level' => $this->level,                                        │ │
│ │         'image_url' => $this->image_url,                                │ │
│ │         'is_stackable' => $this->is_stackable,                          │ │
│ │         'metadata' => $this->metadata,                                  │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Laravel auto-wraps collection in {"data": [...]} format                     │
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

| File                       | Used By Endpoints                          | Reusable | Reasoning                            |
| -------------------------- | ------------------------------------------ | -------- | ------------------------------------ |
| `BadgeController.php`      | All `/badges` and `/user/badges` endpoints | ⭕       | Contains multiple endpoint methods   |
| `BadgeService.php`         | All badge-related endpoints                | ✅       | Central service for badge operations |
| `UserBadge.php` (Model)    | user badges, displayed badges, stats       | ✅       | Core data model                      |
| `Badge.php` (Model)        | Catalog, details, user badges              | ✅       | Core data model                      |
| `UserBadgeResource.php`    | User badges list, displayed badges         | ✅       | Shared resource transformer          |
| `BadgeResource.php`        | Catalog, details, user badges (nested)     | ✅       | Shared resource transformer          |
| `BadgeCategory.php` (Enum) | All badge endpoints                        | ✅       | Shared enum                          |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source               | Condition          |
| ----- | -------------------- | ------------------ |
| N/A   | No validation needed | GET without params |

### Business Logic Errors (400)

| Error | Source | Condition |
| ----- | ------ | --------- |
| N/A   | N/A    | N/A       |

### Authentication Errors (401)

| Error              | Source       | Condition                       |
| ------------------ | ------------ | ------------------------------- |
| "Unauthenticated." | auth:sanctum | Missing or invalid Bearer token |

### System Errors (500)

| Error                    | Source        | Condition            |
| ------------------------ | ------------- | -------------------- |
| Database connection fail | BadgeService  | DB unreachable       |
| Internal server error    | Any component | Unexpected exception |

### Edge Cases

| Case                      | Behavior                                     |
| ------------------------- | -------------------------------------------- |
| User has no badges        | Returns empty array `{"data": []}`           |
| Badge deleted after award | Still shows in user list (relationship null) |
| Null user from request    | Returns empty collection gracefully          |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                       │                       │                        │
   │  GET /api/v1/user/    │                       │                       │                        │
   │       badges          │                       │                       │                        │
   │──────────────────────▶│                       │                       │                        │
   │                       │                       │                       │                        │
   │                       │ 1. auth:sanctum       │                       │                        │
   │                       │    validate token     │                       │                        │
   │                       │──────────────────────▶│                       │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 2. Get user from      │                        │
   │                       │                       │    request            │                        │
   │                       │                       │                       │                        │
   │                       │                       │ 3. $badgeService->    │                        │
   │                       │                       │    getUserBadges()    │                        │
   │                       │                       │──────────────────────▶│                        │
   │                       │                       │                       │                        │
   │                       │                       │                       │ 4. SELECT user_badges  │
   │                       │                       │                       │    WHERE user_id = ?   │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │                       │ 5. SELECT badges       │
   │                       │                       │                       │    WHERE id IN (...)   │
   │                       │                       │                       │───────────────────────▶│
   │                       │                       │                       │◀───────────────────────│
   │                       │                       │                       │                        │
   │                       │                       │◀──────────────────────│                        │
   │                       │                       │                       │                        │
   │                       │                       │ 6. Transform via      │                        │
   │                       │                       │    UserBadgeResource  │                        │
   │                       │                       │    + BadgeResource    │                        │
   │                       │                       │                       │                        │
   │                       │◀──────────────────────│                       │                        │
   │◀──────────────────────│                       │                       │                        │
   │                       │                       │                       │                        │
   │  200 + JSON           │                       │                       │                        │
   │                       │                       │                       │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                               |
| --------------------------- | -------------------------------------- |
| New filter (e.g., category) | Controller method + Service method     |
| Pagination                  | Service (->paginate()) + Controller    |
| New response field          | `UserBadgeResource` or `BadgeResource` |
| Caching                     | `BadgeService::getUserBadges()`        |
| Sorting options             | Controller (parse query) + Service     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO USER BADGE

| Step  | File                                                      | What to Change                  |
| ----- | --------------------------------------------------------- | ------------------------------- |
| **1** | `database/migrations/*_create_user_badges_table.php`      | Add column                      |
| **2** | `app/Models/Progression/UserBadge.php`                    | Add to `$fillable` and `$casts` |
| **3** | `app/Http/Resources/V1/Progression/UserBadgeResource.php` | Add to `toArray()` return       |

#### ➕ ADDING A NEW FIELD TO BADGE (displays in nested badge object)

| Step  | File                                                  | What to Change                  |
| ----- | ----------------------------------------------------- | ------------------------------- |
| **1** | `database/migrations/*_create_badges_table.php`       | Add column                      |
| **2** | `app/Models/Progression/Badge.php`                    | Add to `$fillable` and `$casts` |
| **3** | `app/Http/Resources/V1/Progression/BadgeResource.php` | Add to `toArray()` return       |

#### ➖ REMOVING A FIELD

| Step  | File                                           | What to Change                 |
| ----- | ---------------------------------------------- | ------------------------------ |
| **1** | `UserBadgeResource.php` or `BadgeResource.php` | Remove from `toArray()` return |
| **2** | Model (`UserBadge.php` or `Badge.php`)         | Remove from `$fillable`        |
| **3** | Migration                                      | Drop column (if safe)          |

### 🔗 Field Flow Dependency Chain

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  Migration  │ ──▶ │    Model     │ ──▶ │   Service Method    │ ──▶ │    Resource     │
│  (schema)   │     │ ($fillable)  │     │ (eager loads)       │     │ (toArray())     │
└─────────────┘     └──────────────┘     └─────────────────────┘     └─────────────────┘
```

### 📋 Field Modification Checklists

- [ ] Database migration created/updated
- [ ] Model `$fillable` updated
- [ ] Model `$casts` updated (if needed)
- [ ] Resource `toArray()` updated
- [ ] Tests updated
- [ ] API documentation updated

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                             |
| ------------------------- | -------------------------------------------------- |
| `auth:sanctum` middleware | Core authentication - affects all protected routes |
| `UserBadge` relationships | Used across multiple endpoints                     |
| `BadgeResource` structure | May break mobile clients expecting specific format |
| Query `with('badge')`     | Removing causes N+1 performance issue              |

### 🚨 Common Pitfalls

| Pitfall                               | Prevention                                    |
| ------------------------------------- | --------------------------------------------- |
| Forgetting `with('badge')` eager load | Always check for N+1 queries in service layer |
| Adding fields without $fillable       | Mass assignment won't work                    |
| Changing response structure           | Coordinate with mobile/frontend teams         |
| Removing `whenLoaded()` check         | Will error if badge not eager loaded          |

### 📁 File Locations Quick Reference

```
routes/api/badges.php                                ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php                            ← Controller
app/Services/Progression/
  └── BadgeService.php                               ← Business logic
app/Models/Progression/
  ├── UserBadge.php                                  ← User badge model
  └── Badge.php                                      ← Badge definition model
app/Http/Resources/V1/Progression/
  ├── UserBadgeResource.php                          ← Response transformer
  └── BadgeResource.php                              ← Nested badge transformer
app/Enums/Progression/
  └── BadgeCategory.php                              ← Category enum
```

---

## Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `GET /api/v1/user/badges` |
| **Domain**          | User / Progression        |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-01                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
