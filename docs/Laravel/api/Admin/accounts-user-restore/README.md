# POST /api/v1/admin/accounts/{user}/restore

> **Domain**: Admin - Account Management  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Admin Restore Account endpoint allows administrators to restore a soft-deleted user account. Since PII was purged during deletion, a new signature must be provided. Optionally, new name and email can be assigned.

### Responsibilities

- Authenticate request via Sanctum token
- Verify admin role (Admin or Super Admin)
- Validate user is actually deleted (trashed)
- Validate new signature is unique
- Restore user with new signature
- Clear blocked status
- Dispatch UserRestored event
- Return restored user profile

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Account restoration         | Reverses soft delete                                 |
| Signature reassignment      | Assigns new unique signature                         |
| Status reset                | Clears blocked status from deletion                  |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `users` table               | Database       | User data with soft deletes                 |
| Laravel Sanctum             | Package        | Token authentication                        |
| Spatie Permission           | Package        | Role verification                           |
| AccountDeletionService      | Service        | Restoration logic                           |
| RestoreAccountRequest       | FormRequest    | Validation                                  |
| BootstrapUserResource       | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/admin/accounts/{user}/restore
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum  
✅ **Role Required** - Admin or Super Admin  
✅ **Policy Required** - UserPolicy@delete (same as delete permission)

### Route Parameters

| Parameter | Type      | Required | Description                          |
| --------- | --------- | -------- | ------------------------------------ |
| `user`    | `integer` | ✅       | User ID to restore (trashed user)    |

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
  "new_signature": "restored_user_123",
  "name": "John Doe",
  "email": "john.restored@example.com"
}
```

### Field Details

| Field           | Type     | Required | Constraints                              | Description                     |
| --------------- | -------- | -------- | ---------------------------------------- | ------------------------------- |
| `new_signature` | `string` | ✅       | min:3, max:255, unique, alphanumeric_-   | New unique signature            |
| `name`          | `string` | ❌       | max:255                                  | Optional new display name       |
| `email`         | `email`  | ❌       | max:255, unique                          | Optional new email address      |

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "User account has been restored successfully.",
  "data": {
    "id": 456,
    "name": "John Doe",
    "signature": "restored_user_123",
    "avatar": null,
    "frame": null,
    "phone": null,
    "country": null,
    "gender": "male",
    "date_of_birth": null,
    "coins": "1500",
    "diamonds": "250",
    "wealth_xp": "5000",
    "charm_xp": "3200",
    "is_profile_complete": false,
    "is_blocked": false,
    "blocked_at": null,
    "blocked_reason": null,
    "locked_until": null
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
    "new_signature": ["This signature is already taken. Please choose a different one."]
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z"
  }
}
```

#### ❌ Bad Request Error (400)

