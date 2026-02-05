# GET /api/v1/auth/user

> **Domain**: Authentication  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Returns the authenticated user's profile data for app initialization (bootstrap). This is the primary endpoint called after login to populate the client-side user state.

### Responsibilities

- Return current user's profile information
- Provide balances (coins, diamonds)
- Provide XP values (wealth, charm)
- Provide account status (blocked, locked)
- Indicate profile completion status

### What It Owns

| Owned              | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| User data exposure | Controls which fields are exposed via BootstrapUserResource |

### External Dependencies

| Dependency         | Type     | Purpose             |
| ------------------ | -------- | ------------------- |
| Database (`users`) | Eloquent | User data retrieval |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/auth/user
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

> **Note**: GET request - no body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "User profile retrieved successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "signature": "1234567",
    "avatar": "https://cdn.example.com/avatars/user123.jpg",
    "frame": "gold_frame",
    "phone": "+15551234567",
    "country": "US",
    "gender": "male",
    "date_of_birth": "1990-05-15",
    "coins": "15000",
    "diamonds": "500",
    "wealth_xp": "12500",
    "charm_xp": "8000",
    "is_profile_complete": true,
    "is_blocked": false,
    "blocked_at": null,
    "blocked_reason": null,
    "locked_until": null
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field                 | Type           | Description                                    |
| --------------------- | -------------- | ---------------------------------------------- |
| `id`                  | `integer`      | User's unique ID                               |
| `name`                | `string\|null` | Display name                                   |
| `signature`           | `string`       | Unique public identifier (7-digit)             |
| `avatar`              | `string\|null` | Avatar image URL                               |
| `frame`               | `string\|null` | User's profile frame (conditional)             |
| `phone`               | `string\|null` | E.164 formatted phone                          |
| `country`             | `string\|null` | ISO 2-letter country code                      |
| `gender`              | `string\|null` | User's gender                                  |
| `date_of_birth`       | `string\|null` | Date in YYYY-MM-DD format                      |
| `coins`               | `string`       | Virtual currency balance (stringified integer) |
| `diamonds`            | `string`       | Premium currency balance (stringified integer) |
| `wealth_xp`           | `string`       | Wealth experience points (stringified)         |
| `charm_xp`            | `string`       | Charm experience points (stringified)          |
| `is_profile_complete` | `boolean`      | True if name, phone, gender, DOB set           |
| `is_blocked`          | `boolean`      | Account permanently blocked                    |
| `blocked_at`          | `string\|null` | ISO 8601 timestamp when blocked                |
| `blocked_reason`      | `string\|null` | Reason for block                               |
| `locked_until`        | `string\|null` | ISO 8601 timestamp until lock expires          |

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | User profile retrieved successfully |
| `401` | Missing or invalid token            |