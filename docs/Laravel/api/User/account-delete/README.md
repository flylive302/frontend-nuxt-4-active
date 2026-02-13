# DELETE /api/v1/account

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Account Deletion endpoint allows authenticated users to permanently delete their own account with GDPR-compliant PII (Personally Identifiable Information) purging. This is an irreversible operation that removes personal data while preserving the signature for transaction history compliance.

### Responsibilities

- Authenticate request via Sanctum token
- Validate deletion reason (required for compliance)
- Revoke all authentication tokens
- Purge PII data (name, email, phone, avatar, country)
- Preserve signature for transaction history
- Soft delete user account
- Remove roles, permissions, and related auth data
- Invalidate all caches
- Dispatch UserDeleted event
- Log security event for audit trail

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| PII purging                 | Clears personal data for GDPR compliance             |
| Token revocation            | Revokes all user's authentication tokens             |
| Soft delete                 | Marks account as deleted while preserving ID         |
| Role/permission cleanup     | Detaches all roles and permissions                   |
| Related data cleanup        | Deletes social accounts, email tokens                |
| Audit logging               | Creates security event for compliance                |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `users` table               | Database       | User data storage                           |
| `personal_access_tokens`    | Database       | Token storage (Sanctum)                     |
| `social_accounts` table     | Database       | OAuth account links                         |
| `email_verification_tokens` | Database       | Email verification tokens                   |
| `model_has_roles` table     | Database       | Spatie role assignments                     |
| `model_has_permissions`     | Database       | Spatie permission assignments               |
| Laravel Sanctum             | Package        | Token authentication                        |
| AccountDeletionService      | Service        | Deletion business logic                     |
| TokenManagementService      | Service        | Token revocation                            |
| SecurityEventLoggingService | Service        | Audit logging                               |
| CacheService                | Service        | Cache invalidation                          |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/account
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter              | Key               | Config                              |
| -------------------- | ----------------- | ----------------------------------- |
| `throttle.role`      | Role-based        | Varies by user role                 |
| `auth.rate_limit`    | account_deletion  | Strict limit for sensitive operation|

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
  "reason": "I no longer need this account and want my data deleted."
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
  "message": "Your account has been deleted successfully. All personal information has been purged for compliance.",
  "data": null,
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
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Account deletion failed",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Account deleted successfully        |
| `401` | Unauthenticated (token invalid)     |
| `422` | Validation failed (reason missing/invalid) |
| `429` | Rate limit exceeded                 |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/account                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/profile.php:31-32                                          │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('account')->group(function () {                           │ │
│ │     Route::delete('/', [AccountDeletionController::class,               │ │
│ │         'deleteOwnAccount'])                                            │ │
│ │         ->middleware('auth.rate_limit:account_deletion');               │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum             → Validates Bearer token                      │
│   2. throttle.role            → Role-based rate limiting                    │
│   3. https.enforce            → Enforces HTTPS in production                │
│   4. auth.rate_limit          → Account deletion specific rate limit        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/DeleteAccountRequest.php                │
│                                                                             │
│ Authorization Check (lines 14-17):                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return true; // Authorization is handled in the controller          │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules (lines 24-28):                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'reason' => ['required', 'string', 'max:500', 'min:10'],        │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Error Messages (lines 36-43):                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'reason.required' => 'A reason for account deletion is required.',      │ │
│ │ 'reason.min' => 'The deletion reason must be at least 10 characters.',  │ │
│ │ 'reason.max' => 'The deletion reason cannot exceed 500 characters.',    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/AccountDeletionController.php        │
│ Method: deleteOwnAccount(DeleteAccountRequest $request) at line 28          │
│                                                                             │
│ STEP 1: Get Authenticated User (line 31)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ /** @var User $user */                                                  │ │
│ │ $user = Auth::user();                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call Account Deletion Service (lines 33-37)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     $this->accountDeletionService->deleteAccountWithPiiPurging(         │ │
│ │         $user,                                                          │ │
│ │         $request->validated()['reason']                                 │ │
│ │             ?? 'User requested account deletion'                        │ │
│ │     );                                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Success Response (lines 39-47)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Your account has been deleted successfully. '         │ │
│ │                . 'All personal information has been purged...',         │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $request->header('X-Correlation-ID'),       │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Error Handling (lines 48-50)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     return $this->errorResponder->serverError($e, 'Account deletion...')│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/AccountDeletionService.php                          │
│ Method: deleteAccountWithPiiPurging() at lines 31-103                       │
│                                                                             │
│ All operations wrapped in DB::transaction() for atomicity                   │
│                                                                             │
│ STEP 1: Store Original Data for Audit (lines 34-43)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $originalData = $user->only([                                           │ │
│ │     'id', 'name', 'email', 'phone', 'signature',                        │ │
│ │     'email_verified_at', 'phone_verified_at',                           │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Revoke All Tokens (line 46)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->tokenManagementService->revokeAllTokens($user);                  │ │
│ │ // Immediately invalidates all sessions and API tokens                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Purge PII Data (lines 49-63)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->update([                                                         │ │
│ │     'name' => null,                                                     │ │
│ │     'email' => null,                                                    │ │
│ │     'phone' => null,                                                    │ │
│ │     'country' => null,                                                  │ │
│ │     'avatar' => null,                                                   │ │
│ │     'email_verified_at' => null,                                        │ │
│ │     'phone_verified_at' => null,                                        │ │
│ │     'is_blocked' => true,                                               │ │
│ │     'blocked_at' => now(),                                              │ │
│ │     'blocked_reason' => $reason                                         │ │
│ │         ?? 'Account deleted - PII purged for compliance',               │ │
│ │     'login_attempts' => 0,                                              │ │
│ │     'locked_until' => null,                                             │ │
│ │     'last_login_at' => null,                                            │ │
│ │ ]);                                                                     │ │
│ │ // Note: signature is preserved for transaction history                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Remove Roles and Permissions (lines 66-67)                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->roles()->detach();                                               │ │
│ │ $user->permissions()->detach();                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Delete Related Auth Data (lines 70-71)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->socialAccounts()->delete();                                      │ │
│ │ $user->emailVerificationTokens()->delete();                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Perform Soft Delete (line 74)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->delete();  // Sets deleted_at timestamp                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Log Security Event (lines 77-82)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->securityEventLoggingService->logAccountDeletion(                 │ │
│ │     $user,                                                              │ │
│ │     Auth::user(),  // Actor (same as $user for self-delete)             │ │
│ │     $reason,                                                            │ │
│ │     $originalData                                                       │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Invalidate All Caches (line 85)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->cacheService->invalidateUserCache($user->id);                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9: Dispatch UserDeleted Event (lines 88-93)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ event(new UserDeleted(                                                  │ │
│ │     user: $user,                                                        │ │
│ │     actor: Auth::user(),                                                │ │
│ │     forceDeleted: false,                                                │ │
│ │     userData: $originalData                                             │ │
│ │ ));                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 10: Log Success and Return (lines 95-102)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('User account deleted with PII purging', [                    │ │
│ │     'user_id' => $user->id,                                             │ │
│ │     'signature_preserved' => $user->signature,                          │ │
│ │     'actor_id' => Auth::id(),                                           │ │
│ │     'reason' => $reason,                                                │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ return true;                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AccountDeletionService                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/User/AccountDeletionService.php                      │ │
│ │ Responsibility: Account lifecycle management (delete, restore)          │ │
│ │ Reusable: YES (used by user self-delete, admin delete)                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deleteAccountWithPiiPurging() → Soft delete with PII purge          │ │
│ │   • restoreAccount() → Restore deleted account with new signature       │ │
│ │   • forceDeleteAccount() → Permanent deletion                           │ │
│ │   • getRestorableUsers() → List accounts that can be restored           │ │
│ │   • getDeletionStats() → Account deletion statistics                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: TokenManagementService                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/TokenManagementService.php                      │ │
│ │ Responsibility: Sanctum token lifecycle                                 │ │
│ │ Reusable: YES (used by logout, password reset, account deletion)        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • revokeAllTokens($user) → Deletes all personal_access_tokens         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SecurityEventLoggingService                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/SecurityEventLoggingService.php                 │ │
│ │ Responsibility: Security audit trail                                    │ │
│ │ Reusable: YES (used across security-sensitive operations)               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • logAccountDeletion() → Records deletion for compliance audit        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UserDeleted Event                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Events/User/UserDeleted.php                                   │ │
│ │ Responsibility: Broadcast user deletion for listeners                   │ │
│ │ Reusable: YES (consumed by multiple listeners)                          │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • User $user → The deleted user                                       │ │
│ │   • ?User $actor → Who performed the deletion                           │ │
│ │   • bool $forceDeleted → Whether it was a permanent deletion            │ │
│ │   • array $userData → Original data for audit                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiErrorResponder                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Responses/ApiErrorResponder.php                          │ │
│ │ Responsibility: Standardized error response formatting                  │ │
│ │ Reusable: YES (used across controllers)                                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • serverError($exception, $message) → 500 response                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (within single transaction):                            │
│                                                                             │
│ 1. SELECT: Token validation (Sanctum middleware)                            │
│    Query: SELECT * FROM personal_access_tokens WHERE token = ?              │
│                                                                             │
│ 2. SELECT: User retrieval (Sanctum middleware)                              │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ 3. DELETE: Revoke all tokens                                                │
│    Query: DELETE FROM personal_access_tokens WHERE tokenable_id = ?         │
│                                                                             │
│ 4. UPDATE: Purge PII data                                                   │
│    Query: UPDATE users SET name=NULL, email=NULL, phone=NULL, ... WHERE id=?│
│                                                                             │
│ 5. DELETE: Remove role assignments                                          │
│    Query: DELETE FROM model_has_roles WHERE model_id = ?                    │
│                                                                             │
│ 6. DELETE: Remove permission assignments                                    │
│    Query: DELETE FROM model_has_permissions WHERE model_id = ?              │
│                                                                             │
│ 7. DELETE: Social accounts                                                  │
│    Query: DELETE FROM social_accounts WHERE user_id = ?                     │
│                                                                             │
│ 8. DELETE: Email verification tokens                                        │
│    Query: DELETE FROM email_verification_tokens WHERE user_id = ?           │
│                                                                             │
│ 9. UPDATE: Soft delete user                                                 │
│    Query: UPDATE users SET deleted_at = NOW() WHERE id = ?                  │
│                                                                             │
│ 10. INSERT: Security event log                                              │
│     Query: INSERT INTO security_events ...                                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   1. FLUSH: User cache                                                      │
│      Operation: $cacheService->invalidateUserCache($userId)                 │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   1. EVENT: UserDeleted dispatched (may trigger queued listeners)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Direct JSON response construction in controller (not using ApiResponse)     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Your account has been deleted successfully...',       │ │
│ │     'data' => null,  // No user data returned (deleted)                 │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $request->header('X-Correlation-ID'),       │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: No user data returned as account is deleted and PII purged            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
│                                                                             │
│    Note: Client's token is now invalidated - subsequent requests            │
│          will receive 401 Unauthenticated                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `AccountDeletionController.php`               | Account deletion endpoints           | ⭕ Mixed   | Controller for account lifecycle             |
| `DeleteAccountRequest.php`                    | User delete, admin delete            | ✅ Reusable| Shared validation for deletion reason        |
| `AccountDeletionService.php`                  | User delete, admin delete, restore   | ✅ Reusable| Core deletion business logic                 |
| `TokenManagementService.php`                  | Logout, password reset, deletion     | ✅ Reusable| Token lifecycle management                   |
| `SecurityEventLoggingService.php`             | All security-sensitive operations    | ✅ Reusable| Audit trail service                          |
| `ApiErrorResponder.php`                       | Multiple controllers                 | ✅ Reusable| Error response formatting                    |
| `CacheService.php`                            | Multiple services                    | ✅ Reusable| Cache management utility                     |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                    | Source               | Condition                             |
| ------------------------ | -------------------- | ------------------------------------- |
| `reason.required`        | DeleteAccountRequest | Deletion reason not provided          |
| `reason.min`             | DeleteAccountRequest | Reason less than 10 characters        |
| `reason.max`             | DeleteAccountRequest | Reason exceeds 500 characters         |
| `reason.string`          | DeleteAccountRequest | Reason is not a valid string          |

### Business Logic Errors

| Error | Source | Condition |
| ----- | ------ | --------- |
| None  | N/A    | Deletion is always allowed for authenticated user |

### System Errors (500)

| Error                        | Source                    | Condition                        |
| ---------------------------- | ------------------------- | -------------------------------- |
| Database transaction failure | DB::transaction()         | Any operation fails within trans |
| Token revocation failure     | TokenManagementService    | Database error during delete     |
| Cache invalidation failure   | CacheService              | Redis connection error           |
| Event dispatch failure       | Event dispatcher          | Listener throws exception        |

### Edge Cases

| Case                                | Behavior                                              |
| ----------------------------------- | ----------------------------------------------------- |
| User already soft deleted           | Should not reach this (token already revoked)         |
| Concurrent deletion requests        | Transaction handles - second request fails gracefully |
| Very long reason (boundary)         | Truncated to 500 characters by validation             |
| No correlation ID header            | Meta includes null value                              |
| Rate limit exceeded                 | 429 response before reaching controller               |
| Admin deletes own account           | Same flow - treated as self-deletion                  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │DELETE /api/v1/account │                       │                       │                    │
   │{ reason: "..." }      │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │    Validate token     │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 2. auth.rate_limit    │                       │                    │
   │                       │    account_deletion   │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 3. DeleteAccountReq   │                       │                    │
   │                       │    validates reason   │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 4. Get Auth::user()   │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 5. Call service       │                    │
   │                       │                       │    deleteAccountWith  │                    │
   │                       │                       │    PiiPurging()       │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 6. BEGIN TRANS     │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 7. Store original  │
   │                       │                       │                       │    data for audit  │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 8. DELETE tokens   │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 9. UPDATE user     │
   │                       │                       │                       │    purge PII       │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 10. DELETE roles   │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 11. DELETE social  │
   │                       │                       │                       │     accounts       │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 12. Soft DELETE    │
   │                       │                       │                       │     user           │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │                       │ 13. Log security   │
   │                       │                       │                       │     event          │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 14. Invalidate     │
   │                       │                       │                       │     cache          │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 15. Dispatch       │
   │                       │                       │                       │     UserDeleted    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 16. COMMIT TRANS   │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │◀──────────────────────│◀───────────────────│
   │                       │                       │                       │                    │
   │                       │                       │ 17. Return JSON       │                    │
   │                       │                       │     response          │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │                       │                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
   │  Token now invalid    │                       │                       │                    │
   │                       │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Data export before deletion     | Add to AccountDeletionService before purge                  |
| Deletion confirmation email     | Add listener for UserDeleted event                          |
| Grace period before purge       | Schedule job instead of immediate purge                     |
| Additional data cleanup         | AccountDeletionService::deleteAccountWithPiiPurging()       |

### 📝 Field Modification Guide

#### ➕ ADDING GRACE PERIOD BEFORE DELETION

**Example: 7-day grace period before PII purge**

| Step  | File                                                  | What to Change                           |
| ----- | ----------------------------------------------------- | ---------------------------------------- |
| **1** | `app/Models/User/User.php`                            | Add `deletion_requested_at` column       |
| **2** | `app/Services/User/AccountDeletionService.php`        | Split into request + execute phases      |
| **3** | `app/Http/Controllers/Api/V1/User/AccountDeletionController.php` | Update response message       |
| **4** | `app/Console/Commands/PurgePendingDeletions.php`      | Create scheduled command                 |

**Detailed Code Changes:**

```php
// STEP 1: Migration
Schema::table('users', function (Blueprint $table) {
    $table->timestamp('deletion_requested_at')->nullable();
});

// STEP 2: AccountDeletionService - new method
public function requestAccountDeletion(User $user, string $reason): bool
{
    // Mark for deletion but don't purge yet
    $user->update([
        'deletion_requested_at' => now(),
        'blocked_reason' => $reason,
    ]);
    
    // Revoke tokens immediately
    $this->tokenManagementService->revokeAllTokens($user);
    
    return true;
}

// Scheduled command to execute after grace period
public function executePendingDeletions(): void
{
    $users = User::where('deletion_requested_at', '<=', now()->subDays(7))
        ->whereNull('deleted_at')
        ->get();
    
    foreach ($users as $user) {
        $this->deleteAccountWithPiiPurging($user, $user->blocked_reason);
    }
}
```

#### ➕ ADDING DATA EXPORT

```php
// Before purging in deleteAccountWithPiiPurging()
$exportData = $this->dataExportService->exportUserData($user);
$this->storageService->storeExport($user->id, $exportData);

// Then proceed with PII purge
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DELETION DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DELETE /api/v1/account { reason: "..." }                                   │
│       │                                                                     │
│       ▼                                                                     │
│  DeleteAccountRequest::rules()      ← Validates reason                      │
│       │                                                                     │
│       ▼                                                                     │
│  Controller::deleteOwnAccount()                                             │
│       │                                                                     │
│       ▼                                                                     │
│  AccountDeletionService::deleteAccountWithPiiPurging()                      │
│       │                                                                     │
│       ├──► DB::transaction() begins                                         │
│       │                                                                     │
│       ├──► $originalData = $user->only([...])        ← Store for audit      │
│       │                                                                     │
│       ├──► tokenService->revokeAllTokens($user)      ← Invalidate sessions  │
│       │                                                                     │
│       ├──► $user->update([name=>null, email=>null...])  ← Purge PII         │
│       │                                                                     │
│       ├──► $user->roles()->detach()                  ← Remove permissions   │
│       │                                                                     │
│       ├──► $user->socialAccounts()->delete()         ← Remove OAuth         │
│       │                                                                     │
│       ├──► $user->delete()                           ← Soft delete          │
│       │                                                                     │
│       ├──► securityEventLoggingService->log()        ← Audit trail          │
│       │                                                                     │
│       ├──► cacheService->invalidateUserCache()       ← Clear cache          │
│       │                                                                     │
│       ├──► event(new UserDeleted(...))               ← Notify listeners     │
│       │                                                                     │
│       └──► DB::transaction() commits                                        │
│                                                                             │
│  JSON Response { status: success, data: null }                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                           | Reason                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| Signature preservation              | Required for transaction history and legal compliance     |
| PII fields list                     | GDPR compliance - ensure all PII is listed                |
| DB::transaction() wrapper           | All operations must be atomic                             |
| Token revocation order              | Must happen early to prevent concurrent access            |
| Security event logging              | Required for compliance audit trail                       |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                                  |
| ------------------------------------ | ----------------------------------------------------------- |
| Not revoking tokens first            | Always revoke before DB changes to prevent race conditions  |
| Missing PII field in purge           | Review all user columns when adding new fields              |
| Transaction rollback on event fail   | Event listeners should be queued to not block transaction   |
| Forgetting related data              | Review all user relationships when adding new tables        |
| Re-using deleted email/phone         | PII is set to null, unique constraints won't conflict       |

### 📁 File Locations Quick Reference

```
routes/api/profile.php:31-32                        ← Route definition
app/Http/Controllers/Api/V1/User/
  └── AccountDeletionController.php:28-51           ← Controller method
app/Http/Requests/Api/V1/User/
  └── DeleteAccountRequest.php                      ← Request validation
app/Services/User/
  └── AccountDeletionService.php:31-103             ← Deletion logic
app/Services/Auth/
  ├── TokenManagementService.php                    ← Token revocation
  └── SecurityEventLoggingService.php               ← Audit logging
app/Events/User/
  └── UserDeleted.php                               ← Deletion event
app/Http/Responses/
  └── ApiErrorResponder.php                         ← Error responses
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `DELETE /api/v1/account`  |
| **Domain**          | User                      |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-04                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4+                      |
