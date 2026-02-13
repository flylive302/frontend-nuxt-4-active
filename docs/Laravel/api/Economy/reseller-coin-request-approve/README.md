# POST /api/v1/reseller/coin-requests/{id}/approve

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

This endpoint allows a reseller (or Super Admin) to approve a pending coin request, triggering an atomic coin/diamond transfer from the reseller's balance to the requesting user's balance. The approval can be either "cash" (immediate payment received) or "credit" (coins lent with repayment due later).

### Responsibilities

- Authorize the reseller can approve this specific coin request
- Validate approval type (cash/credit) and optional fields
- Execute atomic balance transfer using SERIALIZABLE isolation
- Create transaction records with balance snapshots
- Update coin request status and metadata
- Emit real-time balance update events via WebSocket

### What It Owns

| Owned               | Description                                    |
| ------------------- | ---------------------------------------------- |
| Coin request status | Updates status to `approved`                   |
| Balance transfer    | Transfers coins/diamonds from provider to user |
| Transaction record  | Creates audit trail with balance snapshots     |

### External Dependencies

| Dependency       | Type           | Purpose                                       |
| ---------------- | -------------- | --------------------------------------------- |
| PostgreSQL       | Database       | Coin request, user balances, transaction data |
| MSABEventService | Infrastructure | WebSocket balance update events               |
| Redis            | Cache          | Event queue (for socket emissions)            |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/reseller/coin-requests/{id}/approve
```

### Authentication

✅ **Required** - Bearer token via `auth:sanctum` middleware

### Rate Limiting

| Limiter             | Key         | Config                      |
| ------------------- | ----------- | --------------------------- |
| Default API Limiter | `user:{id}` | `config('rate-limits.api')` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type  | Description                         |
| --------- | ----- | ----------------------------------- |
| `id`      | `int` | Coin request ID (route-model bound) |

### Request Body Schema

```json
{
  "type": "string", // Required: "cash" or "credit"
  "approved_amount": "number|null", // Optional: Override requested amount (min: 1)
  "credit_days": "integer|null", // Required if type=credit (min: 1)
  "admin_note": "string|null" // Optional: Admin note (max: 1000 chars)
}
```

#### Field Details

| Field             | Type      | Constraints                      | Example      |
| ----------------- | --------- | -------------------------------- | ------------ |
| `type`            | `string`  | Required, `in:cash,credit`       | `"cash"`     |
| `approved_amount` | `numeric` | Optional, `min:1`                | `500`        |
| `credit_days`     | `integer` | Required if type=credit, `min:1` | `7`          |
| `admin_note`      | `string`  | Optional, `max:1000`             | `"Approved"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin request approved successfully",
  "data": {
    "id": 123,
    "user": {
      "id": 456,
      "name": "John Doe",
      "avatar": "https://..."
    },
    "reseller": {
      "id": 789,
      "name": "Reseller Name",
      "avatar": "https://..."
    },
    "amount": "1000",
    "approved_amount": "1000",
    "final_amount": 1000,
    "was_adjusted": false,
    "type": {
      "value": "cash",
      "label": "Cash"
    },
    "status": {
      "value": "approved",
      "label": "Approved",
      "color": "success",
      "is_final": true
    },
    "message": "Please send coins",
    "admin_note": "Approved by reseller",
    "proofs": [],
    "credit_days": null,
    "is_repaid": false,
    "repaid_at": null,
    "is_repayment_due": false,
    "processor": {
      "id": 789,
      "name": "Reseller Name"
    },
    "processed_at": "2026-02-02T14:27:04.000000Z",
    "expires_at": "2026-02-03T14:27:04.000000Z",
    "created_at": "2026-02-02T12:00:00.000000Z",
    "updated_at": "2026-02-02T14:27:04.000000Z"
  },
  "meta": {
    "final_amount": 1000,
    "type": "cash",
    "asset_type": "coins",
    "provider_new_balance": 9000,
    "beneficiary_new_balance": 1500,
    "timestamp": "2026-02-02T14:27:04.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "type": ["Please select an approval type (cash or credit)."],
    "credit_days": ["Credit days are required for credit approvals."]
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "Insufficient balance to approve this request",
  "data": null,
  "errors": {
    "balance": ["Insufficient balance to approve this request"]
  }
}
```

#### ❌ Already Processed Error (422)

```json
{
  "status": "error",
  "message": "Request cannot be processed",
  "data": null,
  "errors": {
    "status": ["This request has already been processed"]
  }
}
```

### HTTP Status Codes

| Code  | Condition                                      |
| ----- | ---------------------------------------------- |
| `200` | Coin request approved successfully             |
| `403` | Unauthorized (not target reseller/super admin) |
| `404` | Coin request not found                         |
| `422` | Validation failed or business rule violation   |
| `500` | Server error during processing                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│             POST /api/v1/reseller/coin-requests/{id}/approve                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:34                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{coinRequest}/approve',                                   │ │
│ │     [ResellerCoinRequestController::class, 'approve']);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Sanctum token                   │
│   2. Route Model Binding → Resolves {coinRequest} to CoinRequest model      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED - FormRequest Validation                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/CoinRequest/ApproveCoinRequestRequest.php    │
│                                                                             │
│ Validates the request body against defined rules.                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                        │ │
│ │     return [                                                             │ │
│ │         'type' => ['required', 'string', Rule::in(['cash', 'credit'])], │ │
│ │         'approved_amount' => ['nullable', 'numeric', 'min:1'],          │ │
│ │         'credit_days' => ['required_if:type,credit', 'nullable',        │ │
│ │                           'integer', 'min:1'],                          │ │
│ │         'admin_note' => ['nullable', 'string', 'max:1000'],             │ │
│ │     ];                                                                   │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If validation fails → 422 response with field errors (request stops)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│ Method: approve(ApproveCoinRequestRequest $request, CoinRequest $coinRequest)│
│ Lines: 72-98                                                                │
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('approve', $coinRequest);                              │ │
│ │ // Calls CoinRequestPolicy::approve() - throws 403 if unauthorized      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Create DTO from validated data                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = ApproveCoinRequestDTO::fromArray($request->validated());         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute action (delegate to ApproveCoinRequestAction)               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->approveAction->execute($coinRequest, $dto, $user);     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return response based on ActionResult                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->message ?? 'Failed to approve coin request',           │ │
│ │         $result->errors, 422                                            │ │
│ │     );                                                                   │ │
│ │ }                                                                        │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new CoinRequestResource($result->data),                             │ │
│ │     $result->message ?? 'Coin request approved successfully',           │ │
│ │     $result->meta                                                       │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 AUTHORIZATION (Policy)                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Economy/CoinRequestPolicy.php:62-79                      │
│ Method: approve(User $user, CoinRequest $coinRequest)                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function approve(User $user, CoinRequest $coinRequest): bool     │ │
│ │ {                                                                        │ │
│ │     if (! $coinRequest->canBeProcessed()) {                             │ │
│ │         return false;  // Already processed                              │ │
│ │     }                                                                    │ │
│ │                                                                          │ │
│ │     // For reseller→super_admin requests, only Super Admin can approve  │ │
│ │     if ($coinRequest->request_level === CoinRequestLevel::RESELLER_...) │ │
│ │         return $user->hasRole('Super Admin');                           │ │
│ │     }                                                                    │ │
│ │                                                                          │ │
│ │     // For user→reseller requests, target reseller or SuperAdmin        │ │
│ │     $isTargetReseller = $user->id === $coinRequest->reseller_id;        │ │
│ │     $isSuperAdmin = $user->hasRole('Super Admin');                      │ │
│ │                                                                          │ │
│ │     return ($isTargetReseller && $user->hasAnyRole(['Reseller', ...]))  │ │
│ │            || $isSuperAdmin;                                             │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA TRANSFER OBJECT                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/DTOs/CoinRequest/ApproveCoinRequestDTO.php                        │
│                                                                             │
│ COMPONENT: ApproveCoinRequestDTO (Data Transfer Object)                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Responsibility: Encapsulate approval data with type safety              │ │
│ │ Reusable: YES (used by API and Filament admin panel)                    │ │
│ │ Why It Exists: Decouples request validation from business logic         │ │
│ │                                                                          │ │
│ │ Properties:                                                              │ │
│ │   • type: CoinRequestType (CASH or CREDIT enum)                         │ │
│ │   • approvedAmount: ?string                                             │ │
│ │   • creditDays: ?int                                                    │ │
│ │   • adminNote: ?string                                                  │ │
│ │                                                                          │ │
│ │ Key Methods:                                                             │ │
│ │   • fromArray($data) → Creates DTO from validated request               │ │
│ │   • isCredit() → Returns true if type is CREDIT                         │ │
│ │   • isCash() → Returns true if type is CASH                             │ │
│ │   • toModelArray() → Prepares data for model update                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SERVICE LAYER FLOW - Action Class                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/CoinRequest/ApproveCoinRequestAction.php                  │
│ Method: execute(CoinRequest $coinRequest, ApproveCoinRequestDTO $dto,       │
│                 User $approver)                                             │
│                                                                             │
│ STEP 1: Validate request can be processed                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $coinRequest->canBeProcessed()) {                                 │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errors: ['status' => ['This request has already been processed']]│ │
│ │     );                                                                   │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Calculate final amount                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $finalAmount = (int) ($dto->approvedAmount ?? $coinRequest->amount);    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Determine provider and beneficiary                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $isResellerToSuperAdmin = $coinRequest->isResellerRequest();            │ │
│ │ $providerId = $isResellerToSuperAdmin ? $approver->id                   │ │
│ │                                       : $coinRequest->reseller_id;      │ │
│ │ $beneficiaryId = $coinRequest->user_id;                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Execute transfer via CoinDistributionService                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $isCoinTransaction = $coinRequest->asset_type->value === 'coins';       │ │
│ │ $transferResult = $isCoinTransaction                                    │ │
│ │     ? $this->coinService->transferCoins($providerId, $beneficiaryId,    │ │
│ │                                          $finalAmount)                  │ │
│ │     : $this->coinService->transferDiamonds($providerId, $beneficiaryId, │ │
│ │                                            $finalAmount);               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Create transaction record with balance snapshots                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Transaction::create([                                                   │ │
│ │     'user_id' => $transferResult['sender']['user_id'],                  │ │
│ │     'beneficiary_id' => $transferResult['receiver']['user_id'],         │ │
│ │     'type' => Transaction::TYPE_COIN_TRANSFER,                          │ │
│ │     'currency' => $coinRequest->asset_type->value,                      │ │
│ │     'amount' => -(float) $finalAmount,                                  │ │
│ │     'initiator_coin_balance_before' => ...,                             │ │
│ │     'initiator_coin_balance_after' => ...,                              │ │
│ │     'beneficiary_coin_balance_before' => ...,                           │ │
│ │     'beneficiary_coin_balance_after' => ...,                            │ │
│ │     'transactionable_type' => CoinRequest::class,                       │ │
│ │     'transactionable_id' => $coinRequest->id,                           │ │
│ │     'status' => Transaction::STATUS_COMPLETED,                          │ │
│ │     ...                                                                  │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Update coin request status                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->update([                                                  │ │
│ │     'status' => CoinRequestStatus::APPROVED,                            │ │
│ │     'type' => $dto->type,                                               │ │
│ │     'admin_note' => $dto->adminNote,                                    │ │
│ │     'processed_by' => $approver->id,                                    │ │
│ │     'processed_at' => now(),                                            │ │
│ │     'approved_amount' => $dto->approvedAmount,  // if provided          │ │
│ │     'credit_days' => $dto->creditDays,          // if credit type       │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Emit WebSocket balance update events                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $msabEventService = app(MSABEventService::class);                       │ │
│ │ $msabEventService->emitBalanceUpdated($provider);                       │ │
│ │ $msabEventService->emitBalanceUpdated($beneficiary);                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 COIN DISTRIBUTION SERVICE - Atomic Transfer                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Economy/CoinDistributionService.php:228-303              │
│ Method: transferCoins(int $senderId, int $receiverId, int $amount)          │
│                                                                             │
│ COMPONENT: CoinDistributionService (Service)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Responsibility: Canonical service for ALL coin/diamond balance mutations│ │
│ │ Reusable: YES - used by coin requests, gifts, exchanges, admin actions  │ │
│ │ Why It Exists: Single source of truth for financial operations          │ │
│ │                                                                          │ │
│ │ Key Features:                                                            │ │
│ │   • SERIALIZABLE transaction isolation                                   │ │
│ │   • lockForUpdate() to prevent race conditions                          │ │
│ │   • Returns balance snapshots (before/after) for audit                  │ │
│ │   • Consistent lock ordering prevents deadlocks                         │ │
│ │                                                                          │ │
│ │ Transfer Flow:                                                           │ │
│ │   1. setSerializableIsolation() - Set DB isolation level                │ │
│ │   2. DB::transaction() wrapper                                          │ │
│ │   3. Lock sender with lockForUpdate()                                   │ │
│ │   4. Lock receiver with lockForUpdate()                                 │ │
│ │   5. Validate sender has sufficient balance                             │ │
│ │   6. Deduct from sender, add to receiver                                │ │
│ │   7. Return balance snapshots                                           │ │
│ │   8. resetIsolation() in finally block                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT (Route Model Binding): Load CoinRequest                           │
│    Query: SELECT * FROM coin_requests WHERE id = ? AND deleted_at IS NULL   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT (Lock Sender): Get and lock provider user                         │
│    Query: SELECT * FROM users WHERE id = ? FOR UPDATE                       │
│    Source: CoinDistributionService::transferCoins()                         │
│                                                                             │
│ 3. SELECT (Lock Receiver): Get and lock beneficiary user                    │
│    Query: SELECT * FROM users WHERE id = ? FOR UPDATE                       │
│    Source: CoinDistributionService::transferCoins()                         │
│                                                                             │
│ 4. UPDATE (Sender Balance): Deduct coins/diamonds                           │
│    Query: UPDATE users SET coins = ? WHERE id = ?                           │
│    Source: CoinDistributionService::transferCoins()                         │
│                                                                             │
│ 5. UPDATE (Receiver Balance): Add coins/diamonds                            │
│    Query: UPDATE users SET coins = ? WHERE id = ?                           │
│    Source: CoinDistributionService::transferCoins()                         │
│                                                                             │
│ 6. INSERT (Transaction): Create audit record                                │
│    Query: INSERT INTO transactions (...)                                    │
│    Source: ApproveCoinRequestAction::execute()                              │
│                                                                             │
│ 7. UPDATE (Coin Request): Update status and metadata                        │
│    Query: UPDATE coin_requests SET status = ?, type = ?, ... WHERE id = ?   │
│    Source: ApproveCoinRequestAction::execute()                              │
│                                                                             │
│ 8. SELECT (Refresh): Reload coin request with relationships                 │
│    Query: SELECT * FROM coin_requests WHERE id = ?                          │
│           + SELECT users WHERE id IN (?, ?, ?) [eager load]                 │
│    Source: ApproveCoinRequestAction::execute()                              │
│                                                                             │
│ WEBSOCKET EVENTS:                                                           │
│                                                                             │
│ 1. balance.updated → Emitted to provider user's channel                     │
│ 2. balance.updated → Emitted to beneficiary user's channel                  │
│    Source: MSABEventService::emitBalanceUpdated()                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.9 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Economy/CoinRequestResource.php                 │
│                                                                             │
│ COMPONENT: CoinRequestResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Responsibility: Transform CoinRequest model to API response format      │ │
│ │ Reusable: YES - used by all coin request endpoints                      │ │
│ │                                                                          │ │
│ │ Response Structure:                                                      │ │
│ │   • id, user, reseller (nested objects with id/name/avatar)             │ │
│ │   • amount, approved_amount, final_amount, was_adjusted                 │ │
│ │   • type (value + label)                                                │ │
│ │   • status (value + label + color + is_final)                           │ │
│ │   • credit fields (credit_days, is_repaid, repaid_at, is_repayment_due) │ │
│ │   • processor (if processed), processed_at, expires_at                  │ │
│ │   • timestamps (created_at, updated_at)                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Wrapped by ApiResponse::success() with meta containing:                     │
│   • final_amount, type, asset_type                                          │
│   • provider_new_balance, beneficiary_new_balance                           │
│   • timestamp, correlation_id                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         200 + JSON Body                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                            | Used By Endpoints                  | Reusable | Reasoning                          |
| ------------------------------- | ---------------------------------- | -------- | ---------------------------------- |
| `ApproveCoinRequestRequest.php` | This endpoint only                 | ❌       | Endpoint-specific validation rules |
| `ApproveCoinRequestDTO.php`     | Approve endpoint, Filament admin   | ⭕       | Shared with admin panel            |
| `ApproveCoinRequestAction.php`  | Approve endpoint, Filament admin   | ⭕       | Business logic reused in admin     |
| `CoinRequestPolicy.php`         | All coin request endpoints         | ✅       | Centralized authorization          |
| `CoinDistributionService.php`   | Gifts, exchanges, admin, approvals | ✅       | Canonical balance mutation service |
| `CoinRequestResource.php`       | All coin request endpoints         | ✅       | Standard coin request response     |
| `CoinRequest.php`               | All coin request operations        | ✅       | Eloquent model                     |
| `ActionResult.php`              | All action classes                 | ✅       | Standard action result pattern     |
| `MSABEventService.php`          | Balance-related events             | ✅       | WebSocket event emitter            |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                     | Source                      | Condition                      |
| ------------------------- | --------------------------- | ------------------------------ |
| `type.required`           | `ApproveCoinRequestRequest` | Missing `type` field           |
| `type.in`                 | `ApproveCoinRequestRequest` | Type not `cash` or `credit`    |
| `approved_amount.min`     | `ApproveCoinRequestRequest` | Amount < 1                     |
| `credit_days.required_if` | `ApproveCoinRequestRequest` | Type=credit but no credit_days |
| `credit_days.min`         | `ApproveCoinRequestRequest` | credit_days < 1                |
| `admin_note.max`          | `ApproveCoinRequestRequest` | Note > 1000 characters         |

### Authorization Errors (403)

| Error                         | Source                       | Condition                                            |
| ----------------------------- | ---------------------------- | ---------------------------------------------------- |
| `This action is unauthorized` | `CoinRequestPolicy::approve` | User is not target reseller or Super Admin           |
| `This action is unauthorized` | `CoinRequestPolicy::approve` | Request already processed (not pending)              |
| `This action is unauthorized` | `CoinRequestPolicy::approve` | Reseller→SuperAdmin request but user not Super Admin |

### Business Logic Errors (422)

| Error                         | Source                     | Condition                             |
| ----------------------------- | -------------------------- | ------------------------------------- |
| `Request cannot be processed` | `ApproveCoinRequestAction` | Status is not `pending`               |
| `Insufficient balance`        | `CoinDistributionService`  | Provider's balance < requested amount |
| `User not found`              | `CoinDistributionService`  | Provider or beneficiary user deleted  |

### System Errors (500)

| Error               | Source                     | Condition                     |
| ------------------- | -------------------------- | ----------------------------- |
| Database error      | `CoinDistributionService`  | Transaction deadlock/rollback |
| `An error occurred` | `ApproveCoinRequestAction` | Uncaught exception in action  |

### Edge Cases

| Case                         | Behavior                                               |
| ---------------------------- | ------------------------------------------------------ |
| `approved_amount` > original | Approved; reseller decides final amount                |
| `approved_amount` < original | Approved; was_adjusted=true in response                |
| `approved_amount` = null     | Uses original requested amount                         |
| Diamond request              | Uses `transferDiamonds()` instead of `transferCoins()` |
| Reseller→SuperAdmin request  | Provider = SuperAdmin (approver), not reseller_id      |
| Credit approval              | Stores credit_days; is_repaid=false initially          |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER              ACTION                  SERVICE                 DATABASE
   │                       │                       │                       │                       │                       │
   │  POST /reseller/coin-requests/{id}/approve    │                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │                       │
   │                       │   (verify token)      │                       │                       │                       │
   │                       │───────────────────────────────────────────────────────────────────────▶│ SELECT users (auth)   │
   │                       │◀───────────────────────────────────────────────────────────────────────│                       │
   │                       │                       │                       │                       │                       │
   │                       │ 2. Route Model Bind   │                       │                       │                       │
   │                       │───────────────────────────────────────────────────────────────────────▶│ SELECT coin_requests  │
   │                       │◀───────────────────────────────────────────────────────────────────────│                       │
   │                       │                       │                       │                       │                       │
   │                       │ 3. FormRequest        │                       │                       │                       │
   │                       │──────────────────────▶│                       │                       │                       │
   │                       │   (validate body)     │                       │                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │ 4. authorize('approve')                       │                       │
   │                       │                       │   (Policy check)      │                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │ 5. Create DTO         │                       │                       │
   │                       │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │ 6. action->execute()  │                       │                       │
   │                       │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 7. Validate pending   │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 8. Calculate amount   │                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 9. transferCoins()    │                       │
   │                       │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 10. SET SERIALIZABLE  │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 11. SELECT FOR UPDATE │
   │                       │                       │                       │                       │   (lock sender)       │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 12. SELECT FOR UPDATE │
   │                       │                       │                       │                       │   (lock receiver)     │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 13. UPDATE sender     │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │                       │ 14. UPDATE receiver   │
   │                       │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │◀──────────────────────│ (snapshots returned)  │
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 15. INSERT transaction│                       │
   │                       │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 16. UPDATE coin_request                       │
   │                       │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 17. SELECT (refresh)  │                       │
   │                       │                       │                       │──────────────────────────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────────────────────────│
   │                       │                       │                       │                       │                       │
   │                       │                       │                       │ 18. Emit balance events (WebSocket)           │
   │                       │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│ (ActionResult)        │                       │
   │                       │                       │                       │                       │                       │
   │                       │◀──────────────────────│ (Transform Resource)  │                       │                       │
   │                       │                       │                       │                       │                       │
   │◀──────────────────────│                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │
   │  200 + JSON           │                       │                       │                       │                       │
   │                       │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location                                                   |
| ------------------------ | ---------------------------------------------------------- |
| New validation rule      | `ApproveCoinRequestRequest::rules()`                       |
| New approval field       | `ApproveCoinRequestDTO`, then `ApproveCoinRequestAction`   |
| New response field       | `CoinRequestResource::toArray()`                           |
| New authorization rule   | `CoinRequestPolicy::approve()`                             |
| New post-approval action | `ApproveCoinRequestAction::execute()` after step 7         |
| Notification on approval | `ApproveCoinRequestAction::execute()` after balance events |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `bonus_amount`)

| Step  | File                                                                 | What to Change                                |
| ----- | -------------------------------------------------------------------- | --------------------------------------------- |
| **1** | **Database Migration**                                               | Add column to `coin_requests`                 |
| **2** | `app/Models/Economy/CoinRequest.php`                                 | Add to `$fillable`, add to `$casts` if needed |
| **3** | `app/Http/Requests/Api/V1/CoinRequest/ApproveCoinRequestRequest.php` | Add validation rule                           |
| **4** | `app/DTOs/CoinRequest/ApproveCoinRequestDTO.php`                     | Add property + update `fromArray()`           |
| **5** | `app/Actions/CoinRequest/ApproveCoinRequestAction.php`               | Pass to `$updateData` array                   |
| **6** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`              | Add to response array                         |

