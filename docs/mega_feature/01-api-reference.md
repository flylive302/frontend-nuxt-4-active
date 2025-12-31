# Frontend Integration Guide - Mega Feature System

> **Complete Frontend Integration Specification**
> Document Version: 1.0.0
> Last Updated: 2025-12-29

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Base URL & Response Format](#3-base-url--response-format)
4. [API Endpoints](#4-api-endpoints)
5. [TypeScript Types](#5-typescript-types)
6. [Error Handling](#6-error-handling)
7. [Rate Limiting](#7-rate-limiting)

---

## 1. Overview

This document provides complete API specifications for the FlyLive Mega Feature System:

| Feature               | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| **Gift Transactions** | Send gifts with coin distribution to room owners and receivers |
| **Badge System**      | Badge catalog, user badges, display toggles                    |
| **Agency Income**     | Income targets, statistics, history                            |
| **Rewards System**    | Pending rewards, claiming, history                             |
| **Room Membership**   | Join requests, invitations, member management                  |
| **Transactions**      | Transaction history with date grouping                         |

---

## 2. Authentication

All authenticated endpoints require:

```http
Authorization: Bearer <access_token>
```

Obtain tokens via the existing `/api/v1/auth/login` endpoint.

**Endpoints marked 🔒 require authentication.**

---

## 3. Base URL & Response Format

**Base URL:** `https://api.flylive.app/api/v1`

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE",
  "errors": { "field": ["Validation error"] }
}
```

---

## 4. API Endpoints

### 4.1 Badge System

#### GET `/badges`

Get all active badges (catalog).

| Parameter  | Type   | Required | Description                                                        |
| ---------- | ------ | -------- | ------------------------------------------------------------------ |
| `category` | string | No       | Filter by category: `wealth`, `charm`, `room`, `agency`, `special` |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Wealth Level 1",
      "description": "Reached Wealth Level 1",
      "category": "wealth",
      "level": 1,
      "image_url": "https://cdn.example.com/badges/wealth_1.png",
      "is_stackable": false,
      "metadata": {}
    }
  ]
}
```

---

#### GET `/badges/categories`

Get available badge categories.

**Response:**

```json
{
  "data": [
    {
      "value": "wealth",
      "label": "Wealth",
      "color": "amber",
      "icon": "heroicon-o-currency-dollar"
    },
    {
      "value": "charm",
      "label": "Charm",
      "color": "pink",
      "icon": "heroicon-o-heart"
    },
    {
      "value": "room",
      "label": "Room",
      "color": "blue",
      "icon": "heroicon-o-home"
    },
    {
      "value": "agency",
      "label": "Agency",
      "color": "purple",
      "icon": "heroicon-o-building-office"
    },
    {
      "value": "special",
      "label": "Special",
      "color": "yellow",
      "icon": "heroicon-o-star"
    }
  ]
}
```

---

#### GET `/badges/{id}`

Get a single badge by ID.

**Response:**

```json
{
  "data": {
    "id": 1,
    "name": "Wealth Level 1",
    "description": "Reached Wealth Level 1",
    "category": "wealth",
    "level": 1,
    "image_url": "https://cdn.example.com/badges/wealth_1.png",
    "is_stackable": false,
    "metadata": {}
  }
}
```

---

#### 🔒 GET `/user/badges`

Get current user's earned badges.

**Response:**

```json
{
  "data": [
    {
      "id": 123,
      "user_id": 1,
      "badge_id": 1,
      "badge": {
        "id": 1,
        "name": "Wealth Level 1",
        "image_url": "https://cdn.example.com/badges/wealth_1.png",
        "category": "wealth"
      },
      "source_type": "wealth_level",
      "source_id": 5,
      "earned_at": "2025-12-29T10:00:00Z",
      "is_displayed": true
    }
  ]
}
```

---

#### 🔒 GET `/user/badges/displayed`

Get current user's displayed badges (visible on profile).

**Response:** Same structure as `/user/badges`

---

#### 🔒 GET `/user/badges/stats`

Get badge statistics for current user.

**Response:**

```json
{
  "data": {
    "total": 15,
    "by_category": {
      "wealth": 5,
      "charm": 4,
      "room": 3,
      "agency": 2,
      "special": 1
    }
  }
}
```

---

#### 🔒 POST `/user/badges/{id}/toggle-display`

Toggle badge display status.

**Response:**

```json
{
  "message": "Badge display toggled successfully"
}
```

**Error (404):**

```json
{
  "message": "Badge not found or does not belong to you"
}
```

---

### 4.2 Gift Transactions

#### GET `/gifts`

Get paginated gift catalog.

| Parameter  | Type    | Required | Default | Description             |
| ---------- | ------- | -------- | ------- | ----------------------- |
| `cursor`   | string  | No       | -       | Cursor for pagination   |
| `per_page` | integer | No       | 20      | Items per page (max 50) |
| `category` | string  | No       | -       | Filter by category      |

---

#### GET `/gifts/categories`

Get all gift categories with counts.

---

#### GET `/gifts/all`

Get all gifts at once (for small catalogs/caching).

---

#### GET `/gifts/{id}`

Get single gift by ID.

---

#### 🔒 POST `/gifts/send`

Send a gift to a user in a room.

**Request:**

```json
{
  "gift_id": 45,
  "receiver_id": 200,
  "room_id": 10,
  "quantity": 1
}
```

| Field         | Type    | Rules                                |
| ------------- | ------- | ------------------------------------ |
| `gift_id`     | integer | Required, must exist, must be active |
| `receiver_id` | integer | Required, must exist, cannot be self |
| `room_id`     | integer | Required, must exist                 |
| `quantity`    | integer | Required, 1-100                      |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "txn_12345",
      "batch_id": "gift_abc123",
      "type": "gift_send",
      "gift": {
        "id": 45,
        "name": "Rose",
        "thumbnail_url": "https://cdn.example.com/gifts/rose.png"
      },
      "receiver": {
        "id": 200,
        "name": "John Doe",
        "signature": "john_doe"
      },
      "amount": "100.0000",
      "quantity": 1,
      "total_cost": "100.0000",
      "distributions": {
        "room_owner": "10.0000",
        "receiver": "50.0000",
        "agency_income": false
      },
      "xp_earned": {
        "sender_wealth_xp": "150.0000"
      },
      "new_balance": "900.0000"
    }
  }
}
```

**Error Response (422 - Insufficient Balance):**

```json
{
  "success": false,
  "message": "Insufficient coins",
  "error_code": "INSUFFICIENT_BALANCE",
  "data": {
    "required": "100.0000",
    "available": "50.0000"
  }
}
```

---

### 4.3 Agency Income

#### 🔒 GET `/user/income`

Get user's income statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_coins_earned": "15000.0000",
      "total_diamonds": "150",
      "claimable_rewards": 3,
      "pending_targets": 1
    },
    "active_target": {
      "id": 456,
      "tier": "T2",
      "name": "Tier 2",
      "required_coins": "5000.0000",
      "earned_coins": "3500.0000",
      "progress_percentage": 70,
      "period_start": "2025-12-23T00:00:00Z",
      "period_end": "2025-12-30T00:00:00Z",
      "days_remaining": 1,
      "member_diamond_reward": 50,
      "owner_diamond_reward": 25
    },
    "recent_earnings": [
      {
        "date": "2025-12-29",
        "amount": "500.0000",
        "source": "gift_receive",
        "count": 5
      }
    ]
  }
}
```

---

#### 🔒 GET `/user/income/targets`

Get all income targets.

| Parameter  | Type    | Default | Description                                    |
| ---------- | ------- | ------- | ---------------------------------------------- |
| `status`   | string  | `all`   | Filter: `all`, `active`, `completed`, `failed` |
| `per_page` | integer | 10      | Items per page                                 |

---

#### 🔒 GET `/user/income/targets/active`

Get user's currently active income target.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 456,
    "tier": "T2",
    "name": "Tier 2",
    "required_coins": "5000.0000",
    "earned_coins": "3500.0000",
    "progress_percentage": 70,
    "period_start": "2025-12-23T00:00:00Z",
    "period_end": "2025-12-30T00:00:00Z",
    "days_remaining": 1,
    "status": "active",
    "member_diamond_reward": 50,
    "owner_diamond_reward": 25
  }
}
```

---

#### 🔒 GET `/user/income/targets/history`

Get income target history.

**Response:**

```json
{
  "success": true,
  "data": {
    "targets": [
      {
        "id": 455,
        "tier": "T1",
        "name": "Tier 1",
        "required_coins": "1000.0000",
        "earned_coins": "1000.0000",
        "status": "completed",
        "period_start": "2025-12-16T00:00:00Z",
        "period_end": "2025-12-23T00:00:00Z",
        "completed_at": "2025-12-21T14:30:00Z",
        "member_reward_claimed": true,
        "member_claimed_at": "2025-12-21T15:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 10,
      "total": 5,
      "has_more": false
    }
  }
}
```

---

### 4.4 Rewards System

#### 🔒 GET `/user/rewards`

Get user's pending rewards.

**Response:**

```json
{
  "data": [
    {
      "id": 789,
      "reward_type": "diamonds",
      "reward_value": 50,
      "source": "agency_target",
      "source_name": "Tier 1 Target Completed",
      "status": "pending",
      "earned_at": "2025-12-21T14:30:00Z",
      "expires_at": null,
      "can_claim": true
    }
  ]
}
```

---

#### 🔒 GET `/user/rewards/history`

Get all rewards (pending + claimed).

| Parameter | Type    | Default | Description         |
| --------- | ------- | ------- | ------------------- |
| `limit`   | integer | 50      | Max items (max 100) |

---

#### 🔒 GET `/user/rewards/stats`

Get reward statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "pending_count": 3,
    "claimed_count": 12,
    "total_diamonds_claimed": 500,
    "total_coins_claimed": "10000.0000",
    "badges_earned": 8
  }
}
```

---

#### 🔒 POST `/user/rewards/{id}/claim`

Claim a pending reward.

**Success Response:**

```json
{
  "success": true,
  "message": "Reward claimed successfully",
  "data": {
    "reward_type": "diamonds",
    "reward_value": 50,
    "new_balance": {
      "diamonds": "200.0000"
    }
  }
}
```

**Error Responses:**

| Status | Message                | When                    |
| ------ | ---------------------- | ----------------------- |
| 404    | Reward not found       | Invalid ID or not owned |
| 400    | Reward already claimed | Already claimed         |
| 410    | Reward has expired     | Past expiration date    |

---

### 4.5 Transactions

#### 🔒 GET `/transactions`

Get paginated transaction history with date grouping.

| Parameter   | Type    | Default  | Description                                 |
| ----------- | ------- | -------- | ------------------------------------------- |
| `type`      | string  | `all`    | Filter: `all`, `coins`, `diamonds`, `gifts` |
| `page`      | integer | 1        | Page number                                 |
| `per_page`  | integer | 20       | Items per page (max 50)                     |
| `cursor`    | string  | -        | Cursor for pagination                       |
| `date_from` | date    | -        | Start date (YYYY-MM-DD)                     |
| `date_to`   | date    | -        | End date (YYYY-MM-DD)                       |
| `sort`      | string  | `newest` | Sort: `newest`, `oldest`                    |

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions_by_date": [
      {
        "date": "2025-12-29",
        "date_formatted": "29 December, 2025",
        "transactions": [
          {
            "id": "txn_12345",
            "type": "gift_send",
            "timestamp": "2025-12-29T14:30:00Z",
            "title": "Gift Sent",
            "description": "Sent Rose to @john_doe",
            "thumbnail_url": "https://cdn.example.com/gifts/rose.png",
            "initiator": {
              "id": 100,
              "name": "Jane Smith",
              "signature": "jane_smith",
              "avatar_url": "https://cdn.example.com/avatars/100.jpg"
            },
            "concerned_party": {
              "id": 200,
              "name": "John Doe",
              "signature": "john_doe",
              "avatar_url": "https://cdn.example.com/avatars/200.jpg"
            },
            "balance_changes": {
              "coins": {
                "before": "1000.0000",
                "after": "900.0000",
                "change": "-100.0000"
              },
              "diamonds": null,
              "wealth_xp": {
                "before": "5000.0000",
                "after": "5150.0000",
                "change": "+150.0000"
              }
            },
            "metadata": {
              "gift_id": 45,
              "gift_name": "Rose",
              "quantity": 1,
              "room_id": 10,
              "room_name": "Music Room"
            }
          }
        ]
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total_pages": 15,
      "total_transactions": 289,
      "has_more": true,
      "next_cursor": "eyJpZCI6MTIzNDV9"
    }
  }
}
```

---

#### 🔒 GET `/transactions/summary`

Get transaction summary statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "total_sent": "50000.0000",
    "total_received": "45000.0000",
    "total_transactions": 289,
    "by_type": {
      "gift_send": 120,
      "gift_receive": 85,
      "room_commission": 50,
      "reward_claim": 34
    }
  }
}
```

