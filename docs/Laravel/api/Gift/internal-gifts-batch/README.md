# POST /api/internal/gifts/batch

> **Domain**: Gift / Economy  
> **Type**: Internal (Microservice) Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Internal Gifts Batch endpoint processes bulk gift transactions from the MSAB Audio Server. It handles coin distribution, XP tracking, transaction records, and real-time event emission for batch gift sends occurring during live streaming sessions.

### Responsibilities

- Validate batch transaction requests from the Audio Server
- Enforce idempotency via `reference_id` (transaction_id)
- Deduct coins from sender, distribute to receiver and room owner
- Track wealth XP for sender, charm XP for receiver, room XP
- Create atomic transaction records with complete state snapshots
- Handle agency member income tracking
- Dispatch async level-up/badge side effects
- Emit real-time balance updates to MSAB

### What It Owns

| Owned                   | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| Batch Transaction Logic | Iterates and processes each transaction individually |
| Idempotency Check       | Prevents duplicate processing via `reference_id`     |
| Error Aggregation       | Collects failed transactions with error codes        |

### External Dependencies

| Dependency             | Type           | Purpose                                        |
| ---------------------- | -------------- | ---------------------------------------------- |
| PostgreSQL             | Database       | Transactions, users, gifts, rooms storage      |
| Redis                  | Cache          | Gift caching, MSAB event pub/sub               |
| MSAB Audio Server      | Infrastructure | Caller service, receives balance update events |
| Queue (Redis/Database) | Infrastructure | Async side effects (level-ups, badges)         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/internal/gifts/batch
```

### Authentication

❌ **No User Auth** - Uses `X-Internal-Key` header for service-to-service authentication

### Rate Limiting

| Limiter        | Key                         | Config                               |
| -------------- | --------------------------- | ------------------------------------ |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests per minute per service |

### Request Headers

| Header           | Required | Type               | Description                         |
| ---------------- | -------- | ------------------ | ----------------------------------- |
| `Content-Type`   | ✅       | `application/json` | Request body format                 |
| `Accept`         | ✅       | `application/json` | Response format                     |
| `X-Internal-Key` | ✅       | `string`           | Shared secret for internal services |

### Request Body Schema

```json
{
  "transactions": [
    // Required, array of transactions
    {
      "transaction_id": "string", // Required, unique ID from Audio Server
      "sender_id": "integer", // Required, user ID sending the gift
      "recipient_id": "integer", // Required, user ID receiving the gift
      "gift_id": "integer", // Required, gift catalog ID
      "room_id": "integer", // Required, room where gift is sent
      "quantity": "integer", // Required, min 1
      "timestamp": "numeric", // Required, Unix timestamp
      "message": "string|null" // Optional, max 255 chars
    }
  ]
}
```

#### Field Details

| Field            | Type      | Constraints                 | Example             |
| ---------------- | --------- | --------------------------- | ------------------- |
| `transaction_id` | `string`  | Required, unique identifier | `"msab_tx_abc123"`  |
| `sender_id`      | `integer` | Required, valid user ID     | `12345`             |
| `recipient_id`   | `integer` | Required, valid user ID     | `67890`             |
| `gift_id`        | `integer` | Required, active gift ID    | `42`                |
| `room_id`        | `integer` | Required, valid room ID     | `100`               |
| `quantity`       | `integer` | Required, min: 1            | `1`                 |
| `timestamp`      | `numeric` | Required, Unix timestamp    | `1706889600.123`    |
| `message`        | `string`  | Optional, max: 255          | `"Happy birthday!"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "processed_count": 5,
  "failed": []
}
```

#### ✅ Partial Success Response (200)

```json
{
  "processed_count": 3,
  "failed": [
    {
      "transaction_id": "msab_tx_xyz789",
      "code": 4002,
      "reason": "Insufficient coins"
    },
    {
      "transaction_id": "msab_tx_def456",
      "code": 4004,
      "reason": "Gift not found or inactive"
    }
  ]
}
```

#### ❌ Authentication Error (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

#### ❌ Validation Error (422)

```json
{
  "message": "The transactions field is required.",
  "errors": {
    "transactions": ["The transactions field is required."],
    "transactions.0.sender_id": [
      "The transactions.0.sender_id field is required."
    ]
  }
}
```

### HTTP Status Codes

| Code  | Condition                                      |
| ----- | ---------------------------------------------- |
| `200` | Batch processed (may include partial failures) |
| `403` | Invalid or missing `X-Internal-Key`            |
| `422` | Request validation failed                      |
| `500` | Unexpected server error                        |

### Error Codes in `failed` Array

| Code   | Meaning                  |
| ------ | ------------------------ |
| `4002` | Insufficient coins       |
| `4004` | Gift/Room/User not found |
| `5000` | Internal server error    |

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
│   1. InternalAuth → Validates X-Internal-Key header                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE: InternalAuth                                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/InternalAuth.php:16-28                            │
│                                                                             │
│ Validates X-Internal-Key header against config('services.msab.internal_key')│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $internalKey = $request->header('X-Internal-Key');                      │ │
│ │ $expectedKey = config('services.msab.internal_key');                    │ │
│ │                                                                         │ │
│ │ if (! hash_equals($expectedKey, $internalKey)) {                        │ │
│ │     return response()->json([                                           │ │
│ │         'message' => 'Unauthorized. Invalid internal key.',             │ │
│ │         'error_code' => 'INTERNAL_AUTH_FAILED',                         │ │
│ │     ], 403);                                                            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER: GiftController::processBatch                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:42-96                │
│                                                                             │
│ STEP 1: Validate request body using inline Validator                        │
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
│                                                                             │
│ STEP 2: Iterate through transactions array                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ foreach ($transactions as $txData) {                                    │ │
│ │     // Check idempotency via reference_id                               │ │
│ │     $existing = Transaction::where('reference_id',                      │ │
│ │                             $txData['transaction_id'])->exists();       │ │
│ │     if ($existing) { $processed++; continue; }                          │ │
│ │                                                                         │ │
│ │     $result = $this->handleSingleTransaction($txData);                  │ │
│ │     // Track success/failure...                                         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return aggregated results                                           │
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
│ 3.4 handleSingleTransaction (Private Method)                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/GiftController.php:109-144              │
│                                                                             │
│ Creates GiftTransactionDTO and calls GiftTransactionService                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = new GiftTransactionDTO(                                          │ │
│ │     senderId: $data['sender_id'],                                       │ │
│ │     receiverId: $data['recipient_id'],                                  │ │
│ │     giftId: $data['gift_id'],                                           │ │
│ │     roomId: $data['room_id'],                                           │ │
│ │     quantity: $data['quantity'],                                        │ │
│ │     message: $data['message'] ?? null,                                  │ │
│ │     referenceId: $data['transaction_id'],  // For idempotency           │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ $result = $this->giftTransactionService->processGiftTransaction($dto);  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Error mapping:                                                              │
│   'Insufficient coins'       → 4002                                         │
│   'Gift not found/inactive'  → 4004                                         │
│   'Room not found'           → 4004                                         │
│   'User not found'           → 4004                                         │
│   default                    → 5000                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SERVICE: GiftTransactionService::processGiftTransaction                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:67-346                   │
│                                                                             │
│ ALL OPERATIONS WRAPPED IN DB::transaction() WITH 3 RETRIES                  │
│                                                                             │
│ STEP 1: Load and validate entities                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $gift = Cache::remember("gift:{$dto->giftId}:active", 300, ...);       │ │
│ │ if (! $gift) { throw new GiftNotFoundException; }                       │ │
│ │                                                                         │ │
│ │ $room = Room::find($dto->roomId);                                       │ │
│ │ if (! $room) { throw new RoomNotFoundException; }                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Calculate coin/XP values                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $giftCoinValue = (int)($gift->price * $dto->quantity);                  │ │
│ │ $roomOwnerCoins = (int)floor($giftCoinValue * (rop / 100));            │ │
│ │ $receiverCoins = (int)floor($giftCoinValue * (receiverPct / 100));     │ │
│ │ $roomXp = bcmul($giftCoinValue, $roomXpMultiplier, 4);                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check agency membership                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agencyMember = AgencyMember::where('user_id', $dto->receiverId)        │ │
│ │     ->where('status', AgencyMemberStatus::ACTIVE)->first();             │ │
│ │ $isAgencyMember = $agencyMember !== null;                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Balance mutations via CoinDistributionService                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // 4A: Deduct from sender                                               │ │
│ │ $senderResult = $coinService->deductFromUser($dto->senderId, $value);   │ │
│ │                                                                         │ │
│ │ // 4B: Sender gets commission if room owner                             │ │
│ │ if ($senderIsRoomOwner && $roomOwnerCoins > 0) {                        │ │
│ │     $coinService->addToUser($dto->senderId, $roomOwnerCoins);           │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // 5A: Add to receiver (if not agency member)                           │ │
│ │ if (! $isAgencyMember && $receiverCoins > 0) {                          │ │
│ │     $coinService->addToUser($dto->receiverId, $receiverCoins);          │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // 6: Add commission to room owner (if different from sender/receiver)  │ │
│ │ if (! $senderIsRoomOwner && ! $receiverIsRoomOwner) {                   │ │
│ │     $coinService->addToUser($room->user_id, $roomOwnerCoins);           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: XP mutations (inlined with lockForUpdate)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $senderXpResult = $this->applyXpMutation(                               │ │
│ │     $dto->senderId, 'wealth_xp', $giftCoinValue);                       │ │
│ │ $receiverXpResult = $this->applyXpMutation(                             │ │
│ │     $dto->receiverId, 'charm_xp', $giftCoinValue);                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Agency income (if applicable)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($isAgencyMember) {                                                  │ │
│ │     $agencyIncomeService->addToIncomeTarget(                            │ │
│ │         $dto->receiverId, $receiverCoins, $dto->roomId);                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Room XP update                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $roomXpResult = $this->updateRoomXp($dto->roomId, $roomXp);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Dispatch async side effects job                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ dispatch(new ProcessGiftSideEffectsJob(...))->afterCommit();            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9: Create transaction records (2 rows per gift)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Transaction::create([type => 'gift', ...]);        // GIFT row          │ │
│ │ Transaction::create([type => 'room_commission', ...]); // COMMISSION    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 10: Update gift statistics                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Gift::where('id', $gift->id)->update([                                  │ │
│ │     'total_sent' => DB::raw("total_sent + $quantity"),                  │ │
│ │     'total_revenue' => DB::raw("total_revenue + $giftCoinValue"),       │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 POST-TRANSACTION: MSAB Events (Fire-and-Forget)                         │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:326-343                  │
│                                                                             │
│ After DB::transaction commits, emit balance updates via Redis pub/sub      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitBalanceUpdated($sender);                   │ │
│ │ $this->msabEventService->emitBalanceUpdated($receiver);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: GiftTransactionDTO (Data Transfer Object)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/GiftTransactionDTO.php                                   │ │
│ │ Responsibility: Typed container for gift transaction data               │ │
│ │ Reusable: YES (used by both internal batch and public /gifts/send)      │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • senderId: int                                                       │ │
│ │   • receiverId: int                                                     │ │
│ │   • giftId: int                                                         │ │
│ │   • roomId: int                                                         │ │
│ │   • quantity: int (default 1)                                           │ │
│ │   • message: ?string                                                    │ │
│ │   • referenceId: ?string (for idempotency)                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinDistributionService (Balance Mutations)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Economy/CoinDistributionService.php                  │ │
│ │ Responsibility: Canonical service for all coin/diamond balance changes  │ │
│ │ Reusable: YES (used across entire economy domain)                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deductFromUser()  → Deduct coins with lockForUpdate                 │ │
│ │   • addToUser()       → Add coins with lockForUpdate                    │ │
│ │   • transferCoins()   → Atomic transfer between users                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SystemSettingService (Configuration)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/SystemSettingService.php                 │ │
│ │ Responsibility: Cached system-wide settings                             │ │
│ │ Reusable: YES                                                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getRoomOwnerPercentage() → Default 10%                              │ │
│ │   • getReceiverPercentage()  → Default 50%                              │ │
│ │   • getRoomXpMultiplier()    → Default 1.0                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ProcessGiftSideEffectsJob (Async Processing)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Jobs/Gift/ProcessGiftSideEffectsJob.php                       │ │
│ │ Responsibility: Level-up detection and badge awards                     │ │
│ │ Reusable: NO (gift-specific)                                            │ │
│ │ Dispatched: afterCommit() to ensure DB consistency                      │ │
│ │                                                                         │ │
│ │ Processes:                                                              │ │
│ │   • Sender wealth level-ups                                             │ │
│ │   • Receiver charm level-ups                                            │ │
│ │   • Badge awards for new levels                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyIncomeService (Agency Member Tracking)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Agency/AgencyIncomeService.php                       │ │
│ │ Responsibility: Track income targets for agency members                 │ │
│ │ Reusable: YES (used wherever agency members receive income)             │ │
│ │                                                                         │ │
│ │ Key Method:                                                             │ │
│ │   • addToIncomeTarget() → Add coins to active target                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Real-time Events)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emit events to MSAB via Redis pub/sub                   │ │
│ │ Reusable: YES (used for all real-time updates)                          │ │
│ │                                                                         │ │
│ │ Key Method:                                                             │ │
│ │   • emitBalanceUpdated() → Notify user of balance change                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (per transaction in batch):                             │
│                                                                             │
│ 1. SELECT: Check idempotency                                                │
│    Query: SELECT EXISTS(SELECT 1 FROM transactions WHERE reference_id=?)   │
│    Source: GiftController::processBatch                                     │
│                                                                             │
│ 2. SELECT: Load gift (cached)                                               │
│    Query: SELECT * FROM gifts WHERE id=? AND is_active=1                    │
│    Source: GiftTransactionService (Cache::remember 5min)                    │
│                                                                             │
│ 3. SELECT: Load room                                                        │
│    Query: SELECT * FROM rooms WHERE id=?                                    │
│    Source: GiftTransactionService                                           │
│                                                                             │
│ 4. SELECT: Check agency membership                                          │
│    Query: SELECT * FROM agency_members WHERE user_id=? AND status='active'  │
│    Source: GiftTransactionService                                           │
│                                                                             │
│ 5. SELECT FOR UPDATE: Lock sender user row                                  │
│    Query: SELECT * FROM users WHERE id=? FOR UPDATE                         │
│    Source: CoinDistributionService::deductFromUser                          │
│                                                                             │
│ 6. UPDATE: Deduct coins from sender                                         │
│    Query: UPDATE users SET coins=? WHERE id=?                               │
│    Source: CoinDistributionService::deductFromUser                          │
│                                                                             │
│ 7. SELECT FOR UPDATE + UPDATE: Add coins to receiver (if not agency)        │
│    Source: CoinDistributionService::addToUser                               │
│                                                                             │
│ 8. SELECT FOR UPDATE + UPDATE: Add coins to room owner (if different)       │
│    Source: CoinDistributionService::addToUser                               │
│                                                                             │
│ 9. SELECT FOR UPDATE + UPDATE: Apply XP to sender (wealth_xp)               │
│    Source: GiftTransactionService::applyXpMutation                          │
│                                                                             │
│ 10. SELECT FOR UPDATE + UPDATE: Apply XP to receiver (charm_xp)             │
│     Source: GiftTransactionService::applyXpMutation                         │
│                                                                             │
│ 11. SELECT FOR UPDATE + UPDATE: Update room XP and level                    │
│     Source: GiftTransactionService::updateRoomXp                            │
│                                                                             │
│ 12. INSERT: Create GIFT transaction record                                  │
│     Table: transactions                                                     │
│     Source: GiftTransactionService::createTransactionRecords                │
│                                                                             │
│ 13. INSERT: Create ROOM_COMMISSION transaction record                       │
│     Table: transactions                                                     │
│     Source: GiftTransactionService::createTransactionRecords                │
│                                                                             │
│ 14. UPDATE: Increment gift statistics                                       │
│     Query: UPDATE gifts SET total_sent=total_sent+?, total_revenue=...      │
│     Source: GiftTransactionService                                          │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET/SET: gift:{id}:active (TTL: 300s)                                    │
│    Source: GiftTransactionService                                           │
│                                                                             │
│ 2. GET: gift_distribution_settings (TTL: 3600s)                             │
│    Source: SystemSettingService                                             │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ 1. DISPATCH: ProcessGiftSideEffectsJob to default queue                     │
│    Payload: sender/receiver XP before/after values                          │
│    Timing: afterCommit()                                                    │
│                                                                             │
│ REDIS PUB/SUB:                                                              │
│                                                                             │
│ 1. PUBLISH: balance.updated to sender                                       │
│ 2. PUBLISH: balance.updated to receiver                                     │
│    Source: MSABEventService (fire-and-forget, post-commit)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 + JSON Body (processed_count, failed)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                                | Used By Endpoints                         | Reusable | Reasoning                                 |
| --------------------------------------------------- | ----------------------------------------- | -------- | ----------------------------------------- |
| `app/Http/Middleware/InternalAuth.php`              | All `/api/internal/*` endpoints           | ✅       | Generic internal service authentication   |
| `app/Http/Controllers/Internal/GiftController.php`  | `/internal/gifts/*`                       | ❌       | Internal-specific controller              |
| `app/DTOs/GiftTransactionDTO.php`                   | `/internal/gifts/batch`, `/v1/gifts/send` | ✅       | Shared DTO for all gift transaction flows |
| `app/Services/Gift/GiftTransactionService.php`      | `/internal/gifts/batch`, `/v1/gifts/send` | ✅       | Core gift processing logic                |
| `app/Services/Economy/CoinDistributionService.php`  | All economy endpoints                     | ✅       | Canonical balance mutation service        |
| `app/Services/Progression/SystemSettingService.php` | Multiple domains                          | ✅       | System-wide configuration                 |
| `app/Services/Agency/AgencyIncomeService.php`       | Gift endpoints, agency endpoints          | ✅       | Agency income tracking                    |
| `app/Services/Realtime/MSABEventService.php`        | Multiple real-time features               | ✅       | Event emission abstraction                |
| `app/Jobs/Gift/ProcessGiftSideEffectsJob.php`       | Gift transactions only                    | ❌       | Gift-specific async processing            |
| `app/Models/Economy/Transaction.php`                | All transaction-related features          | ✅       | Shared transaction model                  |
| `app/Models/Gift/Gift.php`                          | All gift-related features                 | ✅       | Shared gift model                         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                                    | Source           | Condition                      |
| ---------------------------------------- | ---------------- | ------------------------------ |
| `transactions.required`                  | Inline Validator | Missing transactions array     |
| `transactions.*.transaction_id.required` | Inline Validator | Missing transaction_id in item |
| `transactions.*.sender_id.required`      | Inline Validator | Missing sender_id in item      |
| `transactions.*.quantity.min`            | Inline Validator | quantity < 1                   |
| `transactions.*.message.max`             | Inline Validator | message > 255 characters       |

### Business Logic Errors (in `failed` array)

| Error Code | Message                      | Source                  | Condition                             |
| ---------- | ---------------------------- | ----------------------- | ------------------------------------- |
| `4002`     | "Insufficient coins"         | CoinDistributionService | Sender balance < gift cost            |
| `4004`     | "Gift not found or inactive" | GiftTransactionService  | Gift doesn't exist or is_active=false |
| `4004`     | "Room not found"             | GiftTransactionService  | Room ID doesn't exist                 |
| `4004`     | "User not found"             | CoinDistributionService | Sender or receiver doesn't exist      |
| `4004`     | "Invalid users"              | GiftTransactionService  | User validation failed                |
| `5000`     | "Internal Server Error"      | GiftController          | Any unhandled exception               |

### System Errors (403/500)

| Error                                 | Source        | Condition                             |
| ------------------------------------- | ------------- | ------------------------------------- |
| "Unauthorized. Invalid internal key." | InternalAuth  | Missing/invalid X-Internal-Key header |
| Unhandled exception                   | Any component | Database failures, Redis timeouts     |

### Edge Cases

| Case                             | Behavior                                               |
| -------------------------------- | ------------------------------------------------------ |
| Duplicate `transaction_id`       | Counts as processed (idempotency), no new DB writes    |
| Sender is room owner             | Sender receives room commission back                   |
| Receiver is room owner           | Receiver gets both receiver share + commission         |
| Sender = Receiver                | Allowed by this endpoint (no validation on difference) |
| Receiver is active agency member | Coins go to agency income target instead of wallet     |
| Empty transactions array         | Returns `processed_count: 0, failed: []`               |
| Gift available_until expired     | `scopeActive()` excludes it → GiftNotFoundException    |
| Room XP causes level-up          | Level updated inline, side effects async               |

---

## 6. Sequence Diagram (Textual)

```
 MSAB SERVER         INTERNAL_AUTH        CONTROLLER        GIFT_TX_SERVICE      COIN_SERVICE         DATABASE/CACHE/QUEUE
     │                    │                   │                    │                   │                       │
     │  POST /gifts/batch │                   │                    │                   │                       │
     │  X-Internal-Key    │                   │                    │                   │                       │
     │───────────────────▶│                   │                    │                   │                       │
     │                    │                   │                    │                   │                       │
     │                    │ 1. Validate key   │                    │                   │                       │
     │                    │   (hash_equals)   │                    │                   │                       │
     │                    │───────────────────▶│                    │                   │                       │
     │                    │                   │                    │                   │                       │
     │                    │                   │ 2. Validate body   │                   │                       │
     │                    │                   │───────────────────────────────────────────────────────────────▶│
     │                    │                   │                                                               │
     │                    │                   │  FOR EACH transaction:                 │                       │
     │                    │                   │   ┌─────────────────────────────────────────────────────────┐  │
     │                    │                   │   │                                    │                   │  │
     │                    │                   │ 3.│Check idempotency                   │                   │  │
     │                    │                   │───┼───────────────────────────────────────────────────────▶│  │
     │                    │                   │◀──┼───────────────────────────────────────────────────────│  │
     │                    │                   │   │                                    │                   │  │
     │                    │                   │ 4.│Create DTO & call service           │                   │  │
     │                    │                   │───┼──────────────────▶│                │                   │  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 5. Load gift   │                   │  │
     │                    │                   │   │                   │  (cached)      │                   │  │
     │                    │                   │   │                   │───────────────────────────────────▶│  │
     │                    │                   │   │                   │◀───────────────────────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 6. Load room   │                   │  │
     │                    │                   │   │                   │───────────────────────────────────▶│  │
     │                    │                   │   │                   │◀───────────────────────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 7. BEGIN       │                   │  │
     │                    │                   │   │                   │  TRANSACTION   │                   │  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 8. Deduct from │                   │  │
     │                    │                   │   │                   │    sender      │                   │  │
     │                    │                   │   │                   │───────────────▶│                   │  │
     │                    │                   │   │                   │                │ 9. lockForUpdate  │  │
     │                    │                   │   │                   │                │───────────────────▶│  │
     │                    │                   │   │                   │                │◀───────────────────│  │
     │                    │                   │   │                   │◀───────────────│                   │  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 10. Add to     │                   │  │
     │                    │                   │   │                   │     receiver   │                   │  │
     │                    │                   │   │                   │───────────────▶│───────────────────▶│  │
     │                    │                   │   │                   │◀───────────────│◀───────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 11. Add to     │                   │  │
     │                    │                   │   │                   │     room owner │                   │  │
     │                    │                   │   │                   │───────────────▶│───────────────────▶│  │
     │                    │                   │   │                   │◀───────────────│◀───────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 12. Apply XP   │                   │  │
     │                    │                   │   │                   │   (sender)     │                   │  │
     │                    │                   │   │                   │───────────────────────────────────▶│  │
     │                    │                   │   │                   │◀───────────────────────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 13. Apply XP   │                   │  │
     │                    │                   │   │                   │   (receiver)   │                   │  │
     │                    │                   │   │                   │───────────────────────────────────▶│  │
     │                    │                   │   │                   │◀───────────────────────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 14. Update     │                   │  │
     │                    │                   │   │                   │   room XP      │                   │  │
     │                    │                   │   │                   │───────────────────────────────────▶│  │
     │                    │                   │   │                   │◀───────────────────────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 15. Create tx  │                   │  │
     │                    │                   │   │                   │    records (2) │                   │  │
     │                    │                   │   │                   │───────────────────────────────────▶│  │
     │                    │                   │   │                   │◀───────────────────────────────────│  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 16. COMMIT     │                   │  │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 17. Dispatch   │                   │  │
     │                    │                   │   │                   │    job (async) │                   │  │
     │                    │                   │   │                   │─────────────────────────────────QUEUE │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │   │                   │ 18. Emit MSAB  │                   │  │
     │                    │                   │   │                   │    events      │                   │  │
     │                    │                   │   │                   │─────────────────────────────────REDIS │
     │                    │                   │   │                   │                │                   │  │
     │                    │                   │◀──┼──────────────────│                │                   │  │
     │                    │                   │   └─────────────────────────────────────────────────────────┘  │
     │                    │                   │                    │                   │                       │
     │                    │◀──────────────────│                    │                   │                       │
     │◀───────────────────│                   │                    │                   │                       │
     │                    │                   │                    │                   │                       │
     │  200 + JSON        │                   │                    │                   │                       │
     │  (processed, failed)                   │                    │                   │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location(s)                                                 |
| --------------------------- | ----------------------------------------------------------- |
| New validation rule         | `GiftController::processBatch` (inline Validator)           |
| New error code              | `GiftController::handleSingleTransaction` (match statement) |
| New coin distribution logic | `GiftTransactionService::processGiftTransaction`            |
| New XP type tracking        | `GiftTransactionService::applyXpMutation`                   |
| New transaction metadata    | `GiftTransactionService::createTransactionRecords`          |
| New real-time event         | `MSABEventService`                                          |
| New async side effect       | `ProcessGiftSideEffectsJob`                                 |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO REQUEST

| Step  | File                                             | What to Change                           |
| ----- | ------------------------------------------------ | ---------------------------------------- |
| **1** | `GiftController::processBatch`                   | Add validation rule in Validator::make() |
| **2** | `GiftController::handleSingleTransaction`        | Pass new field to DTO constructor        |
| **3** | `app/DTOs/GiftTransactionDTO.php`                | Add property to constructor              |
| **4** | `GiftTransactionService::processGiftTransaction` | Use DTO property in business logic       |
| **5** | If response needed, add to return array          |                                          |

#### ➕ ADDING NEW FIELD TO TRANSACTION RECORD

| Step  | File                                               | What to Change                        |
| ----- | -------------------------------------------------- | ------------------------------------- |
| **1** | Database Migration                                 | Add column to `transactions` table    |
| **2** | `app/Models/Economy/Transaction.php`               | Add to `$fillable` and `$casts`       |
| **3** | `GiftTransactionService::createTransactionRecords` | Add field to both Transaction::create |

#### ➖ REMOVING A FIELD

| Step  | File                              | What to Change         |
| ----- | --------------------------------- | ---------------------- |
| **1** | `GiftController::processBatch`    | Remove validation rule |
| **2** | `app/DTOs/GiftTransactionDTO.php` | Remove property        |
| **3** | `GiftTransactionService`          | Remove usage           |
| **4** | API Documentation                 | Update schema          |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ REQUEST FIELD FLOW                                                           │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  transactions[*].transaction_id                                              │
│         │                                                                    │
│         ├──▶ Idempotency check (reference_id lookup)                         │
│         └──▶ GiftTransactionDTO.referenceId                                  │
│                    └──▶ Transaction.reference_id                             │
│                                                                              │
│  transactions[*].sender_id                                                   │
│         │                                                                    │
│         ├──▶ GiftTransactionDTO.senderId                                     │
│         ├──▶ CoinDistributionService.deductFromUser()                        │
│         ├──▶ applyXpMutation('wealth_xp')                                    │
│         └──▶ Transaction.user_id                                             │
│                                                                              │
│  transactions[*].recipient_id                                                │
│         │                                                                    │
│         ├──▶ GiftTransactionDTO.receiverId                                   │
│         ├──▶ CoinDistributionService.addToUser() (if not agency)             │
│         ├──▶ AgencyIncomeService.addToIncomeTarget() (if agency)             │
│         ├──▶ applyXpMutation('charm_xp')                                     │
│         └──▶ Transaction.beneficiary_id                                      │
│                                                                              │
│  transactions[*].gift_id                                                     │
│         │                                                                    │
│         ├──▶ GiftTransactionDTO.giftId                                       │
│         ├──▶ Gift lookup (cached)                                            │
│         └──▶ Transaction.transactionable_id                                  │
│                                                                              │
│  transactions[*].room_id                                                     │
│         │                                                                    │
│         ├──▶ GiftTransactionDTO.roomId                                       │
│         ├──▶ Room lookup + owner commission                                  │
│         ├──▶ Room XP update                                                  │
│         └──▶ Transaction.room_id                                             │
│                                                                              │
│  transactions[*].quantity                                                    │
│         │                                                                    │
│         ├──▶ GiftTransactionDTO.quantity                                     │
│         ├──▶ Coin value calculation (gift.price * quantity)                  │
│         ├──▶ XP calculation                                                  │
│         └──▶ Transaction.quantity                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `CoinDistributionService`          | Core balance invariants - any change risks financial bugs |
| `InternalAuth` middleware          | Security boundary for internal services                   |
| `DB::transaction()` wrapper        | Atomicity guarantee - removing causes partial writes      |
| `lockForUpdate()` calls            | Race condition prevention - removing causes balance drift |
| `reference_id` idempotency check   | Duplicate processing prevention                           |
| Error code numbers (4002, 4004...) | MSAB Audio Server depends on these for error handling     |
| Response structure                 | MSAB Audio Server contract                                |

### 🚨 Common Pitfalls

| Pitfall                                     | Prevention                                                    |
| ------------------------------------------- | ------------------------------------------------------------- |
| Forgetting `referenceId` in DTO             | Always pass `transaction_id` as `referenceId` for idempotency |
| Skipping idempotency for "new" transactions | Always check `reference_id` even for first-time calls         |
| Using floats for coin amounts               | Use integers only (`(int)floor()` for percentages)            |
| Catching generic Exception, returning 5000  | Add specific error mappings for known exceptions              |
| MSAB events inside transaction              | Events must be emitted AFTER `DB::transaction` commits        |
| Processing items in parallel                | Batch must iterate sequentially to maintain ordering          |
| Missing `afterCommit()` on job dispatch     | Jobs may read uncommitted data                                |
| Changing X-Internal-Key without MSAB update | 403 errors on all batch calls                                 |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition (line 36)
app/Http/Middleware/InternalAuth.php                 ← Service-to-service auth
app/Http/Controllers/Internal/
  └── GiftController.php                             ← Controller (processBatch, handleSingleTransaction)
app/DTOs/
  └── GiftTransactionDTO.php                         ← Request data container
app/Services/Gift/
  ├── GiftTransactionService.php                     ← Core business logic
  └── MSABEventService.php                           ← Real-time event emission
app/Services/Economy/
  └── CoinDistributionService.php                    ← Balance mutations
app/Services/Agency/
  └── AgencyIncomeService.php                        ← Agency member income tracking
app/Services/Progression/
  └── SystemSettingService.php                       ← Distribution percentages
app/Jobs/Gift/
  └── ProcessGiftSideEffectsJob.php                  ← Async level-up/badge processing
app/Models/Economy/
  └── Transaction.php                                ← Transaction record model
app/Models/Gift/
  └── Gift.php                                       ← Gift model
```

---

## Document Metadata

| Property            | Value                            |
| ------------------- | -------------------------------- |
| **Endpoint**        | `POST /api/internal/gifts/batch` |
| **Domain**          | Gift / Economy                   |
| **Author**          | System Documentation             |
| **Created**         | 2026-02-02                       |
| **Laravel Version** | 12.x                             |
| **PHP Version**     | 8.4+                             |
