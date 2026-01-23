# Room Gift Leaderboard API - Frontend Integration Guide

> API contract and implementation guide for displaying gift spending leaderboards in rooms.

---

## Endpoint

```
GET /api/v1/rooms/{roomId}/gift-leaderboard
```

**Authentication**: Bearer token required

---

## Request

### Path Parameters

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `roomId`  | number | ✅       | Room ID     |

### Query Parameters

| Parameter  | Type   | Default | Description                                      |
| ---------- | ------ | ------- | ------------------------------------------------ |
| `period`   | string | `daily` | Time period: `daily`, `weekly`, `monthly`, `all` |
| `per_page` | number | `20`    | Items per page (1-50)                            |
| `cursor`   | string | —       | Pagination cursor from previous response         |

### Example Requests

```typescript
// Daily leaderboard (default)
GET /api/v1/rooms/123/gift-leaderboard

// Weekly leaderboard with 10 items
GET /api/v1/rooms/123/gift-leaderboard?period=weekly&per_page=10

// Next page using cursor
GET /api/v1/rooms/123/gift-leaderboard?cursor=eyJ0b3RhbF9zcGVudCI6MTAwMDB9
```

---

## Response

### Success Response (200)

```json
{
  "status": "success",
  "message": "Gift leaderboard retrieved successfully",
  "data": [
    {
      "rank": 1,
      "user": {
        "id": 42,
        "name": "TopSpender",
        "signature": "VIP User",
        "avatar": "https://ik.imagekit.io/flylive/avatars/user42.jpg",
        "gender": 1,
        "email": "topspender@example.com",
        "phone": "+1234567890",
        "country": "US",
        "date_of_birth": "1995-05-15",
        "wealth_xp": "25000",
        "charm_xp": "12000"
      },
      "total_spent": 15000,
      "gift_count": 42
    },
    {
      "rank": 2,
      "user": {
        "id": 17,
        "name": "GenerousUser",
        "signature": null,
        "avatar": null,
        "gender": 2,
        "email": "generous@example.com",
        "phone": "+923001234567",
        "country": "PK",
        "date_of_birth": null,
        "wealth_xp": "8000",
        "charm_xp": "5000"
      },
      "total_spent": 8500,
      "gift_count": 23
    }
  ],
  "meta": {
    "pagination": {
      "path": "/api/v1/rooms/123/gift-leaderboard",
      "per_page": 20,
      "next_cursor": "eyJ0b3RhbF9zcGVudCI6MTAwMH0",
      "prev_cursor": null
    },
    "room_id": 123,
    "period": "daily",
    "period_start": "2026-01-23T00:00:00+00:00",
    "period_end": "2026-01-23T12:00:00+00:00",
    "timestamp": "2026-01-23T12:00:00+00:00",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Empty Response

When no gifts have been sent in the specified period:

```json
{
  "status": "success",
  "message": "Gift leaderboard retrieved successfully",
  "data": [],
  "meta": {
    "pagination": {
      "path": "/api/v1/rooms/123/gift-leaderboard",
      "per_page": 20,
      "next_cursor": null,
      "prev_cursor": null
    },
    "room_id": 123,
    "period": "daily",
    "period_start": "2026-01-23T00:00:00+00:00",
    "period_end": "2026-01-23T12:00:00+00:00"
  }
}
```

---

## TypeScript Interfaces

```typescript
// Request parameters
interface GiftLeaderboardParams {
  period?: "daily" | "weekly" | "monthly" | "all";
  per_page?: number;
  cursor?: string;
}

// Gender constants (matches backend User model)
const Gender = {
  MALE: 1,
  FEMALE: 2,
  NON_BINARY: 3,
  NOT_SPECIFIED: 4,
} as const;

type GenderType = (typeof Gender)[keyof typeof Gender] | null;

