# Coin Requests Feature - Frontend Implementation Guide

> **Stack:** Nuxt 4 + Pinia  
> **API Base:** `/api/v1`  
> **Auth:** Bearer Token (Sanctum)

---

## Table of Contents

1. [Overview](#overview)
2. [Data Types](#data-types)
3. [API Endpoints](#api-endpoints)
4. [Pinia Store](#pinia-store)
5. [Composables](#composables)
6. [Component Examples](#component-examples)
7. [Error Handling](#error-handling)
8. [Real-time Updates](#real-time-updates)

---

## Overview

The Coin Requests system allows users to request coins from resellers. The flow is:

```
User creates request → Backend uses user's default reseller → Reseller receives → Reseller approves/rejects → Coins transferred
```

> [!IMPORTANT] > **Default Reseller Assignment**: Every user is automatically assigned a default reseller during registration (load-balanced selection). The backend uses this default reseller automatically when creating coin requests, so the frontend does **not** need to provide or select a reseller.

### User Roles

| Role            | Capabilities                                               |
| --------------- | ---------------------------------------------------------- |
| **User**        | Create requests, view own requests, cancel pending         |
| **Reseller**    | View received requests, approve/reject, mark credit repaid |
| **Super Admin** | All of the above for any user                              |

---

## Data Types

### TypeScript Interfaces

```typescript
// types/coin-request.ts

export type CoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";
export type CoinRequestType = "cash" | "credit";

export interface CoinRequestUser {
  id: number;
  name: string;
  avatar: string | null;
}

export interface CoinRequestProof {
  url: string;
  file_id: string;
  uploaded_at: string;
}

export interface CoinRequest {
  id: number;
  user: CoinRequestUser;
  reseller: CoinRequestUser;
  amount: string;
  approved_amount: string | null;
  final_amount: string;
  was_adjusted: boolean;
  type: {
    value: CoinRequestType;
    label: string;
  };
  status: {
    value: CoinRequestStatus;
    label: string;
    color: string;
    is_final: boolean;
  };
  message: string | null;
  admin_note: string | null;
  proofs: CoinRequestProof[] | null;
  credit_days: number | null;
  is_repaid: boolean;
  repaid_at: string | null;
  is_repayment_due: boolean;
  processor: {
    id: number;
    name: string;
  } | null;
  processed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// Request payloads
export interface CreateCoinRequestPayload {
  amount: number;
  message?: string;
  proofs?: File[];
  // reseller_id is optional - backend uses user's default reseller if not provided
  reseller_id?: number;
}

export interface ApproveCoinRequestPayload {
  type: CoinRequestType;
  approved_amount?: number;
  credit_days?: number; // Required when type is 'credit'
  admin_note?: string;
}

export interface RejectCoinRequestPayload {
  admin_note?: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    timestamp: string;
    correlation_id: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
}
```

### Status Colors (for UI)

```typescript
export const statusColors: Record<CoinRequestStatus, string> = {
  pending: "warning", // Yellow/Orange
  approved: "success", // Green
  rejected: "danger", // Red
  cancelled: "secondary", // Gray
  expired: "secondary", // Gray
};

export const typeColors: Record<CoinRequestType, string> = {
  cash: "success", // Green
  credit: "info", // Blue
};
```

---

## API Endpoints

### User Endpoints

#### List My Requests

```typescript
GET /api/v1/coin-requests?per_page=15&page=1

// Response: PaginatedResponse<CoinRequest>
```

#### Create Request

```typescript
POST /api/v1/coin-requests
Content-Type: multipart/form-data

// FormData fields:
// - amount: number (required, min: 1)
// - message: string (optional, max: 1000)
// - proofs[]: File[] (optional, max 3 images, each max 5MB)
// - reseller_id: number (OPTIONAL - backend uses user's default reseller if not provided)

// Response: ApiResponse<CoinRequest>
```

> [!NOTE]
> The `reseller_id` field is **optional**. If not provided, the backend automatically uses the authenticated user's default reseller. You only need to provide `reseller_id` if you want to override the default.

#### View Request

```typescript
GET /api/v1/coin-requests/:id

// Response: ApiResponse<CoinRequest>
```

#### Cancel Request

```typescript
DELETE /api/v1/coin-requests/:id

// Only works on pending requests
// Response: ApiResponse<CoinRequest>
```

---

### Reseller Endpoints

#### List Received Requests

```typescript
GET /api/v1/reseller/coin-requests?per_page=15&page=1

// Response: PaginatedResponse<CoinRequest>
```

#### View Received Request

```typescript
GET /api/v1/reseller/coin-requests/:id

// Response: ApiResponse<CoinRequest>
```

#### Approve Request

```typescript
POST /api/v1/reseller/coin-requests/:id/approve
Content-Type: application/json

{
  "type": "cash" | "credit",
  "approved_amount": 100,        // Optional: adjust amount
  "credit_days": 30,             // Required if type is "credit"
  "admin_note": "Approved"       // Optional
}

// Response includes:
// - final_amount: the approved amount
// - reseller_new_balance: updated reseller balance
// - beneficiary_new_balance: updated user balance
```

#### Reject Request

```typescript
POST /api/v1/reseller/coin-requests/:id/reject
Content-Type: application/json

{
  "admin_note": "Insufficient proof"  // Optional
}

// Response: ApiResponse<CoinRequest>
```

#### Mark Credit as Repaid

```typescript
POST /api/v1/reseller/coin-requests/:id/mark-repaid

// Only for approved credit requests
// Response: ApiResponse<CoinRequest>
```

#### List Awaiting Repayment

```typescript
GET / api / v1 / reseller / coin - requests / awaiting - repayment;

// Returns non-paginated list of approved credit requests not yet repaid
// Response: ApiResponse<CoinRequest[]>
```

---

## Pinia Store

```typescript
// stores/coinRequest.ts
import { defineStore } from "pinia";
import type {
  CoinRequest,
  CreateCoinRequestPayload,
  ApproveCoinRequestPayload,
  RejectCoinRequestPayload,
} from "~/types/coin-request";

interface CoinRequestState {
  // User requests
  myRequests: CoinRequest[];
  myRequestsMeta: PaginationMeta | null;

  // Reseller requests
  receivedRequests: CoinRequest[];
  receivedRequestsMeta: PaginationMeta | null;
  awaitingRepayment: CoinRequest[];

  // UI state
  loading: boolean;
  submitting: boolean;
  currentRequest: CoinRequest | null;
}

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const useCoinRequestStore = defineStore("coinRequest", {
  state: (): CoinRequestState => ({
    myRequests: [],
    myRequestsMeta: null,
    receivedRequests: [],
    receivedRequestsMeta: null,
    awaitingRepayment: [],
    loading: false,
    submitting: false,
    currentRequest: null,
  }),

  getters: {
    pendingMyRequests: (state) =>
      state.myRequests.filter((r) => r.status.value === "pending"),

    pendingReceivedRequests: (state) =>
      state.receivedRequests.filter((r) => r.status.value === "pending"),

    overdueCredits: (state) =>
      state.awaitingRepayment.filter((r) => r.is_repayment_due),
  },

  actions: {
    // ========== User Actions ==========

    async fetchMyRequests(page = 1, perPage = 15) {
      this.loading = true;
      try {
        const { data } = await useApiFetch<PaginatedResponse<CoinRequest>>(
          `/coin-requests?page=${page}&per_page=${perPage}`
        );
        this.myRequests = data.data;
        this.myRequestsMeta = data.meta;
      } finally {
        this.loading = false;
      }
    },

    async createRequest(payload: CreateCoinRequestPayload) {
      this.submitting = true;
      try {
        const formData = new FormData();
        formData.append("amount", String(payload.amount));

        // reseller_id is optional - only append if explicitly provided
        if (payload.reseller_id) {
          formData.append("reseller_id", String(payload.reseller_id));
        }

        if (payload.message) {
          formData.append("message", payload.message);
        }

        if (payload.proofs) {
          payload.proofs.forEach((file, index) => {
            formData.append(`proofs[${index}]`, file);
          });
        }

        const { data } = await useApiFetch<ApiResponse<CoinRequest>>(
          "/coin-requests",
          {
            method: "POST",
            body: formData,
          }
        );

        // Add to beginning of list
        this.myRequests.unshift(data.data);
        return data.data;
      } finally {
        this.submitting = false;
      }
    },

    async cancelRequest(id: number) {
      this.submitting = true;
      try {
        const { data } = await useApiFetch<ApiResponse<CoinRequest>>(
          `/coin-requests/${id}`,
          { method: "DELETE" }
        );

        // Update in list
        const index = this.myRequests.findIndex((r) => r.id === id);
        if (index !== -1) {
          this.myRequests[index] = data.data;
        }

        return data.data;
      } finally {
        this.submitting = false;
      }
    },

    // ========== Reseller Actions ==========

    async fetchReceivedRequests(page = 1, perPage = 15) {
      this.loading = true;
      try {
        const { data } = await useApiFetch<PaginatedResponse<CoinRequest>>(
          `/reseller/coin-requests?page=${page}&per_page=${perPage}`
        );
        this.receivedRequests = data.data;
        this.receivedRequestsMeta = data.meta;
      } finally {
        this.loading = false;
      }
    },

    async fetchAwaitingRepayment() {
      const { data } = await useApiFetch<ApiResponse<CoinRequest[]>>(
        "/reseller/coin-requests/awaiting-repayment"
      );
      this.awaitingRepayment = data.data;
    },

    async approveRequest(id: number, payload: ApproveCoinRequestPayload) {
      this.submitting = true;
      try {
        const { data } = await useApiFetch<ApiResponse<CoinRequest>>(
          `/reseller/coin-requests/${id}/approve`,
          {
            method: "POST",
            body: payload,
          }
        );

        this.updateRequestInList(id, data.data);
        return data.data;
      } finally {
        this.submitting = false;
      }
    },

    async rejectRequest(id: number, payload?: RejectCoinRequestPayload) {
      this.submitting = true;
      try {
        const { data } = await useApiFetch<ApiResponse<CoinRequest>>(
          `/reseller/coin-requests/${id}/reject`,
          {
            method: "POST",
            body: payload || {},
          }
        );

        this.updateRequestInList(id, data.data);
        return data.data;
      } finally {
        this.submitting = false;
      }
    },

    async markRepaid(id: number) {
      this.submitting = true;
      try {
        const { data } = await useApiFetch<ApiResponse<CoinRequest>>(
          `/reseller/coin-requests/${id}/mark-repaid`,
          { method: "POST" }
        );

        // Remove from awaiting list
        this.awaitingRepayment = this.awaitingRepayment.filter(
          (r) => r.id !== id
        );
        this.updateRequestInList(id, data.data);

        return data.data;
      } finally {
        this.submitting = false;
      }
    },

    // ========== Helpers ==========

    updateRequestInList(id: number, updated: CoinRequest) {
      const myIndex = this.myRequests.findIndex((r) => r.id === id);
      if (myIndex !== -1) this.myRequests[myIndex] = updated;

      const receivedIndex = this.receivedRequests.findIndex((r) => r.id === id);
      if (receivedIndex !== -1) this.receivedRequests[receivedIndex] = updated;
    },

    async fetchRequest(id: number) {
      this.loading = true;
      try {
        const { data } = await useApiFetch<ApiResponse<CoinRequest>>(
          `/coin-requests/${id}`
        );
        this.currentRequest = data.data;
        return data.data;
      } finally {
        this.loading = false;
      }
    },
  },
});
```

---

## Composables

### useApiFetch

```typescript
// composables/useApiFetch.ts
export const useApiFetch = <T>(url: string, options: any = {}) => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  return useFetch<T>(`${config.public.apiBase}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${authStore.token}`,
      Accept: "application/json",
    },
  });
};
```

### useCoinRequest

```typescript
// composables/useCoinRequest.ts
export const useCoinRequest = () => {
  const store = useCoinRequestStore();
  const toast = useToast();

  const createRequest = async (payload: CreateCoinRequestPayload) => {
    try {
      const request = await store.createRequest(payload);
      toast.success("Coin request created successfully!");
      return request;
    } catch (error: any) {
      toast.error(error.data?.message || "Failed to create request");
      throw error;
    }
  };

  const approveRequest = async (
    id: number,
    payload: ApproveCoinRequestPayload
  ) => {
    try {
      // Validate credit requires days
      if (payload.type === "credit" && !payload.credit_days) {
        toast.error("Credit days required for credit approval");
        return;
      }

      const request = await store.approveRequest(id, payload);
      toast.success(
        `Request approved! ${request.final_amount} coins transferred.`
      );
      return request;
    } catch (error: any) {
      toast.error(error.data?.message || "Failed to approve request");
      throw error;
    }
  };

  const rejectRequest = async (id: number, note?: string) => {
    try {
      const request = await store.rejectRequest(id, { admin_note: note });
      toast.success("Request rejected");
      return request;
    } catch (error: any) {
      toast.error(error.data?.message || "Failed to reject request");
      throw error;
    }
  };

  return {
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest: store.cancelRequest,
    markRepaid: store.markRepaid,
  };
};
```

---

## Component Examples

### Create Request Form (Simplified)

> [!TIP]
> No reseller selection needed! The backend automatically uses the user's assigned default reseller.

```vue
<!-- components/CoinRequest/CreateForm.vue -->
<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Amount -->
    <div>
      <label class="block text-sm font-medium">Amount (Coins)</label>
      <input
        v-model.number="form.amount"
        type="number"
        min="1"
        step="0.01"
        class="w-full rounded border p-2"
        placeholder="Enter amount"
        required
      />
    </div>

    <!-- Message -->
    <div>
      <label class="block text-sm font-medium">Message (Optional)</label>
      <textarea
        v-model="form.message"
        class="w-full rounded border p-2"
        rows="3"
        maxlength="1000"
        placeholder="Add a note for the reseller..."
      />
    </div>

    <!-- Proof Images -->
    <div>
      <label class="block text-sm font-medium">Proof Images (Optional)</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        @change="handleFileChange"
        class="w-full"
      />
      <p class="text-xs text-gray-500 mt-1">Max 3 images, 5MB each</p>

      <!-- Preview -->
      <div v-if="form.proofs.length" class="flex gap-2 mt-2">
        <div v-for="(file, i) in form.proofs" :key="i" class="relative">
          <img
            :src="getPreviewUrl(file)"
            class="w-16 h-16 object-cover rounded"
          />
          <button
            type="button"
            @click="removeProof(i)"
            class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <button
      type="submit"
      :disabled="store.submitting"
      class="w-full bg-primary text-white py-2 rounded disabled:opacity-50"
    >
      {{ store.submitting ? "Submitting..." : "Submit Request" }}
    </button>
  </form>
</template>

<script setup lang="ts">
const store = useCoinRequestStore();
const { createRequest } = useCoinRequest();
const emit = defineEmits(["success"]);

const form = reactive({
  amount: null as number | null,
  message: "",
  proofs: [] as File[],
});

const handleFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;

  // Limit to 3 files
  const newFiles = Array.from(files).slice(0, 3 - form.proofs.length);
  form.proofs.push(...newFiles);
};

const removeProof = (index: number) => {
  form.proofs.splice(index, 1);
};

const getPreviewUrl = (file: File) => URL.createObjectURL(file);

const handleSubmit = async () => {
  if (!form.amount) return;

  try {
    // No reseller_id needed - backend uses user's default reseller
    await createRequest({
      amount: form.amount,
      message: form.message || undefined,
      proofs: form.proofs.length ? form.proofs : undefined,
    });
    emit("success");
  } catch {
    // Error handled in composable
  }
};
</script>
```

### Request Card

```vue
<!-- components/CoinRequest/RequestCard.vue -->
<template>
  <div class="border rounded-lg p-4 shadow-sm">
    <div class="flex justify-between items-start">
      <div class="flex items-center gap-3">
        <img
          :src="request.reseller.avatar || '/default-avatar.png'"
          class="w-10 h-10 rounded-full"
        />
        <div>
          <p class="font-medium">{{ request.reseller.name }}</p>
          <p class="text-sm text-gray-500">
            {{ formatDate(request.created_at) }}
          </p>
        </div>
      </div>

      <Badge :color="request.status.color">
        {{ request.status.label }}
      </Badge>
    </div>

    <div class="mt-4 space-y-2">
      <div class="flex justify-between">
        <span class="text-gray-600">Amount:</span>
        <span class="font-semibold">
          {{ request.final_amount }} coins
          <span v-if="request.was_adjusted" class="text-sm text-gray-500">
            (was {{ request.amount }})
          </span>
        </span>
      </div>

      <div v-if="request.type.value === 'credit'" class="flex justify-between">
        <span class="text-gray-600">Type:</span>
        <span>
          <Badge color="info">Credit</Badge>
          <span class="text-sm ml-1">{{ request.credit_days }} days</span>
        </span>
      </div>

      <div
        v-if="request.message"
        class="text-sm text-gray-600 bg-gray-50 p-2 rounded"
      >
        {{ request.message }}
      </div>

      <!-- Proofs -->
      <div v-if="request.proofs?.length" class="flex gap-2">
        <img
          v-for="proof in request.proofs"
          :key="proof.file_id"
          :src="proof.url"
          class="w-16 h-16 object-cover rounded cursor-pointer"
          @click="openLightbox(proof.url)"
        />
      </div>
    </div>

    <!-- Actions -->
    <div v-if="showActions" class="mt-4 flex gap-2">
      <button
        v-if="canCancel"
        @click="handleCancel"
        class="px-3 py-1 border rounded text-red-600 border-red-600"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CoinRequest } from "~/types/coin-request";

const props = defineProps<{
  request: CoinRequest;
  showActions?: boolean;
}>();

const { cancelRequest } = useCoinRequest();

const canCancel = computed(
  () => props.request.status.value === "pending" && props.showActions
);

const handleCancel = () => {
  if (confirm("Cancel this request?")) {
    cancelRequest(props.request.id);
  }
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(date));
</script>
```

### Reseller Approval Modal

```vue
<!-- components/CoinRequest/ApprovalModal.vue -->
<template>
  <Modal v-model="isOpen" title="Approve Request">
    <div class="space-y-4">
      <!-- Request Summary -->
      <div class="bg-gray-50 p-3 rounded">
        <p><strong>From:</strong> {{ request.user.name }}</p>
        <p><strong>Requested:</strong> {{ request.amount }} coins</p>
      </div>

      <!-- Approval Type -->
      <div>
        <label class="block text-sm font-medium mb-2">Approval Type</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2">
            <input v-model="form.type" type="radio" value="cash" />
            <span>Cash</span>
          </label>
          <label class="flex items-center gap-2">
            <input v-model="form.type" type="radio" value="credit" />
            <span>Credit</span>
          </label>
        </div>
      </div>

      <!-- Credit Days (shown for credit type) -->
      <div v-if="form.type === 'credit'">
        <label class="block text-sm font-medium">Credit Days</label>
        <input
          v-model.number="form.credit_days"
          type="number"
          min="1"
          class="w-full rounded border p-2"
          placeholder="Number of days until repayment"
          required
        />
      </div>

      <!-- Adjust Amount (optional) -->
      <div>
        <label class="block text-sm font-medium">
          Approved Amount (leave empty for original)
        </label>
        <input
          v-model.number="form.approved_amount"
          type="number"
          min="1"
          step="0.01"
          class="w-full rounded border p-2"
          :placeholder="request.amount"
        />
      </div>

      <!-- Note -->
      <div>
        <label class="block text-sm font-medium">Note (Optional)</label>
        <textarea
          v-model="form.admin_note"
          class="w-full rounded border p-2"
          rows="2"
        />
      </div>

      <div class="flex gap-2 justify-end">
        <button @click="isOpen = false" class="px-4 py-2 border rounded">
          Cancel
        </button>
        <button
          @click="handleApprove"
          :disabled="submitting"
          class="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {{ submitting ? "Processing..." : "Approve" }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import type {
  CoinRequest,
  ApproveCoinRequestPayload,
} from "~/types/coin-request";

const props = defineProps<{
  request: CoinRequest;
}>();

const isOpen = defineModel<boolean>();
const { approveRequest } = useCoinRequest();
const submitting = ref(false);

const form = reactive<ApproveCoinRequestPayload>({
  type: "cash",
  approved_amount: undefined,
  credit_days: undefined,
  admin_note: undefined,
});

const handleApprove = async () => {
  submitting.value = true;
  try {
    await approveRequest(props.request.id, {
      type: form.type,
      approved_amount: form.approved_amount || undefined,
      credit_days: form.type === "credit" ? form.credit_days : undefined,
      admin_note: form.admin_note || undefined,
    });
    isOpen.value = false;
  } finally {
    submitting.value = false;
  }
};
</script>
```

---

## Error Handling

### Validation Errors

The API returns validation errors in this format:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "amount": ["The minimum coin amount is 1."]
  }
}
```

### No Default Reseller Error

If a user somehow doesn't have a default reseller assigned:

```json
{
  "success": false,
  "message": "No reseller available",
  "errors": {
    "reseller_id": ["No default reseller assigned. Please contact support."]
  }
}
```

### Business Logic Errors

```json
{
  "success": false,
  "message": "Duplicate pending request",
  "errors": {
    "reseller_id": ["You already have a pending request to this reseller"]
  }
}
```

### Insufficient Balance

```json
{
  "success": false,
  "message": "User John does not have sufficient balance to approve this request",
  "errors": {
    "balance": ["Insufficient balance to approve this request"]
  }
}
```

---

## Real-time Updates

Consider implementing WebSocket listeners for these events:

```typescript
// Event: coin_request.created
// Notify resellers of new requests

// Event: coin_request.processed
// Notify users when their request is approved/rejected

// Event: coin_request.expired
// Update UI when requests expire

// Example with Laravel Echo:
Echo.private(`user.${userId}`).listen(
  ".coin_request.processed",
  (e: { request: CoinRequest }) => {
    store.updateRequestInList(e.request.id, e.request);

    if (e.request.status.value === "approved") {
      toast.success(
        `Your request for ${e.request.final_amount} coins was approved!`
      );
    }
  }
);
```

---

## Best Practices

1. **Default Reseller**: Trust the backend to handle reseller assignment automatically
2. **Optimistic Updates**: Show loading states during API calls
3. **Polling**: For reseller dashboard, poll every 30s for new requests
4. **Expiration Display**: Show countdown timer for pending requests with `expires_at`
5. **Amount Formatting**: Display amounts with 2 decimal places
6. **Image Validation**: Validate file types and sizes before upload
7. **Credit Tracking**: Highlight overdue credits (`is_repayment_due: true`)

---

## Quick Reference

| Action             | Endpoint                                     | Method |
| ------------------ | -------------------------------------------- | ------ |
| List my requests   | `/coin-requests`                             | GET    |
| Create request     | `/coin-requests`                             | POST   |
| View request       | `/coin-requests/:id`                         | GET    |
| Cancel request     | `/coin-requests/:id`                         | DELETE |
| List received      | `/reseller/coin-requests`                    | GET    |
| Approve            | `/reseller/coin-requests/:id/approve`        | POST   |
| Reject             | `/reseller/coin-requests/:id/reject`         | POST   |
| Mark repaid        | `/reseller/coin-requests/:id/mark-repaid`    | POST   |
| Awaiting repayment | `/reseller/coin-requests/awaiting-repayment` | GET    |
