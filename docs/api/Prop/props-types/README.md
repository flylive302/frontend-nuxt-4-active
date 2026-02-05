# GET /api/v1/props/types

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Types endpoint returns all available prop categories with their active item counts. This powers the category navigation/filter UI in the prop mall, allowing users to see how many props are available in each category before browsing.

### Responsibilities

- Return all prop type categories with human-readable labels
- Include count of active, currently-available props per type
- Cache results for 5 minutes to reduce database load
- Provide consistent ordering based on enum definition order

### What It Owns

| Owned            | Description                                  |
| ---------------- | -------------------------------------------- |
| Type aggregation | COUNT grouped by type from `props` table     |
| Cache management | 5-minute cache with key `props:types:counts` |

### External Dependencies

| Dependency | Type           | Purpose                 |
| ---------- | -------------- | ----------------------- |
| PostgreSQL | Database       | Aggregation query       |
| Redis      | Cache          | 5-minute cache storage  |
| Sanctum    | Authentication | Bearer token validation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/props/types
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Rate Limiting

| Limiter | Key         | Config                    |
| ------- | ----------- | ------------------------- |
| `api`   | `user:{id}` | Default API rate limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

None required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "types": [
      {
        "type": "frame", // string, PropType enum value
        "count": 15, // int, number of active props
        "label": "Frames" // string, human-readable label
      },
      {
        "type": "chat_bubble",
        "count": 8,
        "label": "Chat Bubbles"
      },
      {
        "type": "entry_animation",
        "count": 12,
        "label": "Entry Animations"
      },
      {
        "type": "signature",
        "count": 5,
        "label": "Signatures"
      },
      {
        "type": "room_theme",
        "count": 3,
        "label": "Room Themes"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-02-05T03:46:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:46:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully retrieved prop types       |
| `401` | Missing or invalid authentication token |
| `500` | Server error (database/cache issue)     |