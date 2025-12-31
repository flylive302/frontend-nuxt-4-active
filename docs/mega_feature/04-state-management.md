# State Management Guide - Mega Feature System

> **Pinia Store Patterns for Vue/Nuxt Frontend**
> Complete store implementations with actions, getters, and real-time updates.

---

## Store Architecture Overview

```
stores/
├── badges.ts          # Badge catalog & user badges
├── gifts.ts           # Gift catalog & sending
├── income.ts          # Agency income & targets
├── rewards.ts         # Pending rewards & claiming
├── transactions.ts    # Transaction history
├── roomMembership.ts  # Room membership management
└── user.ts            # User balances (modified)
```

---

## 1. Badge Store

```typescript
// stores/badges.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  Badge,
  UserBadge,
  BadgeCategory,
  BadgeStats,
  BadgeCategoryInfo,
} from "@/types/mega-feature";

export const useBadgeStore = defineStore("badges", () => {
  // State
  const catalog = ref<Badge[]>([]);
  const userBadges = ref<UserBadge[]>([]);
  const categories = ref<BadgeCategoryInfo[]>([]);
  const stats = ref<BadgeStats | null>(null);
  const isLoading = ref(false);

  // Getters
  const displayedBadges = computed(() =>
    userBadges.value.filter((b) => b.is_displayed)
  );

  const badgesByCategory = computed(
    () => (category: BadgeCategory) =>
      catalog.value.filter((b) => b.category === category)
  );

  const userBadgeIds = computed(
    () => new Set(userBadges.value.map((ub) => ub.badge_id))
  );

  const hasUserBadge = computed(
    () => (badgeId: number) => userBadgeIds.value.has(badgeId)
  );

  // Actions
  async function fetchCatalog(category?: BadgeCategory) {
    isLoading.value = true;
    try {
      const params = category ? `?category=${category}` : "";
      const response = await $fetch<{ data: Badge[] }>(
        `/api/v1/badges${params}`
      );
      catalog.value = response.data;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchCategories() {
    const response = await $fetch<{ data: BadgeCategoryInfo[] }>(
      "/api/v1/badges/categories"
    );
    categories.value = response.data;
  }

  async function fetchUserBadges() {
    const response = await $fetch<{ data: UserBadge[] }>(
      "/api/v1/user/badges",
      {
        headers: useAuthHeaders(),
      }
    );
    userBadges.value = response.data;
  }

  async function fetchStats() {
    const response = await $fetch<{ data: BadgeStats }>(
      "/api/v1/user/badges/stats",
      {
        headers: useAuthHeaders(),
      }
    );
    stats.value = response.data;
  }

  async function toggleDisplay(userBadgeId: number) {
    const badge = userBadges.value.find((b) => b.id === userBadgeId);
    if (!badge) return;

    await $fetch(`/api/v1/user/badges/${userBadgeId}/toggle-display`, {
      method: "POST",
      headers: useAuthHeaders(),
    });

    // Optimistic update
    badge.is_displayed = !badge.is_displayed;
  }

  // Real-time badge earned handler
  function onBadgeEarned(newBadge: UserBadge) {
    userBadges.value.push(newBadge);
    if (stats.value) {
      stats.value.total++;
      stats.value.by_category[newBadge.badge.category]++;
    }
  }

  return {
    // State
    catalog,
    userBadges,
    categories,
    stats,
    isLoading,
    // Getters
    displayedBadges,
    badgesByCategory,
    hasUserBadge,
    // Actions
    fetchCatalog,
    fetchCategories,
    fetchUserBadges,
    fetchStats,
    toggleDisplay,
    onBadgeEarned,
  };
});
```

---

## 2. Gift Store

```typescript
// stores/gifts.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  Gift,
  SendGiftRequest,
  GiftTransaction,
} from "@/types/mega-feature";

export const useGiftStore = defineStore("gifts", () => {
  // State
  const catalog = ref<Gift[]>([]);
  const categories = ref<string[]>([]);
  const isSending = ref(false);
  const lastTransaction = ref<GiftTransaction | null>(null);

  // Actions
  async function fetchCatalog() {
    const response = await $fetch<{ data: Gift[] }>("/api/v1/gifts/all");
    catalog.value = response.data;
  }

  async function fetchCategories() {
    const response = await $fetch<{ data: { name: string; count: number }[] }>(
      "/api/v1/gifts/categories"
    );
    categories.value = response.data.map((c) => c.name);
  }

  async function sendGift(request: SendGiftRequest): Promise<GiftTransaction> {
    isSending.value = true;

    try {
      const response = await $fetch<{
        success: true;
        data: { transaction: GiftTransaction };
      }>("/api/v1/gifts/send", {
        method: "POST",
        headers: useAuthHeaders(),
        body: request,
      });

      lastTransaction.value = response.data.transaction;

      // Update user store balance
      const userStore = useUserStore();
      userStore.updateCoins(response.data.transaction.new_balance);

      return response.data.transaction;
    } finally {
      isSending.value = false;
    }
  }

  function getGiftById(id: number): Gift | undefined {
    return catalog.value.find((g) => g.id === id);
  }

  return {
    catalog,
    categories,
    isSending,
    lastTransaction,
    fetchCatalog,
    fetchCategories,
    sendGift,
    getGiftById,
  };
});
```

