# Email Verification Endpoints

> **Domain**: Authentication  
> **Version**: V1  
> **Last Updated**: 2026-01-27

---

## Endpoints Overview

| Method | Endpoint                    | Auth      | Description               |
| ------ | --------------------------- | --------- | ------------------------- |
| `POST` | `/api/v1/auth/email/verify` | ❌ Public | Verify email with token   |
| `POST` | `/api/v1/auth/email/resend` | ✅ Bearer | Resend verification email |
| `GET`  | `/api/v1/auth/email/status` | ✅ Bearer | Get verification status   |

---

## 1. Domain Overview

### Purpose

Manage email verification flow for user accounts. Ensures users own the email addresses they register with, enabling email-based features and account recovery.

### Responsibilities

- Generate and send verification emails with secure tokens
- Validate verification tokens and mark emails as verified
- Resend verification emails on demand
- Report verification status

### What It Owns

| Owned                       | Description                           |
| --------------------------- | ------------------------------------- |
| `email_verification_tokens` | Token generation, validation, cleanup |
| `users.email_verified_at`   | Verification timestamp                |
| Verification emails         | Email template and dispatch           |

### External Dependencies

| Dependency                             | Type     | Purpose                  |
| -------------------------------------- | -------- | ------------------------ |
| Database (`email_verification_tokens`) | Eloquent | Token storage            |
| Database (`users`)                     | Eloquent | User email status        |
| Mail (Laravel)                         | Facade   | Send verification emails |
| Cache                                  | Laravel  | User cache invalidation  |

---

# POST /api/v1/auth/email/verify

## 2.1 API Contract

### Endpoint

```
POST /api/v1/auth/email/verify
```

### Authentication

❌ **None Required** - Public endpoint (token-based verification)

### Rate Limiting

| Limiter                        | Key Pattern      | Limits                    |
| ------------------------------ | ---------------- | ------------------------- |
| `auth.rate_limit:email_verify` | Credential-based | Configured via middleware |

### Middleware Stack

```
1. https.enforce            → Forces HTTPS in production
2. auth.rate_limit:email_verify → Rate limiting
```

### Request Headers

| Header             | Required | Type               | Description         |
| ------------------ | -------- | ------------------ | ------------------- |
| `Content-Type`     | ✅       | `application/json` | Request body format |
| `Accept`           | ✅       | `application/json` | Response format     |
| `X-Correlation-ID` | ❌       | `string`           | Request tracking ID |

### Request Body Schema

```json
{
  "token": "string" // Required, exactly 64 characters
}
```

| Field   | Type     | Constraints       | Description                   |
| ------- | -------- | ----------------- | ----------------------------- |
| `token` | `string` | Required, size:64 | Verification token from email |

### Response Schemas

#### ✅ Success (200)

