# POST /api/v1/user/agency/join-requests/{joinRequest}/approve

> **Domain**: Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Approves a pending join request, adding the requesting user as an agency member and updating their coin reseller settings.

### Responsibilities

- Authorize the approver (agency owner/admin or official)
- Validate request can still be processed (status is pending)
- Verify agency is operational and user not already a member
- Add user as agency member via atomic transaction
- Inherit coin reseller from agency to new member
- Emit real-time notification to requester via MSAB

### What It Owns

| Owned                 | Description                                    |
| --------------------- | ---------------------------------------------- |
| Join request approval | Updates request status to approved             |
| Member creation       | Creates/reactivates AgencyMember record        |
| Reseller inheritance  | Updates user's default_reseller_id from agency |

### External Dependencies

| Dependency | Type           | Purpose                           |
| ---------- | -------------- | --------------------------------- |
| Redis      | Infrastructure | Distributed locking, MSAB pub/sub |
| Database   | Infrastructure | Transaction for atomic operations |
| MSAB       | Service        | Real-time notification to client  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/agency/join-requests/{joinRequest}/approve
```

### Authentication

✅ **Required** - User must be authenticated via Sanctum

### Rate Limiting

| Limiter | Key       | Config             |
| ------- | --------- | ------------------ |
| Default | `user:id` | 60 requests/minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter     | Type  | Description                       |
| ------------- | ----- | --------------------------------- |
| `joinRequest` | `int` | ID of the join request to approve |

### Request Body

None required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Join request approved. User is now a member.",
  "data": {
    "id": 123,
    "status": "approved",
    "status_label": "Approved",
    "message": "I would like to join your agency",
    "created_at": "2026-02-03T10:00:00.000000Z",
    "can_be_processed": false,
    "can_be_cancelled": false,
    "agency": {
      "id": 45,
      "name": "Elite Agency",
      "country": "US",
      "logo": "https://example.com/logo.jpg"
    },
    "user": {
      "id": 789,
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "processed_at": "2026-02-03T12:30:00.000000Z",
    "processed_by": {
      "id": 456,
      "name": "Agency Owner"
    }
  },
  "meta": {
    "timestamp": "2026-02-03T12:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": {}
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "This request cannot be processed.",
  "data": null,
  "errors": {
    "status": ["Request is not pending."]
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [AgencyJoinRequest].",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                |
| ----- | ---------------------------------------- |
| `200` | Join request approved successfully       |
| `401` | User not authenticated                   |
| `403` | User not authorized to approve           |
| `404` | Join request not found                   |
| `422` | Business logic error (not pending, etc.) |
| `500` | Server error (lock timeout, DB error)    |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│           POST /api/v1/user/agency/join-requests/{joinRequest}/approve      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:102-103                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{joinRequest}/approve', [AgencyJoinRequestController::   │ │
│ │     class, 'approve'])->name('user.agency.join-requests.approve');     │ │
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
│ Laravel auto-resolves {joinRequest} to AgencyJoinRequest model              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ AgencyJoinRequest::findOrFail($joinRequest)                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Returns 404 if not found                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER METHOD                                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyJoinRequestController.php    │
│ Method: approve(Request $request, AgencyJoinRequest $joinRequest,           │
│                 ApproveJoinRequestAction $action)                           │
│                                                                             │
│ STEP 1: Authorization via policy                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('approve', $joinRequest);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate authenticated user                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) return ApiResponse::error('Unauthenticated.', 401); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute action and handle result                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($joinRequest, $user);                        │ │
│ │                                                                         │ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error($result->getMessage(), ..., 422);         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AgencyJoinRequestResource($result->getData()),                  │ │
│ │     $result->getMessage(),                                              │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyJoinRequestPolicy.php                       │
│ Method: approve(User $user, AgencyJoinRequest $request)                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Request must be processable (pending status)                         │ │
│ │ if (! $request->canBeProcessed()) return false;                         │ │
│ │                                                                         │ │
│ │ // Officials (Super Admin/Admin) can approve                            │ │
│ │ if ($this->isOfficial($user)) return true;                              │ │
│ │                                                                         │ │
│ │ // Agency owner can approve                                             │ │
│ │ if ($agency->isOwnedBy($user)) return true;                             │ │
│ │                                                                         │ │
│ │ // Agency admin can approve                                             │ │
│ │ $member = $agency->getMember($user);                                    │ │
│ │ return $member !== null && $member->canManageMembers();                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION EXECUTION                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/ApproveJoinRequestAction.php                       │
│ Method: execute(AgencyJoinRequest $request, User $processor)                │
│                                                                             │
│ STEP 1: Validate request can be processed                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $request->canBeProcessed()) {                                     │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This request cannot be processed.',                   │ │
│ │         errors: ['status' => ['Request is not pending.']],              │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate agency is operational                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $agency->isOperational()) {                                       │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This agency is no longer operational.',               │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check user not already a member                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->hasMember($request->user)) {                               │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This user is already a member of the agency.',        │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Acquire distributed lock for race condition prevention              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $lockKey = "agency:{$agency->id}:member:{$request->user_id}";           │ │
│ │ Cache::lock($lockKey, 10)->block(5, function () { ... });               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in transaction):                                       │
│                                                                             │
│ 1. UPDATE: Update request status                                            │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ $request->update([                                                    ││
│    │     'status' => AgencyJoinRequestStatus::APPROVED,                    ││
│    │     'processed_by' => $processor->id,                                 ││
│    │     'processed_at' => now(),                                          ││
│    │ ]);                                                                   ││
│    └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ 2. UPSERT: Create or reactivate member                                      │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ AgencyMember::updateOrCreate(                                         ││
│    │     ['agency_id' => $agency->id, 'user_id' => $request->user_id],     ││
│    │     [                                                                 ││
│    │         'role' => AgencyMemberRole::MEMBER,                           ││
│    │         'status' => AgencyMemberStatus::ACTIVE,                       ││
│    │         'left_at' => null,                                            ││
│    │         'leave_reason' => null,                                       ││
│    │         'removed_by' => null,                                         ││
│    │     ]                                                                 ││
│    │ );                                                                    ││
│    └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ 3. UPDATE: Inherit coin reseller (if agency has one)                        │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ if ($agency->coin_reseller_id !== null) {                             ││
│    │     $request->user->update([                                          ││
│    │         'default_reseller_id' => $agency->coin_reseller_id            ││
│    │     ]);                                                               ││
│    │ }                                                                     ││
│    └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ 4. SELECT: Refresh and load relationships                                   │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ $request->refresh();                                                  ││
│    │ $request->load(['agency', 'user', 'processor']);                      ││
│    └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. LOCK: Distributed lock for 10 seconds                                    │
│    Key: agency:{id}:member:{user_id}                                        │
│    Block timeout: 5 seconds                                                 │
│                                                                             │
│ REAL-TIME EVENTS (after transaction):                                       │
│                                                                             │
│ 1. EMIT: agency.join_request_approved via Redis pub/sub                     │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ $this->msabEventService->emitAgencyJoinRequestApproved(               ││
│    │     $request->user_id,                                                ││
│    │     $request->agency_id,                                              ││
│    │     $request->agency->name                                            ││
│    │ );                                                                    ││
│    └───────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $joinRequest->id,                                           │ │
│ │     'status' => $joinRequest->status->value,                            │ │
│ │     'status_label' => $joinRequest->status->label(),                    │ │
│ │     'message' => $joinRequest->message,                                 │ │
│ │     'created_at' => $joinRequest->created_at->toISOString(),            │ │
│ │     'can_be_processed' => $joinRequest->canBeProcessed(),               │ │
│ │     'can_be_cancelled' => $joinRequest->canBeCancelled(),               │ │
│ │     'agency' => [...], // if loaded                                     │ │
│ │     'user' => new MinimalUserResource(...), // if loaded                │ │
│ │     'processed_at' => ..., // if processed                              │ │
│ │     'processed_by' => new MinimalUserResource(...), // if loaded        │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.5 SUPPORTING COMPONENTS

COMPONENT: ApproveJoinRequestAction (Action)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ File: app/Actions/Agency/ApproveJoinRequestAction.php                       │
│ Responsibility: Execute join request approval with all business logic       │
│ Reusable: YES (can be called from admin panel, CLI, etc.)                   │
│ Why It Exists: Encapsulates complex approval logic with proper locking      │
│                                                                             │
│ Key Methods:                                                                │
│   • execute($request, $processor) → ActionResult                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

COMPONENT: ActionResult (DTO)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ File: app/Actions/ActionResult.php                                          │
│ Responsibility: Standardized result object for action outcomes              │
│ Reusable: YES (used across all action classes)                              │
│ Why It Exists: Consistent success/failure pattern without exceptions        │
│                                                                             │
│ Key Methods:                                                                │
│   • success($data, $message, $meta) → ActionResult                          │
│   • failure($errors, $message, $data) → ActionResult                        │
│   • isSuccess() → bool                                                      │
│   • getData() → mixed                                                       │
│   • getErrors() → array                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

COMPONENT: AgencyJoinRequestPolicy (Policy)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ File: app/Policies/Agency/AgencyJoinRequestPolicy.php                       │
│ Responsibility: Authorization rules for join request operations             │
│ Reusable: YES (covers view, create, approve, reject, cancel)                │
│ Why It Exists: Centralized authorization logic for join requests            │
│                                                                             │
│ Key Methods:                                                                │
│   • approve($user, $request) → bool                                         │
│   • reject($user, $request) → bool                                          │
│   • cancel($user, $request) → bool                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

COMPONENT: MSABEventService (Service)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ File: app/Services/Realtime/MSABEventService.php                                │
│ Responsibility: Emit real-time events to MSAB via Redis pub/sub             │
│ Reusable: YES (used across entire application)                              │
│ Why It Exists: Decoupled real-time notification system                      │
│                                                                             │
│ Key Methods:                                                                │
│   • emitAgencyJoinRequestApproved($requesterId, $agencyId, $agencyName)     │
│   • emit($event, $payload, $userId, $roomId)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

COMPONENT: AgencyJoinRequestResource (Resource)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ File: app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php            │
│ Responsibility: Transform join request for API response                     │
│ Reusable: YES (used by index, mine, approve, reject endpoints)              │
│ Why It Exists: Consistent API response formatting                           │
│                                                                             │
│ Key Methods:                                                                │
│   • toArray($request) → array                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                            | Used By Endpoints                    | Reusable | Reasoning                     |
| ------------------------------- | ------------------------------------ | -------- | ----------------------------- |
| `ApproveJoinRequestAction.php`  | approve, admin panel                 | ✅       | Encapsulated approval logic   |
| `ActionResult.php`              | All action classes                   | ✅       | Generic result pattern        |
| `AgencyJoinRequestPolicy.php`   | All join request endpoints           | ✅       | Centralized authorization     |
| `AgencyJoinRequestResource.php` | index, mine, approve, reject         | ✅       | Consistent response format    |
| `MSABEventService.php`          | All real-time notification endpoints | ✅       | Shared event emission service |
| `ApiResponse.php`               | All API endpoints                    | ✅       | Standardized response format  |
| `AgencyJoinRequest.php`         | All join request endpoints           | ✅       | Eloquent model                |
| `AgencyMember.php`              | All membership endpoints             | ✅       | Eloquent model                |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                               | Source                     | Condition                     |
| ----------------------------------- | -------------------------- | ----------------------------- |
| "Request is not pending."           | `ApproveJoinRequestAction` | Request already processed     |
| "Agency is not operational."        | `ApproveJoinRequestAction` | Agency dissolved/rejected     |
| "Already a member."                 | `ApproveJoinRequestAction` | User already active member    |
| "Concurrent operation in progress." | `ApproveJoinRequestAction` | Lock timeout (race condition) |

### Authorization Errors (403)

| Error                          | Source                    | Condition                          |
| ------------------------------ | ------------------------- | ---------------------------------- |
| "This action is unauthorized." | `AgencyJoinRequestPolicy` | User not owner/admin/official      |
| "This action is unauthorized." | `AgencyJoinRequestPolicy` | Request not pending (policy check) |

### System Errors (500)

| Error                             | Source                     | Condition                    |
| --------------------------------- | -------------------------- | ---------------------------- |
| "Failed to approve join request." | `ApproveJoinRequestAction` | Database transaction failure |
| Exception from Redis/DB           | Various                    | Infrastructure failure       |

### Edge Cases

| Case                                    | Behavior                                          |
| --------------------------------------- | ------------------------------------------------- |
| Concurrent approval attempts            | Distributed lock prevents race condition          |
| User re-joining after leaving           | updateOrCreate reactivates existing member record |
| Agency has no coin reseller             | User's default_reseller_id unchanged              |
| Request already approved/rejected       | 403 Forbidden (policy blocks)                     |
| Agency dissolved between check and save | Transaction rolls back                            |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER            ACTION                    POLICY                DATABASE/CACHE
   │                     │                       │                     │                        │                        │
   │  POST /approve      │                       │                     │                        │                        │
   │────────────────────▶│                       │                     │                        │                        │
   │                     │                       │                     │                        │                        │
   │                     │ 1. auth:sanctum       │                     │                        │                        │
   │                     │──────────────────────▶│                     │                        │                        │
   │                     │                       │                     │                        │                        │
   │                     │                       │ 2. Resolve model    │                        │                        │
   │                     │                       │────────────────────────────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │   SELECT join_request  │
   │                     │                       │◀────────────────────────────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │ 3. authorize()      │                        │                        │
   │                     │                       │─────────────────────────────────────────────▶│                        │
   │                     │                       │                     │                        │ 3a. canBeProcessed()   │
   │                     │                       │                     │                        │ 3b. isOfficial()       │
   │                     │                       │                     │                        │ 3c. isOwnedBy()        │
   │                     │                       │                     │                        │ 3d. getMember()        │
   │                     │                       │◀─────────────────────────────────────────────│                        │
   │                     │                       │                     │                        │                        │
   │                     │                       │ 4. execute()        │                        │                        │
   │                     │                       │────────────────────▶│                        │                        │
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 5. Acquire lock       │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │   LOCK agency:X:member:Y │
   │                     │                       │                     │◀───────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 6. BEGIN TRANSACTION  │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 7. Update request     │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │   UPDATE join_requests │
   │                     │                       │                     │◀───────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 8. Create member      │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │   INSERT/UPDATE members│
   │                     │                       │                     │◀───────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 9. Update reseller    │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │   UPDATE users         │
   │                     │                       │                     │◀───────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 10. COMMIT            │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │◀───────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │                     │ 11. Emit MSAB event   │                        │
   │                     │                       │                     │───────────────────────────────────────────────────▶│
   │                     │                       │                     │                        │   PUBLISH redis        │
   │                     │                       │                     │◀───────────────────────────────────────────────────│
   │                     │                       │                     │                        │                        │
   │                     │                       │◀────────────────────│                        │                        │
   │                     │◀──────────────────────│                       │                        │                        │
   │◀────────────────────│                       │                     │                        │                        │
   │                     │                       │                     │                        │                        │
   │  200 OK + JSON      │                       │                     │                        │                        │
   │                     │                       │                     │                        │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                              |
| -------------------------- | ------------------------------------- |
| New validation rule        | `ApproveJoinRequestAction::execute()` |
| Response field             | `AgencyJoinRequestResource`           |
| Authorization rule         | `AgencyJoinRequestPolicy::approve()`  |
| Side effect (notification) | `ApproveJoinRequestAction::execute()` |
| New real-time event        | `MSABEventService`                    |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                      | What to Change            |
| ----- | ----------------------------------------- | ------------------------- |
| **1** | Database Migration                        | Add column to table       |
| **2** | `app/Models/Agency/AgencyJoinRequest.php` | Add to `$fillable`        |
| **3** | `AgencyJoinRequestResource.php`           | Add to `toArray()` return |

#### ➕ ADDING A NEW SIDE EFFECT

| Step  | File                           | What to Change                |
| ----- | ------------------------------ | ----------------------------- |
| **1** | `ApproveJoinRequestAction.php` | Add logic after member create |
| **2** | Inject service if needed       | Add to constructor            |

#### ➕ ADDING NEW AUTHORIZATION RULE

| Step  | File                          | What to Change            |
| ----- | ----------------------------- | ------------------------- |
| **1** | `AgencyJoinRequestPolicy.php` | Modify `approve()` method |

### 🔗 Field Flow Dependency Chain

```
AgencyJoinRequest (Model)
       │
       ├──▶ canBeProcessed() ──▶ AgencyJoinRequestStatus::canBeProcessed()
       │
       ├──▶ agency ──▶ Agency::isOperational() ──▶ AgencyStatus::isOperational()
       │              Agency::hasMember()
       │              Agency::coin_reseller_id
       │
       └──▶ user ──▶ User::default_reseller_id (updated on approval)

