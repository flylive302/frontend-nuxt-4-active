# POST /api/v1/auth/register

> **Domain**: Authentication  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

The Registration endpoint handles new user account creation in the FlyLive platform. It supports dual registration methods: **email + password** or **phone number** based authentication.

### Responsibilities

- Create new user accounts with validated data
- Auto-generate unique 7-digit numeric signatures
- Assign default "User" role via Spatie Permissions
- Load-balance assignment to resellers
- Queue email verification (async)
- Generate Sanctum authentication tokens
- Return fully hydrated user data + Bearer token

### What It Owns

| Owned                       | Description                                     |
| --------------------------- | ----------------------------------------------- |
| User creation               | Creates new `users` record with hashed password |
| Signature generation        | Generates unique 7-digit ID with atomic locking |
| Role assignment             | Assigns default "User" role                     |
| Token creation              | Creates Sanctum personal access token           |
| Email verification dispatch | Queues verification email job                   |

### External Dependencies

| Dependency         | Type           | Purpose                             |
| ------------------ | -------------- | ----------------------------------- |
| `users` table      | Database       | User storage                        |
| Spatie Permissions | Package        | Role management                     |
| Laravel Sanctum    | Package        | Token authentication                |
| Redis/Cache        | Infrastructure | Signature locking, reseller caching |
| Queue (emails)     | Infrastructure | Async email dispatch                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/auth/register
```

### Authentication

❌ **None Required** - Public endpoint

### Rate Limiting

| Limiter                  | Key             | Config             |
| ------------------------ | --------------- | ------------------ |
| `throttle:auth_register` | Laravel default | Framework throttle |

### Request Headers

| Header             | Required | Type               | Description                                           |
| ------------------ | -------- | ------------------ | ----------------------------------------------------- |
| `Content-Type`     | ✅       | `application/json` | Request body format                                   |
| `Accept`           | ✅       | `application/json` | Response format                                       |
| `X-Client-Type`    | ❌       | `string`           | Client type: `web`, `mobile`, `admin`. Default: `web` |
| `X-Correlation-ID` | ❌       | `string (UUID)`    | Request tracing ID                                    |

### Request Body Schema

```json
{
  "name": "string", // Required, max: 255
  "email": "string|null", // Required if no phone, RFC email, unique
  "password": "string|null", // Required with email, min: 8, mixed case, numbers, symbols
  "phone": "string|null", // Required if no email, unique (E.164 after formatting)
  "country": "string|null", // Required with phone, 2 chars (ISO 3166-1 alpha-2)
  "signature": "string|null" // Optional, max: 255, lowercase alphanumeric + underscore
}
```

#### Field Details

| Field       | Type           | Constraints                                              | Example              |
| ----------- | -------------- | -------------------------------------------------------- | -------------------- |
| `name`      | `string`       | Required, max 255                                        | `"John Doe"`         |
| `email`     | `string\|null` | RFC email, unique                                        | `"john@example.com"` |
| `password`  | `string\|null` | Required with email, min 8, mixed case, numbers, symbols | `"P@ssw0rd!"`        |
| `phone`     | `string\|null` | Unique, validated via PhoneService                       | `"3001234567"`       |
| `country`   | `string\|null` | Required with phone, ISO 3166-1 alpha-2                  | `"PK"`               |
| `signature` | `string\|null` | Optional, lowercase + numbers + underscores only         | `"john_doe_123"`     |

#### Validation Rules Summary

- **Must have at least one identifier**: `email` OR `phone`
- **Email registration**: `email` + `password` required
- **Password strength**: 8+ chars, mixed case, numbers, symbols

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "signature": "3592010",
      "avatar": null,
      "frame": null,
      "phone": "+923001234567",
      "country": "PK",
      "gender": null,
      "date_of_birth": null,
      "coins": "0",
      "diamonds": "0",
      "wealth_xp": "0",
      "charm_xp": "0",
      "is_profile_complete": false,
      "is_blocked": false,
      "blocked_at": null,
      "blocked_reason": null,
      "locked_until": null
    },
    "token": "1|abc123xyz...",
    "token_type": "Bearer",
    "expires_at": "2026-04-26T13:14:21.000000Z"
  },
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422 Unprocessable Entity)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "name": ["Your name is required to create an account."],
    "email": ["An account with this email already exists."],
    "password": ["Password must be at least 8 characters long."]
  },
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400)

```json
{
  "status": "error",
  "message": "Either email or phone number is required for registration",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Registration failed: [error details]",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                                               |
| ----- | ----------------------------------------------------------------------- |
| `201` | User created successfully                                               |
| `400` | DTO validation failed (missing email/phone, missing password for email) |
| `422` | Request validation failed (invalid format, duplicates)                  |
| `429` | Rate limit exceeded                                                     |
| `500` | Internal server error                                                   |