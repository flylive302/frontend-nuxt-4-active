# Error Handling Guide - Mega Feature System

> **Comprehensive Error Handling for Frontend Integration**
> Includes all error codes, HTTP statuses, and handling strategies.

---

## Error Code Reference

### Gift Transaction Errors

| Code                   | HTTP | Message                      | Cause                     | Recommended Action                                   |
| ---------------------- | ---- | ---------------------------- | ------------------------- | ---------------------------------------------------- |
| `INSUFFICIENT_BALANCE` | 422  | Insufficient coins           | User balance < total cost | Show "insufficient coins" modal with recharge option |
| `GIFT_NOT_AVAILABLE`   | 404  | Gift is not available        | Gift inactive/deleted     | Remove gift from UI, refresh catalog                 |
| `INVALID_RECEIVER`     | 422  | Cannot send gift to yourself | Self-sending attempted    | Validate before request (client-side)                |
| `ROOM_NOT_FOUND`       | 404  | Room not found               | Room deleted/invalid      | Navigate back to room list                           |

### Reward Errors

| Code                     | HTTP | Message                | Cause                   | Recommended Action                          |
| ------------------------ | ---- | ---------------------- | ----------------------- | ------------------------------------------- |
| `REWARD_NOT_FOUND`       | 404  | Reward not found       | Invalid ID or not owned | Refresh rewards list                        |
| `REWARD_ALREADY_CLAIMED` | 400  | Reward already claimed | Double-claim attempt    | Update UI to show claimed state             |
| `REWARD_EXPIRED`         | 410  | Reward has expired     | Past expiration date    | Remove from pending list, show notification |

### Room Membership Errors

| Code | HTTP | Message                      | Cause                     | Recommended Action                 |
| ---- | ---- | ---------------------------- | ------------------------- | ---------------------------------- |
| -    | 400  | Already a member of a room   | User in another room      | Prompt to leave current room first |
| -    | 400  | Already have pending request | Duplicate join request    | Show "already requested" state     |
| -    | 400  | Room is full                 | Max seats reached         | Show "room full" message           |
| -    | 400  | Not a member of any room     | Leave without membership  | Refresh membership state           |
| -    | 403  | You do not have permission   | Non-admin action          | Hide admin-only actions            |
| -    | 404  | Room not found               | Room deleted              | Navigate to room list              |
| -    | 404  | Invitation not found         | Expired/invalid           | Refresh invitations list           |
| -    | 404  | No pending request           | Request already processed | Refresh join requests              |

### Income Target Errors

| Code               | HTTP | Message                 | Cause              | Recommended Action        |
| ------------------ | ---- | ----------------------- | ------------------ | ------------------------- |
| `NO_ACTIVE_TARGET` | 404  | No active income target | User not in agency | Show "join agency" prompt |

### Validation Errors (422)

Standard Laravel validation format:

```json
{
  "success": false,
  "message": "The given data was invalid.",
  "errors": {
    "gift_id": ["The gift_id field is required."],
    "quantity": ["The quantity must be between 1 and 100."]
  }
}
```

---

## Error Handling Patterns

### Composable: `useApiError.ts`

```typescript
import { ref } from "vue";

export interface ApiError {
  success: false;
  message: string;
  error_code?: string;
  errors?: Record<string, string[]>;
  data?: Record<string, unknown>;
}

export function useApiError() {
  const error = ref<ApiError | null>(null);
  const isLoading = ref(false);

  const handleError = (err: unknown): string => {
    if (err instanceof Response) {
      return handleHttpError(err.status);
    }

    if (isApiError(err)) {
      error.value = err;
      return err.message;
    }

    if (err instanceof Error) {
      return err.message;
    }

    return "An unexpected error occurred";
  };

  const handleHttpError = (status: number): string => {
    switch (status) {
      case 401:
        // Redirect to login
        navigateTo("/login");
        return "Session expired. Please log in again.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 422:
        return "Please check your input and try again.";
      case 429:
        return "Too many requests. Please wait a moment.";
      case 500:
        return "Server error. Please try again later.";
      default:
        return "An error occurred. Please try again.";
    }
  };

  const clearError = () => {
    error.value = null;
  };

  const getFieldErrors = (field: string): string[] => {
    return error.value?.errors?.[field] ?? [];
  };

  const hasFieldError = (field: string): boolean => {
    return (error.value?.errors?.[field]?.length ?? 0) > 0;
  };

  return {
    error,
    isLoading,
    handleError,
    clearError,
    getFieldErrors,
    hasFieldError,
  };
}

function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "success" in err &&
    (err as ApiError).success === false
  );
}
```

---

### Usage in Components

```vue
<script setup lang="ts">
import { useApiError } from "@/composables/useApiError";
import type { SendGiftRequest } from "@/types/mega-feature";

const { error, isLoading, handleError, clearError, getFieldErrors } =
  useApiError();
const { sendGift } = useGiftStore();

async function onSendGift(request: SendGiftRequest) {
  clearError();
  isLoading.value = true;

  try {
    await sendGift(request);
    toast.success("Gift sent successfully!");
  } catch (err) {
    const message = handleError(err);

    // Handle specific error codes
    if (error.value?.error_code === "INSUFFICIENT_BALANCE") {
      showRechargeDialog();
      return;
    }

    toast.error(message);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="onSendGift(formData)">
    <!-- Show field-level errors -->
    <div v-if="hasFieldError('gift_id')" class="error">
      {{ getFieldErrors("gift_id")[0] }}
    </div>

    <!-- Show general error -->
    <div v-if="error && !error.errors" class="error">
      {{ error.message }}
    </div>

    <button type="submit" :disabled="isLoading">
      {{ isLoading ? "Sending..." : "Send Gift" }}
    </button>
  </form>
</template>
```

