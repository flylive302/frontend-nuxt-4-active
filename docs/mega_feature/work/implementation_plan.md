# Mega Feature Implementation Plan

> **FlyLive Frontend Integration**  
> Based on `docs/mega_feature/` backend documentation

---

## Prerequisites

> [!NOTE]
> **MSAB (Socket.IO) is NOT a blocker.** All features work via REST API. Real-time events are enhancements that can be added later when the socket team is ready.

---

## Overview

Implementation of 6 feature domains in priority order:

| Phase | Feature | Complexity | Location |
|-------|---------|------------|----------|
| 1 | Transactions | Medium | `wallet/transaction-history.vue` (enhance) |
| 2 | Gift Updates | Low | `stores/gift.ts` (modify) |
| 3 | Income Dashboard | Medium | `agency/my-agency.vue` (add section) |
| 4 | Rewards System | Medium | `pages/rewards/` (new) |
| 5 | Badges | Medium | `pages/badges/` (enhance) |
| 6 | Room Membership | High | `components/room/*` (integrate) |

---

## File Organization

Following existing domain-based patterns:

```
types/
├── badge.ts          # Badge system types (NEW)
├── income.ts         # Income/target types (NEW)
├── reward.ts         # Reward system types (NEW)
├── wallet.ts         # Extend with transaction types
├── gift.ts           # Extend with new response fields
└── room.ts           # Extend with membership types

stores/
├── transactions.ts   # Transaction history (NEW)
├── badges.ts         # Badge catalog + user badges (NEW)
├── income.ts         # Income targets (NEW)
├── rewards.ts        # Rewards claiming (NEW)
├── gift.ts           # Extend existing
└── room.ts           # Extend existing

composables/
├── room/
│   └── useRoomMembership.ts   # Room membership (NEW)
└── rewards/
    └── useRewardClaiming.ts   # Claim logic (NEW)
```

---

## Proposed Changes

### Phase 1: Transactions

#### [NEW] [transactions.ts](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/stores/transactions.ts)

New Pinia store following `PaginatedState` pattern from `agency.ts`:
- State: `transactionsByDate`, `summary`, `currentFilter`, `hasMore`, `cursor`, `isLoading`
- Actions: `fetch()`, `loadMore()`, `fetchSummary()`, `reset()`
- Getters: `totalTransactions`, `isEmpty`

#### [MODIFY] [transaction-history.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/pages/wallet/transaction-history.vue)

Replace static mock data with API integration:
- Connect to `GET /api/v1/transactions`
- Add filter tabs (all/coins/diamonds/gifts)
- Implement cursor-based infinite scroll using `InfiniteScroll` component
- Use `transactionsByDate` grouped structure from API

#### [MODIFY] [wallet.ts (types)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/types/wallet.ts)

Extend with new transaction types from docs:
- `Transaction`, `TransactionsByDate`, `TransactionSummary`
- `GetTransactionsParams`, `TransactionTypeFilter`
- `BalanceChange`, `BalanceChanges` shared types

#### [MODIFY] [transaction-item.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/transaction-item.vue)

Update props to match new API response:
- Accept `Transaction` type from `types/wallet.ts`
- Display `balance_changes` with before/after/change
- Show `initiator` and `concerned_party` avatars
- Add transaction type icon/color coding

---

### Phase 2: Gift Updates

#### [MODIFY] [gift.ts (types)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/types/gift.ts)

Add new response fields:
```typescript
interface GiftSendResponse {
  transaction: {
    distributions: { room_owner: string; receiver: string; agency_income: boolean };
    xp_earned: { sender_wealth_xp?: string; receiver_charm_xp?: string };
    new_balance: string;
  };
}
```

#### [MODIFY] [gift.ts (store)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/stores/gift.ts)

Update `sendGift` action (or the composable that handles sending):
- Handle new response format
- Update user balance from `new_balance` field
- Optionally display XP earned

---

### Phase 3: Income Dashboard

#### [NEW] [income.ts (types)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/types/income.ts)

