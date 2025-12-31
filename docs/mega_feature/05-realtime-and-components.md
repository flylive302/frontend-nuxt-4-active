# Real-Time Events & Component Patterns

> **Socket.IO Events & Vue Component Integration**
> Complete patterns for real-time updates and UI components.

---

## 1. Socket.IO Event Handlers

### Event Types

```typescript
// types/socket-events.ts

// ============================================
// Socket Event Types
// ============================================

export interface GiftSentEvent {
  event: "gift.sent";
  data: {
    batch_id: string;
    sender: {
      id: number;
      name: string;
      avatar_url: string;
    };
    receiver: {
      id: number;
      name: string;
    };
    gift: {
      id: number;
      name: string;
      thumbnail_url: string;
      animation_url?: string;
    };
    quantity: number;
    room_id: number;
    timestamp: string;
  };
}

export interface BalanceUpdatedEvent {
  event: "balance.updated";
  data: {
    user_id: number;
    coins?: string;
    diamonds?: string;
    wealth_xp?: string;
    charm_xp?: string;
  };
}

export interface RewardEarnedEvent {
  event: "reward.earned";
  data: {
    id: number;
    reward_type: "diamonds" | "coins" | "badge";
    reward_value: number | null;
    source: string;
    source_name: string;
  };
}

export interface BadgeEarnedEvent {
  event: "badge.earned";
  data: {
    id: number;
    badge_id: number;
    badge: {
      name: string;
      image_url: string;
      category: string;
    };
    source_type: string;
  };
}

export interface IncomeTargetCompletedEvent {
  event: "income_target.completed";
  data: {
    id: number;
    tier: string;
    name: string;
    earned_coins: string;
    member_diamond_reward: number;
  };
}

export interface RoomLevelUpEvent {
  event: "room.level_up";
  data: {
    room_id: number;
    new_level: number;
    badge?: {
      id: number;
      name: string;
      image_url: string;
    };
  };
}

export interface JoinRequestEvent {
  event: "room.join_request";
  data: {
    id: number;
    user: {
      id: number;
      name: string;
      avatar_url: string;
    };
    message?: string;
  };
}

export interface InvitationReceivedEvent {
  event: "room.invitation";
  data: {
    id: number;
    room: {
      id: number;
      name: string;
      logo: string;
    };
    inviter: {
      id: number;
      name: string;
    };
    message?: string;
  };
}

export type SocketEvent =
  | GiftSentEvent
  | BalanceUpdatedEvent
  | RewardEarnedEvent
  | BadgeEarnedEvent
  | IncomeTargetCompletedEvent
  | RoomLevelUpEvent
  | JoinRequestEvent
  | InvitationReceivedEvent;
```

---

### Socket Handler Composable

