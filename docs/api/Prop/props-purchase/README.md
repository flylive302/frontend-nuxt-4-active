# POST /api/v1/props/{prop}/purchase

> **Domain**: Prop  
> **Type**: Protected Endpoint (Transactional)  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Purchase endpoint allows authenticated users to buy a prop from the mall catalog for themselves. This is the core monetization flow for the prop system, integrating with the economy layer for balance management and creating ownership records.

### Responsibilities

- Validate the user can purchase the prop (authorization via policy)
- Deduct coins from user's balance atomically
- Decrement prop inventory atomically
- Create user prop ownership record with expiration
- Log transaction for audit trail
- Return updated balance and ownership details

### What It Owns

| Owned               | Description                                    |
| ------------------- | ---------------------------------------------- |
| Purchase flow       | End-to-end prop purchase transaction           |
| UserProp creation   | Creates ownership record in `user_props` table |
| Transaction logging | Creates audit record in `transactions` table   |
| Inventory mgmt      | Decrements `props.inventory_count`             |

### External Dependencies

| Dependency              | Type           | Purpose                   |
| ----------------------- | -------------- | ------------------------- |
| PostgreSQL              | Database       | Transactional data access |
| Redis                   | Cache          | Idempotency key storage   |
| Sanctum                 | Authentication | Bearer token validation   |
| CoinDistributionService | Service        | Balance deduction         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/props/{prop}/purchase
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Authorization

✅ **Policy Check** - `PropPolicy::purchase()` verifies:

- Prop is available (active, in stock, within date window)
- User meets VIP level requirement

### Rate Limiting

| Limiter         | Key         | Limit     |
| --------------- | ----------- | --------- |
| `prop_purchase` | `user:{id}` | 10/minute |

### Request Headers

| Header              | Required | Type               | Description                     |
| ------------------- | -------- | ------------------ | ------------------------------- |
| `Accept`            | ✅       | `application/json` | Response format                 |
| `Authorization`     | ✅       | `Bearer {token}`   | Authentication token            |
| `X-Idempotency-Key` | ❌       | `string`           | Optional client idempotency key |

### Path Parameters

| Parameter | Type  | Constraints                       | Example |
| --------- | ----- | --------------------------------- | ------- |
| `prop`    | `int` | Required, exists in `props` table | `42`    |

### Request Body

None required. Prop ID comes from URL path.

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "Prop purchased successfully.",
  "data": {
    "user_prop": {
      "id": 12345, // int, UserProp record ID
      "prop_id": 42, // int, purchased prop ID
      "expires_at": "2026-03-07T03:58:35+00:00", // ISO8601, expiration time
      "is_equipped": false // bool, always false initially
    },
    "balance": {
      "coins_before": 1000, // int, balance before deduction
      "coins_after": 900 // int, balance after deduction
    }
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Forbidden (403) - Policy Denied

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400) - Sold Out

```json
{
  "status": "error",
  "message": "This prop is sold out.",
  "data": null,
  "errors": {
    "code": "prop_sold_out"
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Payment Required (402) - Insufficient Balance

```json
{
  "status": "error",
  "message": "Insufficient balance.",
  "data": null,
  "errors": {
    "code": "insufficient_balance"
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Conflict (409) - Duplicate Purchase

```json
{
  "status": "error",
  "message": "This purchase has already been processed.",
  "data": null,
  "errors": {
    "code": "duplicate_purchase"
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `201` | Successfully purchased prop                |
| `400` | Prop sold out or not available             |
| `401` | Missing or invalid authentication token    |
| `402` | Insufficient coin balance                  |
| `403` | Policy denied (VIP level too low, etc.)    |
| `404` | Prop not found                             |
| `409` | Duplicate purchase (idempotency violation) |
| `429` | Rate limit exceeded                        |
| `500` | Server error                               |