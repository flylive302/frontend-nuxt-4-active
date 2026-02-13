# DELETE /api/v1/admin/accounts/{user}/delete

> **Domain**: Admin - Account Management  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Admin Delete User Account endpoint allows administrators to delete any user's account with GDPR-compliant PII purging. This performs the same operation as user self-deletion but can be invoked by admins for any user.

### Responsibilities

- Authenticate request via Sanctum token
- Verify admin role (Admin or Super Admin)
- Authorize via UserPolicy delete permission
- Execute PII purge and soft delete via AccountDeletionService
- Return confirmation with preserved signature

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Admin-initiated deletion    | Allows admins to delete any user account             |
| Same as self-deletion       | Uses identical service method for consistency        |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `users` table               | Database       | User data storage                           |
| Laravel Sanctum             | Package        | Token authentication                        |
| Spatie Permission           | Package        | Role verification                           |
| AccountDeletionService      | Service        | PII purge and deletion                      |
| UserPolicy                  | Policy         | Delete authorization                        |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/admin/accounts/{user}/delete
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum  
✅ **Role Required** - Admin or Super Admin  
✅ **Policy Required** - UserPolicy@delete

### Route Parameters

| Parameter | Type      | Required | Description                     |
| --------- | --------- | -------- | ------------------------------- |
| `user`    | `integer` | ✅       | User ID to delete               |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Content-Type`     | ✅       | `application/json`    | Request body format          |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |
| `X-Correlation-ID` | ❌       | `string (UUID)`       | Request tracing ID           |

### Request Body Schema

```json
{
  "reason": "User violated terms of service - account suspended and deleted by admin"
}
```

### Field Details

| Field    | Type     | Required | Constraints     | Description                             |
| -------- | -------- | -------- | --------------- | --------------------------------------- |
| `reason` | `string` | ✅       | min:10, max:500 | Reason for deletion (compliance audit)  |

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "User account has been deleted successfully with PII purging for compliance.",
  "data": {
    "user_id": 456,
    "signature_preserved": "3592010"
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
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
    "reason": ["A reason for account deletion is required."]
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "User not found.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z"
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Account deleted successfully        |
| `401` | Unauthenticated                     |
| `403` | User lacks delete permission        |
| `404` | Target user not found               |
| `422` | Validation failed                   |
| `429` | Rate limit exceeded                 |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/admin/accounts/{user}/delete              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/admin.php:24                                               │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::delete('/{user}/delete',                                         │ │
│ │     [AccountDeletionController::class, 'deleteUserAccount']);           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Route Model Binding: {user} -> User model instance (or 404)                 │
│                                                                             │
│ Middleware: auth:sanctum, role:Admin|Super Admin, throttle:api_admin        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 VALIDATION                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/DeleteAccountRequest.php                │
│                                                                             │
│ Rules:                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'reason' => ['required', 'string', 'max:500', 'min:10']                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/AccountDeletionController.php        │
│ Method: deleteUserAccount(User $user, DeleteAccountRequest $request):56     │
│                                                                             │
│ STEP 1: Policy Authorization (line 58)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('delete', $user);                                      │ │
│ │ // Checks UserPolicy@delete - admin can delete users                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Execute Deletion (lines 61-64)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->accountDeletionService->deleteAccountWithPiiPurging(             │ │
│ │     $user,                                                              │ │
│ │     $request->validated()['reason']                                     │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Success (lines 66-77)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'User account has been deleted successfully...',       │ │
│ │     'data' => [                                                         │ │
│ │         'user_id' => $user->id,                                         │ │
│ │         'signature_preserved' => $user->signature,                      │ │
│ │     ],                                                                  │ │
│ │     'meta' => [...],                                                    │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Same flow as user self-deletion (see account-delete documentation)          │
│                                                                             │
│ Key difference: Auth::user() returns the admin performing the deletion,     │
│ which is logged in the security event for audit trail.                      │
│                                                                             │
│ The $user parameter is the target user being deleted.                       │
│ The actor is the authenticated admin (Auth::user()).                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `AccountDeletionController.php`               | All account lifecycle endpoints      | ⭕ Mixed   | Controller for account management            |
| `DeleteAccountRequest.php`                    | User delete, admin delete            | ✅ Reusable| Shared validation for deletion reason        |
| `AccountDeletionService.php`                  | User delete, admin delete            | ✅ Reusable| Same service for both operations             |
| `UserPolicy.php`                              | All user admin endpoints             | ✅ Reusable| Authorization policies                       |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                           | Source                | Condition                        |
| ------------------------------- | --------------------- | -------------------------------- |
| User lacks admin role           | Role middleware       | User not Admin/Super Admin       |
| delete policy denied            | UserPolicy@delete     | Policy returns false             |

### Validation Errors (422)

| Error                    | Source               | Condition                             |
| ------------------------ | -------------------- | ------------------------------------- |
| `reason.required`        | DeleteAccountRequest | Deletion reason not provided          |
| `reason.min`             | DeleteAccountRequest | Reason less than 10 characters        |
| `reason.max`             | DeleteAccountRequest | Reason exceeds 500 characters         |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User already deleted              | 404 - Route model binding fails                    |
| Admin deletes self                | Same as self-deletion flow                         |
| Super Admin deletes Admin         | Allowed if policy permits                          |
| Target user has active session    | Tokens revoked, sessions terminated                |

---

## 6. Sequence Diagram (Textual)

```
 ADMIN CLIENT           MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │DELETE /{user}/delete  │                       │                       │                    │
   │{ reason: "..." }      │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │ 2. role:Admin|Super   │                       │                    │
   │                       │ 3. Route model bind   │                       │                    │
   │                       │ 4. Validate request   │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 5. authorize('delete')│                    │
   │                       │                       │ 6. deleteAccountWith  │                    │
   │                       │                       │    PiiPurging()       │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │[transaction]       │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │ 7. Return JSON        │                    │
   │                       │                       │    { user_id,         │                    │
   │                       │                       │      signature_       │                    │
   │                       │                       │      preserved }      │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| Bulk deletion                   | New controller method, loop through users             |
| Scheduled deletion              | Store pending deletion, create artisan command        |
| Notification to user            | Add listener for UserDeleted event                    |

### 📁 File Locations Quick Reference

```
routes/api/admin.php:24                             ← Route definition
app/Http/Controllers/Api/V1/User/
  └── AccountDeletionController.php:56-80           ← Controller method
app/Http/Requests/Api/V1/User/
  └── DeleteAccountRequest.php                      ← Request validation
app/Services/User/
  └── AccountDeletionService.php:31-103             ← Deletion logic
app/Policies/
  └── UserPolicy.php                                ← Delete authorization
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.

---

## 9. Document Metadata

| Property            | Value                                         |
| ------------------- | --------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/admin/accounts/{user}/delete` |
| **Domain**          | Admin - Account Management                    |
| **Author**          | System Documentation                          |
| **Created**         | 2026-02-04                                    |
| **Laravel Version** | 12.x                                          |
| **PHP Version**     | 8.4+                                          |