```typescript
// composables/useMegaFeatureSocket.ts
import { onMounted, onUnmounted } from "vue";
import { useUserStore } from "@/stores/user";
import { useRewardStore } from "@/stores/rewards";
import { useBadgeStore } from "@/stores/badges";
import { useIncomeStore } from "@/stores/income";
import { useRoomMembershipStore } from "@/stores/roomMembership";
import type { SocketEvent } from "@/types/socket-events";

export function useMegaFeatureSocket() {
  const { $socket } = useNuxtApp();

  const userStore = useUserStore();
  const rewardStore = useRewardStore();
  const badgeStore = useBadgeStore();
  const incomeStore = useIncomeStore();
  const membershipStore = useRoomMembershipStore();

  const handlers: Record<string, (data: any) => void> = {
    "balance.updated": (data) => {
      if (data.user_id === userStore.currentUser?.id) {
        if (data.coins) userStore.updateCoins(data.coins);
        if (data.diamonds) userStore.updateDiamonds(data.diamonds);
        if (data.wealth_xp) userStore.updateWealthXp(data.wealth_xp);
        if (data.charm_xp) userStore.updateCharmXp(data.charm_xp);
      }
    },

    "reward.earned": (data) => {
      rewardStore.onRewardEarned(data);
      showRewardToast(data);
    },

    "badge.earned": (data) => {
      badgeStore.onBadgeEarned(data);
      showBadgeEarnedModal(data);
    },

    "income_target.completed": (data) => {
      incomeStore.onTargetCompleted(data);
      showTargetCompletedModal(data);
    },

    "room.level_up": (data) => {
      if (membershipStore.currentRoom?.id === data.room_id) {
        membershipStore.roomLevel!.current_level = data.new_level;
        showRoomLevelUpAnimation(data);
      }
    },

    "room.join_request": (data) => {
      if (membershipStore.canManageMembers) {
        membershipStore.incomingJoinRequests.push(data);
        showJoinRequestNotification(data);
      }
    },

    "room.invitation": (data) => {
      membershipStore.pendingInvitations.push(data);
      showInvitationNotification(data);
    },
  };

  function registerHandlers() {
    Object.entries(handlers).forEach(([event, handler]) => {
      $socket.on(event, handler);
    });
  }

  function unregisterHandlers() {
    Object.keys(handlers).forEach((event) => {
      $socket.off(event);
    });
  }

  onMounted(() => {
    registerHandlers();
  });

  onUnmounted(() => {
    unregisterHandlers();
  });

  return { handlers };
}
```

---

## 2. UI Component Patterns

### Gift Send Component

```vue
<!-- components/gift/GiftSendDialog.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import type { Gift, SendGiftRequest } from "@/types/mega-feature";
import { useGiftStore } from "@/stores/gifts";
import { useUserStore } from "@/stores/user";

const props = defineProps<{
  receiverId: number;
  receiverName: string;
  roomId: number;
}>();

const emit = defineEmits<{
  (e: "success", transaction: GiftTransaction): void;
  (e: "close"): void;
}>();

const giftStore = useGiftStore();
const userStore = useUserStore();

const selectedGift = ref<Gift | null>(null);
const quantity = ref(1);
const error = ref<string | null>(null);

const totalCost = computed(() => {
  if (!selectedGift.value) return 0;
  return parseFloat(selectedGift.value.price ?? "0") * quantity.value;
});

const canAfford = computed(() => {
  return parseFloat(userStore.coins) >= totalCost.value;
});

const insufficientAmount = computed(() => {
  if (canAfford.value) return 0;
  return totalCost.value - parseFloat(userStore.coins);
});

async function sendGift() {
  if (!selectedGift.value) return;

  error.value = null;

  try {
    const request: SendGiftRequest = {
      gift_id: selectedGift.value.id,
      receiver_id: props.receiverId,
      room_id: props.roomId,
      quantity: quantity.value,
    };

    const transaction = await giftStore.sendGift(request);
    emit("success", transaction);
    emit("close");
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message;
    }
  }
}
</script>

<template>
  <Dialog @close="emit('close')">
    <DialogHeader> Send Gift to {{ receiverName }} </DialogHeader>

    <DialogBody>
      <!-- Gift Grid -->
      <div class="gift-grid">
        <GiftCard
          v-for="gift in giftStore.catalog"
          :key="gift.id"
          :gift="gift"
          :selected="selectedGift?.id === gift.id"
          @click="selectedGift = gift"
        />
      </div>

      <!-- Quantity Selector -->
      <div v-if="selectedGift" class="quantity-section">
        <label>Quantity</label>
        <div class="quantity-controls">
          <button @click="quantity = Math.max(1, quantity - 1)">-</button>
          <input v-model.number="quantity" type="number" min="1" max="100" />
          <button @click="quantity = Math.min(100, quantity + 1)">+</button>
        </div>
      </div>

      <!-- Cost Summary -->
      <div v-if="selectedGift" class="cost-summary">
        <div class="row">
          <span>{{ selectedGift.name }} × {{ quantity }}</span>
          <span>{{ totalCost.toFixed(2) }} coins</span>
        </div>
        <div class="row balance">
          <span>Your Balance</span>
          <span :class="{ insufficient: !canAfford }">
            {{ userStore.coins }} coins
          </span>
        </div>
      </div>

      <!-- Insufficient Balance Warning -->
      <div v-if="!canAfford && selectedGift" class="insufficient-warning">
        <p>You need {{ insufficientAmount.toFixed(2) }} more coins</p>
        <NuxtLink to="/recharge" class="recharge-link"> Recharge Now </NuxtLink>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </DialogBody>

    <DialogFooter>
      <button @click="emit('close')" class="btn-secondary">Cancel</button>
      <button
        @click="sendGift"
        :disabled="!selectedGift || !canAfford || giftStore.isSending"
        class="btn-primary"
      >
        {{ giftStore.isSending ? "Sending..." : "Send Gift" }}
      </button>
    </DialogFooter>
  </Dialog>
</template>
```

