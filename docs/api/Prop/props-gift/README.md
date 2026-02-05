# POST /api/v1/props/gift

> **Domain**: Prop  
> **Type**: Protected Endpoint (Transactional)  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Gift endpoint allows authenticated users to purchase a prop and gift it to another user within a room context. This is a social monetization feature enabling users to show appreciation or support to others in live rooms.

### Responsibilities

- Validate the sender can gift the prop (authorization via policy)
- Validate recipient exists and is not the sender
- Validate room context for the gift
- Deduct coins from sender's balance atomically
- Decrement prop inventory atomically
- Create user prop ownership record for recipient
- Log transaction linking sender, recipient, and room
- Return transaction details and updated balance

### What It Owns

| Owned               | Description                                     |
| ------------------- | ----------------------------------------------- |
| Gift flow           | End-to-end prop gifting transaction             |
| UserProp creation   | Creates ownership for recipient in `user_props` |
| Transaction logging | Creates audit record with room context          |
| Inventory mgmt      | Decrements `props.inventory_count`              |

### External Dependencies

| Dependency              | Type           | Purpose                   |
| ----------------------- | -------------- | ------------------------- |
| PostgreSQL              | Database       | Transactional data access |
| Redis                   | Cache          | Idempotency key storage   |
| Sanctum                 | Authentication | Bearer token validation   |
| CoinDistributionService | Service        | Balance deduction         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/props/gift
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Authorization

✅ **Policy Check** - `PropPolicy::gift()` verifies:

- Prop is giftable (`is_giftable = true`)
- Prop is available (active, in stock, within date window)
- User meets VIP level requirement

### Rate Limiting

| Limiter     | Key         | Limit    |
| ----------- | ----------- | -------- |
| `prop_gift` | `user:{id}` | 5/minute |

### Request Headers

| Header              | Required | Type               | Description                     |
| ------------------- | -------- | ------------------ | ------------------------------- |
| `Content-Type`      | ✅       | `application/json` | Request body format             |
| `Accept`            | ✅       | `application/json` | Response format                 |
| `Authorization`     | ✅       | `Bearer {token}`   | Authentication token            |
| `X-Idempotency-Key` | ❌       | `string`           | Optional client idempotency key |

### Request Body

```json
{
  "prop_id": 42, // int, required, existing prop ID
  "recipient_id": 12345, // int, required, existing user ID (not self)
  "room_id": 100, // int, required, room where gift occurs
  "message": "Enjoy this gift!" // string|null, optional, max 200 chars
}
```

#### Request Body Parameters