#### ➖ REMOVING A FIELD

| Step  | File                                                                 | What to Change                  |
| ----- | -------------------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Requests/Api/V1/CoinRequest/ApproveCoinRequestRequest.php` | Remove validation rule          |
| **2** | `app/DTOs/CoinRequest/ApproveCoinRequestDTO.php`                     | Remove property + `fromArray()` |
| **3** | `app/Actions/CoinRequest/ApproveCoinRequestAction.php`               | Remove from `$updateData`       |
| **4** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`              | Remove from response            |
| **5** | **Database Migration**                                               | Drop column (if safe)           |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FIELD DEPENDENCY FLOW                                │
│──────────────────────────────────────────────────────────────────────────────│
│                                                                              │
│  Request Body Field                                                          │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ApproveCoinRequestRequest::rules()                                    │   │
│  │   Validates: type, approved_amount, credit_days, admin_note          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │ $request->validated()                                               │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ApproveCoinRequestDTO::fromArray()                                    │   │
│  │   Maps: type→enum, approved_amount, credit_days, admin_note          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ApproveCoinRequestAction::execute()                                   │   │
│  │   Uses: $dto->type, $dto->approvedAmount, $dto->creditDays,          │   │
│  │         $dto->adminNote                                               │   │
│  │   Calls: CoinDistributionService::transferCoins/Diamonds()           │   │
│  │   Updates: CoinRequest model with approval data                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ CoinRequest Model (Database)                                          │   │
│  │   Stored: status, type, approved_amount, credit_days, admin_note,    │   │
│  │           processed_by, processed_at                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ CoinRequestResource::toArray()                                        │   │
│  │   Transforms all fields to API response format                        │   │
│  │   Adds computed: final_amount, was_adjusted, is_repayment_due        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `CoinDistributionService`      | Financial operations require careful testing; uses SERIALIZABLE isolation for atomicity |
| `CoinRequestPolicy::approve()` | Security-critical authorization logic; affects who can approve                          |
| Transaction creation in action | Audit trail must capture accurate balance snapshots                                     |
| Lock ordering in transfer      | Sender locked before receiver to prevent deadlocks                                      |
| Balance update flow            | Must remain atomic to prevent race conditions                                           |