---

### Reward Claim Component

```vue
<!-- components/rewards/RewardCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { UserReward } from "@/types/mega-feature";
import { useRewardStore } from "@/stores/rewards";

const props = defineProps<{
  reward: UserReward;
}>();

const rewardStore = useRewardStore();

const isClaiming = computed(() => rewardStore.isClaiming === props.reward.id);

const rewardIcon = computed(() => {
  switch (props.reward.reward_type) {
    case "diamonds":
      return "💎";
    case "coins":
      return "🪙";
    case "badge":
      return "🏆";
    default:
      return "🎁";
  }
});

const rewardLabel = computed(() => {
  if (props.reward.reward_type === "badge") {
    return props.reward.reward_data?.badge_name;
  }
  return `${props.reward.reward_value} ${props.reward.reward_type}`;
});

async function claim() {
  try {
    await rewardStore.claim(props.reward.id);
    toast.success("Reward claimed!");
  } catch (err) {
    if (err instanceof Error) {
      toast.error(err.message);
    }
  }
}
</script>

<template>
  <div class="reward-card" :class="{ pending: reward.status === 'pending' }">
    <div class="reward-icon">{{ rewardIcon }}</div>

    <div class="reward-info">
      <h4>{{ reward.source_name }}</h4>
      <p class="reward-value">{{ rewardLabel }}</p>
      <time>{{ formatDate(reward.earned_at) }}</time>
    </div>

    <button
      v-if="reward.status === 'pending' && reward.can_claim"
      @click="claim"
      :disabled="isClaiming"
      class="claim-btn"
    >
      {{ isClaiming ? "Claiming..." : "Claim" }}
    </button>

    <div v-else-if="reward.status === 'claimed'" class="claimed-badge">
      ✓ Claimed
    </div>
  </div>
</template>
```

---

### Income Target Progress

```vue
<!-- components/income/TargetProgress.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useIncomeStore } from "@/stores/income";

const incomeStore = useIncomeStore();

const target = computed(() => incomeStore.activeTarget);

const progressBarWidth = computed(
  () => `${Math.min(100, incomeStore.targetProgress)}%`
);

const progressColor = computed(() => {
  const progress = incomeStore.targetProgress;
  if (progress >= 100) return "bg-green-500";
  if (progress >= 70) return "bg-blue-500";
  if (progress >= 40) return "bg-yellow-500";
  return "bg-gray-400";
});
</script>

<template>
  <div v-if="target" class="target-progress">
    <div class="target-header">
      <h3>{{ target.name }}</h3>
      <span class="days-remaining">
        {{ incomeStore.daysRemaining }} days left
      </span>
    </div>

    <div class="progress-bar-container">
      <div
        class="progress-bar"
        :class="progressColor"
        :style="{ width: progressBarWidth }"
      />
    </div>

    <div class="progress-stats">
      <span>{{ target.earned_coins }} / {{ target.required_coins }} coins</span>
      <span>{{ target.progress_percentage.toFixed(1) }}%</span>
    </div>

    <div class="reward-preview">
      <span>Reward:</span>
      <span class="diamonds">💎 {{ target.member_diamond_reward }}</span>
    </div>

    <div v-if="incomeStore.coinsToComplete !== '0'" class="coins-needed">
      <small
        >Need {{ incomeStore.coinsToComplete }} more coins to complete</small
      >
    </div>
  </div>

  <div v-else class="no-target">
    <p>Join an agency to start earning income targets!</p>
    <NuxtLink to="/agencies" class="browse-link"> Browse Agencies </NuxtLink>
  </div>
</template>
```

