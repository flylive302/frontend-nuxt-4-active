# POST /api/v1/reseller/coin-requests/{id}/mark-repaid

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Marks an approved credit coin request as repaid. This endpoint allows resellers (or Super Admins) to record when a user has paid back the credit they received.

### Responsibilities

- Validate that the request is a credit type
- Validate that the request is approved
- Validate that the request is not already repaid
- Update repayment status (`is_repaid`, `repaid_at`, `repaid_marked_by`)
- Return updated coin request data

### What It Owns

| Owned             | Description                                          |
| ----------------- | ---------------------------------------------------- |
| Repayment marking | Updates `is_repaid`, `repaid_at`, `repaid_marked_by` |
| Status tracking   | Tracks who marked repayment and when                 |

### External Dependencies

| Dependency | Type           | Purpose                   |
| ---------- | -------------- | ------------------------- |
| Database   | Infrastructure | CoinRequest table updates |
| Sanctum    | Package        | User authentication       |
| Logging    | Infrastructure | Audit logging             |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/reseller/coin-requests/{id}/mark-repaid
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config               |
| ------- | ------- | -------------------- |
| Sanctum | User ID | Default API throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Description         |
| --------- | --------- | ------------------- |
| `id`      | `integer` | The coin request ID |

### Request Body Schema

```json
{}
```