---

## 3. Income Store

```typescript
// stores/income.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  IncomeTarget,
  IncomeSummary,
  RecentEarning,
  IncomeTargetStatus,
} from "@/types/mega-feature";

export const useIncomeStore = defineStore("income", () => {
  // State
  const summary = ref<IncomeSummary | null>(null);
  const activeTarget = ref<IncomeTarget | null>(null);
  const recentEarnings = ref<RecentEarning[]>([]);
  const targetHistory = ref<IncomeTarget[]>([]);
  const isLoading = ref(false);

  // Getters
  const hasActiveTarget = computed(() => activeTarget.value !== null);

  const targetProgress = computed(() => {
    if (!activeTarget.value) return 0;
    return activeTarget.value.progress_percentage;
  });

  const daysRemaining = computed(() => {
    if (!activeTarget.value?.period_end) return null;
    const end = new Date(activeTarget.value.period_end);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  const coinsToComplete = computed(() => {
    if (!activeTarget.value) return "0";
    const required = parseFloat(activeTarget.value.required_coins);
    const earned = parseFloat(activeTarget.value.earned_coins);
    return (required - earned).toFixed(4);
  });

  // Actions
  async function fetchStats() {
    isLoading.value = true;
    try {
      const response = await $fetch<{
        success: true;
        data: {
          summary: IncomeSummary;
          active_target: IncomeTarget | null;
          recent_earnings: RecentEarning[];
        };
      }>("/api/v1/user/income", {
        headers: useAuthHeaders(),
      });

      summary.value = response.data.summary;
      activeTarget.value = response.data.active_target;
      recentEarnings.value = response.data.recent_earnings;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchHistory(status?: IncomeTargetStatus, perPage = 10) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("per_page", perPage.toString());

    const response = await $fetch<{
      success: true;
      data: { targets: IncomeTarget[] };
    }>(`/api/v1/user/income/targets/history?${params}`, {
      headers: useAuthHeaders(),
    });

    targetHistory.value = response.data.targets;
  }

  async function fetchActiveTarget() {
    const response = await $fetch<{ success: true; data: IncomeTarget | null }>(
      "/api/v1/user/income/targets/active",
      { headers: useAuthHeaders() }
    );
    activeTarget.value = response.data;
  }

  // Real-time updates
  function onIncomeEarned(amount: string) {
    if (activeTarget.value) {
      const newEarned =
        parseFloat(activeTarget.value.earned_coins) + parseFloat(amount);
      activeTarget.value.earned_coins = newEarned.toFixed(4);

      const required = parseFloat(activeTarget.value.required_coins);
      activeTarget.value.progress_percentage = Math.min(
        100,
        (newEarned / required) * 100
      );
    }
  }

  function onTargetCompleted(target: IncomeTarget) {
    activeTarget.value = null;
    targetHistory.value.unshift(target);

    // Trigger reward refresh
    const rewardStore = useRewardStore();
    rewardStore.fetchPending();
  }

  return {
    // State
    summary,
    activeTarget,
    recentEarnings,
    targetHistory,
    isLoading,
    // Getters
    hasActiveTarget,
    targetProgress,
    daysRemaining,
    coinsToComplete,
    // Actions
    fetchStats,
    fetchHistory,
    fetchActiveTarget,
    onIncomeEarned,
    onTargetCompleted,
  };
});
```

---

## 4. Rewards Store