```json
{
  "status": "error",
  "message": "User account is not deleted and cannot be restored.",
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
| `200` | Account restored successfully       |
| `400` | User is not deleted                 |
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
│                    POST /api/v1/admin/accounts/{user}/restore               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/admin.php:25                                               │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{user}/restore',                                          │ │
│ │     [AccountDeletionController::class, 'restoreUserAccount']);          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Route model binding includes trashed users for restoration            │
│ (configured in RouteServiceProvider or User model withTrashed scope)        │
│                                                                             │
│ Middleware: auth:sanctum, role:Admin|Super Admin, throttle:api_admin        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 VALIDATION                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/RestoreAccountRequest.php               │
│                                                                             │
│ Rules (lines 28-44):                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'new_signature' => [                                                    │ │
│ │     'required',                                                         │ │
│ │     'string',                                                           │ │
│ │     'max:255',                                                          │ │
│ │     'min:3',                                                            │ │
│ │     'regex:/^[a-z0-9_-]+$/i',  // Alphanumeric + underscore/hyphen      │ │
│ │     Rule::unique(User::class, 'signature'),                             │ │
│ │ ],                                                                      │ │
│ │ 'name' => ['nullable', 'string', 'max:255'],                            │ │
│ │ 'email' => [                                                            │ │
│ │     'nullable',                                                         │ │
│ │     'email',                                                            │ │
│ │     'max:255',                                                          │ │
│ │     Rule::unique(User::class, 'email'),                                 │ │
│ │ ],                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/AccountDeletionController.php        │
│ Method: restoreUserAccount(User $user, RestoreAccountRequest $request):86   │
│                                                                             │
│ STEP 1: Policy Authorization (line 88)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('delete', $user);  // Same permission as delete        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check User is Trashed (lines 90-92)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $user->trashed()) {                                               │ │
│ │     return $this->errorResponder->error(                                │ │
│ │         'User account is not deleted and cannot be restored.', 400);    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Prepare New Data (lines 95-99)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ $newData = array_filter([                                               │ │
│ │     'name' => $validated['name'] ?? null,                               │ │
│ │     'email' => $validated['email'] ?? null,                             │ │
│ │ ], fn ($value) => $value !== null && $value !== '');                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Call Restoration Service (lines 101-105)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->accountDeletionService->restoreAccount(                          │ │
│ │     $user,                                                              │ │
│ │     $validated['new_signature'],                                        │ │
│ │     $newData                                                            │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return Success (lines 107-115)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'User account has been restored successfully.',        │ │
│ │     'data' => new BootstrapUserResource($user->fresh()),                │ │
│ │     'meta' => [...],                                                    │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/AccountDeletionService.php                          │
│ Method: restoreAccount() at lines 115-170                                   │
│                                                                             │
│ STEP 1: Validate User is Trashed (lines 117-119)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $user->trashed()) {                                               │ │
│ │     throw new \InvalidArgumentException('User account is not deleted'); │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Begin Transaction (line 121)                                        │
│                                                                             │
│ STEP 3: Validate Signature Uniqueness (lines 123-125)                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (User::where('signature', $newSignature)->exists()) {                │ │
│ │     throw new \InvalidArgumentException('Signature already exists');    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Prepare Restoration Data (lines 128-133)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $restorationData = array_merge([                                        │ │
│ │     'signature' => $newSignature,                                       │ │
│ │     'is_blocked' => false,                                              │ │
│ │     'blocked_at' => null,                                               │ │
│ │     'blocked_reason' => null,                                           │ │
│ │ ], $newData ?? []);                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Update User (line 136)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->update($restorationData);                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Restore User (line 139)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->restore();  // Clears deleted_at                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Refresh Model (line 142)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->refresh();                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Log Security Event (lines 145-150)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->securityEventLoggingService->logAccountRestoration(              │ │
│ │     $user,                                                              │ │
│ │     Auth::user(),   // Admin performing restoration                     │ │
│ │     $newSignature,                                                      │ │
│ │     $restorationData                                                    │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9: Invalidate Cache (line 153)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->cacheService->invalidateUserCache($user->id);                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 10: Dispatch Event (lines 156-161)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ event(new UserRestored(                                                 │ │
│ │     user: $user,                                                        │ │
│ │     actor: Auth::user(),                                                │ │
│ │     newSignature: $newSignature,                                        │ │
│ │     restorationData: $restorationData                                   │ │
│ │ ));                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 11: Commit and Return (lines 163-169)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('User account restored', [                                    │ │
│ │     'user_id' => $user->id,                                             │ │
│ │     'new_signature' => $newSignature,                                   │ │
│ │     'actor_id' => Auth::id(),                                           │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ return true;                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `AccountDeletionController.php`               | All account lifecycle endpoints      | ⭕ Mixed   | Controller for account management            |
| `RestoreAccountRequest.php`                   | Account restore only                 | ❌ Single  | Specific to restoration flow                 |
| `AccountDeletionService.php`                  | Delete, restore, stats endpoints     | ✅ Reusable| Core account lifecycle service               |
| `BootstrapUserResource.php`                   | Profile, auth, admin endpoints       | ✅ Reusable| Standard user response format                |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                           | Source                | Condition                        |
| ------------------------------- | --------------------- | -------------------------------- |
| User lacks admin role           | Role middleware       | User not Admin/Super Admin       |
| delete policy denied            | UserPolicy@delete     | Policy returns false             |

### Validation Errors (422)

| Error                          | Source                   | Condition                        |
| ------------------------------ | ------------------------ | -------------------------------- |
| `new_signature.required`       | RestoreAccountRequest    | Signature not provided           |
| `new_signature.unique`         | RestoreAccountRequest    | Signature already taken          |
| `new_signature.regex`          | RestoreAccountRequest    | Invalid characters               |
| `email.unique`                 | RestoreAccountRequest    | Email already registered         |

### Business Logic Errors (400)

| Error                              | Source                | Condition                        |
| ---------------------------------- | --------------------- | -------------------------------- |
| User is not deleted                | Controller/Service    | User not soft-deleted            |
| Signature already exists           | Service               | Race condition on uniqueness     |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User not trashed                  | 400 error - cannot restore active account          |
| Signature taken between validation| Service throws, transaction rolls back             |
| No optional fields provided       | Only signature + blocked status updated            |
| Force-deleted user                | 404 - user doesn't exist at all                    |

---

## 6. Sequence Diagram (Textual)

```
 ADMIN CLIENT           MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │POST /{user}/restore   │                       │                       │                    │
   │{ new_signature,       │                       │                       │                    │
   │  name?, email? }      │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │ 2. role check         │                       │                    │
   │                       │ 3. Validate request   │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 4. authorize('delete')│                    │
   │                       │                       │ 5. Check trashed()    │                    │
   │                       │                       │ 6. restoreAccount()   │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 7. BEGIN TRANS     │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 8. Check signature │
   │                       │                       │                       │    uniqueness      │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 9. UPDATE user     │
   │                       │                       │                       │    (signature,     │
   │                       │                       │                       │    unblock, etc)   │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 10. UPDATE user    │
   │                       │                       │                       │     deleted_at=NULL│
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 11. Log security   │
   │                       │                       │                       │ 12. Invalidate     │
   │                       │                       │                       │     cache          │
   │                       │                       │                       │ 13. Dispatch       │
   │                       │                       │                       │     UserRestored   │
   │                       │                       │                       │ 14. COMMIT TRANS   │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │◀──────────────────────│◀───────────────────│
   │                       │                       │ 15. $user->fresh()    │                    │
   │                       │                       │ 16. Return JSON       │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Restore with roles              | Add roles array to request, sync in service                 |
