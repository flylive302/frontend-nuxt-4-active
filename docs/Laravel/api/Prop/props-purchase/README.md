# POST /api/v1/props/{prop}/purchase

> **Domain**: Prop  
> **Type**: Protected Endpoint (Transactional)  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Purchase endpoint allows authenticated users to buy a prop from the mall catalog for themselves. This is the core monetization flow for the prop system, integrating with the economy layer for balance management and creating ownership records.

### Responsibilities

- Validate the user can purchase the prop (authorization via policy)
- Deduct coins from user's balance atomically
- Decrement prop inventory atomically
- Create user prop ownership record with expiration
- Log transaction for audit trail
- Return updated balance and ownership details

### What It Owns

| Owned               | Description                                    |
| ------------------- | ---------------------------------------------- |
| Purchase flow       | End-to-end prop purchase transaction           |
| UserProp creation   | Creates ownership record in `user_props` table |
| Transaction logging | Creates audit record in `transactions` table   |
| Inventory mgmt      | Decrements `props.inventory_count`             |

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
POST /api/v1/props/{prop}/purchase
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Authorization

✅ **Policy Check** - `PropPolicy::purchase()` verifies:

- Prop is available (active, in stock, within date window)
- User meets VIP level requirement

### Rate Limiting

| Limiter         | Key         | Limit     |
| --------------- | ----------- | --------- |
| `prop_purchase` | `user:{id}` | 10/minute |

### Request Headers

| Header              | Required | Type               | Description                     |
| ------------------- | -------- | ------------------ | ------------------------------- |
| `Accept`            | ✅       | `application/json` | Response format                 |
| `Authorization`     | ✅       | `Bearer {token}`   | Authentication token            |
| `X-Idempotency-Key` | ❌       | `string`           | Optional client idempotency key |

### Path Parameters

| Parameter | Type  | Constraints                       | Example |
| --------- | ----- | --------------------------------- | ------- |
| `prop`    | `int` | Required, exists in `props` table | `42`    |

### Request Body

None required. Prop ID comes from URL path.

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "Prop purchased successfully.",
  "data": {
    "user_prop": {
      "id": 12345, // int, UserProp record ID
      "prop_id": 42, // int, purchased prop ID
      "expires_at": "2026-03-07T03:58:35+00:00", // ISO8601, expiration time
      "is_equipped": false // bool, always false initially
    },
    "balance": {
      "coins_before": 1000, // int, balance before deduction
      "coins_after": 900 // int, balance after deduction
    }
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
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
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400) - Sold Out