```typescript
// stores/rewards.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  UserReward,
  RewardStats,
  ClaimRewardResponse,
} from "@/types/mega-feature";

export const useRewardStore = defineStore("rewards", () => {
  // State
  const pending = ref<UserReward[]>([]);
  const history = ref<UserReward[]>([]);
  const stats = ref<RewardStats | null>(null);
  const isClaiming = ref<number | null>(null); // ID of reward being claimed

  // Getters
  const pendingCount = computed(() => pending.value.length);

  const totalPendingDiamonds = computed(() =>
    pending.value
      .filter((r) => r.reward_type === "diamonds")
      .reduce((sum, r) => sum + (r.reward_value ?? 0), 0)
  );

  const claimableRewards = computed(() =>
    pending.value.filter((r) => r.can_claim)
  );

  // Actions
  async function fetchPending() {
    const response = await $fetch<{ data: UserReward[] }>(
      "/api/v1/user/rewards",
      { headers: useAuthHeaders() }
    );
    pending.value = response.data;
  }

  async function fetchHistory(limit = 50) {
    const response = await $fetch<{ data: UserReward[] }>(
      `/api/v1/user/rewards/history?limit=${limit}`,
      { headers: useAuthHeaders() }
    );
    history.value = response.data;
  }

  async function fetchStats() {
    const response = await $fetch<{ success: true; data: RewardStats }>(
      "/api/v1/user/rewards/stats",
      { headers: useAuthHeaders() }
    );
    stats.value = response.data;
  }

  async function claim(rewardId: number): Promise<ClaimRewardResponse["data"]> {
    isClaiming.value = rewardId;

    try {
      const response = await $fetch<ClaimRewardResponse>(
        `/api/v1/user/rewards/${rewardId}/claim`,
        {
          method: "POST",
          headers: useAuthHeaders(),
        }
      );

      // Remove from pending
      pending.value = pending.value.filter((r) => r.id !== rewardId);

      // Update user balance
      const userStore = useUserStore();
      if (response.data.new_balance.diamonds) {
        userStore.updateDiamonds(response.data.new_balance.diamonds);
      }
      if (response.data.new_balance.coins) {
        userStore.updateCoins(response.data.new_balance.coins);
      }

      // Refresh stats
      await fetchStats();

      return response.data;
    } finally {
      isClaiming.value = null;
    }
  }

  async function claimAll() {
    const claimableIds = claimableRewards.value.map((r) => r.id);

    for (const id of claimableIds) {
      try {
        await claim(id);
      } catch (err) {
        console.error(`Failed to claim reward ${id}:`, err);
        // Continue claiming others
      }
    }
  }

  // Real-time handler
  function onRewardEarned(reward: UserReward) {
    pending.value.push(reward);
  }

  return {
    // State
    pending,
    history,
    stats,
    isClaiming,
    // Getters
    pendingCount,
    totalPendingDiamonds,
    claimableRewards,
    // Actions
    fetchPending,
    fetchHistory,
    fetchStats,
    claim,
    claimAll,
    onRewardEarned,
  };
});
```

---

## 5. Transactions Store