New type file for income domain:
- `IncomeTarget`, `IncomeSummary`, `RecentEarning`
- `IncomeTargetStatus`, `IncomeStatsResponse`
- `GetIncomeTargetsParams`, `ActiveTargetResponse`

#### [NEW] [income.ts (store)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/stores/income.ts)

New Pinia store:
- State: `summary`, `activeTarget`, `recentEarnings`, `targetHistory`, `isLoading`
- Actions: `fetchStats()`, `fetchHistory()`, `fetchActiveTarget()`
- Getters: `hasActiveTarget`, `targetProgress`, `daysRemaining`, `coinsToComplete`
- Real-time handlers: `onIncomeEarned()`, `onTargetCompleted()`

#### [NEW] [IncomeTargetProgress.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/agency/IncomeTargetProgress.vue)

New component for displaying active income target:
- Progress bar with tier info
- Days remaining countdown
- Coins earned vs required
- Reward preview (diamonds)

#### [NEW] [RecentEarnings.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/agency/RecentEarnings.vue)

New component for recent earnings list:
- Date, amount, source, count
- Condensed list format

#### [MODIFY] [my-agency.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/pages/agency/my-agency.vue)

Add income section after Agency Dashboard header:
- Insert `IncomeTargetProgress` component
- Insert `RecentEarnings` component (collapsible)
- Only show for approved agency members

---

### Phase 4: Rewards System

#### [NEW] [reward.ts (types)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/types/reward.ts)

New type file for rewards domain:
- `UserReward`, `RewardStats`, `RewardType`, `RewardSource`, `RewardStatus`
- `ClaimRewardResponse`, `GetRewardsHistoryParams`

#### [NEW] [rewards.ts (store)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/stores/rewards.ts)

New Pinia store:
- State: `pending`, `history`, `stats`, `isClaiming`
- Actions: `fetchPending()`, `fetchHistory()`, `fetchStats()`, `claim()`, `claimAll()`
- Getters: `pendingCount`, `totalPendingDiamonds`, `claimableRewards`
- Real-time handler: `onRewardEarned()`

#### [NEW] [index.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/pages/rewards/index.vue)

New rewards page:
- Stats summary at top (pending, claimed, totals)
- Pending rewards section with claim buttons
- History section with infinite scroll
- Empty state when no rewards

#### [NEW] [RewardCard.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/rewards/RewardCard.vue)

Reward display component:
- Icon based on reward type (💎, 🪙, 🏆)
- Source name and value
- Claim button with loading state
- Claimed/pending status indicator

---

### Phase 5: Badges

#### [NEW] [badge.ts (types)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/types/badge.ts)

New type file for badge domain:
- `Badge`, `UserBadge`, `BadgeCategory`, `BadgeCategoryInfo`
- `BadgeStats`, `BadgeSourceType`
- `ToggleBadgeDisplayResponse`, `GetBadgesParams`

#### [NEW] [badges.ts (store)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/stores/badges.ts)

New Pinia store:
- State: `catalog`, `userBadges`, `categories`, `stats`, `isLoading`
- Actions: `fetchCatalog()`, `fetchCategories()`, `fetchUserBadges()`, `fetchStats()`, `toggleDisplay()`
- Getters: `displayedBadges`, `badgesByCategory()`, `hasUserBadge()`
- Real-time handler: `onBadgeEarned()`

#### [MODIFY] [index.vue (badges)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/pages/badges/index.vue)

Connect to API:
- Fetch badge catalog on mount
- Fetch categories dynamically
- Replace `CardProps` placeholders with real `BadgeCard` components
- Add category filter tabs from API

#### [MODIFY] [my-badges.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/pages/badges/my-badges.vue)

Connect to API:
- Fetch user badges
- Show displayed vs hidden toggle
- Add toggle display functionality
- Show badge stats

#### [NEW] [BadgeCard.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/badges/BadgeCard.vue)

Badge display component:
- Badge image with category color
- Name and description
- Earned indicator/checkmark
- Toggle display button (for user badges)

---

### Phase 6: Room Membership

#### [MODIFY] [room.ts (types)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/types/room.ts)

