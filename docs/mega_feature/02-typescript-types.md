# TypeScript Types - Mega Feature System

> **Complete TypeScript Interface Definitions**
> Copy these directly into your project's types directory.

---

## Table of Contents

1. [Common Types](#1-common-types)
2. [Badge Types](#2-badge-types)
3. [Gift & Transaction Types](#3-gift--transaction-types)
4. [Income Types](#4-income-types)
5. [Reward Types](#5-reward-types)
6. [Room Membership Types](#6-room-membership-types)
7. [API Response Types](#7-api-response-types)
8. [Enum Types](#8-enum-types)

---

## 1. Common Types

```typescript
// ============================================
// Common/Shared Types
// ============================================

export interface User {
  id: number;
  name: string;
  signature?: string;
  avatar_url?: string | null;
}

export interface Pagination {
  current_page: number;
  per_page: number;
  total_pages?: number;
  total?: number;
  total_transactions?: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface BalanceChange {
  before: string;
  after: string;
  change: string;
}

export interface BalanceChanges {
  coins?: BalanceChange | null;
  diamonds?: BalanceChange | null;
  wealth_xp?: BalanceChange | null;
  charm_xp?: BalanceChange | null;
}
```

---

## 2. Badge Types

```typescript
// ============================================
// Badge System Types
// ============================================

export type BadgeCategory = "wealth" | "charm" | "room" | "agency" | "special";

export interface Badge {
  id: number;
  name: string;
  description: string | null;
  category: BadgeCategory;
  level: number;
  image_url: string;
  is_stackable: boolean;
  metadata: Record<string, unknown> | null;
}

export interface BadgeCategoryInfo {
  value: BadgeCategory;
  label: string;
  color: string;
  icon: string;
}

export interface UserBadge {
  id: number;
  user_id: number;
  badge_id: number;
  badge: Badge;
  source_type: BadgeSourceType;
  source_id: number | null;
  earned_at: string; // ISO 8601 timestamp
  is_displayed: boolean;
}

export type BadgeSourceType =
  | "wealth_level"
  | "charm_level"
  | "room_level"
  | "agency_target"
  | "manual"
  | "event";

export interface BadgeStats {
  total: number;
  by_category: Record<BadgeCategory, number>;
}

// Request/Response types
export interface ToggleBadgeDisplayResponse {
  message: string;
}

export interface GetBadgeCategoriesResponse {
  data: BadgeCategoryInfo[];
}

export interface GetBadgesParams {
  category?: BadgeCategory;
}
```

---

## 3. Gift & Transaction Types

```typescript
// ============================================
// Gift & Transaction Types
// ============================================

export interface Gift {
  id: number;
  name: string;
  thumbnail_url: string;
  price?: string;
  category?: string;
}

export interface SendGiftRequest {
  gift_id: number;
  receiver_id: number;
  room_id: number;
  quantity: number; // 1-100
}

export interface GiftDistribution {
  room_owner: string;
  receiver: string;
  agency_income: boolean;
}

export interface XpEarned {
  sender_wealth_xp?: string;
  receiver_charm_xp?: string;
  room_level_xp?: string;
}

export interface GiftTransaction {
  id: string;
  batch_id: string;
  type: "gift_send";
  gift: Gift;
  receiver: User;
  amount: string;
  quantity: number;
  total_cost: string;
  distributions: GiftDistribution;
  xp_earned: XpEarned;
  new_balance: string;
}

export interface SendGiftResponse {
  success: true;
  data: {
    transaction: GiftTransaction;
  };
}

export interface SendGiftErrorResponse {
  success: false;
  message: string;
  error_code:
    | "INSUFFICIENT_BALANCE"
    | "GIFT_NOT_AVAILABLE"
    | "INVALID_RECEIVER"
    | "ROOM_NOT_FOUND";
  data?: {
    required?: string;
    available?: string;
  };
}

// Transaction History Types
export type TransactionType =
  | "coin_purchase"
  | "gift_send"
  | "gift_receive"
  | "room_commission"
  | "agency_income"
  | "transfer"
  | "reward_claim"
  | "target_refund"
  | "system_reward"
  | "system_generation";

export type TransactionTypeFilter = "all" | "coins" | "diamonds" | "gifts";

export interface TransactionMetadata {
  gift_id?: number;
  gift_name?: string;
  quantity?: number;
  room_id?: number;
  room_name?: string;
  [key: string]: unknown;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  timestamp: string; // ISO 8601
  title: string;
  description: string;
  thumbnail_url?: string;
  initiator?: User;
  concerned_party?: User | null;
  balance_changes: BalanceChanges;
  metadata: TransactionMetadata;
}

export interface TransactionsByDate {
  date: string; // YYYY-MM-DD
  date_formatted: string; // "29 December, 2025"
  transactions: Transaction[];
}

export interface GetTransactionsParams {
  type?: TransactionTypeFilter;
  page?: number;
  per_page?: number; // max 50
  cursor?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort?: "newest" | "oldest";
}

export interface TransactionsResponse {
  success: true;
  data: {
    transactions_by_date: TransactionsByDate[];
    pagination: Pagination;
  };
}

export interface TransactionSummary {
  total_sent: string;
  total_received: string;
  total_transactions: number;
  by_type: Record<TransactionType, number>;
}
```

---

## 4. Income Types

```typescript
// ============================================
// Agency Income Types
// ============================================

export type IncomeTargetStatus =
  | "active"
  | "completed"
  | "failed"
  | "cancelled";

export interface IncomeTarget {
  id: number;
  tier: string; // "T1", "T2", etc.
  name: string;
  required_coins: string;
  earned_coins: string;
  progress_percentage: number; // 0-100
  period_start: string; // ISO 8601
  period_end: string; // ISO 8601
  days_remaining?: number;
  status: IncomeTargetStatus;
  completed_at?: string | null;
  member_diamond_reward: number;
  owner_diamond_reward: number;
  member_reward_claimed?: boolean;
  member_claimed_at?: string | null;
}

export interface RecentEarning {
  date: string; // YYYY-MM-DD
  amount: string;
  source: TransactionType;
  count: number;
}

export interface IncomeSummary {
  total_coins_earned: string;
  total_diamonds: string;
  claimable_rewards: number;
  pending_targets: number;
}

export interface IncomeStatsResponse {
  success: true;
  data: {
    summary: IncomeSummary;
    active_target: IncomeTarget | null;
    recent_earnings: RecentEarning[];
  };
}

export interface GetIncomeTargetsParams {
  status?: "all" | IncomeTargetStatus;
  per_page?: number;
}

export interface IncomeTargetsResponse {
  success: true;
  data: {
    targets: IncomeTarget[];
    pagination: Pagination;
  };
}

export interface ActiveTargetResponse {
  success: true;
  data: IncomeTarget | null;
}
```

---

## 5. Reward Types

```typescript
// ============================================
// Reward System Types
// ============================================

export type RewardType = "diamonds" | "coins" | "badge" | "gift";

export type RewardSource =
  | "agency_target"
  | "wealth_level"
  | "charm_level"
  | "room_level"
  | "achievement"
  | "event";

export type RewardStatus = "pending" | "claimed" | "expired";

export interface RewardData {
  badge_name?: string;
  badge_url?: string;
  [key: string]: unknown;
}

export interface UserReward {
  id: number;
  reward_type: RewardType;
  reward_value: number | null;
  reward_data?: RewardData | null;
  source: RewardSource;
  source_name: string;
  status: RewardStatus;
  earned_at: string; // ISO 8601
  claimed_at?: string | null;
  expires_at?: string | null;
  can_claim: boolean;
}

export interface RewardStats {
  pending_count: number;
  claimed_count: number;
  total_diamonds_claimed: number;
  total_coins_claimed: string;
  badges_earned: number;
}

export interface GetRewardsHistoryParams {
  limit?: number; // default 50, max 100
}

export interface ClaimRewardResponse {
  success: true;
  message: string;
  data: {
    reward_type: RewardType;
    reward_value: number;
    new_balance: {
      diamonds?: string;
      coins?: string;
    };
  };
}

export type ClaimRewardError =
  | "Reward not found"
  | "Reward already claimed"
  | "Reward has expired";
```

---

## 6. Room Membership Types

```typescript
// ============================================
// Room Membership Types
// ============================================

export type RoomMemberRole = "owner" | "admin" | "member";

export type RoomMemberStatus = "active" | "left" | "kicked" | "banned";

export type JoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export interface Room {
  id: number;
  name: string;
  logo?: string;
  user_id: number;
  type: "public" | "private";
  country?: string;
  is_live?: boolean;
  participant_count?: number;
  current_level?: number;
  level_xp?: string;
  max_seats?: number;
}

export interface RoomMember {
  id: number;
  room_id: number;
  user_id: number;
  role: RoomMemberRole;
  status: RoomMemberStatus;
  joined_at: string; // ISO 8601
  left_at?: string | null;
  invited_by?: number | null;
  user?: User;
  room?: Room;
}

export interface RoomInvitation {
  id: number;
  room_id: number;
  invitee_id: number;
  invited_by: number;
  status: InvitationStatus;
  message?: string | null;
  created_at: string;
  expires_at?: string | null;
  room?: Room;
  inviter?: User;
}

export interface RoomJoinRequest {
  id: number;
  room_id: number;
  user_id: number;
  status: JoinRequestStatus;
  message?: string | null;
  created_at: string;
  room?: Room;
  user?: User;
  rejected_by?: number | null;
  rejection_reason?: string | null;
}

export interface RoomLevelProgress {
  room_id: number;
  current_level: number;
  current_xp: string;
  next_level: number;
  xp_for_next_level: string;
  progress_percentage: number;
  level_badge?: Badge | null;
}

// Request Types
export interface SubmitJoinRequestBody {
  message?: string; // max 500 chars
}

export interface RejectJoinRequestBody {
  reason?: string; // max 500 chars
}

// Response Types
export interface MyMembershipResponse {
  success: true;
  data: RoomMember | null;
  message?: string;
}

export interface JoinRequestResponse {
  success: true;
  message: string;
  data: {
    id: number;
    room_id: number;
    status: "pending";
  };
}

export interface LeaveRoomResponse {
  success: true;
  message: string;
}

export interface RoomLevelResponse {
  success: true;
  data: RoomLevelProgress;
}

// Error types
export type RoomMembershipError =
  | "Room not found"
  | "Already a member of a room"
  | "Already have pending request"
  | "Room is full"
  | "Not a member of any room"
  | "You do not have permission"
  | "Invitation not found"
  | "Request not found"
  | "No pending request";
```

---

## 7. API Response Types

```typescript
// ============================================
// Generic API Response Types
// ============================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error_code?: string;
  errors?: Record<string, string[]>;
  data?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Utility type guards
export function isApiError(
  response: ApiResponse
): response is ApiErrorResponse {
  return response.success === false;
}

export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

// Rate limit headers type
export interface RateLimitHeaders {
  "X-RateLimit-Limit": number;
  "X-RateLimit-Remaining": number;
  "Retry-After"?: number;
}
```

---

## 8. Enum Types

```typescript
// ============================================
// Enum Constants
// ============================================

export const BADGE_CATEGORIES: BadgeCategory[] = [
  "wealth",
  "charm",
  "room",
  "agency",
  "special",
];

export const TRANSACTION_TYPES: TransactionType[] = [
  "coin_purchase",
  "gift_send",
  "gift_receive",
  "room_commission",
  "agency_income",
  "transfer",
  "reward_claim",
  "target_refund",
  "system_reward",
  "system_generation",
];

export const REWARD_TYPES: RewardType[] = [
  "diamonds",
  "coins",
  "badge",
  "gift",
];

export const REWARD_SOURCES: RewardSource[] = [
  "agency_target",
  "wealth_level",
  "charm_level",
  "room_level",
  "achievement",
  "event",
];

export const ROOM_MEMBER_ROLES: RoomMemberRole[] = ["owner", "admin", "member"];

// Display helpers
export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  wealth: "Wealth",
  charm: "Charm",
  room: "Room",
  agency: "Agency",
  special: "Special",
};

export const ROOM_ROLE_LABELS: Record<RoomMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  coin_purchase: "Coins Purchased",
  gift_send: "Gift Sent",
  gift_receive: "Gift Received",
  room_commission: "Room Commission",
  agency_income: "Agency Income",
  transfer: "Transfer",
  reward_claim: "Reward Claimed",
  target_refund: "Target Refund",
  system_reward: "System Reward",
  system_generation: "Coin Generation",
};
```

---

## Usage Example

```typescript
import type {
  SendGiftRequest,
  SendGiftResponse,
  SendGiftErrorResponse,
  isApiError,
} from "@/types/mega-feature";

async function sendGift(request: SendGiftRequest) {
  const response = await fetch("/api/v1/gifts/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  const data: SendGiftResponse | SendGiftErrorResponse = await response.json();

  if (!data.success) {
    if (data.error_code === "INSUFFICIENT_BALANCE") {
      console.error(
        `Need ${data.data?.required}, only have ${data.data?.available}`
      );
    }
    throw new Error(data.message);
  }

  return data.data.transaction;
}
```