```typescript
// stores/transactions.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  TransactionsByDate,
  TransactionSummary,
  GetTransactionsParams,
  TransactionTypeFilter,
} from "@/types/mega-feature";

export const useTransactionStore = defineStore("transactions", () => {
  // State
  const transactionsByDate = ref<TransactionsByDate[]>([]);
  const summary = ref<TransactionSummary | null>(null);
  const currentPage = ref(1);
  const hasMore = ref(false);
  const nextCursor = ref<string | null>(null);
  const isLoading = ref(false);
  const currentFilter = ref<TransactionTypeFilter>("all");

  // Getters
  const totalTransactions = computed(() =>
    transactionsByDate.value.reduce(
      (sum, day) => sum + day.transactions.length,
      0
    )
  );

  const isEmpty = computed(() => transactionsByDate.value.length === 0);

  // Actions
  async function fetch(params: GetTransactionsParams = {}) {
    isLoading.value = true;

    try {
      const queryParams = new URLSearchParams();
      if (params.type) queryParams.set("type", params.type);
      if (params.page) queryParams.set("page", params.page.toString());
      if (params.per_page)
        queryParams.set("per_page", params.per_page.toString());
      if (params.cursor) queryParams.set("cursor", params.cursor);
      if (params.date_from) queryParams.set("date_from", params.date_from);
      if (params.date_to) queryParams.set("date_to", params.date_to);
      if (params.sort) queryParams.set("sort", params.sort);

      const response = await $fetch<{
        success: true;
        data: {
          transactions_by_date: TransactionsByDate[];
          pagination: {
            current_page: number;
            has_more: boolean;
            next_cursor?: string;
          };
        };
      }>(`/api/v1/transactions?${queryParams}`, {
        headers: useAuthHeaders(),
      });

      transactionsByDate.value = response.data.transactions_by_date;
      currentPage.value = response.data.pagination.current_page;
      hasMore.value = response.data.pagination.has_more;
      nextCursor.value = response.data.pagination.next_cursor ?? null;
      currentFilter.value = params.type ?? "all";
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    if (!hasMore.value || isLoading.value) return;

    isLoading.value = true;

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("type", currentFilter.value);
      if (nextCursor.value) {
        queryParams.set("cursor", nextCursor.value);
      } else {
        queryParams.set("page", (currentPage.value + 1).toString());
      }

      const response = await $fetch<{
        success: true;
        data: {
          transactions_by_date: TransactionsByDate[];
          pagination: {
            current_page: number;
            has_more: boolean;
            next_cursor?: string;
          };
        };
      }>(`/api/v1/transactions?${queryParams}`, {
        headers: useAuthHeaders(),
      });

      // Merge with existing data
      mergeTransactions(response.data.transactions_by_date);
      currentPage.value = response.data.pagination.current_page;
      hasMore.value = response.data.pagination.has_more;
      nextCursor.value = response.data.pagination.next_cursor ?? null;
    } finally {
      isLoading.value = false;
    }
  }

  function mergeTransactions(newData: TransactionsByDate[]) {
    for (const newDay of newData) {
      const existingDay = transactionsByDate.value.find(
        (d) => d.date === newDay.date
      );
      if (existingDay) {
        // Add new transactions to existing day
        existingDay.transactions.push(...newDay.transactions);
      } else {
        // Add new day
        transactionsByDate.value.push(newDay);
      }
    }
  }

  async function fetchSummary() {
    const response = await $fetch<{ success: true; data: TransactionSummary }>(
      "/api/v1/transactions/summary",
      { headers: useAuthHeaders() }
    );
    summary.value = response.data;
  }

  function reset() {
    transactionsByDate.value = [];
    currentPage.value = 1;
    hasMore.value = false;
    nextCursor.value = null;
    currentFilter.value = "all";
  }

  return {
    // State
    transactionsByDate,
    summary,
    currentPage,
    hasMore,
    isLoading,
    currentFilter,
    // Getters
    totalTransactions,
    isEmpty,
    // Actions
    fetch,
    loadMore,
    fetchSummary,
    reset,
  };
});
```

---

## 6. Room Membership Store

