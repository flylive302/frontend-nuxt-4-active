# POST /api/v1/coin-requests

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Coin Request creation endpoint allows authenticated users to submit requests for virtual coins to their assigned reseller. Users can optionally attach proof images (pre-uploaded to ImageKit) to verify their payment.

### Responsibilities

- Validate user input (amount, reseller, proofs)
- Resolve reseller (explicit or user's default)
- Prevent duplicate pending requests to the same reseller
- Create coin request with calculated expiration
- Determine request level based on user role (user→reseller or reseller→super_admin)

### What It Owns

| Owned                | Description                                |
| -------------------- | ------------------------------------------ |
| CoinRequest creation | Creates new `coin_requests` records        |
| Request validation   | Validates business rules before creation   |
| Expiration logic     | Calculates auto-expiration based on config |

### External Dependencies

| Dependency | Type           | Purpose                                          |
| ---------- | -------------- | ------------------------------------------------ |
| Database   | Infrastructure | Stores coin request records                      |
| ImageKit   | Package        | CDN for proof image URL validation               |
| Config     | Infrastructure | Expiration settings (`coin-requests.expiration`) |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/coin-requests/coin-requests
```

### Authentication

✅ **Required** - Sanctum Bearer Token

### Rate Limiting

| Limiter  | Key      | Config                           |
| -------- | -------- | -------------------------------- |
| throttle | user:api | `config('api.throttle.default')` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "reseller_id": "integer|null", // Optional, uses user's default if not provided
  "amount": "numeric", // Required, min: 1
  "message": "string|null", // Optional, max: 1000 characters
  "proofs": [
    // Optional, max: 3 items
    {
      "url": "string", // Required, ImageKit CDN URL
      "file_id": "string" // Required, ImageKit file ID
    }
  ]
}
```

#### Field Details

| Field              | Type      | Constraints                               | Example                                  |
| ------------------ | --------- | ----------------------------------------- | ---------------------------------------- |
| `reseller_id`      | `integer` | Optional, must exist in `users`, not self | `42`                                     |
| `amount`           | `numeric` | Required, min: 1                          | `100.50`                                 |
| `message`          | `string`  | Optional, max: 1000 chars                 | `"Payment sent via bank transfer"`       |
| `proofs`           | `array`   | Optional, max: 3 items                    | See below                                |
| `proofs.*.url`     | `string`  | Required per proof, valid ImageKit URL    | `"https://ik.imagekit.io/.../proof.jpg"` |
| `proofs.*.file_id` | `string`  | Required per proof, max: 100 chars        | `"6123abc456def"`                        |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Coin request created successfully",
  "data": {
    "id": 123,
    "user": {
      "id": 1,
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "reseller": {
      "id": 42,
      "name": "Jane Reseller",
      "avatar": "https://example.com/reseller-avatar.jpg"
    },
    "amount": "100.00",
    "approved_amount": null,
    "final_amount": "100.00",
    "was_adjusted": false,
    "type": {
      "value": "cash",
      "label": "Cash"
    },
    "status": {
      "value": "pending",
      "label": "Pending",
      "color": "warning",
      "is_final": false
    },
    "message": "Payment sent via bank transfer",
    "admin_note": null,
    "proofs": [
      {
        "url": "https://ik.imagekit.io/.../proof.jpg",
        "file_id": "6123abc456def"
      }
    ],
    "credit_days": null,
    "is_repaid": false,
    "repaid_at": null,
    "is_repayment_due": false,
    "processor": null,
    "processed_at": null,
    "expires_at": "2026-02-05T13:55:10.000000Z",
    "created_at": "2026-02-02T13:55:10.000000Z",
    "updated_at": "2026-02-02T13:55:10.000000Z"
  },
  "meta": {
    "coin_request_id": 123,
    "expires_at": "2026-02-05T13:55:10.000000Z",
    "timestamp": "2026-02-02T13:55:10.000000Z",
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
    "amount": ["Please enter the coin amount."],
    "reseller_id": ["The selected reseller does not exist."],
    "proofs.0.url": ["Proof images must be uploaded to our CDN."]
  }
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "Duplicate pending request",
  "data": null,
  "errors": {
    "reseller_id": ["You already have a pending request to this reseller"]
  }
}
```

#### ❌ No Default Reseller (422)

```json
{
  "status": "error",
  "message": "No reseller available",
  "data": null,
  "errors": {
    "reseller_id": ["No default reseller assigned. Please contact support."]
  }
}
```

### HTTP Status Codes

| Code  | Condition                                    |
| ----- | -------------------------------------------- |
| `201` | Coin request created successfully            |
| `401` | Missing or invalid authentication token      |
| `422` | Validation failed or business rule violation |
| `500` | Server error during creation                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/coin-requests/coin-requests                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api.php:29                                                     │
│ Route: require __DIR__ . '/api/coin-requests.php';                          │
│                                                                             │
│ File: routes/api/coin-requests.php:24                                       │
│ Route: Route::post('/', [CoinRequestController::class, 'store']);           │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Authenticates request via Sanctum token                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/CoinRequest/StoreCoinRequestRequest.php      │
│                                                                             │
│ Form Request validates:                                                     │
│   • reseller_id - optional, integer, exists in users, not self              │
│   • amount - required, numeric, min: 1                                      │
│   • message - optional, string, max: 1000                                   │
│   • proofs - optional array, max 3 items                                    │
│   • proofs.*.url - required per proof, valid ImageKit URL                   │
│   • proofs.*.file_id - required per proof, string, max 100                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $urlEndpoint = config('imagekit.url_endpoint');                         │ │
│ │ $urlPattern = '/^' . preg_quote($urlEndpoint, '/') . '\\//'             │ │
│ │                                                                          │ │
│ │ return [                                                                 │ │
│ │     'reseller_id' => ['nullable', 'integer', 'exists:users,id',         │ │
│ │         Rule::notIn([$this->user()?->id])],                              │ │
│ │     'amount' => ['required', 'numeric', 'min:1'],                       │ │
│ │     'message' => ['nullable', 'string', 'max:1000'],                    │ │
│ │     'proofs' => ['nullable', 'array', 'max:3'],                         │ │
│ │     'proofs.*.url' => ['required', 'url', 'regex:' . $urlPattern],      │ │
│ │     'proofs.*.file_id' => ['required', 'string', 'max:100'],            │ │
│ │ ];                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/CoinRequestController.php:54      │
│ Method: store(StoreCoinRequestRequest $request)                             │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Create DTO from validated data                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ $dto = CreateCoinRequestDTO::fromArray($validated);                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Extract proofs from validated data                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $proofs = $validated['proofs'] ?? null;                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Delegate to action and return response                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->createAction->execute($dto, $user, $proofs);           │ │
│ │                                                                          │ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error($result->message, $result->errors, 422);  │ │
│ │ }                                                                        │ │
│ │                                                                          │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new CoinRequestResource($result->data),                             │ │
│ │     $result->message, $result->meta, 201                                │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW (ACTION)                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/CoinRequest/CreateCoinRequestAction.php                   │
│ Method: execute(CreateCoinRequestDTO $dto, User $user, ?array $proofs)      │
│                                                                             │
│ STEP 1: Resolve reseller ID                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $resellerId = $dto->resellerId ?? $user->default_reseller_id;           │ │
│ │                                                                          │ │
│ │ if ($resellerId === null) {                                             │ │
│ │     return ActionResult::failure([                                      │ │
│ │         'reseller_id' => ['No default reseller assigned...']            │ │
│ │     ]);                                                                  │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate not self-request                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user->id === $resellerId) {                                        │ │
│ │     return ActionResult::failure([                                      │ │
│ │         'reseller_id' => ['You cannot request coins from yourself']     │ │
│ │     ]);                                                                  │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate reseller exists                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $reseller = User::find($resellerId);                                    │ │
│ │ if ($reseller === null) {                                               │ │
│ │     return ActionResult::failure(['reseller_id' => ['Reseller not found']]); │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Validate reseller role                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$reseller->hasAnyRole(['Reseller', 'Super Admin'])) {              │ │
│ │     return ActionResult::failure([                                      │ │
│ │         'reseller_id' => ['Selected user is not a reseller']            │ │
│ │     ]);                                                                  │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Check for existing pending request                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($this->repository->hasPendingRequest($user->id, $resellerId)) {     │ │
│ │     return ActionResult::failure([                                      │ │
│ │         'reseller_id' => ['You already have a pending request...']      │ │
│ │     ]);                                                                  │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6-8: DB Transaction - Create coin request (see 3.6)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CreateCoinRequestDTO (Data Transfer Object)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/CoinRequest/CreateCoinRequestDTO.php                     │ │
│ │ Responsibility: Transfer validated request data to action               │ │
│ │ Reusable: YES (can be used by any coin request creation logic)          │ │
│ │ Why It Exists: Type-safe data transfer, decouples HTTP from business    │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • resellerId: ?int - Target reseller (null = use default)             │ │
│ │   • amount: string - Requested coin amount                              │ │
│ │   • assetType: AssetType - Defaults to COINS                            │ │
│ │   • message: ?string - Optional user message                            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray() → Creates DTO from validated request array              │ │
│ │   • toArray() → Converts back to array format                           │ │
│ │   • toModelArray() → Array for model creation (filters nulls)           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestRepository (Repository Pattern)                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Repositories/CoinRequest/CoinRequestRepository.php            │ │
│ │ Responsibility: Database operations for coin requests                   │ │
│ │ Reusable: YES (shared across all coin request operations)               │ │
│ │ Why It Exists: Abstracts persistence logic from business rules          │ │
│ │                                                                         │ │
│ │ Key Methods Used:                                                       │ │
│ │   • hasPendingRequest($userId, $resellerId) → Duplicate check           │ │
│ │   • create($data) → Creates new CoinRequest model                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Encapsulates action outcomes (success/failure)          │ │
│ │ Reusable: YES (used by all action classes)                              │ │
│ │ Why It Exists: Type-safe result handling without exceptions             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta) → Success result                    │ │
│ │   • failure($errors, $message) → Failure result                         │ │
│ │   • isFailure() → Check if result is failure                            │ │
│ │   • fromException($e) → Convert exception to failure                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequest (Eloquent Model)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Economy/CoinRequest.php                                │ │
│ │ Responsibility: Represents coin request database record                 │ │
│ │ Reusable: YES (core model for entire coin request domain)               │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • user_id, reseller_id → Relationship IDs                             │ │
│ │   • request_level → CoinRequestLevel enum                               │ │
│ │   • amount, approved_amount → Decimal values                            │ │
│ │   • type → CoinRequestType enum (CASH/CREDIT)                           │ │
│ │   • status → CoinRequestStatus enum                                     │ │
│ │   • proofs → JSON array of proof images                                 │ │
│ │   • expires_at → Auto-expiration timestamp                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (within DB::transaction):                               │
│                                                                             │
│ 1. CHECK: Pending request exists                                            │
│    Query: SELECT EXISTS(SELECT 1 FROM coin_requests                         │
│                  WHERE user_id = ? AND reseller_id = ? AND status = 'pending')│
│    Source: CoinRequestRepository::hasPendingRequest()                       │
│                                                                             │
│ 2. READ: Fetch reseller user                                                │
│    Query: SELECT * FROM users WHERE id = ? LIMIT 1                          │
│    Source: User::find($resellerId)                                          │
│                                                                             │
│ 3. INSERT: Create coin request                                              │
│    Query: INSERT INTO coin_requests (user_id, reseller_id, request_level,   │
│                  amount, asset_type, message, type, status, expires_at,      │
│                  proofs, created_at, updated_at) VALUES (...)               │
│    Source: CoinRequestRepository::create()                                  │
│                                                                             │
│ 4. READ: Load relationships                                                 │
│    Query: SELECT id, name, avatar FROM users WHERE id IN (?, ?)             │
│    Source: $coinRequest->load(['user:id,name,avatar', 'reseller:...'])      │
│                                                                             │
│ CONFIG ACCESS:                                                              │
│                                                                             │
│ 1. GET: Expiration duration                                                 │
│    Key: coin-requests.expiration.duration_hours (default: 72)               │
│                                                                             │
│ 2. GET: Expiration enabled flag                                             │
│    Key: coin-requests.expiration.enabled (default: true)                    │
│                                                                             │
│ LOGGING:                                                                    │
│                                                                             │
│ 1. INFO: Log coin request creation with context                             │
│    Channel: default                                                         │
│    Data: coin_request_id, user_id, reseller_id, request_level, amount       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Economy/CoinRequestResource.php                 │
│                                                                             │
│ Transforms CoinRequest model to API response:                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $coinRequest->id,                                           │ │
│ │     'user' => [                                                         │ │
│ │         'id' => $coinRequest->user->id,                                 │ │
│ │         'name' => $coinRequest->user->name,                             │ │
│ │         'avatar' => $coinRequest->user->avatar,                         │ │
│ │     ],                                                                   │ │
│ │     'reseller' => [...],                                                │ │
│ │     'amount' => $coinRequest->amount,                                   │ │
│ │     'approved_amount' => $coinRequest->approved_amount,                 │ │
│ │     'final_amount' => $coinRequest->getFinalAmount(),                   │ │
│ │     'was_adjusted' => $coinRequest->wasAmountAdjusted(),                │ │
│ │     'type' => ['value' => ..., 'label' => ...],                         │ │
│ │     'status' => ['value' => ..., 'label' => ..., 'color' => ...,        │ │
│ │                  'is_final' => ...],                                     │ │
│ │     'message' => ...,                                                   │ │
│ │     'proofs' => $coinRequest->proofs,                                   │ │
│ │     'expires_at' => $coinRequest->expires_at?->toISOString(),           │ │
│ │     // ... additional fields                                            │ │
│ │ ];                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ApiResponse wraps with standard envelope:                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                        │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Coin request created successfully",                       │ │
│ │   "data": { /* CoinRequestResource output */ },                         │ │
│ │   "meta": { "coin_request_id": 123, "expires_at": "...", ... }          │ │
│ │ }                                                                        │ │
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

| File                                 | Used By Endpoints               | Reusable | Reasoning                                  |
| ------------------------------------ | ------------------------------- | -------- | ------------------------------------------ |
| `StoreCoinRequestRequest.php`        | POST coin-requests              | ❌       | Specific to this creation endpoint         |
| `CreateCoinRequestDTO.php`           | POST coin-requests, Admin panel | ✅       | Reusable DTO for any coin request creation |
| `CreateCoinRequestAction.php`        | POST coin-requests, Admin panel | ✅       | Encapsulates all creation business logic   |
| `CoinRequestRepository.php`          | All coin-request endpoints      | ✅       | Central repository for domain              |
| `CoinRequestRepositoryInterface.php` | All coin-request endpoints      | ✅       | Contract for dependency injection          |
| `CoinRequestResource.php`            | All coin-request API responses  | ✅       | Standard response transformer              |
| `CoinRequest.php` (Model)            | Entire Economy domain           | ✅       | Core domain model                          |
| `CoinRequestLevel.php` (Enum)        | All coin-request operations     | ✅       | Shared enum for request levels             |
| `CoinRequestStatus.php` (Enum)       | All coin-request operations     | ✅       | Shared enum for status states              |
| `CoinRequestType.php` (Enum)         | All coin-request operations     | ✅       | Shared enum for payment types              |
| `ActionResult.php`                   | All action classes              | ✅       | Generic result pattern                     |
| `ApiResponse.php`                    | All API endpoints               | ✅       | Standard response formatting               |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                       | Source                    | Condition                        |
| --------------------------- | ------------------------- | -------------------------------- |
| `amount.required`           | `StoreCoinRequestRequest` | Amount field missing             |
| `amount.numeric`            | `StoreCoinRequestRequest` | Amount is not a number           |
| `amount.min`                | `StoreCoinRequestRequest` | Amount less than 1               |
| `reseller_id.exists`        | `StoreCoinRequestRequest` | Reseller ID not in users table   |
| `reseller_id.not_in`        | `StoreCoinRequestRequest` | Reseller ID equals user's own ID |
| `message.max`               | `StoreCoinRequestRequest` | Message exceeds 1000 characters  |
| `proofs.max`                | `StoreCoinRequestRequest` | More than 3 proof items          |
| `proofs.*.url.required`     | `StoreCoinRequestRequest` | Proof item missing URL           |
| `proofs.*.url.regex`        | `StoreCoinRequestRequest` | URL not from ImageKit CDN        |
| `proofs.*.file_id.required` | `StoreCoinRequestRequest` | Proof item missing file_id       |

### Business Logic Errors (422)

| Error                                      | Source                    | Condition                                   |
| ------------------------------------------ | ------------------------- | ------------------------------------------- |
| `"No default reseller assigned..."`        | `CreateCoinRequestAction` | No reseller_id provided and no default set  |
| `"You cannot request coins from yourself"` | `CreateCoinRequestAction` | User trying to request from their own ID    |
| `"Reseller not found"`                     | `CreateCoinRequestAction` | Reseller ID doesn't exist (race condition)  |
| `"Selected user is not a reseller"`        | `CreateCoinRequestAction` | Target user lacks Reseller/Super Admin role |
| `"You already have a pending request..."`  | `CreateCoinRequestAction` | Duplicate pending request to same reseller  |

### System Errors (500)

| Error                                   | Source                    | Condition                               |
| --------------------------------------- | ------------------------- | --------------------------------------- |
| `"An error occurred while creating..."` | `CreateCoinRequestAction` | Unexpected exception during transaction |
| Database connection failure             | DB Layer                  | Database unavailable                    |

### Edge Cases

| Case                          | Behavior                                      |
| ----------------------------- | --------------------------------------------- |
| No proofs provided            | Request created without proof images          |
| Empty proofs array `[]`       | Treated as null proofs                        |
| Reseller has multiple roles   | Allowed if has Reseller OR Super Admin        |
| Request from Reseller user    | Creates RESELLER_TO_SUPER_ADMIN level request |
| Expiration disabled in config | `expires_at` set to null                      |
| Amount with decimals          | Stored as-is with decimal precision           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                    REPOSITORY                 DATABASE
   │                       │                       │                    │                          │                          │
   │  POST /coin-requests  │                       │                    │                          │                          │
   │   + Bearer token      │                       │                    │                          │                          │
   │──────────────────────▶│                       │                    │                          │                          │
   │                       │                       │                    │                          │                          │
   │                       │ 1. auth:sanctum       │                    │                          │                          │
   │                       │   (validate token)    │                    │                          │                          │
   │                       │──────────────────────▶│                    │                          │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │ 2. StoreCoinRequestRequest                    │                          │
   │                       │                       │   (validate input) │                          │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │ 3. CreateCoinRequestDTO::fromArray()          │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │ 4. execute($dto, $user, $proofs)              │                          │
   │                       │                       │───────────────────▶│                          │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 5. Resolve reseller ID   │                          │
   │                       │                       │                    │   (use default if null)  │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 6. Validate self-request │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 7. User::find($resellerId)                          │
   │                       │                       │                    │─────────────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────────────│
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 8. hasAnyRole(['Reseller',..])                       │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 9. hasPendingRequest()   │                          │
   │                       │                       │                    │─────────────────────────▶│                          │
   │                       │                       │                    │                          │ 10. SELECT EXISTS()      │
   │                       │                       │                    │                          │─────────────────────────▶│
   │                       │                       │                    │                          │◀─────────────────────────│
   │                       │                       │                    │◀─────────────────────────│                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 11. DB::transaction()    │                          │
   │                       │                       │                    │─────────────────────────────────────────────────────▶│
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 12. Calculate expiration │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 13. Determine request_level                         │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 14. repository->create() │                          │
   │                       │                       │                    │─────────────────────────▶│                          │
   │                       │                       │                    │                          │ 15. INSERT INTO          │
   │                       │                       │                    │                          │   coin_requests          │
   │                       │                       │                    │                          │─────────────────────────▶│
   │                       │                       │                    │                          │◀─────────────────────────│
   │                       │                       │                    │◀─────────────────────────│                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 16. load(['user', 'reseller'])                      │
   │                       │                       │                    │─────────────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────────────│
   │                       │                       │                    │                          │                          │
   │                       │                       │                    │ 17. Log::info()          │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │◀───────────────────│                          │                          │
   │                       │                       │                    │                          │                          │
   │                       │                       │ 18. CoinRequestResource::make()               │                          │
   │                       │                       │                    │                          │                          │
   │                       │◀──────────────────────│                    │                          │                          │
   │◀──────────────────────│                       │                    │                          │                          │
   │                       │                       │                    │                          │                          │
   │  201 Created + JSON   │                       │                    │                          │                          │
   │                       │                       │                    │                          │                          │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                 | Location(s)                                             |
| ------------------------ | ------------------------------------------------------- |
| New validation rule      | `StoreCoinRequestRequest::rules()`                      |
| New business validation  | `CreateCoinRequestAction::execute()` before transaction |
| New field to store       | DTO → Action → Model `$fillable`                        |
| New response field       | `CoinRequestResource::toArray()`                        |
| Notification on creation | `CreateCoinRequestAction::execute()` after DB commit    |
| Webhook/event dispatch   | After `ActionResult::success()` in action               |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `priority`)

| Step  | File                                                | What to Change                                    |
| ----- | --------------------------------------------------- | ------------------------------------------------- |
| **1** | Database Migration                                  | `$table->string('priority')->default('normal');`  |
| **2** | `app/Models/Economy/CoinRequest.php`                | Add to `$fillable` array                          |
| **3** | `app/Http/Requests/.../StoreCoinRequestRequest.php` | Add `'priority' => ['...']` validation rule       |
| **4** | `app/DTOs/CoinRequest/CreateCoinRequestDTO.php`     | Add property + update `fromArray()` + `toArray()` |
| **5** | `app/Actions/.../CreateCoinRequestAction.php`       | Include in create data array                      |
| **6** | `app/Http/Resources/.../CoinRequestResource.php`    | Add `'priority' => $coinRequest->priority`        |

#### ➖ REMOVING A FIELD

| Step  | File                                                | What to Change                |
| ----- | --------------------------------------------------- | ----------------------------- |
| **1** | `app/Http/Requests/.../StoreCoinRequestRequest.php` | Remove validation rule        |
| **2** | `app/DTOs/CoinRequest/CreateCoinRequestDTO.php`     | Remove property and methods   |
| **3** | `app/Actions/.../CreateCoinRequestAction.php`       | Remove from create data array |
| **4** | `app/Http/Resources/.../CoinRequestResource.php`    | Remove from response          |
| **5** | Database Migration                                  | Drop column (if safe)         |

### 🔗 Field Flow Dependency Chain

```
Request Input
     │
     ▼
┌─────────────────────────────────────────┐
│ StoreCoinRequestRequest                 │
│ (validation rules)                      │
└─────────────────────────────────────────┘
     │ $request->validated()
     ▼
┌─────────────────────────────────────────┐
│ CreateCoinRequestDTO                    │
│ (type-safe data container)              │
└─────────────────────────────────────────┘
     │ $dto->toModelArray() + extras
     ▼
┌─────────────────────────────────────────┐
│ CreateCoinRequestAction                 │
│ (business logic + enrichment)           │
│ - Resolves reseller                     │
│ - Sets request_level                    │
│ - Sets expires_at                       │
│ - Sets default type/status              │
└─────────────────────────────────────────┘
     │ repository->create($data)
     ▼
┌─────────────────────────────────────────┐
│ CoinRequest Model                       │
│ ($fillable, casts)                      │
└─────────────────────────────────────────┘
     │ loaded+transformed
     ▼
┌─────────────────────────────────────────┐
│ CoinRequestResource                     │
│ (API output formatting)                 │
└─────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                     |
| --------------------------- | ---------------------------------------------------------- |
| `hasPendingRequest()` logic | Prevents duplicate requests; changing could cause issues   |
| DB transaction scope        | Ensures data consistency; moving ops outside could corrupt |
| Request level determination | Used for routing requests to correct approver              |
| Expires_at calculation      | Config-driven; change config instead of hardcoding         |
| `ActionResult` pattern      | Breaking the result pattern breaks controller handling     |
| Model `$fillable`           | Removing items silently ignores data; add carefully        |

### 🚨 Common Pitfalls

| Pitfall                               | Prevention                                              |
| ------------------------------------- | ------------------------------------------------------- |
| Adding field to DTO but not Request   | Always update validation first, DTO derives from it     |
| Forgetting Resource update            | New fields won't appear in API response                 |
| Adding nullable field without default | Ensure database migration has `->nullable()` or default |
| Breaking proof URL validation         | ImageKit URL pattern must match CDN config              |
| Modifying reseller role check         | Could allow non-resellers to receive requests           |
| Removing pending request check        | Allows duplicate pending requests                       |
| Not loading relationships             | Response will fail when accessing user/reseller data    |

### 📁 File Locations Quick Reference

```
routes/api.php                                           ← API version prefix
routes/api/coin-requests.php:24                          ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── CoinRequestController.php                          ← Controller
app/Http/Requests/Api/V1/CoinRequest/
  └── StoreCoinRequestRequest.php                        ← Request validation
app/DTOs/CoinRequest/
  └── CreateCoinRequestDTO.php                           ← Data transfer object
app/Actions/CoinRequest/
  └── CreateCoinRequestAction.php                        ← Business logic
app/Contracts/Repositories/
  └── CoinRequestRepositoryInterface.php                 ← Repository contract
app/Repositories/CoinRequest/
  └── CoinRequestRepository.php                          ← Repository implementation
app/Models/Economy/
  └── CoinRequest.php                                    ← Eloquent model
app/Enums/Economy/
  ├── CoinRequestLevel.php                               ← Level enum
  ├── CoinRequestStatus.php                              ← Status enum
  └── CoinRequestType.php                                ← Type enum
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                            ← Response transformer
config/coin-requests.php                                 ← Expiration config
```

---

## Document Metadata

| Property            | Value                                      |
| ------------------- | ------------------------------------------ |
| **Endpoint**        | `POST /api/v1/coin-requests/coin-requests` |
| **Domain**          | Economy                                    |
| **Author**          | System Documentation                       |
| **Created**         | 2026-02-02                                 |
| **Laravel Version** | 12.x                                       |
| **PHP Version**     | 8.4                                        |
