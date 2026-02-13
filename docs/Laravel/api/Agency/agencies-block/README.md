# POST /api/v1/agencies/{agency}/block

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Block an agency from sending invitations to the authenticated user. This is a user-initiated block that prevents the specified agency from inviting the user to join.

### Responsibilities

- Authenticate the requesting user via Sanctum Bearer token
- Create a new block record with `blocker_type = 'user'`
- Verify that a duplicate block does not already exist
- Store the block relationship in `agency_user_blocks` table
- Return success confirmation or appropriate error

### What It Owns

| Owned              | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| Block creation     | Creates new `agency_user_blocks` record                         |
| Duplicate check    | Ensures only one block per agency-user-blocker_type combination |
| User block context | Sets `blocker_type` to `'user'` indicating user initiated block |

### External Dependencies

| Dependency | Type           | Purpose                               |
| ---------- | -------------- | ------------------------------------- |
| Database   | Infrastructure | Create block record, check duplicates |
| Sanctum    | Auth Package   | Bearer token authentication           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/agencies/{agency}/block
```

### Authentication

✅ **Required** - Valid Sanctum Bearer token

### Rate Limiting

| Limiter | Key     | Config                       |
| ------- | ------- | ---------------------------- |
| Default | User ID | Laravel default API throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type      | Required | Description                     |
| --------- | --------- | -------- | ------------------------------- |
| `agency`  | `integer` | ✅       | Agency ID (route model binding) |

### Request Body Schema

```json
{}
```

No request body required. The agency is identified via the URL parameter.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Agency blocked from sending invitations.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T16:14:33.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Duplicate Block Error (422)

```json
{
  "status": "error",
  "message": "This block already exists.",
  "data": null,
  "errors": {
    "block": ["Block already exists."]
  },
  "meta": {
    "timestamp": "2026-02-03T16:14:33.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "message": "Agency not found"
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null,
  "errors": {},
  "meta": {
    "timestamp": "2026-02-03T16:14:33.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Agency blocked successfully                         |
| `401` | No valid authentication token                       |
| `404` | Agency ID does not exist (route model binding fail) |
| `422` | Block already exists (duplicate prevention)         |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/agencies/{agency}/block                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:45-46                                         │
│ Route: Route::post('/{agency}/block', [AgencyController::class, 'block'])   │
│        ->name('agencies.block')                                             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, resolves authenticated user   │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {agency} → Resolved to App\Models\Agency\Agency via implicit binding   │
│   • If not found → 404 response automatically                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No Form Request (No request body validation needed)                         │
│                                                                             │
│ The endpoint only requires:                                                 │
│   • Valid authentication (via middleware)                                   │
│   • Valid agency ID (via route model binding)                               │
│                                                                             │
│ Controller receives:                                                        │
│   • Request $request      → Laravel Request object (for auth user)         │
│   • Agency $agency        → Resolved agency model                          │
│   • BlockUserAction $action → Injected via DI container                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:217-240       │
│ Method: block(Request $request, Agency $agency,                             │
│               BlockUserAction $action): JsonResponse                        │
│                                                                             │
│ STEP 1: Get Authenticated User                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Defensive check (should not occur if middleware works correctly)        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Execute Block Action                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute(                                             │ │
│ │     agency: $agency,                                                    │ │
│ │     user: $user,              // User being blocked from invites        │ │
│ │     actor: $user,             // User performing the action (same)      │ │
│ │     blockerType: AgencyBlockerType::USER,  // User-initiated block      │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ Key: Both 'user' and 'actor' are the same - the current user           │ │
│ │ This is a USER-type block (user blocks agency from inviting them)       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle Action Result                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage() ?? 'An error occurred',                   │ │
│ │         $result->getErrors(),                                           │ │
│ │         422                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     null,  // No data returned on success                               │ │
│ │     $result->getMessage() ?? 'Agency blocked'                           │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ Note: Returns null for data - only confirmation message                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/BlockUserAction.php:17-73                          │
│ Method: execute(Agency $agency, User $user, User $actor,                    │
│                 AgencyBlockerType $blockerType): ActionResult               │
│                                                                             │
│ STEP 1: Check for Existing Block                                            │
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
│ │                                                                         │ │
│ │ Unique constraint: agency_id + user_id + blocker_type                   │ │
│ │ Each user can have ONE block per agency per blocker_type                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Create Block in Transaction                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($agency, $user, $actor, ...) {  │ │
│ │     $block = AgencyUserBlock::create([                                  │ │
│ │         'agency_id' => $agency->id,                                     │ │
│ │         'user_id' => $user->id,                                         │ │
│ │         'blocker_type' => $blockerType,      // 'user'                  │ │
│ │         'blocked_by' => $actor->id,          // Who created the block   │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     $block->load(['agency', 'user', 'blocker']);                        │ │
│ │                                                                         │ │
│ │     Eager loads relationships for potential use                         │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Determine Success Message Based on Blocker Type                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $message = $blockerType === AgencyBlockerType::AGENCY                   │ │
│ │     ? 'User blocked from sending join requests.'                        │ │
│ │     : 'Agency blocked from sending invitations.';                       │ │
│ │                                                                         │ │
│ │ For USER blocker type → 'Agency blocked from sending invitations.'     │ │
│ │ For AGENCY blocker type → 'User blocked from sending join requests.'   │ │
│ │                                                                         │ │
│ │ This endpoint always uses USER blocker type                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return Success Result                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: $block,                                                       │ │
│ │     message: $message,                                                  │ │
│ │     meta: [                                                             │ │
│ │         'block_id' => $block->id,                                       │ │
│ │         'blocker_type' => $blockerType->value,                          │ │
│ │     ],                                                                  │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ Note: Controller ignores the data and only uses message                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EXCEPTION HANDLING:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ } catch (\Throwable $e) {                                               │ │
│ │     return ActionResult::fromException($e, 'Failed to create block.'); │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Captures any database or system errors                                  │ │
│ │ Returns unified failure format with exception details                   │ │
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
│ │ Responsibility: Define who initiated the block relationship             │ │
│ │ Reusable: YES (used by both user-block and agency-block features)       │ │
│ │ Why It Exists: Bi-directional blocking - user→agency or agency→user    │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • AGENCY = 'agency' → Agency blocked user (user can't join)           │ │
│ │   • USER = 'user'     → User blocked agency (agency can't invite)       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable: 'Agency blocked user' or 'User blocked..'│ │
│ │   • effect() → 'Agency cannot send invitations to this user'           │ │
│ │   • values() → ['agency', 'user']                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyUserBlock (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyUserBlock.php                             │ │
│ │ Responsibility: Eloquent model for bi-directional block records         │ │
│ │ Reusable: YES (used by block/unblock features for both directions)      │ │
│ │ Why It Exists: Store agency-user blocking relationship with direction   │ │
│ │                                                                         │ │
│ │ Properties (fillable):                                                  │ │
│ │   • agency_id → Foreign key to agencies table                          │ │
│ │   • user_id → Foreign key to users table (blocked/blocking user)       │ │
│ │   • blocker_type → AgencyBlockerType enum ('agency' or 'user')         │ │
│ │   • blocked_by → Foreign key to users (who created the block)          │ │
│ │                                                                         │ │
│ │ Relationships:                                                          │ │
│ │   • agency() → BelongsTo Agency                                         │ │
│ │   • user() → BelongsTo User (the blocked/blocking user)                 │ │
│ │   • blocker() → BelongsTo User (who created the block)                  │ │
│ │                                                                         │ │
│ │ Key Scopes:                                                             │ │
│ │   • byAgency(int) → filter by agency                                    │ │
│ │   • byUser(int) → filter by user                                        │ │
│ │   • byAgencyBlocker() → WHERE blocker_type = 'agency'                   │ │
│ │   • byUserBlocker() → WHERE blocker_type = 'user'                       │ │
│ │                                                                         │ │
│ │ Helper Methods:                                                         │ │
│ │   • isAgencyBlock() → blocker_type === AGENCY                           │ │
│ │   • isUserBlock() → blocker_type === USER                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BlockUserAction (Action)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/Agency/BlockUserAction.php                            │ │
│ │ Responsibility: Encapsulate block creation business logic               │ │
│ │ Reusable: YES (used by user-block-agency and agency-block-user)         │ │
│ │ Why It Exists: Single action handles both block directions              │ │
│ │                                                                         │ │
│ │ Parameters:                                                             │ │
│ │   • agency → The agency in the relationship                            │ │
│ │   • user → The user in the relationship                                │ │
│ │   • actor → Who is performing the action                               │ │
│ │   • blockerType → Direction: USER or AGENCY                            │ │
│ │                                                                         │ │
│ │ Key Logic:                                                              │ │
│ │   • Check for existing block with same type                            │ │
│ │   • Create block in database transaction                               │ │
│ │   • Return appropriate message based on blocker type                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Unified success/failure container for action results    │ │
│ │ Reusable: YES (used by all action classes)                              │ │
│ │ Why It Exists: Eliminates exceptions for business logic, explicit flow  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(data, message, meta) → create success result               │ │
│ │   • failure(errors, message) → create failure result                   │ │
│ │   • fromException(Throwable) → wrap exceptions                         │ │
│ │   • isSuccess() / isFailure() → check outcome                          │ │
│ │   • getData() / getErrors() / getMessage() → access data               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Helper)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response construction                 │ │
│ │ Reusable: YES (used across all API controllers)                         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(data, message, meta, statusCode) → 2xx response            │ │
│ │   • error(message, errors, statusCode) → 4xx/5xx response              │ │
│ │   • unauthorized(message) → 401 response                               │ │
│ │                                                                         │ │
│ │ Response Structure:                                                     │ │
│ │   { status, message, data, meta: { timestamp, correlation_id } }       │ │
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
│ 1. [SELECT]: Agency by ID (via route model binding)                         │
│    Query: SELECT * FROM agencies WHERE id = ? AND deleted_at IS NULL        │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. [SELECT]: Check for existing block                                       │
│    Query: SELECT * FROM agency_user_blocks                                  │
│           WHERE agency_id = ? AND user_id = ? AND blocker_type = 'user'     │
│           LIMIT 1                                                           │
│    Source: AgencyUserBlock::where(...)->first()                             │
│    Index: Unique composite (agency_id, user_id, blocker_type)               │
│                                                                             │
│ 3. [INSERT]: Create block record (in transaction)                           │
│    Query: INSERT INTO agency_user_blocks                                    │
│           (agency_id, user_id, blocker_type, blocked_by, created_at, ...)   │
│           VALUES (?, ?, 'user', ?, now(), now())                            │
│    Source: AgencyUserBlock::create([...])                                   │
│                                                                             │
│ 4. [SELECT]: Eager load agency                                              │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: $block->load(['agency'])                                         │
│                                                                             │
│ 5. [SELECT]: Eager load user                                                │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $block->load(['user'])                                           │
│                                                                             │
│ 6. [SELECT]: Eager load blocker                                             │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $block->load(['blocker'])                                        │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Block operations are direct database writes                        │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - No async jobs or events dispatched                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:10-30                                  │
│                                                                             │
│ SIMPLE SUCCESS RESPONSE:                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(                                                   │ │
│ │     null,                              // No data payload               │ │
│ │     'Agency blocked from sending invitations.'  // Message from action │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ Unlike join requests, block responses don't return block data           │ │
│ │ The controller explicitly passes null for data                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL RESPONSE:                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Agency blocked from sending invitations.",                │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "ISO8601 datetime",                                    │ │
│ │     "correlation_id": "uuid"                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
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

| File                    | Used By Endpoints                       | Reusable | Reasoning                                   |
| ----------------------- | --------------------------------------- | -------- | ------------------------------------------- |
| `AgencyController.php`  | All agency endpoints                    | ⭕       | Contains multiple agency methods            |
| `BlockUserAction.php`   | User-block-agency and Agency-block-user | ✅       | Single action handles both block directions |
| `AgencyUserBlock.php`   | All block/unblock operations            | ✅       | Core model for bi-directional blocking      |
| `AgencyBlockerType.php` | All block operations                    | ✅       | Enum defines block direction                |
| `ActionResult.php`      | All action classes                      | ✅       | Standard result pattern across application  |
| `ApiResponse.php`       | All API controllers                     | ✅       | Standard response formatting                |
| `Agency.php` (Model)    | All agency operations                   | ✅       | Core model with blocks() relationship       |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

No request body validation - endpoint has no input fields.

### Business Logic Errors (422)

| Error                          | Source            | Condition                                         |
| ------------------------------ | ----------------- | ------------------------------------------------- |
| `"This block already exists."` | `BlockUserAction` | User already has a USER-type block on this agency |

### System Errors (500)

| Error                       | Source            | Condition                   |
| --------------------------- | ----------------- | --------------------------- |
| `"Failed to create block."` | `BlockUserAction` | Database transaction failed |

### Not Found Errors (404)

| Error                | Source              | Condition                                  |
| -------------------- | ------------------- | ------------------------------------------ |
| `"Agency not found"` | Route Model Binding | Agency ID doesn't exist or is soft-deleted |

### Authentication Errors (401)

| Error                       | Source         | Condition                       |
| --------------------------- | -------------- | ------------------------------- |
| `"Authentication required"` | Controller     | User is null (shouldn't occur)  |
| `"Unauthenticated."`        | `auth:sanctum` | Missing or invalid Bearer token |

### Edge Cases

| Case                                       | Behavior                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| User blocks agency they're a member of     | Allowed - block doesn't affect membership               |
| User blocks same agency twice              | Returns 422 "Block already exists"                      |
| User blocks, unblocks, then blocks again   | Allowed - previous block was deleted                    |
| Agency has USER and AGENCY blocks on user  | Both can exist (different blocker_type values)          |
| User is agency owner and blocks own agency | Allowed - no ownership check in block logic             |
| Blocked agency is later dissolved          | Block record remains (no cascade on agency dissolution) |
| High concurrency blocking                  | DB transaction + unique constraint ensures atomicity    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT             MIDDLEWARE           CONTROLLER           ACTION              MODEL                  DATABASE
   │                    │                    │                   │                    │                     │
   │  POST /agencies/1/block                 │                   │                    │                     │
   │────────────────────▶│                   │                   │                    │                     │
   │                    │                   │                   │                    │                     │
   │                    │ 1. auth:sanctum   │                   │                    │                     │
   │                    │──────────────────────────────────────────────────────────────────────────────────▶│
   │                    │                   │                   │                    │ Validate token       │
   │                    │◀──────────────────────────────────────────────────────────────────────────────────│
   │                    │                   │                   │                    │                     │
   │                    │ 2. Route Model Bind                   │                    │                     │
   │                    │──────────────────────────────────────────────────────────────────────────────────▶│
   │                    │                   │                   │                    │ SELECT agency        │
   │                    │◀──────────────────────────────────────────────────────────────────────────────────│
   │                    │                   │                   │                    │                     │
   │                    │ 3. block(Request, Agency, Action)     │                    │                     │
   │                    │──────────────────▶│                   │                    │                     │
   │                    │                   │                   │                    │                     │
   │                    │                   │ 4. $request->user()                    │                     │
   │                    │                   │   Get authenticated user              │                     │
   │                    │                   │                   │                    │                     │
   │                    │                   │ 5. execute(agency, user, actor, USER)  │                     │
   │                    │                   │──────────────────▶│                    │                     │
   │                    │                   │                   │                    │                     │
   │                    │                   │                   │ 6. Check existing block                  │
   │                    │                   │                   │────────────────────────────────────────▶│
   │                    │                   │                   │                    │ SELECT blocks        │
   │                    │                   │                   │◀────────────────────────────────────────│
   │                    │                   │                   │                    │                     │
   │                    │                   │                   │ 7. DB::transaction()                    │
   │                    │                   │                   │────────────────────────────────────────▶│
   │                    │                   │                   │                    │ BEGIN TRANSACTION    │
   │                    │                   │                   │                    │                     │
   │                    │                   │                   │ 8. Create block record                   │
   │                    │                   │                   │────────────────────────────────────────▶│
   │                    │                   │                   │                    │ INSERT INTO blocks   │
   │                    │                   │                   │◀────────────────────────────────────────│
   │                    │                   │                   │                    │                     │
   │                    │                   │                   │ 9. load(['agency', 'user', 'blocker'])   │
   │                    │                   │                   │────────────────────────────────────────▶│
   │                    │                   │                   │                    │ SELECT * 3 queries  │
   │                    │                   │                   │◀────────────────────────────────────────│
   │                    │                   │                   │                    │                     │
   │                    │                   │                   │ 10. COMMIT                               │
   │                    │                   │                   │────────────────────────────────────────▶│
   │                    │                   │                   │◀────────────────────────────────────────│
   │                    │                   │                   │                    │                     │
   │                    │                   │ 11. ActionResult::success              │                     │
   │                    │                   │◀──────────────────│                    │                     │
   │                    │                   │                   │                    │                     │
   │                    │                   │ 12. ApiResponse::success(null, message)                      │
   │                    │◀──────────────────│                   │                    │                     │
   │◀────────────────────│                   │                   │                    │                     │
   │                    │                   │                   │                    │                     │
   │  200 OK + JSON     │                   │                   │                    │                     │
   │                    │                   │                   │                    │                     │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                                |
| ------------------------- | ------------------------------------------------------- |
| Block reason/note field   | `BlockUserAction` + migration + `AgencyUserBlock` model |
| Block expiration          | Migration + model logic + scheduled job                 |
| Notification when blocked | Add event dispatch in `BlockUserAction` after create    |
| Block analytics           | Create new service/action, query `agency_user_blocks`   |
| Bulk block functionality  | New controller method + new action class                |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO BLOCK (e.g., `reason`)

| Step  | File                                                      | What to Change                        |
| ----- | --------------------------------------------------------- | ------------------------------------- |
| **1** | **Database Migration**                                    | Add column to `agency_user_blocks`    |
| **2** | `app/Models/Agency/AgencyUserBlock.php`                   | Add to `$fillable`                    |
| **3** | `app/Actions/Agency/BlockUserAction.php`                  | Accept new param, add to create array |
| **4** | `app/Http/Controllers/Api/V1/Agency/AgencyController.php` | Pass field from request to action     |
| **5** | Create new Request class                                  | Add validation for new field          |

#### ➖ REMOVING A FIELD FROM BLOCK

| Step  | File                                     | What to Change           |
| ----- | ---------------------------------------- | ------------------------ |
| **1** | `app/Actions/Agency/BlockUserAction.php` | Remove from create array |
| **2** | `app/Models/Agency/AgencyUserBlock.php`  | Remove from `$fillable`  |
| **3** | **Database Migration**                   | Drop column (if safe)    |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  URL Parameter  │────▶│   Controller    │────▶│     Action      │
│    {agency}     │     │   block()       │     │ BlockUserAction │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               │                        ▼
                               │               ┌─────────────────┐
                               │               │ AgencyUserBlock │
                               │               │    ::create()   │
                               │               └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   ApiResponse   │     │    Database     │
                        │    success()    │     │ agency_user_    │
                        └─────────────────┘     │    blocks       │
                                                └─────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                                                 | Reason                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `blocker_type` enum values                                | Changing breaks existing blocks interpretation                 |
| Unique constraint on `(agency_id, user_id, blocker_type)` | Allows user to have both block types simultaneously            |
| `BlockUserAction` parameter order                         | Same action used by multiple endpoints with different contexts |
| Database transaction in action                            | Ensures atomicity of block creation                            |
| `blocked_by` field                                        | Audit trail for who created the block                          |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                                      |
| ------------------------------------------ | --------------------------------------------------------------- |
| Confusing `user` and `actor` parameters    | In user-block-agency: both are the same user                    |
| Forgetting blocker_type in duplicate check | Unique per type - user can have both USER and AGENCY blocks     |
| Assuming block prevents membership         | Block only prevents invitations, not existing membership        |
| Not handling eager load queries            | Action loads relations that controller ignores - minor overhead |
| Expecting block data in response           | Controller returns null for data, only message                  |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                              ← Route definition (line 46)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php                           ← Controller::block() (lines 217-240)
app/Actions/Agency/
  └── BlockUserAction.php                            ← Business logic (lines 17-73)
app/Models/Agency/
  └── AgencyUserBlock.php                            ← Eloquent model
  └── Agency.php                                     ← Parent model with blocks() relation
app/Enums/Agency/
  └── AgencyBlockerType.php                          ← USER/AGENCY enum
app/Http/Utils/
  └── ApiResponse.php                                ← Response helper
database/migrations/
  └── 2025_12_27_000005_create_agency_user_blocks_table.php ← Table schema
```

---

## Document Metadata

| Property            | Value                                  |
| ------------------- | -------------------------------------- |
| **Endpoint**        | `POST /api/v1/agencies/{agency}/block` |
| **Domain**          | Agency                                 |
| **Author**          | System Documentation                   |
| **Created**         | 2026-02-03                             |
| **Laravel Version** | 12.x                                   |
| **PHP Version**     | 8.4                                    |
