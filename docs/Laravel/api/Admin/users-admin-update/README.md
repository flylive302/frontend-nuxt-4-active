# PUT /api/v1/users/{user}/admin-update

> **Domain**: Admin - User Management  
> **Type**: Protected Endpoint (Admin Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Admin User Update endpoint allows administrators to update any user's profile information, including fields that users cannot modify themselves such as roles, permissions, and XP values. Coins and diamonds are explicitly forbidden to enforce balance invariants.

### Responsibilities

- Authenticate request via Sanctum token
- Authorize via role check (Admin/Super Admin/Moderator)
- Validate all update fields
- Update user via UserService
- Handle role and permission assignments
- Return updated user profile

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| User profile update         | Name, email, password, phone, signature              |
| Role management             | Assign/remove roles                                  |
| Permission management       | Direct permission assignment                         |
| XP adjustment               | wealth_xp, charm_xp                                  |
| Timestamp updates           | email_verified_at, last_login_at                     |

### What It Does NOT Own

| Forbidden                   | Reason                                               |
| --------------------------- | ---------------------------------------------------- |
| `coins`                     | Balance invariant - CoinDistributionService only     |
| `diamonds`                  | Balance invariant - CoinDistributionService only     |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `users` table               | Database       | User data storage                           |
| Laravel Sanctum             | Package        | Token authentication                        |
| Spatie Permission           | Package        | Role/permission management                  |
| UserService                 | Service        | Profile update logic                        |
| BootstrapUserResource       | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/users/{user}/admin-update
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum  
✅ **Role Required** - Admin, Super Admin, or Moderator

### Route Parameters

| Parameter | Type      | Required | Description             |
| --------- | --------- | -------- | ----------------------- |
| `user`    | `integer` | ✅       | Target user ID          |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Content-Type`     | ✅       | `application/json`    | Request body format          |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |

### Request Body Schema

All fields are optional for partial updates:

```json
{
  "name": "Updated Name",
  "email": "new@email.com",
  "password": "newpassword123",
  "password_confirmation": "newpassword123",
  "phone": "+1234567890",
  "country": "US",
  "signature": "new_signature",
  "roles": ["Member", "Moderator"],
  "permissions": ["view analytics"],
  "email_verified_at": "2026-01-15T10:00:00Z",
  "last_login_at": "2026-02-01T08:30:00Z",
  "wealth_xp": 1500,
  "charm_xp": 2000
}
```

### Field Details

| Field               | Type       | Required | Constraints                          | Description                    |
| ------------------- | ---------- | -------- | ------------------------------------ | ------------------------------ |
| `name`              | `string`   | ❌       | max:255                              | User display name              |
| `email`             | `string`   | ❌       | email format, unique                 | User email                     |
| `password`          | `string`   | ❌       | min:8, confirmed                     | New password                   |
| `password_confirmation` | `string` | ❌     | Required with password               | Password confirmation          |
| `phone`             | `string`   | ❌       | International format                 | Phone number                   |
| `country`           | `string`   | ❌       | ISO 2-letter code                    | Country for phone validation   |
| `signature`         | `string`   | ❌       | max:100, unique                      | User signature/handle          |
| `roles`             | `array`    | ❌       | Existing role names                  | Roles to assign                |
| `permissions`       | `array`    | ❌       | Existing permission names            | Direct permissions             |
| `email_verified_at` | `datetime` | ❌       | ISO 8601 format                      | Email verification timestamp   |
| `last_login_at`     | `datetime` | ❌       | ISO 8601 format                      | Last login timestamp           |
| `wealth_xp`         | `numeric`  | ❌       | min:0                                | Wealth XP amount               |
| `charm_xp`          | `numeric`  | ❌       | min:0                                | Charm XP amount                |

> [!CAUTION]
> Coins and diamonds are **FORBIDDEN** in this endpoint. Balance mutations MUST go through `CoinDistributionService`. See: `docs/domain/balance-invariants.md`

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "User updated successfully by admin",
  "data": {
    "id": 123,
    "name": "Updated Name",
    "email": "new@email.com",
    "signature": "new_signature",
    "phone": "+1234567890",
    "country": "US",
    "avatar": "https://imagekit.io/avatar/123.jpg",
    "roles": ["Member", "Moderator"],
    "permissions": ["view analytics"],
    "email_verified_at": "2026-01-15T10:00:00.000000Z",
    "wealth_xp": 1500,
    "charm_xp": 2000,
    "created_at": "2025-01-01T00:00:00.000000Z"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Phone number validation failed",
  "data": null,
  "errors": {
    "phone": ["Invalid phone number format"]
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "User does not have the right roles.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | User updated successfully           |
| `401` | Unauthenticated                     |
| `403` | Not admin/moderator                 |
| `404` | User not found                      |
| `422` | Validation failed                   |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/admin.php:19                                               │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::put('/users/{user}/admin-update',                                │ │
│ │     [UserController::class, 'adminUpdate'])                             │ │
│ │     ->name('users.admin-update');                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware (line 17):                                                       │
│ - auth:sanctum                                                              │
│ - role:Admin|Super Admin                                                    │
│ - throttle:api_admin                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 VALIDATION                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/AdminUpdateUserRequest.php              │
│                                                                             │
│ Authorization (lines 10-14):                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return $this->user()?->hasAnyRole(['Super Admin', 'Admin', 'Moderator'])│ │
│ │     ?? false;                                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Rules (lines 21-86):                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name' => ['sometimes', 'string', 'max:255'],                           │ │
│ │ 'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,...'], │ │
│ │ 'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],│ │
│ │ 'signature' => ['sometimes', 'nullable', 'string', 'max:100', 'unique'],│ │
│ │ 'roles' => ['sometimes', 'array'],                                      │ │
│ │ 'roles.*' => ['string', 'exists:roles,name'],                           │ │
│ │ 'permissions' => ['sometimes', 'array'],                                │ │
│ │ 'permissions.*' => ['string', 'exists:permissions,name'],               │ │
│ │ 'wealth_xp' => ['sometimes', 'nullable', 'numeric', 'min:0'],           │ │
│ │ 'charm_xp' => ['sometimes', 'nullable', 'numeric', 'min:0'],            │ │
│ │ // coins and diamonds are FORBIDDEN                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ prepareForValidation (lines 122-129):                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Remove empty password fields                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserController.php                   │
│ Method: adminUpdate() at lines 211-236                                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     $freshUser = $this->userService->updateUserProfile(                 │ │
│ │         $user, $request->validated()                                    │ │
│ │     );                                                                  │ │
│ │                                                                         │ │
│ │     if ($freshUser === null) {                                          │ │
│ │         return $this->errorResponder->notFound('User');                 │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return ApiResponse::success(                                        │ │
│ │         new BootstrapUserResource($freshUser),                          │ │
│ │         'User updated successfully by admin'                            │ │
│ │     );                                                                  │ │
│ │ } catch (NumberParseException|InvalidPhoneNumberException $e) {         │ │
│ │     return $this->errorResponder->validationError(...);                 │ │
│ │ } catch (UserUpdateException $e) {                                      │ │
│ │     return $this->errorResponder->serverError($e->getMessage());        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `UserController.php`                          | User CRUD endpoints                  | ⭕ Mixed   |
| `AdminUpdateUserRequest.php`                  | Admin update only                    | ❌ Single  |
| `UserService.php`                             | All user updates                     | ✅ Reusable|
| `BootstrapUserResource.php`                   | User profile responses               | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                              | Condition                              |
| ---------------------------------- | -------------------------------------- |
| `email.unique`                     | Email taken by another user            |
| `signature.unique`                 | Signature taken by another user        |
| `password.min`                     | Password too short                     |
| `password.confirmed`               | Confirmation doesn't match             |
| `roles.*.exists`                   | Invalid role name                      |
| `permissions.*.exists`             | Invalid permission name                |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| Empty password                    | Removed from request (no password change)          |
| Same email as self                | Allowed (unique ignores self)                      |
| Removing all roles                | Empty array clears roles                           |
| Invalid phone format              | Caught and returned as validation error            |
| Moderator updating Super Admin    | Subject to role hierarchy rules                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │PUT /{user}/admin-upd  │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │ 2. role:Admin|Super   │                       │                    │
   │                       │ 3. Validate request   │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 4. updateUserProfile  │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 5. UPDATE user    │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │ 6. Sync roles     │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │ 7. BootstrapResource  │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| New admin-updatable field       | AdminUpdateUserRequest::rules()                       |
| Role hierarchy enforcement      | AdminUpdateUserRequest::authorize()                   |
| Audit logging                   | UserService::updateUserProfile()                      |

### 📁 File Locations Quick Reference

```
routes/api/admin.php:19                              ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserController.php:211-236                     ← Controller method
app/Http/Requests/Api/V1/User/
  └── AdminUpdateUserRequest.php                     ← Request validation
app/Services/User/
  └── UserService.php                                ← Update logic
app/Http/Resources/V1/User/
  └── BootstrapUserResource.php                      ← Response format
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit MSAB real-time events. Admin profile updates are administrative operations that don't require real-time notification.

---

## 9. Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `PUT /api/v1/users/{user}/admin-update` |
| **Domain**          | Admin - User Management              |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-04                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4+                                 |
