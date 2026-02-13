# POST /api/v1/user/agency/users/{targetUser}/block

> **Domain**: User / Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Allows agency owners or admins to block a user from sending join requests to their agency.

### Responsibilities

- Validate authenticated user manages an agency
- Check for existing blocks to prevent duplicates
- Create agency-initiated user block record
- Return appropriate success or error response

### What It Owns

| Owned               | Description                                          |
| ------------------- | ---------------------------------------------------- |
| User Block Creation | Creates `agency_user_blocks` record with type AGENCY |

### External Dependencies

| Dependency | Type           | Purpose                  |
| ---------- | -------------- | ------------------------ |
| Database   | Infrastructure | Store block records      |
| Sanctum    | Package        | API token authentication |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/agency/users/{targetUser}/block
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter     | Key     | Config                     |
| ----------- | ------- | -------------------------- |
| Default API | User ID | `config/rate-limiting.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter    | Type      | Required | Description      |
| ------------ | --------- | -------- | ---------------- |
| `targetUser` | `integer` | ✅       | User ID to block |

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
  "message": "User blocked from sending join requests.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T18:17:47.000000Z",
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
    "timestamp": "2026-02-03T18:17:47.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "You do not manage any agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T18:17:47.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "This block already exists.",
  "data": null,
  "errors": {
    "block": ["Block already exists."]
  },
  "meta": {
    "timestamp": "2026-02-03T18:17:47.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                             |
| ----- | ------------------------------------- |
| `200` | User successfully blocked             |
| `401` | User not authenticated                |
| `403` | User doesn't manage any agency        |
| `404` | Target user not found (route binding) |
| `422` | Block already exists                  |
| `500` | Database or system error              |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/user/agency/users/{targetUser}/block              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:128                                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{targetUser}/block', [AgencyBlockController::class,       │ │
│ │     'block'])                                                           │ │
│ │     ->name('user.agency.users.block');                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads user                      │
│   2. Route Model Binding → Resolves {targetUser} to User model              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER METHOD                                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyBlockController.php:28       │
│ Method: block(Request $request, User $targetUser, BlockUserAction $action)  │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get user's managed agency (via ManagesUserAgency trait)             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $this->getUserManagedAgency($user);                           │ │
│ │                                                                         │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not manage any agency.', [], 403);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute block action                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute(                                             │ │
│ │     agency: $agency,                                                    │ │
│ │     user: $targetUser,                                                  │ │
│ │     actor: $user,                                                       │ │
│ │     blockerType: AgencyBlockerType::AGENCY,                             │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Handle action result                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage() ?? 'An error occurred',                   │ │
│ │         $result->getErrors(),                                           │ │
│ │         422                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(null, $result->getMessage());               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SUPPORTING TRAIT: ManagesUserAgency                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Concerns/ManagesUserAgency.php:18                                 │
│ Method: getUserManagedAgency(User $user): ?Agency                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Check owned agency first                                             │ │
│ │ $ownedAgency = $user->ownedAgency;                                      │ │
│ │                                                                         │ │
│ │ if ($ownedAgency !== null && $ownedAgency->isOperational()) {           │ │
│ │     return $ownedAgency;                                                │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Check if admin of an agency                                          │ │
│ │ $membership = $user->activeAgencyMembership()                           │ │
│ │     ->whereIn('role', ['owner', 'admin'])                               │ │
│ │     ->with('agency')                                                    │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($membership !== null && $membership->agency->isOperational()) {     │ │
│ │     return $membership->agency;                                         │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return null;                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 ACTION: BlockUserAction                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/BlockUserAction.php:27                             │
│ Method: execute(Agency, User, User, AgencyBlockerType): ActionResult        │
│                                                                             │
│ STEP 1: Check for existing block                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $existingBlock = AgencyUserBlock::where('agency_id', $agency->id)       │ │
│ │     ->where('user_id', $user->id)                                       │ │
│ │     ->where('blocker_type', $blockerType)                               │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($existingBlock !== null) {                                          │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This block already exists.',                          │ │
│ │         errors: ['block' => ['Block already exists.']],                 │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Create block in transaction                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use (...) {                          │ │
│ │     $block = AgencyUserBlock::create([                                  │ │
│ │         'agency_id' => $agency->id,                                     │ │
│ │         'user_id' => $user->id,                                         │ │
│ │         'blocker_type' => $blockerType,                                 │ │
│ │         'blocked_by' => $actor->id,                                     │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     $block->load(['agency', 'user', 'blocker']);                        │ │
│ │                                                                         │ │
│ │     return ActionResult::success(                                       │ │
│ │         data: $block,                                                   │ │
│ │         message: 'User blocked from sending join requests.',            │ │
│ │         meta: ['block_id' => $block->id, 'blocker_type' => ...]         │ │
│ │     );                                                                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyBlockerType (Enum)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyBlockerType.php                            │ │
│ │ Responsibility: Indicates who initiated the block                       │ │
│ │ Reusable: YES (used by agencies block and user block endpoints)         │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • AGENCY = 'agency'  → Agency blocked user from join requests         │ │
│ │   • USER = 'user'      → User blocked agency from invitations           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (DTO)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action result container                    │ │
│ │ Reusable: YES (used across all actions)                                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Create successful result                                │ │
│ │   • failure() → Create failure result                                   │ │
│ │   • isSuccess() → Check if action succeeded                             │ │
│ │   • getMessage() → Get result message                                   │ │
│ │   • getErrors() → Get error array                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON responses                             │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 response with data                                  │ │
│ │   • error() → Error response with status code                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Check user's owned agency                                        │
│    Query: SELECT * FROM agencies WHERE owner_id = ?                         │
│    Source: User->ownedAgency relationship                                   │
│                                                                             │
│ 2. SELECT: Check user's agency membership (if not owner)                    │
│    Query: SELECT * FROM agency_members WHERE user_id = ?                    │
│           AND role IN ('owner', 'admin') AND status = 'active'              │
│    Source: User->activeAgencyMembership()                                   │
│                                                                             │
│ 3. SELECT: Check for existing block                                         │
│    Query: SELECT * FROM agency_user_blocks                                  │
│           WHERE agency_id = ? AND user_id = ? AND blocker_type = 'agency'   │
│    Source: BlockUserAction::execute()                                       │
│                                                                             │
│ 4. INSERT: Create block record (in transaction)                             │
│    Query: INSERT INTO agency_user_blocks                                    │
│           (agency_id, user_id, blocker_type, blocked_by, ...)               │
│    Source: AgencyUserBlock::create()                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:15                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'User blocked from sending join requests.',            │ │
│ │     'data' => null,                                                     │ │
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
│                        200 OK + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                        | Used By Endpoints               | Reusable | Reasoning                       |
| --------------------------- | ------------------------------- | -------- | ------------------------------- |
| `AgencyBlockController.php` | block, unblock                  | ⭕       | Controller methods are separate |
| `BlockUserAction.php`       | block, agency block             | ✅       | Generic for both directions     |
| `ManagesUserAgency.php`     | All agency management endpoints | ✅       | Reusable trait                  |
| `AgencyBlockerType.php`     | Block/unblock endpoints         | ✅       | Shared enum                     |
| `ActionResult.php`          | All actions                     | ✅       | Standard result container       |
| `ApiResponse.php`           | All API endpoints               | ✅       | Centralized response helper     |
| `AgencyUserBlock.php`       | All block-related endpoints     | ✅       | Shared model                    |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source        | Condition                       |
| ------------------ | ------------- | ------------------------------- |
| "Unauthenticated." | Controller:32 | `$request->user()` returns null |

### Authorization Errors (403)

| Error                           | Source        | Condition                         |
| ------------------------------- | ------------- | --------------------------------- |
| "You do not manage any agency." | Controller:38 | User is not owner/admin of agency |

### Business Logic Errors (422)

| Error                        | Source             | Condition                   |
| ---------------------------- | ------------------ | --------------------------- |
| "This block already exists." | BlockUserAction:40 | Block record already exists |

### System Errors (500)

| Error                     | Source             | Condition                   |
| ------------------------- | ------------------ | --------------------------- |
| "Failed to create block." | BlockUserAction:71 | Database transaction failed |

### Edge Cases

| Case                              | Behavior                                   |
| --------------------------------- | ------------------------------------------ |
| Target user doesn't exist         | 404 from route model binding               |
| User blocked by user (not agency) | Still allows agency block (different type) |
| Agency is not operational         | Returns 403 - no managed agency            |
| User is agency member             | Block still created (blocks join requests) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                 DATABASE
   │                       │                       │                    │                       │
   │  POST /{targetUser}/block                     │                    │                       │
   │──────────────────────▶│                       │                    │                       │
   │                       │                       │                    │                       │
   │                       │ 1. auth:sanctum       │                    │                       │
   │                       │   (validate token)    │                    │                       │
   │                       │──────────────────────▶│                    │                       │
   │                       │                       │                    │                       │
   │                       │ 2. Resolve targetUser │                    │                       │
   │                       │   (route binding)     │                    │                       │
   │                       │                       │                    │                       │
   │                       │                       │ 3. Get user        │                       │
   │                       │                       │────────────────────│───────────────────────▶
   │                       │                       │                    │  SELECT owned agency   │
   │                       │                       │                    │◀──────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │ 4. Get managed     │                       │
   │                       │                       │    agency          │                       │
   │                       │                       │────────────────────│───────────────────────▶
   │                       │                       │                    │  SELECT membership     │
   │                       │                       │                    │◀──────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │ 5. Execute action  │                       │
   │                       │                       │───────────────────▶│                       │
   │                       │                       │                    │                       │
   │                       │                       │                    │ 6. Check existing     │
   │                       │                       │                    │────────────────────────▶
   │                       │                       │                    │  SELECT block          │
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │                    │ 7. Create block       │
   │                       │                       │                    │────────────────────────▶
   │                       │                       │                    │  INSERT block          │
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │◀──────────────────│                       │
   │                       │                       │   ActionResult     │                       │
   │                       │                       │                    │                       │
   │                       │◀──────────────────────│                    │                       │
   │◀──────────────────────│                       │                    │                       │
   │                       │                       │                    │                       │
   │  200 + JSON           │                       │                    │                       │
   │                       │                       │                    │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                             |
| ------------------------ | ------------------------------------ |
| Additional block reasons | `BlockUserAction.php` + migration    |
| Block expiration         | `AgencyUserBlock` model + migration  |
| Notification on block    | `BlockUserAction.php` (after create) |
| Block history/audit      | Create new audit model and listener  |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `reason`)

| Step  | File                                     | What to Change             |
| ----- | ---------------------------------------- | -------------------------- |
| **1** | **Database Migration**                   | Add `reason` column        |
| **2** | `app/Models/Agency/AgencyUserBlock.php`  | Add to `$fillable`         |
| **3** | `app/Actions/Agency/BlockUserAction.php` | Pass reason to create()    |
| **4** | `AgencyBlockController.php`              | Accept reason from request |

#### ➖ REMOVING A FIELD

| Step  | File                                     | What to Change            |
| ----- | ---------------------------------------- | ------------------------- |
| **1** | `app/Actions/Agency/BlockUserAction.php` | Remove from create() call |
| **2** | `app/Models/Agency/AgencyUserBlock.php`  | Remove from `$fillable`   |
| **3** | **Database Migration**                   | Drop column               |

### 🔗 Field Flow Dependency Chain

```
Request → Controller → BlockUserAction → AgencyUserBlock::create()
                           │
                           ▼
                    agency_id ───────┐
                    user_id ─────────┼──▶ agency_user_blocks table
                    blocker_type ────┤
                    blocked_by ──────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                      |
