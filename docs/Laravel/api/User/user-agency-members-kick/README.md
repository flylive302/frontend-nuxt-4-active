# DELETE /api/v1/user/agency/members/{member}

> **Domain**: User Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

This endpoint allows agency owners or admins to kick (remove) a member from their agency. The kicked member is notified via real-time event and their default coin reseller is reset.

### Responsibilities

- Authorize the kick action via policy
- Validate optional reason input
- Update member status to KICKED
- Reset kicked member's default coin reseller
- Emit real-time notification to kicked member
- Return success response

### What It Owns

| Owned                | Description                                        |
| -------------------- | -------------------------------------------------- |
| Member status update | Updates `agency_members` record to KICKED status   |
| Coin reseller reset  | Resets kicked user's `default_reseller_id` to null |
| Kick notification    | Emits MSAB event notifying the kicked member       |

### External Dependencies

| Dependency      | Type           | Purpose                                 |
| --------------- | -------------- | --------------------------------------- |
| MySQL           | Database       | Store member status changes             |
| MSAB/Centrifugo | Infrastructure | Real-time notification to kicked member |
| Laravel Sanctum | Package        | API authentication                      |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/user/agency/members/{member}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key | Config           |
| ------- | --- | ---------------- |
| None    | N/A | No rate limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type  | Required | Description                    |
| --------- | ----- | -------- | ------------------------------ |
| `member`  | `int` | ✅       | ID of the AgencyMember to kick |

### Request Body Schema

```json
{
  "reason": "string|null" // Optional, max 500 characters
}
```

#### Field Details

