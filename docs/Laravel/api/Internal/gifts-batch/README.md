# POST /api/v1/internal/gifts/batch

> **Domain**: Internal / Gift  
> **Type**: Internal Endpoint (MSAB Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Processes multiple gift transactions atomically when users send gifts in voice rooms. This is the critical financial processing endpoint.

### Responsibilities

- Validate and process gift transactions
- Handle coin distribution (sender → room owner, receiver)
- Track XP mutations (wealth_xp, charm_xp)
- Record agency income for affiliated users
- Update room XP and check level ups
- Emit real-time balance updates via MSAB
- Enforce idempotency via `reference_id`

### What It Owns

| Owned             | Description                           |
| ----------------- | ------------------------------------- |
| Gift Transactions | Complete financial transaction flow   |
| Coin Distribution | Split between room owner and receiver |
| XP Tracking       | Wealth and charm XP mutations         |
| Agency Income     | Revenue sharing with agencies         |
| Room XP           | Progress towards room level ups       |

### External Dependencies

| Dependency              | Type           | Purpose                        |
| ----------------------- | -------------- | ------------------------------ |
| PostgreSQL              | Database       | Transaction persistence        |
| Redis                   | Infrastructure | Cache, MSAB event publishing   |
| GiftTransactionService  | Service        | Core transaction orchestration |
| CoinDistributionService | Service        | Coin split calculations        |
| AgencyIncomeService     | Service        | Agency revenue handling        |
| MSABEventService        | Service        | Real-time event emission       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/internal/gifts/batch
```

### Authentication

✅ **Required** - X-Internal-Key header only (no user token)

### Rate Limiting

| Limiter        | Key                         | Config               |
| -------------- | --------------------------- | -------------------- |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests/minute |

### Request Headers

| Header           | Required | Type               | Description               |
| ---------------- | -------- | ------------------ | ------------------------- |
| `Content-Type`   | ✅       | `application/json` | Request body format       |
| `Accept`         | ✅       | `application/json` | Response format           |
| `X-Internal-Key` | ✅       | `string`           | MSAB internal service key |

### Request Body Schema

```json
{
  "transactions": [
    {
      "transaction_id": "msab_tx_abc123",
      "sender_id": 123,
      "recipient_id": 456,
      "gift_id": 1,
      "room_id": 789,
      "quantity": 5,
      "timestamp": 1738618800,
      "message": "Great stream!"
    }
  ]
}
```

#### Field Details

| Field            | Type      | Constraints                | Example            |
| ---------------- | --------- | -------------------------- | ------------------ |
| `transaction_id` | `string`  | Required (idempotency key) | `"msab_tx_abc123"` |
| `sender_id`      | `integer` | Required                   | `123`              |
| `recipient_id`   | `integer` | Required                   | `456`              |
| `gift_id`        | `integer` | Required                   | `1`                |
| `room_id`        | `integer` | Required                   | `789`              |
| `quantity`       | `integer` | Required, min: 1           | `5`                |
| `timestamp`      | `numeric` | Required (Unix timestamp)  | `1738618800`       |
| `message`        | `string`  | Optional, max: 255 chars   | `"Great stream!"`  |

---

### Response Schemas

#### ✅ Success Response - All Processed (200)

```json
{
  "processed_count": 3,
  "failed": []
}
```

#### ⚠️ Partial Success Response (200)

```json
{
  "processed_count": 2,
  "failed": [
    {
      "transaction_id": "msab_tx_def456",
      "code": 4002,
      "reason": "Insufficient coins"
    }
  ]
}
```

#### ❌ Validation Error (422)

```json
{
  "message": "The transactions field is required.",
  "errors": {
    "transactions": ["The transactions field is required."]
  }
}
```

### Error Codes (per-transaction in `failed` array)

| Code   | Name                  | Description                                 |
| ------ | --------------------- | ------------------------------------------- |
| `4002` | Insufficient coins    | Sender doesn't have enough coins            |
| `4004` | Entity not found      | Gift inactive, room not found, user invalid |
| `5000` | Internal Server Error | Unexpected processing error                 |

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Batch processed (may have failures) |
| `403` | Invalid X-Internal-Key              |
| `422` | Request validation failed           |
| `429` | Rate limit exceeded                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/internal/gifts/batch                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:36                                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/gifts/batch', [GiftController::class, 'processBatch']);   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth          → Validates X-Internal-Key header                │
│   2. throttle:internal_api → 1000 req/min per service key                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER VALIDATION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:40-60                │
│ Method: processBatch(Request $request)                                      │
│                                                                             │
│ STEP 1: Inline validation                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = Validator::make($request->all(), [                         │ │
│ │     'transactions' => 'required|array',                                 │ │
│ │     'transactions.*.transaction_id' => 'required|string',               │ │
│ │     'transactions.*.sender_id' => 'required|integer',                   │ │
│ │     'transactions.*.recipient_id' => 'required|integer',                │ │
│ │     'transactions.*.gift_id' => 'required|integer',                     │ │
│ │     'transactions.*.room_id' => 'required|integer',                     │ │
│ │     'transactions.*.quantity' => 'required|integer|min:1',              │ │
│ │     'transactions.*.timestamp' => 'required|numeric',                   │ │
│ │     'transactions.*.message' => 'sometimes|nullable|string|max:255',    │ │
│ │ ])->validate();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 BATCH PROCESSING LOOP                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:56-96                │
│                                                                             │
│ STEP 1: Initialize counters                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $transactions = $request->input('transactions');                        │ │
│ │ $processed = 0;                                                         │ │
│ │ $failed = [];                                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Iterate with idempotency check                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ foreach ($transactions as $txData) {                                    │ │
│ │     // Check idempotency first using reference_id                       │ │
│ │     $existing = Transaction::where('reference_id', $txData['transaction_id']) │
│ │         ->exists();                                                     │ │
│ │                                                                         │ │
│ │     if ($existing) {                                                    │ │
│ │         $processed++; // Already processed, count as success            │ │
│ │         continue;                                                       │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     try {                                                               │ │
│ │         $result = $this->handleSingleTransaction($txData);              │ │
│ │         if ($result['success']) {                                       │ │
│ │             $processed++;                                               │ │
│ │         } else {                                                        │ │
│ │             $failed[] = [                                               │ │
│ │                 'transaction_id' => $txData['transaction_id'],          │ │
│ │                 'code' => $result['code'],                              │ │
│ │                 'reason' => $result['message'],                         │ │
│ │             ];                                                          │ │
│ │         }                                                               │ │
│ │     } catch (\Exception $e) {                                           │ │
│ │         $failed[] = [                                                   │ │
│ │             'transaction_id' => $txData['transaction_id'],              │ │
│ │             'code' => 5000,                                             │ │
│ │             'reason' => 'Internal Server Error',                        │ │
│ │         ];                                                              │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 GIFT TRANSACTION SERVICE                                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:68-96                    │
│ Method: processGiftTransaction(GiftTransactionDTO $dto): array              │
│                                                                             │
│ Note: Idempotency is handled in controller, not service                     │
│                                                                             │
│ STEP 1: Generate batch ID internally                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $batchId = 'gift_' . Str::uuid()->toString();                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Begin atomic database transaction with retry                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = DB::transaction(function () use ($dto, $batchId, &$eventData) { │
│ │     // ... all mutations inside transaction                             │ │
│ │ }, 3);  // 3 retry attempts on deadlock                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ENTITY LOADING (CACHED)                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:76-96                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Load gift with cache (5 min TTL)                                     │ │
│ │ $gift = Cache::remember(                                                │ │
│ │     "gift:{$dto->giftId}:active", 300,                                  │ │
│ │     fn () => Gift::where('id', $dto->giftId)                            │ │
│ │         ->where('is_active', true)->first()                             │ │
│ │ );                                                                      │ │
│ │ if (! $gift) throw new GiftNotFoundException($dto->giftId);             │ │
│ │                                                                         │ │
│ │ // Load room with cache (30s TTL)                                       │ │
│ │ $room = Cache::remember(                                                │ │
│ │     "room:{$dto->roomId}:live", 30,                                     │ │
│ │     fn () => Room::find($dto->roomId)                                   │ │
│ │ );                                                                      │ │
│ │ if (! $room) throw new RoomNotFoundException($dto->roomId);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: User locking is handled inside CoinDistributionService methods       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 COIN CALCULATION                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:98-109                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Integer math for coins (NO BC MATH)                                  │ │
│ │ $giftCoinValue = (int) ($gift->price * $dto->quantity);                 │ │
│ │                                                                         │ │
│ │ // Get distribution percentages from SystemSettingService               │ │
│ │ $rop = $this->settingService->getRoomOwnerPercentage();                 │ │
│ │ $receiverPercentage = $this->settingService->getReceiverPercentage();   │ │
│ │                                                                         │ │
│ │ // Integer math with floor() for coin distribution                      │ │
│ │ $roomOwnerCoins = (int) floor($giftCoinValue * ($rop / 100));           │ │
│ │ $receiverCoins = (int) floor($giftCoinValue * ($receiverPercentage/100));│
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Uses: SystemSettingService for percentage configuration                     │
│ Note: Insufficient balance check is inside CoinDistributionService          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 BALANCE MUTATIONS (via CoinDistributionService)                         │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:124-172                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $senderIsRoomOwner = $room->user_id === $dto->senderId;                 │ │
│ │ $receiverIsRoomOwner = $room->user_id === $dto->receiverId;             │ │
│ │                                                                         │ │
│ │ // 4A. SENDER BALANCE: Deduct gift cost                                 │ │
│ │ $senderBalanceResult = $this->coinDistributionService->deductFromUser(  │ │
│ │     $dto->senderId, $giftCoinValue                                      │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // 4B. SENDER gets commission back if they are room owner               │ │
│ │ if ($senderIsRoomOwner && $roomOwnerCoins > 0) {                        │ │
│ │     $senderCommissionResult = $this->coinDistributionService            │ │
│ │         ->addToUser($dto->senderId, $roomOwnerCoins);                   │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // 5A. RECEIVER BALANCE: Add coins (if not agency member)               │ │
│ │ if (! $isAgencyMember && $receiverCoins > 0) {                          │ │
│ │     $receiverBalanceResult = $this->coinDistributionService             │ │
│ │         ->addToUser($dto->receiverId, $receiverCoins);                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // 6. ROOM OWNER: Only if different from sender AND receiver            │ │
│ │ if (! $senderIsRoomOwner && ! $receiverIsRoomOwner && $roomOwnerCoins > 0) { │
│ │     $roomOwnerBalanceResult = $this->coinDistributionService            │ │
│ │         ->addToUser($room->user_id, $roomOwnerCoins);                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: CoinDistributionService handles lockForUpdate internally              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 XP MUTATIONS (via applyXpMutation)                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:178-183                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // 4C. SENDER XP: Add wealth_xp (inlined with lockForUpdate)            │ │
│ │ $senderXpResult = $this->applyXpMutation(                               │ │
│ │     $dto->senderId, 'wealth_xp', (float) $giftCoinValue                 │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // 5C. RECEIVER XP: Add charm_xp (inlined with lockForUpdate)           │ │
│ │ $receiverXpResult = $this->applyXpMutation(                             │ │
│ │     $dto->receiverId, 'charm_xp', (float) $giftCoinValue                │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: applyXpMutation uses lockForUpdate internally and returns             │
│       before/after XP values plus coins_snapshot for consistency            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.9 AGENCY INCOME (IF APPLICABLE)                                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:213-240                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Check if receiver belongs to an agency                               │ │
│ │ $agencyMember = AgencyMember::where('user_id', $receiver->id)           │ │
│ │     ->where('status', AgencyMemberStatus::ACTIVE)                       │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($agencyMember) {                                                    │ │
│ │     $this->agencyIncomeService->recordIncome(                           │ │
│ │         $agencyMember,                                                  │ │
│ │         $receiverShare,                                                 │ │
│ │         'gift_received'                                                 │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Uses: AgencyIncomeService for agency revenue tracking                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.10 ROOM XP UPDATE                                                         │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:243-260                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Add XP to room                                                       │ │
│ │ $roomXpGain = $totalCost * $this->systemSettings->get('room_xp_rate');  │ │
│ │ $room->room_xp += $roomXpGain;                                          │ │
│ │ $room->save();                                                          │ │
│ │                                                                         │ │
│ │ // Check room level up                                                  │ │
│ │ $this->roomLevelService->checkAndProcessLevelUp($room);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Uses: RoomLevelService for room progression                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.11 TRANSACTION RECORD CREATION                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:263-290                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $transaction = Transaction::create([                                    │ │
│ │     'batch_id' => $batchId,                                             │ │
│ │     'reference_id' => $dto->referenceId,                                │ │
│ │     'sender_id' => $dto->senderId,                                      │ │
│ │     'receiver_id' => $dto->receiverId,                                  │ │
│ │     'gift_id' => $dto->giftId,                                          │ │
│ │     'room_id' => $dto->roomId,                                          │ │
│ │     'quantity' => $dto->quantity,                                       │ │
│ │     'total_amount' => $totalCost,                                       │ │
│ │     'receiver_amount' => $receiverShare,                                │ │
│ │     'room_owner_amount' => $distribution['room_owner_amount'],          │ │
│ │     'message' => $dto->message,                                         │ │
│ │     'processed_at' => now(),                                            │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.12 MSAB EVENTS (AFTER TRANSACTION COMMITS)                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:293-320                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // CRITICAL: Events emitted AFTER DB transaction commits                │ │
│ │ if ($eventData !== null) {                                              │ │
│ │     // 1. Emit balance.updated to sender                                │ │
│ │     $sender = User::find($dto->senderId);                               │ │
│ │     if ($sender) {                                                      │ │
│ │         $this->msabEventService->emitBalanceUpdated($sender);           │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // 2. Emit balance.updated to receiver                              │ │
│ │     $receiver = User::find($dto->receiverId);                           │ │
│ │     if ($receiver) {                                                    │ │
│ │         $this->msabEventService->emitBalanceUpdated($receiver);         │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: gift.Sent is NOT emitted - MSAB handles this optimistically           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.13 RESPONSE AGGREGATION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:110-130              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'processed_count' => $processed,                                    │ │
│ │     'failed' => $failed,                                                │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                           200 + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                          | Used By Endpoints           | Reusable | Reasoning              |
| ----------------------------- | --------------------------- | -------- | ---------------------- |
| `InternalAuth.php`            | All internal endpoints      | ✅       | Shared middleware      |
| `GiftTransactionService.php`  | Gift endpoints, future APIs | ✅       | Core financial service |
| `CoinDistributionService.php` | Gift transactions           | ✅       | Split calculation      |
| `AgencyIncomeService.php`     | Gift tx, agency features    | ✅       | Revenue tracking       |
| `MSABEventService.php`        | All real-time features      | ✅       | Event emission         |
| `GiftTransactionDTO.php`      | Gift transactions           | ✅       | Data transfer object   |
| `Gift.php` Model              | Gift-related endpoints      | ✅       | Core domain model      |
| `User.php` Model              | Everywhere                  | ✅       | Core domain model      |
| `Room.php` Model              | Room-related endpoints      | ✅       | Core domain model      |
| `Transaction.php` Model       | Gift/finance features       | ✅       | Financial record       |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                                    | Source    | Condition                  |
| ---------------------------------------- | --------- | -------------------------- |
| `transactions.required`                  | Validator | Missing transactions array |
| `transactions.*.transaction_id.required` | Validator | Missing idempotency key    |
| `transactions.*.sender_id.required`      | Validator | Missing sender ID          |
| `transactions.*.recipient_id.required`   | Validator | Missing recipient ID       |
| `transactions.*.gift_id.required`        | Validator | Missing gift ID            |
| `transactions.*.room_id.required`        | Validator | Missing room ID            |
| `transactions.*.quantity.min`            | Validator | Quantity less than 1       |
| `transactions.*.timestamp.required`      | Validator | Missing timestamp          |

### Business Logic Errors (Per-Transaction in `failed` array)

| Error Code | Name                       | Condition                                |
| ---------- | -------------------------- | ---------------------------------------- |
| `4002`     | Insufficient coins         | `sender.coins < totalCost`               |
| `4004`     | Gift not found or inactive | Gift entity missing or `is_active=false` |
| `4004`     | Room not found             | Room entity missing                      |
| `4004`     | User not found             | User entity missing                      |
| `4004`     | Invalid users              | Invalid sender/recipient combination     |
| `5000`     | Internal Server Error      | Unexpected exception                     |

> **Note**: Duplicate `transaction_id` is silently counted as processed (idempotent)

### Edge Cases

| Case                         | Behavior                               |
| ---------------------------- | -------------------------------------- |
| Sender = Receiver            | Allowed (self-gifting)                 |
| Receiver = Room Owner        | Room owner gets full receiver share    |
| Concurrent same reference_id | First wins, second returns existing    |
| Deadlock during transaction  | Auto-retry up to 3 times               |
| User deleted mid-batch       | That transaction fails, others proceed |
| Gift deactivated mid-batch   | 4004 for that transaction              |

---

## 6. Sequence Diagram (Textual)

```
 MSAB                 CONTROLLER         TX SERVICE         DATABASE           REDIS/MSAB
   │                      │                  │                  │                   │
   │  POST /gifts/batch   │                  │                  │                   │
   │─────────────────────▶│                  │                  │                   │
   │                      │                  │                  │                   │
   │                      │ 1. Validate      │                  │                   │
   │                      │    request       │                  │                   │
   │                      │                  │                  │                   │
   │                      │ 2. Loop per tx   │                  │                   │
   │                      │─────────────────▶│                  │                   │
   │                      │                  │                  │                   │
   │                      │                  │ 3. Check ref_id  │                   │
   │                      │                  │─────────────────▶│                   │
   │                      │                  │◀─────────────────│                   │
   │                      │                  │                  │                   │
   │                      │                  │ 4. BEGIN TX      │                   │
   │                      │                  │─────────────────▶│                   │
   │                      │                  │                  │                   │
   │                      │                  │ 5. Load users    │                   │
   │                      │                  │    FOR UPDATE    │                   │
   │                      │                  │─────────────────▶│                   │
   │                      │                  │◀─────────────────│                   │
   │                      │                  │                  │                   │
   │                      │                  │ 6. Deduct sender │                   │
   │                      │                  │ 7. Credit users  │                   │
   │                      │                  │ 8. Add XP        │                   │
   │                      │                  │ 9. Agency income │                   │
   │                      │                  │ 10. Room XP      │                   │
   │                      │                  │ 11. Create tx    │                   │
   │                      │                  │─────────────────▶│                   │
   │                      │                  │◀─────────────────│                   │
   │                      │                  │                  │                   │
   │                      │                  │ 12. COMMIT       │                   │
   │                      │                  │─────────────────▶│                   │
   │                      │                  │                  │                   │
   │                      │                  │ 13. balance.updated (sender)         │
   │                      │                  │──────────────────────────────────────▶│
   │                      │                  │                  │                   │
   │                      │                  │ 14. balance.updated (receiver)       │
   │                      │                  │──────────────────────────────────────▶│
   │                      │                  │                  │                   │
   │                      │◀─────────────────│                  │                   │
   │                      │                  │                  │                   │
   │  200 {results}       │                  │                  │                   │
   │◀─────────────────────│                  │                  │                   │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition              | Location                            |
| --------------------- | ----------------------------------- |
| New currency type     | `CoinDistributionService`           |
| XP multiplier events  | `GiftTransactionService` XP section |
| New MSAB event        | `emitMSABEvents()` method           |
| Per-gift limits       | Validation rules + service checks   |
| VIP gift restrictions | Before balance check                |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW TRANSACTION FIELD

| Step  | File                         | What to Change                   |
| ----- | ---------------------------- | -------------------------------- |
| **1** | Database Migration           | Add column to `transactions`     |
| **2** | `GiftTransactionDTO.php`     | Add property + fromArray         |
| **3** | `GiftTransactionService.php` | Set value in Transaction::create |
| **4** | Controller validation        | Add validation rule              |

#### ➖ CHANGING COIN DISTRIBUTION PERCENTAGES

| Step  | File                                     | What to Change           |
| ----- | ---------------------------------------- | ------------------------ |
| **1** | System settings table                    | Update percentage values |
| **2** | Verify `SystemSettingService` reads them | No code change needed    |

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                   |
| --------------------------- | ---------------------------------------- |
| `lockForUpdate()` calls     | Prevents race conditions on balances     |
| `DB::transaction()` wrapper | Ensures atomicity of financial mutations |
| MSAB event timing           | Events MUST be after commit              |
| `reference_id` uniqueness   | Idempotency guarantee                    |
| Error codes                 | MSAB client handles these specifically   |

### 🚨 Common Pitfalls

| Pitfall                            | Prevention                                 |
| ---------------------------------- | ------------------------------------------ |
| Emitting events inside transaction | Move to AFTER commit block                 |
| Removing lockForUpdate             | Causes balance race conditions             |
| Changing reference_id behavior     | Breaks idempotency guarantees              |
| Adding gift.Sent event             | Causes duplicate animations (MSAB does it) |
| Throwing in event emission         | Wrap in try-catch to not fail transaction  |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                                 ← Route definition
app/Http/Controllers/Internal/
  └── GiftController.php                                ← Controller
app/Services/Gift/
  ├── GiftTransactionService.php                        ← Core service
  └── CoinDistributionService.php                       ← Split calculation
app/Services/Agency/
  └── AgencyIncomeService.php                           ← Agency revenue
app/Services/Realtime/
  └── MSABEventService.php                              ← Event emission
app/DTOs/
  └── GiftTransactionDTO.php                            ← Transaction DTO
app/Models/
  ├── User.php                                          ← User model
  ├── Gift/Gift.php                                     ← Gift model
  ├── Room/Room.php                                     ← Room model
  └── Transaction/Transaction.php                       ← Transaction model
app/Exceptions/
  └── InsufficientBalanceException.php                  ← Custom exception
```

---

## 8. MSAB Event Contracts

### Incoming (MSAB → Laravel)

MSAB sends gift transactions when users send gifts in voice rooms. Each transaction includes:

| Field          | Type    | Description                |
| -------------- | ------- | -------------------------- |
| `sender_id`    | integer | User sending the gift      |
| `receiver_id`  | integer | User receiving the gift    |
| `gift_id`      | integer | Gift being sent            |
| `room_id`      | integer | Room where gift was sent   |
| `quantity`     | integer | Number of gifts (1-99)     |
| `message`      | string  | Optional message with gift |
| `reference_id` | string  | Idempotency key from MSAB  |

### Outgoing (Laravel → MSAB)

After each successful transaction, Laravel emits:

#### `balance.updated` (to sender)

```json
{
  "event": "balance.updated",
  "user_id": 123,
  "room_id": null,
  "payload": {
    "coins": "45000",
    "diamonds": "1000",
    "wealth_xp": "15500",
    "charm_xp": "8500"
  },
  "timestamp": "2026-02-04T01:45:00+00:00",
  "correlation_id": "uuid-v4"
}
```

#### `balance.updated` (to receiver)

```json
{
  "event": "balance.updated",
  "user_id": 456,
  "room_id": null,
  "payload": {
    "coins": "55000",
    "diamonds": "2000",
    "wealth_xp": "12000",
    "charm_xp": "10500"
  },
  "timestamp": "2026-02-04T01:45:00+00:00",
  "correlation_id": "uuid-v4"
}
```

### Events NOT Emitted

| Event          | Reason                                          |
| -------------- | ----------------------------------------------- |
| `gift.Sent`    | MSAB handles optimistically to avoid duplicates |
| `level.up`     | Emitted by LevelService if level up occurs      |
| `badge.earned` | Emitted by BadgeService if badge unlocked       |

---

## 9. Performance Considerations

### Database Optimization

- **Pessimistic locking**: `lockForUpdate()` on user rows prevents concurrent balance corruption
- **Retry on deadlock**: `DB::transaction(..., 3)` handles transient deadlocks
- **Batch processing**: Single HTTP request can process up to 100 transactions

### Caching Strategy

- No caching used - real-time accuracy required for financial data
- Gift catalog cached separately (`/gifts/active` endpoint)

### Rate Limiting

- 1000 requests/minute per MSAB service key
- Each request can contain up to 100 transactions

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `POST /api/internal/gifts/batch` |
| **Domain**          | Internal / Gift                  |
| **Author**          | System Documentation             |
| **Created**         | 2026-02-04                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4+                             |
| **Complexity**      | High (financial transactions)    |