| Notification to restored user   | Add listener for UserRestored event                         |
| Restoration audit trail         | Already logged via SecurityEventLoggingService              |

### 📝 Field Modification Guide

#### ➕ ADDING ROLE RESTORATION

```php
// RestoreAccountRequest::rules()
'roles' => ['nullable', 'array'],
'roles.*' => ['string', 'exists:roles,name'],

// AccountDeletionService::restoreAccount()
if (isset($newData['roles'])) {
    $user->syncRoles($newData['roles']);
}
```

### 📁 File Locations Quick Reference

```
routes/api/admin.php:25                             ← Route definition
app/Http/Controllers/Api/V1/User/
  └── AccountDeletionController.php:86-118          ← Controller method
app/Http/Requests/Api/V1/User/
  └── RestoreAccountRequest.php                     ← Request validation
app/Services/User/
  └── AccountDeletionService.php:115-170            ← Restoration logic
app/Events/User/
  └── UserRestored.php                              ← Restoration event
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.

---

## 9. Document Metadata

| Property            | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Endpoint**        | `POST /api/v1/admin/accounts/{user}/restore`   |
| **Domain**          | Admin - Account Management                     |
| **Author**          | System Documentation                           |
| **Created**         | 2026-02-04                                     |
| **Laravel Version** | 12.x                                           |
| **PHP Version**     | 8.4+                                           |
