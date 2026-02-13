# POST /api/v1/reseller/coin-requests/{id}/reject

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

This endpoint allows a reseller (or Super Admin) to reject a pending coin request. Unlike approval, rejection does not involve any balance transfers — it simply updates the request status and records the processor information.

### Responsibilities

- Authorize the reseller can reject this specific coin request
- Validate optional rejection note
- Update coin request status to `rejected`
- Record processor and processing timestamp
- Return updated coin request with relationships

### What It Owns

| Owned               | Description                      |
| ------------------- | -------------------------------- |
| Coin request status | Updates status to `rejected`     |
| Admin note          | Stores optional rejection reason |
| Processor metadata  | Records who rejected and when    |

### External Dependencies

| Dependency | Type     | Purpose                              |
| ---------- | -------- | ------------------------------------ |
| PostgreSQL | Database | Coin request data storage and update |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/reseller/coin-requests/{id}/reject
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
  "admin_note": "string|null" // Optional: Rejection reason (max: 1000 chars)
}
```

#### Field Details

| Field        | Type     | Constraints          | Example                |
| ------------ | -------- | -------------------- | ---------------------- |
| `admin_note` | `string` | Optional, `max:1000` | `"Insufficient proof"` |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin request rejected successfully",
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
    "approved_amount": null,
    "final_amount": 1000,
    "was_adjusted": false,
    "type": {
      "value": "pending",
      "label": "Pending"
    },
    "status": {
      "value": "rejected",
      "label": "Rejected",
      "color": "danger",
      "is_final": true
    },
    "message": "Please send coins",
    "admin_note": "Insufficient payment proof",
    "proofs": [],
    "credit_days": null,
    "is_repaid": false,
    "repaid_at": null,
    "is_repayment_due": false,
    "processor": {
      "id": 789,
      "name": "Reseller Name"
    },
    "processed_at": "2026-02-02T14:32:47.000000Z",
    "expires_at": "2026-02-03T14:32:47.000000Z",
    "created_at": "2026-02-02T12:00:00.000000Z",
    "updated_at": "2026-02-02T14:32:47.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-02T14:32:47.000000Z",
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
    "admin_note": [
      "The admin note field must not be greater than 1000 characters."
    ]
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
| `200` | Coin request rejected successfully             |
| `403` | Unauthorized (not target reseller/super admin) |
| `404` | Coin request not found                         |
| `422` | Validation failed or business rule violation   |
| `500` | Server error during processing                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│             POST /api/v1/reseller/coin-requests/{id}/reject                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:35                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{coinRequest}/reject',                                    │ │
│ │     [ResellerCoinRequestController::class, 'reject']);                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Sanctum token                   │
│   2. Route Model Binding → Resolves {coinRequest} to CoinRequest model      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│ Method: reject(Request $request, CoinRequest $coinRequest)                  │
│ Lines: 100-128                                                              │
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('reject', $coinRequest);                               │ │
│ │ // Calls CoinRequestPolicy::reject() - throws 403 if unauthorized       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Inline Validation (not using FormRequest)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Validator::make($request->all(), [                                      │ │
│ │     'admin_note' => ['nullable', 'string', 'max:1000'],                 │ │
│ │ ])->validate();                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute action (delegate to RejectCoinRequestAction)                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->rejectAction->execute(                                 │ │
│ │     $coinRequest, $user, $request->input('admin_note')                  │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return response based on ActionResult                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->message ?? 'Failed to reject coin request',            │ │
│ │         $result->errors, 422                                            │ │
│ │     );                                                                   │ │
│ │ }                                                                        │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new CoinRequestResource($result->data),                             │ │
│ │     $result->message ?? 'Coin request rejected successfully'            │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 AUTHORIZATION (Policy)                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Economy/CoinRequestPolicy.php:81-88                      │
│ Method: reject(User $user, CoinRequest $coinRequest)                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function reject(User $user, CoinRequest $coinRequest): bool      │ │
│ │ {                                                                        │ │
│ │     // Delegates to approve() method for same authorization logic       │ │
│ │     return $this->approve($user, $coinRequest);                         │ │
│ │ }                                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Underlying Logic (from approve method, lines 62-79):                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function approve(User $user, CoinRequest $coinRequest): bool     │ │
│ │ {                                                                        │ │
│ │     if (! $coinRequest->canBeProcessed()) {                             │ │
│ │         return false;  // Already processed                              │ │
│ │     }                                                                    │ │
│ │                                                                          │ │
│ │     // For reseller→super_admin requests, only Super Admin can reject   │ │
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
│ 3.4 SERVICE LAYER FLOW - Action Class                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/CoinRequest/RejectCoinRequestAction.php                   │
│ Method: execute(CoinRequest $coinRequest, User $approver,                   │
│                 ?string $adminNote = null)                                  │
│                                                                             │
│ COMPONENT: RejectCoinRequestAction (Action Class)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Responsibility: Execute coin request rejection business logic           │ │
│ │ Reusable: YES (used by API and potentially Filament admin)              │ │
│ │ Why It Exists: Decouples rejection logic from controller                │ │
│ │                                                                          │ │
│ │ Key Methods:                                                             │ │
│ │   • execute() → Performs validation, updates status, returns result     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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
│ STEP 2: Update coin request status                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->update([                                                  │ │
│ │     'status' => CoinRequestStatus::REJECTED,                            │ │
│ │     'admin_note' => $adminNote,                                         │ │
│ │     'processed_by' => $approver->id,                                    │ │
│ │     'processed_at' => now(),                                            │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Refresh and load relationships                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->refresh();                                                │ │
│ │ $coinRequest->load([                                                    │ │
│ │     'user:id,name,avatar',                                              │ │
│ │     'reseller:id,name,avatar',                                          │ │
│ │     'processor:id,name'                                                 │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Log the rejection                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('Coin request rejected', [                                    │ │
│ │     'coin_request_id' => $coinRequest->id,                              │ │
│ │     'approver_id' => $approver->id,                                     │ │
│ │     'admin_note' => $adminNote,                                         │ │
│ │ ]);                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return success with updated coin request                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: $coinRequest,                                                 │ │
│ │     message: 'Coin request rejected successfully'                       │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT (Route Model Binding): Load CoinRequest                           │
│    Query: SELECT * FROM coin_requests WHERE id = ? AND deleted_at IS NULL   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. UPDATE (Coin Request): Update status and metadata                        │
│    Query: UPDATE coin_requests SET status = 'rejected',                     │
│           admin_note = ?, processed_by = ?, processed_at = ?,               │
│           updated_at = ? WHERE id = ?                                       │
│    Source: RejectCoinRequestAction::execute()                               │
│                                                                             │
│ 3. SELECT (Refresh): Reload coin request                                    │
│    Query: SELECT * FROM coin_requests WHERE id = ?                          │
│    Source: RejectCoinRequestAction::execute()                               │
│                                                                             │
│ 4. SELECT (Eager Load): Load relationships                                  │
│    Query: SELECT id, name, avatar FROM users WHERE id IN (?, ?, ?)          │
│    Source: RejectCoinRequestAction::execute()                               │
│                                                                             │
│ NOTE: Unlike approval, rejection does NOT involve:                          │
│   • Balance transfers (no CoinDistributionService call)                     │
│   • Transaction record creation                                             │
│   • WebSocket balance update events                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
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
│ Wrapped by ApiResponse::success() with standard meta:                       │
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

| File                          | Used By Endpoints               | Reusable | Reasoning                        |
| ----------------------------- | ------------------------------- | -------- | -------------------------------- |
| `RejectCoinRequestAction.php` | Reject endpoint, Filament admin | ⭕       | Business logic reused in admin   |
| `CoinRequestPolicy.php`       | All coin request endpoints      | ✅       | Centralized authorization        |
| `CoinRequestResource.php`     | All coin request endpoints      | ✅       | Standard coin request response   |
| `CoinRequest.php`             | All coin request operations     | ✅       | Eloquent model                   |
| `ActionResult.php`            | All action classes              | ✅       | Standard action result pattern   |
| `ApiResponse.php`             | All API endpoints               | ✅       | Standardized API response helper |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error            | Source                         | Condition              |
| ---------------- | ------------------------------ | ---------------------- |
| `admin_note.max` | Inline Validator in controller | Note > 1000 characters |

### Authorization Errors (403)

| Error                         | Source                      | Condition                                            |
| ----------------------------- | --------------------------- | ---------------------------------------------------- |
| `This action is unauthorized` | `CoinRequestPolicy::reject` | User is not target reseller or Super Admin           |
| `This action is unauthorized` | `CoinRequestPolicy::reject` | Request already processed (not pending)              |
| `This action is unauthorized` | `CoinRequestPolicy::reject` | Reseller→SuperAdmin request but user not Super Admin |

### Business Logic Errors (422)

| Error                         | Source                    | Condition               |
| ----------------------------- | ------------------------- | ----------------------- |
| `Request cannot be processed` | `RejectCoinRequestAction` | Status is not `pending` |

### System Errors (500)

| Error               | Source                    | Condition                    |
| ------------------- | ------------------------- | ---------------------------- |
| `An error occurred` | `RejectCoinRequestAction` | Uncaught exception in action |

### Edge Cases

| Case                         | Behavior                                        |
| ---------------------------- | ----------------------------------------------- |
| `admin_note` is null         | Rejection proceeds; note field remains empty    |
| `admin_note` is empty string | Treated as no note; stored as empty             |
| Request already rejected     | 403 error (policy check via `canBeProcessed()`) |
| Request already approved     | 403 error (policy check via `canBeProcessed()`) |
| Request is expired           | Can still be rejected (expiry doesn't block)    |
| Reseller→SuperAdmin request  | Only Super Admin can reject                     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER              ACTION                      DATABASE
   │                       │                       │                       │                            │
   │  POST /reseller/coin-requests/{id}/reject     │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. auth:sanctum       │                       │                            │
   │                       │   (verify token)      │                       │                            │
   │                       │───────────────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────────────│ SELECT users
   │                       │                       │                       │                            │
   │                       │ 2. Route Model Bind   │                       │                            │
   │                       │───────────────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────────────│ SELECT coin_requests
   │                       │                       │                       │                            │
   │                       │ 3. Invoke controller  │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 4. authorize('reject')│                            │
   │                       │                       │   (Policy check)      │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 5. Inline validation  │                            │
   │                       │                       │   (admin_note)        │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 6. action->execute()  │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 7. canBeProcessed()        │
   │                       │                       │                       │   (validate pending)       │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. UPDATE coin_request     │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. SELECT (refresh)        │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. SELECT users           │
   │                       │                       │                       │    (eager load)            │
   │                       │                       │                       │──────────────────────────▶│
   │                       │                       │                       │◀──────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. Log::info()            │
   │                       │                       │                       │                            │
   │                       │                       │◀──────────────────────│ (ActionResult)             │
   │                       │                       │                       │                            │
   │                       │◀──────────────────────│ (Transform Resource)  │                            │
   │                       │                       │                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  200 + JSON           │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| New validation rule       | Inline Validator in `ResellerCoinRequestController::reject()`    |
| New rejection field       | `RejectCoinRequestAction::execute()` update array                |
| New response field        | `CoinRequestResource::toArray()`                                 |
| New authorization rule    | `CoinRequestPolicy::reject()` (or modify `approve()`)            |
| Notification on rejection | `RejectCoinRequestAction::execute()` after status update         |
| WebSocket event on reject | `RejectCoinRequestAction::execute()` (not currently implemented) |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `rejection_reason_code`)

| Step  | File                                                                    | What to Change                           |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------- |
| **1** | **Database Migration**                                                  | Add column to `coin_requests`            |
| **2** | `app/Models/Economy/CoinRequest.php`                                    | Add to `$fillable`, add to `$casts`      |
| **3** | `app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php` | Add to inline Validator rules            |
| **4** | `app/Actions/CoinRequest/RejectCoinRequestAction.php`                   | Update method signature and update array |
| **5** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`                 | Add to response array                    |