---

### 4.6 Room Membership

> **Important:** Users can only be a member of ONE room at a time.

#### GET `/rooms/{id}/members`

Get room members (public).

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "user_id": 100,
      "room_id": 10,
      "role": "owner",
      "status": "active",
      "joined_at": "2025-12-01T10:00:00Z",
      "user": {
        "id": 100,
        "name": "John Doe",
        "avatar_url": "https://cdn.example.com/avatars/100.jpg"
      }
    }
  ]
}
```

---

#### GET `/rooms/{id}/level`

Get room level progress (public).

**Response:**

```json
{
  "success": true,
  "data": {
    "room_id": 10,
    "current_level": 5,
    "current_xp": "12500.0000",
    "next_level": 6,
    "xp_for_next_level": "15000.0000",
    "progress_percentage": 83.33,
    "level_badge": {
      "id": 15,
      "name": "Room Level 5",
      "image_url": "https://cdn.example.com/badges/room_5.png"
    }
  }
}
```

---

#### 🔒 GET `/user/room`

Get current user's room membership.

**Response (Member):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "room_id": 10,
    "user_id": 100,
    "role": "member",
    "status": "active",
    "joined_at": "2025-12-15T10:00:00Z",
    "room": {
      "id": 10,
      "name": "Music Room",
      "logo": "https://cdn.example.com/rooms/10.jpg"
    }
  }
}
```

