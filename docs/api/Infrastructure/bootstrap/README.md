# GET /api/v1/bootstrap

> **Domain**: Infrastructure  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Bootstrap endpoint consolidates 6-8 initial API calls into a single request, providing all initialization data required for the mobile app startup. It returns authenticated user profile, level status, gift catalog, configuration, and user-specific data.

### Responsibilities

- Return authenticated user profile data
- Provide user's current level status (wealth and charm)
- Return gift catalog (cached)
- Provide system configuration and economy settings
- Return user's room data (if exists)
- Return user's displayed badges (max 5)
- Return agency membership info (if applicable)
- Return active income target (for agency members)

### What It Owns

| Owned              | Description                                            |
| ------------------ | ------------------------------------------------------ |
| Bootstrap Response | Aggregates data from multiple domains into one payload |
| Gift Catalog Cache | Caches active gifts for 15 minutes                     |
| Config Cache       | Caches system configuration for 1 hour                 |

### External Dependencies

| Dependency | Type           | Purpose                                  |
| ---------- | -------------- | ---------------------------------------- |
| Redis      | Infrastructure | Caching gifts, config, level definitions |
| Database   | Infrastructure | User data, gifts, levels, badges, agency |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/bootstrap
```

### Authentication

✅ **Required** - Bearer token via Sanctum middleware

### Rate Limiting

| Limiter   | Key       | Config              |
| --------- | --------- | ------------------- |
| (Default) | `user:id` | Laravel default API |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
No request body required (GET request)
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Bootstrap data retrieved successfully",
  "data": {
    "user": {
      "id": "integer",
      "name": "string",
      "signature": "string",
      "avatar": "string|null",
      "frame": "string|null",
      "phone": "string|null",          // E.164 format
      "country": "string|null",        // ISO 2-letter code
      "gender": "string|null",
      "date_of_birth": "string|null",  // YYYY-MM-DD
      "coins": "string",               // Integer as string
      "diamonds": "string",            // Integer as string
      "wealth_xp": "string",           // Integer as string
      "charm_xp": "string",            // Integer as string
      "is_profile_complete": "boolean",
      "is_blocked": "boolean",
      "blocked_at": "string|null",     // ISO 8601
      "blocked_reason": "string|null",
      "locked_until": "string|null"    // ISO 8601
    },
    "user_data": {
      "levels": {
        "wealth": {
          "current_level": "integer",
          "level_name": "string",
          "current_xp": "float",
          "xp_for_next_level": "float",
          "xp_remaining": "float",
          "progress_percentage": "float",
          "badge": {
            "id": "integer",
            "name": "string",
            "image_url": "string"
          },
          "next_level": {
            "level": "integer",
            "name": "string",
            "required_xp": "float"
          }
        },
        "charm": { "..." }  // Same structure as wealth
      },
      "active_income_target": "object|null",
      "room": "object|null",
      "badges": "array",     // Max 5 displayed badges
      "agency": "object|null"
    },
    "gifts": {
      "catalog": "array",
      "total": "integer"
    },
    "config": {
      "api_version": "string",
      "economy": {
        "room_owner_percentage": "float",
        "receiver_percentage": "float"
      },
      "wealth_levels": "array",
      "charm_levels": "array",
      "room_levels": "array",
      "level_badges": "array",
      "vapid_public_key": "string|null"
    }
  },
  "meta": {
    "timestamp": "2026-02-02T03:08:23.000000Z",
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

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                   |
| ----- | ------------------------------------------- |
| `200` | Success                                     |
| `401` | Missing or invalid authentication token     |
| `500` | Server error (DB connection, cache failure) |