# POST /api/v1/auth/login

> **Domain**: Authentication  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Authenticates existing users via email+password or phone+password, issuing a Sanctum token for subsequent authenticated requests.

### Responsibilities

- Validate user credentials (email or phone + password)
- Enforce multi-layer rate limiting (credential, IP, and account-based)
- Check user eligibility (not blocked, not locked, email verified for email logins)
- Create authentication token with single-device policy
- Record login history asynchronously
- Detect suspicious login patterns via device fingerprinting
- Cache user permissions for fast authorization checks

### What It Owns

| Owned                  | Description                           |
| ---------------------- | ------------------------------------- |
| Session creation       | Creates new authentication token      |
| Login attempt tracking | Increments/resets login attempts      |
| Rate limit management  | Credential and IP-based rate limiting |
| Login history dispatch | Fires event for async recording       |

### External Dependencies

| Dependency            | Type           | Purpose                                             |
| --------------------- | -------------- | --------------------------------------------------- |
| Database (`users`)    | Eloquent       | User lookup, login attempts update                  |
| Laravel Sanctum       | Package        | Token creation and management                       |
| Redis/Cache           | Infrastructure | Rate limiting, permission caching, negative caching |
| RateLimiter (Laravel) | Facade         | Credential/IP blocking                              |
| Event System          | Laravel        | Async login history recording                       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/auth/login
```

### Authentication

❌ **None Required** - Public endpoint for obtaining authentication tokens

### Rate Limiting

**Middleware-Level (Pre-Controller):**

| Limiter          | Key Pattern                            | Limits               |
| ---------------- | -------------------------------------- | -------------------- |
| Credential-based | `auth_credential:login:{email\|phone}` | 5 attempts / 15 min  |
| IP-based         | `auth_ip:{ip}`                         | 20 attempts / 60 min |

**Service-Level (In SessionService):**

| Limiter          | Key Pattern              | Limits               |
| ---------------- | ------------------------ | -------------------- |
| Credential-based | `login:credentials:{id}` | 5 attempts / 15 min  |
| IP-based         | `login:ip:{ip}`          | 10 attempts / 15 min |
| Account-based    | `login:user:{user_id}`   | 5 attempts / 30 min  |

### Middleware Stack

```
1. https.enforce         → Forces HTTPS in production
2. auth.rate_limit:login → AuthRateLimiting middleware
```

### Request Headers

| Header          | Required | Type               | Description                            |
| --------------- | -------- | ------------------ | -------------------------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format                    |
| `Accept`        | ✅       | `application/json` | Response format                        |
| `X-Client-Type` | ❌       | `string`           | Client identifier (web/mobile/desktop) |
| `User-Agent`    | ❌       | `string`           | Used for device fingerprinting         |
| `X-Device-ID`   | ❌       | `string`           | Persistent device identifier           |

### Request Body Schema

```json
{
  "email": "string|null", // Required if no phone, max 255, RFC email
  "phone": "string|null", // Required if no email, E.164 validated
  "country": "string|null", // Required with phone, 2-char ISO code
  "password": "string", // Required, min 1 char
  "remember_me": "boolean|null" // Optional, default false (reserved)
}
```

#### Field Details

| Field         | Type      | Constraints                                          | Example                |
| ------------- | --------- | ---------------------------------------------------- | ---------------------- |
| `email`       | `string`  | `required_without:phone`, max 255, email:rfc         | `"user@example.com"`   |
| `phone`       | `string`  | `required_without:email`, validated via PhoneService | `"5551234567"`         |
| `country`     | `string`  | `required_with:phone`, exactly 2 chars               | `"US"`                 |
| `password`    | `string`  | Required, min 1                                      | `"securePassword123!"` |
| `remember_me` | `boolean` | Optional                                             | `true`                 |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "signature": "3592010",
      "avatar": "https://cdn.example.com/avatars/123.jpg",
      "frame": null,
      "phone": "+923001234567",
      "country": "PK",
      "gender": "male",
      "date_of_birth": "1990-05-15",
      "coins": "1500",
      "diamonds": "250",
      "wealth_xp": "12500",
      "charm_xp": "8750",
      "is_profile_complete": true,
      "is_blocked": false,
      "blocked_at": null,
      "blocked_reason": null,
      "locked_until": null
    },
    "token": "1|abc123xyz...",
    "token_type": "Bearer",
    "expires_at": "2026-04-27T14:30:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
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
    "email": ["Either email or phone number is required for login."],
    "password": ["Password is required for login."]
  }
}
```

#### ❌ Authentication Failed (401)

```json
{
  "status": "error",
  "message": "Invalid credentials",
  "data": null,
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Rate Limited (429)

```json
{
  "status": "error",
  "message": "Too many login attempts. Please try again later.",
  "data": null,
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

Response Headers:

```
Retry-After: 300
X-RateLimit-Reset: 1706362800
```

#### ❌ Account Blocked (401)

```json
{
  "status": "error",
  "message": "Account is blocked: Violation of terms of service",
  "data": null
}
```

#### ❌ Account Locked (401)

```json
{
  "status": "error",
  "message": "Account is temporarily locked. Try again in 1500 seconds.",
  "data": null
}
```

#### ❌ Email Verification Required (401)

```json
{
  "status": "error",
  "message": "Email verification required. Please check your email.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Login successful, token issued                      |
| `401` | Invalid credentials, blocked, locked, or unverified |
| `422` | Validation failed                                   |
| `429` | Rate limit exceeded                                 |
| `500` | Unexpected server error                             |