**Response (Not a member):**

```json
{
  "success": true,
  "data": null,
  "message": "Not a member of any room"
}
```

---

#### 🔒 POST `/user/room/leave`

Leave current room.

**Success Response:**

```json
{
  "success": true,
  "message": "Left room successfully"
}
```

**Error (400):**

```json
{
  "success": false,
  "message": "Not a member of any room"
}
```

---

#### 🔒 POST `/rooms/{id}/join`

Submit join request to a room.

**Request:**

```json
{
  "message": "I'd love to join your room!"
}
```

| Field     | Type   | Rules                   |
| --------- | ------ | ----------------------- |
| `message` | string | Optional, max 500 chars |

**Success Response (201):**

```json
{
  "success": true,
  "message": "Join request submitted",
  "data": {
    "id": 123,
    "room_id": 10,
    "status": "pending"
  }
}
```

**Error Responses:**

| Status | Message                      |
| ------ | ---------------------------- |
| 400    | Already a member of a room   |
| 400    | Already have pending request |
| 400    | Room is full                 |
| 404    | Room not found               |

---

#### 🔒 DELETE `/rooms/{id}/join`

Cancel join request.

**Response:**

```json
{
  "success": true,
  "message": "Request cancelled"
}
```

---

#### 🔒 GET `/user/room/invitations`

