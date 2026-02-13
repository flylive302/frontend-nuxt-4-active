# POST /api/v1/auth/logout

> **Domain**: Authentication  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Terminates the current user session by revoking the authentication token used in the request.

### Responsibilities

- Revoke current access token (single-device logout)
- Log logout event for security auditing
- Return success confirmation

### What It Owns

| Owned            | Description                                          |
| ---------------- | ---------------------------------------------------- |
| Token revocation | Deletes current token from `personal_access_tokens`  |
| Logout logging   | Records logout event via SecurityEventLoggingService |

### External Dependencies

| Dependency                          | Type     | Purpose          |
| ----------------------------------- | -------- | ---------------- |
| Laravel Sanctum                     | Package  | Token management |
| Database (`personal_access_tokens`) | Eloquent | Token deletion   |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/auth/logout
```

### Authentication

✅ **Required** - Bearer token via `Authorization` header

### Rate Limiting

| Limiter         | Key Pattern           | Limits              |
| --------------- | --------------------- | ------------------- |
| `throttle.role` | Role-based throttling | Varies by user role |

### Middleware Stack

```
1. auth:sanctum    → Authenticates user via Sanctum token
2. throttle.role   → Role-based rate limiting
3. https.enforce   → Forces HTTPS in production
```

### Request Headers

| Header          | Required | Type               | Description         |
| --------------- | -------- | ------------------ | ------------------- |
| `Authorization` | ✅       | `Bearer {token}`   | Valid Sanctum token |
| `Accept`        | ✅       | `application/json` | Response format     |

### Request Body Schema

```json
{}
```

> **Note**: No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Logout successful",
  "data": null,
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Logout failed. Please try again.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                        |
| ----- | -------------------------------- |
| `200` | Logout successful, token revoked |
| `401` | Missing or invalid token         |
| `500` | Token deletion failed            |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/auth/logout                                 │
│                    Authorization: Bearer {token}                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:45                                                │
│ Route: Route::post('/logout', [AuthController::class, 'logout']);           │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum   → Validates Bearer token, attaches User to request      │
│   2. throttle.role  → Role-based rate limiting                              │
│   3. https.enforce  → Redirects to HTTPS in production                      │
│                                                                             │
│ If token invalid/missing → 401 Unauthenticated (before controller)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE: auth:sanctum                                                │
│─────────────────────────────────────────────────────────────────────────────│
│ Package: Laravel Sanctum                                                    │
│                                                                             │
│ WHAT IT DOES:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Extract token from Authorization: Bearer {token} header              │ │
│ │ 2. Hash token and lookup in personal_access_tokens table                │ │
│ │ 3. Verify token not expired                                             │ │
│ │ 4. Attach User model to $request->user()                                │ │
│ │ 5. Attach token to $user->currentAccessToken()                          │ │
│ │                                                                         │ │
│ │ Query: SELECT * FROM personal_access_tokens                             │ │
│ │        WHERE token = SHA256({token})                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Failure → 401 Unauthenticated                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/AuthController.php:84-106            │
│ Method: logout(Request $request): JsonResponse                              │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ │ // Note: Should never hit this due to auth:sanctum middleware           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to AuthenticationService                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $success = $this->authenticationService->logout($user);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return response based on result                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$success) {                                                        │ │
│ │     return ApiResponse::serverError('Logout failed. Please try again.');│ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(null, 'Logout successful');                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ LAYER 1: AuthenticationService (Facade)                                 │ │
│ │ File: app/Services/Auth/AuthenticationService.php:72-78                 │ │
│ │                                                                         │ │
│ │ public function logout(User $user): bool                                │ │
│ │ {                                                                       │ │
│ │     return $this->sessionService->logout($user);  // Delegates          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                       │
│                                     ▼                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ LAYER 2: SessionService (Core Logic)                                    │ │
│ │ File: app/Services/Auth/SessionService.php:133-152                      │ │
│ │                                                                         │ │
│ │ public function logout(User $user): bool                                │ │
│ │ {                                                                       │ │
│ │     try {                                                               │ │
│ │         // Get the token used for this request                          │ │
│ │         $currentToken = $user->currentAccessToken();                    │ │
│ │                                                                         │ │
│ │         if ($currentToken !== null) {                                   │ │
│ │             $currentToken->delete();  // DELETE from personal_access_tokens│
│ │         }                                                               │ │
│ │                                                                         │ │
│ │         // Log logout event                                             │ │
│ │         $this->securityLogger->logUserLogout($user);                    │ │
│ │                                                                         │ │
│ │         return true;                                                    │ │
│ │     } catch (\Exception $e) {                                           │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Key Points:                                                             │ │
│ │   • Only deletes CURRENT token (single-device logout)                   │ │
│ │   • Other device tokens remain valid                                    │ │
│ │   • Exception handling returns false, not 500                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: SecurityEventLoggingService                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/SecurityEventLoggingService.php                 │ │
│ │ Responsibility: Log security-related events                             │ │
│ │ Reusable: YES (All auth operations)                                     │ │
│ │                                                                         │ │
│ │ Method Used:                                                            │ │
│ │   • logUserLogout(user) → Records logout with timestamp, user ID        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User Model (currentAccessToken)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php (via HasApiTokens trait)                 │ │
│ │ Responsibility: Access current Sanctum token                            │ │
│ │                                                                         │ │
│ │ Method Used:                                                            │ │
│ │   • $user->currentAccessToken() → Returns PersonalAccessToken model     │ │
│ │     Set by auth:sanctum middleware during request                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: PersonalAccessToken (Sanctum)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Package: Laravel\Sanctum\PersonalAccessToken                            │ │
│ │ Responsibility: Token model representing auth tokens                    │ │
│ │                                                                         │ │
│ │ Method Used:                                                            │ │
│ │   • $token->delete() → DELETE FROM personal_access_tokens WHERE id = ?  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT token (auth:sanctum middleware)                                   │
│    Query: SELECT * FROM personal_access_tokens WHERE token = ?              │
│    Source: Sanctum middleware                                               │
│                                                                             │
│ 2. DELETE current token                                                     │
│    Query: DELETE FROM personal_access_tokens WHERE id = ?                   │
│    Source: $currentToken->delete()                                          │
│                                                                             │
│ LOGGING:                                                                    │
│                                                                             │
│ 1. Security log entry                                                       │
│    Source: SecurityEventLoggingService::logUserLogout()                     │
│    Data: user_id, timestamp, ip_address                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SUCCESS PATH:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(null, 'Logout successful');                        │ │
│ │                                                                         │ │
│ │ → HTTP 200 + JSON envelope:                                             │ │
│ │   {                                                                     │ │
│ │     "status": "success",                                                │ │
│ │     "message": "Logout successful",                                     │ │
│ │     "data": null,                                                       │ │
│ │     "meta": { "timestamp": "...", "correlation_id": "..." }             │ │
│ │   }                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: data is null because no data to return                                │
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

| File                              | Used By Endpoints                    | Reusable    | Reasoning                       |
| --------------------------------- | ------------------------------------ | ----------- | ------------------------------- |
| `AuthController.php`              | Register, Login, Logout, User        | ⭕ Mixed    | Controller is endpoint-specific |
| `AuthenticationService.php`       | Register, Login, Logout, Social Auth | ✅ Reusable | Coordinator for all auth flows  |
| `SessionService.php`              | Login, Logout                        | ✅ Reusable | Session management              |
| `SecurityEventLoggingService.php` | All auth operations                  | ✅ Reusable | Security audit logging          |
| `ApiResponse.php`                 | All API endpoints                    | ✅ Reusable | Global response envelope        |
| `User.php` (HasApiTokens trait)   | All token operations                 | ✅ Reusable | Sanctum integration             |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error                     | Source                    | Condition                     |
| ------------------------- | ------------------------- | ----------------------------- |
| "Authentication required" | `AuthController`          | `$request->user()` is null    |
| "Unauthenticated"         | `auth:sanctum` middleware | Invalid/missing/expired token |

### System Errors (500)

| Error                              | Source           | Condition                               |
| ---------------------------------- | ---------------- | --------------------------------------- |
| "Logout failed. Please try again." | `AuthController` | `SessionService.logout()` returns false |

### Edge Cases

| Case                                 | Behavior                                        |
| ------------------------------------ | ----------------------------------------------- |
| Token already deleted                | Returns success (currentToken is null, no-op)   |
| Concurrent logout requests           | First succeeds, subsequent get 401 (token gone) |
| Network failure during delete        | Returns 500, token may or may not be deleted    |
| User deleted between auth and logout | Logout still works (token deleted)              |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE              CONTROLLER            SESSION SERVICE           DATABASE
   │                     │                       │                       │                      │
   │  POST /logout       │                       │                       │                      │
   │  Authorization: ... │                       │                       │                      │
   │────────────────────▶│                       │                       │                      │
   │                     │                       │                       │                      │
   │                     │ 1. auth:sanctum       │                       │                      │
   │                     │    (validate token)   ───────────────────────────────────────────────▶
   │                     │◀─────────────────────────────────── SELECT personal_access_tokens ──│
   │                     │    (attach user)      │                       │                      │
   │                     │                       │                       │                      │
   │                     │ 2. throttle.role      │                       │                      │
   │                     │                       │                       │                      │
   │                     │ 3. Forward to         │                       │                      │
   │                     │    controller         │                       │                      │
   │                     │──────────────────────▶│                       │                      │
   │                     │                       │                       │                      │
   │                     │                       │ 4. Get user           │                      │
   │                     │                       │    $request->user()   │                      │
   │                     │                       │                       │                      │
   │                     │                       │ 5. Call logout()      │                      │
   │                     │                       │──────────────────────▶│                      │
   │                     │                       │                       │                      │
   │                     │                       │                       │ 6. Get current       │
   │                     │                       │                       │    access token      │
   │                     │                       │                       │                      │
   │                     │                       │                       │ 7. Delete token      │
   │                     │                       │                       │─────────────────────▶│
   │                     │                       │                       │◀─ DELETE tokens ... ─│
   │                     │                       │                       │                      │
   │                     │                       │                       │ 8. Log logout        │
   │                     │                       │                       │    (security event)  │
   │                     │                       │                       │                      │
   │                     │                       │ 9. Return true        │                      │
   │                     │                       │◀──────────────────────│                      │
   │                     │                       │                       │                      │
   │                     │                       │ 10. Build response    │                      │
   │                     │◀──────────────────────│                       │                      │
   │                     │                       │                       │                      │
   │◀────────────────────│                       │                       │                      │
   │                     │                       │                       │                      │
   │  200 + Success JSON │                       │                       │                      │
   │                     │                       │                       │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                                | Location                                              |
| --------------------------------------- | ----------------------------------------------------- |
| Logout from all devices                 | Use `SessionService::logoutFromAllDevices()`          |
| Logout webhook/notification             | Add after token deletion in `SessionService.logout()` |
| Logout reason tracking                  | Add parameter to logout methods                       |
| Invalidate specific resources on logout | Add to `SessionService.logout()` after token deletion |

### 📝 Related Method: Logout All Devices

```php
// SessionService::logoutFromAllDevices()
// File: app/Services/Auth/SessionService.php:154-167

