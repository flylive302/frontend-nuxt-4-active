# GET /api/v1/badges/{id}

> **Domain**: Progression  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Retrieves detailed information about a specific badge by its unique identifier, allowing clients to display badge details in catalogs or profile views.

### Responsibilities

- Fetch a single badge from the database by ID
- Transform badge data using a consistent resource format
- Return 404 response when badge is not found

### What It Owns

| Owned            | Description                             |
| ---------------- | --------------------------------------- |
| Badge Retrieval  | Fetches individual badge by primary key |
| Response Shaping | Transforms Badge model to JSON resource |

### External Dependencies

| Dependency | Type     | Purpose                    |
| ---------- | -------- | -------------------------- |
| MySQL      | Database | Stores badge definitions   |
| Eloquent   | ORM      | Database query abstraction |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/badges/{id}
```

### Authentication

❌ **None Required** - Public endpoint accessible without authentication

### Rate Limiting

| Limiter | Key      | Config  |
| ------- | -------- | ------- |
| Global  | IP-based | Default |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Path Parameters

| Parameter | Type      | Constraints       | Example |
| --------- | --------- | ----------------- | ------- |
| `id`      | `integer` | Required, numeric | `5`     |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": {
    "id": 5, // integer, badge primary key
    "name": "Wealth Master", // string, badge display name
    "description": "Earned 10000 coins", // string|null, badge description
    "category": "wealth", // string, category enum value
    "category_label": "Wealth", // string, human-readable category name
    "level": 3, // integer, badge tier level
    "image_url": "https://...", // string, URL to badge image
    "is_stackable": false, // boolean, can be earned multiple times
    "metadata": {} // object|null, additional badge data
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Badge not found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T12:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T12:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                             |
| ----- | ------------------------------------- |
| `200` | Badge found and returned successfully |
| `404` | Badge with given ID does not exist    |
| `500` | Database connection failure or error  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/badges/{id}                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:16                                              │
│ Route: Route::get('/{id}', [BadgeController::class, 'show'])                │
│         ->where('id', '[0-9]+');                                            │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. api              → Sets JSON response headers, stateless session       │
│   2. throttle:api     → Rate limits requests                                │
│                                                                             │
│ Route Pattern: The ->where('id', '[0-9]+') constraint ensures only          │
│ numeric IDs are matched, preventing string-based ID injection.              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No Form Request: This endpoint uses type-hinted parameter binding.          │
│                                                                             │
│ The route parameter {id} is automatically cast to int by PHP's type         │
│ declaration in the controller method signature.                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php           │
│ Method: show(int $id): BadgeResource|JsonResponse                           │
│                                                                             │
│ STEP 1: Fetch badge from service                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $badge = $this->badgeService->findById($id);                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check if badge exists                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $badge) {                                                         │ │
│ │     return ApiResponse::notFound('Badge not found');                    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return resource response                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return new BadgeResource($badge);                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/BadgeService.php                             │
│ Method: findById(int $id): ?Badge                                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function findById(int $id): ?Badge                               │ │
│ │ {                                                                       │ │
│ │     return Badge::find($id);                                            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Unlike getAllActive() and getByCategory(), findById() does NOT        │
│ use caching. This is intentional because:                                   │
│   1. Individual badge lookups are typically infrequent                      │
│   2. Badge data may need to be fresh (e.g., recently updated)               │
│   3. Caching single items adds complexity with cache invalidation           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Badge (Eloquent Model)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Progression/Badge.php                                  │ │
│ │ Responsibility: Represents badge entity in database                     │ │
│ │ Reusable: YES (used by all badge-related endpoints)                     │ │
│ │ Why It Exists: Core entity for progression/gamification system          │ │
│ │                                                                         │ │
│ │ Key Attributes:                                                         │ │
│ │   • id, name, description, category, level                              │ │
│ │   • image_url, is_active, is_stackable, sort_order, metadata            │ │
│ │                                                                         │ │
│ │ Casts:                                                                  │ │
│ │   • 'category' => BadgeCategory::class (enum)                           │ │
│ │   • 'metadata' => 'array'                                               │ │
│ │   • 'is_active', 'is_stackable' => 'boolean'                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BadgeCategory (Enum)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/BadgeCategory.php                           │ │
│ │ Responsibility: Defines valid badge categories                          │ │
│ │ Reusable: YES (used across all badge operations)                        │ │
│ │                                                                         │ │
│ │ Values: wealth, charm, room, agency, special                            │ │
│ │ Methods: label(), color(), icon()                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │ Why It Exists: Ensures consistent API response structure                │ │
│ │                                                                         │ │
│ │ Used Method:                                                            │ │
│ │   • notFound() → Returns 404 with standard error format                 │ │
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
│ 1. SELECT: Fetch badge by primary key                                       │
│    Query: SELECT * FROM badges WHERE id = ?                                 │
│    Source: BadgeService::findById() → Badge::find()                         │
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
│ File: app/Http/Resources/V1/Progression/BadgeResource.php                   │
│                                                                             │
│ The BadgeResource transforms the Badge model into a JSON-serializable       │
│ array with consistent field naming and value processing.                    │
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
│ Response Format: Laravel's JsonResource wraps output in { "data": {...} }   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body (or 404)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                  | Used By Endpoints              | Reusable | Reasoning                                    |
| --------------------- | ------------------------------ | -------- | -------------------------------------------- |
| `BadgeController.php` | All `/badges/*` endpoints      | ⭕       | Controller shared, methods endpoint-specific |
| `BadgeService.php`    | Badge endpoints, award service | ✅       | Core badge business logic                    |
| `Badge.php`           | All badge operations           | ✅       | Single Eloquent model for badges table       |
| `BadgeResource.php`   | List badges, get badge         | ✅       | Standard badge JSON transformation           |
| `ApiResponse.php`     | ALL API endpoints              | ✅       | Global response utility                      |
| `BadgeCategory.php`   | All badge operations           | ✅       | Enum for type-safe categories                |

---

## 5. Error Handling & Edge Cases

### Not Found Errors (404)

| Error             | Source                  | Condition                  |
| ----------------- | ----------------------- | -------------------------- |
| "Badge not found" | `BadgeController::show` | Badge::find() returns null |

### System Errors (500)

| Error                   | Source           | Condition                   |
| ----------------------- | ---------------- | --------------------------- |
| "Internal server error" | ExceptionHandler | Database connection failure |
| Database exceptions     | Eloquent         | Query execution failure     |

### Edge Cases

| Case                  | Behavior                                     |
| --------------------- | -------------------------------------------- |
| Non-existent badge ID | Returns 404 with "Badge not found" message   |
| ID of inactive badge  | Returns the badge (no is_active filter here) |
| Very large ID value   | Returns 404 (no record found)                |
| Non-numeric ID        | Route doesn't match (regex constraint)       |
| Negative ID           | Route doesn't match (regex constraint)       |
| ID with leading zeros | Parsed as integer, looks up normally         |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                    │                      │
   │  GET /badges/5        │                       │                    │                      │
   │──────────────────────▶│                       │                    │                      │
   │                       │                       │                    │                      │
   │                       │ 1. throttle:api       │                    │                      │
   │                       │──────────────────────▶│                    │                      │
   │                       │                       │                    │                      │
   │                       │                       │ 2. findById(5)     │                      │
   │                       │                       │───────────────────▶│                      │
   │                       │                       │                    │                      │
   │                       │                       │                    │ 3. SELECT * FROM     │
   │                       │                       │                    │    badges WHERE id=5 │
   │                       │                       │                    │─────────────────────▶│
   │                       │                       │                    │◀─────────────────────│
   │                       │                       │                    │    Badge|null        │
   │                       │                       │◀───────────────────│                      │
   │                       │                       │    Badge?          │                      │
   │                       │                       │                    │                      │
   │                       │                       │ 4. if badge null:  │                      │
   │                       │                       │    ApiResponse::   │                      │
   │                       │                       │    notFound()      │                      │
   │                       │                       │                    │                      │
   │                       │                       │ 5. else:           │                      │
   │                       │                       │    new BadgeResource│                     │
   │                       │◀──────────────────────│                    │                      │
   │◀──────────────────────│                       │                    │                      │
   │                       │                       │                    │                      │
   │  200 + JSON Body      │                       │                    │                      │
   │  (or 404)             │                       │                    │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                           |
| -------------------------- | ---------------------------------- |
| New response field         | `BadgeResource.php`                |
| Authorization check        | Add middleware or policy           |
| Related data (eager load)  | `BadgeService::findById()` + model |
| Caching for single badge   | `BadgeService::findById()`         |
| User-specific badge status | New method in service              |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                  | What to Change                  |
| ----- | ----------------------------------------------------- | ------------------------------- |
| **1** | `database/migrations/*_create_badges_table.php`       | Add column to schema            |
| **2** | `app/Models/Progression/Badge.php`                    | Add to `$fillable` and `$casts` |
| **3** | `app/Http/Resources/V1/Progression/BadgeResource.php` | Add to `toArray()` return array |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                  | What to Change                    |
| ----- | ----------------------------------------------------- | --------------------------------- |
| **1** | `app/Http/Resources/V1/Progression/BadgeResource.php` | Remove from `toArray()` array     |
| **2** | `app/Models/Progression/Badge.php`                    | Remove from `$fillable`, `$casts` |
| **3** | New migration                                         | Drop column (if safe)             |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Database      │ ──▶ │   Badge Model   │ ──▶ │  BadgeResource  │
│   `badges`      │     │   $fillable     │     │   toArray()     │
│   table         │     │   $casts        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component            | Reason                                                     |
| -------------------- | ---------------------------------------------------------- |
| `BadgeResource.php`  | Breaking API contract affects all badge-displaying clients |
| Route regex pattern  | May break URL matching for valid badge IDs                 |
| `ApiResponse` format | System-wide API contract change                            |
| `category` enum      | Affects all badge categorization logic                     |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                      |
| ----------------------------------- | ----------------------------------------------- |
| Assuming badge is always found      | Always check for null before using badge        |
| Filtering by is_active in show()    | Intentionally not filtered here - be aware      |
| Returning model instead of resource | Use `new BadgeResource($badge)` for consistency |
| Adding auth without updating docs   | Keep documentation in sync with middleware      |

### 📁 File Locations Quick Reference

```
routes/api/badges.php                                 ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php                             ← Controller
app/Services/Progression/
  └── BadgeService.php                                ← Business logic
app/Models/Progression/
  └── Badge.php                                       ← Eloquent model
app/Http/Resources/V1/Progression/
  └── BadgeResource.php                               ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                 ← Response utility
app/Enums/Progression/
  └── BadgeCategory.php                               ← Category enum
database/migrations/
  └── 2025_12_29_000002_create_badges_table.php       ← Table schema
```

---

## Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `GET /api/v1/badges/{id}` |
| **Domain**          | Progression               |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-01                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
