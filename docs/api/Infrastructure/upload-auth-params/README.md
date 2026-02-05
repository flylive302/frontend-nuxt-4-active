# POST /api/v1/uploads/auth-params

> **Domain**: Infrastructure  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Generates secure authentication parameters for client-side file uploads directly to ImageKit CDN, eliminating CORS issues and server-side upload bottlenecks.

### Responsibilities

- Validate requested upload folder against allowed list
- Generate signed authentication tokens with configurable expiration
- Return all parameters needed for client-side ImageKit upload

### What It Owns

| Owned                | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| Auth token generation| Creates signed tokens for secure client-side uploads            |
| Folder validation    | Ensures uploads only go to whitelisted folders                  |

### External Dependencies

| Dependency | Type           | Purpose                              |
| ---------- | -------------- | ------------------------------------ |
| ImageKit   | Package/CDN    | SDK for generating auth signatures   |
| Redis      | Infrastructure | Session storage for Sanctum auth     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/uploads/auth-params
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter    | Key       | Config                       |
| ---------- | --------- | ---------------------------- |
| `throttle` | User IP   | 10 requests per minute       |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "folder": "string",           // Required: one of allowed folders
  "expire_seconds": "integer"   // Optional: token expiry (60-3600), default 600
}
```

#### Field Details

| Field            | Type      | Constraints                                                 | Example               |
| ---------------- | --------- | ----------------------------------------------------------- | --------------------- |
| `folder`         | `string`  | Required, must be one of: `avatars`, `rooms`, `agencies/logos`, `agencies/national-ids`, `coin-request-proofs` | `"avatars"`           |
| `expire_seconds` | `integer` | Optional, min:60, max:3600, default:600                     | `600`                 |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Upload authentication parameters generated",
  "data": {
    "token": "random-uuid-token",
    "signature": "hmac-sha1-signature",
    "expire": 1738456800,
    "publicKey": "public_key_from_env",
    "folder": "avatars",
    "urlEndpoint": "https://ik.imagekit.io/flylive"
  },
  "meta": {
    "timestamp": "2026-02-02T03:40:00.000000Z",
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
    "folder": ["Invalid upload folder. Allowed: avatars, rooms, agencies/logos, agencies/national-ids, coin-request-proofs."]
  },
  "meta": {
    "timestamp": "2026-02-02T03:40:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null
}
```

#### ❌ Rate Limit Exceeded (429)

```json
{
  "status": "error",
  "message": "Too Many Attempts.",
  "data": null
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to generate upload authentication",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T03:40:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Auth params generated successfully                  |
| `401` | Missing or invalid authentication token             |
| `422` | Validation failed (invalid folder, expire range)    |
| `429` | Rate limit exceeded (>10 requests per minute)       |
| `500` | ImageKit SDK failure or missing configuration       |