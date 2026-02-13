# POST /api/v1/gifts/send

> **Domain**: Gift  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Gift Send endpoint enables authenticated users to send virtual gifts to other users within a room, handling coin deduction, XP distribution, room commissions, agency income tracking, and real-time events.

### Responsibilities

- Validate gift send parameters (receiver, gift, room, quantity)
- Deduct coins from sender's balance
- Distribute coins to receiver (or agency income if agency member)
- Apply room owner commission
- Award wealth XP to sender and charm XP to receiver
- Update room XP and level
- Create transaction records for audit trail
- Dispatch async job for level-up and badge processing
- Emit real-time balance update events via MSAB

### What It Owns

| Owned                  | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| Gift transactions      | Creates GIFT and ROOM_COMMISSION transaction records   |
| Gift statistics        | Updates `total_sent` and `total_revenue` on Gift model |
| User balance mutations | Deducts from sender, adds to receiver/room owner       |
| User XP mutations      | Adds wealth_xp to sender, charm_xp to receiver         |
| Room XP                | Updates room_xp and current_level                      |

### External Dependencies

| Dependency              | Type           | Purpose                            |
| ----------------------- | -------------- | ---------------------------------- |
| Redis                   | Infrastructure | Gift caching (5 min), MSAB pub/sub |
| Database (users)        | Database       | User balance and XP storage        |
| Database (rooms)        | Database       | Room XP and commission             |
| Database (gifts)        | Database       | Gift validation and statistics     |
| Database (transactions) | Database       | Audit trail storage                |
| MSAB Server             | External       | Real-time balance update events    |
| Queue System            | Infrastructure | Async level-up/badge processing    |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/gifts/send
```

### Authentication

✅ **Required** - Sanctum token (Bearer authentication)

### Rate Limiting

| Limiter     | Key       | Config                     |
| ----------- | --------- | -------------------------- |
| `gift_send` | `user:id` | `config/rate-limiting.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "receiver_id": "integer", // Required, user ID receiving the gift
  "gift_id": "integer", // Required, ID of gift to send
  "room_id": "integer", // Required, room context for the gift
  "quantity": "integer", // Optional (default: 1), 1-100
  "message": "string|null" // Optional, max 255 chars
}
```

#### Field Details

| Field         | Type      | Constraints                     | Example        |
| ------------- | --------- | ------------------------------- | -------------- |
| `receiver_id` | `integer` | Required, must exist, ≠ sender  | `456`          |
| `gift_id`     | `integer` | Required, must exist and active | `123`          |
| `room_id`     | `integer` | Required, must exist            | `789`          |
| `quantity`    | `integer` | Optional, min 1, max 100        | `5`            |
| `message`     | `string`  | Optional, nullable, max 255     | `"Thank you!"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "success": true,
  "message": "Gift sent successfully",
  "data": {
    "success": true,
    "batch_id": "gift_550e8400-e29b-41d4-a716-446655440000",
    "gift": {
      "id": 123,
      "name": "Rose",
      "price": 100.0,
      "quantity": 5
    },
    "distribution": {
      "total_coins": 500,
      "room_owner_coins": 25,
      "receiver_coins": 350,
      "receiver_is_agency_member": false
    },
    "xp": {
      "sender_wealth_xp": 500,
      "receiver_charm_xp": 500,
      "room_xp": 50.0
    },
    "levels_unlocked": {
      "sender_wealth": [],
      "receiver_charm": [],
      "room": [5, 6]
    },
    "transactions": 2
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "message": "The receiver id field is required.",
  "errors": {
    "receiver_id": ["The receiver id field is required."],
    "gift_id": ["The gift id field is required."]
  }
}
```

#### ❌ Gift Not Found (404)

```json
{
  "status": "error",
  "message": "Gift 999 not found or inactive",
  "error_code": "GIFT_NOT_FOUND"
}
```

#### ❌ Room Not Found (404)

```json
{
  "status": "error",
  "message": "Room 999 not found",
  "error_code": "ROOM_NOT_FOUND"
}
```

#### ❌ Insufficient Balance (402)

```json
{
  "status": "error",
  "message": "Insufficient coins: required 500, available 100",
  "error_code": "INSUFFICIENT_BALANCE",
  "context": {
    "currency": "coins",
    "required": 500,
    "available": 100
  }
}
```

#### ❌ Self-Send Prevented (422)

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "receiver_id": ["You cannot send a gift to yourself."]
  }
}
```