```json
{
  "status": "success",
  "message": "Email verified successfully.",
  "data": {
    "verified": true,
    "verified_at": "2026-01-27T15:00:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Invalid Token (400)

```json
{
  "status": "error",
  "message": "Invalid or expired verification token.",
  "data": null,
  "meta": {
    "error_code": "INVALID_VERIFICATION_TOKEN",
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "token": ["Verification token is required."]
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Email verification failed. Please try again.",
  "data": null,
  "meta": {
    "error_code": "VERIFICATION_FAILED",
    "timestamp": "...",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                   |
| ----- | --------------------------- |
| `200` | Email verified successfully |
| `400` | Invalid or expired token    |
| `422` | Validation failed           |
| `429` | Rate limited                |
| `500` | Server error                |

---

## 2.2 Execution Waterfall

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POST /api/v1/auth/email/verify                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT                                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:36-37                                             │
│ Route: Route::post('/verify', [EmailVerificationController::class, 'verify'])│
│        ->middleware('auth.rate_limit:email_verify');                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ REQUEST VALIDATION                                                          │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Auth/EmailVerificationRequest.php            │
│                                                                             │
│ Rules:                                                                      │
│   • token: required, string, size:64                                        │
│                                                                             │
│ Failure → 422 with validation errors                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER                                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/EmailVerificationController.php:27-79│
│ Method: verify(EmailVerificationRequest $request)                           │
│                                                                             │
│ 1. Get correlation ID from header or generate UUID                          │
│ 2. Call EmailVerificationService::verifyEmail(token)                        │
│ 3. Return success or error response                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER                                                               │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Auth/EmailVerificationService.php:38-84                  │
│ Method: verifyEmail(string $token): bool                                    │
│                                                                             │
│ FLOW:                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. SELECT token from email_verification_tokens WHERE token = ?          │ │
│ │    WITH user relationship                                               │ │
│ │                                                                         │ │
│ │ 2. Check: token exists AND not expired                                  │ │
│ │    → If invalid/expired: return false                                   │ │
│ │                                                                         │ │
│ │ 3. Check: token has associated user                                     │ │
│ │    → If no user: return false                                           │ │
│ │                                                                         │ │
│ │ 4. UPDATE users SET email_verified_at = NOW() WHERE id = ?              │ │
│ │                                                                         │ │
│ │ 5. DELETE token (one-time use)                                          │ │
│ │                                                                         │ │
│ │ 6. Flush user cache                                                     │ │
│ │    → Tags-based if Redis/Memcached                                      │ │
│ │    → Key-based fallback for file/database                               │ │
│ │                                                                         │ │
│ │ 7. Log success and return true                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# POST /api/v1/auth/email/resend

## 3.1 API Contract

### Endpoint

```
POST /api/v1/auth/email/resend
```

### Authentication

✅ **Required** - Bearer token via `Authorization` header

### Rate Limiting

| Limiter                        | Key Pattern | Limits                    |
| ------------------------------ | ----------- | ------------------------- |
| `auth.rate_limit:email_verify` | User-based  | Configured via middleware |
| `throttle.role`                | Role-based  | Varies by role            |

### Middleware Stack

```
1. auth:sanctum             → Validates Bearer token
2. throttle.role            → Role-based rate limiting
3. https.enforce            → Forces HTTPS in production
4. auth.rate_limit:email_verify → Additional rate limiting
```

### Request Headers

| Header             | Required | Type               | Description         |
| ------------------ | -------- | ------------------ | ------------------- |
| `Authorization`    | ✅       | `Bearer {token}`   | Valid Sanctum token |
| `Accept`           | ✅       | `application/json` | Response format     |
| `X-Correlation-ID` | ❌       | `string`           | Request tracking ID |

### Request Body Schema

```json
{}
```

> **Note**: No request body required.

### Authorization Check

User must have an email address set (`$user->email !== null`).

### Response Schemas

#### ✅ Success (200)

```json
{
  "status": "success",
  "message": "Verification email sent successfully.",
  "data": {
    "email": "user@example.com",
    "sent_at": "2026-01-27T15:00:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Already Verified (400)

```json
{
  "status": "error",
  "message": "Email is already verified.",
  "data": null,
  "meta": {
    "error_code": "EMAIL_ALREADY_VERIFIED",
    "timestamp": "...",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Authentication required.",
  "data": null,
  "meta": {
    "error_code": "AUTHENTICATION_REQUIRED",
    "timestamp": "...",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden (403)

Occurs when user has no email address set.

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to send verification email. Please try again.",
  "data": null,
  "meta": {
    "error_code": "RESEND_FAILED",
    "timestamp": "...",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                   |
| ----- | --------------------------- |
| `200` | Email sent successfully     |
| `400` | Email already verified      |
| `401` | Not authenticated           |
| `403` | No email address on account |
| `429` | Rate limited                |
| `500` | Server error                |

---

## 3.2 Execution Waterfall

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POST /api/v1/auth/email/resend                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT                                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:49-50                                             │
│ Route: Route::post('/resend', ...)                                          │
│        ->middleware('auth.rate_limit:email_verify');                        │
│                                                                             │
│ Parent middleware: auth:sanctum, throttle.role, https.enforce               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ REQUEST AUTHORIZATION                                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Auth/ResendEmailVerificationRequest.php      │
│                                                                             │
│ authorize(): bool                                                           │
│   return $this->user() !== null && $this->user()->email !== null;           │
│                                                                             │
│ Failure → 403 Forbidden                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER                                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/EmailVerificationController.php:81-151│
│ Method: resend(ResendEmailVerificationRequest $request)                     │
│                                                                             │
│ 1. Get user from request                                                    │
│ 2. Check if already verified → return 400                                   │
│ 3. Call EmailVerificationService::resendVerification(user)                  │
│ 4. Return success response                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER                                                               │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Auth/EmailVerificationService.php:86-111                 │
│ Method: resendVerification(User $user): void                                │
│                                                                             │
│ FLOW:                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Check if already verified → return early (no-op)                     │ │
│ │                                                                         │ │
│ │ 2. DELETE existing tokens for user                                      │ │
│ │    Query: DELETE FROM email_verification_tokens WHERE user_id = ?       │ │
│ │                                                                         │ │
│ │ 3. Generate new token via User::generateEmailVerificationToken()        │ │
│ │    Query: INSERT INTO email_verification_tokens ...                     │ │
│ │                                                                         │ │
│ │ 4. Send verification email via Mail facade                              │ │
│ │    Mailable: App\Mail\EmailVerificationMail                             │ │
│ │                                                                         │ │
│ │ 5. Log resend event                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# GET /api/v1/auth/email/status

## 4.1 API Contract

### Endpoint

```
GET /api/v1/auth/email/status
```

### Authentication

✅ **Required** - Bearer token via `Authorization` header

### Middleware Stack

```
1. auth:sanctum    → Validates Bearer token
2. throttle.role   → Role-based rate limiting
3. https.enforce   → Forces HTTPS in production
```

### Request Headers

| Header          | Required | Type               | Description         |
| --------------- | -------- | ------------------ | ------------------- |
| `Authorization` | ✅       | `Bearer {token}`   | Valid Sanctum token |
| `Accept`        | ✅       | `application/json` | Response format     |

### Request Body

None (GET request)

### Response Schemas

#### ✅ Success (200)

```json
{
  "status": "success",
  "message": "Email verification status retrieved.",
  "data": {
    "email": "user@example.com",
    "is_verified": true,
    "verified_at": "2026-01-27T15:00:00.000000Z",
    "needs_verification": false
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field                | Type           | Description                           |
| -------------------- | -------------- | ------------------------------------- |
| `email`              | `string\|null` | User's email address                  |
| `is_verified`        | `boolean`      | Whether email is verified             |
| `verified_at`        | `string\|null` | ISO 8601 verification timestamp       |
| `needs_verification` | `boolean`      | True if email exists AND not verified |

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Authentication required.",
  "data": null,
  "meta": {
    "error_code": "AUTHENTICATION_REQUIRED",
    "timestamp": "...",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition         |
| ----- | ----------------- |
| `200` | Status retrieved  |
| `401` | Not authenticated |

---

## 4.2 Execution Waterfall

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GET /api/v1/auth/email/status                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT                                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:51                                                │
│ Route: Route::get('/status', [EmailVerificationController::class, 'status'])│
│                                                                             │
│ Parent middleware: auth:sanctum, throttle.role, https.enforce               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER                                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/EmailVerificationController.php:153-189│
│ Method: status(Request $request)                                            │
│                                                                             │
│ 1. Get user from request                                                    │
│ 2. Check if user is null → return 401                                       │
│ 3. Return status data:                                                      │
│    • email                                                                  │
│    • is_verified: $user->isEmailVerified()                                  │
│    • verified_at                                                            │
│    • needs_verification: service->needsVerification($user)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SERVICE METHOD                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Auth/EmailVerificationService.php:133-139                │
│ Method: needsVerification(User $user): bool                                 │
│                                                                             │
│ return !$user->isEmailVerified() && $user->email !== null;                  │
│                                                                             │
│ Returns true only if:                                                       │
│   1. Email is NOT verified                                                  │
│   2. User has an email address                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Reusability Matrix

| File                                     | Used By Endpoints                 | Reusable          | Reasoning                              |
| ---------------------------------------- | --------------------------------- | ----------------- | -------------------------------------- |
| `EmailVerificationController.php`        | verify, resend, status            | ⭕ Mixed          | Controller is endpoint-specific        |
| `EmailVerificationService.php`           | All email verification + Register | ✅ Reusable       | Central service for email verification |
| `EmailVerificationRequest.php`           | /verify only                      | ❌ Single-purpose | Endpoint-specific validation           |
| `ResendEmailVerificationRequest.php`     | /resend only                      | ❌ Single-purpose | Endpoint-specific authorization        |
| `EmailVerificationToken.php` (Model)     | Service layer                     | ✅ Reusable       | Token entity model                     |
| `EmailVerificationMail.php`              | Service layer                     | ✅ Reusable       | Email template                         |
| `User::generateEmailVerificationToken()` | Service layer                     | ✅ Reusable       | Token generation                       |
| `User::isEmailVerified()`                | Throughout application            | ✅ Reusable       | Verification check                     |

---

## 6. Error Handling & Edge Cases

### Validation Errors (422)

| Error            | Source                     | Condition          |
| ---------------- | -------------------------- | ------------------ |
| `token.required` | `EmailVerificationRequest` | Token missing      |
| `token.size`     | `EmailVerificationRequest` | Token not 64 chars |

### Business Logic Errors

| Error                   | Code | Source        | Condition                  |
| ----------------------- | ---- | ------------- | -------------------------- |
| Invalid/expired token   | 400  | `verify`      | Token not found or expired |
| Email already verified  | 400  | `resend`      | User already verified      |
| No email on account     | 403  | `resend`      | `$user->email === null`    |
| Authentication required | 401  | All protected | Missing/invalid token      |

### Edge Cases

| Case                          | Behavior                                           |
| ----------------------------- | -------------------------------------------------- |
| Token used twice              | First succeeds, second returns 400 (token deleted) |
| Resend while already verified | Returns 400 (no email sent)                        |
| User has no email             | /resend returns 403, /status shows null email      |
| Token expires                 | Returns 400 with INVALID_VERIFICATION_TOKEN        |
| Concurrent resend requests    | Last token wins (previous tokens deleted)          |

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                     |
| --------------------------- | -------------------------------------------- |
| Token expiry configuration  | `EmailVerificationToken` model or config     |
| Different email templates   | Create new Mailable class                    |
| Webhook on verification     | Add after `verifyEmail()` success in service |
| Custom verification URL     | Modify `EmailVerificationMail`               |
| Admin verification override | Use `markEmailAsVerified()` method           |

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                           |
| ----------------------------- | -------------------------------- |
| Token size (64 chars)         | Security - sufficient entropy    |
| Token deletion after use      | Security - one-time tokens       |
| Rate limiting on verify       | Security - prevent brute force   |
| Authorization check on resend | Security - only owner can resend |

### 📁 File Locations Quick Reference

```
routes/api/auth.php:35-38, 48-52                 ← Route definitions
app/Http/Controllers/Api/V1/Auth/
  └── EmailVerificationController.php            ← Controller
app/Http/Requests/Api/V1/Auth/
  ├── EmailVerificationRequest.php               ← /verify validation
  └── ResendEmailVerificationRequest.php         ← /resend authorization
app/Services/Auth/
  └── EmailVerificationService.php               ← Core service
app/Models/User/
  ├── User.php                                   ← User model methods
  └── EmailVerificationToken.php                 ← Token model
app/Mail/
  └── EmailVerificationMail.php                  ← Email template
```

---

## Document Metadata

| Property            | Value                           |
| ------------------- | ------------------------------- |
| **Endpoints**       | `/verify`, `/resend`, `/status` |
| **Domain**          | Authentication                  |
| **Author**          | System Documentation            |
| **Created**         | 2026-01-27                      |
| **Laravel Version** | 12.x                            |
| **PHP Version**     | 8.4                             |