### 🚨 Common Pitfalls

| Pitfall                          | Prevention                                                    |
| -------------------------------- | ------------------------------------------------------------- |
| Calling transfer outside service | Always use `CoinDistributionService` for balance mutations    |
| Forgetting to update DTO         | When adding fields, update `fromArray()` and constructor      |
| Missing Filament sync            | `ApproveCoinRequestDTO` is shared - update both API and admin |
| Skipping balance validation      | Service throws `InsufficientBalanceException` - don't bypass  |
| Modifying balances directly      | Never use `User::update(['coins' => ...])` - use service      |
| Ignoring transaction snapshots   | Always capture before/after balances for Transaction record   |
| Credit without credit_days       | DTO validates this; don't remove the check                    |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                           ← Route definition (line 34)
app/Http/Controllers/Api/V1/Economy/
  └── ResellerCoinRequestController.php                ← Controller (approve method)
app/Http/Requests/Api/V1/CoinRequest/
  └── ApproveCoinRequestRequest.php                    ← Request validation
app/DTOs/CoinRequest/
  └── ApproveCoinRequestDTO.php                        ← Data transfer object
app/Actions/CoinRequest/
  └── ApproveCoinRequestAction.php                     ← Business logic action
app/Services/Economy/
  └── CoinDistributionService.php                      ← Atomic balance mutations
app/Policies/Economy/
  └── CoinRequestPolicy.php                            ← Authorization policy
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                          ← Response transformer
app/Models/Economy/
  └── CoinRequest.php                                  ← Eloquent model
  └── Transaction.php                                  ← Transaction audit model
app/Enums/Economy/
  └── CoinRequestType.php                              ← CASH/CREDIT enum
  └── CoinRequestStatus.php                            ← Status enum
  └── CoinRequestLevel.php                             ← Request level enum
app/Actions/
  └── ActionResult.php                                 ← Standard result wrapper
app/Services/Gift/
  └── MSABEventService.php                             ← WebSocket event emitter
```

---

## Document Metadata

| Property            | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/reseller/coin-requests/{id}/approve` |
| **Domain**          | Economy                                            |
| **Author**          | System Documentation                               |
| **Created**         | 2026-02-02                                         |
| **Laravel Version** | 12.x                                               |
| **PHP Version**     | 8.4                                                |
