# GET /api/v1/user/badges/stats

> **Domain**: Progression - Badges  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Badge Stats endpoint retrieves badge statistics for the authenticated user. It returns the total count of badges the user has earned and a breakdown by category.

### Responsibilities

- Authenticate request via Sanctum token
- Retrieve user's badge counts by category
- Calculate total badge count
- Return formatted statistics

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Badge statistics            | Aggregated counts by category and total              |
| Category breakdown          | Per-category badge counts                            |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `user_badges` table         | Database       | User badge ownership                        |
| Laravel Sanctum             | Package        | Token authentication                        |
| BadgeService                | Service        | Statistics aggregation                      |
| BadgeCategory enum          | Enum           | Category definitions                        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/badges/stats
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |

### Request Body Schema

**No request body** - GET request.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Badge statistics retrieved",
  "data": {
    "total": 15,
    "by_category": {
      "achievement": 5,
      "level": 3,
      "event": 2,
      "special": 1,
      "vip": 4,
      "moderator": 0
    }
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

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Statistics retrieved successfully   |
| `401` | Unauthenticated                     |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:23                                              │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/stats', [BadgeController::class, 'stats']);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware: auth:sanctum (line 20)                                          │
│ Parent prefix: user/badges                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php           │
│ Method: stats(Request $request) at lines 135-159                            │
│                                                                             │
│ STEP 1: Get Authenticated User (lines 137-141)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get Stats by Category (line 143)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $byCategory = $this->badgeService->getUserBadgeStatsByCategory(         │ │
│ │     $user->id                                                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Calculate Total (line 144)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $total = array_sum($byCategory);                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Fill Missing Categories (lines 146-152)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $stats = ['total' => $total, 'by_category' => []];                      │ │
│ │                                                                         │ │
│ │ foreach (BadgeCategory::cases() as $category) {                         │ │
│ │     $stats['by_category'][$category->value] =                           │ │
│ │         $byCategory[$category->value] ?? 0;                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return Response (line 154)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($stats, 'Badge statistics retrieved');     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `BadgeController.php`                         | All badge endpoints                  | ⭕ Mixed   |
| `BadgeService.php`                            | Badge business logic                 | ✅ Reusable|
| `BadgeCategory.php`                           | Enum for categories                  | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User has no badges                | Returns total: 0, all categories: 0                |
| New category added to enum        | Auto-included via BadgeCategory::cases()           |
| Deleted badges                    | Not counted (query excludes deleted)               |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │GET /user/badges/stats │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 2. getStatsByCategory │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 3. GROUP BY        │
   │                       │                       │                       │    category        │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │ 4. Format response    │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| New badge category              | BadgeCategory enum                                    |
| Additional stats (e.g., rarity) | BadgeController::stats(), add to response             |
| Time-based filtering            | Add query parameter, modify service method            |

### 📁 File Locations Quick Reference

```
routes/api/badges.php:23                             ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php:135-159                    ← Controller method
app/Services/Progression/
  └── BadgeService.php                               ← Statistics logic
app/Enums/Progression/
  └── BadgeCategory.php                              ← Category enum
```

---

## 8. Document Metadata

| Property            | Value                           |
| ------------------- | ------------------------------- |
| **Endpoint**        | `GET /api/v1/user/badges/stats` |
| **Domain**          | Progression - Badges            |
| **Author**          | System Documentation            |
| **Created**         | 2026-02-04                      |
| **Laravel Version** | 12.x                            |
| **PHP Version**     | 8.4+                            |