---

### Transaction History List

```vue
<!-- components/transactions/TransactionList.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useTransactionStore } from "@/stores/transactions";
import type { TransactionTypeFilter } from "@/types/mega-feature";

const transactionStore = useTransactionStore();
const activeFilter = ref<TransactionTypeFilter>("all");

const filters: { value: TransactionTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "coins", label: "Coins" },
  { value: "diamonds", label: "Diamonds" },
  { value: "gifts", label: "Gifts" },
];

async function changeFilter(filter: TransactionTypeFilter) {
  activeFilter.value = filter;
  transactionStore.reset();
  await transactionStore.fetch({ type: filter });
}

const loadMoreRef = ref<HTMLElement | null>(null);

// Intersection Observer for infinite scroll
onMounted(() => {
  transactionStore.fetch();

  if (loadMoreRef.value) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && transactionStore.hasMore) {
        transactionStore.loadMore();
      }
    });
    observer.observe(loadMoreRef.value);
  }
});
</script>

<template>
  <div class="transaction-list">
    <!-- Filters -->
    <div class="filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        :class="{ active: activeFilter === filter.value }"
        @click="changeFilter(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-if="transactionStore.isEmpty && !transactionStore.isLoading"
      class="empty-state"
    >
      <p>No transactions yet</p>
    </div>

    <!-- Transaction Groups by Date -->
    <div
      v-for="day in transactionStore.transactionsByDate"
      :key="day.date"
      class="date-group"
    >
      <h4 class="date-header">{{ day.date_formatted }}</h4>

      <TransactionItem
        v-for="tx in day.transactions"
        :key="tx.id"
        :transaction="tx"
      />
    </div>

    <!-- Loading / Load More -->
    <div ref="loadMoreRef" class="load-more">
      <div v-if="transactionStore.isLoading" class="loading">Loading...</div>
      <button
        v-else-if="transactionStore.hasMore"
        @click="transactionStore.loadMore()"
      >
        Load More
      </button>
    </div>
  </div>
</template>
```

---

### Room Membership Panel

```vue
<!-- components/room/MembershipPanel.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useRoomMembershipStore } from "@/stores/roomMembership";

const membershipStore = useRoomMembershipStore();

const roomLevel = computed(() => membershipStore.roomLevel);
</script>

<template>
  <div class="membership-panel">
    <!-- Not a Member -->
    <div v-if="!membershipStore.isMemberOfRoom" class="no-membership">
      <p>You are not a member of any room</p>

      <!-- Pending Invitations -->
      <div v-if="membershipStore.hasPendingInvitations" class="invitations">
        <h4>Room Invitations</h4>
        <InvitationCard
          v-for="inv in membershipStore.pendingInvitations"
          :key="inv.id"
          :invitation="inv"
          @accept="membershipStore.acceptInvitation(inv.id)"
          @decline="membershipStore.declineInvitation(inv.id)"
        />
      </div>

      <!-- Pending Join Requests -->
      <div v-if="membershipStore.hasPendingJoinRequests" class="my-requests">
        <h4>Your Join Requests</h4>
        <JoinRequestCard
          v-for="req in membershipStore.myJoinRequests"
          :key="req.id"
          :request="req"
          @cancel="membershipStore.cancelJoinRequest(req.room_id)"
        />
      </div>
    </div>

    <!-- Current Membership -->
    <div v-else class="current-membership">
      <div class="room-info">
        <img :src="membershipStore.currentRoom?.logo" alt="Room Logo" />
        <div>
          <h3>{{ membershipStore.currentRoom?.name }}</h3>
          <span class="role-badge">{{
            membershipStore.myMembership?.role
          }}</span>
        </div>
      </div>

      <!-- Room Level Progress -->
      <div v-if="roomLevel" class="level-progress">
        <div class="level-badge">Level {{ roomLevel.current_level }}</div>
        <ProgressBar :value="roomLevel.progress_percentage" />
        <span
          >{{ roomLevel.current_xp }} /
          {{ roomLevel.xp_for_next_level }} XP</span
        >
      </div>

      <!-- Admin Actions -->
      <div v-if="membershipStore.canManageMembers" class="admin-section">
        <h4>
          Pending Requests ({{ membershipStore.incomingJoinRequests.length }})
        </h4>
        <JoinRequestManagement
          v-for="req in membershipStore.incomingJoinRequests"
          :key="req.id"
          :request="req"
          @approve="membershipStore.approveJoinRequest(req.id)"
          @reject="
            (reason) => membershipStore.rejectJoinRequest(req.id, reason)
          "
        />
      </div>

      <!-- Leave Room -->
      <button
        v-if="!membershipStore.isRoomOwner"
        @click="leaveRoom"
        class="leave-btn"
      >
        Leave Room
      </button>
    </div>
  </div>
</template>
```

