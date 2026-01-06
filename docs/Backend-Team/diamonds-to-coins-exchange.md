# Diamonds to Coins Exchange API

## Overview

Users can exchange their diamonds for coins at a configurable rate (default: 1 diamond = 1750 coins).

## API Endpoints

### Get Exchange Info

```
GET /api/v1/user/exchange
```

**Response:**

```json
{
  "success": true,
  "data": {
    "coins_per_diamond": 1750,
    "is_enabled": true,
    "user_coins_balance": "5000.0000",
    "user_diamonds_balance": 100
  },
  "message": "Exchange info retrieved"
}
```

---

### Exchange Diamonds for Coins

```
POST /api/v1/user/exchange
```

**Request Body:**

```json
{
  "diamond_amount": 10
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "diamonds_deducted": 10,
    "coins_received": 17500,
    "new_coin_balance": "22500.0000",
    "new_diamond_balance": 90,
    "exchange_rate": 1750
  },
  "message": "Successfully exchanged 10 diamonds for 17500 coins"
}
```

**Error Responses (422):**

```json
{
  "success": false,
  "message": "Insufficient diamonds"
}
```

```json
{
  "success": false,
  "message": "Exchange is currently disabled"
}
```

---

## Frontend Implementation Notes

1. **Simple Calculation**: `coins_received = diamond_amount × coins_per_diamond`
2. **No Limits**: Users can exchange unlimited diamonds anytime
3. **Integer Input**: `diamond_amount` must be a positive integer (≥1)
4. **Rate Display**: Show "1 💎 = 1750 🪙" or similar based on `coins_per_diamond`

## Validation Rules

| Field            | Type    | Rules            |
| ---------------- | ------- | ---------------- |
| `diamond_amount` | integer | required, min: 1 |
