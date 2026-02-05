# POST /api/v1/props/gift

> **Domain**: Prop  
> **Type**: Protected Endpoint (Transactional)  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Gift endpoint allows authenticated users to purchase a prop and gift it to another user within a room context. This is a social monetization feature enabling users to show appreciation or support to others in live rooms.

### Responsibilities

- Validate the sender can gift the prop (authorization via policy)
- Validate recipient exists and is not the sender
- Validate room context for the gift
- Deduct coins from sender's balance atomically
- Decrement prop inventory atomically
- Create user prop ownership record for recipient
- Log transaction linking sender, recipient, and room
- Return transaction details and updated balance

### What It Owns

| Owned               | Description                                     |
| ------------------- | ----------------------------------------------- |
| Gift flow           | End-to-end prop gifting transaction             |
| UserProp creation   | Creates ownership for recipient in `user_props` |
| Transaction logging | Creates audit record with room context          |
| Inventory mgmt      | Decrements `props.inventory_count`              |

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
POST /api/v1/props/gift
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Authorization

✅ **Policy Check** - `PropPolicy::gift()` verifies:

- Prop is giftable (`is_giftable = true`)
- Prop is available (active, in stock, within date window)
- User meets VIP level requirement

### Rate Limiting

| Limiter     | Key         | Limit    |
| ----------- | ----------- | -------- |
| `prop_gift` | `user:{id}` | 5/minute |

### Request Headers

| Header              | Required | Type               | Description                     |
| ------------------- | -------- | ------------------ | ------------------------------- |
| `Content-Type`      | ✅       | `application/json` | Request body format             |
| `Accept`            | ✅       | `application/json` | Response format                 |
| `Authorization`     | ✅       | `Bearer {token}`   | Authentication token            |
| `X-Idempotency-Key` | ❌       | `string`           | Optional client idempotency key |

### Request Body

```json
{
  "prop_id": 42, // int, required, existing prop ID
  "recipient_id": 12345, // int, required, existing user ID (not self)
  "room_id": 100, // int, required, room where gift occurs
  "message": "Enjoy this gift!" // string|null, optional, max 200 chars
}
```

#### Request Body Parameters

| Parameter      | Type     | Constraints                                     | Example           |
| -------------- | -------- | ----------------------------------------------- | ----------------- |
| `prop_id`      | `int`    | Required, exists in `props` table               | `42`              |
| `recipient_id` | `int`    | Required, exists in `users`, not same as sender | `12345`           |
| `room_id`      | `int`    | Required, exists in `rooms` table               | `100`             |
| `message`      | `string` | Optional, max 200 characters                    | `"Great stream!"` |

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "Prop gifted successfully.",
  "data": {
    "transaction_id": 98765, // int, Transaction record ID
    "recipient_user_prop_id": 12346, // int, UserProp record for recipient
    "balance": {
      "coins_before": 1000, // int, sender's balance before
      "coins_after": 900 // int, sender's balance after
    }
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "The given data was invalid.",
  "data": null,
  "errors": {
    "prop_id": ["The selected prop id is invalid."],
    "recipient_id": ["You cannot gift a prop to yourself."]
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
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
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400) - Not Giftable

```json
{
  "status": "error",
  "message": "This prop cannot be gifted.",
  "data": null,
  "errors": {
    "code": "prop_not_available"
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
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
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `201` | Successfully gifted prop                      |
| `400` | Prop sold out, not available, or not giftable |
| `401` | Missing or invalid authentication token       |
| `402` | Insufficient coin balance                     |
| `403` | Policy denied (VIP too low, etc.)             |
| `409` | Duplicate gift (idempotency violation)        |
| `422` | Validation failed (invalid IDs, self-gift)    |
| `429` | Rate limit exceeded                           |
| `500` | Server error                                  |