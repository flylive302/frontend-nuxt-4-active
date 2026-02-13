# DELETE /api/v1/users/{user}

> **Domain**: User  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Deletes a user from the system. This is a soft delete operation (if the model uses `SoftDeletes`) that requires `users.delete` permission. Enforces role hierarchy to prevent deletion of users with higher privileges and prevents self-deletion.

### Responsibilities

- Authorize via `users.delete` permission and role hierarchy
- Prevent self-deletion
- Soft delete user record
- Return success confirmation

### What It Owns

| Owned                | Description                                   |
| -------------------- | --------------------------------------------- |
| User deletion logic  | Policy enforcement, delegating to UserService |
| Role hierarchy check | Cannot delete users with higher privileges    |

### External Dependencies

| Dependency         | Type           | Purpose                            |
| ------------------ | -------------- | ---------------------------------- |
| Database (`users`) | Eloquent       | User soft delete                   |
| Laravel Sanctum    | Package        | Authentication verification        |
| Rate Limiter       | Infrastructure | `throttle:api_creator` middleware  |
| UserPolicy         | Authorization  | `delete` permission + hierarchy    |
| UserService        | Service        | Orchestrates deletion via Action   |
| DeleteUserAction   | Action         | Handles delete via direct Eloquent |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/users/{user}
```

### Authentication

✅ **Required** - Sanctum Bearer token required

### Authorization

✅ **Required** - Via `UserPolicy::delete($authUser, $targetUser)`:

- ❌ Cannot delete **own** account (self-deletion forbidden)
- ✅ Must have `users.delete` permission
- ✅ Must have **higher or equal** role than target user

### Rate Limiting

| Limiter       | Key         | Config                           |
| ------------- | ----------- | -------------------------------- |
| `api_creator` | `user:{id}` | Higher limits for elevated roles |

### Middleware Stack

```
1. auth:sanctum        → Verifies authentication token
2. throttle:api_creator → Rate limiting for creator actions
```

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints               | Example | Description       |
| --------- | --------- | ------------------------- | ------- | ----------------- |
| `user`    | `integer` | Required, exists in users | `123`   | User ID to delete |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User deleted successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Self-Deletion Forbidden (403)

```json
{
  "status": "error",
  "message": "You cannot delete your own account.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 403,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Missing Permission (403)

```json
{
  "status": "error",
  "message": "You do not have permission to delete users.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 403,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Role Hierarchy Violation (403)

```json
{
  "status": "error",
  "message": "You cannot delete users with higher privileges.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 403,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\User\\User] 999",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 404,
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "error_code": 401,
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                    |
| ----- | -------------------------------------------- |
| `200` | User deleted successfully                    |
| `401` | Missing or invalid authentication token      |
| `403` | Authorization failed (see specific messages) |
| `404` | User with given ID not found                 |
| `429` | Rate limit exceeded                          |
| `500` | Database or unexpected server error          |

---

## 3. Authorization Logic (UserPolicy::delete)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AUTHORIZATION FLOW                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  STEP 1: Self-deletion check                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ if ($user->id === $model->id) {                                        │ │
│  │     return Response::deny('You cannot delete your own account.');      │ │
│  │ }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│           │                                                                 │
│           ▼                                                                 │
│  STEP 2: Permission check                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ if (! $user->can('users.delete')) {                                    │ │
│  │     return Response::deny('You do not have permission to delete...');  │ │
│  │ }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│           │                                                                 │
│           ▼                                                                 │
│  STEP 3: Role hierarchy check                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ if (! $user->hasHigherOrEqualRoleThan($model)) {                       │ │
│  │     return Response::deny('You cannot delete users with higher...');   │ │
│  │ }                                                                      │ │
│  │                                                                        │ │
│  │ // Role priority: Super Admin > Admin > Moderator > User               │ │
│  │ // Admin CAN delete Moderator, User                                    │ │
│  │ // Admin CANNOT delete Admin, Super Admin                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│           │                                                                 │
│           ▼                                                                 │
│  STEP 4: Allow deletion                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ return Response::allow();                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Role Hierarchy Matrix

| Actor Role  | Can Delete Super Admin | Can Delete Admin | Can Delete Moderator | Can Delete User |
| ----------- | ---------------------- | ---------------- | -------------------- | --------------- |
| Super Admin | ❌ (self)              | ✅               | ✅                   | ✅              |
| Admin       | ❌                     | ❌ (self/equal)  | ✅                   | ✅              |
| Moderator   | ❌                     | ❌               | ❌ (self/equal)      | ✅              |
| User        | ❌                     | ❌               | ❌                   | ❌              |

---

## 4. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/users/123                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/users.php:30                                               │
│ Route: Route::delete('/users/{user}', [UserController::class, 'destroy'])   │
│                                                                             │
│ Route Model Binding:                                                        │
│   • Laravel automatically resolves {user} to User model                     │
│   • If not found → 404 before controller                                    │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum       → Verifies Bearer token, loads User                 │
│   2. throttle:api_creator → Rate limiting for creator actions               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.2 CONTROLLER METHOD - destroy()                                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php:235-252           │
│ Method: destroy(User $user): JsonResponse                                   │
│                                                                             │
│ Implementation:                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function destroy(User $user): JsonResponse                       │ │
│ │ {                                                                       │ │
│ │     $this->authorize('delete', $user);                                  │ │
│ │                                                                         │ │
│ │     try {                                                               │ │
│ │         $this->userService->deleteUser($user);                          │ │
│ │                                                                         │ │
│ │         return ApiResponse::success(                                    │ │
│ │             null,                                                       │ │
│ │             'User deleted successfully'                                 │ │
│ │         );                                                              │ │
│ │     } catch (UserDeletionException $e) {                                │ │
│ │         return $this->errorResponder->serverError($e->getMessage());    │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Key Characteristics:                                                        │
│   • Uses Route Model Binding (User injected automatically)                  │
│   • Authorizes via UserPolicy::delete() before deletion                     │
│   • Delegates to UserService for proper cleanup and cache invalidation      │
│   • Returns null data on success (no body needed for DELETE)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.3 AUTHORIZATION - UserPolicy::delete()                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/User/UserPolicy.php:61-78                                │
│ Method: delete(User $user, User $model): Response                           │
│                                                                             │
│ Process:                                                                    │
│   1. Check $user->id !== $model->id (no self-delete)                        │
│   2. Check $user->can('users.delete') (permission)                          │
│   3. Check $user->hasHigherOrEqualRoleThan($model) (hierarchy)              │
│                                                                             │
│ Any failure → Response::deny() with specific message → 403 Forbidden        │
│ All pass → Response::allow() → Continue to deletion                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4.4 DATA ACCESS / DATABASE OPERATIONS                                       │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ QUERY 1: Route Model Binding (automatic)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM users WHERE id = 123 LIMIT 1                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ QUERY 2: Soft delete user                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ UPDATE users                                                            │ │
│ │ SET deleted_at = NOW(),                                                 │ │
│ │     updated_at = NOW()                                                  │ │
│ │ WHERE id = 123                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: If model doesn't use SoftDeletes trait, this would be:                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ DELETE FROM users WHERE id = 123                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None (could add user cleanup jobs)                        │
│ EXTERNAL API CALLS: None                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body (data: null)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Reusability Matrix

| File                 | Used By Endpoints             | Reusable    | Reasoning                             |
| -------------------- | ----------------------------- | ----------- | ------------------------------------- |
| `UserController.php` | Multiple `/users/*` endpoints | ⭕ Mixed    | Controller bound to User domain       |
| `UserPolicy.php`     | All user actions              | ✅ Reusable | Authorization for all user operations |
| `ApiResponse.php`    | All API endpoints             | ✅ Reusable | Global response envelope              |
| `User.php` (Model)   | Entire application            | ✅ Reusable | Core entity model + SoftDeletes       |

---

## 6. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                                             | Source               | Condition                       |
| ------------------------------------------------- | -------------------- | ------------------------------- |
| "You cannot delete your own account."             | `UserPolicy::delete` | Auth user ID = target user ID   |
| "You do not have permission to delete users."     | `UserPolicy::delete` | Missing `users.delete` perm     |
| "You cannot delete users with higher privileges." | `UserPolicy::delete` | Target has higher role priority |

### Not Found Errors (404)

| Error                                         | Source              | Condition             |
| --------------------------------------------- | ------------------- | --------------------- |
| "No query results for model [App\Models\...]" | Route Model Binding | User ID doesn't exist |

### Rate Limit Errors (429)

| Error                                  | Source                 | Condition           |
| -------------------------------------- | ---------------------- | ------------------- |
| "Too many requests. Please try again." | `throttle:api_creator` | Rate limit exceeded |

### Edge Cases

| Case                            | Behavior                                         |
| ------------------------------- | ------------------------------------------------ |
| Self-deletion attempt           | 403 "cannot delete your own account"             |
| Admin deleting Super Admin      | 403 "cannot delete users with higher privileges" |
| Deleting already soft-deleted   | 404 (route model binding excludes deleted)       |
| Non-existent user ID            | 404 from route model binding                     |
| User without delete permission  | 403 "do not have permission to delete users"     |
| Super Admin deleting themselves | 403 (self-delete forbidden regardless of role)   |
| Concurrent delete requests      | First succeeds, second gets 404                  |

---

## 7. Sequence Diagram (Textual)

```
 CLIENT                ROUTER              MIDDLEWARE              CONTROLLER            POLICY
   │                     │                       │                       │                   │
   │ DELETE /users/123   │                       │                       │                   │
   │────────────────────▶│                       │                       │                   │
   │                     │                       │                       │                   │
   │                     │ 1. Route Model        │                       │                   │
   │                     │    Binding: User#123  │                       │                   │
   │                     │────────┐              │                       │                   │
   │                     │◀───────┘              │                       │                   │
   │                     │                       │                       │                   │
   │                     │──────────────────────▶│                       │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 2. auth:sanctum       │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │                       │                   │
   │                     │                       │ 3. throttle check     │                   │
   │                     │                       │────────┐              │                   │
   │                     │                       │◀───────┘              │                   │
   │                     │                       │                       │                   │
   │                     │                       │──────────────────────▶│                   │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 4. authorize      │
   │                     │                       │                       │    ('delete', $u) │
   │                     │                       │                       │──────────────────▶│
   │                     │                       │                       │                   │
   │                     │                       │                       │ 5. self-delete?   │
   │                     │                       │                       │    permission?    │
   │                     │                       │                       │    role hierarchy?│
   │                     │                       │                       │◀──────────────────│
   │                     │                       │                       │   allow()         │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 6. $user->delete()│
   │                     │                       │                       │────────┐          │
   │                     │                       │                       │◀───────┘          │
   │                     │                       │                       │   (soft delete)   │
   │                     │                       │                       │                   │
   │                     │                       │                       │ 7. ApiResponse::  │
   │                     │                       │                       │    success(null)  │
   │                     │                       │                       │────────┐          │
   │                     │                       │                       │◀───────┘          │
   │                     │                       │                       │                   │
   │                     │◀─────────────────────────────────────────────│                   │
   │◀────────────────────│                       │                       │                   │
   │                     │                       │                       │                   │
   │  200 OK + JSON      │                       │                       │                   │
   │  { data: null }     │                       │                       │                   │
```

---

## 8. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                       | Location                                       |
| ------------------------------ | ---------------------------------------------- |
| Hard delete option             | Add parameter, new policy method `forceDelete` |
| Pre-delete cleanup (relations) | Add model observer or event before delete      |
| Audit log for deletion         | Dispatch event after successful delete         |
| Cascade soft delete relations  | Model boot method or observer                  |
| Email notification on deletion | Queue job after delete                         |

### 📝 Soft Delete Considerations

| Consideration                    | Behavior                                       |
| -------------------------------- | ---------------------------------------------- |
| Related records                  | Remain intact (not cascade deleted)            |
| Unique constraints (email, etc.) | Deleted user still occupies unique slot        |
| Restore capability               | Can restore via separate admin endpoint        |
| Force delete                     | Permanently removes (see `forceDelete` policy) |

### ⚠️ Common Pitfalls

| Pitfall                             | Prevention                                   |
| ----------------------------------- | -------------------------------------------- |
| Orphaned related records            | Implement cascade or cleanup in observer     |
| Unique constraint collision         | Consider scoped uniqueness excluding deleted |
| Self-deletion circumvention         | Policy checks happen before controller logic |
| No confirmation step                | Client should implement confirmation dialog  |
| Rate limit bypass via different IDs | Rate limit key should be per-actor           |

---

## 9. Related Endpoints

| Endpoint                    | Method | Purpose                            |
| --------------------------- | ------ | ---------------------------------- |
| `GET /users/{user}`         | GET    | View user before deciding delete   |
| `PUT /users/{user}/ban`     | PUT    | Alternative: ban instead of delete |
| `DELETE /users/{id}/force`  | DELETE | Force permanent delete (if exists) |
| `PATCH /users/{id}/restore` | PATCH  | Restore soft-deleted user          |

---

## 10. Document Metadata

| Property         | Value                    |
| ---------------- | ------------------------ |
| **Author**       | API Documentation System |
| **Created**      | 2026-01-27               |
| **Last Updated** | 2026-01-28               |
| **Version**      | 1.0.0                    |
| **Status**       | Complete                 |

### Changelog

| Version | Date       | Changes                              |
| ------- | ---------- | ------------------------------------ |
| 1.1.0   | 2026-01-28 | Updated to reflect Eloquent refactor |
| 1.0.0   | 2026-01-27 | Initial documentation created        |
