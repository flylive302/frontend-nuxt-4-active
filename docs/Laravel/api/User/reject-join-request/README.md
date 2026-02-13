# POST /api/v1/user/room/join-requests/{id}/reject

> **Domain**: User / Room Membership  
> **Type**: Protected Endpoint (Admin/Owner)  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

Rejects a pending join request, preventing the requesting user from joining the room. Only room owners or admins with manage permissions can reject join requests.

### Responsibilities

- Validate the join request exists and is pending
- Verify the rejector has permission to manage the room
- Update the request status to `rejected` with optional reason
- Record the reviewer and rejection timestamp

### What It Owns

| Owned                      | Description                                 |
| -------------------------- | ------------------------------------------- |
| Join Request Status Update | Changes status from `pending` to `rejected` |
| Rejection Reason Storage   | Stores optional rejection reason            |
| Reviewer Record            | Records who rejected and when               |

### External Dependencies

| Dependency       | Type           | Purpose                                 |
| ---------------- | -------------- | --------------------------------------- |
| Database (MySQL) | Infrastructure | Update join request status and reviewer |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/room/join-requests/{id}/reject
```

### Authentication

✅ **Required** - Bearer token via Sanctum. User must be room owner or admin.

### Rate Limiting

| Limiter  | Key       | Config               |
| -------- | --------- | -------------------- |
| Standard | `user:id` | Default API throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type  | Constraints       | Example | Description     |
| --------- | ----- | ----------------- | ------- | --------------- |
| `id`      | `int` | Required, numeric | `42`    | Join request ID |

### Request Body Schema

```json
{
  "reason": "string|null" // Optional, max 500 chars, rejection reason
}
```

#### Field Details

| Field    | Type     | Constraints             | Example                                         |
| -------- | -------- | ----------------------- | ----------------------------------------------- |
| `reason` | `string` | Optional, max 500 chars | `"Room is currently not accepting new members"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Request rejected",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T02:20:00.000000Z",
    "correlation_id": "uuid"
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
    "reason": [
      "The reason must be a string.",
      "The reason may not be greater than 500 characters."
    ]
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": []
}
```

#### ❌ Forbidden (403)

```json
{
  "status": "error",
  "message": "You do not have permission",
  "data": null,
  "errors": []
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "Request not found",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                             |
| ----- | ------------------------------------- |
| `200` | Request rejected successfully         |
| `401` | User not authenticated                |
| `403` | User lacks permission to manage room  |
| `404` | Join request not found or not pending |
| `422` | Validation failed on reason field     |
| `500` | Database or server error              |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│             POST /api/v1/user/room/join-requests/{id}/reject                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:52                                     │
│ Route: Route::post('/join-requests/{id}/reject',                            │
│            [RoomJoinRequestController::class, 'reject'])->whereNumber('id') │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token and loads user                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/RejectJoinRequestRequest.php            │
│                                                                             │
│ FormRequest validates the optional rejection reason.                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ class RejectJoinRequestRequest extends FormRequest                     │ │
│ │ {                                                                       │ │
│ │     public function authorize(): bool                                   │ │
│ │     {                                                                   │ │
│ │         return $this->user() !== null;                                  │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     public function rules(): array                                      │ │
│ │     {                                                                   │ │
│ │         return [                                                        │ │
│ │             'reason' => ['sometimes', 'nullable', 'string', 'max:500'], │ │
│ │         ];                                                              │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomJoinRequestController.php:147-166│
│ Method: reject(RejectJoinRequestRequest $request, int $id)                  │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find pending join request                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest = RoomJoinRequest::where('id', $id)->pending()->first();   │ │
│ │                                                                         │ │
│ │ if (! $joinRequest) {                                                   │ │
│ │     return ApiResponse::notFound('Request not found');                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check user has permission to manage room                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membership = $this->memberService->getMembershipForRoom(               │ │
│ │     $user->id,                                                          │ │
│ │     $joinRequest->room_id                                               │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ if (! $membership || ! $membership->canManageMembers()) {               │ │
│ │     return ApiResponse::forbidden('You do not have permission');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Reject the join request                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequest->reject($user->id, $request->validated('reason'));         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Request rejected');                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:44-55                         │
│ Method: getMembershipForRoom(int $userId, int $roomId): ?RoomMember         │
│                                                                             │
│ STEP 1: Query for active membership                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getMembershipForRoom(int $userId, int $roomId)          │ │
│ │ {                                                                       │ │
│ │     return RoomMember::where('user_id', $userId)                        │ │
│ │         ->where('room_id', $roomId)                                     │ │
│ │         ->where('status', RoomMemberStatus::ACTIVE)                     │ │
│ │         ->first();                                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Returns RoomMember model with role for permission check.                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomJoinRequest (Model)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomJoinRequest.php                               │ │
│ │ Responsibility: Join request data and status management                 │ │
│ │ Reusable: YES (used across join request endpoints)                      │ │
│ │ Why It Exists: Encapsulates join request state transitions              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • pending() → scope filtering for PENDING status                      │ │
│ │   • reject($reviewerId, $reason) → updates status with reason           │ │
│ │   • isPending() → bool                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Room membership data and role checking                  │ │
│ │ Reusable: YES (used across room membership endpoints)                   │ │
│ │ Why It Exists: Encapsulates member role and permission logic            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageMembers() → bool (owner or admin with permissions)         │ │
│ │   • isOwner() → bool                                                    │ │
│ │   • isAdmin() → bool                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Type-safe role values with permission methods           │ │
│ │ Reusable: YES (used across all room operations)                         │ │
│ │                                                                         │ │
│ │ Values: OWNER, ADMIN, MEMBER                                            │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageMembers() → bool (OWNER and ADMIN return true)             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomJoinRequestStatus (Enum)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomJoinRequestStatus.php                          │ │
│ │ Responsibility: Type-safe status values for join requests               │ │
│ │ Reusable: YES (used across all join request operations)                 │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberService (Service)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomMemberService.php                           │ │
│ │ Responsibility: Room member lifecycle management                        │ │
│ │ Reusable: YES (used by multiple endpoints)                              │ │
│ │ Why It Exists: Centralizes member operations with validation            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getMembershipForRoom($userId, $roomId) → ?RoomMember                │ │
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
│ 1. SELECT: Find pending join request                                        │
│    Query: SELECT * FROM room_join_requests WHERE id = ?                     │
│           AND status = 'pending' LIMIT 1                                    │
│    Source: RoomJoinRequest::where('id', $id)->pending()->first()            │
│                                                                             │
│ 2. SELECT: Get user's room membership                                       │
│    Query: SELECT * FROM room_members WHERE user_id = ? AND room_id = ?      │
│           AND status = 'active' LIMIT 1                                     │
│    Source: RoomMemberService::getMembershipForRoom()                        │
│                                                                             │
│ 3. UPDATE: Reject join request                                              │
│    Query: UPDATE room_join_requests SET status = 'rejected',                │
│           reviewed_by = ?, reviewed_at = ?, rejection_reason = ?            │
│           WHERE id = ?                                                      │
│    Source: RoomJoinRequest::reject()                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Controller returns simple success with null data:                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Request rejected');                  │ │
│ │                                                                         │ │
│ │ // Produces:                                                            │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Request rejected",                                        │ │
│ │   "data": null,                                                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "...",                                                 │ │
│ │     "correlation_id": "..."                                             │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                                  | Used By Endpoints                               | Reusable | Reasoning                                |
| ------------------------------------- | ----------------------------------------------- | -------- | ---------------------------------------- |
| `RejectJoinRequestRequest.php`        | This endpoint only                              | ❌       | Endpoint-specific validation             |
| `RoomJoinRequestController::reject()` | This endpoint only                              | ❌       | Endpoint-specific orchestration          |
| `RoomMemberService.php`               | Join, Leave, Kick, Role update, Approve, Reject | ✅       | Shared member lifecycle management       |
| `RoomJoinRequest.php`                 | Submit, Cancel, Approve, Reject, List           | ✅       | Model for all join request operations    |
| `RoomJoinRequestStatus.php`           | All join request operations                     | ✅       | Type-safe enum for status values         |
| `RoomMember.php`                      | All room membership operations                  | ✅       | Model with role-based permission methods |
| `RoomMemberRole.php`                  | All room operations                             | ✅       | Type-safe enum with permission methods   |
| `ApiResponse.php`                     | All API endpoints                               | ✅       | Standardized response formatting         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error           | Source                     | Condition                     |
| --------------- | -------------------------- | ----------------------------- |
| `reason.string` | `RejectJoinRequestRequest` | Reason is not a string        |
| `reason.max`    | `RejectJoinRequestRequest` | Reason exceeds 500 characters |

### Authentication Errors (401)

| Error          | Source                     | Condition                   |
| -------------- | -------------------------- | --------------------------- |
| "Unauthorized" | `RejectJoinRequestRequest` | `authorize()` returns false |

### Not Found Errors (404)

| Error               | Source     | Condition                               |
| ------------------- | ---------- | --------------------------------------- |
| "Request not found" | Controller | Request ID doesn't exist or not pending |

### Permission Errors (403)

| Error                        | Source     | Condition                       |
| ---------------------------- | ---------- | ------------------------------- |
| "You do not have permission" | Controller | User is not owner/admin of room |

### System Errors (500)

| Error                | Source        | Condition          |
| -------------------- | ------------- | ------------------ |
| Database update fail | Model::save() | Connection failure |

### Edge Cases

| Case                       | Behavior                                       |
| -------------------------- | ---------------------------------------------- |
| Request already approved   | Returns 404 (pending() scope fails)            |
| Request already rejected   | Returns 404 (pending() scope fails)            |
| Request was cancelled      | Returns 404 (pending() scope fails)            |
| User is room owner         | Allowed (canManageMembers() returns true)      |
| User is room admin         | Allowed (canManageMembers() returns true)      |
| User is regular member     | Returns 403 (canManageMembers() returns false) |
| User is not a member       | Returns 403 (membership is null)               |
| Reason is null             | Allowed (reason is optional)                   |
| Reason is empty string     | Allowed (nullable)                             |
| Reason at max length (500) | Allowed                                        |
| Reason exceeds max length  | Returns 422 validation error                   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                AUTH MIDDLEWARE        FORM REQUEST           CONTROLLER             SERVICE LAYER           DATABASE
   │                       │                       │                       │                       │                    │
   │ POST /join-requests/  │                       │                       │                       │                    │
   │ {id}/reject           │                       │                       │                       │                    │
   │ {"reason":"..."}      │                       │                       │                       │                    │
   │──────────────────────▶│                       │                       │                       │                    │
   │                       │                       │                       │                       │                    │
   │                       │ 1. Validate token     │                       │                       │                    │
   │                       │   Load user           │                       │                       │                    │
   │                       │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │ 2. authorize()        │                       │                    │
   │                       │                       │   Ensure user != null │                       │                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │ 3. Validate rules     │                       │                    │
   │                       │                       │   reason: optional    │                       │                    │
   │                       │                       │   string, max:500     │                       │                    │
   │                       │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │                       │ 4. Find pending       │                    │
   │                       │                       │                       │    join request       │                    │
   │                       │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                       │ 5. SELECT from     │
   │                       │                       │                       │                       │    room_join_reqs  │
   │                       │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │◀──────────────────────│                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │                       │ 6. Get user's         │                    │
   │                       │                       │                       │    membership         │                    │
   │                       │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                       │ 7. SELECT from     │
   │                       │                       │                       │                       │    room_members    │
   │                       │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │◀──────────────────────│                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │                       │ 8. Check              │                    │
   │                       │                       │                       │    canManageMembers() │                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │                       │ 9. Reject request     │                    │
   │                       │                       │                       │    (model method)     │                    │
   │                       │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                       │ 10. UPDATE         │
   │                       │                       │                       │                       │    room_join_reqs  │
   │                       │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │◀──────────────────────│                    │
   │                       │                       │                       │                       │                    │
   │                       │                       │◀──────────────────────│                       │                    │
   │                       │◀──────────────────────│                       │                       │                    │
   │◀──────────────────────│                       │                       │                       │                    │
   │                       │                       │                       │                       │                    │
   │  200 + JSON           │                       │                       │                       │                    │
   │                       │                       │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location(s)                                   |
| ---------------------------- | --------------------------------------------- |
| New validation rules         | `RejectJoinRequestRequest::rules()`           |
| Pre-rejection checks         | Before `$joinRequest->reject()` in controller |
| Post-rejection actions       | After `$joinRequest->reject()` in controller  |
| Notification on rejection    | Add MSABEventService call after rejection     |
| Additional rejection reasons | Store predefined reasons in database/enum     |
| Rejection audit logging      | Add observer to `RoomJoinRequest` model       |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., rejection_type)

| Step  | File                                                 | What to Change                   |
| ----- | ---------------------------------------------------- | -------------------------------- |
| **1** | **Database Migration**                               | Add `rejection_type` column      |
| **2** | `app/Models/Room/RoomJoinRequest.php`                | Add to `$fillable` array         |
| **3** | `app/Http/Requests/.../RejectJoinRequestRequest.php` | Add validation rule              |
| **4** | `app/Http/Controllers/.../Controller.php`            | Pass to model's reject() method  |
| **5** | `app/Models/Room/RoomJoinRequest.php`                | Update reject() method signature |

#### ➖ REMOVING A FIELD

| Step  | File                                                 | What to Change              |
| ----- | ---------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Requests/.../RejectJoinRequestRequest.php` | Remove validation rule      |
| **2** | `app/Http/Controllers/.../Controller.php`            | Remove from reject() call   |
| **3** | `app/Models/Room/RoomJoinRequest.php`                | Remove from reject() method |
| **4** | `app/Models/Room/RoomJoinRequest.php`                | Remove from `$fillable`     |
| **5** | **Database Migration**                               | Drop column (if safe)       |

### 🔗 Field Flow Dependency Chain

```
                    ┌─────────────────┐
                    │  Path Param     │
                    │  {id}           │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Request Body   │
                    │  {"reason":...} │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  RejectJoinRequestRequest    │
              │  validates: reason           │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  Controller                  │
              │  $id, $request->validated()  │
              └──────────────┬───────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ RoomJoinRequest │ │ RoomMemberSvc   │ │ RoomJoinRequest │
│ Find by ID      │ │ getMembership() │ │ reject()        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                                |
| ------------------------------ | ----------------------------------------------------- |
| `pending()` scope check        | Ensures only pending requests can be rejected         |
| `canManageMembers()` check     | Authorization gate - prevents unauthorized rejections |
| Status transition in reject()  | Model maintains data integrity                        |
| reviewed_by/reviewed_at fields | Audit trail for who rejected and when                 |

### 🚨 Common Pitfalls

| Pitfall                          | Prevention                                          |
| -------------------------------- | --------------------------------------------------- |
| Skipping pending status check    | Always use `pending()` scope when finding request   |
| Not checking permissions         | Always verify `canManageMembers()` before rejecting |
| Rejecting already-processed req  | pending() scope handles this automatically          |
| Missing reviewer ID              | Always pass `$user->id` to reject() method          |
| Reason exceeding max length      | FormRequest validation handles this                 |
| Adding notification without test | Ensure notification service is properly injected    |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                           ← Route definition (line 52)
app/Http/Controllers/Api/V1/Room/
  └── RoomJoinRequestController.php                      ← Controller (reject method)
app/Http/Requests/Api/V1/Room/
  └── RejectJoinRequestRequest.php                       ← Request validation
app/Services/Room/
  └── RoomMemberService.php                              ← Membership lookup
app/Models/Room/
  ├── RoomJoinRequest.php                                ← Join request model
  ├── RoomMember.php                                     ← Room member model
  └── Room.php                                           ← Room model
app/Enums/Room/
  ├── RoomJoinRequestStatus.php                          ← Status enum
  └── RoomMemberRole.php                                 ← Role enum
app/Http/Utils/
  └── ApiResponse.php                                    ← Response helper
```

---

## Document Metadata

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/room/join-requests/{id}/reject` |
| **Domain**          | User / Room Membership                             |
| **Author**          | System Documentation                               |
| **Created**         | 2026-02-01                                         |
| **Laravel Version** | 12.x                                               |
| **PHP Version**     | 8.4                                                |
