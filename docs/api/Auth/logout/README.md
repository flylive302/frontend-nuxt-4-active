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