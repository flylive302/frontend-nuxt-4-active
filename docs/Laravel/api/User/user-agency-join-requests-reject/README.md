# POST /api/v1/user/agency/join-requests/{joinRequest}/reject

> **Domain**: Agency Join Requests  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Rejects a pending join request from a user who wants to join an agency. Only agency owners, admins, or officials can reject requests.

### Responsibilities

- Authorize the reject action using policy
- Update join request status to `rejected`
- Record who processed the request and when
- Emit MSAB event to notify the requester

### What It Owns

| Owned                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| Join Request Status     | Updates `agency_join_requests.status` to rejected |
| Processing Metadata     | Records `processed_by` and `processed_at`         |
| Rejection Notifications | Emits real-time event to notify requester         |

### External Dependencies

| Dependency       | Type           | Purpose                                |
| ---------------- | -------------- | -------------------------------------- |
| Database         | Infrastructure | Updates `agency_join_requests` table   |
| MSAB EventBridge | Infrastructure | Emits real-time rejection notification |
| Sanctum          | Package        | Token-based authentication             |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/agency/join-requests/{joinRequest}/reject
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key       | Config                   |
| ------- | --------- | ------------------------ |
| Default | `user:id` | `config/auth.php` limits |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter     | Type      | Description                      |
| ------------- | --------- | -------------------------------- |
| `joinRequest` | `integer` | ID of the join request to reject |

### Request Body Schema

```json
{
  // No request body required
}
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Join request rejected.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T17:54:28.000000Z",
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
    "timestamp": "2026-02-03T17:54:28.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "message": "This action is unauthorized."
}
```

#### ❌ Not Found Error (404)

```json
{
  "message": "No query results for model [App\\Models\\Agency\\AgencyJoinRequest] {id}"
}
```

### HTTP Status Codes

