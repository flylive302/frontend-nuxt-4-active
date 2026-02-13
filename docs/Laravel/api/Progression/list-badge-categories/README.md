# GET /api/v1/badges/categories

> **Domain**: Progression  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

This endpoint retrieves all available badge categories in the system. Categories are used to group badges by theme (e.g., Wealth, Charm, Room, Agency, Special) and provide UI metadata for display purposes.

### Responsibilities

- Return all defined badge categories from the `BadgeCategory` enum
- Provide human-readable labels for each category
- Include UI display metadata (color, icon) for frontend rendering

### What It Owns

| Owned              | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| Category Enum Data | Returns structured data from `BadgeCategory` PHP enum      |
| UI Metadata        | Provides color and icon values for frontend badge grouping |

### External Dependencies

| Dependency | Type | Purpose                                               |
| ---------- | ---- | ----------------------------------------------------- |
| None       | —    | This endpoint has no external service/DB dependencies |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/badges/categories
```

### Authentication

❌ **None Required** - This is a public endpoint accessible without authentication.

### Rate Limiting

| Limiter | Key      | Config               |
| ------- | -------- | -------------------- |
| Global  | IP-based | Default API throttle |

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Request Body Schema

_No request body - This is a GET endpoint with no parameters_

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Badge categories retrieved",
  "data": [
    {
      "value": "wealth", // string: enum value used in API
      "label": "Wealth", // string: human-readable display name
      "color": "warning", // string: UI color theme identifier
      "icon": "heroicon-o-currency-dollar" // string: icon identifier
    },
    {
      "value": "charm",
      "label": "Charm",
      "color": "danger",
      "icon": "heroicon-o-sparkles"
    },
    {
      "value": "room",
      "label": "Room",
      "color": "info",
      "icon": "heroicon-o-home"
    },
    {
      "value": "agency",
      "label": "Agency",
      "color": "success",
      "icon": "heroicon-o-building-office"
    },
    {
      "value": "special",
      "label": "Special",
      "color": "purple",
      "icon": "heroicon-o-star"
    }
  ],
  "meta": {
    "timestamp": "2026-02-01T12:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### Data Field Details

| Field   | Type     | Description                           | Example                        |
| ------- | -------- | ------------------------------------- | ------------------------------ |
| `value` | `string` | Enum value used for filtering badges  | `"wealth"`                     |
| `label` | `string` | Human-readable category name for UI   | `"Wealth"`                     |
| `color` | `string` | Color theme identifier for UI styling | `"warning"`                    |
| `icon`  | `string` | Icon identifier (Heroicons format)    | `"heroicon-o-currency-dollar"` |

### HTTP Status Codes

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Categories retrieved successfully |
| `500` | Internal server error             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/badges/categories                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:14                                              │
│ Route: Route::get('/categories', [BadgeController::class, 'categories'])    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('badges')->group(function () {                            │ │
│ │     Route::get('/categories', [BadgeController::class, 'categories']);  │ │
│ │     // ...                                                              │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain: (none - public route)                                     │
│   • Global API middleware only (throttle, etc.)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest - This endpoint accepts no input parameters                  │
│                                                                             │
│ Request flows directly to controller method.                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php           │
│ Method: categories()                                                        │
│                                                                             │
│ STEP 1: Collect all BadgeCategory enum cases                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $categories = collect(BadgeCategory::cases())                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Map each enum to structured data                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ->map(fn ($category) => [                                               │ │
│ │     'value' => $category->value,      // Enum string value              │ │
│ │     'label' => $category->label(),    // Human-readable name            │ │
│ │     'color' => $category->color(),    // UI color theme                 │ │
│ │     'icon' => $category->icon(),      // Icon identifier                │ │
│ │ ])                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return formatted response                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($categories, 'Badge categories retrieved'); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ⚠️ NO SERVICE LAYER INVOLVED                                                │
│                                                                             │
│ This endpoint operates entirely within the controller using the PHP enum.   │
│ No BadgeService methods are called for this specific endpoint.              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: BadgeCategory (PHP Enum)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Progression/BadgeCategory.php                           │ │
│ │ Responsibility: Define all badge category types with metadata           │ │
│ │ Reusable: YES (used by badges, stats, filtering endpoints)              │ │
│ │ Why It Exists: Type-safe category definitions with UI metadata          │ │
│ │                                                                         │ │
│ │ Enum Cases:                                                             │ │
│ │   • WEALTH   = 'wealth'  → label: "Wealth",  color: "warning", icon: $  │ │
│ │   • CHARM    = 'charm'   → label: "Charm",   color: "danger",  icon: ✨ │ │
│ │   • ROOM     = 'room'    → label: "Room",    color: "info",    icon: 🏠 │ │
│ │   • AGENCY   = 'agency'  → label: "Agency",  color: "success", icon: 🏢 │ │
│ │   • SPECIAL  = 'special' → label: "Special", color: "purple",  icon: ⭐ │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Returns human-readable category name                      │ │
│ │   • color() → Returns UI color theme string                             │ │
│ │   • icon()  → Returns Heroicon identifier string                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility Class)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │ Why It Exists: Consistent API response structure across application     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → Format success response with meta       │ │
│ │   • error($message, $errors) → Format error response                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS: None                                                   │
│                                                                             │
│ ⚠️ This endpoint performs NO database queries.                              │
│ All data comes from PHP enum definition (compile-time constants).           │
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
│ File: app/Http/Utils/ApiResponse.php:10-30                                  │
│                                                                             │
│ ApiResponse::success() builds:                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Badge categories retrieved',                          │ │
│ │     'data' => [/* collection of category objects */],                   │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
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

| File                  | Used By Endpoints                    | Reusable | Reasoning                                  |
| --------------------- | ------------------------------------ | -------- | ------------------------------------------ |
| `BadgeController.php` | All badge endpoints                  | ⭕       | Controller-specific, methods are reusable  |
| `BadgeCategory.php`   | Categories, badges index, user stats | ✅       | Shared enum used across progression domain |
| `ApiResponse.php`     | ALL API endpoints                    | ✅       | Global utility for response formatting     |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

_Not applicable - This endpoint accepts no input parameters_

### Business Logic Errors (400)

_Not applicable - This endpoint has no business logic validation_

### System Errors (500)

| Error                   | Source      | Condition                             |
| ----------------------- | ----------- | ------------------------------------- |
| "Internal server error" | PHP/Laravel | Unexpected exception during execution |

### Edge Cases

| Case                       | Behavior                                    |
| -------------------------- | ------------------------------------------- |
| Empty enum (no categories) | Returns empty array `[]` in data field      |
| Enum modification          | Response changes immediately (no cache)     |
| High traffic               | No DB load - very fast, enum-only operation |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ENUM                   RESPONSE
   │                       │                       │                   │                       │
   │  GET /badges/categories                       │                   │                       │
   │──────────────────────▶│                       │                   │                       │
   │                       │                       │                   │                       │
   │                       │ 1. Route match        │                   │                       │
   │                       │──────────────────────▶│                   │                       │
   │                       │                       │                   │                       │
   │                       │                       │ 2. Get all cases  │                       │
   │                       │                       │──────────────────▶│                       │
   │                       │                       │                   │                       │
   │                       │                       │ 3. Return cases   │                       │
   │                       │                       │◀──────────────────│                       │
   │                       │                       │                   │                       │
   │                       │                       │ 4. Map to array   │                       │
   │                       │                       │   (value, label,  │                       │
   │                       │                       │    color, icon)   │                       │
   │                       │                       │                   │                       │
   │                       │                       │ 5. ApiResponse::success()                 │
   │                       │                       │──────────────────────────────────────────▶│
   │                       │                       │                   │                       │
   │                       │                       │ 6. JsonResponse   │                       │
   │                       │                       │◀──────────────────────────────────────────│
   │                       │                       │                   │                       │
   │                       │◀──────────────────────│                   │                       │
   │◀──────────────────────│                       │                   │                       │
   │                       │                       │                   │                       │
   │  200 OK + JSON        │                       │                   │                       │
   │                       │                       │                   │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                                  |
| --------------------- | ----------------------------------------- |
| New category          | `app/Enums/Progression/BadgeCategory.php` |
| New metadata field    | Enum methods + controller mapping         |
| Category translations | Add `i18n()` method to enum               |
| Category ordering     | Add `sortOrder()` method to enum          |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW CATEGORY

| Step  | File                                      | What to Change                          |
| ----- | ----------------------------------------- | --------------------------------------- |
| **1** | `app/Enums/Progression/BadgeCategory.php` | Add new case (e.g., `case VIP = 'vip'`) |
| **2** | Same file → `label()` method              | Add label match arm                     |
| **3** | Same file → `color()` method              | Add color match arm                     |
| **4** | Same file → `icon()` method               | Add icon match arm                      |
| **5** | Database (if migrating existing badges)   | Update badge category values            |

Example:

```php
// In BadgeCategory.php
case VIP = 'vip';

