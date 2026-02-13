# POST /api/v1/user/badges/{id}/toggle-display

> **Domain**: Progression - Badges  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Toggle Badge Display endpoint allows users to toggle whether a badge they own is displayed on their profile. Users can showcase selected badges to highlight their achievements.

### Responsibilities

- Authenticate request via Sanctum token
- Verify user owns the specified badge
- Toggle the display status
- Return success confirmation

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Display toggle              | Flips badge visibility on profile                    |
| Ownership verification      | Ensures badge belongs to user                        |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `user_badges` table         | Database       | User badge ownership and display status     |
| Laravel Sanctum             | Package        | Token authentication                        |
| BadgeService                | Service        | Toggle logic                                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/badges/{id}/toggle-display
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Route Parameters

| Parameter | Type      | Required | Description             |
| --------- | --------- | -------- | ----------------------- |
| `id`      | `integer` | ✅       | Badge ID to toggle      |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |

### Request Body Schema

**No request body** - POST request with path parameter only.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Badge display toggled successfully",
  "data": null
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

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Badge not found or does not belong to you",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Badge display toggled successfully  |
| `401` | Unauthenticated                     |
| `404` | Badge not found or not owned        |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:24                                              │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{id}/toggle-display',                                     │ │
│ │     [BadgeController::class, 'toggleDisplay'])                          │ │
│ │     ->where('id', '[0-9]+');                                            │ │
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
│ Method: toggleDisplay(Request $request, int $id) at lines 112-133           │
│                                                                             │
│ STEP 1: Get Authenticated User (lines 114-118)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Toggle via Service (lines 120-121)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userId = $user->id;                                                    │ │
│ │ $success = $this->badgeService->toggleBadgeDisplay($id, $userId);       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle Not Found (lines 123-125)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $success) {                                                       │ │
│ │     return ApiResponse::notFound(                                       │ │
│ │         'Badge not found or does not belong to you');                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return Success (line 127)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Badge display toggled successfully');│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/BadgeService.php                             │
│ Method: toggleBadgeDisplay()                                                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Find user_badge record by badge_id and user_id                       │ │
│ │ 2. If not found, return false                                           │ │
│ │ 3. Toggle is_displayed column                                           │ │
│ │ 4. Save changes                                                         │ │
│ │ 5. Return true                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `BadgeController.php`                         | All badge endpoints                  | ⭕ Mixed   |
| `BadgeService.php`                            | Badge business logic                 | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

### Not Found Errors (404)

| Error                              | Condition                              |
| ---------------------------------- | -------------------------------------- |
| Badge not found                    | Badge ID doesn't exist                 |
| Not owned by user                  | User doesn't have this badge           |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| Badge already displayed           | Toggle to hidden                                   |
| Badge already hidden              | Toggle to displayed                                |
| Max display limit reached         | Implementation-dependent (may enforce limit)       |
| Deactivated badge                 | Still can toggle if user owns it                   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │POST /{id}/toggle-disp │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 2. toggleBadgeDisplay │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 3. SELECT          │
   │                       │                       │                       │    user_badge      │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │ 4. Toggle display  │
   │                       │                       │                       │ 5. UPDATE          │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| Display limit enforcement       | BadgeService::toggleBadgeDisplay()                    |
| Display order                   | Add order column to user_badges                       |
| Badge visibility rules          | Add conditions in service method                      |

### 📁 File Locations Quick Reference

```
routes/api/badges.php:24                             ← Route definition
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php:112-133                    ← Controller method
app/Services/Progression/
  └── BadgeService.php                               ← Toggle logic
app/Models/Progression/
  └── UserBadge.php                                  ← Pivot model
```

---

## 8. Document Metadata

| Property            | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/badges/{id}/toggle-display` |
| **Domain**          | Progression - Badges                           |
| **Author**          | System Documentation                           |
| **Created**         | 2026-02-04                                     |
| **Laravel Version** | 12.x                                           |
| **PHP Version**     | 8.4+                                           |
