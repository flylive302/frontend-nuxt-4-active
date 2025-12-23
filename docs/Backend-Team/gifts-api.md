# Gifts API Documentation

Frontend API reference for the gifts system.

---

## TypeScript Types

```typescript
// Enums
type GiftAssetType = "video" | "svga" | "image";
type GiftRarity = "common" | "rare" | "epic" | "legendary";
type GiftCategory = "normal" | "vip-gifts" | "lucky" | "cp-gift";

// Main gift type
interface Gift {
  id: number;
  name: string;
  label: string | null;
  description: string | null;
  price: number;
  thumbnail_url: string; // Full URL (proxied)
  animation_url: string | null; // Full URL (proxied)
  asset_type: GiftAssetType;
  is_animated: boolean;
  category: GiftCategory;
  rarity: GiftRarity;
  sort_order: number;
}

// Category with count
interface GiftCategory {
  name: string;
  count: number;
}

// Pagination (cursor-based)
interface CursorPagination {
  next_cursor: string | null;
  prev_cursor: string | null;
  per_page: number;
  has_more: boolean;
}

// API response wrapper
interface ApiResponse<T> {
  status: "success" | "error";
  message: string;
  data: T;
  meta: {
    timestamp: string;
    correlation_id: string;
  };
}
```

---

## Endpoints

### 1. Get Gifts (Paginated)

**Best for virtual scroll lists.**

```
GET /api/v1/gifts
```

| Param      | Type   | Default      | Description                                             |
| ---------- | ------ | ------------ | ------------------------------------------------------- |
| `per_page` | number | 20           | Items per page (max 100)                                |
| `cursor`   | string | -            | Cursor for pagination                                   |
| `category` | string | -            | Filter by category                                      |
| `sort_by`  | string | `sort_order` | Sort field: `sort_order`, `price`, `name`, `created_at` |
| `sort_dir` | string | `asc`        | Sort direction: `asc`, `desc`                           |

**Response:**

```typescript
interface GiftsResponse {
  gifts: Gift[];
  pagination: CursorPagination;
}
```

**Example:**

```typescript
// First page
const res = await $fetch<ApiResponse<GiftsResponse>>(
  "/api/v1/gifts?per_page=20"
);

// Next page
const nextRes = await $fetch<ApiResponse<GiftsResponse>>(
  `/api/v1/gifts?per_page=20&cursor=${res.data.pagination.next_cursor}`
);
```

---

### 2. Get All Gifts

**For small catalogs or initial caching.**

```
GET /api/v1/gifts/all
```

**Response:**

```typescript
interface AllGiftsResponse {
  gifts: Gift[];
  total: number;
}
```

---

### 3. Get Categories

```
GET /api/v1/gifts/categories
```

**Response:**

```typescript
interface CategoriesResponse {
  categories: Array<{
    name: string;
    count: number;
  }>;
}
```

---

### 4. Get Single Gift

```
GET /api/v1/gifts/{id}
```

**Response:**

```typescript
interface GiftResponse {
  gift: Gift;
}
```

---

## Virtual Scroll Implementation

```typescript
// composables/useGifts.ts
export function useGifts() {
  const gifts = ref<Gift[]>([]);
  const cursor = ref<string | null>(null);
  const hasMore = ref(true);
  const loading = ref(false);

  async function loadMore(category?: string) {
    if (loading.value || !hasMore.value) return;

    loading.value = true;

    const params = new URLSearchParams({
      per_page: "20",
      ...(cursor.value && { cursor: cursor.value }),
      ...(category && { category }),
    });

    const res = await $fetch<ApiResponse<GiftsResponse>>(
      `/api/v1/gifts?${params}`
    );

    gifts.value.push(...res.data.gifts);
    cursor.value = res.data.pagination.next_cursor;
    hasMore.value = res.data.pagination.has_more;
    loading.value = false;
  }

  function reset() {
    gifts.value = [];
    cursor.value = null;
    hasMore.value = true;
  }

  return { gifts, hasMore, loading, loadMore, reset };
}
```

---

## Image URLs

All image URLs (`thumbnail_url`, `animation_url`) are proxied through the backend to avoid CORS issues. They're ready to use directly in `<img>` tags.

```vue
<img :src="gift.thumbnail_url" :alt="gift.label" />
```