| Field    | Type     | Constraints       | Example                  |
| -------- | -------- | ----------------- | ------------------------ |
| `reason` | `string` | Optional, max 500 | `"Inactive for 30 days"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Member kicked successfully.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T18:10:35.000000Z",
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

#### ❌ Validation/Business Error (422)

```json
{
  "status": "error",
  "message": "This member is not active.",
  "data": null,
  "errors": {
    "member_id": ["Member is not active."]
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Agency\\AgencyMember] {id}",
  "data": null,
  "errors": {}
}
```

### HTTP Status Codes

| Code  | Condition                                |
| ----- | ---------------------------------------- |
| `200` | Member kicked successfully               |
| `401` | Unauthenticated                          |
| `403` | User not authorized to kick this member  |
| `404` | Member not found                         |
| `422` | Member not active or is the agency owner |
| `500` | Database transaction failure             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/user/agency/members/{member}              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:119-120                                       │
│ Route: Route::delete('/{member}', [AgencyMemberController::class, 'kick'])  │
│        ->name('user.agency.members.kick');                                  │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Sanctum token                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel automatically resolves {member} to AgencyMember model               │
│                                                                             │
│ If not found: throws ModelNotFoundException → 404 response                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMemberController.php:30-54   │
│ Method: kick(Request $request, AgencyMember $member, KickMemberAction ...)  │
│                                                                             │
│ STEP 1: Authorization via Policy                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('kick', $member);                                      │ │
│ │                                                                         │ │
│ │ → Calls AgencyMemberPolicy::kick()                                      │ │
│ │ → Checks if user can kick this member                                   │ │
│ │ → Throws AuthorizationException on failure (403)                        │ │
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
│ STEP 3: Validate Input                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validate([                                       │ │
│ │     'reason' => ['nullable', 'string', 'max:500'],                      │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Execute Action                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($member, $user, $validated['reason'] ?? ...) │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Handle Result and Return Response                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error($result->getMessage(), ...errors, 422);   │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(null, $result->getMessage());               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyMemberPolicy.php:41-56                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function kick(User $user, AgencyMember $member): bool            │ │
│ │ {                                                                       │ │
│ │     // Officials (Super Admin/Admin) can kick anyone except owner       │ │
│ │     if ($this->isOfficial($user)) {                                     │ │
│ │         return !$member->isOwner();                                     │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // Get actor's membership in the agency                             │ │
│ │     $actorMember = $member->agency->getMember($user);                   │ │
│ │     if ($actorMember === null) return false;                            │ │
│ │                                                                         │ │
│ │     return $member->canBeKickedBy($actorMember);                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Kick Hierarchy Logic (in AgencyMember::canBeKickedBy):                      │
│   • Owner can kick anyone except themselves                                 │
│   • Admin can only kick regular members (not owner, not other admins)       │
│   • Regular members cannot kick anyone                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION LAYER EXECUTION                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/KickMemberAction.php:26-77                         │
│                                                                             │
│ STEP 1: Pre-checks                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$member->isActive()) {                                             │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This member is not active.',                          │ │
│ │         errors: ['member_id' => ['Member is not active.']],             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ if ($member->isOwner()) {                                               │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'The agency owner cannot be kicked.',                  │ │
│ │         errors: ['member_id' => ['Cannot kick agency owner.']],         │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Database Transaction                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($member, $actor, $reason) {     │ │
│ │     // Update member status                                             │ │
│ │     $member->update([                                                   │ │
│ │         'status' => AgencyMemberStatus::KICKED,                         │ │
│ │         'removed_by' => $actor->id,                                     │ │
│ │         'left_at' => now(),                                             │ │
│ │         'leave_reason' => $reason ?? 'Kicked by agency management',     │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     // Reset user's coin reseller                                       │ │
│ │     $member->user->update(['default_reseller_id' => null]);             │ │
│ │                                                                         │ │
│ │     // Refresh and load relationships                                   │ │
│ │     $member->refresh();                                                 │ │
│ │     $member->load(['agency', 'user', 'remover']);                       │ │
│ │                                                                         │ │
│ │     // Emit MSAB event                                                  │ │
│ │     $this->msabEventService->emitAgencyMemberKicked(...);               │ │
│ │                                                                         │ │
│ │     return ActionResult::success(data: $member, message: '...');        │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: MSABEventService (Event Emitter)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php:266-277                    │ │
│ │ Responsibility: Emit real-time notification to kicked member            │ │
│ │ Reusable: YES (used by multiple agency actions)                         │ │
│ │ Why It Exists: Centralized MSAB/Centrifugo event emission               │ │
│ │                                                                         │ │
│ │ Emits Event: 'agency.member_kicked' with payload:                       │ │
│ │   • agency_id, agency_name, reason                                      │ │
│ │   • Sent to user's personal channel                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Wrapper)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action result with success/failure states  │ │
│ │ Reusable: YES (used by all action classes)                              │ │
│ │ Why It Exists: Clean separation of action logic from HTTP responses     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Create successful result                                │ │
│ │   • failure() → Create failure result with errors                       │ │
│ │   • isSuccess() → Check result status                                   │ │
│ │   • getErrors() → Get error details                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Builder)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response builder                      │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent API response format                           │ │
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
│ 1. UPDATE: Agency member status                                             │
│    Query: UPDATE agency_members SET status='kicked', removed_by=?,          │
│           left_at=?, leave_reason=? WHERE id=?                              │
│    Source: KickMemberAction::execute()                                      │
│                                                                             │
│ 2. UPDATE: User's default coin reseller                                     │
│    Query: UPDATE users SET default_reseller_id=NULL WHERE id=?              │
│    Source: KickMemberAction::execute()                                      │
│                                                                             │
│ 3. SELECT: Refresh member with relationships                                │
│    Query: SELECT * FROM agency_members WHERE id=?                           │
│           + eager load agency, user, remover                                │
│    Source: KickMemberAction::execute()                                      │
│                                                                             │
│ EXTERNAL SERVICE CALLS:                                                     │
│                                                                             │
│ 1. EMIT: MSAB Event 'agency.member_kicked'                                  │
│    Target: User's personal Centrifugo channel                               │
│    Payload: {agency_id, agency_name, reason}                                │
│    Source: MSABEventService::emitAgencyMemberKicked()                       │
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
│ │ ApiResponse::success(null, 'Member kicked successfully.');              │ │
│ │                                                                         │ │
│ │ Returns: {                                                              │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Member kicked successfully.",                             │ │
│ │   "data": null,                                                         │ │
│ │   "meta": { "timestamp": "...", "correlation_id": "..." }               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Error Response:                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::error($result->getMessage(), $result->getErrors(), 422);   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200/422/403/404 + JSON Body                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                         | Used By Endpoints                | Reusable | Reasoning                                 |
| ---------------------------- | -------------------------------- | -------- | ----------------------------------------- |
| `AgencyMemberController.php` | `members/income`, `members/kick` | ⭕       | Controller is agency-specific             |
| `KickMemberAction.php`       | This endpoint only               | ❌       | Single-purpose action for kicking members |
| `AgencyMemberPolicy.php`     | Multiple member actions          | ✅       | Shared across member management endpoints |
| `AgencyMember.php`           | All agency member endpoints      | ✅       | Core model for agency membership          |
| `MSABEventService.php`       | Many agency/gift endpoints       | ✅       | Centralized real-time event emission      |
| `ActionResult.php`           | All action classes               | ✅       | Standardized action result wrapper        |
| `ApiResponse.php`            | All API endpoints                | ✅       | Standardized API response builder         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error        | Source              | Condition                     |
| ------------ | ------------------- | ----------------------------- |
| `reason.max` | Controller validate | Reason exceeds 500 characters |

### Business Logic Errors (422)

| Error                           | Source             | Condition                         |
| ------------------------------- | ------------------ | --------------------------------- |
| "This member is not active."    | `KickMemberAction` | Member status is not ACTIVE       |
| "Agency owner cannot be kicked" | `KickMemberAction` | Target member is the agency owner |

### Authorization Errors (403)

| Error                          | Source               | Condition                          |
| ------------------------------ | -------------------- | ---------------------------------- |
| "This action is unauthorized." | `AgencyMemberPolicy` | User not authorized to kick member |

### System Errors (500)

| Error                    | Source             | Condition                         |
| ------------------------ | ------------------ | --------------------------------- |
| "Failed to kick member." | `KickMemberAction` | Database transaction failure      |
| Exception message        | `KickMemberAction` | Unexpected error during execution |

### Edge Cases

| Case                               | Behavior                                    |
| ---------------------------------- | ------------------------------------------- |
| Kicking already kicked member      | Returns 422 "Member is not active"          |
| Admin trying to kick another admin | Returns 403 unauthorized                    |
| Admin trying to kick owner         | Returns 403 unauthorized                    |
| Owner kicking themselves           | Returns 422 "Agency owner cannot be kicked" |
| Invalid member ID                  | Returns 404 not found                       |
| Member from different agency       | Returns 403 unauthorized                    |
| No reason provided                 | Uses default "Kicked by agency management"  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER            ACTION                 POLICY                 DATABASE              MSAB
   │                     │                       │                    │                      │                       │                    │
   │  DELETE /members/1  │                       │                    │                      │                       │                    │
   │────────────────────▶│                       │                    │                      │                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │ 1. auth:sanctum       │                    │                      │                       │                    │
   │                     │──────────────────────▶│                    │                      │                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │ 2. authorize()     │                      │                       │                    │
   │                     │                       │───────────────────────────────────────────▶│                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │                    │                      │ 3. check membership   │                    │
   │                     │                       │                    │                      │──────────────────────▶│                    │
   │                     │                       │                    │                      │◀──────────────────────│                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │◀───────────────────────────────────────────│ (authorized)          │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │ 4. validate input  │                      │                       │                    │
   │                     │                       │─────────┐          │                      │                       │                    │
   │                     │                       │◀────────┘          │                      │                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │ 5. execute()       │                      │                       │                    │
   │                     │                       │───────────────────▶│                      │                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │                    │ 6. BEGIN TRANSACTION │                       │                    │
   │                     │                       │                    │─────────────────────────────────────────────▶│                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │                    │ 7. UPDATE member     │                       │                    │
   │                     │                       │                    │─────────────────────────────────────────────▶│                    │
   │                     │                       │                    │◀─────────────────────────────────────────────│                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │                    │ 8. UPDATE user       │                       │                    │
   │                     │                       │                    │─────────────────────────────────────────────▶│                    │
   │                     │                       │                    │◀─────────────────────────────────────────────│                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │                    │ 9. COMMIT            │                       │                    │
   │                     │                       │                    │─────────────────────────────────────────────▶│                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │                    │ 10. emit event       │                       │                    │
   │                     │                       │                    │────────────────────────────────────────────────────────────────────▶│
   │                     │                       │                    │                      │                       │                    │
   │                     │                       │◀───────────────────│ (ActionResult)       │                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │                     │◀──────────────────────│                    │                      │                       │                    │
   │◀────────────────────│                       │                    │                      │                       │                    │
   │                     │                       │                    │                      │                       │                    │
   │  200 + JSON         │                       │                    │                      │                       │                    │
   │                     │                       │                    │                      │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location                                         |
| ---------------------------- | ------------------------------------------------ |
| New validation rules         | `AgencyMemberController::kick()` validate array  |
| New kick authorization logic | `AgencyMemberPolicy::kick()`                     |
| New side effects on kick     | `KickMemberAction::execute()` within transaction |
| New notification channels    | `MSABEventService::emitAgencyMemberKicked()`     |
| New pre-kick checks          | `KickMemberAction::execute()` before transaction |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO KICK REQUEST

| Step  | File                                                  | What to Change                      |
| ----- | ----------------------------------------------------- | ----------------------------------- |
| **1** | `app/Http/Controllers/.../AgencyMemberController.php` | Add to `$request->validate()` array |
| **2** | `app/Actions/Agency/KickMemberAction.php`             | Add parameter to `execute()` method |
| **3** | `app/Models/Agency/AgencyMember.php`                  | Add to `$fillable` if stored        |
| **4** | Database Migration                                    | Add column if needed                |

#### ➖ REMOVING A FIELD

| Step  | File                                                  | What to Change             |
| ----- | ----------------------------------------------------- | -------------------------- |
| **1** | `app/Http/Controllers/.../AgencyMemberController.php` | Remove from validate array |
| **2** | `app/Actions/Agency/KickMemberAction.php`             | Remove parameter and usage |

### 🔗 Field Flow Dependency Chain

```
Request Input (reason)
        │
        ▼
