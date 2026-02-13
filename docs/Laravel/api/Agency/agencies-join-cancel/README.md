# DELETE /api/v1/agencies/{agency}/join

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Cancel a pending join request to a specific agency. Allows users to withdraw their previously submitted join request before it is processed by the agency owner or admin.

### Responsibilities

- Authenticate the requesting user
- Find the user's pending join request for the specified agency
- Update the join request status to 'cancelled'
- Return success confirmation

### What It Owns

| Owned                     | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| Join request cancellation | Updates `agency_join_requests.status` to 'cancelled' |
| Pending request lookup    | Finds existing pending request for user-agency pair  |

### External Dependencies

| Dependency | Type           | Purpose                              |
| ---------- | -------------- | ------------------------------------ |
| Database   | Infrastructure | Query and update join request record |
| Sanctum    | Auth Package   | Bearer token authentication          |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/agencies/{agency}/join
```

### Authentication

✅ **Required** - Valid Sanctum Bearer token

### Rate Limiting

| Limiter | Key | Config                            |
| ------- | --- | --------------------------------- |
| None    | N/A | No specific rate limiting applied |

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
// No request body required
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Join request cancelled.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T03:35:17.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No pending join request found.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T03:35:17.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Agency Not Found (404)

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
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T03:35:17.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                          |
| ----- | -------------------------------------------------- |
| `200` | Join request cancelled successfully                |
| `401` | No valid authentication token                      |
| `404` | Agency not found (route model binding fail)        |
| `404` | No pending join request found for this user-agency |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│            DELETE /api/v1/agencies/{agency}/join                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:43                                            │
│ Route: Route::delete('/{agency}/join',                                      │
│            [AgencyController::class, 'cancelJoin'])                         │
│            ->name('agencies.join.cancel')                                   │
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
│ No Form Request - Uses standard Illuminate\Http\Request                     │
│                                                                             │
│ This endpoint requires no request body, so no validation is needed.         │
│ The only required data (agency ID) comes from the URL.                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:193-215       │
│ Method: cancelJoin(Request $request, Agency $agency): JsonResponse          │
│                                                                             │
│ STEP 1: Get Authenticated User                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find Pending Join Request                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest = AgencyJoinRequest::where('agency_id', $agency->id)       │ │
│ │     ->where('user_id', $user->id)                                       │ │
│ │     ->pending()    // scope: status = 'pending'                         │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ Query uses: agency_join_requests_pending_check_idx index                │ │
│ │ Returns: AgencyJoinRequest|null                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate Request Exists                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($joinRequest === null) {                                            │ │
│ │     return ApiResponse::error(                                          │ │
│ │         'No pending join request found.',                               │ │
│ │         [],                                                             │ │
│ │         404                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Early return if no pending request exists                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Cancel the Join Request                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest->update([                                                  │ │
│ │     'status' => 'cancelled',                                            │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ Updates: agency_join_requests.status = 'cancelled'                      │ │
│ │ Timestamp: updated_at auto-updated by Eloquent                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return Success Response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Join request cancelled.');           │ │
│ │                                                                         │ │
│ │ Returns null data with success message                                  │ │
│ │ HTTP Status: 200 OK                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No Service/Action Layer Used                                                │
│                                                                             │
│ This endpoint handles all logic directly in the controller because:         │
│   • The operation is simple (find + update)                                 │
│   • No complex business rules or validation                                 │
│   • No cross-domain dependencies                                            │
│   • No side effects (notifications, events, etc.)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyJoinRequest (Model)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyJoinRequest.php                           │ │
│ │ Responsibility: Eloquent model for join request records                 │ │
│ │ Reusable: YES (used by all join request operations)                     │ │
│ │ Why It Exists: Represents agency_join_requests table                    │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • agency() → BelongsTo Agency                                         │ │
│ │   • user() → BelongsTo User (requester)                                 │ │
│ │   • processor() → BelongsTo User (who approved/rejected)                │ │
│ │                                                                         │ │
│ │ Key Scopes Used:                                                        │ │
│ │   • pending() → WHERE status = 'pending'                                │ │
│ │                                                                         │ │
│ │ Key Attributes:                                                         │ │
│ │   • $fillable: agency_id, user_id, message, status, processed_by,       │ │
│ │               processed_at                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestStatus (Enum)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyJoinRequestStatus.php                      │ │
│ │ Responsibility: Define join request lifecycle states                    │ │
│ │ Reusable: YES (used across agency domain)                               │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • PENDING = 'pending'     → Initial state                             │ │
│ │   • APPROVED = 'approved'   → Agency accepted request                   │ │
│ │   • REJECTED = 'rejected'   → Agency declined request                   │ │
│ │   • CANCELLED = 'cancelled' → User withdrew request ← THIS ENDPOINT    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isFinal() → true for APPROVED, REJECTED, CANCELLED                  │ │
│ │   • canBeProcessed() → true only for PENDING                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Helper)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response construction                 │ │
│ │ Reusable: YES (used across all API controllers)                         │ │
│ │                                                                         │ │
│ │ Key Methods Used:                                                       │ │
│ │   • success(data, message) → 200 OK response                           │ │
│ │   • error(message, errors, statusCode) → Error response                │ │
│ │   • unauthorized(message) → 401 response                               │ │
│ │                                                                         │ │
│ │ Response Structure:                                                     │ │
│ │   { status, message, data, meta: { timestamp, correlation_id } }       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Agency (Model)                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/Agency.php                                      │ │
│ │ Responsibility: Eloquent model for agency records                       │ │
│ │ Reusable: YES (used across agency domain)                               │ │
│ │                                                                         │ │
│ │ Route Model Binding:                                                    │ │
│ │   • Implicitly resolved from {agency} URL parameter                     │ │
│ │   • SoftDeletes trait: excludes deleted agencies                        │ │
│ │   • Only used to verify agency exists and get ID                        │ │
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
│    Returns: Agency model or 404                                             │
│                                                                             │
│ 2. [SELECT]: Find pending join request                                      │
│    Query: SELECT * FROM agency_join_requests                                │
│           WHERE agency_id = ?                                               │
│             AND user_id = ?                                                 │
│             AND status = 'pending'                                          │
│           LIMIT 1                                                           │
│    Source: AgencyJoinRequest::where(...)->pending()->first()                │
│    Index: agency_join_requests_pending_check_idx                            │
│           (agency_id, user_id, status)                                      │
│    Returns: AgencyJoinRequest|null                                          │
│                                                                             │
│ 3. [UPDATE]: Cancel join request (if found)                                 │
│    Query: UPDATE agency_join_requests                                       │
│           SET status = 'cancelled', updated_at = NOW()                      │
│           WHERE id = ?                                                      │
│    Source: $joinRequest->update(['status' => 'cancelled'])                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Join requests are dynamic data, not cached                         │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - Cancellation doesn't emit real-time notifications                  │
│                                                                             │
│ TRANSACTION:                                                                │
│   None - Single update operation, no transaction wrapper needed             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ SUCCESS RESPONSE:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(null, 'Join request cancelled.')                   │ │
│ │                                                                         │ │
│ │ Generates:                                                              │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Join request cancelled.",                                 │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "ISO8601 datetime",                                    │ │
│ │     "correlation_id": "uuid"                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ HTTP Status: 200 OK                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ERROR RESPONSE (No Pending Request):                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::error('No pending join request found.', [], 404)           │ │
│ │                                                                         │ │
│ │ Generates:                                                              │ │
│ │ {                                                                       │ │
│ │   "status": "error",                                                    │ │
│ │   "message": "No pending join request found.",                          │ │
│ │   "data": null,                                                         │ │
│ │   "errors": [],                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "ISO8601 datetime",                                    │ │
│ │     "correlation_id": "uuid"                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ HTTP Status: 404 Not Found                                              │ │
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

| File                                 | Used By Endpoints           | Reusable | Reasoning                             |
| ------------------------------------ | --------------------------- | -------- | ------------------------------------- |
| `AgencyController.php`               | All agency endpoints        | ⭕       | Contains multiple agency methods      |
| `AgencyJoinRequest.php` (Model)      | All join request operations | ✅       | Core model used throughout            |
| `AgencyJoinRequestStatus.php` (Enum) | All join request operations | ✅       | Status enum used across agency domain |
| `Agency.php` (Model)                 | All agency endpoints        | ✅       | Core agency model                     |
| `ApiResponse.php`                    | All API controllers         | ✅       | Standard response formatting          |

---

## 5. Error Handling & Edge Cases

### Not Found Errors (404)

| Error                              | Source              | Condition                                  |
| ---------------------------------- | ------------------- | ------------------------------------------ |
| `"Agency not found"`               | Route Model Binding | Agency ID doesn't exist or is soft-deleted |
| `"No pending join request found."` | Controller          | No pending request exists for user-agency  |

### Authentication Errors (401)

| Error                       | Source         | Condition                       |
| --------------------------- | -------------- | ------------------------------- |
| `"Authentication required"` | Controller     | User resolved to null           |
| `"Unauthenticated."`        | `auth:sanctum` | Missing or invalid Bearer token |

### Edge Cases

| Case                                        | Behavior                                         |
| ------------------------------------------- | ------------------------------------------------ |
| User cancels already cancelled request      | 404 - pending scope excludes cancelled           |
| User cancels already approved request       | 404 - pending scope excludes approved            |
| User cancels already rejected request       | 404 - pending scope excludes rejected            |
| User cancels request for non-joined agency  | 404 - no pending request found                   |
| Agency owner cancels their own join request | 404 - owner cannot create join requests anyway   |
| Concurrent cancel requests (race condition) | Second request returns 404 (first one cancelled) |
| User with multiple pending requests         | NOT POSSIBLE - business logic prevents this      |
| Agency is dissolved after request created   | 404 - route model binding uses soft deletes      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT             MIDDLEWARE           CONTROLLER                MODEL                  DATABASE
   │                    │                    │                       │                       │
   │  DELETE /agencies/1/join                │                       │                       │
   │────────────────────▶│                   │                       │                       │
   │                    │                   │                       │                       │
   │                    │ 1. auth:sanctum   │                       │                       │
   │                    │──────────────────────────────────────────────────────────────────▶│
   │                    │                   │                       │ Validate token        │
   │                    │◀──────────────────────────────────────────────────────────────────│
   │                    │                   │                       │                       │
   │                    │ 2. Route Model Bind                       │                       │
   │                    │──────────────────────────────────────────────────────────────────▶│
   │                    │                   │                       │ SELECT agency         │
   │                    │◀──────────────────────────────────────────────────────────────────│
   │                    │                   │                       │                       │
   │                    │ 3. cancelJoin(Request, Agency)            │                       │
   │                    │──────────────────▶│                       │                       │
   │                    │                   │                       │                       │
   │                    │                   │ 4. Get user from request                      │
   │                    │                   │ $user = $request->user()                      │
   │                    │                   │                       │                       │
   │                    │                   │ 5. Find pending request                       │
   │                    │                   │──────────────────────▶│                       │
   │                    │                   │                       │──────────────────────▶│
   │                    │                   │                       │ SELECT WHERE          │
   │                    │                   │                       │   agency_id = ?       │
   │                    │                   │                       │   user_id = ?         │
   │                    │                   │                       │   status = 'pending'  │
   │                    │                   │◀──────────────────────│◀──────────────────────│
   │                    │                   │                       │                       │
   │                    │                   │ 6. Update status to cancelled                 │
   │                    │                   │──────────────────────▶│                       │
   │                    │                   │                       │──────────────────────▶│
   │                    │                   │                       │ UPDATE SET            │
   │                    │                   │                       │   status='cancelled'  │
   │                    │                   │◀──────────────────────│◀──────────────────────│
   │                    │                   │                       │                       │
   │                    │                   │ 7. Build success response                     │
   │                    │                   │ ApiResponse::success(null, message)           │
   │                    │                   │                       │                       │
   │                    │◀──────────────────│                       │                       │
   │◀────────────────────│                   │                       │                       │
   │                    │                   │                       │                       │
   │  200 OK + JSON     │                   │                       │                       │
   │                    │                   │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                   |
| ----------------------------- | ------------------------------------------ |
| Notify agency owner on cancel | Add MSAB event in controller after update  |
| Add cancellation reason       | Add field to request, update in controller |
| Soft-cancel (allow undo)      | Create new status or use soft deletes      |
| Rate limit cancellations      | Add middleware to route definition         |
| Webhook on cancellation       | Add dispatch in controller after update    |

### 📝 Field Modification Guide

#### ➕ ADDING CANCELLATION REASON

| Step  | File                                      | What to Change                                             |
| ----- | ----------------------------------------- | ---------------------------------------------------------- |
| **1** | **Database Migration**                    | Add `cancellation_reason` column to `agency_join_requests` |
| **2** | `app/Models/Agency/AgencyJoinRequest.php` | Add to `$fillable` array                                   |
| **3** | Create `CancelJoinRequest.php`            | New form request with validation                           |
| **4** | `AgencyController.php`                    | Type-hint new request, add to update                       |

#### ➕ ADDING CANCELLATION NOTIFICATION

| Step  | File                                     | What to Change                               |
| ----- | ---------------------------------------- | -------------------------------------------- |
| **1** | `app/Services/Realtime/MSABEventService.php` | Add `emitJoinRequestCancelled()` method      |
| **2** | `AgencyController.php`                   | Inject `MSABEventService`, call after update |

### 🔗 Field Flow Dependency Chain

```
DELETE /agencies/{agency}/join
         │
         ▼
    ┌─────────────────┐
    │ Route/Middleware │
    │   auth:sanctum   │
    └────────┬────────┘
             │ Agency from URL
             ▼
    ┌─────────────────┐
    │   Controller    │
    │  cancelJoin()   │
    └────────┬────────┘
             │ user_id from auth
             │ agency_id from route
             ▼
    ┌─────────────────┐
    │ AgencyJoinRequest │
    │   ->pending()     │
    │   ->first()       │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    ->update()    │
    │ status:'cancelled' │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  ApiResponse    │
    │   ::success()   │
    └─────────────────┘
