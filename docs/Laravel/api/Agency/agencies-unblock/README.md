# DELETE /api/v1/agencies/{agency}/block

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Remove a user-initiated block on an agency, allowing the agency to send invitations to the authenticated user again. This is the reverse operation of blocking an agency.

### Responsibilities

- Authenticate the requesting user via Sanctum Bearer token
- Find and delete the user's block record with `blocker_type = 'user'`
- Return success confirmation or 404 if no block exists
- Allow agency to resume sending invitations to the user

### What It Owns

| Owned              | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| Block deletion     | Deletes `agency_user_blocks` record for user-initiated block |
| Block verification | Confirms block exists before deletion                        |
| User block context | Only affects blocks where `blocker_type = 'user'`            |

### External Dependencies

| Dependency | Type           | Purpose                     |
| ---------- | -------------- | --------------------------- |
| Database   | Infrastructure | Delete block record         |
| Sanctum    | Auth Package   | Bearer token authentication |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/agencies/{agency}/block
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
  "message": "Agency unblocked.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T16:22:44.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found - No Block Exists (404)

```json
{
  "status": "error",
  "message": "No block found.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T16:22:44.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found - Agency Not Found (404)

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
    "timestamp": "2026-02-03T16:22:44.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `200` | Block deleted successfully                 |
| `401` | No valid authentication token              |
| `404` | Agency ID does not exist OR no block found |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│            DELETE /api/v1/agencies/{agency}/block                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:48-49                                         │
│ Route: Route::delete('/{agency}/block',                                     │
│          [AgencyController::class, 'unblock'])->name('agencies.unblock')    │
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
│                                                                             │
│ No action class injection - logic is inline in controller                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:242-263       │
│ Method: unblock(Request $request, Agency $agency): JsonResponse             │
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
│ STEP 2: Delete Block via Agency Relationship                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $deleted = $agency->blocks()                                            │ │
│ │     ->where('user_id', $user->id)                                       │ │
│ │     ->where('blocker_type', AgencyBlockerType::USER)                    │ │
│ │     ->delete();                                                         │ │
│ │                                                                         │ │
│ │ Uses Agency's blocks() relationship to scope query                      │ │
│ │ Filters by user_id AND blocker_type = 'user'                            │ │
│ │ Returns number of deleted rows (0 or 1)                                 │ │
│ │                                                                         │ │
│ │ Key: Only deletes USER-initiated blocks                                 │ │
│ │ Agency-initiated blocks (blocker_type = 'agency') are NOT affected     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle Delete Result                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($deleted === 0) {                                                   │ │
│ │     return ApiResponse::error('No block found.', [], 404);              │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(null, 'Agency unblocked.');                 │ │
│ │                                                                         │ │
│ │ Returns 404 if no block existed for this user-agency-type combination   │ │
│ │ Returns 200 with null data on successful deletion                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ NO DEDICATED SERVICE/ACTION CLASS                                           │
│                                                                             │
│ This endpoint uses inline controller logic because:                         │
│   • Simple delete operation with no complex business rules                  │
│   • No validation beyond authentication and agency existence                │
│   • No side effects (events, notifications, cache invalidation)             │
│   • Single query delete pattern                                             │
│                                                                             │
│ The operation is performed directly via Eloquent relationship:              │
│   $agency->blocks()->where(...)->delete()                                   │
│                                                                             │
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
│ │ Reusable: YES (used by block/unblock for both directions)               │ │
│ │ Why It Exists: Bi-directional blocking - user→agency or agency→user    │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • AGENCY = 'agency' → Agency blocked user (user can't join)           │ │
│ │   • USER = 'user'     → User blocked agency (agency can't invite)       │ │
│ │                                                                         │ │
│ │ For this endpoint: Only USER type blocks are removed                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Agency (Model) - blocks() Relationship                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/Agency.php:161-169                              │ │
│ │ Responsibility: Define HasMany relationship to blocks                   │ │
│ │ Reusable: YES (used by all block operations)                            │ │
│ │ Why It Exists: Clean way to query blocks scoped to an agency            │ │
│ │                                                                         │ │
│ │ Relationship Definition:                                                │ │
│ │   public function blocks(): HasMany                                     │ │
│ │   {                                                                     │ │
│ │       return $this->hasMany(AgencyUserBlock::class);                    │ │
│ │   }                                                                     │ │
│ │                                                                         │ │
│ │ Returns all AgencyUserBlock records where agency_id = $this->id         │ │
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
│ │ Table: agency_user_blocks                                               │ │
│ │ Unique Constraint: (agency_id, user_id, blocker_type)                   │ │
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
│ 2. [DELETE]: Delete user's block record                                     │
│    Query: DELETE FROM agency_user_blocks                                    │
│           WHERE agency_id = ?                                               │
│             AND user_id = ?                                                 │
│             AND blocker_type = 'user'                                       │
│    Source: $agency->blocks()->where(...)->delete()                          │
│    Index: Unique composite (agency_id, user_id, blocker_type)               │
│    Returns: Number of rows deleted (0 or 1)                                 │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Block operations are direct database writes                        │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - No async jobs or events dispatched                                 │
│                                                                             │
│ TRANSACTION:                                                                │
│   None - Single atomic DELETE query (inherently transactional)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:10-30                                  │
│                                                                             │
│ SUCCESS RESPONSE (when block deleted):                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(                                                   │ │
│ │     null,                              // No data payload               │ │
│ │     'Agency unblocked.'                // Simple confirmation message  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ERROR RESPONSE (when no block found):                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::error(                                                     │ │
│ │     'No block found.',                 // Error message                 │ │
│ │     [],                                // Empty errors array            │ │
│ │     404                                // Status code                   │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL SUCCESS RESPONSE:                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Agency unblocked.",                                       │ │
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

| File                    | Used By Endpoints            | Reusable | Reasoning                              |
| ----------------------- | ---------------------------- | -------- | -------------------------------------- |
| `AgencyController.php`  | All agency endpoints         | ⭕       | Contains multiple agency methods       |
| `Agency.php` (Model)    | All agency operations        | ✅       | Core model with blocks() relationship  |
| `AgencyUserBlock.php`   | All block/unblock operations | ✅       | Core model for bi-directional blocking |
| `AgencyBlockerType.php` | All block operations         | ✅       | Enum defines block direction           |
| `ApiResponse.php`       | All API controllers          | ✅       | Standard response formatting           |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

No request body validation - endpoint has no input fields.

### Business Logic Errors (404)

| Error               | Source     | Condition                                           |
| ------------------- | ---------- | --------------------------------------------------- |
| `"No block found."` | Controller | No USER-type block exists for this user-agency pair |

### System Errors (500)

| Error                     | Source      | Condition                               |
| ------------------------- | ----------- | --------------------------------------- |
| Database connection error | Application | Database unavailable                    |
| Delete operation failed   | Eloquent    | Unexpected database error during DELETE |

### Not Found Errors (404)

| Error                | Source              | Condition                                  |
| -------------------- | ------------------- | ------------------------------------------ |
| `"Agency not found"` | Route Model Binding | Agency ID doesn't exist or is soft-deleted |
| `"No block found."`  | Controller          | User has not blocked this agency           |

### Authentication Errors (401)

| Error                       | Source         | Condition                       |
| --------------------------- | -------------- | ------------------------------- |
| `"Authentication required"` | Controller     | User is null (shouldn't occur)  |
| `"Unauthenticated."`        | `auth:sanctum` | Missing or invalid Bearer token |

### Edge Cases

| Case                                       | Behavior                                                 |
| ------------------------------------------ | -------------------------------------------------------- |
| User tries to unblock agency never blocked | Returns 404 "No block found."                            |
| User unblocks, then unblocks again         | Returns 404 "No block found." (already deleted)          |
| User has AGENCY-type block on them         | Not affected - only USER-type blocks are removed         |
| User has both USER and AGENCY blocks       | Only USER block is removed, AGENCY block remains         |
| Concurrent unblock requests                | First succeeds, second returns 404 (row already deleted) |
| Agency is dissolved after block            | Block can still be deleted (no cascade on dissolution)   |
| User unblocks agency they're a member of   | Allowed - block doesn't require non-membership           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT             MIDDLEWARE           CONTROLLER             MODEL                  DATABASE
   │                    │                    │                    │                      │
   │  DELETE /agencies/1/block               │                    │                      │
   │────────────────────▶│                   │                    │                      │
   │                    │                   │                    │                      │
   │                    │ 1. auth:sanctum   │                    │                      │
   │                    │──────────────────────────────────────────────────────────────▶│
   │                    │                   │                    │ Validate token       │
   │                    │◀──────────────────────────────────────────────────────────────│
   │                    │                   │                    │                      │
   │                    │ 2. Route Model Bind                    │                      │
   │                    │──────────────────────────────────────────────────────────────▶│
   │                    │                   │                    │ SELECT agency        │
   │                    │◀──────────────────────────────────────────────────────────────│
   │                    │                   │                    │                      │
   │                    │ 3. unblock(Request, Agency)            │                      │
   │                    │──────────────────▶│                    │                      │
   │                    │                   │                    │                      │
   │                    │                   │ 4. $request->user()                       │
   │                    │                   │   Get authenticated user                 │
   │                    │                   │                    │                      │
   │                    │                   │ 5. $agency->blocks()                      │
   │                    │                   │   ->where('user_id', $user->id)           │
   │                    │                   │   ->where('blocker_type', USER)           │
   │                    │                   │   ->delete()                              │
   │                    │                   │────────────────────▶│                     │
   │                    │                   │                    │ 6. DELETE FROM       │
   │                    │                   │                    │    agency_user_blocks│
   │                    │                   │                    │───────────────────────▶│
   │                    │                   │                    │   WHERE conditions    │
   │                    │                   │                    │◀───────────────────────│
   │                    │                   │                    │   Returns row count   │
   │                    │                   │◀───────────────────│                      │
   │                    │                   │                    │                      │
   │                    │                   │ 7. Check $deleted count                    │
   │                    │                   │   if (0) → 404 "No block found."          │
   │                    │                   │   else   → 200 "Agency unblocked."        │
   │                    │                   │                    │                      │
   │                    │                   │ 8. ApiResponse::success/error             │
   │                    │◀──────────────────│                    │                      │
   │◀────────────────────│                   │                    │                      │
   │                    │                   │                    │                      │
   │  200 OK + JSON     │                   │                    │                      │
   │  (or 404)          │                   │                    │                      │
   │                    │                   │                    │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                                 |
| --------------------------- | -------------------------------------------------------- |
| Audit log of unblock action | Add event dispatch after delete in controller            |
| Notification to agency      | Add event listener that notifies agency owner            |
| Soft-delete instead of hard | Change `->delete()` to `->update(['deleted_at'=>now()])` |
| Rate limit unblocking       | Add throttle middleware to route                         |

### 📝 Field Modification Guide

The unblock endpoint does not create records, only deletes. No field modifications affect this endpoint unless changing the search criteria.

#### ➕ ADDING A FILTER CONDITION TO UNBLOCK

| Step  | File                                                      | What to Change                     |
| ----- | --------------------------------------------------------- | ---------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Agency/AgencyController.php` | Add additional `->where()` clause  |
| **2** | Test all edge cases with new condition                    | Ensure correct blocks are targeted |

