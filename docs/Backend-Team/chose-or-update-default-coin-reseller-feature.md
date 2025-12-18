# Choose or Update Default Coin Reseller Feature

Complete API integration guide for the default reseller selection feature.

---

## Overview

This feature allows users to:

1. **View all available resellers** to choose from
2. **See their current default reseller** (auto-assigned on registration)
3. **Update their default reseller** at any time

The default reseller is used when creating coin requests.

---

## API Endpoints

All endpoints require authentication via `Authorization: Bearer <token>` header.

### 1. List All Resellers

```http
GET /api/resellers
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `signature` | string | No | Filter resellers by signature (partial match) |

**Response:**

```json
{
  "success": true,
  "message": "Resellers retrieved successfully",
  "data": [
    {
      "name": "John's Coins Store",
      "signature": "johns-coins-store",
      "contact": "+92 300 1234567",
      "avatar": "https://ik.imagekit.io/flylive/avatars/abc123.jpg"
    },
    {
      "name": "Sarah Reseller",
      "signature": "sarah-reseller",
      "contact": "sarah@example.com",
      "avatar": "https://ik.imagekit.io/flylive/avatars/xyz789.jpg"
    }
  ]
}
```

> **Note:** Contact will be phone (formatted) if available, otherwise email. Resellers without avatars are included (display with placeholder). The signature parameter searches both `signature` and `name` fields.

---

### 2. Get Current Default Reseller

```http
GET /api/user/default-reseller
```

**Response (with default reseller):**

```json
{
  "success": true,
  "message": "Default reseller retrieved successfully",
  "data": {
    "name": "John's Coins Store",
    "signature": "johns-coins-store",
    "contact": "+92 300 1234567",
    "avatar": "https://ik.imagekit.io/flylive/avatars/abc123.jpg"
  }
}
```

**Response (no default reseller):**

```json
{
  "success": true,
  "message": "No default reseller set",
  "data": null
}
```

---

### 3. Update Default Reseller

```http
PUT /api/user/default-reseller
Content-Type: application/json
```

**Request Body:**

```json
{
  "reseller_id": 42
}
```

**Response:**

```json
{
  "success": true,
  "message": "Default reseller updated successfully",
  "data": {
    "name": "Sarah Reseller",
    "signature": "sarah-reseller",
    "contact": "sarah@example.com",
    "avatar": "https://ik.imagekit.io/flylive/avatars/xyz789.jpg"
  }
}
```

**Validation Errors (422):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "reseller_id": ["The selected reseller is not valid."]
  }
}
```

---

## TypeScript Types

```typescript
// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// Reseller data from API
interface ResellerApiRow {
  name: string; // Display name
  signature: string; // Unique identifier slug
  contact: string; // Phone or email
  avatar: string; // Avatar URL
}

// For update request
interface UpdateDefaultResellerRequest {
  reseller_id: number;
}
```

---

## Integration Example (Vue 3 / Nuxt)

### Composable

```typescript
// composables/useResellers.ts
export const useResellers = () => {
  const { $api } = useNuxtApp();

  // Fetch all resellers (with optional search)
  const fetchResellers = async (signature?: string) => {
    const params = signature ? { signature } : {};
    return await $api<ApiResponse<ResellerApiRow[]>>("/resellers", { params });
  };

  // Get current default reseller
  const getDefaultReseller = async () => {
    return await $api<ApiResponse<ResellerApiRow | null>>(
      "/user/default-reseller"
    );
  };

  // Update default reseller
  const updateDefaultReseller = async (resellerId: number) => {
    return await $api<ApiResponse<ResellerApiRow>>("/user/default-reseller", {
      method: "PUT",
      body: { reseller_id: resellerId },
    });
  };

  return { fetchResellers, getDefaultReseller, updateDefaultReseller };
};
```

### Component Usage

```vue
<script setup lang="ts">
const { fetchResellers, getDefaultReseller, updateDefaultReseller } =
  useResellers();

// Fetch with debounced search
const searchTerm = ref("");
const debouncedSearch = useDebounce(searchTerm, 250);

const { data: resellers, status } = await useFetch(() => "/api/resellers", {
  query: { signature: debouncedSearch },
  watch: [debouncedSearch],
});

// Get initial default
const { data: defaultReseller } = await useFetch("/api/user/default-reseller");

// Handle selection
async function selectReseller(resellerId: number) {
  await updateDefaultReseller(resellerId);
  // Refresh or update local state
}
</script>
```

---

## Component Prop Update

Your existing `ChooseDefaultReseller` component should update the endpoint prop:

```vue
<ChooseDefaultReseller
  color="primary"
  endpoint="/api/resellers"
  @update:selected="handleResellerChange"
/>
```

The signature search parameter is already supported in the API.

---

## Behavior Notes

| Scenario               | Behavior                                              |
| ---------------------- | ----------------------------------------------------- |
| New user registration  | Default reseller auto-assigned (load-balanced)        |
| No resellers in system | `data: null` returned, user cannot make coin requests |
| User deletes account   | Their assignment counts decrease automatically        |
| Reseller deleted       | Users' `default_reseller_id` set to `null`            |

---

## Error Handling

| Status | Meaning          | Action             |
| ------ | ---------------- | ------------------ |
| `200`  | Success          | Process response   |
| `401`  | Unauthorized     | Redirect to login  |
| `422`  | Validation error | Show error message |
| `500`  | Server error     | Show generic error |

---

## Testing Checklist

- [ ] List resellers shows all available resellers
- [ ] Search filters resellers by signature
- [ ] Default reseller displays correctly on load
- [ ] Selecting new reseller updates successfully
- [ ] Validation error shows for invalid reseller_id
- [ ] UI updates after successful selection
