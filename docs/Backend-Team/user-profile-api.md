# User Profile Query API Documentation

> **Version**: 1.0  
> **Last Updated**: January 11, 2026  
> **Base URL**: `/api/v1`

---

## Overview

Fetch any user's public profile by their unique signature. Returns profile data, aggregated gift statistics, agency information, and a paginated list of gifts received.

---

## Endpoint

```
GET /api/v1/users/profile/{signature}
```

### Authentication

| Header          | Value            | Required |
| --------------- | ---------------- | -------- |
| `Authorization` | `Bearer {token}` | ✅ Yes   |

### Path Parameters

| Parameter   | Type     | Description                                     |
| ----------- | -------- | ----------------------------------------------- |
| `signature` | `string` | The user's unique signature (e.g., `abc123xyz`) |

### Query Parameters

| Parameter  | Type      | Default | Description                                |
| ---------- | --------- | ------- | ------------------------------------------ |
| `per_page` | `integer` | `20`    | Number of gifts per page (1-100)           |
| `cursor`   | `string`  | `null`  | Cursor for pagination (from `next_cursor`) |

---

## Response

### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "User profile retrieved successfully",
  "data": {
    "name": "John Doe",
    "signature": "abc123xyz",
    "avatar": {
      "original": "https://ik.imagekit.io/flylive/avatars/user123.jpg",
      "thumbnail": "https://ik.imagekit.io/flylive/avatars/user123.jpg?tr=w-100,h-100",
      "medium": "https://ik.imagekit.io/flylive/avatars/user123.jpg?tr=w-300,h-300",
      "large": "https://ik.imagekit.io/flylive/avatars/user123.jpg?tr=w-600,h-600"
    },
    "frame": "frames/5",
    "gender": 1,
    "wealth_xp": "15000.000",
    "charm_xp": "8500.000",
    "total_gift_coins_sent": "25000.000",
    "total_gift_coins_received": "42000.000",
    "profile_visits": 156,
    "agency": {
      "id": 12,
      "name": "Star Performers",
      "country": "US",
      "total_member_count": 45
    },
    "room_id": 789,
    "gifts_received": [
      {
        "label": "Golden Heart",
        "thumbnail_url": "https://ik.imagekit.io/flylive/gifts/golden-heart.webp",
        "rarity": "legendary",
        "total_quantity_received": 25
      },
      {
        "label": "Rose Bouquet",
        "thumbnail_url": "https://ik.imagekit.io/flylive/gifts/rose-bouquet.webp",
        "rarity": "rare",
        "total_quantity_received": 120
      }
    ]
  },
  "meta": {
    "timestamp": "2026-01-11T17:35:52.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Field Reference

### Profile Fields

| Field                       | Type            | Nullable | Description                                             |
| --------------------------- | --------------- | -------- | ------------------------------------------------------- |
| `name`                      | `string`        | ✅       | User's display name                                     |
| `signature`                 | `string`        | ❌       | Unique user identifier                                  |
| `avatar`                    | `object\|null`  | ✅       | Avatar URLs with transformations                        |
| `frame`                     | `string`        | ❌       | Profile frame asset path                                |
| `gender`                    | `integer`       | ✅       | `1`=Male, `2`=Female, `3`=Non-binary, `4`=Not specified |
| `wealth_xp`                 | `string`        | ❌       | Wealth XP (3 decimal places)                            |
| `charm_xp`                  | `string`        | ❌       | Charm XP (3 decimal places)                             |
| `total_gift_coins_sent`     | `string`        | ❌       | Total coins spent on gifts                              |
| `total_gift_coins_received` | `string`        | ❌       | Total coins received from gifts                         |
| `profile_visits`            | `integer`       | ❌       | Total unique profile visits                             |
| `agency`                    | `object\|null`  | ✅       | Agency info (if member)                                 |
| `room_id`                   | `integer\|null` | ✅       | User's room ID (if exists)                              |
| `gifts_received`            | `array`         | ❌       | Paginated gift aggregates                               |

### Avatar Object

| Field       | Type     | Description         |
| ----------- | -------- | ------------------- |
| `original`  | `string` | Original image URL  |
| `thumbnail` | `string` | 100x100 thumbnail   |
| `medium`    | `string` | 300x300 medium size |
| `large`     | `string` | 600x600 large size  |

### Agency Object

| Field                | Type      | Description                     |
| -------------------- | --------- | ------------------------------- |
| `id`                 | `integer` | Agency ID                       |
| `name`               | `string`  | Agency name                     |
| `country`            | `string`  | ISO 3166-1 alpha-2 country code |
| `total_member_count` | `integer` | Active members count            |

### Gift Received Object

| Field                     | Type      | Description                           |
| ------------------------- | --------- | ------------------------------------- |
| `label`                   | `string`  | Gift display name                     |
| `thumbnail_url`           | `string`  | Gift image URL                        |
| `rarity`                  | `string`  | `common`, `rare`, `epic`, `legendary` |
| `total_quantity_received` | `integer` | Total quantity received               |

---

## Error Responses

### 401 Unauthorized

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": []
}
```

### 404 Not Found

```json
{
  "status": "error",
  "message": "User not found",
  "data": null,
  "errors": []
}
```

### 429 Too Many Requests

```json
{
  "status": "error",
  "message": "Too Many Attempts.",
  "data": null,
  "errors": []
}
```

---

## Usage Examples

### TypeScript/JavaScript

```typescript
interface UserProfile {
  name: string | null;
  signature: string;
  avatar: {
    original: string;
    thumbnail: string;
    medium: string;
    large: string;
  } | null;
  frame: string;
  gender: 1 | 2 | 3 | 4 | null;
  wealth_xp: string;
  charm_xp: string;
  total_gift_coins_sent: string;
  total_gift_coins_received: string;
  profile_visits: number;
  agency: {
    id: number;
    name: string;
    country: string;
    total_member_count: number;
  } | null;
  room_id: number | null;
  gifts_received: Array<{
    label: string;
    thumbnail_url: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    total_quantity_received: number;
  }>;
}

async function fetchUserProfile(signature: string): Promise<UserProfile> {
  const response = await fetch(`/api/v1/users/profile/${signature}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  return json.data;
}
```

### Vue 3 Composable

```typescript
import { ref, computed } from "vue";
import { useFetch } from "@vueuse/core";

export function useUserProfile(signature: string) {
  const { data, error, isFetching } = useFetch(
    `/api/v1/users/profile/${signature}`,
    { immediate: true }
  ).json();

  const profile = computed(() => data.value?.data);
  const hasAgency = computed(() => profile.value?.agency !== null);

  return { profile, hasAgency, error, isLoading: isFetching };
}
```

---

## Best Practices

1. **Cache responses** - Profile data changes infrequently; cache for 1-5 minutes
2. **Show placeholders** - Display skeleton UI while loading
3. **Handle null values** - `avatar`, `agency`, and `room_id` may be null
4. **Format XP values** - Parse strings to numbers for display: `parseFloat(wealth_xp).toLocaleString()`
5. **Gender display** - Map integers to labels in your locale

---

## Rate Limits

| Type                   | Limit              |
| ---------------------- | ------------------ |
| Authenticated requests | 60 requests/minute |
| Per-user profile views | Deduplicated daily |

---

## Changelog

| Version | Date       | Changes         |
| ------- | ---------- | --------------- |
| 1.0     | 2026-01-11 | Initial release |