Get user's pending room invitations.

**Response:**

```json
{
  "data": [
    {
      "id": 456,
      "room_id": 10,
      "invitee_id": 100,
      "invited_by": 50,
      "status": "pending",
      "message": "Join our room!",
      "created_at": "2025-12-29T10:00:00Z",
      "room": {
        "id": 10,
        "name": "Music Room",
        "logo": "https://cdn.example.com/rooms/10.jpg"
      },
      "inviter": {
        "id": 50,
        "name": "Room Owner",
        "avatar_url": "https://cdn.example.com/avatars/50.jpg"
      }
    }
  ]
}
```

---

#### 🔒 POST `/user/room/invitations/{id}/accept`

Accept room invitation.

**Response:**

```json
{
  "success": true,
  "message": "Invitation accepted"
}
```

---

#### 🔒 POST `/user/room/invitations/{id}/decline`

Decline room invitation.

**Response:**

```json
{
  "success": true,
  "message": "Invitation declined"
}
```

---

#### 🔒 GET `/user/room/join-requests/mine`

Get user's pending join requests (sent by user).

**Response:**

```json
{
  "data": [
    {
      "id": 789,
      "room_id": 10,
      "user_id": 100,
      "status": "pending",
      "message": "I'd love to join!",
      "created_at": "2025-12-29T10:00:00Z",
      "room": {
        "id": 10,
        "name": "Music Room"
      }
    }
  ]
}
```