| Code  | Condition                                                |
| ----- | -------------------------------------------------------- |
| `200` | Join request successfully rejected                       |
| `401` | User not authenticated                                   |
| `403` | User not authorized to reject (not owner/admin/official) |
| `404` | Join request not found                                   |
| `500` | Internal server error                                    |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│          POST /api/v1/user/agency/join-requests/{joinRequest}/reject        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:106-107                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{joinRequest}/reject',                                    │ │
│ │     [AgencyJoinRequestController::class, 'reject'])                     │ │
│ │     ->name('user.agency.join-requests.reject');                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Sanctum token                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Agency/AgencyJoinRequest.php                               │
│                                                                             │
│ Laravel automatically resolves {joinRequest} to AgencyJoinRequest model.    │
│ If not found, returns 404 before controller is invoked.                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ class AgencyJoinRequest extends Model                                   │ │
│ │ {                                                                       │ │
│ │     protected $fillable = [                                             │ │
│ │         'agency_id', 'user_id', 'message',                              │ │
│ │         'status', 'processed_by', 'processed_at',                       │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyJoinRequestController.php    │
│ Method: reject(Request $request, AgencyJoinRequest $joinRequest)            │
│                                                                             │
│ STEP 1: Authorization Check                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('reject', $joinRequest);                               │ │
│ │ // Calls AgencyJoinRequestPolicy@reject                                 │ │
│ │ // Throws AuthorizationException if not authorized                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get Authenticated User                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Update Join Request Status                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest->update([                                                  │ │
│ │     'status' => AgencyJoinRequestStatus::REJECTED,                      │ │
│ │     'processed_by' => $user->id,                                        │ │
│ │     'processed_at' => now(),                                            │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Emit MSAB Event                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest->load('agency');                                           │ │
│ │ $this->msabEventService->emitAgencyJoinRequestRejected(                 │ │
│ │     $joinRequest->user_id,                                              │ │
│ │     $joinRequest->agency_id,                                            │ │
│ │     $joinRequest->agency->name                                          │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return Success Response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Join request rejected.');            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyJoinRequestPolicy.php                       │
│ Method: reject(User $user, AgencyJoinRequest $request)                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function reject(User $user, AgencyJoinRequest $request): bool    │ │
│ │ {                                                                       │ │
│ │     // Same logic as approve                                            │ │
│ │     return $this->approve($user, $request);                             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Approval Logic Chain:                                                       │
│   1. Check canBeProcessed() → request must be PENDING                       │
│   2. Check isOfficial($user) → Super Admin or Admin role                    │
│   3. Check isOwnedBy($user) → user owns the agency                          │
│   4. Check member.canManageMembers() → user is admin of agency              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emit real-time events via MSAB EventBridge              │ │
│ │ Reusable: YES (used by multiple agency endpoints)                       │ │
│ │ Why It Exists: Real-time notification to client applications            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitAgencyJoinRequestRejected() → notifies requester of rejection   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestStatus (Enum)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyJoinRequestStatus.php                      │ │
│ │ Responsibility: Status lifecycle for join requests                      │ │
│ │ Reusable: YES (used throughout agency join request flow)                │ │
│ │ Why It Exists: Type-safe status values with behavior methods            │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
│ │ Key Methods:                                                            │ │
│ │   • canBeProcessed() → only PENDING can be processed                    │ │
│ │   • isFinal() → check if terminal state                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent API response structure                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → success response with data                              │ │
│ │   • error() → error response with message                               │ │
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
│ 1. SELECT: Find AgencyJoinRequest by ID (Route Model Binding)               │
│    Query: SELECT * FROM agency_join_requests WHERE id = ?                   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT: Load Agency for Policy Check                                     │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: AgencyJoinRequestPolicy via $request->agency                     │
│                                                                             │
│ 3. SELECT: Check User Membership (if needed)                                │
│    Query: SELECT * FROM agency_members WHERE agency_id = ? AND user_id = ?  │
│    Source: AgencyJoinRequestPolicy via $agency->getMember($user)            │
│                                                                             │
│ 4. UPDATE: Reject Join Request                                              │
│    Query: UPDATE agency_join_requests SET status = 'rejected',              │
│           processed_by = ?, processed_at = ? WHERE id = ?                   │
│    Source: Controller@reject                                                │
│                                                                             │
│ 5. SELECT: Load Agency for MSAB Event                                       │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: $joinRequest->load('agency')                                     │
│                                                                             │
│ EXTERNAL CALLS:                                                             │
│                                                                             │
│ 1. MSAB EventBridge: 'agency.join_request_rejected'                         │
│    Payload: { agency_id, agency_name }                                      │
│    Recipient: user_id (requester)                                           │
│    Source: MSABEventService::emitAgencyJoinRequestRejected()                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(null, 'Join request rejected.');                   │ │
│ │                                                                         │ │
│ │ // Returns:                                                             │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Join request rejected.",                                  │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "ISO8601",                                             │ │
│ │     "correlation_id": "uuid"                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: Unlike approve, reject returns null data (no resource)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                          200 + JSON Body                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                              | Used By Endpoints                               | Reusable | Reasoning                                         |
| --------------------------------- | ----------------------------------------------- | -------- | ------------------------------------------------- |
| `AgencyJoinRequestController.php` | join-requests/\*, approve, reject, mine         | ⭕       | Controller specific to join requests              |
| `AgencyJoinRequestPolicy.php`     | join-requests/\* (all CRUD operations)          | ✅       | Shared authorization for all join request actions |
| `AgencyJoinRequest.php`           | All agency join request endpoints               | ✅       | Core model used by multiple endpoints             |
| `AgencyJoinRequestStatus.php`     | All join request operations                     | ✅       | Enum shared across all status changes             |
| `MSABEventService.php`            | Multiple agency/gift/room endpoints             | ✅       | Core event emission service                       |
| `ApiResponse.php`                 | All API endpoints                               | ✅       | Global response utility                           |
| `ManagesUserAgency.php`           | AgencyJoinRequest, AgencyInvitation controllers | ✅       | Shared trait for agency management checks         |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                         | Source                    | Condition                             |
| ----------------------------- | ------------------------- | ------------------------------------- |
| "This action is unauthorized" | `AgencyJoinRequestPolicy` | Request not PENDING status            |
| "This action is unauthorized" | `AgencyJoinRequestPolicy` | User is not owner/admin of the agency |
| "This action is unauthorized" | `AgencyJoinRequestPolicy` | User is not a Super Admin or Admin    |

### Authentication Errors (401)

| Error             | Source       | Condition             |
| ----------------- | ------------ | --------------------- |
| "Unauthenticated" | `Controller` | No valid bearer token |

### Not Found Errors (404)

| Error                           | Source              | Condition                     |
| ------------------------------- | ------------------- | ----------------------------- |
| "No query results for model..." | Route Model Binding | Join request ID doesn't exist |

### System Errors (500)

| Error                    | Source           | Condition                    |
| ------------------------ | ---------------- | ---------------------------- |
| Database connection fail | Model update     | Database unavailable         |
| MSAB event failure       | MSABEventService | EventBridge connection error |

### Edge Cases

| Case                                 | Behavior                                           |
| ------------------------------------ | -------------------------------------------------- |
| Rejecting already rejected request   | Returns 403 (canBeProcessed() returns false)       |
| Rejecting approved request           | Returns 403 (canBeProcessed() returns false)       |
| Rejecting cancelled request          | Returns 403 (canBeProcessed() returns false)       |
| Multiple rapid rejection attempts    | First succeeds, subsequent fail with 403           |
| Rejecting while agency is suspended  | Still allowed (policy doesn't check agency status) |
| MSAB event fails after status update | Status updated, notification may not be delivered  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER           POLICY                 MODEL/SERVICE              DATABASE
   │                       │                       │                   │                        │                         │
   │  POST .../reject      │                       │                   │                        │                         │
   │──────────────────────▶│                       │                   │                        │                         │
   │                       │                       │                   │                        │                         │
   │                       │ 1. auth:sanctum       │                   │                        │                         │
   │                       │   validate token      │                   │                        │                         │
   │                       │───────────────────────────────────────────────────────────────────▶│                         │
   │                       │◀───────────────────────────────────────────────────────────────────│                         │
   │                       │                       │                   │                        │                         │
   │                       │ 2. Route Model Bind   │                   │                        │                         │
   │                       │───────────────────────────────────────────────────────────────────▶│                         │
   │                       │                       │                   │                        │  3. SELECT join_request │
   │                       │                       │                   │                        │────────────────────────▶│
   │                       │                       │                   │                        │◀────────────────────────│
   │                       │◀──────────────────────│                   │                        │                         │
   │                       │                       │                   │                        │                         │
   │                       │ 4. Invoke Controller  │                   │                        │                         │
   │                       │──────────────────────▶│                   │                        │                         │
   │                       │                       │                   │                        │                         │
   │                       │                       │ 5. authorize()    │                        │                         │
   │                       │                       │──────────────────▶│                        │                         │
   │                       │                       │                   │ 6. canBeProcessed()    │                         │
   │                       │                       │                   │───────────────────────▶│                         │
   │                       │                       │                   │◀───────────────────────│                         │
   │                       │                       │                   │                        │                         │
   │                       │                       │                   │ 7. Check ownership     │                         │
   │                       │                       │                   │───────────────────────────────────────────────────▶│
   │                       │                       │                   │◀──────────────────────────────────────────────────│
   │                       │                       │◀──────────────────│                        │                         │
   │                       │                       │                   │                        │                         │
   │                       │                       │ 8. Update request │                        │                         │
   │                       │                       │───────────────────────────────────────────▶│                         │
   │                       │                       │                   │                        │  9. UPDATE status       │
   │                       │                       │                   │                        │────────────────────────▶│
   │                       │                       │                   │                        │◀────────────────────────│
   │                       │                       │                   │                        │                         │
   │                       │                       │ 10. load('agency')│                        │                         │
   │                       │                       │───────────────────────────────────────────▶│                         │
   │                       │                       │                   │                        │  11. SELECT agency      │
   │                       │                       │                   │                        │────────────────────────▶│
   │                       │                       │                   │                        │◀────────────────────────│
   │                       │                       │◀──────────────────────────────────────────│                         │
   │                       │                       │                   │                        │                         │
   │                       │                       │ 12. emit MSAB     │                        │                         │
   │                       │                       │───────────────────────────────────────────▶│                         │
   │                       │                       │                   │                        │  13. EventBridge        │
   │                       │                       │                   │                        │─────────▶ [MSAB]        │
   │                       │                       │◀──────────────────────────────────────────│                         │
   │                       │                       │                   │                        │                         │
   │                       │ 14. ApiResponse       │                   │                        │                         │
   │                       │◀──────────────────────│                   │                        │                         │
   │◀──────────────────────│                       │                   │                        │                         │
   │                       │                       │                   │                        │                         │
   │   200 + JSON          │                       │                   │                        │                         │
   │                       │                       │                   │                        │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                               |
| -------------------------- | -------------------------------------- |
| New rejection reason field | Controller, Model $fillable, migration |
| Rejection notification SMS | After MSAB emit in controller          |
| Rejection audit logging    | Add observer or after update callback  |
| Rejection cooldown         | AgencyJoinRequestPolicy                |
| Custom rejection message   | Add to request body, save to model     |

### 📝 Field Modification Guide

#### ➕ ADDING A REJECTION REASON FIELD

| Step  | File                                                       | What to Change                             |
| ----- | ---------------------------------------------------------- | ------------------------------------------ |
| **1** | **Database Migration**                                     | Add `rejection_reason` column              |
| **2** | `app/Models/Agency/AgencyJoinRequest.php`                  | Add to `$fillable`                         |
| **3** | `app/Http/Controllers/.../AgencyJoinRequestController.php` | Accept and pass rejection_reason to update |
| **4** | `app/Http/Resources/.../AgencyJoinRequestResource.php`     | Add to response if loaded                  |
| **5** | `app/Services/Realtime/MSABEventService.php`                   | Include reason in event payload (optional) |

#### ➖ REMOVING MSAB NOTIFICATION

| Step  | File                                                       | What to Change                  |
| ----- | ---------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Controllers/.../AgencyJoinRequestController.php` | Remove MSAB lines from reject() |
| **2** | Remove constructor dependency if no longer needed          |                                 |

### 🔗 Field Flow Dependency Chain

```
Request Body (none for reject)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Controller: reject()                                         │
│   - Uses $joinRequest from route model binding               │
│   - Uses $user from request->user()                          │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Model Update                                                 │
│   status ← AgencyJoinRequestStatus::REJECTED                 │
│   processed_by ← $user->id                                   │
│   processed_at ← now()                                       │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ MSAB Event Payload                                           │
│   requester_id ← $joinRequest->user_id                       │
│   agency_id ← $joinRequest->agency_id                        │
│   agency_name ← $joinRequest->agency->name                   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ ApiResponse::success()                                       │
│   data ← null                                                │
│   message ← "Join request rejected."                         │
└──────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                                  |
| ------------------------------ | ------------------------------------------------------- |
| `AgencyJoinRequestStatus` enum | Changing values breaks existing database records        |
| Policy authorization order     | Security-critical, changes could create vulnerabilities |
| Route model binding parameter  | Must match route definition exactly                     |
| MSAB event name                | Client apps depend on exact event names                 |
| ApiResponse structure          | All clients expect consistent response format           |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                              |
| ----------------------------------- | ------------------------------------------------------- |
| Forgetting to emit MSAB event       | Requester won't know their request was rejected         |
| Not loading agency before MSAB emit | Will cause null reference error                         |
| Checking agency status in policy    | Not required, allows rejection even if agency suspended |
| Returning resource data             | Reject returns null, unlike approve                     |
| Not wrapping in transaction         | Update + event should be atomic (consider adding)       |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 106-107)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyJoinRequestController.php                      ← Controller (reject method)
app/Policies/Agency/
  └── AgencyJoinRequestPolicy.php                          ← Authorization policy
app/Models/Agency/
  └── AgencyJoinRequest.php                                ← Eloquent model
app/Enums/Agency/
  └── AgencyJoinRequestStatus.php                          ← Status enum
app/Services/Gift/
  └── MSABEventService.php                                 ← Event emission service
app/Http/Utils/
  └── ApiResponse.php                                      ← Response formatter
app/Concerns/
  └── ManagesUserAgency.php                                ← Shared trait (not used in reject)
```

---

## Document Metadata

| Property            | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/agency/join-requests/{joinRequest}/reject` |
| **Domain**          | Agency Join Requests                                          |
| **Author**          | System Documentation                                          |
| **Created**         | 2026-02-03                                                    |
| **Laravel Version** | 12.x                                                          |
| **PHP Version**     | 8.4+                                                          |