#### ➖ REMOVING A FIELD

| Step  | File                                                                    | What to Change              |
| ----- | ----------------------------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php` | Remove from Validator rules |
| **2** | `app/Actions/CoinRequest/RejectCoinRequestAction.php`                   | Remove from update array    |
| **3** | `app/Http/Resources/V1/Economy/CoinRequestResource.php`                 | Remove from response        |
| **4** | **Database Migration**                                                  | Drop column (if safe)       |

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
│  │ Inline Validator (in Controller)                                      │   │
│  │   Validates: admin_note (optional, max:1000)                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │ $request->input('admin_note')                                       │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ RejectCoinRequestAction::execute()                                    │   │
│  │   Receives: CoinRequest, User, ?string $adminNote                     │   │
│  │   Updates: status, admin_note, processed_by, processed_at             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ CoinRequest Model (Database)                                          │   │
│  │   Stored: status=rejected, admin_note, processed_by, processed_at     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ CoinRequestResource::toArray()                                        │   │
│  │   Transforms all fields to API response format                        │   │
│  │   Status shows: value=rejected, label=Rejected, color=danger          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| `CoinRequestPolicy::reject()`     | Security-critical; delegates to approve() for consistent authorization |
| `canBeProcessed()` check          | Prevents double-processing; ensures idempotency                        |
| Status update in action           | Must use `CoinRequestStatus::REJECTED` enum for consistency            |
| `processed_by` and `processed_at` | Audit trail requirements; must always be set on rejection              |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                                         |
| -------------------------------------- | ------------------------------------------------------------------ |
| Forgetting to check `canBeProcessed()` | Action already guards; don't bypass with direct model updates      |
| Adding balance operations to reject    | Rejection MUST NOT touch balances; only approval does transfers    |
| Modifying policy without testing       | Rejection uses same policy as approval; changes affect both        |
| Not loading relationships after update | Always call `load()` after `refresh()` for resource transformation |
| Skipping logging                       | Rejection should always be logged for audit purposes               |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                               ← Route definition (line 35)
app/Http/Controllers/Api/V1/Economy/
  └── ResellerCoinRequestController.php                    ← Controller (lines 100-128)
app/Policies/Economy/
  └── CoinRequestPolicy.php                                ← Authorization policy (lines 81-88)
app/Actions/CoinRequest/
  └── RejectCoinRequestAction.php                          ← Business logic action
app/Models/Economy/
  └── CoinRequest.php                                      ← Eloquent model
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                              ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                      ← Standard response helper
app/Actions/
  └── ActionResult.php                                     ← Action result wrapper
```

---

## 8. Comparison: Reject vs. Approve

| Aspect                  | Reject                     | Approve                                                |
| ----------------------- | -------------------------- | ------------------------------------------------------ |
| **Balance Transfer**    | ❌ None                    | ✅ Uses CoinDistributionService                        |
| **Transaction Record**  | ❌ None created            | ✅ Creates audit transaction                           |
| **WebSocket Events**    | ❌ None                    | ✅ Emits balance.updated events                        |
| **Validation**          | Inline Validator (minimal) | FormRequest (ApproveCoinRequestRequest)                |
| **DTO Usage**           | ❌ Not used                | ✅ ApproveCoinRequestDTO                               |
| **Request Body Fields** | Only `admin_note`          | `type`, `approved_amount`, `credit_days`, `admin_note` |
| **Database Operations** | 1 UPDATE + 2 SELECT        | 7+ operations including locks                          |
| **Complexity**          | Simple status update       | Complex atomic financial transaction                   |

---

## Document Metadata

| Property            | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/reseller/coin-requests/{id}/reject` |
| **Domain**          | Economy                                           |
| **Author**          | System Documentation                              |
| **Created**         | 2026-02-02                                        |
| **Laravel Version** | 12.x                                              |
| **PHP Version**     | 8.4                                               |
