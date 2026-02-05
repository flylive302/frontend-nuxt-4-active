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