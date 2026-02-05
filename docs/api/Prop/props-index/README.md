# GET /api/v1/props

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Index endpoint provides the mall catalog functionality, allowing authenticated users to browse available virtual props with cursor-based pagination. This is the primary discovery mechanism for the FlyLive prop marketplace.

### Responsibilities

- List all active and currently available props
- Filter props by type (frames, chat bubbles, entry animations, signatures, room themes)
- Provide cursor-based pagination for infinite scroll UX
- Return prop summary data optimized for catalog display

### What It Owns

| Owned            | Description                                       |
| ---------------- | ------------------------------------------------- |
| Props catalog    | Read-only access to the `props` table             |
| Pagination state | Cursor encoding/decoding for stateless pagination |

### External Dependencies

| Dependency | Type           | Purpose                 |
| ---------- | -------------- | ----------------------- |
| PostgreSQL | Database       | Primary data store      |
| Sanctum    | Authentication | Bearer token validation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/props
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
| `Content-Type`  | ❌       | `application/json` | Not required for GET |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

```
?type=frame&per_page=20&cursor={encoded_cursor}
```

#### Parameter Details

| Parameter  | Type     | Constraints                                                            | Default | Example              |
| ---------- | -------- | ---------------------------------------------------------------------- | ------- | -------------------- |
| `type`     | `string` | Optional, in: `frame,chat_bubble,entry_animation,signature,room_theme` | `null`  | `frame`              |
| `per_page` | `int`    | Optional, min:1, max:100                                               | `20`    | `50`                 |
| `cursor`   | `string` | Optional, base64 encoded cursor from previous response                 | `null`  | `eyJpZCI6MTAsIl9...` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "props": [
      {
        "id": 1,
        "type": "frame", // string, PropType enum value
        "name": "Golden Crown Frame", // string, max 100 chars
        "description": "A majestic golden frame", // string|null
        "thumbnail_url": "https://cdn.fly.live/props/frame_001_thumb.png", // string, max 500
        "asset_url": "https://cdn.fly.live/props/frame_001.png", // string|null, max 500
        "price": 100.0, // float, decimal(18,4)
        "duration_days": 30, // int, prop validity period
        "inventory_count": 50, // int, remaining stock
        "is_giftable": true, // bool, can be gifted
        "sort_order": 1, // int, display order
        "vip_level_required": 0, // int, minimum VIP level
        "is_sold_out": false, // bool, computed accessor
        "is_available": true, // bool, computed - active, in stock, within date window
        "is_purchasable": true, // bool, computed - active and available for purchase
        "signature_value": "1234567" // string|null, conditional - only for signature type props
      }
    ],
    "pagination": {
      "next_cursor": "eyJpZCI6MTAsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0", // string|null
      "has_more": true, // bool
      "per_page": 20 // int
    }
  },
  "meta": {
    "timestamp": "2026-02-05T03:37:36.000000Z",
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
    "type": ["The selected type is invalid."],
    "per_page": ["The per page field must be between 1 and 100."]
  },
  "meta": {
    "timestamp": "2026-02-05T03:37:36.000000Z",
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
    "timestamp": "2026-02-05T03:37:36.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully retrieved props list       |
| `401` | Missing or invalid authentication token |
| `422` | Validation failed (invalid type/params) |
| `500` | Server error (database/internal issue)  |