```json
{
  "status": "error",
  "message": "This prop is sold out.",
  "data": null,
  "errors": {
    "code": "prop_sold_out"
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
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
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Conflict (409) - Duplicate Purchase

```json
{
  "status": "error",
  "message": "This purchase has already been processed.",
  "data": null,
  "errors": {
    "code": "duplicate_purchase"
  },
  "meta": {
    "timestamp": "2026-02-05T03:58:35.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `201` | Successfully purchased prop                |
| `400` | Prop sold out or not available             |
| `401` | Missing or invalid authentication token    |
| `402` | Insufficient coin balance                  |
| `403` | Policy denied (VIP level too low, etc.)    |
| `404` | Prop not found                             |
| `409` | Duplicate purchase (idempotency violation) |
| `429` | Rate limit exceeded                        |
| `500` | Server error                               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/props/42/purchase                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:40-42                                            │
│ Route: Route::post('/{prop}/purchase',                                      │
│            [PropPurchaseController::class, 'purchase'])                     │
│        ->whereNumber('prop')                                                │
│        ->name('props.purchase')                                             │
│        ->middleware('throttle:prop_purchase')                               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum        → Validates Bearer token                           │
│   2. throttle:prop_purchase → 10 requests/minute per user                   │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {prop} → Prop::findOrFail($prop) → 404 if not found                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (Form Request)                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Prop/PurchasePropRequest.php                        │
│ Class: PurchasePropRequest extends FormRequest                              │
│                                                                             │
│ AUTHORIZATION CHECK (via PropPolicy):                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     $prop = $this->route('prop');                                       │ │
│ │     if (! $prop instanceof Prop) return false;                          │ │
│ │     return $this->user()->can('purchase', $prop);  // → PropPolicy      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ VALIDATION RULES: None (prop ID from route, no body params)                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array { return []; }                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2.1 POLICY CHECK                                                          │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Prop/PropPolicy.php:41-53                                │
│ Method: purchase(User $user, Prop $prop): bool                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function purchase(User $user, Prop $prop): bool                  │ │
│ │ {                                                                       │ │
│ │     // Check availability (is_active, in stock, date window)            │ │
│ │     if (! $prop->is_available) return false;                            │ │
│ │                                                                         │ │
│ │     // Check VIP level requirement                                      │ │
│ │     if ($user->vip_level < $prop->vip_level_required) return false;     │ │
│ │                                                                         │ │
│ │     return true;                                                        │ │
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
│ File: app/Http/Controllers/Api/V1/Prop/PropPurchaseController.php:28-52     │
│ Method: purchase(PurchasePropRequest $request, Prop $prop): JsonResponse    │
│                                                                             │
│ STEP 1: Create DTO from validated request                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = PurchasePropDTO::fromValidated($request->user()->id, $prop->id); │ │
│ │                                                                         │ │
│ │ // DTO contains:                                                        │ │
│ │ // - userId: authenticated user ID                                      │ │
│ │ // - propId: prop ID from route                                         │ │
│ │ // - idempotencyKey: auto-generated (user:prop:hour format)             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service layer                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->purchaseService->purchase($dto);                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle failure responses                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage(),                                          │ │
│ │         $this->httpStatusFromErrorCode($result->getErrorCode()),        │ │
│ │         $result->getErrorCode()                                         │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success response (201)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'user_prop' => [...],                                               │ │
│ │     'balance' => $data['balance'],                                      │ │
│ │ ], $result->getMessage(), 201);                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Prop/PropPurchaseService.php:35-169                      │
│ Method: purchase(PurchasePropDTO $dto): ActionResult                        │
│                                                                             │
│ STEP 1: Check idempotency (prevent duplicate purchases)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($dto->idempotencyKey && Cache::has($dto->idempotencyKey)) {         │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errorCode: 'duplicate_purchase',                                │ │
│ │         message: 'This purchase has already been processed.'            │ │
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
│ │ $prop = Prop::where('id', $dto->propId)                                 │ │
│ │     ->lockForUpdate()  // SELECT ... FOR UPDATE                         │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (! $prop) throw new PropNotAvailableException('Prop not found.');    │ │
│ │ if (! $prop->is_available) {                                            │ │
│ │     if ($prop->is_sold_out) throw new PropSoldOutException;             │ │
│ │     throw new PropNotAvailableException;                                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4 (in txn): Verify VIP level                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = User::where('id', $dto->userId)->first();                       │ │
│ │ if ($user->vip_level < $prop->vip_level_required) {                     │ │
│ │     throw new PropNotAvailableException("VIP level required.");         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5 (in txn): Deduct balance via CoinDistributionService                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $price = (int) $prop->price;                                            │ │
│ │ $balanceResult = $this->coinService->deductFromUser($dto->userId, $price);│ │
│ │ // Returns: ['balance_before' => int, 'balance_after' => int]           │ │
│ │ // Throws InsufficientBalanceException if balance < price               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6 (in txn): Decrement inventory atomically                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $prop->decrementInventory()) {                                    │ │
│ │     throw new PropSoldOutException;  // Race condition - sold out       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7 (in txn): Create UserProp record                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userProp = UserProp::create([                                          │ │
│ │     'user_id' => $dto->userId,                                          │ │
│ │     'prop_id' => $prop->id,                                             │ │
│ │     'prop_type' => $prop->type->value,  // Denormalized for perf        │ │
│ │     'status' => PropStatus::ACTIVE,                                     │ │
│ │     'purchased_at' => now(),                                            │ │
│ │     'expires_at' => now()->addDays($prop->duration_days),               │ │
│ │     'is_equipped' => false,                                             │ │
│ │     'source_type' => PropSourceType::PURCHASE,                          │ │
│ │     'source_user_id' => null,                                           │ │
│ │     'transaction_id' => null,                                           │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8 (in txn): Create Transaction record                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $transaction = Transaction::create([                                    │ │
│ │     'type' => Transaction::TYPE_PROP_PURCHASE,                          │ │
│ │     'initiator_id' => $dto->userId,                                     │ │
│ │     'beneficiary_id' => null,  // Platform purchase                     │ │
│ │     'amount' => $price,                                                 │ │
│ │     'initiator_balance_before' => $balanceResult['balance_before'],     │ │
│ │     'initiator_balance_after' => $balanceResult['balance_after'],       │ │
│ │     'transactionable_type' => Prop::class,                              │ │
│ │     'transactionable_id' => $prop->id,                                  │ │
│ │     'status' => Transaction::STATUS_COMPLETED,                          │ │
│ │     'metadata' => ['prop_name' => ..., 'prop_type' => ..., ...],        │ │
│ │ ]);                                                                     │ │
│ │ $userProp->update(['transaction_id' => $transaction->id]);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9 (after txn): Set idempotency key (1 hour TTL)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($dto->idempotencyKey) {                                             │ │
│ │     Cache::put($dto->idempotencyKey, true, 3600);                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 10 (after txn): Dispatch PropPurchased event                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ event(new PropPurchased(                                                │ │
│ │     userId: $dto->userId,                                               │ │
│ │     propId: $dto->propId,                                               │ │
│ │     userPropId: $result['user_prop']->id                                │ │
│ │ ));                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 11: Return ActionResult                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: $result,                                                      │ │
│ │     message: 'Prop purchased successfully.'                             │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: PurchasePropDTO                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Prop/PurchasePropDTO.php                                 │ │
│ │ - Immutable data transfer object                                        │ │
│ │ - Generates idempotency key: prop_purchase:{userId}:{propId}:{hour}     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ - Encapsulates success/failure with data, message, errorCode            │ │
│ │ - Used consistently across service layer                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinDistributionService                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Economy/CoinDistributionService.php                  │ │
│ │ - Handles coin balance operations                                       │ │
│ │ - Uses lockForUpdate internally for atomicity                           │ │
│ │ - Throws InsufficientBalanceException                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: PropPurchased (Event)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Events/Prop/PropPurchased.php                                 │ │
│ │ - Dispatched after successful purchase                                  │ │
│ │ - Triggers cache invalidation listeners                                 │ │
│ │ - May trigger MSAB notifications                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM props WHERE id = 42 FOR UPDATE                        │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 2. SELECT: Get user for VIP check                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM users WHERE id = ? LIMIT 1                            │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 3. UPDATE: Deduct user balance (via CoinDistributionService)                │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE users SET coins = coins - 100 WHERE id = ? AND coins >= 100  │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 4. UPDATE: Decrement prop inventory                                         │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE props SET inventory_count = inventory_count - 1              │  │
│    │ WHERE id = 42 AND inventory_count > 0                               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 5. INSERT: Create user_props record                                         │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ INSERT INTO user_props (...) VALUES (...)                           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 6. INSERT: Create transactions record                                       │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ INSERT INTO transactions (...) VALUES (...)                         │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 7. UPDATE: Link user_prop to transaction                                    │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE user_props SET transaction_id = ? WHERE id = ?               │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   • GET: Check idempotency key existence                                    │
│   • SET: Store idempotency key with 1-hour TTL                              │
│                                                                             │
│ EVENT DISPATCHING:                                                          │
│   • PropPurchased event → Triggers cache invalidation                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response is built directly in controller (no Resource class):               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'user_prop' => [                                                    │ │
│ │         'id' => $data['user_prop']->id,                                 │ │
│ │         'prop_id' => $data['user_prop']->prop_id,                       │ │
│ │         'expires_at' => $data['user_prop']->expires_at->toIso8601String(),│ │
│ │         'is_equipped' => $data['user_prop']->is_equipped,               │ │
│ │     ],                                                                  │ │
│ │     'balance' => $data['balance'],                                      │ │
│ │ ], $result->getMessage(), 201);                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Error code to HTTP status mapping:                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'prop_sold_out'        → 400                                            │ │
│ │ 'prop_not_available'   → 400                                            │ │
│ │ 'insufficient_balance' → 402                                            │ │
│ │ 'duplicate_purchase'   → 409                                            │ │
│ │ default                → 400                                            │ │
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

| File                          | Used By Endpoints                   | Reusable | Reasoning                         |
| ----------------------------- | ----------------------------------- | -------- | --------------------------------- |
| `PropPurchaseController.php`  | purchase, gift                      | ⭕       | Mixed - methods endpoint-specific |
| `PropPurchaseService.php`     | purchase, gift                      | ✅       | Core purchase/gift business logic |
| `PurchasePropRequest.php`     | purchase only                       | ❌       | Endpoint-specific                 |
| `PurchasePropDTO.php`         | purchase only                       | ❌       | Endpoint-specific                 |
| `PropPolicy.php`              | purchase, gift, view endpoints      | ✅       | Domain authorization              |
| `CoinDistributionService.php` | All economy operations              | ✅       | Core economy service              |
| `ActionResult.php`            | All service layer operations        | ✅       | Standard service return type      |
| `PropPurchased.php` (Event)   | purchase, gift (triggers listeners) | ✅       | Domain event                      |
| `ApiResponse.php`             | All API endpoints                   | ✅       | Global response utility           |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| `Unauthenticated.` | `auth:sanctum` | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source                | Condition                   |
| ------------------------------ | --------------------- | --------------------------- |
| `This action is unauthorized.` | `PurchasePropRequest` | Policy denies purchase      |
| VIP level insufficient         | `PropPolicy`          | User VIP < prop requirement |
| Prop unavailable               | `PropPolicy`          | `is_available = false`      |

### Business Logic Errors (400, 402, 409)

| Code  | Error Code             | Message                                   | Cause                           |
| ----- | ---------------------- | ----------------------------------------- | ------------------------------- |
| `400` | `prop_sold_out`        | This prop is sold out.                    | `inventory_count <= 0`          |
| `400` | `prop_not_available`   | Prop not available.                       | Outside availability window     |
| `402` | `insufficient_balance` | Insufficient balance.                     | User coins < prop price         |
| `409` | `duplicate_purchase`   | This purchase has already been processed. | Idempotency key exists in cache |

### System Errors (500)

| Error                | Source          | Condition                  |
| -------------------- | --------------- | -------------------------- |
| Database connection  | PostgreSQL      | Database unavailable       |
| Transaction deadlock | DB::transaction | Concurrent lock contention |
| Redis connection     | Cache           | Cache unavailable          |

### Edge Cases

| Case                               | Behavior                                       |
| ---------------------------------- | ---------------------------------------------- |
| Concurrent purchase of last item   | One succeeds, others get `prop_sold_out`       |
| Network retry with same request    | Idempotency key prevents duplicate             |
| Prop deactivated between check/buy | Service layer re-validates with lock           |
| User balance exactly equals price  | Purchase succeeds, balance becomes 0           |
| User balance 1 coin short          | 402 Insufficient balance                       |
| Purchase same prop twice (hourly)  | 409 Duplicate purchase (idempotency)           |
| Purchase same prop next hour       | Allowed - new idempotency key window           |
| VIP level changes mid-transaction  | Original check in policy; service re-validates |
| Prop price changes mid-transaction | Original price used (locked row)               |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT          MIDDLEWARE           REQUEST          CONTROLLER           SERVICE             DATABASE
   │                 │                    │                  │                  │                    │
   │ POST /props/42/purchase              │                  │                  │                    │
   │─────────────────▶                    │                  │                  │                    │
   │                 │                    │                  │                  │                    │
   │                 │ 1. auth:sanctum    │                  │                  │                    │
   │                 │ 2. throttle:prop_purchase             │                  │                    │
   │                 │───────────────────▶│                  │                  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │ 3. authorize()   │                  │                    │
   │                 │                    │ (PropPolicy::purchase)              │                    │
   │                 │                    │─────────────────▶│                  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │        [IF 403 → Return Forbidden]  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │ 4. Inject Prop model               │                    │
   │                 │                    │─────────────────▶│                  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │ 5. Create DTO    │                    │
   │                 │                    │                  │ PurchasePropDTO  │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │ 6. purchaseService│                   │
   │                 │                    │                  │    ->purchase()  │                    │
   │                 │                    │                  │─────────────────▶│                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 7. Check           │
   │                 │                    │                  │                  │ idempotency        │
   │                 │                    │                  │                  │ (Cache::has)       │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 8. BEGIN TXN       │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 9. lockForUpdate   │
   │                 │                    │                  │                  │    prop            │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 10. Validate       │
   │                 │                    │                  │                  │     availability   │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 11. deductFromUser │
   │                 │                    │                  │                  │     (coins)        │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 12. decrement      │
   │                 │                    │                  │                  │     Inventory      │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 13. Create         │
   │                 │                    │                  │                  │     UserProp       │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 14. Create         │
   │                 │                    │                  │                  │     Transaction    │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 15. COMMIT TXN     │
   │                 │                    │                  │                  │───────────────────▶│
   │                 │                    │                  │                  │◀───────────────────│
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 16. Cache::put     │
   │                 │                    │                  │                  │ (idempotency)      │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │                  │ 17. event(         │
   │                 │                    │                  │                  │  PropPurchased)    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │◀─────────────────│                    │
   │                 │                    │                  │ ActionResult     │                    │
   │                 │                    │                  │                  │                    │
   │                 │                    │                  │ 18. ApiResponse  │                    │
   │                 │                    │                  │     ::success()  │                    │
   │                 │◀───────────────────│                  │                  │                    │
   │◀────────────────│                    │                  │                  │                    │
   │                 │                    │                  │                  │                    │
   │  201 Created    │                    │                  │                  │                    │
   │  + JSON Body    │                    │                  │                  │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location                                          |
| ---------------------- | ------------------------------------------------- |
| Gift wrapping option   | Add field to DTO; handle in service               |
| Discount codes         | Add to request; validate in service before deduct |
| Purchase notifications | Add listener to PropPurchased event               |
| Purchase history API   | New controller method; query transactions table   |
| Bulk purchase          | New endpoint; loop in service with same logic     |

### 📝 Field Modification Guide

#### ➕ ADDING A RESPONSE FIELD

| Step  | File                         | What to Change                      |
| ----- | ---------------------------- | ----------------------------------- |
| **1** | `PropPurchaseController.php` | Add field to success response array |
| **2** | Update API documentation     | Document new field                  |

#### ➕ ADDING A REQUEST FIELD

| Step  | File                      | What to Change                        |
| ----- | ------------------------- | ------------------------------------- |
| **1** | `PurchasePropRequest.php` | Add validation rule                   |
| **2** | `PurchasePropDTO.php`     | Add property and update fromValidated |
| **3** | `PropPurchaseService.php` | Handle new field in purchase logic    |

#### 🔄 CHANGING ERROR CODES

| Step  | File                         | What to Change                     |
| ----- | ---------------------------- | ---------------------------------- |
| **1** | `PropPurchaseService.php`    | Update exception/error code        |
| **2** | `PropPurchaseController.php` | Update httpStatusFromErrorCode map |

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                         |
| ------------------------- | -------------------------------------------------------------- |
| Transaction boundary      | Must encompass all state changes (balance, inventory, records) |
| `lockForUpdate()` on prop | Prevents race conditions; never remove                         |
| Idempotency key format    | Clients may rely on pattern; coordinate changes                |
| Error code strings        | Mobile clients parse these for UI                              |
| `ActionResult` pattern    | Service layer contract; affects all callers                    |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                |
| ------------------------------------------ | ----------------------------------------- |
| Removing transaction wrapper               | All 7 DB operations must be atomic        |
| Checking balance before locking prop       | Race condition; always lock first         |
| Caching user balance                       | Balance changes frequently; never cache   |
| Hard-coding idempotency TTL                | Extract to config; 1 hour may need tuning |
| Returning 200 instead of 201               | Purchase creates resource; must be 201    |
| Forgetting to dispatch PropPurchased event | Cache invalidation breaks                 |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 40-42)
app/Http/Controllers/Api/V1/Prop/
  └── PropPurchaseController.php                     ← Controller (purchase method, lines 28-52)
app/Http/Requests/Prop/
  └── PurchasePropRequest.php                        ← Form Request with policy auth
app/Policies/Prop/
  └── PropPolicy.php                                 ← Authorization policy (purchase method)
app/Services/Prop/
  └── PropPurchaseService.php                        ← Service (purchase method, lines 35-169)
app/DTOs/Prop/
  └── PurchasePropDTO.php                            ← Data transfer object
app/Services/Economy/
  └── CoinDistributionService.php                    ← Balance deduction
app/Events/Prop/
  └── PropPurchased.php                              ← Domain event
app/Actions/
  └── ActionResult.php                               ← Service result wrapper
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
```

---

## 8. MSAB Realtime Event Contracts

### PropPurchased Event

This endpoint dispatches `PropPurchased` event after successful purchase. Listeners may emit MSAB events.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Event: PropPurchased                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Events/Prop/PropPurchased.php                                     │
│ Dispatched: After successful purchase (outside transaction)                 │
│                                                                             │
│ Payload:                                                                    │
│   • userId: int       - Purchasing user's ID                                │
│   • propId: int       - Purchased prop's ID                                 │
│   • userPropId: int   - Created UserProp record ID                          │
│                                                                             │
│ Listeners may emit:                                                         │
│   • MSAB balance update notification                                        │
│   • MSAB prop inventory notification                                        │
│   • Cache invalidation for user props                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `POST /api/v1/props/{prop}/purchase` |
| **Domain**          | Prop                                 |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-05                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4                                  |