---

#### 🔒 GET `/user/room/join-requests`

Get room's pending join requests (for room admin/owner).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "room_id": 10,
      "user_id": 200,
      "status": "pending",
      "message": "Please let me join!",
      "created_at": "2025-12-29T10:00:00Z",
      "user": {
        "id": 200,
        "name": "Jane Doe",
        "avatar_url": "https://cdn.example.com/avatars/200.jpg"
      }
    }
  ]
}
```

**Error (403):** User is not room owner/admin.

---

#### 🔒 POST `/user/room/join-requests/{id}/approve`

Approve join request.

**Response:**

```json
{
  "success": true,
  "message": "Request approved"
}
```

---

#### 🔒 POST `/user/room/join-requests/{id}/reject`

Reject join request.

**Request:**

```json
{
  "reason": "Room is currently not accepting new members"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Request rejected"
}
```

---

## 5. TypeScript Types

See [02-typescript-types.md](./02-typescript-types.md) for complete TypeScript interface definitions.

---

## 6. Error Handling

See [03-error-handling.md](./03-error-handling.md) for comprehensive error codes and handling strategies.

---

## 7. Rate Limiting

| Endpoint Pattern          | Limit | Window   |
| ------------------------- | ----- | -------- |
| `GET /transactions`       | 60    | 1 minute |
| `POST /gifts/send`        | 30    | 1 minute |
| `POST /rewards/:id/claim` | 10    | 1 minute |
| `GET /user/income/*`      | 60    | 1 minute |
| `POST /rooms/:id/join`    | 5     | 1 minute |
| All other endpoints       | 120   | 1 minute |

When rate limited, response includes:

```json
{
  "message": "Too Many Attempts.",
  "retry_after": 45
}
```

Headers included:

- `X-RateLimit-Limit: 60`
- `X-RateLimit-Remaining: 0`
- `Retry-After: 45`

---

## Next Steps

1. Review [02-typescript-types.md](./02-typescript-types.md) for TypeScript interfaces
2. Review [03-error-handling.md](./03-error-handling.md) for error handling patterns
3. Review [04-state-management.md](./04-state-management.md) for Pinia store patterns
