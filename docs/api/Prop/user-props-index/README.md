# GET /api/v1/user/props

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The User Props Index endpoint returns a paginated list of props owned by the authenticated user. Supports filtering by type and status (active/expired/all) with cursor-based pagination for efficient scrolling through large inventories.

### Responsibilities

- List user's owned props (UserProp records)
- Filter by prop type and status
- Provide cursor-based pagination
- Transform to API resource format

### What It Owns

| Owned                | Description                             |
| -------------------- | --------------------------------------- |
| Props inventory view | User's complete prop ownership list     |
| Filtering logic      | Type and status filtering               |
| Pagination           | Cursor-based with configurable per_page |

### Business Rules

| Rule                         | Description                              |
| ---------------------------- | ---------------------------------------- |
| Default status = active      | Only shows active props unless specified |
| Max per_page = 100           | Capped at 100 items per request          |
| Ordered by purchased_at DESC | Newest props first                       |
| Denormalized type filter     | Uses `prop_type` column for performance  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/props
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Query Parameters

| Parameter  | Type     | Default  | Constraints                                        | Example   |
| ---------- | -------- | -------- | -------------------------------------------------- | --------- |
| `type`     | `string` | —        | Optional, one of PropType enum values              | `frame`   |
| `status`   | `string` | `active` | Optional, one of: `active`, `expired`, `all`       | `expired` |
| `per_page` | `int`    | `50`     | Optional, 1-100                                    | `20`      |
| `cursor`   | `string` | —        | Optional, pagination cursor from previous response | `eyJp...` |

### PropType Values

- `frame`
- `signature`
- `room_theme`
- `chat_bubble`
- `entry_animation`

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "props": [
      {
        "id": 12345, // UserProp ID
        "prop_id": 100, // Prop catalog ID
        "type": "frame", // PropType
        "name": "Golden Frame", // Prop name
        "thumbnail_url": "https://cdn.../thumb.png",
        "asset_url": "https://cdn.../asset.png",
        "purchased_at": "2026-02-01T12:00:00.000000Z",
        "expires_at": "2026-03-01T12:00:00.000000Z",
        "is_equipped": true, // Boolean
        "source_type": "purchase", // purchase | gift | reward
        "days_remaining": 24, // Computed, integer
        "is_valid": true // Computed, not expired
      }
    ],
    "pagination": {
      "next_cursor": "eyJwdXJjaGFzZWRfYXQi...", // null if no more
      "prev_cursor": null, // null if first page
      "has_more": true, // Boolean
      "per_page": 50 // Requested per_page
    }
  },
  "meta": {
    "timestamp": "2026-02-05T04:11:48.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "The type field must be one of: frame, signature, room_theme, chat_bubble, entry_animation.",
  "data": null,
  "errors": {
    "type": ["The type field must be one of: ..."]
  },
  "meta": {...}
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Successfully retrieved props              |
| `401` | Missing or invalid authentication token   |
| `422` | Validation error (invalid type or status) |