```

### 📋 Field Modification Checklist

When adding new fields to cancellation:

- [ ] Database migration for new column
- [ ] Add to `AgencyJoinRequest.$fillable`
- [ ] Create/update Form Request if validation needed
- [ ] Update controller to pass new field to update
- [ ] Update any resources if field should be returned
- [ ] Update tests

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                       |
| ------------------------------ | -------------------------------------------- |
| `pending()` scope logic        | Core filter for finding cancellable requests |
| Status value 'cancelled'       | Referenced in enum, frontend, and queries    |
| Route model binding for agency | Standard Laravel pattern, used everywhere    |
| `ApiResponse` structure        | Contract with frontend, breaking change      |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                      |
| ----------------------------------------- | ----------------------------------------------- |
| Forgetting `pending()` scope              | Always use scope to find only cancellable items |
| Using `delete()` instead of status update | Never hard-delete, always update status         |
| Not checking for null before update       | Always validate request exists before updating  |
| Returning user data in cancel response    | Keep response minimal - return null data        |
| Adding transaction without need           | Single UPDATE doesn't need transaction          |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                      ← Route definition (line 43)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php                   ← Controller (cancelJoin method, lines 193-215)
app/Models/Agency/
  └── AgencyJoinRequest.php                  ← Model with pending() scope
  └── Agency.php                             ← Route model binding target
app/Enums/Agency/
  └── AgencyJoinRequestStatus.php            ← Status enum (CANCELLED case)
app/Http/Utils/
  └── ApiResponse.php                        ← Response utility
```

---

## Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/agencies/{agency}/join` |
| **Domain**          | Agency                                  |
| **Author**          | System Documentation                    |
| **Created**         | 2026-02-03                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
