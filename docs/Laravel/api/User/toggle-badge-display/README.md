# POST /api/v1/user/badges/{id}/toggle-display

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Toggles the display status of a specific badge for the authenticated user. When a badge is displayed (`is_displayed = true`), it appears on the user's public profile; when toggled off, it becomes hidden.

### Responsibilities

- Authenticate user via Sanctum token
- Validate the badge belongs to the authenticated user
- Toggle the `is_displayed` boolean field
- Persist the change to the database
- Return success/failure response

### What It Owns

| Owned                | Description                                         |
| -------------------- | --------------------------------------------------- |
| Badge display toggle | Updates `is_displayed` field on `user_badges` table |
| User badge ownership | Validates badge belongs to requesting user          |

### External Dependencies

| Dependency | Type           | Purpose                              |
| ---------- | -------------- | ------------------------------------ |
| MySQL      | Database       | Store user badges and display status |
| Sanctum    | Authentication | Validate Bearer token                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/badges/{id}/toggle-display
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

### Path Parameters

| Parameter | Type      | Constraints       | Description                 |
| --------- | --------- | ----------------- | --------------------------- |
| `id`      | `integer` | Required, numeric | UserBadge ID (not Badge ID) |

### Request Body Schema

```
No request body - action is implicit (toggle)
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Badge display toggled successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T18:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T18:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "Badge not found or does not belong to you",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T18:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Badge display status toggled successfully |
| `401` | Missing or invalid Bearer token           |
| `404` | Badge not found or doesn't belong to user |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/user/badges/{id}/toggle-display                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/badges.php:24                                              │
│ Route: Route::post('/{id}/toggle-display',                                  │
│              [BadgeController::class, 'toggleDisplay'])->where('id', ...)   │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token via Laravel Sanctum             │
│                                                                             │
│ Route Constraint:                                                           │
│   • id must match pattern [0-9]+ (numeric only)                             │
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
│ File: app/Http/Controllers/Api/V1/Progression/BadgeController.php:117-133   │
│ Method: toggleDisplay(Request $request, int $id)                            │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call service to toggle display                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userId = $user->id;                                                    │ │
│ │ $success = $this->badgeService->toggleBadgeDisplay($id, $userId);       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return appropriate response                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $success) {                                                       │ │
│ │     return ApiResponse::notFound(                                       │ │
│ │         'Badge not found or does not belong to you'                     │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(null, 'Badge display toggled successfully');│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Progression/BadgeService.php:156-173                     │
│ Method: toggleBadgeDisplay(int $userBadgeId, int $userId)                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function toggleBadgeDisplay(int $userBadgeId, int $userId): bool │ │
│ │ {                                                                       │ │
│ │     $userBadge = UserBadge::where('id', $userBadgeId)                   │ │
│ │         ->where('user_id', $userId)                                     │ │
│ │         ->first();                                                      │ │
│ │                                                                         │ │
│ │     if (! $userBadge) {                                                 │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     $userBadge->is_displayed = ! $userBadge->is_displayed;              │ │
│ │     $userBadge->save();                                                 │ │
│ │                                                                         │ │
│ │     return true;                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key operations:                                                             │
│   • Query UserBadge by ID AND user_id (ownership check)                     │
│   • Return false if badge not found (triggers 404)                          │
│   • Toggle is_displayed boolean using logical NOT                           │
│   • Save the updated model                                                  │
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
│ │ Key Properties:                                                         │ │
│ │   • $fillable: ['user_id', 'badge_id', 'source_type', 'source_id',      │ │
│ │                 'earned_at', 'is_displayed']                            │ │
│ │   • $casts: ['earned_at' => 'datetime', 'is_displayed' => 'boolean']    │ │
│ │                                                                         │ │
│ │ The is_displayed field:                                                 │ │
│ │   • Type: boolean                                                       │ │
│ │   • Default: true (badges displayed by default when earned)             │ │
│ │   • Controls visibility on user's public profile                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent response structure across the API             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 response with data                   │ │
│ │   • unauthorized($message) → 401 response                               │ │
│ │   • notFound($message) → 404 response                                   │ │
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
│ 1. SELECT: Find user badge by ID and user_id                                │
│    Query: SELECT * FROM user_badges                                         │
│           WHERE id = ? AND user_id = ? LIMIT 1                              │
│    Source: BadgeService::toggleBadgeDisplay()                               │
│                                                                             │
│ 2. UPDATE: Toggle is_displayed field (if badge found)                       │
│    Query: UPDATE user_badges SET is_displayed = ?, updated_at = ?           │
│           WHERE id = ?                                                      │
│    Source: UserBadge->save()                                                │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ None - Display status is user-specific and changes frequently               │
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
│ COMPONENT: ApiResponse::success() / ApiResponse::notFound()                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │                                                                         │ │
│ │ Success Response:                                                       │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Badge display toggled successfully',                  │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => Str::uuid()->toString(),                    │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ │                                                                         │ │
│ │ Error Response:                                                         │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'error',                                                │ │
│ │     'message' => 'Badge not found or does not belong to you',           │ │
│ │     'data' => null,                                                     │ │
│ │     'errors' => [],                                                     │ │
│ │     'meta' => [...],                                                    │ │
│ │ ], 404);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK / 401 / 404 + JSON Body                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                    | Used By Endpoints                     | Reusable | Reasoning                                     |
| ----------------------- | ------------------------------------- | -------- | --------------------------------------------- |
| `BadgeController.php`   | All badge endpoints                   | ⭕       | Controller is shared; methods are distinct    |
| `BadgeService.php`      | All badge endpoints                   | ✅       | Service layer encapsulates badge logic        |
| `UserBadge.php` (Model) | All user badge endpoints              | ✅       | Core model for user badge ownership           |
| `ApiResponse.php`       | All API endpoints                     | ✅       | Standardized response format utility          |
| `toggleBadgeDisplay()`  | Toggle display endpoint only          | ❌       | Single purpose - toggles badge display        |
| `is_displayed` field    | Toggle display, displayed badges list | ✅       | Shared column used for filtering and toggling |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                      |
| ----- | ------ | ---------------------------------------------- |
| N/A   | N/A    | No validation - ID is validated by route regex |

### Authentication Errors (401)

| Error          | Source           | Condition                       |
| -------------- | ---------------- | ------------------------------- |
| `Unauthorized` | `auth:sanctum`   | Missing or invalid Bearer token |
| `Unauthorized` | Controller check | User is null after auth check   |

### Business Logic Errors (404)

| Error                                       | Source         | Condition                           |
| ------------------------------------------- | -------------- | ----------------------------------- |
| `Badge not found or does not belong to you` | `BadgeService` | UserBadge ID doesn't exist          |
| `Badge not found or does not belong to you` | `BadgeService` | UserBadge belongs to different user |

### System Errors (500)

| Error                     | Source   | Condition                        |
| ------------------------- | -------- | -------------------------------- |
| Database connection error | Eloquent | Database unavailable             |
| Write failure             | Eloquent | Unable to update user_badges row |

### Edge Cases

| Case                                      | Behavior                                           |
| ----------------------------------------- | -------------------------------------------------- |
| Badge already displayed → toggle          | Sets `is_displayed = false`                        |
| Badge already hidden → toggle             | Sets `is_displayed = true`                         |
| Invalid ID format (non-numeric)           | Route doesn't match, returns 404 from framework    |
| ID = 0 or negative                        | Route regex `[0-9]+` allows 0; service returns 404 |
| User tries to toggle another user's badge | 404 - ownership check in service layer             |
| Concurrent toggle requests                | Last write wins (no locking implemented)           |
| Non-existent UserBadge ID                 | 404 response                                       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE
   │                       │                       │                       │                       │
   │  POST /user/badges/   │                       │                       │                       │
   │     {id}/toggle-display                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │    validate token     │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. Get user from      │                       │
   │                       │                       │    request            │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. Call service       │                       │
   │                       │                       │    toggleBadgeDisplay │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. SELECT user_badges │
   │                       │                       │                       │    WHERE id = ?       │
   │                       │                       │                       │    AND user_id = ?    │
   │                       │                       │                       │───────────────────────▶
   │                       │                       │                       │◀───────────────────────
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. UPDATE user_badges │
   │                       │                       │                       │    SET is_displayed   │
   │                       │                       │                       │───────────────────────▶
   │                       │                       │                       │◀───────────────────────
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │    return true        │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. Build response     │                       │
   │                       │                       │    via ApiResponse    │                       │
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

| Addition                              | Location                                                 |
| ------------------------------------- | -------------------------------------------------------- |
| Return new display status in response | `BadgeController::toggleDisplay()` - modify return data  |
| Limit max displayed badges            | `BadgeService::toggleBadgeDisplay()` - add count check   |
| Emit real-time event on toggle        | `BadgeService::toggleBadgeDisplay()` - after save()      |
| Add toggle history/audit log          | `BadgeService::toggleBadgeDisplay()` - log before toggle |
| Bulk toggle multiple badges           | New controller method + service method                   |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                          | What to Change                          |
| ----- | ------------------------------------------------------------- | --------------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Progression/BadgeController.php` | Return data in ApiResponse::success()   |
| **2** | `app/Services/Progression/BadgeService.php`                   | Return UserBadge object instead of bool |

