# GET /api/v1/props/{prop}

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Show endpoint returns detailed information about a single prop from the mall catalog. This powers the prop detail view where users can see full information before purchasing or gifting.

### Responsibilities

- Retrieve a single prop by ID using Route Model Binding
- Verify the prop is active and currently available
- Return detailed prop data including optional metadata
- Return 404 if prop doesn't exist or is unavailable

### What It Owns

| Owned          | Description                           |
| -------------- | ------------------------------------- |
| Prop retrieval | Single prop lookup from `props` table |
| Availability   | Business logic check for visibility   |

### External Dependencies

| Dependency | Type           | Purpose                 |
| ---------- | -------------- | ----------------------- |
| PostgreSQL | Database       | Primary data store      |
| Sanctum    | Authentication | Bearer token validation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/props/{prop}
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

### Path Parameters

| Parameter | Type  | Constraints                       | Example |
| --------- | ----- | --------------------------------- | ------- |
| `prop`    | `int` | Required, exists in `props` table | `42`    |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "prop": {
      "id": 42,
      "type": "frame", // string, PropType enum value
      "name": "Golden Crown Frame", // string, max 100 chars
      "description": "A majestic golden frame that...", // string|null
      "thumbnail_url": "https://cdn.fly.live/props/frame_001_thumb.png",
      "asset_url": "https://cdn.fly.live/props/frame_001.png", // string|null
      "price": 100.0, // float, decimal(18,4)
      "duration_days": 30, // int, prop validity period
      "inventory_count": 50, // int, remaining stock
      "is_giftable": true, // bool
      "is_sold_out": false, // bool, computed accessor
      "is_available": true, // bool, computed - active, in stock, within date window
      "is_purchasable": true, // bool, computed - active and available for purchase
      "vip_level_required": 0, // int, minimum VIP level
      "metadata": {
        // object|null, conditional
        "animation_url": "https://cdn.fly.live/props/frame_001.webm",
        "rarity": "legendary"
      },
      "signature_value": "1234567" // string|null, conditional - only for signature type props
    }
  },
  "meta": {
    "timestamp": "2026-02-05T03:53:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found (404) - Prop Doesn't Exist

```json
{
  "status": "error",
  "message": "Not Found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:53:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Not Found (404) - Prop Inactive/Unavailable

```json
{
  "status": "error",
  "message": "Prop not found.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:53:08.000000Z",
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
    "timestamp": "2026-02-05T03:53:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Successfully retrieved prop details       |
| `401` | Missing or invalid authentication token   |
| `404` | Prop not found OR inactive OR unavailable |
| `500` | Server error (database issue)             |

---
