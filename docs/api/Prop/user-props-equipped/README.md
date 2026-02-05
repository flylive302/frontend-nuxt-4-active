# GET /api/v1/user/props/equipped

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The User Props Equipped endpoint returns the currently equipped props for the authenticated user, one per prop type. This provides a quick lookup for displaying active visual customizations (frames, signatures, chat bubbles, etc.).

### Responsibilities

- Retrieve equipped props per type
- Return structured map with type as key
- Cache results for performance (15 min TTL)

### What It Owns

| Owned                 | Description                                       |
| --------------------- | ------------------------------------------------- |
| Equipped props view   | User's currently equipped props by type           |
| Caching               | 15-minute cache with event-based invalidation     |

### Business Rules

| Rule                                | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| One per type                        | Only one equipped prop per type                    |
| All types returned                  | Response contains all PropType keys (null if none) |
| Cached                              | Results cached 15 minutes per user                 |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/props/equipped
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Request Parameters

None.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "equipped": {
      "frame": {
        "id": 12345,          // UserProp ID
        "prop_id": 100,       // Prop catalog ID
        "name": "Golden Frame",
        "asset_url": "https://cdn.../frame.png"
      },
      "signature": null,       // Not equipped
      "room_theme": null,
      "chat_bubble": {
        "id": 12346,
        "prop_id": 101,
        "name": "Sparkle Bubble",
        "asset_url": "https://cdn.../bubble.png"
      },
      "entry_animation": null
    }
  },
  "meta": {
    "timestamp": "2026-02-05T04:20:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                    |
| ----- | -------------------------------------------- |
| `200` | Successfully retrieved equipped props        |
| `401` | Missing or invalid authentication token      |