**Example: Return new display status**

```php
// In BadgeController::toggleDisplay()
$result = $this->badgeService->toggleBadgeDisplay($id, $userId);

if ($result === null) {
    return ApiResponse::notFound('Badge not found or does not belong to you');
}

return ApiResponse::success([
    'id' => $result->id,
    'is_displayed' => $result->is_displayed,
], 'Badge display toggled successfully');
```

#### ➖ REMOVING THE NULL DATA RESPONSE

| Step  | File                                                          | What to Change                     |
| ----- | ------------------------------------------------------------- | ---------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Progression/BadgeController.php` | Change `null` to desired structure |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────┐
│ Route Parameter: {id}   │
│  • UserBadge ID         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Service Method          │
│  • $userBadgeId (int)   │
│  • $userId (int)        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ user_badges table       │
│  • id ◄──── Route param │
│  • user_id ◄─ From auth │
│  • is_displayed ◄─ TOGGLED
│  • badge_id             │
│  • source_type          │
│  • source_id            │
│  • earned_at            │
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ ApiResponse             │
│  • status: "success"    │
│  • message: "..."       │
│  • data: null           │
│  • meta: {...}          │
└─────────────────────────┘
```

### 📋 Toggle Logic Detail

```
Before Toggle:
┌────────────────────────────────────┐
│ is_displayed = true  (visible)     │
└────────────────────────────────────┘
                │
                ▼ (! operator)
┌────────────────────────────────────┐
│ is_displayed = false (hidden)      │
└────────────────────────────────────┘

Before Toggle:
┌────────────────────────────────────┐
│ is_displayed = false (hidden)      │
└────────────────────────────────────┘
                │
                ▼ (! operator)
┌────────────────────────────────────┐
│ is_displayed = true  (visible)     │
└────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `is_displayed` boolean logic       | Simple toggle using ! operator - don't overcomplicate     |
| Ownership check (user_id match)    | Security: prevents users from modifying others' badges    |
| Return type (bool → object change) | Breaking change for controller logic                      |
| Route parameter name `{id}`        | Mobile/web clients depend on URL structure                |
| 404 vs 403 for unauthorized access | Current design uses 404 to avoid exposing badge existence |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                          |
| -------------------------------------- | --------------------------------------------------- |
| Confusing Badge ID with UserBadge ID   | Route uses UserBadge.id, not badges.id              |
| Removing user_id check (security hole) | Always verify user owns the badge before modifying  |
| Not handling null user case            | Controller checks user === null before service call |
| Returning 403 instead of 404           | 404 is intentional to not expose badge existence    |
| Adding cache without invalidation      | Display status changes frequently; cache carefully  |
| Changing response structure            | Clients expect `data: null` for this endpoint       |

### 📁 File Locations Quick Reference

```
routes/api/badges.php                                    ← Route definition (line 24)
app/Http/Controllers/Api/V1/Progression/
  └── BadgeController.php                                ← Controller (lines 117-133)
app/Services/Progression/
  └── BadgeService.php                                   ← Business logic (lines 156-173)
app/Models/Progression/
  └── UserBadge.php                                      ← UserBadge model
app/Http/Utils/
  └── ApiResponse.php                                    ← Response formatting
```

---

## Document Metadata

| Property            | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/badges/{id}/toggle-display` |
| **Domain**          | User                                           |
| **Author**          | System Documentation                           |
| **Created**         | 2026-02-01                                     |
| **Laravel Version** | 12.x                                           |
| **PHP Version**     | 8.4                                            |
