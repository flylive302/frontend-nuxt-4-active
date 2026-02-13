# POST /api/v1/invitations/{invitation}/decline

> **Domain**: Invitation  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Allows an invited user to decline an agency invitation, updating its status to `declined` without joining the agency.

### Responsibilities

- Authorize only the invited user to decline the invitation
- Update invitation status from `pending` to `declined`
- Prevent decline for expired or already-responded invitations

### What It Owns

| Owned                    | Description                                       |
| ------------------------ | ------------------------------------------------- |
| Invitation Status Update | Updates `agency_invitations.status` to `declined` |

### External Dependencies

| Dependency | Type           | Purpose                        |
| ---------- | -------------- | ------------------------------ |
| Database   | Infrastructure | Store invitation status update |
| Sanctum    | Package        | Token-based authentication     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/invitations/{invitation}/decline
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key         | Config                |
| ------- | ----------- | --------------------- |
| Default | `auth:user` | Standard API limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter    | Type      | Required | Description                     |
| ------------ | --------- | -------- | ------------------------------- |
| `invitation` | `integer` | ✅       | ID of the invitation to decline |

### Request Body Schema

No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Invitation declined.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-03T18:50:23.000000Z",
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
  "errors": []
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                               |
| ----- | ------------------------------------------------------- |
| `200` | Invitation declined successfully                        |
| `403` | User not authorized (not invitee or invitation expired) |
| `404` | Invitation not found                                    |
| `500` | Internal server error                                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/invitations/{invitation}/decline                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:146-147                                       │
│ Route: Route::post('/{invitation}/decline', [AgencyInvitationController::   │
│        class, 'decline'])->name('invitations.decline');                     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token and loads User                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Agency/AgencyInvitation.php                                │
│                                                                             │
│ Laravel automatically resolves {invitation} parameter to AgencyInvitation   │
│ model instance using implicit route model binding.                          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // If ID not found, returns 404 automatically                          │ │
│ │ SELECT * FROM agency_invitations WHERE id = ?                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php     │
│ Method: decline(Request $request, AgencyInvitation $invitation)             │
│                                                                             │
│ STEP 1: Authorize the action via Policy                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('decline', $invitation);                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Update invitation status to DECLINED                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation->update([                                                   │ │
│ │     'status' => AgencyInvitationStatus::DECLINED,                       │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return success response                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Invitation declined.');              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyInvitationPolicy.php                        │
│ Method: decline(User $user, AgencyInvitation $invitation)                   │
│                                                                             │
│ Authorization delegated to accept() method:                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function decline(User $user, AgencyInvitation $invitation): bool │ │
│ │ {                                                                       │ │
│ │     // Same as accept                                                   │ │
│ │     return $this->accept($user, $invitation);                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ accept() method checks:                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function accept(User $user, AgencyInvitation $invitation): bool  │ │
│ │ {                                                                       │ │
│ │     // Only the invitee can accept                                      │ │
│ │     if ($invitation->user_id !== $user->id) {                           │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return $invitation->canRespond();                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│ │ Responsibility: Represents invitation to join an agency                 │ │
│ │ Reusable: YES (shared across invitation endpoints)                      │ │
│ │ Why It Exists: Central entity for invitation management                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canRespond() → Returns true if pending AND not expired              │ │
│ │   • isPending() → Checks if status is PENDING                           │ │
│ │   • isExpired() → Checks if expired based on expires_at                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyInvitationStatus (Enum)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyInvitationStatus.php                       │ │
│ │ Responsibility: Defines invitation lifecycle states                     │ │
│ │ Reusable: YES (used by model, policy, and controller)                   │ │
│ │ Why It Exists: Type-safe status representation                          │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • PENDING = 'pending'                                                 │ │
│ │   • ACCEPTED = 'accepted'                                               │ │
│ │   • DECLINED = 'declined'                                               │ │
│ │   • EXPIRED = 'expired'                                                 │ │
│ │   • CANCELLED = 'cancelled'                                             │ │
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
│ │   • success($data, $message) → 200 success response                     │ │
│ │   • error($message, $errors) → Error response with status code          │ │
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
│ 1. SELECT: Route model binding loads invitation                             │
│    Query: SELECT * FROM agency_invitations WHERE id = ?                     │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. UPDATE: Change invitation status                                         │
│    Query: UPDATE agency_invitations SET status = 'declined',                │
│           updated_at = ? WHERE id = ?                                       │
│    Source: AgencyInvitationController::decline()                            │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None                                                                      │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None                                                                      │
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
│ Response built via ApiResponse::success():                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Invitation declined.');              │ │
│ │                                                                         │ │
│ │ // Produces:                                                            │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Invitation declined.",                                    │ │
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

| File                             | Used By Endpoints        | Reusable | Reasoning                                    |
| -------------------------------- | ------------------------ | -------- | -------------------------------------------- |
| `AgencyInvitationController.php` | invitations.\*           | ⭕       | Contains endpoints for invitation management |
| `AgencyInvitationPolicy.php`     | All invitation endpoints | ✅       | Shared authorization logic for invitations   |
| `AgencyInvitation.php`           | All invitation endpoints | ✅       | Core model for invitation data               |
| `AgencyInvitationStatus.php`     | All invitation endpoints | ✅       | Enum for invitation statuses                 |
| `ApiResponse.php`                | All API endpoints        | ✅       | Global response utility                      |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                           |
| ----- | ------ | ----------------------------------- |
| None  | N/A    | No request body validation required |

### Authorization Errors (403)

| Error                          | Source                   | Condition                                    |
| ------------------------------ | ------------------------ | -------------------------------------------- |
| "This action is unauthorized." | `AgencyInvitationPolicy` | User is not the invitation recipient         |
| "This action is unauthorized." | `AgencyInvitationPolicy` | Invitation status is not `pending`           |
| "This action is unauthorized." | `AgencyInvitationPolicy` | Invitation has expired (`expires_at` passed) |

### Not Found Errors (404)

| Error                                            | Source              | Condition                   |
| ------------------------------------------------ | ------------------- | --------------------------- |
| "No query results for model [AgencyInvitation]." | Route Model Binding | Invitation ID doesn't exist |

### System Errors (500)

| Error          | Source   | Condition                   |
| -------------- | -------- | --------------------------- |
| "Server Error" | Database | Database connection failure |
| "Server Error" | Database | Transaction/update failure  |

### Edge Cases

| Case                        | Behavior                                 |
| --------------------------- | ---------------------------------------- |
| Invitation already declined | Returns 403 (canRespond() returns false) |
| Invitation already accepted | Returns 403 (canRespond() returns false) |
| Invitation cancelled        | Returns 403 (canRespond() returns false) |
| Invitation expired          | Returns 403 (isExpired() returns true)   |
| User not the invitee        | Returns 403 (user_id doesn't match)      |
| Unauthenticated request     | Returns 401 (auth:sanctum middleware)    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER              POLICY                  DATABASE
   │                       │                       │                       │                       │
   │  POST /invitations/   │                       │                       │                       │
   │  {id}/decline         │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │   (validate token)    │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. Route Model Binding│                       │
   │                       │                       │   (load invitation)   │                       │
   │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │ (AgencyInvitation)    │
   │                       │                       │                       │                       │
   │                       │                       │ 3. authorize('decline')                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. Check user_id      │
   │                       │                       │                       │    matches            │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. Check canRespond() │
   │                       │                       │                       │    (pending + valid)  │
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│ (true/false)          │
   │                       │                       │                       │                       │
   │                       │                       │ 6. Update status      │                       │
   │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │ (updated)             │
   │                       │                       │                       │                       │
   │                       │                       │ 7. ApiResponse::      │                       │
   │                       │                       │    success()          │                       │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  200 + JSON           │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                             |
| --------------------------- | ---------------------------------------------------- |
| Add notification on decline | `AgencyInvitationController::decline()` after update |
| Log decline event           | `AgencyInvitationController::decline()` after update |
| Add decline reason field    | Request validation → model → controller              |
| Custom decline rules        | `AgencyInvitationPolicy::decline()` method           |

### 📝 Field Modification Guide

#### ➕ ADDING A DECLINE REASON FIELD

| Step  | File                                                      | What to Change                      |
| ----- | --------------------------------------------------------- | ----------------------------------- |
| **1** | **Database Migration**                                    | Add `decline_reason` column         |
| **2** | `app/Models/Agency/AgencyInvitation.php`                  | Add `decline_reason` to `$fillable` |
| **3** | Create form request for decline action                    | Add validation for `decline_reason` |
| **4** | `app/Http/Controllers/.../AgencyInvitationController.php` | Update `decline()` to save reason   |

### 🔗 Field Flow Dependency Chain

```
Request → Controller → Model → Database
   │           │          │        │
   │           │          │        └─ agency_invitations.status
   │           │          │
   │           │          └─ AgencyInvitation->update()
   │           │
   │           └─ authorize() → Policy → canRespond()
   │
   └─ (No request body for decline)
```

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                                   |
| ----------------------------- | -------------------------------------------------------- |
| Policy `decline()` delegation | Shares logic with `accept()` for consistency             |
| `canRespond()` logic          | Used across multiple endpoints and status checks         |
| `AgencyInvitationStatus` enum | Database stores these values, changes require migrations |
| Route model binding           | Changing parameter name affects URL structure            |

### 🚨 Common Pitfalls

| Pitfall                                     | Prevention                                            |
| ------------------------------------------- | ----------------------------------------------------- |
| Modifying decline without updating accept   | Both share authorization via `accept()` method        |
| Changing invitation status enum values      | These are stored in database, requires data migration |
| Adding body validation without form request | Create proper FormRequest class for validation        |
| Forgetting to check invitation validity     | Policy already handles via `canRespond()` check       |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 146-147)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyInvitationController.php                       ← Controller (decline method)
app/Policies/Agency/
  └── AgencyInvitationPolicy.php                           ← Authorization policy
app/Models/Agency/
  └── AgencyInvitation.php                                 ← Invitation model
app/Enums/Agency/
  └── AgencyInvitationStatus.php                           ← Status enum
app/Http/Utils/
  └── ApiResponse.php                                      ← Response utility
```

---

## Document Metadata

| Property            | Value                                           |
| ------------------- | ----------------------------------------------- |
| **Endpoint**        | `POST /api/v1/invitations/{invitation}/decline` |
| **Domain**          | Invitation                                      |
| **Author**          | System Documentation                            |
| **Created**         | 2026-02-03                                      |
| **Laravel Version** | 12.x                                            |
| **PHP Version**     | 8.4                                             |
