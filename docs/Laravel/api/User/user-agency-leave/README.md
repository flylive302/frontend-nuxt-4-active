# POST /api/v1/user/agency/leave

> **Domain**: User / Agency Membership  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

The Leave Agency endpoint allows authenticated agency members to voluntarily leave their current agency, updating their membership status and resetting their coin reseller assignment.

### Responsibilities

- Validate the user is an active member of an agency
- Ensure the user is not an agency owner (owners must dissolve instead)
- Record the optional leave reason
- Update membership status to `LEFT`
- Reset the user's default coin reseller to null

### What It Owns

| Owned                    | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| Membership status update | Changes `AgencyMember.status` from `active` to `left`        |
| Leave timestamp          | Records `left_at` timestamp on the membership record         |
| Leave reason             | Stores optional `leave_reason` on membership                 |
| Reseller reset           | Clears `default_reseller_id` on the user record              |

### External Dependencies

| Dependency | Type           | Purpose                            |
| ---------- | -------------- | ---------------------------------- |
| MySQL      | Database       | Persists membership status changes |
| Redis      | Infrastructure | Session/Token storage via Sanctum  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/agency/leave
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum (`auth:sanctum` middleware)

### Rate Limiting

| Limiter | Key             | Config          |
| ------- | --------------- | --------------- |
| None    | N/A             | No rate limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "reason": "string|null"  // Optional, max 500 characters
}
```

#### Field Details

| Field    | Type     | Constraints          | Example                        |
| -------- | -------- | -------------------- | ------------------------------ |
| `reason` | `string` | Optional, max 500    | `"Moving to another agency"`   |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "You have left the agency.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T16:45:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "reason": ["Leave reason cannot exceed 500 characters."]
  },
  "meta": {
    "timestamp": "2026-02-03T16:45:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
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
    "timestamp": "2026-02-03T16:45:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not a Member Error (404)

```json
{
  "status": "error",
  "message": "You are not a member of any agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T16:45:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "Agency owners cannot leave. You must dissolve the agency instead.",
  "data": null,
  "errors": {
    "member_id": ["Owners must dissolve the agency to leave."]
  },
  "meta": {
    "timestamp": "2026-02-03T16:45:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | Successfully left the agency                  |
| `401` | User not authenticated                        |
| `404` | User is not a member of any agency            |
| `422` | Validation failed or business rule violated   |
| `500` | Database transaction failure                  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/user/agency/leave                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:60                                            │
│ Route: Route::post('/leave', [AgencyMembershipController::class, 'leave'])  │
│        ->name('user.agency.leave');                                         │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads User from token           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Agency/LeaveAgencyRequest.php                │
│                                                                             │
│ Authorization Check (line 17-20):                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules (line 27-31):                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'reason' => ['nullable', 'string', 'max:500'],                  │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Error Messages (line 39-43):                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function messages(): array                                       │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'reason.max' => 'Leave reason cannot exceed 500 characters.',   │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php     │
│ Method: leave(LeaveAgencyRequest $request, LeaveAgencyAction $action)       │
│         (lines 65-91)                                                       │
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
│ STEP 2: Retrieve user's active agency membership                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membership = $user->activeAgencyMembership()->first();                 │ │
│ │                                                                         │ │
│ │ if ($membership === null) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         'You are not a member of any agency.', [], 404                  │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get validated data and execute action                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │                                                                         │ │
│ │ $result = $action->execute($membership, $validated['reason'] ?? null);  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return appropriate response                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage() ?? 'An error occurred',                   │ │
│ │         $result->getErrors(), 422                                       │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(null, $result->getMessage());               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW (Action)                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/LeaveAgencyAction.php                              │
│ Method: execute(AgencyMember $member, ?string $reason = null)               │
│         (lines 21-62)                                                       │
│                                                                             │
│ STEP 1: Validate member is active                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $member->isActive()) {                                            │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You are not an active member of this agency.',        │ │
│ │         errors: ['member_id' => ['Not an active member.']],             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate member is not owner                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($member->isOwner()) {                                               │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'Agency owners cannot leave. You must dissolve...',    │ │
│ │         errors: ['member_id' => ['Owners must dissolve...']],           │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute database transaction                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($member, $reason) {             │ │
│ │     $member->update([                                                   │ │
│ │         'status' => AgencyMemberStatus::LEFT,                           │ │
│ │         'left_at' => now(),                                             │ │
│ │         'leave_reason' => $reason,                                      │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     // Reset user's coin reseller                                       │ │
│ │     $member->user->update(['default_reseller_id' => null]);             │ │
│ │                                                                         │ │
│ │     $member->refresh();                                                 │ │
│ │     $member->load(['agency', 'user']);                                  │ │
│ │                                                                         │ │
│ │     return ActionResult::success(                                       │ │
│ │         data: $member,                                                  │ │
│ │         message: 'You have left the agency.',                           │ │
│ │         meta: [                                                         │ │
│ │             'member_id' => $member->id,                                 │ │
│ │             'agency_id' => $member->agency_id,                          │ │
│ │         ],                                                              │ │
│ │     );                                                                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Exception handling                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ } catch (\Throwable $e) {                                               │ │
│ │     return ActionResult::fromException($e, 'Failed to leave agency.');  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyMember (Model)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyMember.php                                │ │
│ │ Responsibility: Represents user's membership in an agency              │ │
│ │ Reusable: YES (used by all agency membership endpoints)                │ │
│ │ Why It Exists: Core domain model for agency memberships                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isActive() → Checks if status === AgencyMemberStatus::ACTIVE       │ │
│ │   • isOwner() → Checks if role === AgencyMemberRole::OWNER             │ │
│ │   • user() → BelongsTo relationship to User model                      │ │
│ │   • agency() → BelongsTo relationship to Agency model                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMemberStatus (Enum)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyMemberStatus.php                           │ │
│ │ Responsibility: Defines possible membership statuses                   │ │
│ │ Reusable: YES (used across all agency-related functionality)           │ │
│ │ Why It Exists: Type-safe status representation                         │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • ACTIVE = 'active'                                                   │ │
│ │   • SUSPENDED = 'suspended'                                             │ │
│ │   • KICKED = 'kicked'                                                   │ │
│ │   • LEFT = 'left'                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (DTO)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action result container                   │ │
│ │ Reusable: YES (used by all Action classes)                             │ │
│ │ Why It Exists: Consistent success/failure handling pattern             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Creates successful result                              │ │
│ │   • failure() → Creates failure result with errors                     │ │
│ │   • fromException() → Creates failure from exception                   │ │
│ │   • isSuccess() → Boolean check for success                            │ │
│ │   • getMessage() → Get result message                                  │ │
│ │   • getErrors() → Get error array                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                  │ │
│ │ Reusable: YES (used by all API controllers)                            │ │
│ │ Why It Exists: Consistent API response structure                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 OK response with data                              │ │
│ │   • error() → Error response with status code                          │ │
│ │   • getCorrelationId() → Request tracking ID                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: Core user model                                        │ │
│ │ Reusable: YES (used everywhere)                                        │ │
│ │ Why It Exists: Core domain model for users                             │ │
│ │                                                                         │ │
│ │ Key Methods (relevant to this endpoint):                                │ │
│ │   • activeAgencyMembership() → HasOne to AgencyMember (active only)    │ │
│ │   • update(['default_reseller_id' => null]) → Clears reseller          │ │
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
│ 1. [SELECT] Get active agency membership                                    │
│    Query: SELECT * FROM agency_members WHERE user_id = ? AND status = ?     │
│    Source: User::activeAgencyMembership()                                   │
│                                                                             │
│ 2. [UPDATE] Update membership status (within transaction)                   │
│    Query: UPDATE agency_members SET status = ?, left_at = ?,                │
│           leave_reason = ?, updated_at = ? WHERE id = ?                     │
│    Source: LeaveAgencyAction::execute()                                     │
│                                                                             │
│ 3. [UPDATE] Reset user's default reseller (within transaction)              │
│    Query: UPDATE users SET default_reseller_id = NULL,                      │
│           updated_at = ? WHERE id = ?                                       │
│    Source: LeaveAgencyAction::execute()                                     │
│                                                                             │
│ 4. [SELECT] Refresh member with relationships                               │
│    Query: SELECT * FROM agency_members WHERE id = ?                         │
│           + JOIN agency + JOIN user                                         │
│    Source: $member->refresh()->load(['agency', 'user'])                     │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ • None directly in this endpoint                                            │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ • None directly in this endpoint                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ The response is constructed using ApiResponse::success():                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, $result->getMessage());               │ │
│ │                                                                         │ │
│ │ // Produces:                                                            │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "You have left the agency.",                               │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "2026-02-03T16:45:00.000000Z",                         │ │
│ │     "correlation_id": "uuid"                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Although the Action returns the updated AgencyMember in its result,   │
│ the controller intentionally returns null as the data since the membership  │
│ is no longer active and the client doesn't need the updated record.         │
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

| File                                    | Used By Endpoints                              | Reusable | Reasoning                                         |
| --------------------------------------- | ---------------------------------------------- | -------- | ------------------------------------------------- |
| `LeaveAgencyRequest.php`                | Only `user.agency.leave`                       | ❌       | Endpoint-specific validation                      |
| `LeaveAgencyAction.php`                 | Only `user.agency.leave`                       | ❌       | Endpoint-specific business logic                  |
| `AgencyMembershipController.php`        | `show`, `leave`, `dissolve`, `changeCoinReseller` | ✅    | Controller for user's agency operations           |
| `AgencyMember.php`                      | All agency member endpoints                    | ✅       | Core domain model                                 |
| `AgencyMemberStatus.php`                | All agency endpoints                           | ✅       | Shared enum for member status                     |
| `AgencyMemberRole.php`                  | All agency endpoints                           | ✅       | Shared enum for member roles                      |
| `ActionResult.php`                      | All Action classes                             | ✅       | Standardized result pattern                       |
| `ApiResponse.php`                       | All API controllers                            | ✅       | Standardized response formatting                  |
| `User.php`                              | Entire application                             | ✅       | Core user model                                   |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error        | Source              | Condition                        |
| ------------ | ------------------- | -------------------------------- |
| `reason.max` | `LeaveAgencyRequest` | Reason exceeds 500 characters   |

### Business Logic Errors (422)

| Error                                                    | Source             | Condition                              |
| -------------------------------------------------------- | ------------------ | -------------------------------------- |
| "You are not an active member of this agency."           | `LeaveAgencyAction` | Member status is not ACTIVE           |
| "Agency owners cannot leave. You must dissolve..."       | `LeaveAgencyAction` | Member role is OWNER                  |

### Authentication Errors (401)

| Error             | Source                       | Condition                    |
| ----------------- | ---------------------------- | ---------------------------- |
| "Unauthenticated." | `AgencyMembershipController` | No authenticated user        |

### Not Found Errors (404)

| Error                                    | Source                       | Condition                          |
| ---------------------------------------- | ---------------------------- | ---------------------------------- |
| "You are not a member of any agency."    | `AgencyMembershipController` | User has no active membership      |

### System Errors (500)

| Error                  | Source             | Condition                          |
| ---------------------- | ------------------ | ---------------------------------- |
| "Failed to leave agency." | `LeaveAgencyAction` | Database transaction failure      |

### Edge Cases

| Case                                      | Behavior                                             |
| ----------------------------------------- | ---------------------------------------------------- |
| Empty request body                        | Accepted - reason is optional                        |
| User already left                         | 404 - no active membership found                     |
| User was kicked                           | 404 - no active membership found (status is KICKED)  |
| Agency owner tries to leave               | 422 - owners must dissolve                           |
| User with SUSPENDED status                | 422 - not an active member                           |
| Concurrent leave requests                 | Transaction ensures consistency                      |
| User has no default_reseller_id           | Works fine - sets null to null                       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                   DATABASE
   │                       │                       │                     │                        │
   │  POST /user/agency/   │                       │                     │                        │
   │  leave                │                       │                     │                        │
   │──────────────────────▶│                       │                     │                        │
   │                       │                       │                     │                        │
   │                       │ 1. auth:sanctum       │                     │                        │
   │                       │    (validate token)   │                     │                        │
   │                       │───────────────────────│                     │                        │
   │                       │                       │                     │                        │
   │                       │ 2. LeaveAgencyRequest │                     │                        │
   │                       │    (validate reason)  │                     │                        │
   │                       │──────────────────────▶│                     │                        │
   │                       │                       │                     │                        │
   │                       │                       │ 3. Get user         │                        │
   │                       │                       │    from request     │                        │
   │                       │                       │                     │                        │
   │                       │                       │ 4. Get active       │                        │
   │                       │                       │    membership       │ SELECT agency_members  │
   │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                     │                        │
   │                       │                       │ 5. Execute action   │                        │
   │                       │                       │────────────────────▶│                        │
   │                       │                       │                     │                        │
   │                       │                       │                     │ 6. Check isActive()    │
   │                       │                       │                     │                        │
   │                       │                       │                     │ 7. Check isOwner()     │
   │                       │                       │                     │                        │
   │                       │                       │                     │ 8. BEGIN TRANSACTION   │
   │                       │                       │                     │───────────────────────▶│
   │                       │                       │                     │                        │
   │                       │                       │                     │ 9. UPDATE agency_      │
   │                       │                       │                     │    members             │
   │                       │                       │                     │───────────────────────▶│
   │                       │                       │                     │◀───────────────────────│
   │                       │                       │                     │                        │
   │                       │                       │                     │ 10. UPDATE users       │
   │                       │                       │                     │     (reset reseller)   │
   │                       │                       │                     │───────────────────────▶│
   │                       │                       │                     │◀───────────────────────│
   │                       │                       │                     │                        │
   │                       │                       │                     │ 11. COMMIT             │
   │                       │                       │                     │───────────────────────▶│
   │                       │                       │                     │                        │
   │                       │                       │                     │ 12. Refresh + load     │
   │                       │                       │                     │───────────────────────▶│
   │                       │                       │                     │◀───────────────────────│
   │                       │                       │                     │                        │
   │                       │                       │◀────────────────────│                        │
   │                       │                       │                     │                        │
   │                       │                       │ 13. Build response  │                        │
   │                       │                       │     ApiResponse::   │                        │
   │                       │                       │     success()       │                        │
   │                       │                       │                     │                        │
   │                       │◀──────────────────────│                     │                        │
   │◀──────────────────────│                       │                     │                        │
   │                       │                       │                     │                        │
   │  200 OK + JSON        │                       │                     │                        │
   │                       │                       │                     │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location(s)                                                   |
| ------------------------------- | ------------------------------------------------------------- |
| New validation rule             | `LeaveAgencyRequest::rules()`                                 |
| New business validation         | `LeaveAgencyAction::execute()` before transaction             |
| Notify agency owner on leave    | `LeaveAgencyAction::execute()` inside transaction             |
| Track leave statistics          | `LeaveAgencyAction::execute()` inside transaction             |
| Custom error message            | `LeaveAgencyRequest::messages()`                              |
| Dispatch event on leave         | `LeaveAgencyAction::execute()` after commit                   |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUEST FIELD (e.g., `feedback_rating`)

| Step  | File                                                    | What to Change                                |
| ----- | ------------------------------------------------------- | --------------------------------------------- |
| **1** | **Database Migration**                                  | Add `feedback_rating` column to `agency_members` |
| **2** | `app/Models/Agency/AgencyMember.php`                    | Add to `$fillable` array                      |
| **3** | `app/Http/Requests/Api/V1/Agency/LeaveAgencyRequest.php` | Add validation rule for `feedback_rating`    |
| **4** | `app/Actions/Agency/LeaveAgencyAction.php`              | Include in `$member->update()` call           |

#### ➖ REMOVING THE `reason` FIELD

| Step  | File                                                    | What to Change                                |
| ----- | ------------------------------------------------------- | --------------------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Agency/LeaveAgencyRequest.php` | Remove `reason` from `rules()` and `messages()` |
| **2** | `app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php` | Remove `$validated['reason']` usage |
| **3** | `app/Actions/Agency/LeaveAgencyAction.php`              | Remove `$reason` parameter and `leave_reason` from update |
| **4** | **Database Migration**                                  | Drop `leave_reason` column (if safe)          |

### 🔗 Field Flow Dependency Chain

```
Request                    Controller                Action                     Database
   │                          │                         │                          │
   │  reason ─────────────────│─────reason─────────────▶│──────leave_reason───────▶│
   │                          │                         │                          │
   │                          │  $user ────────────────▶│                          │
   │                          │                         │                          │
   │                          │  $membership ──────────▶│  status ────────────────▶│
   │                          │                         │  left_at ───────────────▶│
   │                          │                         │                          │
   │                          │                         │  user.default_reseller ─▶│
```

### 📋 Field Modification Checklist

- [ ] Update validation in `LeaveAgencyRequest`
- [ ] Update `AgencyMember::$fillable` if adding DB field
- [ ] Update `LeaveAgencyAction::execute()` logic
- [ ] Create migration for new/removed columns
- [ ] Update this documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                                          |
| ----------------------------- | --------------------------------------------------------------- |
| `DB::transaction()` wrapper   | Ensures atomicity of membership update + reseller reset         |
| `isActive()` check            | Prevents leaving non-active memberships                         |
| `isOwner()` check             | Critical business rule - owners must dissolve                   |
| `default_reseller_id` reset   | Maintains data integrity when leaving agency                    |
| `ActionResult` pattern        | Consistent error handling across all actions                    |
| `ApiResponse` formatting      | API response consistency across entire application              |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                                      |
| ------------------------------------------ | --------------------------------------------------------------- |
| Forgetting transaction for multi-update    | Always wrap related updates in `DB::transaction()`              |
| Not resetting reseller on leave            | Current implementation handles this automatically               |
| Allowing owners to leave                   | `isOwner()` check prevents this - do not remove                 |
| Not validating active status               | `isActive()` check prevents double-leave attempts               |
| Returning member data after leave          | Controller intentionally returns null - member is inactive      |
| Missing reason length validation           | `max:500` rule in request prevents overflow                     |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 60)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyMembershipController.php                       ← Controller (lines 65-91)
app/Http/Requests/Api/V1/Agency/
  └── LeaveAgencyRequest.php                               ← Request validation
app/Actions/Agency/
  └── LeaveAgencyAction.php                                ← Business logic
app/Models/Agency/
  └── AgencyMember.php                                     ← Domain model
app/Models/User/
  └── User.php                                             ← User model (activeAgencyMembership)
app/Enums/Agency/
  ├── AgencyMemberStatus.php                               ← Status enum
  └── AgencyMemberRole.php                                 ← Role enum
app/Actions/
  └── ActionResult.php                                     ← Result container
app/Http/Utils/
  └── ApiResponse.php                                      ← Response formatter
```

---

## Document Metadata

| Property            | Value                           |
| ------------------- | ------------------------------- |
| **Endpoint**        | `POST /api/v1/user/agency/leave` |
| **Domain**          | User / Agency Membership        |
| **Author**          | System Documentation            |
| **Created**         | 2026-02-03                      |
| **Laravel Version** | 12.x                            |
| **PHP Version**     | 8.4                             |
