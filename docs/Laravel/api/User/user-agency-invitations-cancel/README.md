# DELETE /api/v1/user/agency/invitations/{invitation}

> **Domain**: User Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Cancels a pending agency invitation that was sent by the authenticated user or from an agency they own. This allows agency owners, admins, or the original inviter to revoke an invitation before it is accepted or declined.

### Responsibilities

- Authorize the cancellation request via policy checks
- Verify the invitation is in a cancellable state (pending)
- Update the invitation status to `CANCELLED`
- Return success confirmation

### What It Owns

| Owned                   | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| Invitation Cancellation | Changes invitation status from `pending` → `cancelled` |

### External Dependencies

| Dependency | Type           | Purpose                  |
| ---------- | -------------- | ------------------------ |
| Database   | Infrastructure | Stores invitation status |
| Sanctum    | Package        | Authentication           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/user/agency/invitations/{invitation}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key         | Config                 |
| ------- | ----------- | ---------------------- |
| Default | `user:{id}` | 60 requests per minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter    | Type      | Constraints                  | Example |
| ------------ | --------- | ---------------------------- | ------- |
| `invitation` | `integer` | Required, exists in database | `42`    |

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
  "message": "Invitation cancelled.",
  "data": null,
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
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T12:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [AgencyInvitation].",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T12:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | Invitation cancelled successfully             |
| `401` | User not authenticated                        |
| `403` | User not authorized to cancel this invitation |
| `404` | Invitation not found                          |
| `500` | Server error during cancellation              |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              DELETE /api/v1/user/agency/invitations/{invitation}            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:85-86                                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::delete('/{invitation}', [AgencyInvitationController::class,     │ │
│ │     'cancel'])->name('user.agency.invitations.cancel');                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Authenticates user via bearer token                     │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {invitation} → AgencyInvitation model (auto-resolved by Laravel)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Agency/AgencyInvitation.php                                │
│                                                                             │
│ Laravel automatically resolves {invitation} parameter:                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM agency_invitations WHERE id = ?                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If not found → 404 ModelNotFoundException thrown                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php     │
│ Method: cancel(Request $request, AgencyInvitation $invitation)              │
│                                                                             │
│ STEP 1: AUTHORIZATION CHECK                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('cancel', $invitation);                                │ │
│ │                                                                         │ │
│ │ // Calls AgencyInvitationPolicy::cancel()                               │ │
│ │ // Checks:                                                              │ │
│ │ //   1. $invitation->canBeCancelled() (must be pending)                 │ │
│ │ //   2. User is official (Super Admin/Admin) OR                         │ │
│ │ //   3. User is the inviter ($invitation->invited_by === $user->id) OR  │ │
│ │ //   4. User is agency owner                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: UPDATE INVITATION STATUS                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation->update([                                                   │ │
│ │     'status' => AgencyInvitationStatus::CANCELLED,                      │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: RETURN SUCCESS RESPONSE                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Invitation cancelled.');             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 AUTHORIZATION LAYER                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyInvitationPolicy (Policy)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Agency/AgencyInvitationPolicy.php:94-112             │ │
│ │ Method: cancel(User $user, AgencyInvitation $invitation)                │ │
│ │                                                                         │ │
│ │ public function cancel(User $user, AgencyInvitation $invitation): bool  │ │
│ │ {                                                                       │ │
│ │     // Step 1: Check if invitation can be cancelled                     │ │
│ │     if (! $invitation->canBeCancelled()) {                              │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // Step 2: Officials can cancel any invitation                      │ │
│ │     if ($this->isOfficial($user)) {                                     │ │
│ │         return true;                                                    │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // Step 3: The inviter can cancel their own invitation              │ │
│ │     if ($invitation->invited_by === $user->id) {                        │ │
│ │         return true;                                                    │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // Step 4: Agency owner can cancel any invitation                   │ │
│ │     return $invitation->agency->isOwnedBy($user);                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyInvitation (Model)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyInvitation.php                            │ │
│ │ Responsibility: Represents agency invitation with status tracking       │ │
│ │ Reusable: YES (used across all invitation endpoints)                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isPending() → checks if status === PENDING                          │ │
│ │   • canBeCancelled() → returns isPending() (line 211-214)               │ │
│ │   • agency() → BelongsTo Agency relationship                            │ │
│ │   • inviter() → BelongsTo User relationship (who sent invitation)       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyInvitationStatus (Enum)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyInvitationStatus.php                       │ │
│ │ Responsibility: Defines invitation lifecycle states                     │ │
│ │ Reusable: YES (used across all invitation operations)                   │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PENDING = 'pending' → Initial state                                 │ │
│ │   • ACCEPTED = 'accepted' → Invitee joined agency                       │ │
│ │   • DECLINED = 'declined' → Invitee rejected                            │ │
│ │   • EXPIRED = 'expired' → TTL exceeded                                  │ │
│ │   • CANCELLED = 'cancelled' → Revoked by inviter/owner                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used across all API endpoints)                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 response with data                   │ │
│ │   • error($message, $errors, $code) → Error response                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Fetch invitation by ID (Route Model Binding)                     │
│    Query: SELECT * FROM agency_invitations WHERE id = ?                     │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT: Load agency relationship for ownership check (if needed)         │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: AgencyInvitationPolicy::cancel() → $invitation->agency           │
│                                                                             │
│ 3. UPDATE: Change invitation status                                         │
│    Query: UPDATE agency_invitations SET status = 'cancelled',               │
│           updated_at = ? WHERE id = ?                                       │
│    Source: AgencyInvitationController::cancel()                             │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Invitation cancelled.',                               │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $correlationId,                             │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
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

| File                             | Used By Endpoints                                   | Reusable | Reasoning                                   |
| -------------------------------- | --------------------------------------------------- | -------- | ------------------------------------------- |
| `AgencyInvitationController.php` | All invitation endpoints (index, send, cancel, etc) | ⭕       | Controller is shared, methods are specific  |
| `AgencyInvitationPolicy.php`     | All invitation authorization                        | ✅       | Centralizes all invitation permission logic |
| `AgencyInvitation.php`           | All invitation operations                           | ✅       | Core model for invitation data              |
| `AgencyInvitationStatus.php`     | All invitation status changes                       | ✅       | Enum used across invitation lifecycle       |
| `ApiResponse.php`                | All API endpoints                                   | ✅       | Standardized response utility               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                           |
| ----- | ------ | ----------------------------------- |
| N/A   | N/A    | No request body validation required |

### Authorization Errors (403)

| Error                          | Source                   | Condition                                        |
| ------------------------------ | ------------------------ | ------------------------------------------------ |
| "This action is unauthorized." | `AgencyInvitationPolicy` | User is not inviter, not owner, and not official |
| "This action is unauthorized." | `AgencyInvitationPolicy` | Invitation is not in pending status              |

### System Errors (500)

| Error          | Source       | Condition                            |
| -------------- | ------------ | ------------------------------------ |
| Database error | Model update | Database connection or query failure |

### Edge Cases

| Case                                 | Behavior                                            |
| ------------------------------------ | --------------------------------------------------- |
| Invitation already cancelled         | Returns 403 (not pending, fails `canBeCancelled()`) |
| Invitation already accepted          | Returns 403 (not pending, fails `canBeCancelled()`) |
| Invitation already declined          | Returns 403 (not pending, fails `canBeCancelled()`) |
| Invitation expired but still pending | Can still be cancelled (status is still PENDING)    |
| Non-existent invitation ID           | Returns 404 (Route Model Binding fails)             |
| Regular member tries to cancel       | Returns 403 (not authorized)                        |
| Admin who is not inviter or owner    | Returns 200 (officials can cancel any)              |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER              POLICY                    DATABASE
   │                       │                       │                       │                         │
   │  DELETE /api/v1/user/agency/invitations/42    │                       │                         │
   │──────────────────────▶│                       │                       │                         │
   │                       │                       │                       │                         │
   │                       │ 1. auth:sanctum       │                       │                         │
   │                       │   (verify token)      │                       │                         │
   │                       │──────────────────────▶│                       │                         │
   │                       │                       │                       │                         │
   │                       │                       │ 2. Route Model Bind   │                         │
   │                       │                       │─────────────────────────────────────────────────▶│
   │                       │                       │   SELECT * FROM agency_invitations WHERE id = 42│
   │                       │                       │◀─────────────────────────────────────────────────│
   │                       │                       │                       │                         │
   │                       │                       │ 3. authorize('cancel')│                         │
   │                       │                       │──────────────────────▶│                         │
   │                       │                       │                       │                         │
   │                       │                       │                       │ 4. canBeCancelled()     │
   │                       │                       │                       │   (check status=pending)│
   │                       │                       │                       │                         │
   │                       │                       │                       │ 5. Check user role      │
   │                       │                       │                       │   (official/inviter/    │
   │                       │                       │                       │    owner)               │
   │                       │                       │                       │                         │
   │                       │                       │◀──────────────────────│ (true/false)            │
   │                       │                       │                       │                         │
   │                       │                       │ 6. Update invitation  │                         │
   │                       │                       │─────────────────────────────────────────────────▶│
   │                       │                       │   UPDATE agency_invitations SET status='cancelled'
   │                       │                       │◀─────────────────────────────────────────────────│
   │                       │                       │                       │                         │
   │                       │                       │ 7. ApiResponse::success(null, 'Invitation cancelled.')
   │                       │◀──────────────────────│                       │                         │
   │◀──────────────────────│                       │                       │                         │
   │                       │                       │                       │                         │
   │  200 + JSON           │                       │                       │                         │
   │                       │                       │                       │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                            |
| ----------------------------- | --------------------------------------------------- |
| New cancellation side-effects | `AgencyInvitationController::cancel()` after update |
| Notification on cancel        | Add event dispatch after status update              |
| Audit logging                 | Add observer on `AgencyInvitation` model            |
| New authorization rule        | `AgencyInvitationPolicy::cancel()`                  |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO TRACK (e.g., `cancelled_at`)

| Step  | File                                     | What to Change               |
| ----- | ---------------------------------------- | ---------------------------- |
| **1** | **Database Migration**                   | Add `cancelled_at` column    |
| **2** | `app/Models/Agency/AgencyInvitation.php` | Add to `$fillable`, add cast |
| **3** | `AgencyInvitationController::cancel()`   | Set `cancelled_at => now()`  |

#### ➖ REMOVING THE CANCELLED STATUS

| Step  | File                                          | What to Change                      |
| ----- | --------------------------------------------- | ----------------------------------- |
| **1** | `app/Enums/Agency/AgencyInvitationStatus.php` | Remove `CANCELLED` case             |
| **2** | `app/Models/Agency/AgencyInvitation.php`      | Update `canBeCancelled()` if needed |
| **3** | `AgencyInvitationController.php`              | Remove `cancel()` method            |
| **4** | `AgencyInvitationPolicy.php`                  | Remove `cancel()` method            |
| **5** | `routes/api/agencies.php`                     | Remove cancel route                 |

### 🔗 Field Flow Dependency Chain

```
Route Parameter {invitation}
        │
        ▼
┌──────────────────┐
│ Route Model Bind │ → SELECT invitation by ID
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Policy::cancel() │ → canBeCancelled() + authorization checks
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Model::update()  │ → status = 'cancelled'
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ ApiResponse      │ → JSON success response
└──────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                          |
| ----------------------------------- | ----------------------------------------------- |
| `AgencyInvitationStatus::CANCELLED` | Removing breaks existing data and this endpoint |
| `canBeCancelled()` logic            | Core business rule for cancellation eligibility |
| Route Model Binding                 | Breaking changes affect URL structure           |
| `AgencyInvitationPolicy::cancel`    | Authorization changes affect security           |

### 🚨 Common Pitfalls

| Pitfall                                         | Prevention                                    |
| ----------------------------------------------- | --------------------------------------------- |
| Forgetting to check `canBeCancelled()`          | Policy enforces this check automatically      |
| Allowing non-pending cancellation               | Model method `canBeCancelled()` returns false |
| Not loading agency relationship for owner check | Policy lazy-loads via `$invitation->agency`   |
| Returning wrong status code on auth failure     | Laravel throws `AuthorizationException` → 403 |
| Trying to cancel expired invitation             | Works if status is still PENDING (edge case)  |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:85-86                    ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyInvitationController.php:161-173     ← Controller cancel() method
app/Policies/Agency/
  └── AgencyInvitationPolicy.php:94-112          ← Authorization policy
app/Models/Agency/
  └── AgencyInvitation.php                       ← Invitation model
app/Enums/Agency/
  └── AgencyInvitationStatus.php                 ← Status enum with CANCELLED
app/Http/Utils/
  └── ApiResponse.php                            ← Response utility
```

---

## Document Metadata

| Property            | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/user/agency/invitations/{invitation}` |
| **Domain**          | User Agency Management                                |
| **Author**          | System Documentation                                  |
| **Created**         | 2026-02-03                                            |
| **Laravel Version** | 12.x                                                  |
| **PHP Version**     | 8.4                                                   |