```typescript
// stores/roomMembership.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  RoomMember,
  RoomInvitation,
  RoomJoinRequest,
  RoomLevelProgress,
  Room,
} from "@/types/mega-feature";

export const useRoomMembershipStore = defineStore("roomMembership", () => {
  // State
  const myMembership = ref<RoomMember | null>(null);
  const roomMembers = ref<RoomMember[]>([]);
  const pendingInvitations = ref<RoomInvitation[]>([]);
  const myJoinRequests = ref<RoomJoinRequest[]>([]);
  const incomingJoinRequests = ref<RoomJoinRequest[]>([]);
  const roomLevel = ref<RoomLevelProgress | null>(null);
  const isLoading = ref(false);

  // Getters
  const isMemberOfRoom = computed(() => myMembership.value !== null);

  const isRoomOwner = computed(() => myMembership.value?.role === "owner");

  const isRoomAdmin = computed(
    () =>
      myMembership.value?.role === "owner" ||
      myMembership.value?.role === "admin"
  );

  const canManageMembers = computed(() => isRoomAdmin.value);

  const currentRoom = computed(() => myMembership.value?.room);

  const hasPendingInvitations = computed(
    () => pendingInvitations.value.length > 0
  );

  const hasPendingJoinRequests = computed(
    () => myJoinRequests.value.length > 0
  );

  // Actions
  async function fetchMyMembership() {
    const response = await $fetch<{
      success: true;
      data: RoomMember | null;
    }>("/api/v1/user/room", {
      headers: useAuthHeaders(),
    });
    myMembership.value = response.data;
  }

  async function fetchRoomMembers(roomId: number) {
    const response = await $fetch<{ data: RoomMember[] }>(
      `/api/v1/rooms/${roomId}/members`
    );
    roomMembers.value = response.data;
  }

  async function fetchRoomLevel(roomId: number) {
    const response = await $fetch<{ success: true; data: RoomLevelProgress }>(
      `/api/v1/rooms/${roomId}/level`
    );
    roomLevel.value = response.data;
  }

  async function leaveRoom() {
    await $fetch("/api/v1/user/room/leave", {
      method: "POST",
      headers: useAuthHeaders(),
    });
    myMembership.value = null;
  }

  async function submitJoinRequest(roomId: number, message?: string) {
    const response = await $fetch<{
      success: true;
      data: { id: number; room_id: number; status: "pending" };
    }>(`/api/v1/rooms/${roomId}/join`, {
      method: "POST",
      headers: useAuthHeaders(),
      body: message ? { message } : undefined,
    });
    return response.data;
  }

  async function cancelJoinRequest(roomId: number) {
    await $fetch(`/api/v1/rooms/${roomId}/join`, {
      method: "DELETE",
      headers: useAuthHeaders(),
    });
    myJoinRequests.value = myJoinRequests.value.filter(
      (r) => r.room_id !== roomId
    );
  }

  async function fetchInvitations() {
    const response = await $fetch<{ data: RoomInvitation[] }>(
      "/api/v1/user/room/invitations",
      { headers: useAuthHeaders() }
    );
    pendingInvitations.value = response.data;
  }

  async function acceptInvitation(invitationId: number) {
    await $fetch(`/api/v1/user/room/invitations/${invitationId}/accept`, {
      method: "POST",
      headers: useAuthHeaders(),
    });
    pendingInvitations.value = pendingInvitations.value.filter(
      (i) => i.id !== invitationId
    );
    await fetchMyMembership();
  }

  async function declineInvitation(invitationId: number) {
    await $fetch(`/api/v1/user/room/invitations/${invitationId}/decline`, {
      method: "POST",
      headers: useAuthHeaders(),
    });
    pendingInvitations.value = pendingInvitations.value.filter(
      (i) => i.id !== invitationId
    );
  }

  async function fetchMyJoinRequests() {
    const response = await $fetch<{ data: RoomJoinRequest[] }>(
      "/api/v1/user/room/join-requests/mine",
      { headers: useAuthHeaders() }
    );
    myJoinRequests.value = response.data;
  }

  async function fetchIncomingJoinRequests() {
    if (!canManageMembers.value) return;

    const response = await $fetch<{ success: true; data: RoomJoinRequest[] }>(
      "/api/v1/user/room/join-requests",
      { headers: useAuthHeaders() }
    );
    incomingJoinRequests.value = response.data;
  }

  async function approveJoinRequest(requestId: number) {
    await $fetch(`/api/v1/user/room/join-requests/${requestId}/approve`, {
      method: "POST",
      headers: useAuthHeaders(),
    });
    incomingJoinRequests.value = incomingJoinRequests.value.filter(
      (r) => r.id !== requestId
    );

    // Refresh members
    if (myMembership.value?.room_id) {
      await fetchRoomMembers(myMembership.value.room_id);
    }
  }

  async function rejectJoinRequest(requestId: number, reason?: string) {
    await $fetch(`/api/v1/user/room/join-requests/${requestId}/reject`, {
      method: "POST",
      headers: useAuthHeaders(),
      body: reason ? { reason } : undefined,
    });
    incomingJoinRequests.value = incomingJoinRequests.value.filter(
      (r) => r.id !== requestId
    );
  }

  return {
    // State
    myMembership,
    roomMembers,
    pendingInvitations,
    myJoinRequests,
    incomingJoinRequests,
    roomLevel,
    isLoading,
    // Getters
    isMemberOfRoom,
    isRoomOwner,
    isRoomAdmin,
    canManageMembers,
    currentRoom,
    hasPendingInvitations,
    hasPendingJoinRequests,
    // Actions
    fetchMyMembership,
    fetchRoomMembers,
    fetchRoomLevel,
    leaveRoom,
    submitJoinRequest,
    cancelJoinRequest,
    fetchInvitations,
    acceptInvitation,
    declineInvitation,
    fetchMyJoinRequests,
    fetchIncomingJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
  };
});
```

---

## Helper Functions

```typescript
// composables/useAuthHeaders.ts
export function useAuthHeaders() {
  const token = useCookie("auth_token");
  return {
    Authorization: `Bearer ${token.value}`,
  };
}

// composables/useStoreInit.ts
export async function initMegaFeatureStores() {
  const badgeStore = useBadgeStore();
  const incomeStore = useIncomeStore();
  const rewardStore = useRewardStore();
  const membershipStore = useRoomMembershipStore();

  await Promise.all([
    badgeStore.fetchCategories(),
    badgeStore.fetchUserBadges(),
    incomeStore.fetchStats(),
    rewardStore.fetchPending(),
    membershipStore.fetchMyMembership(),
  ]);
}
```