| ------------------------- | ------------------------------------------- |
| `blocker_type` enum       | Used to differentiate agency vs user blocks |
| `AgencyBlockerType`       | Changing values breaks existing records     |
| `ManagesUserAgency` trait | Shared by multiple controllers              |
| Transaction in action     | Ensures data consistency                    |

### 🚨 Common Pitfalls

| Pitfall                         | Prevention                                |
| ------------------------------- | ----------------------------------------- |
| Forgetting blocker_type check   | Action checks blocker_type for uniqueness |
| Not checking agency operational | Trait checks `isOperational()`            |
| Missing transaction on create   | Action uses `DB::transaction()`           |
| Blocking own agency members     | Add validation if needed                  |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                              ← Route definition (line 128)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyBlockController.php                      ← Controller
app/Actions/Agency/
  └── BlockUserAction.php                            ← Business logic action
app/Concerns/
  └── ManagesUserAgency.php                          ← Authorization trait
app/Models/Agency/
  └── AgencyUserBlock.php                            ← Block model
app/Enums/Agency/
  └── AgencyBlockerType.php                          ← Block type enum
app/Actions/
  └── ActionResult.php                               ← Result container
app/Http/Utils/
  └── ApiResponse.php                                ← Response helper
```

---

## Document Metadata

| Property            | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/agency/users/{targetUser}/block` |
| **Domain**          | User / Agency Management                            |
| **Author**          | System Documentation                                |
| **Created**         | 2026-02-03                                          |
| **Laravel Version** | 12.x                                                |
| **PHP Version**     | 8.4                                                 |