---

## 3. Badge Earned Animation

```vue
<!-- components/badge/BadgeEarnedModal.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import confetti from "canvas-confetti";

const props = defineProps<{
  badge: {
    name: string;
    image_url: string;
    category: string;
  };
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const isAnimating = ref(true);

onMounted(() => {
  // Trigger confetti
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });

  // Auto-dismiss after animation
  setTimeout(() => {
    isAnimating.value = false;
  }, 2000);
});
</script>

<template>
  <Transition name="badge-modal">
    <div class="badge-earned-modal" @click="emit('close')">
      <div class="modal-content" :class="{ animate: isAnimating }">
        <div class="badge-glow" />

        <img :src="badge.image_url" :alt="badge.name" class="badge-image" />

        <h2>New Badge Earned!</h2>
        <h3>{{ badge.name }}</h3>

        <button @click="emit('close')" class="dismiss-btn">Awesome!</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.badge-earned-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
}

.modal-content {
  text-align: center;
  padding: 2rem;
}

.modal-content.animate .badge-image {
  animation: bounce-in 0.6s ease-out;
}

@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.badge-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4), transparent);
  border-radius: 50%;
  animation: glow-pulse 1.5s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}
</style>
```

---

## 4. Utility Functions

```typescript
// utils/mega-feature.ts

export function formatCoins(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatBalanceChange(change: string): string {
  const num = parseFloat(change);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${formatCoins(num)}`;
}

export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function formatRelativeTime(isoString: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diff = Date.now() - new Date(isoString).getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return rtf.format(-minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");

  const days = Math.floor(hours / 24);
  return rtf.format(-days, "day");
}

export function getTransactionColor(type: string): string {
  const colors: Record<string, string> = {
    gift_send: "text-red-500",
    gift_receive: "text-green-500",
    room_commission: "text-blue-500",
    agency_income: "text-purple-500",
    reward_claim: "text-yellow-500",
    coin_purchase: "text-green-500",
  };
  return colors[type] || "text-gray-500";
}
```

---

## Quick Reference

| Feature         | Store                    | Socket Events                                           |
| --------------- | ------------------------ | ------------------------------------------------------- |
| Badges          | `useBadgeStore`          | `badge.earned`                                          |
| Gifts           | `useGiftStore`           | `gift.sent`                                             |
| Income          | `useIncomeStore`         | `income_target.completed`                               |
| Rewards         | `useRewardStore`         | `reward.earned`                                         |
| Transactions    | `useTransactionStore`    | -                                                       |
| Room Membership | `useRoomMembershipStore` | `room.join_request`, `room.invitation`, `room.level_up` |
| User Balance    | `useUserStore`           | `balance.updated`                                       |