| Parameter      | Type     | Constraints                                     | Example           |
| -------------- | -------- | ----------------------------------------------- | ----------------- |
| `prop_id`      | `int`    | Required, exists in `props` table               | `42`              |
| `recipient_id` | `int`    | Required, exists in `users`, not same as sender | `12345`           |
| `room_id`      | `int`    | Required, exists in `rooms` table               | `100`             |
| `message`      | `string` | Optional, max 200 characters                    | `"Great stream!"` |

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "Prop gifted successfully.",
  "data": {
    "transaction_id": 98765, // int, Transaction record ID
    "recipient_user_prop_id": 12346, // int, UserProp record for recipient
    "balance": {
      "coins_before": 1000, // int, sender's balance before
      "coins_after": 900 // int, sender's balance after
    }
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "The given data was invalid.",
  "data": null,
  "errors": {
    "prop_id": ["The selected prop id is invalid."],
    "recipient_id": ["You cannot gift a prop to yourself."]
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Forbidden (403) - Policy Denied

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400) - Not Giftable

```json
{
  "status": "error",
  "message": "This prop cannot be gifted.",
  "data": null,
  "errors": {
    "code": "prop_not_available"
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Payment Required (402) - Insufficient Balance

```json
{
  "status": "error",
  "message": "Insufficient balance.",
  "data": null,
  "errors": {
    "code": "insufficient_balance"
  },
  "meta": {
    "timestamp": "2026-02-05T04:02:32.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `201` | Successfully gifted prop                      |
| `400` | Prop sold out, not available, or not giftable |
| `401` | Missing or invalid authentication token       |
| `402` | Insufficient coin balance                     |
| `403` | Policy denied (VIP too low, etc.)             |
| `409` | Duplicate gift (idempotency violation)        |
| `422` | Validation failed (invalid IDs, self-gift)    |
| `429` | Rate limit exceeded                           |
| `500` | Server error                                  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/props/gift                                  │
│             Body: {prop_id, recipient_id, room_id, message}                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:44-46                                            │
│ Route: Route::post('/gift', [PropPurchaseController::class, 'gift'])        │
│        ->name('props.gift')                                                 │
│        ->middleware('throttle:prop_gift')                                   │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum        → Validates Bearer token                           │
│   2. throttle:prop_gift  → 5 requests/minute per user                       │
│                                                                             │
│ No Route Model Binding - prop_id comes from request body                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (Form Request)                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Prop/GiftPropRequest.php                            │
│ Class: GiftPropRequest extends FormRequest                                  │
│                                                                             │
│ AUTHORIZATION CHECK (via PropPolicy):                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     $prop = Prop::find($this->input('prop_id'));                        │ │
│ │     if (! $prop) return false;                                          │ │
│ │     return $this->user()->can('gift', $prop);  // → PropPolicy::gift()  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ VALIDATION RULES:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array {                                        │ │
│ │     return [                                                            │ │
│ │         'prop_id' => ['required', 'integer', 'exists:props,id'],        │ │
│ │         'recipient_id' => [                                             │ │
│ │             'required', 'integer', 'exists:users,id',                   │ │
│ │             Rule::notIn([$this->user()?->id]),  // Cannot self-gift     │ │
│ │         ],                                                              │ │
│ │         'room_id' => ['required', 'integer', 'exists:rooms,id'],        │ │
│ │         'message' => ['nullable', 'string', 'max:200'],                 │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CUSTOM MESSAGES:                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'recipient_id.not_in' => 'You cannot gift a prop to yourself.'          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2.1 POLICY CHECK                                                          │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Prop/PropPolicy.php:61-68                                │
│ Method: gift(User $user, Prop $prop): bool                                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function gift(User $user, Prop $prop): bool                      │ │
│ │ {                                                                       │ │
│ │     // Must be giftable                                                 │ │
│ │     if (! $prop->is_giftable) return false;                             │ │
│ │                                                                         │ │
│ │     // Delegates to purchase policy for availability + VIP check        │ │
│ │     return $this->purchase($user, $prop);                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Returns 403 if policy denies access                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/PropPurchaseController.php:59-73     │
│ Method: gift(GiftPropRequest $request): JsonResponse                        │
│                                                                             │
│ STEP 1: Create DTO from validated request                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = GiftPropDTO::fromValidated(                                      │ │
│ │     $request->validated(),                                              │ │
│ │     $request->user()->id                                                │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // DTO contains:                                                        │ │
│ │ // - senderId: authenticated user ID                                    │ │
│ │ // - recipientId: from request body                                     │ │
│ │ // - propId: from request body                                          │ │
│ │ // - roomId: from request body                                          │ │
│ │ // - message: optional message                                          │ │
│ │ // - idempotencyKey: auto-generated                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service layer                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->purchaseService->gift($dto);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle failure/success responses                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(...);                                     │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success($result->getData(), ..., 201);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Prop/PropPurchaseService.php:175-306                     │
│ Method: gift(GiftPropDTO $dto): ActionResult                                │
│                                                                             │
│ STEP 1: Check idempotency                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($dto->idempotencyKey && Cache::has($dto->idempotencyKey)) {         │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errorCode: 'duplicate_purchase',                                │ │
│ │         message: 'This gift has already been sent.'                     │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = DB::transaction(function () use ($dto) { ... });              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3 (in txn): Lock and validate prop                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $prop = Prop::where('id', $dto->propId)->lockForUpdate()->first();      │ │
│ │                                                                         │ │
│ │ if (! $prop) throw new PropNotAvailableException('Prop not found.');    │ │
│ │ if (! $prop->is_giftable) throw new PropNotAvailableException(          │ │
│ │     'This prop cannot be gifted.'                                       │ │
│ │ );                                                                      │ │
│ │ if (! $prop->is_available) {                                            │ │
│ │     if ($prop->is_sold_out) throw new PropSoldOutException;             │ │
│ │     throw new PropNotAvailableException;                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4 (in txn): Validate recipient exists                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $recipient = User::find($dto->recipientId);                             │ │
│ │ if (! $recipient) throw new PropNotAvailableException('Recipient not found.');│
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5 (in txn): Deduct balance from SENDER                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $price = (int) $prop->price;                                            │ │
│ │ $balanceResult = $this->coinService->deductFromUser($dto->senderId, $price);│
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6 (in txn): Decrement inventory                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $prop->decrementInventory()) throw new PropSoldOutException;      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7 (in txn): Create UserProp for RECIPIENT                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userProp = UserProp::create([                                          │ │
│ │     'user_id' => $dto->recipientId,        // Recipient owns it         │ │
│ │     'prop_id' => $prop->id,                                             │ │
│ │     'prop_type' => $prop->type->value,                                  │ │
│ │     'status' => PropStatus::ACTIVE,                                     │ │
│ │     'purchased_at' => now(),                                            │ │
│ │     'expires_at' => now()->addDays($prop->duration_days),               │ │
│ │     'is_equipped' => false,                                             │ │
│ │     'source_type' => PropSourceType::GIFT,  // Marked as gift           │ │
│ │     'source_user_id' => $dto->senderId,     // Tracks sender            │ │
│ │     'transaction_id' => null,                                           │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8 (in txn): Create Transaction record with room context                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $transaction = Transaction::create([                                    │ │
│ │     'type' => Transaction::TYPE_PROP_GIFT,                              │ │
│ │     'initiator_id' => $dto->senderId,       // Sender pays              │ │
│ │     'beneficiary_id' => $dto->recipientId,  // Recipient receives       │ │
│ │     'room_id' => $dto->roomId,              // Room context             │ │
│ │     'amount' => $price,                                                 │ │
│ │     'initiator_balance_before' => $balanceResult['balance_before'],     │ │
│ │     'initiator_balance_after' => $balanceResult['balance_after'],       │ │
│ │     'transactionable_type' => Prop::class,                              │ │
│ │     'transactionable_id' => $prop->id,                                  │ │
│ │     'status' => Transaction::STATUS_COMPLETED,                          │ │
│ │     'metadata' => [                                                     │ │
│ │         'prop_name' => $prop->name,                                     │ │
│ │         'prop_type' => $prop->type->value,                              │ │
│ │         'message' => $dto->message,         // Gift message stored      │ │
│ │         'user_prop_id' => $userProp->id,                                │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ │ $userProp->update(['transaction_id' => $transaction->id]);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9 (after txn): Set idempotency key (1-hour TTL)                        │
│ STEP 10 (after txn): Dispatch PropPurchased event (for recipient)           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ event(new PropPurchased(                                                │ │
│ │     userId: $dto->recipientId,  // Recipient's cache invalidated        │ │
│ │     propId: $dto->propId,                                               │ │
│ │     userPropId: $result['user_prop']->id                                │ │
│ │ ));                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: GiftPropDTO                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Prop/GiftPropDTO.php                                     │ │
│ │ - Immutable data transfer object                                        │ │
│ │ - Contains: senderId, recipientId, propId, roomId, message              │ │
│ │ - Generates idempotency key: prop_gift:{sender}:{prop}:{recipient}:{hour}│
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: PropSourceType (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Prop/PropSourceType.php                                 │ │
│ │ - PURCHASE = 'purchase' (self-buy)                                      │ │
│ │ - GIFT = 'gift' (received as gift)                                      │ │
│ │ - REWARD = 'reward' (system reward)                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinDistributionService                                          │
│ COMPONENT: PropPurchased (Event)                                            │
│ COMPONENT: ActionResult                                                     │
│ (Same as purchase endpoint)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (all within single transaction):                        │
│                                                                             │
│ 1. SELECT FOR UPDATE: Lock prop row                                         │
│ 2. SELECT: Validate recipient exists                                        │
│ 3. UPDATE: Deduct sender balance (via CoinDistributionService)              │
│ 4. UPDATE: Decrement prop inventory                                         │
│ 5. INSERT: Create user_props for recipient                                  │
│ 6. INSERT: Create transactions with room_id                                 │
│ 7. UPDATE: Link user_prop to transaction                                    │
│                                                                             │
│ KEY DIFFERENCE FROM PURCHASE:                                               │
│   • Transaction has beneficiary_id (recipient)                              │
│   • Transaction has room_id (gift context)                                  │
│   • UserProp has source_type = GIFT, source_user_id = sender                │
│   • Metadata includes gift message                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response structure (different from purchase):                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'transaction_id' => $result['transaction']->id,                     │ │
│ │     'recipient_user_prop_id' => $result['user_prop']->id,               │ │
│ │     'balance' => $result['balance'],  // Sender's updated balance       │ │
│ │ ], 'Prop gifted successfully.', 201);                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    201 Created + JSON Body                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                          | Used By Endpoints              | Reusable | Reasoning                         |
| ----------------------------- | ------------------------------ | -------- | --------------------------------- |
| `PropPurchaseController.php`  | purchase, gift                 | ⭕       | Mixed - methods endpoint-specific |
| `PropPurchaseService.php`     | purchase, gift                 | ✅       | Core purchase/gift business logic |
| `GiftPropRequest.php`         | gift only                      | ❌       | Endpoint-specific                 |
| `GiftPropDTO.php`             | gift only                      | ❌       | Endpoint-specific                 |
| `PropPolicy.php`              | purchase, gift, view endpoints | ✅       | Domain authorization              |
| `PropSourceType.php`          | Any prop acquisition flow      | ✅       | Shared enum                       |
| `CoinDistributionService.php` | All economy operations         | ✅       | Core economy service              |
| `PropPurchased.php` (Event)   | purchase, gift                 | ✅       | Domain event                      |
| `ApiResponse.php`             | All API endpoints              | ✅       | Global response utility           |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Field          | Error                                    | Condition                   |
| -------------- | ---------------------------------------- | --------------------------- |
| `prop_id`      | The selected prop id is invalid.         | Prop doesn't exist          |
| `recipient_id` | The selected recipient id is invalid.    | User doesn't exist          |
| `recipient_id` | You cannot gift a prop to yourself.      | `recipient_id == sender_id` |
| `room_id`      | The selected room id is invalid.         | Room doesn't exist          |
| `message`      | The message may not be greater than 200. | Message exceeds 200 chars   |

### Authorization Errors (403)

| Error                          | Source               | Condition                   |
| ------------------------------ | -------------------- | --------------------------- |
| `This action is unauthorized.` | `GiftPropRequest`    | Policy denies gift          |
| Prop not giftable              | `PropPolicy::gift()` | `is_giftable = false`       |
| VIP level insufficient         | `PropPolicy`         | User VIP < prop requirement |

### Business Logic Errors (400, 402, 409)

| Code  | Error Code             | Message                          | Cause                             |
| ----- | ---------------------- | -------------------------------- | --------------------------------- |
| `400` | `prop_sold_out`        | This prop is sold out.           | `inventory_count <= 0`            |
| `400` | `prop_not_available`   | This prop cannot be gifted.      | Prop not giftable                 |
| `400` | `prop_not_available`   | Recipient not found.             | Recipient deleted mid-transaction |
| `402` | `insufficient_balance` | Insufficient balance.            | Sender coins < prop price         |
| `409` | `duplicate_purchase`   | This gift has already been sent. | Idempotency key exists            |

### Edge Cases

| Case                                   | Behavior                                 |
| -------------------------------------- | ---------------------------------------- |
| Gift to self                           | 422 validation error before policy check |
| Recipient deleted between validation   | 400 "Recipient not found" in service     |
| Same gift twice in same hour           | 409 Duplicate (idempotency)              |
| Gift same prop to different recipients | Allowed - different idempotency keys     |
| Prop becomes non-giftable mid-txn      | Service re-validates with lock           |
| Empty message                          | Allowed (null stored)                    |
| Message exactly 200 chars              | Allowed                                  |
| Message 201 chars                      | 422 validation error                     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT          MIDDLEWARE           REQUEST          CONTROLLER           SERVICE             DATABASE
   │                 │                    │                  │                  │                    │
   │ POST /props/gift                     │                  │                  │                    │
   │ {prop_id, recipient_id, room_id}     │                  │                  │                    │
   │─────────────────▶                    │                  │                  │                    │
   │                 │                    │                  │                  │                    │
   │                 │ 1. auth:sanctum    │                  │                  │                    │
   │                 │ 2. throttle:prop_gift                 │                  │                    │
   │                 │───────────────────▶│                  │                  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │ 3. Validate rules│                  │                    │
   │                 │                    │    (prop, recipient, room exists)   │                    │
   │                 │                    │    (recipient != self)              │                    │
   │                 │                    │        [IF 422 → Return Validation Error]               │
   │                 │                    │                  │                  │                    │
   │                 │                    │ 4. authorize()   │                  │                    │
   │                 │                    │    PropPolicy::gift()               │                    │
   │                 │                    │        [IF 403 → Return Forbidden]  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │ 5. Create DTO    │                  │                    │
   │                 │                    │─────────────────▶│                  │                    │
   │                 │                    │                  │─────────────────▶│                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 6. Check idem-     │
   │                 │                    │                  │                  │    potency key     │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 7. BEGIN TXN       │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 8. Lock prop       │
   │                 │                    │                  │                  │ 9. Validate        │
   │                 │                    │                  │                  │    is_giftable     │
   │                 │                    │                  │                  │10. Find recipient  │
   │                 │                    │                  │                  │11. Deduct sender   │
   │                 │                    │                  │                  │    balance         │
   │                 │                    │                  │                  │12. Decrement inv   │
   │                 │                    │                  │                  │13. Create UserProp │
   │                 │                    │                  │                  │    (for recipient) │
   │                 │                    │                  │                  │14. Create Txn      │
   │                 │                    │                  │                  │    (with room_id)  │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │15. COMMIT TXN      │
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │16. Set idempotency │
   │                 │                    │                  │                  │17. Dispatch event  │
   │                 │                    │                  │◀─────────────────│                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │18. ApiResponse   │                    │
   │                 │◀───────────────────│◀─────────────────│   ::success()    │                    │
   │◀────────────────│                    │                  │                  │                    │
   │                 │                    │                  │                  │                    │
   │  201 Created    │                    │                  │                  │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                             |
| -------------------------- | ------------------------------------ |
| Notify recipient of gift   | Add listener to PropPurchased event  |
| Gift animation in room     | Emit MSAB event from listener        |
| Gift leaderboard           | Query transactions by type=PROP_GIFT |
| Multiple props in one gift | New bulk endpoint; loop in service   |
| Gift currency amount       | Separate endpoint/flow               |

### 📝 Field Modification Guide

#### ➕ ADDING A REQUEST FIELD

| Step  | File                      | What to Change                        |
| ----- | ------------------------- | ------------------------------------- |
| **1** | `GiftPropRequest.php`     | Add validation rule                   |
| **2** | `GiftPropDTO.php`         | Add property and update fromValidated |
| **3** | `PropPurchaseService.php` | Handle new field in gift logic        |

#### ➕ EXAMPLE: ADD ANONYMOUS GIFTING

| Step  | File                      | What to Change                          |
| ----- | ------------------------- | --------------------------------------- |
| **1** | `GiftPropRequest.php`     | Add `'is_anonymous' => 'boolean'`       |
| **2** | `GiftPropDTO.php`         | Add `public readonly bool $isAnonymous` |
| **3** | `PropPurchaseService.php` | Store in transaction metadata           |

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                       |
| ---------------------------- | -------------------------------------------- |
| Self-gift validation         | Critical business rule; never allow          |
| `is_giftable` check          | Some props shouldn't be giftable (exclusive) |
| Room ID requirement          | Ties gift to room context for leaderboards   |
| Transaction beneficiary_id   | Links gift to recipient; used for reports    |
| `source_user_id` on UserProp | Tracks gift provenance                       |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                        |
| ------------------------------------------ | ------------------------------------------------- |
| Allowing self-gifts                        | Validation happens before policy; never bypass    |
| Forgetting room_id in transaction          | Required for room gift leaderboards               |
| Not storing gift message                   | Keep in metadata; may be displayed to recipient   |
| Notifying wrong user (sender vs recipient) | Event goes to recipient for cache invalidation    |
| Leaking sender info in anonymous gifts     | Check is_anonymous before exposing source_user_id |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 44-46)
app/Http/Controllers/Api/V1/Prop/
  └── PropPurchaseController.php                     ← Controller (gift method, lines 59-73)
app/Http/Requests/Prop/
  └── GiftPropRequest.php                            ← Form Request with validation + policy
app/Policies/Prop/
  └── PropPolicy.php                                 ← Authorization policy (gift method)
app/Services/Prop/
  └── PropPurchaseService.php                        ← Service (gift method, lines 175-306)
app/DTOs/Prop/
  └── GiftPropDTO.php                                ← Data transfer object
app/Enums/Prop/
  └── PropSourceType.php                             ← PURCHASE, GIFT, REWARD enum
```

---

## 8. MSAB Realtime Event Contracts

### PropPurchased Event (Recipient)

This endpoint dispatches `PropPurchased` event with the **recipient's** user ID for cache invalidation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Event: PropPurchased                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Events/Prop/PropPurchased.php                                     │
│ Dispatched: After successful gift (outside transaction)                     │
│                                                                             │
│ Payload:                                                                    │
│   • userId: int       - RECIPIENT's ID (not sender)                         │
│   • propId: int       - Gifted prop's ID                                    │
│   • userPropId: int   - Created UserProp record ID                          │
│                                                                             │
│ Potential Listeners:                                                        │
│   • InvalidatePropCacheListener → Clears recipient's prop cache             │
│   • GiftNotificationListener → Notify recipient of gift (MSAB push)         │
│   • RoomGiftAnimationListener → Trigger room animation (MSAB broadcast)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Potential MSAB Events (via listeners)

| Event Type       | Channel Pattern      | Payload                     |
| ---------------- | -------------------- | --------------------------- |
| `gift.received`  | `user.{recipientId}` | prop_id, sender_id, message |
| `room.gift.sent` | `room.{roomId}`      | prop_id, animation data     |

---

## 9. Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `POST /api/v1/props/gift` |
| **Domain**          | Prop                      |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-05                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