#### 🔄 CHANGING TO SOFT-DELETE

| Step  | File                                                      | What to Change                           |
| ----- | --------------------------------------------------------- | ---------------------------------------- |
| **1** | Add `deleted_at` column via migration                     | `$table->softDeletes()`                  |
| **2** | `app/Models/Agency/AgencyUserBlock.php`                   | Add `use SoftDeletes` trait              |
| **3** | `app/Http/Controllers/Api/V1/Agency/AgencyController.php` | Keep logic same (SoftDeletes handles it) |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  URL Parameter  │────▶│   Controller    │────▶│  Agency Model   │
│    {agency}     │     │   unblock()     │     │   ->blocks()    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               │                        ▼
                               │               ┌─────────────────┐
                               │               │ Eloquent Query  │
                               │               │   ->where(...)  │
                               │               │   ->delete()    │
                               │               └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   ApiResponse   │     │    Database     │
                        │ success/error() │     │ agency_user_    │
                        └─────────────────┘     │    blocks       │
                                                └─────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                                 | Reason                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| `blocker_type` filter in delete query     | Must only delete USER-type blocks, not AGENCY-type         |
| `user_id` filter using authenticated user | Must only delete current user's blocks, not others         |
| Return value check (`=== 0`)              | Determines if block existed before delete attempt          |
| Order of where clauses                    | All conditions must be applied for correct block targeting |
| 404 status code for "No block found"      | Follows REST convention for "resource not found"           |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                                      |
| ---------------------------------------- | --------------------------------------------------------------- |
| Forgetting `blocker_type` filter         | Always filter by USER to avoid deleting AGENCY-initiated blocks |
| Using `->first()->delete()` instead      | Use direct `->delete()` for efficiency and correct row count    |
| Assuming 404 means agency not found      | Could be agency exists but no block - check error message       |
| Thinking both block types are removed    | Only USER-type blocks are affected                              |
| Not handling race conditions             | Second request returns 404 gracefully                           |
| Expecting deleted block data in response | Response returns null for data, only message                    |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                              ← Route definition (line 49)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php                           ← Controller::unblock() (lines 242-263)
app/Models/Agency/
  └── AgencyUserBlock.php                            ← Eloquent model (target of delete)
  └── Agency.php                                     ← Parent model with blocks() relation
app/Enums/Agency/
  └── AgencyBlockerType.php                          ← USER/AGENCY enum
app/Http/Utils/
  └── ApiResponse.php                                ← Response helper
database/migrations/
  └── 2025_12_27_000005_create_agency_user_blocks_table.php ← Table schema
```

---

## Comparison with POST Block Endpoint

| Aspect             | POST /agencies/{agency}/block              | DELETE /agencies/{agency}/block    |
| ------------------ | ------------------------------------------ | ---------------------------------- |
| Purpose            | Create block                               | Remove block                       |
| Action Class       | Uses `BlockUserAction`                     | Inline controller logic            |
| Transaction        | Yes (DB::transaction)                      | No (single atomic DELETE)          |
| Duplicate Handling | Returns 422 if block exists                | Returns 404 if block doesn't exist |
| Eager Loading      | Loads relations after create               | No loading needed                  |
| Response Data      | Returns null (ignores created block)       | Returns null                       |
| Success Message    | "Agency blocked from sending invitations." | "Agency unblocked."                |
| Error Message      | "This block already exists."               | "No block found."                  |

---

## Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/agencies/{agency}/block` |
| **Domain**          | Agency                                   |
| **Author**          | System Documentation                     |
| **Created**         | 2026-02-03                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4                                      |