---

### Gift Send Error Handling

```typescript
// stores/gift.ts
import type {
  SendGiftRequest,
  SendGiftResponse,
  SendGiftErrorResponse,
} from "@/types/mega-feature";

export const useGiftStore = defineStore("gift", () => {
  async function sendGift(request: SendGiftRequest) {
    const { data, error } = await useApi<SendGiftResponse>("/gifts/send", {
      method: "POST",
      body: request,
    });

    if (error.value) {
      const errorData = error.value.data as SendGiftErrorResponse;

      // Handle specific error codes
      switch (errorData.error_code) {
        case "INSUFFICIENT_BALANCE":
          throw new InsufficientBalanceError(
            errorData.data?.required ?? "0",
            errorData.data?.available ?? "0"
          );

        case "GIFT_NOT_AVAILABLE":
          // Refresh gift catalog
          await refreshGiftCatalog();
          throw new Error(errorData.message);

        case "INVALID_RECEIVER":
          throw new Error("You cannot send a gift to yourself");

        default:
          throw new Error(errorData.message);
      }
    }

    // Update user balance
    userStore.updateBalance(data.value!.data.transaction.new_balance);

    return data.value!.data.transaction;
  }

  return { sendGift };
});

// Custom error classes
class InsufficientBalanceError extends Error {
  constructor(public required: string, public available: string) {
    super("Insufficient coins");
    this.name = "InsufficientBalanceError";
  }
}
```

---

### Reward Claim Error Handling

```typescript
// stores/reward.ts
export const useRewardStore = defineStore("reward", () => {
  async function claimReward(rewardId: number) {
    try {
      const { data, error } = await useApi<ClaimRewardResponse>(
        `/user/rewards/${rewardId}/claim`,
        { method: "POST" }
      );

      if (error.value) {
        const status = error.value.statusCode;

        switch (status) {
          case 404:
            // Reward not found - refresh list
            await fetchPendingRewards();
            throw new Error("Reward not found");

          case 400:
            // Already claimed - update local state
            markRewardAsClaimed(rewardId);
            throw new Error("Reward already claimed");

          case 410:
            // Expired - remove from pending
            removeRewardFromPending(rewardId);
            throw new Error("Reward has expired");

          default:
            throw new Error(error.value.message);
        }
      }

      // Update local state
      markRewardAsClaimed(rewardId);

      // Update balance
      const newBalance = data.value!.data.new_balance;
      if (newBalance.diamonds) {
        userStore.updateDiamonds(newBalance.diamonds);
      }
      if (newBalance.coins) {
        userStore.updateCoins(newBalance.coins);
      }

      return data.value!.data;
    } catch (err) {
      console.error("Failed to claim reward:", err);
      throw err;
    }
  }

  return { claimReward };
});
```

---

### Room Membership Error Handling

```typescript
// stores/roomMembership.ts
export const useRoomMembershipStore = defineStore("roomMembership", () => {
  async function submitJoinRequest(roomId: number, message?: string) {
    const { data, error } = await useApi<JoinRequestResponse>(
      `/rooms/${roomId}/join`,
      {
        method: "POST",
        body: message ? { message } : undefined,
      }
    );

    if (error.value) {
      const errorMessage = error.value.data?.message ?? error.value.message;

      // Handle specific errors
      if (errorMessage.includes("Already a member")) {
        throw new Error("You must leave your current room first");
      }
      if (errorMessage.includes("pending request")) {
        // User already has pending request
        hasPendingRequest.value = true;
        throw new Error("You already have a pending request for this room");
      }
      if (errorMessage.includes("full")) {
        throw new Error("This room is full");
      }

      throw new Error(errorMessage);
    }

    // Update local state
    pendingRequests.value.push(data.value!.data);

    return data.value!.data;
  }

  return { submitJoinRequest };
});
```

---

## Rate Limit Handling

```typescript
// composables/useApi.ts
import { ref } from "vue";

const rateLimitedUntil = ref<number | null>(null);

export async function useApi<T>(url: string, options?: RequestInit) {
  // Check if rate limited
  if (rateLimitedUntil.value && Date.now() < rateLimitedUntil.value) {
    const waitTime = Math.ceil((rateLimitedUntil.value - Date.now()) / 1000);
    throw new RateLimitError(waitTime);
  }

  try {
    const response = await fetch(`/api/v1${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        ...options?.headers,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("Retry-After") ?? "60",
        10
      );
      rateLimitedUntil.value = Date.now() + retryAfter * 1000;
      throw new RateLimitError(retryAfter);
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw { statusCode: response.status, ...data };
    }

    return { data: ref(data), error: ref(null) };
  } catch (err) {
    return { data: ref(null), error: ref(err) };
  }
}

class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
  }
}
```

---

## Error Display Components

### Toast Notifications

```typescript
// composables/useToast.ts
export function useToast() {
  function success(message: string) {
    // Implementation depends on your toast library
    showToast({ type: "success", message });
  }

  function error(message: string) {
    showToast({ type: "error", message });
  }

  function warning(message: string) {
    showToast({ type: "warning", message });
  }

  return { success, error, warning };
}
```

### Error Boundary Component

```vue
<!-- components/ErrorBoundary.vue -->
<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err;
  console.error("Captured error:", err);
  return false; // Prevent error from propagating
});

function retry() {
  error.value = null;
}
</script>

<template>
  <div v-if="error" class="error-boundary">
    <h3>Something went wrong</h3>
    <p>{{ error.message }}</p>
    <button @click="retry">Try Again</button>
  </div>
  <slot v-else />
</template>
```