// User type (matches MinimalUserResource from backend)
interface MinimalUser {
  id: number;
  name: string;
  signature: string | null;
  avatar: string | null;
  gender: GenderType; // 1=Male, 2=Female, 3=Non-Binary, 4=Not Specified
  email: string | null;
  phone: string | null;
  country: string | null; // ISO country code (e.g., "US", "PK")
  date_of_birth: string | null; // Format: "YYYY-MM-DD"
  wealth_xp: string; // Stringified number
  charm_xp: string; // Stringified number
}

interface LeaderboardEntry {
  rank: number;
  user: MinimalUser;
  total_spent: number; // Total coins spent on gifts
  gift_count: number; // Total number of gifts sent
}

interface PaginationMeta {
  path: string;
  per_page: number;
  next_cursor: string | null;
  prev_cursor: string | null;
}

interface LeaderboardMeta {
  pagination: PaginationMeta;
  room_id: number;
  period: "daily" | "weekly" | "monthly" | "all";
  period_start: string | null; // ISO 8601 datetime, null for 'all'
  period_end: string; // ISO 8601 datetime
  timestamp: string;
  correlation_id: string;
}

interface GiftLeaderboardResponse {
  status: "success" | "error";
  message: string;
  data: LeaderboardEntry[];
  meta: LeaderboardMeta;
}
```

---

## Implementation Example (Vue 3 Composable)

```typescript
// composables/useGiftLeaderboard.ts
import { ref, computed } from "vue";

export function useGiftLeaderboard(roomId: number) {
  const entries = ref<LeaderboardEntry[]>([]);
  const loading = ref(false);
  const period = ref<"daily" | "weekly" | "monthly" | "all">("daily");
  const nextCursor = ref<string | null>(null);
  const hasMore = computed(() => nextCursor.value !== null);

  async function fetch(reset = false) {
    if (reset) {
      entries.value = [];
      nextCursor.value = null;
    }

    loading.value = true;
    try {
      const params = new URLSearchParams({
        period: period.value,
        per_page: "20",
        ...(nextCursor.value && !reset ? { cursor: nextCursor.value } : {}),
      });

      const response = await $fetch<GiftLeaderboardResponse>(
        `/api/v1/rooms/${roomId}/gift-leaderboard?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (reset) {
        entries.value = response.data;
      } else {
        entries.value.push(...response.data);
      }

      nextCursor.value = response.meta.pagination.next_cursor;
    } finally {
      loading.value = false;
    }
  }

  function setPeriod(newPeriod: typeof period.value) {
    period.value = newPeriod;
    fetch(true); // Reset and refetch
  }

  return { entries, loading, period, hasMore, fetch, setPeriod };
}
```

---

## Period Definitions

| Period    | Start Date         | Description                  |
| --------- | ------------------ | ---------------------------- |
| `daily`   | Today 00:00        | Current calendar day         |
| `weekly`  | Monday 00:00       | Current week (Monday-Sunday) |
| `monthly` | 1st of month 00:00 | Current calendar month       |
| `all`     | —                  | All-time (no date filter)    |

> **Note**: Times are based on server timezone (UTC+5 / Asia/Karachi)

---

## Error Responses

| Status | Message                             | When                            |
| ------ | ----------------------------------- | ------------------------------- |
| 401    | Unauthorized                        | Missing or invalid bearer token |
| 404    | Room not found                      | Invalid room ID                 |
| 500    | Failed to retrieve gift leaderboard | Server error                    |

---

## Cursor Pagination Notes

1. **First request**: Omit `cursor` parameter
2. **Next page**: Use `meta.pagination.next_cursor` from previous response
3. **Has more data**: Check if `next_cursor` is not `null`
4. **Reset**: Clear local data and fetch without cursor when changing `period`

---

## Performance Tips

1. **Cache by period**: Each period can be cached separately
2. **Invalidate on gift**: Clear cache when user sends a gift in the room
3. **Infinite scroll**: Use cursor pagination for smooth UX
4. **Skeleton loading**: Show placeholders while fetching