ApproveJoinRequestAction
       │
       ├──▶ ActionResult (success/failure)
       │
       ├──▶ AgencyMember::updateOrCreate()
       │
       └──▶ MSABEventService::emitAgencyJoinRequestApproved()
```

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                           |
| ---------------------------- | ------------------------------------------------ |
| Lock key format              | Must be unique per agency+user combination       |
| Transaction scope            | All DB operations must be atomic                 |
| Policy checks                | Security boundary for authorization              |
| ActionResult pattern         | Used application-wide, changing signature breaks |
| MSAB event payload structure | Client apps depend on exact format               |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                    |
| ------------------------------------------ | --------------------------------------------- |
| Adding DB operation outside transaction    | Always use DB::transaction() block            |
| Forgetting to refresh model after update   | Call $request->refresh() before response      |
| Changing lock key format                   | Test concurrent approval scenarios            |
| Not loading relationships for response     | Use load(['agency', 'user', 'processor'])     |
| Modifying MSAB event without client update | Coordinate with mobile/frontend teams         |
| Removing hasMember check                   | Critical for preventing duplicate memberships |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyJoinRequestController.php                      ← Controller
app/Actions/Agency/
  └── ApproveJoinRequestAction.php                         ← Business logic
app/Actions/
  └── ActionResult.php                                     ← Result DTO
app/Policies/Agency/
  └── AgencyJoinRequestPolicy.php                          ← Authorization
app/Models/Agency/
  ├── AgencyJoinRequest.php                                ← Join request model
  ├── AgencyMember.php                                     ← Member model
  └── Agency.php                                           ← Agency model
app/Enums/Agency/
  ├── AgencyJoinRequestStatus.php                          ← Status enum
  ├── AgencyMemberRole.php                                 ← Role enum
  └── AgencyMemberStatus.php                               ← Member status enum
app/Http/Resources/V1/Agency/
  └── AgencyJoinRequestResource.php                        ← Response transformer
app/Services/Gift/
  └── MSABEventService.php                                 ← Real-time events
app/Http/Utils/
  └── ApiResponse.php                                      ← Response helper
```

---

## Document Metadata

| Property            | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/agency/join-requests/{joinRequest}/approve` |
| **Domain**          | Agency Management                                              |
| **Author**          | System Documentation                                           |
| **Created**         | 2026-02-03                                                     |
| **Laravel Version** | 12.x                                                           |
| **PHP Version**     | 8.4+                                                           |
