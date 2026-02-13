# DELETE /api/v1/user/agency

> **Domain**: User / Agency Membership  
> **Type**: Protected Endpoint (Owner Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

The Dissolve Agency endpoint allows an agency owner to permanently dissolve (soft-close) their agency, removing all members and setting the agency status to dissolved.

### Responsibilities

- Verify the authenticated user owns an agency
- Authorize the dissolve action via policy
- Update agency status to DISSOLVED with timestamp
- Kick all active members with reason "Agency dissolved"
- Reset coin reseller assignments for all members and owner
- Emit real-time notifications to all kicked members
- Invalidate agency listing cache

### What It Owns

| Owned              | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Agency dissolution | Updates agency status to `DISSOLVED` with `dissolved_at` timestamp |
| Member removal     | Sets all members to `KICKED` status with leave reason              |
| Reseller reset     | Clears `default_reseller_id` for affected members and owner        |

### External Dependencies

| Dependency      | Type           | Purpose                                         |
| --------------- | -------------- | ----------------------------------------------- |
| MySQL           | Database       | Stores agency and member data                   |
| Redis           | Cache          | Invalidates `agencies` cache tags               |
| MSAB Server     | Real-time      | Notifies dissolved agency members via WebSocket |
| Queue (Laravel) | Infrastructure | Dispatches async MSAB event jobs                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/user/agency
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter  | Key     | Config           |
| -------- | ------- | ---------------- |
| Standard | User ID | Default throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ❌       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

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
  "message": "Agency dissolved successfully. All members have been removed.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T16:52:05.000000Z",
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
    "timestamp": "2026-02-03T16:52:05.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ No Owned Agency Error (404)

```json
{
  "status": "error",
  "message": "You do not own an agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T16:52:05.000000Z",
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
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T16:52:05.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "Only approved agencies can be dissolved.",
  "data": null,
  "errors": {
    "status": ["Agency is not approved."]
  },
  "meta": {
    "timestamp": "2026-02-03T16:52:05.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                        |
| ----- | ------------------------------------------------ |
| `200` | Agency dissolved successfully                    |
| `401` | User not authenticated                           |
| `403` | User not authorized to dissolve this agency      |
| `404` | User does not own an agency                      |
| `422` | Agency is not approved (cannot be dissolved)     |
| `500` | Database transaction failure or unexpected error |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/user/agency                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:63                                            │
│ Route: Route::delete('/', [AgencyMembershipController::class, 'dissolve'])  │
│        ->name('user.agency.dissolve')                                       │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads User                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php:93  │
│                                                                             │
│ No dedicated FormRequest class - uses standard Illuminate\Http\Request      │
│ No request body validation required (DELETE with no payload)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php     │
│ Method: dissolve(Request $request, DissolveAgencyAction $action)            │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Fetch owned agency                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $user->ownedAgency;                                           │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not own an agency.', [], 404);    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Authorize via policy                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('dissolve', $agency);                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Execute action and return response                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($agency, $user);                             │ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage() ?? 'An error occurred',                   │ │
│ │         $result->getErrors(), 422                                       │ │
│ │     );                                                                   │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(null, $result->getMessage());               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyPolicy.php:117                              │
│ Method: dissolve(User $user, Agency $agency): bool                          │
│                                                                             │
│ Authorization Logic:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function dissolve(User $user, Agency $agency): bool              │ │
│ │ {                                                                       │ │
│ │     // Only approved agencies can be dissolved                          │ │
│ │     if (! $agency->isApproved()) {                                      │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │     // Owner or officials (Super Admin, Admin) can dissolve             │ │
│ │     return $agency->isOwnedBy($user) || $this->isOfficial($user);       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SERVICE LAYER FLOW (ACTION)                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/DissolveAgencyAction.php                           │
│ Method: execute(Agency $agency, User $actor): ActionResult                  │
│                                                                             │
│ STEP 1: Validate agency status                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $agency->isApproved()) {                                          │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'Only approved agencies can be dissolved.',            │ │
│ │         errors: ['status' => ['Agency is not approved.']],              │ │
│ │     );                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($agency, $actor) {              │ │
│ │     // ... transaction logic                                            │ │
│ │ });                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Collect member user IDs (excluding owner)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $memberUserIds = $agency->activeMembers()                               │ │
│ │     ->where('user_id', '!=', $agency->user_id)                          │ │
│ │     ->pluck('user_id')                                                   │ │
│ │     ->toArray();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Update agency status to DISSOLVED                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency->update([                                                        │ │
│ │     'status' => AgencyStatus::DISSOLVED,                                 │ │
│ │     'dissolved_at' => now(),                                             │ │
│ │ ]);                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Kick all members (except owner)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency->members()                                                       │ │
│ │     ->where('user_id', '!=', $agency->user_id)                          │ │
│ │     ->update([                                                           │ │
│ │         'status' => AgencyMemberStatus::KICKED,                          │ │
│ │         'removed_by' => $actor->id,                                      │ │
│ │         'left_at' => now(),                                              │ │
│ │         'leave_reason' => 'Agency dissolved',                            │ │
│ │     ]);                                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Reset coin reseller for members                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (count($memberUserIds) > 0) {                                         │ │
│ │     User::whereIn('id', $memberUserIds)                                  │ │
│ │         ->update(['default_reseller_id' => null]);                       │ │
│ │ }                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Reset owner's coin reseller if set                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->coin_reseller_id !== null) {                               │ │
│ │     User::where('id', $agency->user_id)                                  │ │
│ │         ->update(['default_reseller_id' => null]);                       │ │
│ │ }                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Refresh agency model                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency->refresh();                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9: Emit MSAB event to notify members                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (count($memberUserIds) > 0) {                                         │ │
│ │     $this->msabEventService->emitAgencyDissolved(                        │ │
│ │         $agency->id,                                                      │ │
│ │         $agency->name,                                                    │ │
│ │         $memberUserIds                                                    │ │
│ │     );                                                                     │ │
│ │ }                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 10: Invalidate agency listing cache                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cache::tags(['agencies'])->flush();                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 11: Return success result                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                            │ │
│ │     data: $agency,                                                        │ │
│ │     message: 'Agency dissolved successfully. All members removed.',     │ │
│ │     meta: [                                                               │ │
│ │         'agency_id' => $agency->id,                                      │ │
│ │         'members_removed' => count($memberUserIds),                      │ │
│ │     ],                                                                     │ │
│ │ );                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: MSABEventService (Real-time Event Emitter)                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php:279                        │ │
│ │ Responsibility: Dispatch real-time 'agency.dissolved' events            │ │
│ │ Reusable: YES (used by all agency real-time notifications)              │ │
│ │ Why It Exists: Decouple WebSocket emission from business logic          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitAgencyDissolved($agencyId, $agencyName, $memberUserIds)        │ │
│ │     → Iterates through members and emits event to each user             │ │
│ │   • emit($event, $payload, $userId) → Dispatches EmitMSABEvent job      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action outcome container                   │ │
│ │ Reusable: YES (used by all Action classes)                              │ │
│ │ Why It Exists: Consistent success/failure handling across actions       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta) → Create success result             │ │
│ │   • failure($errors, $message) → Create failure result                  │ │
│ │   • fromException($e, $message) → Create failure from exception         │ │
│ │   • isSuccess() / isFailure() → Check result status                     │ │
│ │   • getMessage() / getErrors() → Retrieve result details                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyPolicy (Authorization Policy)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Agency/AgencyPolicy.php                              │ │
│ │ Responsibility: Agency-related authorization checks                     │ │
│ │ Reusable: YES (used by all agency controllers)                          │ │
│ │ Why It Exists: Centralized authorization logic                          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • dissolve($user, $agency) → Check dissolve permission                │ │
│ │   • isOwnedBy($user) → Check ownership                                  │ │
│ │   • isOfficial($user) → Check admin/super admin role                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Utility)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response construction                 │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent API response format                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta, $statusCode) → Success response     │ │
│ │   • error($message, $errors, $statusCode, $meta) → Error response       │ │
│ │   • getCorrelationId() → Get or generate request correlation ID         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order within transaction):                          │
│                                                                             │
│ 1. SELECT: Get owned agency                                                 │
│    Query: SELECT * FROM agencies WHERE user_id = ? LIMIT 1                  │
│    Source: User::ownedAgency relationship                                   │
│                                                                             │
│ 2. SELECT: Get active member user IDs (excluding owner)                     │
│    Query: SELECT user_id FROM agency_members                                │
│           WHERE agency_id = ? AND status = 'active' AND user_id != ?        │
│    Source: DissolveAgencyAction                                             │
│                                                                             │
│ 3. UPDATE: Set agency status to DISSOLVED                                   │
│    Query: UPDATE agencies SET status = 'dissolved', dissolved_at = ?        │
│           WHERE id = ?                                                       │
│    Source: DissolveAgencyAction                                             │
│                                                                             │
│ 4. UPDATE: Kick all members (except owner)                                  │
│    Query: UPDATE agency_members SET status = 'kicked', removed_by = ?,      │
│           left_at = ?, leave_reason = 'Agency dissolved'                    │
│           WHERE agency_id = ? AND user_id != ?                               │
│    Source: DissolveAgencyAction                                             │
│                                                                             │
│ 5. UPDATE: Reset member reseller IDs                                        │
│    Query: UPDATE users SET default_reseller_id = NULL                        │
│           WHERE id IN (...)                                                  │
│    Source: DissolveAgencyAction                                             │
│                                                                             │
│ 6. UPDATE: Reset owner reseller ID (if applicable)                          │
│    Query: UPDATE users SET default_reseller_id = NULL WHERE id = ?           │
│    Source: DissolveAgencyAction                                             │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. FLUSH: Invalidate agencies cache                                         │
│    Key: Cache::tags(['agencies'])->flush()                                  │
│    Source: DissolveAgencyAction                                             │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ 1. DISPATCH: EmitMSABEvent jobs (one per member)                            │
│    Event: 'agency.dissolved'                                                │
│    Payload: { agency_id, agency_name }                                      │
│    Target: Each member user individually                                    │
│    Source: MSABEventService::emitAgencyDissolved()                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Success Response:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                                │ │
│ │     'status' => 'success',                                               │ │
│ │     'message' => 'Agency dissolved successfully. All members removed.', │ │
│ │     'data' => null,                                                       │ │
│ │     'meta' => [                                                           │ │
│ │         'timestamp' => now()->toISOString(),                             │ │
│ │         'correlation_id' => self::getCorrelationId(),                    │ │
│ │     ],                                                                     │ │
│ │ ], 200);                                                                   │ │
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

## 4. Reusability Matrix

| File                             | Used By Endpoints                              | Reusable | Reasoning                            |
| -------------------------------- | ---------------------------------------------- | -------- | ------------------------------------ |
| `AgencyMembershipController.php` | user-agency/\*, dissolve, leave, coin-reseller | ❌       | Endpoint-specific controller         |
| `DissolveAgencyAction.php`       | DELETE /api/v1/user/agency                     | ❌       | Single-purpose dissolve action       |
| `AgencyPolicy.php`               | All agency endpoints                           | ✅       | Centralized agency authorization     |
| `ApiResponse.php`                | All API endpoints                              | ✅       | Global response utility              |
| `ActionResult.php`               | All Action classes                             | ✅       | Global result pattern implementation |
| `MSABEventService.php`           | All real-time notification endpoints           | ✅       | Reusable event emission service      |
| `Agency.php` (Model)             | All agency endpoints                           | ✅       | Core domain model                    |
| `AgencyMember.php` (Model)       | All membership endpoints                       | ✅       | Core domain model                    |
| `User.php` (Model)               | All authenticated endpoints                    | ✅       | Core user model                      |
| `AgencyStatus.php` (Enum)        | All agency endpoints                           | ✅       | Status constants                     |
| `AgencyMemberStatus.php` (Enum)  | All membership endpoints                       | ✅       | Member status constants              |

---

## 5. Error Handling & Edge Cases

### Business Logic Errors (422)

| Error                                      | Source                 | Condition                       |
| ------------------------------------------ | ---------------------- | ------------------------------- |
| "Only approved agencies can be dissolved." | `DissolveAgencyAction` | Agency status is not `APPROVED` |

### Authentication Errors (401)

| Error              | Source                       | Condition                 |
| ------------------ | ---------------------------- | ------------------------- |
| "Unauthenticated." | `AgencyMembershipController` | User is not authenticated |

### Authorization Errors (403)

| Error                          | Source         | Condition                                             |
| ------------------------------ | -------------- | ----------------------------------------------------- |
| "This action is unauthorized." | `AgencyPolicy` | User is not owner or official, or agency not approved |

### Not Found Errors (404)

| Error                       | Source                       | Condition                |
| --------------------------- | ---------------------------- | ------------------------ |
| "You do not own an agency." | `AgencyMembershipController` | User has no owned agency |

### System Errors (500)

| Error                        | Source                 | Condition                    |
| ---------------------------- | ---------------------- | ---------------------------- |
| "Failed to dissolve agency." | `DissolveAgencyAction` | Database transaction failure |

### Edge Cases

| Case                                | Behavior                                   |
| ----------------------------------- | ------------------------------------------ |
| Agency with no members (only owner) | Dissolves successfully, no members to kick |
| Agency without coin_reseller_id     | Owner's reseller not reset (null check)    |
| MSAB server unavailable             | Event queued but not delivered (async)     |
| Transaction fails mid-operation     | All changes rolled back                    |
| Pending/Rejected/Blocked agency     | Returns 403 (policy prevents dissolution)  |
| Owner also a member of own agency   | Owner membership preserved (not kicked)    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                 POLICY               DATABASE/CACHE/QUEUE
   │                       │                       │                    │                      │                        │
   │  DELETE /user/agency  │                       │                    │                      │                        │
   │──────────────────────▶│                       │                    │                      │                        │
   │                       │                       │                    │                      │                        │
   │                       │ 1. auth:sanctum       │                    │                      │                        │
   │                       │──────────────────────▶│                    │                      │                        │
   │                       │                       │                    │                      │                        │
   │                       │                       │ 2. Get user        │                      │                        │
   │                       │                       │────────────────────────────────────────────────────────────────────▶│
   │                       │                       │ User               │                      │                        │
   │                       │                       │◀────────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │ 3. Get ownedAgency │                      │                        │
   │                       │                       │────────────────────────────────────────────────────────────────────▶│
   │                       │                       │ Agency             │                      │                        │
   │                       │                       │◀────────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │ 4. authorize('dissolve', $agency)        │                        │
   │                       │                       │──────────────────────────────────────────▶│                        │
   │                       │                       │                    │                      │ 5. Check isApproved()  │
   │                       │                       │                    │                      │ 6. Check isOwnedBy()   │
   │                       │                       │◀──────────────────────────────────────────│                        │
   │                       │                       │                    │                      │                        │
   │                       │                       │ 7. execute($agency, $user)               │                        │
   │                       │                       │───────────────────▶│                      │                        │
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 8. Begin transaction│                        │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 9. Get memberUserIds│                        │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 10. Update agency → DISSOLVED                │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 11. Kick all members │                        │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 12. Reset member resellers                   │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 13. Reset owner reseller (if applicable)    │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 14. Commit transaction                       │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 15. Emit MSAB events │                        │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │                      │      [QUEUE DISPATCH]  │
   │                       │                       │                    │                      │                        │
   │                       │                       │                    │ 16. Flush agencies cache                     │
   │                       │                       │                    │─────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────│
   │                       │                       │                    │                      │                        │
   │                       │                       │◀──────────────────│ ActionResult::success│                        │
   │                       │◀──────────────────────│                    │                      │                        │
   │◀──────────────────────│                       │                    │                      │                        │
   │                       │                       │                    │                      │                        │
   │  200 OK + JSON        │                       │                    │                      │                        │
   │                       │                       │                    │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                          | Location                                               |
| --------------------------------- | ------------------------------------------------------ |
| Pre-dissolve validation           | `DissolveAgencyAction::execute()` (before transaction) |
| Post-dissolve cleanup             | `DissolveAgencyAction::execute()` (after cache flush)  |
| Additional notifications          | `DissolveAgencyAction::execute()` (after MSAB emit)    |
| New authorization rules           | `AgencyPolicy::dissolve()`                             |
| Dissolve confirmation requirement | Create new `DissolveAgencyRequest` class               |
| Audit logging                     | Add listener for agency model events                   |

### 📝 Field Modification Guide

#### ➕ ADDING DISSOLVE CONFIRMATION

If requiring user confirmation (e.g., "type agency name to confirm"):

| Step  | File                               | What to Change                     |
| ----- | ---------------------------------- | ---------------------------------- |
| **1** | Create `DissolveAgencyRequest.php` | Add `confirmation` validation rule |
| **2** | `AgencyMembershipController.php`   | Type-hint `DissolveAgencyRequest`  |
| **3** | `DissolveAgencyAction.php`         | Accept and validate confirmation   |

#### ➖ REMOVING COIN RESELLER RESET

To keep member reseller assignments after dissolution:

| Step  | File                       | What to Change                          |
| ----- | -------------------------- | --------------------------------------- |
| **1** | `DissolveAgencyAction.php` | Remove steps 6-7 (reseller reset logic) |

### 🔗 Field Flow Dependency Chain

```
DELETE Request
       │
       ▼
┌──────────────────┐
│ User.ownedAgency │ ─────────────── Agency exists check
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ AgencyPolicy     │ ─────────────── Authorization check
│   ::dissolve()   │
└────────┬─────────┘
         │
         ▼
┌────────────────────────┐
│ DissolveAgencyAction   │
│   │                    │
│   ├─ agency.status     │ → AgencyStatus::DISSOLVED
│   ├─ agency.dissolved_at│ → now()
│   ├─ members[].status  │ → AgencyMemberStatus::KICKED
│   ├─ members[].left_at │ → now()
│   ├─ members[].leave_reason│ → "Agency dissolved"
│   ├─ members[].removed_by │ → $actor->id
│   ├─ users[].default_reseller_id │ → null
│   └─ owner.default_reseller_id  │ → null (if applicable)
└────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding Custom Dissolution Metadata

- [ ] Update `agencies` migration (add `dissolution_metadata` JSON column)
- [ ] Update `Agency` model `$fillable`
- [ ] Update `DissolveAgencyAction` to populate metadata
- [ ] Update `AgencyResource` if exposed in API

### ⚠️ What Should NOT Be Modified Casually

| Component                             | Reason                                          |
| ------------------------------------- | ----------------------------------------------- |
| `DB::transaction()` wrapper           | Ensures atomicity of all dissolution operations |
| Cache flush logic                     | Critical for consistency after agency removal   |
| Member `status` → `KICKED` assignment | Affects downstream member queries               |
| Owner exclusion in member kick        | Owner should not be kicked from own agency      |
| `dissolved_at` timestamp              | Used for historical tracking and reporting      |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                        |
| ----------------------------------- | ------------------------------------------------- |
| Forgetting to flush cache           | Always flush `agencies` tags after dissolution    |
| Not handling empty member list      | Action already checks `count($memberUserIds) > 0` |
| Blocking during MSAB emission       | Events are queued, not synchronous                |
| Modifying agency before transaction | All updates must be inside `DB::transaction()`    |
| Assuming owner has membership       | Owner may not have `agency_members` record        |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:63                              ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyMembershipController.php                    ← Controller
app/Actions/Agency/
  └── DissolveAgencyAction.php                          ← Business logic
app/Policies/Agency/
  └── AgencyPolicy.php                                  ← Authorization
app/Services/Gift/
  └── MSABEventService.php                              ← Real-time events
app/Models/Agency/
  ├── Agency.php                                        ← Agency model
  └── AgencyMember.php                                  ← Membership model
app/Models/User/
  └── User.php                                          ← User model
app/Enums/Agency/
  ├── AgencyStatus.php                                  ← Agency status enum
  └── AgencyMemberStatus.php                            ← Member status enum
app/Actions/
  └── ActionResult.php                                  ← Result pattern
app/Http/Utils/
  └── ApiResponse.php                                   ← Response utility
```

---

## Document Metadata

| Property            | Value                        |
| ------------------- | ---------------------------- |
| **Endpoint**        | `DELETE /api/v1/user/agency` |
| **Domain**          | User / Agency Membership     |
| **Author**          | System Documentation         |
| **Created**         | 2026-02-03                   |
| **Laravel Version** | 12.x                         |
| **PHP Version**     | 8.4                          |