┌───────────────────┐
│   Controller      │ → Validates input
│   validate()      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ KickMemberAction  │ → Uses reason in update
│   execute()       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  AgencyMember     │ → Stores leave_reason
│   update()        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  MSABEventService │ → Sends reason in event
│  emitAgency...    │
└───────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                              |
| --------------------------- | --------------------------------------------------- |
| `DB::transaction()` block   | Ensures atomicity of member update and user update  |
| Policy authorization        | Security-critical; changes affect who can kick      |
| `AgencyMemberStatus` enum   | Used across multiple endpoints and queries          |
| MSAB event emission         | Frontend depends on specific event name and payload |
| `default_reseller_id` reset | Business requirement for kicked members             |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                             |
| --------------------------------- | ------------------------------------------------------ |
| Forgetting to reset coin reseller | Always included in transaction                         |
| Not emitting notification         | MSAB event is part of action, not controller           |
| Allowing owner to be kicked       | Double-checked in both policy and action               |
| Breaking role hierarchy           | canBeKickedBy() enforces proper hierarchy              |
| Transaction not rolling back      | Use DB::transaction() wrapper, not manual begin/commit |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 119-120)

app/Http/Controllers/Api/V1/Agency/
  └── AgencyMemberController.php                           ← Controller (kick method)

app/Actions/Agency/
  └── KickMemberAction.php                                 ← Business logic action

app/Policies/Agency/
  └── AgencyMemberPolicy.php                               ← Authorization policy

app/Models/Agency/
  └── AgencyMember.php                                     ← Member model with canBeKickedBy()

app/Services/Gift/
  └── MSABEventService.php                                 ← Real-time event emission

app/Actions/
  └── ActionResult.php                                     ← Action result wrapper

app/Http/Utils/
  └── ApiResponse.php                                      ← API response builder

app/Enums/Agency/
  ├── AgencyMemberStatus.php                               ← Member status enum (KICKED)
  └── AgencyMemberRole.php                                 ← Member role enum (OWNER, ADMIN, MEMBER)
```

---

## Document Metadata

| Property            | Value                                         |
| ------------------- | --------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/user/agency/members/{member}` |
| **Domain**          | User Agency Management                        |
| **Author**          | System Documentation                          |
| **Created**         | 2026-02-03                                    |
| **Laravel Version** | 12.x                                          |
| **PHP Version**     | 8.4                                           |