Extend with membership types:
- `RoomMember`, `RoomMemberRole`, `RoomMemberStatus`
- `RoomInvitation`, `RoomJoinRequest`, `RoomLevelProgress`
- `JoinRequestStatus`, `InvitationStatus`
- Request/response types for join, leave, invite actions

#### [NEW] [roomMembership.ts (store)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/stores/roomMembership.ts)

New Pinia store (mirrors `agency.ts` patterns):
- State: `myMembership`, `roomMembers`, `pendingInvitations`, `myJoinRequests`, `incomingJoinRequests`, `roomLevel`
- Actions: `fetchMyMembership()`, `fetchRoomMembers()`, `leaveRoom()`, `submitJoinRequest()`, `cancelJoinRequest()`, `acceptInvitation()`, `declineInvitation()`, `approveJoinRequest()`, `rejectJoinRequest()`
- Getters: `isMemberOfRoom`, `isRoomOwner`, `isRoomAdmin`, `canManageMembers`

#### [MODIFY] [participant-list-item.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/room/participant-list-item.vue)

Add membership actions dropdown:
- "Invite to Room" action (for room owners, when viewing non-members)
- "View Profile" action
- Uses `roomMembership.sendInvitation()`

#### [MODIFY] [details.vue (room)](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/room/details.vue)

Add room membership section:
- Show current membership status
- "Join Room" / "Leave Room" buttons
- Room level progress from API
- Pending invitations/requests indicator

#### [NEW] [JoinRequestDialog.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/room/JoinRequestDialog.vue)

Dialog for submitting join request:
- Optional message input
- Submit/cancel buttons
- Loading state

#### [NEW] [RoomInvitationsPanel.vue](file:///home/xha/FlyLive/frontend-nuxt-4-active/app/components/room/RoomInvitationsPanel.vue)

Panel for room owner to manage:
- Pending join requests list
- Accept/reject actions
- Sent invitations list

---

## Verification Plan

### Manual Testing

> **Note:** All testing is manual. Run `npm run dev` and test in browser.

#### Phase 1: Transactions
1. Run `npm run dev` in `/home/xha/FlyLive/frontend-nuxt-4-active`
2. Log in with test account
3. Navigate to **Wallet → Transaction History**
4. Verify:
   - Transactions load from API (not mock data)
   - Filter tabs work (all/coins/diamonds/gifts)
   - Scroll triggers load more
   - Date grouping displays correctly
   - Each transaction item shows correct data

#### Phase 2: Gift Updates
1. Enter a room with another user
2. Send a gift
3. Verify:
   - Balance updates correctly after send
   - No console errors
   - Toast shows success

#### Phase 3: Income Dashboard
1. Log in as agency member
2. Navigate to **Agency → My Agency**
3. Verify:
   - Income target progress displays (if agency member)
   - Progress bar shows correct percentage
   - Days remaining is accurate
   - Recent earnings list loads

#### Phase 4: Rewards
1. Navigate to **/rewards** (new page)
2. Verify:
   - Stats display at top
   - Pending rewards show with claim buttons
   - Claim button triggers API and updates UI
   - History section loads with scroll

#### Phase 5: Badges
1. Navigate to **Badges** page
2. Verify:
   - Badge catalog loads from API
   - Category tabs filter badges
   - Navigate to "My Badges"
   - Toggle display works
   - Earned badges show indicator

#### Phase 6: Room Membership
1. Enter a room you don't own
2. Verify:
   - Room details drawer shows membership status
   - "Join Room" button works (if not member)
   - "Leave Room" button works (if member)
3. As room owner, verify:
   - Participant list shows invite action
   - Pending requests appear
   - Accept/reject works

---

## Build Verification

After each phase, run:
```bash
cd /home/xha/FlyLive/frontend-nuxt-4-active
npm run build
```

Verify no TypeScript errors or build failures.

---

## Dependencies

No new packages required. Using existing:
- `pinia` for state management
- `ofetch` via `useApi()` composable
- Nuxt UI components

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Backend API not ready | Use mock responses initially, swap when ready |
| Socket.IO not integrated | Implement stores without real-time first, add later |
| Breaking existing gift flow | Maintain backward compatibility in response handling |
