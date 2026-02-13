# DELETE /api/v1/user/agency/users/{targetUser}/block

> **Domain**: User Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Unblocks a previously blocked user, allowing them to send join requests to the agency again. This endpoint reverses the block action performed by agency owners/admins.

### Responsibilities

- Authenticate and authorize the requesting user
- Verify the user manages an operational agency (owner or admin)
- Delete the block record from the database
- Return appropriate success/error responses

### What It Owns

| Owned                 | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| Block Record Deletion | Deletes `agency_user_blocks` record for AGENCY blocker type       |
| Agency Access Control | Validates user has management permissions via `ManagesUserAgency` |

### External Dependencies

| Dependency | Type           | Purpose                      |
| ---------- | -------------- | ---------------------------- |
| MySQL      | Database       | Stores/deletes block records |
| Sanctum    | Authentication | Validates bearer token       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/user/agency/users/{targetUser}/block
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter  | Key   | Config                  |
| -------- | ----- | ----------------------- |
| Standard | `api` | Default API rate limits |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter    | Type      | Required | Description               |
| ------------ | --------- | -------- | ------------------------- |
| `targetUser` | `integer` | ✅       | ID of the user to unblock |

### Request Body Schema

```json
// No request body required
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User unblocked.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T18:25:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthenticated Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T18:25:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not manage any agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T18:25:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "User is not blocked.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T18:25:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                |
| ----- | ---------------------------------------- |
| `200` | User successfully unblocked              |
| `401` | User not authenticated                   |
| `403` | User does not manage any agency          |
| `404` | Target user is not blocked by the agency |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│             DELETE /api/v1/user/agency/users/{targetUser}/block             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:132                                           │
│ Route: Route::delete('/{targetUser}/block',                                 │
│            [AgencyBlockController::class, 'unblock'])                       │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Authenticates user via Sanctum token                    │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {targetUser} → User model instance via implicit binding                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyBlockController.php:59       │
│                                                                             │
│ No FormRequest - direct controller method receives Request                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function unblock(Request $request, User $targetUser): JsonResponse│
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyBlockController.php          │
│ Method: unblock(Request $request, User $targetUser)                         │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get user's managed agency via trait                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $this->getUserManagedAgency($user);                           │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not manage any agency.', [], 403);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Delete block record                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $deleted = $agency->blocks()                                            │ │
│ │     ->where('user_id', $targetUser->id)                                 │ │
│ │     ->where('blocker_type', AgencyBlockerType::AGENCY)                  │ │
│ │     ->delete();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Handle result                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($deleted === 0) {                                                   │ │
│ │     return ApiResponse::error('User is not blocked.', [], 404);         │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(null, 'User unblocked.');                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service layer - business logic handled in controller           │
│                                                                             │
│ ManagesUserAgency Trait (app/Concerns/ManagesUserAgency.php):               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ protected function getUserManagedAgency(User $user): ?Agency            │ │
│ │ {                                                                       │ │
│ │     // Check owned agency first                                         │ │
│ │     $ownedAgency = $user->ownedAgency;                                  │ │
│ │     if ($ownedAgency !== null && $ownedAgency->isOperational()) {       │ │
│ │         return $ownedAgency;                                            │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // Check if admin of an agency                                      │ │
│ │     $membership = $user->activeAgencyMembership()                       │ │
│ │         ->whereIn('role', ['owner', 'admin'])                           │ │
│ │         ->with('agency')                                                │ │
│ │         ->first();                                                      │ │
│ │                                                                         │ │
│ │     if ($membership !== null && $membership->agency->isOperational()) { │ │
│ │         return $membership->agency;                                     │ │
│ │     }                                                                   │ │
│ │     return null;                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ManagesUserAgency (Trait)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Concerns/ManagesUserAgency.php                                │ │
│ │ Responsibility: Determines which agency a user can manage               │ │
│ │ Reusable: YES (used by all agency management controllers)               │ │
│ │ Why It Exists: Centralizes agency management permission logic           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getUserManagedAgency() → Returns owned/admin agency or null         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyBlockerType (Enum)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyBlockerType.php                            │ │
│ │ Responsibility: Defines block source types (AGENCY or USER)             │ │
│ │ Reusable: YES (used across all block-related operations)                │ │
│ │ Why It Exists: Type-safe representation of blocker types                │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • AGENCY = 'agency' → Agency blocked the user                         │ │
│ │   • USER = 'user' → User blocked the agency                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent response structure across API                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Returns success response with data and message          │ │
│ │   • error() → Returns error response with message and status code       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyUserBlock (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyUserBlock.php                             │ │
│ │ Responsibility: Represents block records in database                    │ │
│ │ Reusable: YES (used for all block operations)                           │ │
│ │ Why It Exists: Eloquent model for agency_user_blocks table              │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • agency_id → Foreign key to agency                                   │ │
│ │   • user_id → Foreign key to blocked/blocking user                      │ │
│ │   • blocker_type → AGENCY or USER                                       │ │
│ │   • blocked_by → User who created the block                             │ │
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
│ 1. SELECT: Check owned agency                                               │
│    Query: SELECT * FROM agencies WHERE user_id = ? LIMIT 1                  │
│    Source: ManagesUserAgency::getUserManagedAgency() via ownedAgency        │
│                                                                             │
│ 2. SELECT: Check agency membership (if no owned agency)                     │
│    Query: SELECT * FROM agency_members                                      │
│           WHERE user_id = ? AND status = 'active'                           │
│           AND role IN ('owner', 'admin') LIMIT 1                            │
│    Source: ManagesUserAgency::getUserManagedAgency()                        │
│                                                                             │
│ 3. DELETE: Remove block record                                              │
│    Query: DELETE FROM agency_user_blocks                                    │
│           WHERE agency_id = ? AND user_id = ? AND blocker_type = 'agency'   │
│    Source: Controller::unblock()                                            │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None                                                                      │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None                                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response built via ApiResponse utility:                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Success case                                                         │ │
│ │ return ApiResponse::success(null, 'User unblocked.');                   │ │
│ │                                                                         │ │
│ │ // Error case (not blocked)                                             │ │
│ │ return ApiResponse::error('User is not blocked.', [], 404);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ApiResponse::success() returns:                                             │
│ {                                                                           │
│   "status": "success",                                                      │
│   "message": "User unblocked.",                                             │
│   "data": null,                                                             │
│   "meta": {                                                                 │
│     "timestamp": "...",                                                     │
│     "correlation_id": "..."                                                 │
│   }                                                                         │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         200 + JSON Body                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                        | Used By Endpoints            | Reusable | Reasoning                            |
| --------------------------- | ---------------------------- | -------- | ------------------------------------ |
| `AgencyBlockController.php` | block, unblock endpoints     | ⭕       | Controller specific to block/unblock |
| `ManagesUserAgency.php`     | All agency management routes | ✅       | Shared trait for agency access       |
| `AgencyBlockerType.php`     | All block-related operations | ✅       | Enum for block types                 |
| `ApiResponse.php`           | All API endpoints            | ✅       | Standard response utility            |
| `AgencyUserBlock.php`       | All block operations         | ✅       | Eloquent model for blocks            |
| `Agency.php`                | All agency operations        | ✅       | Core agency model                    |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source                | Condition               |
| ------------------ | --------------------- | ----------------------- |
| "Unauthenticated." | Controller null check | No valid token provided |

### Forbidden Errors (403)

| Error                           | Source                  | Condition                          |
| ------------------------------- | ----------------------- | ---------------------------------- |
| "You do not manage any agency." | ManagesUserAgency trait | User not owner/admin of any agency |

### Not Found Errors (404)

| Error                  | Source        | Condition                                  |
| ---------------------- | ------------- | ------------------------------------------ |
| "User is not blocked." | Controller    | No block record exists for AGENCY type     |
| Model not found        | Route binding | targetUser ID doesn't exist in users table |

### System Errors (500)

| Error                | Source   | Condition                |
| -------------------- | -------- | ------------------------ |
| Database error       | Eloquent | DB connection failure    |
| Exception in request | Laravel  | Unexpected runtime error |

### Edge Cases

| Case                                         | Behavior                                     |
| -------------------------------------------- | -------------------------------------------- |
| Target user has USER type block (not AGENCY) | Returns 404 - only AGENCY blocks are removed |
| User is both owner and admin of same agency  | Owner path takes precedence                  |
| Agency is not operational                    | Returns 403 (trait returns null)             |
| Self-unblock attempt                         | Allowed if user was blocked by agency        |
| Already unblocked user                       | Returns 404 "User is not blocked."           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                SANCTUM                 CONTROLLER            TRAIT/MODEL                DATABASE
   │                      │                        │                      │                        │
   │  DELETE /users/{id}/block                     │                      │                        │
   │─────────────────────▶│                        │                      │                        │
   │                      │                        │                      │                        │
   │                      │ 1. Validate token      │                      │                        │
   │                      │───────────────────────▶│                      │                        │
   │                      │                        │                      │                        │
   │                      │                        │ 2. Get user          │                        │
   │                      │                        │─────────────────────▶│                        │
   │                      │                        │                      │                        │
   │                      │                        │ 3. getUserManagedAgency()                     │
   │                      │                        │─────────────────────▶│                        │
   │                      │                        │                      │                        │
   │                      │                        │                      │ 4. SELECT agencies     │
   │                      │                        │                      │───────────────────────▶│
   │                      │                        │                      │◀───────────────────────│
   │                      │                        │                      │                        │
   │                      │                        │                      │ 5. SELECT memberships  │
   │                      │                        │                      │───────────────────────▶│
   │                      │                        │                      │◀───────────────────────│
   │                      │                        │                      │                        │
   │                      │                        │◀─────────────────────│                        │
   │                      │                        │                      │                        │
   │                      │                        │ 6. DELETE block record                        │
   │                      │                        │─────────────────────────────────────────────▶│
   │                      │                        │◀─────────────────────────────────────────────│
   │                      │                        │                      │                        │
   │                      │                        │ 7. Check deleted count                        │
   │                      │                        │ (if 0 → 404, else → 200)                      │
   │                      │                        │                      │                        │
   │                      │◀───────────────────────│                      │                        │
   │◀─────────────────────│                        │                      │                        │
   │                      │                        │                      │                        │
   │  200 + JSON          │                        │                      │                        │
   │                      │                        │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location(s)                        |
| --------------------------- | ---------------------------------- |
| Audit logging on unblock    | Controller `unblock()` method      |
| Event dispatch on unblock   | Controller after successful delete |
| Bulk unblock                | New controller method + new route  |
| Notification on unblock     | Controller after successful delete |
| Soft delete instead of hard | Model + migration change           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO BLOCK RECORD

| Step  | File                                                 | What to Change                          |
| ----- | ---------------------------------------------------- | --------------------------------------- |
| **1** | **Database Migration**                               | Add new column                          |
| **2** | `app/Models/Agency/AgencyUserBlock.php`              | Add to `$fillable`                      |
| **3** | `app/Http/Controllers/.../AgencyBlockController.php` | Use new field in delete query if needed |

#### ➖ REMOVING A FIELD

| Step  | File                                                 | What to Change          |
| ----- | ---------------------------------------------------- | ----------------------- |
| **1** | `app/Models/Agency/AgencyUserBlock.php`              | Remove from `$fillable` |
| **2** | `app/Http/Controllers/.../AgencyBlockController.php` | Remove from queries     |
| **3** | **Database Migration**                               | Drop column (if safe)   |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNBLOCK FIELD FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  URL Parameter                                                              │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐       ┌─────────────────┐       ┌──────────────────────┐  │
│  │ targetUser  │──────▶│ Route Binding   │──────▶│ User Model Instance  │  │
│  │ (id)        │       │                 │       │                      │  │
│  └─────────────┘       └─────────────────┘       └──────────────────────┘  │
│                                                            │                │
│                                                            ▼                │
│                        ┌───────────────────────────────────────────────┐   │
│                        │                DELETE QUERY                    │   │
│                        │  agency_id = managed agency ID                 │   │
│                        │  user_id = targetUser->id                      │   │
│                        │  blocker_type = 'agency'                       │   │
│                        └───────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Checklist: Adding Unblock Reason Tracking

- [ ] Create migration adding `unblocked_at` column to track history
- [ ] Consider separate audit table for block/unblock history
- [ ] Update controller to use soft delete or logging
- [ ] Add event dispatch for audit purposes

### ⚠️ What Should NOT Be Modified Casually

| Component                  | Reason                                                 |
| -------------------------- | ------------------------------------------------------ |
| `blocker_type` filter      | Must be AGENCY to avoid removing USER-initiated blocks |
| `ManagesUserAgency` logic  | Affects all agency management endpoints                |
| `ApiResponse` structure    | Breaking change for all API consumers                  |
| Route model binding        | Changes URL structure and parameter handling           |
| `AgencyBlockerType` values | Database stores string values, changing breaks data    |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                             |
| --------------------------------- | ------------------------------------------------------ |
| Removing USER blocks accidentally | Always filter by `blocker_type = AGENCY`               |
| Ignoring deleted count            | Check `$deleted` to determine if record existed        |
| Hardcoding blocker type strings   | Use `AgencyBlockerType::AGENCY` enum                   |
| Forgetting operational check      | `ManagesUserAgency` handles this via `isOperational()` |
| Allowing non-managers to unblock  | Trait returns null for non-owner/admin users           |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 132)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyBlockController.php                            ← Controller with unblock method
app/Concerns/
  └── ManagesUserAgency.php                                ← Trait for agency access
app/Enums/Agency/
  └── AgencyBlockerType.php                                ← Enum for block types
app/Models/Agency/
  ├── Agency.php                                           ← Agency model with blocks()
  └── AgencyUserBlock.php                                  ← Block record model
app/Http/Utils/
  └── ApiResponse.php                                      ← Response utility
database/migrations/
  └── 2025_12_27_000005_create_agency_user_blocks_table.php ← Table schema
```

---

## Document Metadata

| Property            | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/user/agency/users/{targetUser}/block` |
| **Domain**          | User Agency Management                                |
| **Author**          | System Documentation                                  |
| **Created**         | 2026-02-03                                            |
| **Laravel Version** | 12.x                                                  |
| **PHP Version**     | 8.4+                                                  |