### HTTP Status Codes

| Code  | Condition                                      |
| ----- | ---------------------------------------------- |
| `200` | Gift sent successfully                         |
| `401` | Missing or invalid authentication              |
| `402` | Insufficient coin balance                      |
| `404` | Gift, room, or user not found                  |
| `422` | Validation failed (missing/invalid fields)     |
| `429` | Rate limit exceeded                            |
| `500` | Internal server error (DB transaction failure) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/gifts/send                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/gifts.php:31-32                                            │
│ Route: Route::post('/send', [GiftTransactionController::class, 'send'])     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, attaches User to request       │
│   2. throttle:gift_send → Rate limiting per user                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Gift/SendGiftRequest.php                            │
│                                                                             │
│ Validates incoming request data before controller execution:                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                        │ │
│ │     return [                                                            │ │
│ │         'receiver_id' => 'required|integer',                            │ │
│ │         'gift_id' => 'required|integer',                                │ │
│ │         'room_id' => 'required|integer',                                │ │
│ │         'quantity' => 'sometimes|integer|min:1|max:100',                │ │
│ │         'message' => 'sometimes|nullable|string|max:255',               │ │
│ │     ];                                                                  │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Authorization: Returns true (auth handled by middleware)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Gift/GiftTransactionController.php:25-35  │
│ Method: send(SendGiftRequest $request): JsonResponse                        │
│                                                                             │
│ STEP 1: Create DTO from validated request                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = GiftTransactionDTO::fromRequest(                                 │ │
│ │     $request->validated(),                                              │ │
│ │     $request->user()->id                                                │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Process gift transaction via service                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->giftTransactionService->processGiftTransaction($dto);  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return JSON response                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'success' => true,                                                  │ │
│ │     'message' => 'Gift sent successfully',                              │ │
│ │     'data' => $result,                                                  │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DTO VALIDATION LAYER                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/DTOs/GiftTransactionDTO.php:68-74                                 │
│                                                                             │
│ Secondary validation with database existence checks:                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validator = Validator::make($data, [                                   │ │
│ │     'sender_id' => 'required|integer|exists:users,id',                  │ │
│ │     'receiver_id' => 'required|integer|exists:users,id|different:sender_id', │
│ │     'gift_id' => 'required|integer|exists:gifts,id',                    │ │
│ │     'room_id' => 'required|integer|exists:rooms,id',                    │ │
│ │     'quantity' => 'sometimes|integer|min:1|max:100',                    │ │
│ │     'message' => 'sometimes|nullable|string|max:255',                   │ │
│ │ ], ['receiver_id.different' => 'You cannot send a gift to yourself.']); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Creates immutable DTO with:                                                 │
│   • senderId (int) - authenticated user                                     │
│   • receiverId (int) - gift recipient                                       │
│   • giftId (int) - gift to send                                             │
│   • roomId (int) - room context                                             │
│   • quantity (int) - default 1                                              │
│   • message (?string) - optional message                                    │
│   • referenceId (?string) - optional external reference                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Gift/GiftTransactionService.php:67-346                   │
│ Method: processGiftTransaction(GiftTransactionDTO $dto): array              │
│                                                                             │
│ STEP 1: Generate batch ID for transaction grouping                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $batchId = 'gift_' . Str::uuid()->toString();                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Begin DB transaction (with 3 retries on deadlock)                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = DB::transaction(function () use ($dto, $batchId) {            │ │
│ │     // All mutations happen here atomically                             │ │
│ │ }, 3);                                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Load and validate gift (cached for 5 minutes)                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $gift = Cache::remember(                                                │ │
│ │     "gift:{$dto->giftId}:active",                                       │ │
│ │     300,                                                                 │ │
│ │     fn () => Gift::where('id', $dto->giftId)                            │ │
│ │         ->where('is_active', true)->first()                             │ │
│ │ );                                                                       │ │
│ │ if (!$gift) throw new GiftNotFoundException($dto->giftId);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Load and validate room                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $room = Room::find($dto->roomId);                                       │ │
│ │ if (!$room) throw new RoomNotFoundException($dto->roomId);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Calculate coin distribution (integer math)                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $giftCoinValue = (int) ($gift->price * $dto->quantity);                 │ │
│ │ $rop = $this->settingService->getRoomOwnerPercentage();    // e.g., 5%  │ │
│ │ $receiverPercentage = $this->settingService->getReceiverPercentage(); // 70% │
│ │ $roomOwnerCoins = (int) floor($giftCoinValue * ($rop / 100));           │ │
│ │ $receiverCoins = (int) floor($giftCoinValue * ($receiverPercentage / 100)); │
│ │ $roomXp = (float) bcmul((string)$giftCoinValue, (string)$roomXpMultiplier, 4);│
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Check agency membership                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agencyMember = AgencyMember::where('user_id', $dto->receiverId)        │ │
│ │     ->where('status', AgencyMemberStatus::ACTIVE)->first();             │ │
│ │ $isAgencyMember = $agencyMember !== null;                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: BALANCE MUTATIONS via CoinDistributionService                       │
│   7A. Deduct gift cost from sender                                          │
│   7B. Add commission to sender if room owner                                │
│   7C. Add coins to receiver (if not agency member)                          │
│   7D. Add commission to receiver if room owner                              │
│   7E. Add commission to room owner (if different from sender/receiver)      │
│                                                                             │
│ STEP 8: XP MUTATIONS (inlined with lockForUpdate)                           │
│   8A. Add wealth_xp to sender                                               │
│   8B. Add charm_xp to receiver                                              │
│                                                                             │
│ STEP 9: Agency income (if receiver is agency member)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($isAgencyMember) {                                                  │ │
│ │     $this->agencyIncomeService->addToIncomeTarget(                      │ │
│ │         $dto->receiverId, $receiverCoins, $dto->roomId                  │ │
│ │     );                                                                   │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 10: Update room XP (with level checking)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $roomXpResult = $this->updateRoomXp($dto->roomId, $roomXp);             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 11: Dispatch async job for level-up/badge processing                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ dispatch(new ProcessGiftSideEffectsJob(                                 │ │
│ │     senderId: $dto->senderId,                                           │ │
│ │     senderPreviousWealthXp: ...,                                        │ │
│ │     ...                                                                  │ │
│ │ ))->afterCommit();                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 12: Create 2 transaction records                                       │
│   • GIFT transaction (sender → receiver)                                    │
│   • ROOM_COMMISSION transaction (room owner)                                │
│                                                                             │
│ STEP 13: Update gift statistics                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Gift::where('id', $gift->id)->update([                                  │ │
│ │     'total_sent' => DB::raw("total_sent + $dto->quantity"),             │ │
│ │     'total_revenue' => DB::raw("total_revenue + $giftCoinValue"),       │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CoinDistributionService (Service)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Economy/CoinDistributionService.php                  │ │
│ │ Responsibility: All coin/diamond balance mutations with locks           │ │
│ │ Reusable: YES (canonical balance service)                               │ │
│ │ Why It Exists: Enforce balance invariants with pessimistic locking      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deductFromUser() → Deducts coins with lockForUpdate                 │ │
│ │   • addToUser() → Adds coins with lockForUpdate                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SystemSettingService (Service)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Progression/SystemSettingService.php                 │ │
│ │ Responsibility: Provides configurable percentages for distribution      │ │
│ │ Reusable: YES (global settings)                                         │ │
│ │ Why It Exists: Centralized config for room owner %, receiver %, XP mult │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getRoomOwnerPercentage() → Room owner commission %                  │ │
│ │   • getReceiverPercentage() → Receiver coin share %                     │ │
│ │   • getRoomXpMultiplier() → XP multiplier for room                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyIncomeService (Service)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Agency/AgencyIncomeService.php                       │ │
│ │ Responsibility: Track income for agency members toward targets          │ │
│ │ Reusable: YES (agency domain)                                           │ │
│ │ Why It Exists: Agency members don't receive coins directly              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • addToIncomeTarget() → Adds to active income target                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Service)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emit real-time events to MSAB server via Redis          │ │
│ │ Reusable: YES (all real-time events)                                    │ │
│ │ Why It Exists: Client balance updates, notifications                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • emitBalanceUpdated() → Notify client of balance change              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ProcessGiftSideEffectsJob (Job)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Jobs/Gift/ProcessGiftSideEffectsJob.php                       │ │
│ │ Responsibility: Async level-up detection and badge awards               │ │
│ │ Reusable: NO (gift-specific)                                            │ │
│ │ Why It Exists: Moved out of hot path to reduce latency                  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • handle() → Processes sender wealth and receiver charm level-ups    │ │
│ │   • processLevelUps() → Awards badges for unlocked levels               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Gift (cached)                                                    │
│    Query: SELECT * FROM gifts WHERE id = ? AND is_active = 1                │
│    Source: GiftTransactionService:76-80                                     │
│                                                                             │
│ 2. SELECT: Room                                                             │
│    Query: SELECT * FROM rooms WHERE id = ?                                  │
│    Source: GiftTransactionService:86                                        │
│                                                                             │
│ 3. SELECT: AgencyMember                                                     │
│    Query: SELECT * FROM agency_members WHERE user_id = ? AND status = ?     │
│    Source: GiftTransactionService:106-108                                   │
│                                                                             │
│ 4. SELECT FOR UPDATE: Sender User (lock)                                    │
│    Query: SELECT * FROM users WHERE id = ? FOR UPDATE                       │
│    Source: CoinDistributionService:deductFromUser                           │
│                                                                             │
│ 5. UPDATE: Sender coins                                                     │
│    Query: UPDATE users SET coins = ? WHERE id = ?                           │
│    Source: CoinDistributionService:deductFromUser                           │
│                                                                             │
│ 6. SELECT FOR UPDATE + UPDATE: Receiver coins (if not agency)               │
│    Source: CoinDistributionService:addToUser                                │
│                                                                             │
│ 7. SELECT FOR UPDATE + UPDATE: Room owner coins (if applicable)             │
│    Source: CoinDistributionService:addToUser                                │
│                                                                             │
│ 8. SELECT FOR UPDATE + UPDATE: Sender wealth_xp                             │
│    Source: GiftTransactionService:applyXpMutation                           │
│                                                                             │
│ 9. SELECT FOR UPDATE + UPDATE: Receiver charm_xp                            │
│    Source: GiftTransactionService:applyXpMutation                           │
│                                                                             │
│ 10. SELECT FOR UPDATE + UPDATE: Room XP and level                           │
│     Query: SELECT * FROM rooms WHERE id = ? FOR UPDATE                      │
│     Source: GiftTransactionService:updateRoomXp                             │
│                                                                             │
│ 11. INSERT: GIFT transaction record                                         │
│     Source: GiftTransactionService:createTransactionRecords                 │
│                                                                             │
│ 12. INSERT: ROOM_COMMISSION transaction record                              │
│     Source: GiftTransactionService:createTransactionRecords                 │
│                                                                             │
│ 13. UPDATE: Gift statistics                                                 │
│     Query: UPDATE gifts SET total_sent = total_sent + ?, ...                │
│     Source: GiftTransactionService:280-284                                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. GET: gift:{giftId}:active (TTL: 300s)                                    │
│    Source: GiftTransactionService:76-80                                     │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ 1. DISPATCH: ProcessGiftSideEffectsJob to "default" queue                   │
│    Payload: sender/receiver IDs and XP values before/after                  │
│    Trigger: afterCommit (only dispatched if transaction succeeds)           │
│                                                                             │
│ EXTERNAL SERVICES:                                                          │
│                                                                             │
│ 1. MSAB: balance.updated event (after commit)                               │
│    Target: sender user                                                      │
│    Source: MSABEventService:emitBalanceUpdated                              │
│                                                                             │
│ 2. MSAB: balance.updated event (after commit)                               │
│    Target: receiver user                                                    │
│    Source: MSABEventService:emitBalanceUpdated                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response is built directly in service as array, not via Resource:           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'success' => true,                                                  │ │
│ │     'batch_id' => $batchId,                                             │ │
│ │     'gift' => [                                                         │ │
│ │         'id' => $gift->id,                                              │ │
│ │         'name' => $gift->name,                                          │ │
│ │         'price' => (float) $gift->price,                                │ │
│ │         'quantity' => $dto->quantity,                                   │ │
│ │     ],                                                                   │ │
│ │     'distribution' => [...],                                            │ │
│ │     'xp' => [...],                                                      │ │
│ │     'levels_unlocked' => [...],                                         │ │
│ │     'transactions' => count($transactions),                             │ │
│ │ ];                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Controller wraps in final response:                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'success' => true,                                                  │ │
│ │     'message' => 'Gift sent successfully',                              │ │
│ │     'data' => $result,                                                  │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                               | Used By Endpoints      | Reusable | Reasoning                                |
| ---------------------------------- | ---------------------- | -------- | ---------------------------------------- |
| `SendGiftRequest.php`              | POST /gifts/send only  | ❌       | Endpoint-specific validation             |
| `GiftTransactionDTO.php`           | POST /gifts/send only  | ❌       | Specific to gift transactions            |
| `GiftTransactionController.php`    | POST /gifts/send only  | ❌       | Endpoint-specific controller             |
| `GiftTransactionService.php`       | POST /gifts/send only  | ❌       | Complex gift-specific orchestration      |
| `CoinDistributionService.php`      | All coin operations    | ✅       | Canonical balance mutation service       |
| `SystemSettingService.php`         | All settings access    | ✅       | Global configuration service             |
| `AgencyIncomeService.php`          | Gift, Agency endpoints | ✅       | Agency member income tracking            |
| `MSABEventService.php`             | All real-time events   | ✅       | MSAB event emission                      |
| `ProcessGiftSideEffectsJob.php`    | POST /gifts/send only  | ❌       | Gift-specific async processing           |
| `GiftTransactionResource.php`      | Transaction listings   | ⭕       | Gift transaction display (not used here) |
| `GiftNotFoundException.php`        | All gift endpoints     | ✅       | Standard gift exception                  |
| `RoomNotFoundException.php`        | All room endpoints     | ✅       | Standard room exception                  |
| `InsufficientBalanceException.php` | All balance operations | ✅       | Standard balance exception               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                   | Source               | Condition                      |
| ----------------------- | -------------------- | ------------------------------ |
| `receiver_id.required`  | `SendGiftRequest`    | Missing receiver_id field      |
| `receiver_id.integer`   | `SendGiftRequest`    | Non-integer receiver_id        |
| `gift_id.required`      | `SendGiftRequest`    | Missing gift_id field          |
| `gift_id.integer`       | `SendGiftRequest`    | Non-integer gift_id            |
| `room_id.required`      | `SendGiftRequest`    | Missing room_id field          |
| `room_id.integer`       | `SendGiftRequest`    | Non-integer room_id            |
| `quantity.integer`      | `SendGiftRequest`    | Non-integer quantity           |
| `quantity.min`          | `SendGiftRequest`    | Quantity < 1                   |
| `quantity.max`          | `SendGiftRequest`    | Quantity > 100                 |
| `message.string`        | `SendGiftRequest`    | Non-string message             |
| `message.max`           | `SendGiftRequest`    | Message > 255 characters       |
| `receiver_id.exists`    | `GiftTransactionDTO` | receiver_id not in users table |
| `receiver_id.different` | `GiftTransactionDTO` | sender_id == receiver_id       |
| `gift_id.exists`        | `GiftTransactionDTO` | gift_id not in gifts table     |
| `room_id.exists`        | `GiftTransactionDTO` | room_id not in rooms table     |

### Business Logic Errors (400/402/404)

| Error                  | Code | Source                         | Condition                         |
| ---------------------- | ---- | ------------------------------ | --------------------------------- |
| `GIFT_NOT_FOUND`       | 404  | `GiftNotFoundException`        | Gift doesn't exist or is inactive |
| `ROOM_NOT_FOUND`       | 404  | `RoomNotFoundException`        | Room doesn't exist                |
| `USER_NOT_FOUND`       | 404  | `UserNotFoundException`        | Sender/receiver doesn't exist     |
| `INSUFFICIENT_BALANCE` | 402  | `InsufficientBalanceException` | Sender coins < gift cost          |

### System Errors (500)

| Error                    | Source                      | Condition                         |
| ------------------------ | --------------------------- | --------------------------------- |
| DB transaction failure   | `DB::transaction()`         | Deadlock after 3 retries          |
| Lock timeout             | `lockForUpdate()`           | Row locked by another transaction |
| Redis connection failure | `Cache::remember()`         | Redis unavailable                 |
| Queue dispatch failure   | `dispatch()->afterCommit()` | Queue system unavailable          |

### Edge Cases

| Case                                   | Behavior                                           |
| -------------------------------------- | -------------------------------------------------- |
| Sender is room owner                   | Sender gets gift commission back                   |
| Receiver is room owner                 | Receiver gets both gift and commission             |
| Sender AND receiver are both not owner | Room owner gets commission separately              |
| Receiver is agency member              | Coins go to agency income target, not wallet       |
| Gift price \* quantity overflows       | Uses integer math, large gifts may need limits     |
| Room XP reaches new level threshold    | Levels added to `levels_unlocked.room` array       |
| MSAB event fails after commit          | Logged as warning, transaction NOT rolled back     |
| Job dispatch fails                     | afterCommit prevents dispatch if transaction fails |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            DTO                   SERVICE LAYER              DATABASE                CACHE                    QUEUE
   │                       │                       │                   │                         │                        │                      │                        │
   │  POST /gifts/send     │                       │                   │                         │                        │                      │                        │
   │──────────────────────▶│                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │ 1. auth:sanctum       │                   │                         │                        │                      │                        │
   │                       │ (validate token)      │                   │                         │                        │                      │                        │
   │                       │──────────────────────▶│                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │ 2. validate()     │                         │                        │                      │                        │
   │                       │                       │ SendGiftRequest   │                         │                        │                      │                        │
   │                       │                       │──────────────────▶│                         │                        │                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │ 3. fromRequest()        │                        │                      │                        │
   │                       │                       │                   │ + secondary validation  │                        │                      │                        │
   │                       │                       │                   │─────────────────────────▶                        │                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 4. Cache::remember     │                      │                        │
   │                       │                       │                   │                         │ (gift lookup)          │                      │◀─────────────────────  │
   │                       │                       │                   │                         │─────────────────────────────────────────────▶│                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 5. SELECT room         │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │◀────────────────────────│                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 6. SELECT agency_member│                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │◀────────────────────────│                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 7. BEGIN TRANSACTION   │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 8. SELECT FOR UPDATE   │                      │                        │
   │                       │                       │                   │                         │ (sender, deduct coins) │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 9. SELECT FOR UPDATE   │                      │                        │
   │                       │                       │                   │                         │ (receiver, add coins)  │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 10. SELECT FOR UPDATE  │                      │                        │
   │                       │                       │                   │                         │ (room owner, add coins)│                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 11. UPDATE sender XP   │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 12. UPDATE receiver XP │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 13. UPDATE room XP     │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 14. INSERT 2 transactions│                     │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 15. UPDATE gift stats  │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 16. COMMIT             │                      │                        │
   │                       │                       │                   │                         │─────────────────────────▶                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 17. DISPATCH ProcessGiftSideEffectsJob        │                        │
   │                       │                       │                   │                         │─────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │ 18. EMIT MSAB events   │                      │                        │
   │                       │                       │                   │                         │ (balance.updated x2)   │                      │                        │
   │                       │                       │                   │◀────────────────────────│                        │                      │                        │
   │                       │                       │◀──────────────────│                         │                        │                      │                        │
   │◀──────────────────────│                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
   │  200 OK + JSON        │                       │                   │                         │                        │                      │                        │
   │                       │                       │                   │                         │                        │                      │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| New validation rules   | `SendGiftRequest.php` (basic) or `GiftTransactionDTO.php` (with DB checks) |
| New distribution logic | `GiftTransactionService.php` Step 5                                        |
| New coin recipient     | `GiftTransactionService.php` Step 7                                        |
| New XP type            | `GiftTransactionService.php` Step 8                                        |
| New transaction type   | `GiftTransactionService::createTransactionRecords()`                       |
| New real-time event    | `MSABEventService.php` + `GiftTransactionService::emitMSABEvents()`        |
| New async processing   | `ProcessGiftSideEffectsJob.php` or new job                                 |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUEST FIELD

| Step  | File                         | What to Change                   |
| ----- | ---------------------------- | -------------------------------- |
| **1** | `SendGiftRequest.php`        | Add validation rule to `rules()` |
| **2** | `GiftTransactionDTO.php`     | Add property + validation        |
| **3** | `GiftTransactionService.php` | Use `$dto->newField` in logic    |
| **4** | API docs                     | Update contract section          |

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                         | What to Change                |
| ----- | ---------------------------- | ----------------------------- |
| **1** | `GiftTransactionService.php` | Add to return array (Step 13) |
| **2** | API docs                     | Update response schema        |

#### ➖ REMOVING A FIELD

| Step  | File                         | What to Change         |
| ----- | ---------------------------- | ---------------------- |
| **1** | `SendGiftRequest.php`        | Remove validation rule |
| **2** | `GiftTransactionDTO.php`     | Remove property        |
| **3** | `GiftTransactionService.php` | Remove usage           |
| **4** | API docs                     | Update schemas         |

### 🔗 Field Flow Dependency Chain

```
Request Body
    │
    ▼
┌──────────────────────┐
│  SendGiftRequest     │ Basic validation (types, required)
└──────────────────────┘
    │
    ▼
┌──────────────────────┐
│  GiftTransactionDTO  │ DB existence validation + immutable DTO
└──────────────────────┘
    │
    ▼
┌───────────────────────────────┐
│  GiftTransactionService       │ Business logic, calculations
└───────────────────────────────┘
    │
    ├──────▶ CoinDistributionService (balance mutations)
    ├──────▶ AgencyIncomeService (if agency member)
    ├──────▶ ProcessGiftSideEffectsJob (async level-ups)
    └──────▶ MSABEventService (real-time events)
```

### 📋 Field Modification Checklists

**Adding a new gift modifier (e.g., VIP multiplier):**

- [ ] Add field to `SendGiftRequest.php` validation
- [ ] Add property to `GiftTransactionDTO.php`
- [ ] Apply multiplier in `GiftTransactionService::processGiftTransaction()` Step 5
- [ ] Update transaction metadata if needed
- [ ] Add to response array
- [ ] Document in API contract

### ⚠️ What Should NOT Be Modified Casually

| Component                       | Reason                                              |
| ------------------------------- | --------------------------------------------------- |
| `DB::transaction()` wrapper     | Ensures atomicity of all mutations                  |
| `lockForUpdate()` calls         | Prevents race conditions and balance corruption     |
| Transaction row creation        | Audit trail integrity                               |
| `afterCommit()` on job dispatch | Prevents orphan jobs if transaction rolls back      |
| Integer math for coins          | BC math precision not needed, avoids floating point |
| Gift cache key pattern          | Must invalidate when gift becomes inactive          |
| Balance mutation order          | Deduct first, then add (prevents silent failures)   |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                           |
| ------------------------------------------ | ---------------------------------------------------- |
| Reading balance outside lock               | Always use `lockForUpdate()` for balance reads       |
| BC math for coins                          | Use integer math only (coins are whole numbers)      |
| Dispatching job inside transaction         | Use `->afterCommit()` to prevent orphan jobs         |
| Redis in transaction                       | MSAB events emitted AFTER commit (line 326)          |
| Forgetting agency member case              | Always check `$isAgencyMember` before adding coins   |
| Not handling sender == room owner          | Sender gets commission back if they own the room     |
| Ignoring validation exception from DTO     | DTO throws `ValidationException` with custom message |
| Modifying systemSettingService percentages | Changes affect ALL gift transactions immediately     |

### 📁 File Locations Quick Reference

```
routes/api/gifts.php                                     ← Route definition
app/Http/Controllers/Api/V1/Gift/
  └── GiftTransactionController.php                      ← Controller
app/Http/Requests/Gift/
  └── SendGiftRequest.php                                ← Request validation
app/DTOs/
  └── GiftTransactionDTO.php                             ← Data transfer object
app/Services/Gift/
  ├── GiftTransactionService.php                         ← Main business logic
  └── MSABEventService.php                               ← Real-time events
app/Services/Economy/
  └── CoinDistributionService.php                        ← Balance mutations
app/Services/Agency/
  └── AgencyIncomeService.php                            ← Agency income tracking
app/Services/Progression/
  └── SystemSettingService.php                           ← Configuration percentages
app/Jobs/Gift/
  └── ProcessGiftSideEffectsJob.php                      ← Async level-up processing
app/Exceptions/Gift/
  └── GiftNotFoundException.php                          ← Gift not found exception
app/Exceptions/Room/
  └── RoomNotFoundException.php                          ← Room not found exception
app/Exceptions/Economy/
  └── InsufficientBalanceException.php                   ← Balance exception
app/Http/Resources/V1/Gift/
  └── GiftTransactionResource.php                        ← Transaction display (listings)
```

---

## Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `POST /api/v1/gifts/send` |
| **Domain**          | Gift                      |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-02                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