// In label() method
self::VIP => 'VIP',

// In color() method
self::VIP => 'gold',

// In icon() method
self::VIP => 'heroicon-o-crown',
```

#### ➕ ADDING A NEW METADATA FIELD (e.g., description)

| Step  | File                                           | What to Change                                          |
| ----- | ---------------------------------------------- | ------------------------------------------------------- |
| **1** | `app/Enums/Progression/BadgeCategory.php`      | Add new method `description(): string`                  |
| **2** | `app/Http/Controllers/.../BadgeController.php` | Add to map: `'description' => $category->description()` |

#### ➖ REMOVING A CATEGORY

| Step  | File                                      | What to Change                       |
| ----- | ----------------------------------------- | ------------------------------------ |
| **1** | Database                                  | Migrate badges to different category |
| **2** | `app/Enums/Progression/BadgeCategory.php` | Remove case                          |
| **3** | Same file → all methods                   | Remove corresponding match arms      |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DEPENDENCY CHAIN                               │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  BadgeCategory.php (Enum Definition)                                        │
│        │                                                                    │
│        ├──▶ case VALUE                                                      │
│        │         │                                                          │
│        │         ├──▶ label() → Human-readable name                         │
│        │         ├──▶ color() → UI color theme                              │
│        │         └──▶ icon()  → Icon identifier                             │
│        │                                                                    │
│        └──▶ BadgeController::categories()                                   │
│                    │                                                        │
│                    └──▶ ApiResponse::success()                              │
│                              │                                              │
│                              └──▶ JSON Response to Client                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding a Category Checklist

- [ ] Add enum case with string value
- [ ] Add label match arm
- [ ] Add color match arm
- [ ] Add icon match arm
- [ ] Test endpoint returns new category
- [ ] Update any frontend category handling

### ⚠️ What Should NOT Be Modified Casually

| Component               | Reason                                     |
| ----------------------- | ------------------------------------------ |
| Enum case values        | Used as foreign references in badges table |
| `ApiResponse` structure | Breaking change affects all API consumers  |
| Route path              | Breaking change for API clients            |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                          |
| ----------------------------------- | --------------------------------------------------- |
| Missing match arm after adding case | PHP 8 enums require exhaustive match statements     |
| Changing enum value string          | Will break existing badges with old category value  |
| Hardcoding categories in frontend   | Always fetch from this endpoint for dynamic updates |
| Not updating all enum methods       | Test all properties when adding/removing categories |

### 📁 File Locations Quick Reference

```
routes/api/badges.php                                    ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php                                ← Controller (categories method)
app/Enums/Progression/
  └── BadgeCategory.php                                  ← Category enum definition
app/Http/Utils/
  └── ApiResponse.php                                    ← Response formatting utility
```

---

## Document Metadata

| Property            | Value                           |
| ------------------- | ------------------------------- |
| **Endpoint**        | `GET /api/v1/badges/categories` |
| **Domain**          | Progression                     |
| **Author**          | System Documentation            |
| **Created**         | 2026-02-01                      |
| **Laravel Version** | 12.x                            |
| **PHP Version**     | 8.4                             |