> **Note**: No request body is required. Authorization is determined by the policy.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Credit marked as repaid successfully",
  "data": {
    "id": 1,
    "user": {
      "id": 10,
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "reseller": {
      "id": 5,
      "name": "Reseller Name",
      "avatar": "https://example.com/reseller.jpg"
    },
    "amount": "1000.00",
    "approved_amount": "1000.00",
    "final_amount": "1000.00",
    "was_adjusted": false,
    "type": {
      "value": "credit",
      "label": "Credit"
    },
    "status": {
      "value": "approved",
      "label": "Approved",
      "color": "success",
      "is_final": true
    },
    "message": "Need coins for gifts",
    "admin_note": null,
    "proofs": [],
    "credit_days": 30,
    "is_repaid": true,
    "repaid_at": "2026-02-02T14:37:06.000000Z",
    "is_repayment_due": false,
    "processor": {
      "id": 5,
      "name": "Processor Name"
    },
    "processed_at": "2026-02-01T10:00:00.000000Z",
    "expires_at": null,
    "created_at": "2026-01-28T08:00:00.000000Z",
    "updated_at": "2026-02-02T14:37:06.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-02T14:37:06.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": {}
}
```

#### ❌ Not a Credit Request (422)

```json
{
  "status": "error",
  "message": "Not a credit request",
  "data": null,
  "errors": {
    "type": ["Only credit requests can be marked as repaid"]
  }
}
```

#### ❌ Request Not Approved (422)

```json
{
  "status": "error",
  "message": "Request not approved",
  "data": null,
  "errors": {
    "status": ["Only approved requests can be marked as repaid"]
  }
}
```

#### ❌ Already Repaid (422)

```json
{
  "status": "error",
  "message": "Already repaid",
  "data": null,
  "errors": {
    "repaid": ["This request has already been marked as repaid"]
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Economy\\CoinRequest]",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                             |
| ----- | ----------------------------------------------------- |
| `200` | Credit successfully marked as repaid                  |
| `403` | User not authorized (not reseller or not target)      |
| `404` | Coin request not found                                |
| `422` | Business rule violation (not credit/not approved/etc) |
| `500` | Unexpected system error                               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│            POST /api/v1/reseller/coin-requests/{id}/mark-repaid             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:36                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/{coinRequest}/mark-repaid',                               │ │
│ │     [ResellerCoinRequestController::class, 'markRepaid']);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Authenticates user via Sanctum token                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel automatically resolves {coinRequest} to CoinRequest model           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CoinRequest::findOrFail($id)                                            │ │
│ │ // 404 thrown if not found                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER METHOD                                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/ResellerCoinRequestController.php │
│ Method: markRepaid(Request $request, CoinRequest $coinRequest)              │
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('markRepaid', $coinRequest);                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute action                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->markRepaidAction->execute($coinRequest, $user);        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Handle result                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(...);                                     │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(new CoinRequestResource($result->data));    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Economy/CoinRequestPolicy.php                            │
│ Method: markRepaid(User $user, CoinRequest $coinRequest)                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function markRepaid(User $user, CoinRequest $coinRequest): bool  │ │
│ │ {                                                                       │ │
│ │     // Only applicable to approved credit requests not yet repaid       │ │
│ │     if (!$coinRequest->isApproved() || !$coinRequest->isCredit()        │ │
│ │         || $coinRequest->is_repaid) {                                   │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // For reseller→super_admin requests, only Super Admin can mark     │ │
│ │     if ($coinRequest->request_level ===                                 │ │
│ │         CoinRequestLevel::RESELLER_TO_SUPER_ADMIN) {                    │ │
│ │         return $user->hasRole('Super Admin');                           │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // For user→reseller, target reseller or SuperAdmin can mark       │ │
│ │     return $user->id === $coinRequest->reseller_id                      │ │
│ │         || $user->hasRole('Super Admin');                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION LAYER                                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/CoinRequest/MarkCreditRepaidAction.php                    │
│ Method: execute(CoinRequest $coinRequest, User $user)                       │
│                                                                             │
│ STEP 1: Validate credit type                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($coinRequest->type !== CoinRequestType::CREDIT) {                   │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errors: ['type' => ['Only credit requests can be marked...']],  │ │
│ │         message: 'Not a credit request'                                 │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate approved status                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$coinRequest->isApproved()) {                                      │ │
│ │     return ActionResult::failure(...);                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate not already repaid                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($coinRequest->is_repaid) {                                          │ │
│ │     return ActionResult::failure(...);                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Update coin request                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->update([                                                  │ │
│ │     'is_repaid' => true,                                                │ │
│ │     'repaid_at' => now(),                                               │ │
│ │     'repaid_marked_by' => $user->id,                                    │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Refresh and load relations                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->refresh();                                                │ │
│ │ $coinRequest->load(['user:id,name', 'reseller:id,name',                 │ │
│ │     'repaidMarker:id,name']);                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Log and return success                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('Credit coin request marked as repaid', [...]);               │ │
│ │ return ActionResult::success(data: $coinRequest, message: '...');       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Route model binding                                              │
│    Query: SELECT * FROM coin_requests WHERE id = ? AND deleted_at IS NULL   │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. UPDATE: Mark as repaid                                                   │
│    Query: UPDATE coin_requests SET is_repaid = 1, repaid_at = ?,            │
│           repaid_marked_by = ?, updated_at = ? WHERE id = ?                 │
│    Source: MarkCreditRepaidAction::execute()                                │
│                                                                             │
│ 3. SELECT: Refresh model                                                    │
│    Query: SELECT * FROM coin_requests WHERE id = ?                          │
│    Source: $coinRequest->refresh()                                          │
│                                                                             │
│ 4. SELECT: Load relations                                                   │
│    Query: SELECT id, name FROM users WHERE id IN (?, ?, ?)                  │
│    Source: $coinRequest->load([...])                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Economy/CoinRequestResource.php                 │
│                                                                             │
│ Transforms CoinRequest model to API response format:                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $coinRequest->id,                                           │ │
│ │     'user' => ['id' => ..., 'name' => ..., 'avatar' => ...],            │ │
│ │     'reseller' => ['id' => ..., 'name' => ..., 'avatar' => ...],        │ │
│ │     'amount' => $coinRequest->amount,                                   │ │
│ │     'is_repaid' => $coinRequest->is_repaid,                             │ │
│ │     'repaid_at' => $coinRequest->repaid_at?->toISOString(),             │ │
│ │     ...                                                                 │ │
│ │ ];                                                                      │ │
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

| File                                | Used By Endpoints                    | Reusable | Reasoning                                  |
| ----------------------------------- | ------------------------------------ | -------- | ------------------------------------------ |
| `MarkCreditRepaidAction.php`        | mark-repaid, Filament admin panel    | ✅       | Shared between API and admin panel         |
| `CoinRequestPolicy.php`             | All coin request endpoints           | ✅       | Centralized authorization for all actions  |
| `CoinRequestResource.php`           | All coin request endpoints           | ✅       | Shared response format for coin requests   |
| `CoinRequest.php` (Model)           | All coin request operations          | ✅       | Core model for all coin request logic      |
| `ActionResult.php`                  | All action classes                   | ✅       | Standard result wrapper                    |
| `ApiResponse.php`                   | All API endpoints                    | ✅       | Standard response formatting               |
| `ResellerCoinRequestController.php` | Reseller coin request endpoints only | ⭕       | Controller for reseller-specific endpoints |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error      | Source                   | Condition                           |
| ---------- | ------------------------ | ----------------------------------- |
| `type.0`   | `MarkCreditRepaidAction` | Request type is not CREDIT          |
| `status.0` | `MarkCreditRepaidAction` | Request status is not APPROVED      |
| `repaid.0` | `MarkCreditRepaidAction` | Request is already marked as repaid |

### Authorization Errors (403)

| Error                          | Source              | Condition                               |
| ------------------------------ | ------------------- | --------------------------------------- |
| "This action is unauthorized." | `CoinRequestPolicy` | User is not the reseller or Super Admin |
| "This action is unauthorized." | `CoinRequestPolicy` | Request is not approved credit          |

### System Errors (500)

| Error                                | Source                   | Condition                        |
| ------------------------------------ | ------------------------ | -------------------------------- |
| "An error occurred while marking..." | `MarkCreditRepaidAction` | Database or unexpected exception |

### Edge Cases

| Case                                         | Behavior                         |
| -------------------------------------------- | -------------------------------- |
| Non-existent coin request ID                 | 404 Not Found                    |
| Cash/Direct request (not credit)             | 422 with type validation error   |
| Pending/Rejected request                     | 422 with status validation error |
| Already repaid request                       | 422 with repaid validation error |
| Reseller→SuperAdmin request by reseller      | 403 Forbidden                    |
| User trying to mark their own request repaid | 403 Forbidden                    |
| Soft-deleted coin request                    | 404 Not Found                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE           CONTROLLER          POLICY             ACTION              DATABASE
   │                     │                    │                  │                  │                    │
   │  POST /mark-repaid  │                    │                  │                  │                    │
   │────────────────────▶│                    │                  │                  │                    │
   │                     │                    │                  │                  │                    │
   │                     │ 1. auth:sanctum    │                  │                  │                    │
   │                     │────────────────────▶                  │                  │                    │
   │                     │                    │                  │                  │                    │
   │                     │                    │ 2. Find CoinRequest                 │                    │
   │                     │                    │──────────────────────────────────────────────────────────▶│
   │                     │                    │◀──────────────────────────────────────────────────────────│
   │                     │                    │                  │                  │                    │
   │                     │                    │ 3. authorize()   │                  │                    │
   │                     │                    │─────────────────▶│                  │                    │
   │                     │                    │                  │ 4. markRepaid()  │                    │
   │                     │                    │                  │ check type/status│                    │
   │                     │                    │◀─────────────────│                  │                    │
   │                     │                    │                  │                  │                    │
   │                     │                    │ 5. execute()     │                  │                    │
   │                     │                    │─────────────────────────────────────▶                    │
   │                     │                    │                  │                  │                    │
   │                     │                    │                  │                  │ 6. Validate rules  │
   │                     │                    │                  │                  │ (type/status/repaid)
   │                     │                    │                  │                  │                    │
   │                     │                    │                  │                  │ 7. UPDATE request  │
   │                     │                    │                  │                  │───────────────────▶│
   │                     │                    │                  │                  │◀───────────────────│
   │                     │                    │                  │                  │                    │
   │                     │                    │                  │                  │ 8. Refresh + load  │
   │                     │                    │                  │                  │───────────────────▶│
   │                     │                    │                  │                  │◀───────────────────│
   │                     │                    │                  │                  │                    │
   │                     │                    │                  │                  │ 9. Log::info()     │
   │                     │                    │◀─────────────────────────────────────                    │
   │                     │                    │                  │                  │                    │
   │                     │                    │ 10. Transform via Resource          │                    │
   │                     │                    │                  │                  │                    │
   │                     │◀───────────────────│                  │                  │                    │
   │◀────────────────────│                    │                  │                  │                    │
   │                     │                    │                  │                  │                    │
   │  200 OK + JSON      │                    │                  │                  │                    │
   │                     │                    │                  │                  │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location(s)                                      |
| ---------------------------- | ------------------------------------------------ |
| Additional validation rules  | `MarkCreditRepaidAction::execute()`              |
| New authorization conditions | `CoinRequestPolicy::markRepaid()`                |
| Response field additions     | `CoinRequestResource::toArray()`                 |
| Post-repayment side effects  | `MarkCreditRepaidAction` (after update)          |
| Notifications on repayment   | `MarkCreditRepaidAction` (dispatch notification) |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD

| Step  | File                                                    | What to Change                |
| ----- | ------------------------------------------------------- | ----------------------------- |
| **1** | **Database Migration**                                  | Add column to `coin_requests` |
| **2** | `app/Models/Economy/CoinRequest.php`                    | Add to `$fillable` and casts  |
| **3** | `app/Actions/CoinRequest/MarkCreditRepaidAction.php`    | Include in update array       |
| **4** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Add to response array         |

#### ➖ REMOVING A FIELD

| Step  | File                                                    | What to Change             |
| ----- | ------------------------------------------------------- | -------------------------- |
| **1** | `app/Actions/CoinRequest/MarkCreditRepaidAction.php`    | Remove from update array   |
| **2** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Remove from response array |
| **3** | **Database Migration**                                  | Drop column (if safe)      |

### 🔗 Field Flow Dependency Chain

```
Route Parameter {id}
       │
       ▼
┌──────────────────────┐
│ CoinRequest Model    │
│ (route model binding)│
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ CoinRequestPolicy    │
│ - isApproved()       │
│ - isCredit()         │
│ - is_repaid          │
│ - request_level      │
│ - reseller_id        │
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ MarkCreditRepaidAction│
│ - type check         │
│ - status check       │
│ - repaid check       │
│ - UPDATE fields      │
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│ CoinRequestResource  │
│ - is_repaid          │
│ - repaid_at          │
│ - all other fields   │
└──────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                  |
| ------------------------- | ------------------------------------------------------- |
| `CoinRequestPolicy`       | Affects authorization across all coin request endpoints |
| `CoinRequest` model casts | Breaking changes affect all consumers                   |
| `ActionResult` structure  | Used by all action classes throughout the system        |
| `is_repaid` field logic   | Critical for credit tracking and financial accuracy     |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                           |
| -------------------------------------- | ---------------------------------------------------- |
| Marking non-credit request as repaid   | Action validates type before update                  |
| Marking pending request as repaid      | Action validates approved status                     |
| Double marking as repaid               | Action checks `is_repaid` flag                       |
| Unauthorized user marking repayment    | Policy checks reseller ownership or Super Admin role |
| Missing `repaid_marked_by` audit trail | Action always sets who marked the repayment          |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                              ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── ResellerCoinRequestController.php                   ← Controller
app/Actions/CoinRequest/
  └── MarkCreditRepaidAction.php                          ← Business logic
app/Policies/Economy/
  └── CoinRequestPolicy.php                               ← Authorization
app/Models/Economy/
  └── CoinRequest.php                                     ← Model
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                             ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                     ← Response formatting
app/Actions/
  └── ActionResult.php                                    ← Result wrapper
```

---

## Document Metadata

| Property            | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| **Endpoint**        | `POST /api/v1/reseller/coin-requests/{id}/mark-repaid` |
| **Domain**          | Economy                                                |
| **Author**          | System Documentation                                   |
| **Created**         | 2026-02-02                                             |
| **Laravel Version** | 12.x                                                   |
| **PHP Version**     | 8.4                                                    |