public function logoutFromAllDevices(User $user): bool
{
    try {
        $this->tokenManagementService->revokeAllTokens($user);
        $this->securityLogger->logUserLogoutAllDevices($user);
        return true;
    } catch (\Exception $e) {
        return false;
    }
}
```

To expose this, add a new endpoint:

```php
// Route: POST /api/v1/auth/logout-all
Route::post('/logout-all', [AuthController::class, 'logoutAll']);
```

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `auth:sanctum` middleware | Core authentication - removing breaks all protected routes |
| Token deletion order      | Must delete before logging for accurate audit              |
| Return type (bool)        | Controller depends on this for error handling              |

### 🚨 Common Pitfalls

| Pitfall                    | Prevention                                            |
| -------------------------- | ----------------------------------------------------- |
| Forgetting to delete token | Always use `$currentToken->delete()`, not just return |
| Logging before deletion    | If deletion fails, log is misleading                  |
| Exposing token in logs     | Never log the token value itself                      |
| Breaking 401 flow          | Don't catch auth:sanctum exceptions in controller     |

### 📁 File Locations Quick Reference

```
routes/api/auth.php:45                           ← Route definition
app/Http/Controllers/Api/V1/Auth/
  └── AuthController.php:84-106                  ← Controller method
app/Services/Auth/
  ├── AuthenticationService.php:72-78            ← Facade/coordinator
  ├── SessionService.php:133-152                 ← Core logout logic
  └── SecurityEventLoggingService.php            ← Security audit logging
app/Models/User/
  └── User.php (HasApiTokens trait)              ← currentAccessToken()
```

---

## Document Metadata

| Property            | Value                      |
| ------------------- | -------------------------- |
| **Endpoint**        | `POST /api/v1/auth/logout` |
| **Domain**          | Authentication             |
| **Author**          | System Documentation       |
| **Created**         | 2026-01-27                 |
| **Laravel Version** | 12.x                       |
| **PHP Version**     | 8.4                        |
