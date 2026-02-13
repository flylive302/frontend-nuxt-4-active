# DELETE /api/v1/coin-requests/{coinRequest}

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Delete (Cancel) Coin Request endpoint cancels a pending coin request. Only the request owner or Super Admin can cancel, and only pending requests can be cancelled.

### Responsibilities

- Validate the coin request exists via route-model binding
- Authorize cancellation via CoinRequestPolicy (owner or Super Admin)
- Execute business logic via CancelCoinRequestAction
- Update request status to 'cancelled' and record processor
- Return the updated coin request

### What It Owns

| Owned                | Description                                   |
| -------------------- | --------------------------------------------- |
| Request cancellation | Updates `coin_requests` status to 'cancelled' |
| Audit trail          | Records `processed_by` and `processed_at`     |

### External Dependencies

| Dependency | Type           | Purpose                      |
| ---------- | -------------- | ---------------------------- |
| Database   | Infrastructure | Update `coin_requests` table |
| Sanctum    | Package        | User authentication          |
| Log        | Infrastructure | Audit logging                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/coin-requests/{coinRequest}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key            | Config                   |
| ------- | -------------- | ------------------------ |
| Default | `user_id + ip` | 60 requests/minute (API) |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter     | Type      | Description                          |
| ------------- | --------- | ------------------------------------ |
| `coinRequest` | `integer` | The ID of the coin request to cancel |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Coin request cancelled successfully",
  "data": {
    "id": 1,
    "user": {
      "id": 123,
      "name": "John Doe",
      "avatar": "https://..."
    },
    "reseller": {
      "id": 456,
      "name": "Reseller Name",
      "avatar": "https://..."
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
      "value": "cancelled", // Updated to cancelled
      "label": "Cancelled",
      "color": "gray",
      "is_final": true // Cancelled is a final state
    },
    "message": "Please process quickly",
    "admin_note": null,
    "proofs": [],
    "credit_days": null,
    "is_repaid": false,
    "repaid_at": null,
    "is_repayment_due": false,
    "processor": {
      // Set to user who cancelled
      "id": 123,
      "name": "John Doe"
    },
    "processed_at": "2026-02-02T18:55:00.000000Z",
    "expires_at": null,
    "created_at": "2026-02-02T08:43:09.000000Z",
    "updated_at": "2026-02-02T18:55:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-02T18:55:00.000000Z",
    "correlation_id": "uuid-here"
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Unauthenticated",
  "data": null
}
```

#### ❌ Forbidden (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Economy\\CoinRequest] {id}",
  "data": null
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "Request cannot be cancelled",
  "data": null,
  "errors": {
    "status": ["Only pending requests can be cancelled"]
  }
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `200` | Request cancelled successfully             |
| `401` | Missing or invalid authentication          |
| `403` | User not authorized to cancel this request |
| `404` | Coin request not found                     |
| `422` | Request cannot be cancelled (not pending)  |
| `500` | Server error (database failure)            |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                DELETE /api/v1/coin-requests/{coinRequest}                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:26                                       │
│ Route: Route::delete('/{coinRequest}', [CoinRequestController::class,       │
│                                         'destroy'])                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::prefix('coin-requests')->group(function () {                 │ │
│ │         Route::delete('/{coinRequest}', [CoinRequestController::class,  │ │
│ │                                          'destroy']);                   │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, sets Auth::user()               │
│                                                                             │
│ Route-Model Binding:                                                        │
│   {coinRequest} → Resolved via implicit binding to CoinRequest model        │
│   If not found → Laravel throws ModelNotFoundException (404)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE-MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Laravel automatically resolves {coinRequest} to CoinRequest model instance  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Laravel internally performs:                                         │ │
│ │ CoinRequest::findOrFail($coinRequest);                                  │ │
│ │                                                                         │ │
│ │ // Query with SoftDeletes:                                              │ │
│ │ SELECT * FROM coin_requests WHERE id = ? AND deleted_at IS NULL LIMIT 1 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ If not found:                                                               │
│   → Throws ModelNotFoundException → 404 response                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Economy/CoinRequestController.php:99-123  │
│ Method: destroy(CoinRequest $coinRequest, Request $request)                 │
│                                                                             │
│ STEP 1: Policy authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('cancel', $coinRequest);                               │ │
│ │                                                                         │ │
│ │ // Delegates to CoinRequestPolicy::cancel()                             │ │
│ │ // Throws AuthorizationException (403) if denied                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ /** @var \App\Models\User\User $user */                                 │ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute cancel action                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->cancelAction->execute($coinRequest, $user);            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Handle result (success or failure)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->message ?? 'Failed to cancel coin request',            │ │
│ │         $result->errors,                                                │ │
│ │         422                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new CoinRequestResource($result->data),                             │ │
│ │     $result->message ?? 'Coin request cancelled successfully'           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 AUTHORIZATION (POLICY)                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Economy/CoinRequestPolicy.php:48-57                      │
│ Method: cancel(User $user, CoinRequest $coinRequest)                        │
│                                                                             │
│ Authorization Logic:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function cancel(User $user, CoinRequest $coinRequest): bool      │ │
│ │ {                                                                       │ │
│ │     // Only owner or SuperAdmin, and only if pending                    │ │
│ │     if (! $coinRequest->canBeCancelled()) {                             │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return $user->id === $coinRequest->user_id                          │ │
│ │         || $user->hasRole('Super Admin');                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Access Granted To:                                                          │
│   • Owner (user_id matches authenticated user) AND request is pending       │
│   • Super Admin AND request is pending                                      │
│                                                                             │
│ Model Helper (canBeCancelled):                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function canBeCancelled(): bool                                  │ │
│ │ {                                                                       │ │
│ │     return $this->isPending();                                          │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ public function isPending(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->status === CoinRequestStatus::PENDING;                │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION LAYER (BUSINESS LOGIC)                                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/CoinRequest/CancelCoinRequestAction.php:25-76             │
│ Method: execute(CoinRequest $coinRequest, User $user)                       │
│                                                                             │
│ STEP 1: Validate request can be cancelled                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $coinRequest->canBeCancelled()) {                                 │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errors: ['status' => ['Only pending requests can be cancelled']],│
│ │         message: 'Request cannot be cancelled'                          │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate user has permission (redundant with policy, defense layer) │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $isOwner = $user->id === $coinRequest->user_id;                         │ │
│ │ $isSuperAdmin = $user->hasRole('Super Admin');                          │ │
│ │                                                                         │ │
│ │ if (! $isOwner && ! $isSuperAdmin) {                                    │ │
│ │     return ActionResult::failure(                                       │ │
│ │         errors: ['permission' => ['You can only cancel your own ...]],  │ │
│ │         message: 'Permission denied'                                    │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Update coin request in database                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->update([                                                  │ │
│ │     'status' => CoinRequestStatus::CANCELLED,                           │ │
│ │     'processed_by' => $user->id,                                        │ │
│ │     'processed_at' => now(),                                            │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Refresh model from database                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $coinRequest->refresh();                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Log the cancellation                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('Coin request cancelled', [                                   │ │
│ │     'coin_request_id' => $coinRequest->id,                              │ │
│ │     'user_id' => $user->id,                                             │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Return success result                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: $coinRequest,                                                 │ │
│ │     message: 'Coin request cancelled successfully'                      │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Exception Handling:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     Log::error('Coin request cancellation failed', [...]);              │ │
│ │     return ActionResult::fromException($e, 'An error occurred...');     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ActionResult (Result Object)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Encapsulates action success/failure with data/errors    │ │
│ │ Reusable: YES (used by ALL action classes)                              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message)  → Creates success result                  │ │
│ │   • failure($errors, $message) → Creates failure result                 │ │
│ │   • fromException($e)          → Creates failure from exception         │ │
│ │   • isSuccess() / isFailure()  → Check result state                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/CoinRequestResource.php             │ │
│ │ Responsibility: Transform CoinRequest model to API response             │ │
│ │ Reusable: YES (used by index, show, store, destroy endpoints)           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestPolicy (Authorization)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Economy/CoinRequestPolicy.php                        │ │
│ │ Responsibility: Authorize access to CoinRequest resources               │ │
│ │ Reusable: YES (used by all coin request endpoints)                      │ │
│ │                                                                         │ │
│ │ Key Method for this endpoint:                                           │ │
│ │   • cancel() → Owner or Super Admin, only if pending                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Consistent API response formatting                      │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 response with data                                  │ │
│ │   • error()   → Error response with status code                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CoinRequestStatus (Enum)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Economy/CoinRequestStatus.php                           │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED                 │ │
│ │                                                                         │ │
│ │ CANCELLED status:                                                       │ │
│ │   • is_final: true                                                      │ │
│ │   • color: 'gray'                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Route-model binding (find coin request)                          │
│    Query: SELECT * FROM coin_requests                                       │
│           WHERE id = ? AND deleted_at IS NULL                               │
│           LIMIT 1                                                           │
│    Source: Laravel route-model binding (implicit)                           │
│                                                                             │
│ 2. UPDATE: Set status to cancelled                                          │
│    Query: UPDATE coin_requests                                              │
│           SET status = 'cancelled',                                         │
│               processed_by = ?,                                             │
│               processed_at = ?,                                             │
│               updated_at = ?                                                │
│           WHERE id = ?                                                      │
│    Source: CancelCoinRequestAction::execute()                               │
│                                                                             │
│ 3. SELECT: Refresh model after update                                       │
│    Query: SELECT * FROM coin_requests WHERE id = ?                          │
│    Source: $coinRequest->refresh()                                          │
│                                                                             │
│ LOG OPERATIONS:                                                             │
│   • Log::info on success                                                    │
│   • Log::error on exception                                                 │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SUCCESS PATH:                                                               │
│ 1. CoinRequestResource::toArray()                                           │
│    → Transforms updated CoinRequest to response array                       │
│    → Status now shows 'cancelled' with is_final: true                       │
│    → processor and processed_at populated                                   │
│                                                                             │
│ 2. ApiResponse::success()                                                   │
│    → Wraps in standard envelope with status, message, data, meta            │
│                                                                             │
│ FAILURE PATH:                                                               │
│ 1. ActionResult contains failure details                                    │
│ 2. ApiResponse::error()                                                     │
│    → 422 response with errors object                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK (success) or 422 (failure)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints            | Reusable | Reasoning                                 |
| ------------------------------ | ---------------------------- | -------- | ----------------------------------------- |
| `CoinRequestController.php`    | coin-requests CRUD           | ⭕       | Shared patterns but method-specific logic |
| `CancelCoinRequestAction.php`  | DELETE coin-request only     | ❌       | Single-purpose action for cancellation    |
| `ActionResult.php`             | ALL action classes           | ✅       | Generic result wrapper                    |
| `CoinRequestResource.php`      | index, show, store, destroy  | ✅       | Single transformation for all responses   |
| `CoinRequest.php` (Model)      | All Economy domain endpoints | ✅       | Eloquent model, relationships, helpers    |
| `CoinRequestPolicy.php`        | All coin request endpoints   | ✅       | Central authorization logic               |
| `CoinRequestStatus.php` (Enum) | All coin request endpoints   | ✅       | Status values with labels/colors          |
| `ApiResponse.php`              | ALL API endpoints            | ✅       | Global response wrapper                   |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error             | Source                    | Condition                       |
| ----------------- | ------------------------- | ------------------------------- |
| `Unauthenticated` | `auth:sanctum` middleware | Missing or invalid Bearer token |

### Authorization Errors (403)

| Error                          | Source              | Condition                                        |
| ------------------------------ | ------------------- | ------------------------------------------------ |
| `This action is unauthorized.` | `CoinRequestPolicy` | User is not owner or Super Admin, OR not pending |

### Not Found Errors (404)

| Error                           | Source              | Condition                      |
| ------------------------------- | ------------------- | ------------------------------ |
| `No query results for model...` | Route-model binding | Coin request ID does not exist |
| `No query results for model...` | Route-model binding | Coin request is soft-deleted   |

### Business Logic Errors (422)

| Error                                    | Source                    | Condition                        |
| ---------------------------------------- | ------------------------- | -------------------------------- |
| `Only pending requests can be cancelled` | `CancelCoinRequestAction` | Request status is not 'pending'  |
| `You can only cancel your own requests`  | `CancelCoinRequestAction` | User is not owner or Super Admin |
| `Permission denied`                      | `CancelCoinRequestAction` | Permission validation failed     |

### System Errors (500)

| Error                     | Source                    | Condition                     |
| ------------------------- | ------------------------- | ----------------------------- |
| Database connection error | `CancelCoinRequestAction` | Database unavailable          |
| Update failure            | `CancelCoinRequestAction` | Database constraint violation |

### Edge Cases

| Case                               | Behavior                                              |
| ---------------------------------- | ----------------------------------------------------- |
| Non-numeric ID (e.g., "abc")       | Returns 404 (model not found)                         |
| Already cancelled request          | Returns 403 (policy returns false)                    |
| Approved request                   | Returns 403 (not pending, can't cancel)               |
| Rejected request                   | Returns 403 (not pending, can't cancel)               |
| Expired request                    | Returns 403 (not pending, can't cancel)               |
| Soft-deleted coin request          | Returns 404 (excluded by SoftDeletes)                 |
| Cancelling as target reseller      | Returns 403 (only owner or Super Admin)               |
| Super Admin cancelling any request | Succeeds if request is pending                        |
| Concurrent cancellation attempts   | First succeeds, second gets 403 (not pending anymore) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER               ACTION                   DATABASE
    │                       │                       │                       │                       │
    │ DELETE /coin-req/1    │                       │                       │                       │
    │ Authorization: ...    │                       │                       │                       │
    │──────────────────────▶│                       │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 1. Validate token     │                       │                       │
    │                       │    (auth:sanctum)     │                       │                       │
    │                       │                       │                       │                       │
    │                       │ 2. Route-model binding│                       │                       │
    │                       │                       │                       │ 3. SELECT coin_request│
    │                       │                       │                       │───────────────────────▶
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │                       │                       │
    │                       │──────────────────────▶│                       │                       │
    │                       │ destroy($coinRequest) │                       │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 4. authorize('cancel')│                       │
    │                       │                       │    → CoinRequestPolicy│                       │
    │                       │                       │    (returns true/false)                       │
    │                       │                       │                       │                       │
    │                       │                       │ 5. Get $user from     │                       │
    │                       │                       │    request            │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 6. Execute action     │                       │
    │                       │                       │──────────────────────▶│                       │
    │                       │                       │                       │                       │
    │                       │                       │                       │ 7. Validate status    │
    │                       │                       │                       │    (canBeCancelled)   │
    │                       │                       │                       │                       │
    │                       │                       │                       │ 8. Validate permission│
    │                       │                       │                       │                       │
    │                       │                       │                       │ 9. UPDATE status      │
    │                       │                       │                       │───────────────────────▶
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │                       │                       │
    │                       │                       │                       │ 10. Refresh model     │
    │                       │                       │                       │───────────────────────▶
    │                       │                       │                       │◀──────────────────────│
    │                       │                       │                       │                       │
    │                       │                       │                       │ 11. Log::info         │
    │                       │                       │                       │                       │
    │                       │                       │◀──────────────────────│                       │
    │                       │                       │   ActionResult        │                       │
    │                       │                       │                       │                       │
    │                       │                       │ 12. Transform with    │                       │
    │                       │                       │     CoinRequestResource                       │
    │                       │                       │                       │                       │
    │                       │                       │ 13. ApiResponse::     │                       │
    │                       │                       │     success()         │                       │
    │                       │                       │                       │                       │
    │                       │◀──────────────────────│                       │                       │
    │◀──────────────────────│                       │                       │                       │
    │                       │                       │                       │                       │
    │  200 OK + JSON        │                       │                       │                       │
    │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                       | Location                                             |
| ------------------------------ | ---------------------------------------------------- |
| Pre-cancellation validation    | `CancelCoinRequestAction::execute()` (step 1-2)      |
| Post-cancellation side effect  | `CancelCoinRequestAction::execute()` (after step 4)  |
| Notification on cancel         | `CancelCoinRequestAction::execute()` (after update)  |
| Soft-delete instead of status  | `CancelCoinRequestAction::execute()` (modify step 3) |
| Additional authorization rules | `CoinRequestPolicy::cancel()`                        |

### 📝 Field Modification Guide

#### ➕ ADDING CANCELLATION METADATA

| Step  | File                                                    | What to Change              |
| ----- | ------------------------------------------------------- | --------------------------- |
| **1** | `database/migrations/` (new column)                     | Add column migration        |
| **2** | `app/Models/Economy/CoinRequest.php`                    | Add to `$fillable`          |
| **3** | `app/Actions/CoinRequest/CancelCoinRequestAction.php`   | Add to update array         |
| **4** | `app/Http/Resources/V1/Economy/CoinRequestResource.php` | Add to response (if needed) |

**Example - Adding `cancellation_reason` field:**

```php
// In CancelCoinRequestAction::execute()
$coinRequest->update([
    'status' => CoinRequestStatus::CANCELLED,
    'processed_by' => $user->id,
    'processed_at' => now(),
    'cancellation_reason' => $reason,  // New field
]);
```

#### 🔧 ADDING PRE-CANCELLATION VALIDATION

| Step  | File                                                  | What to Change              |
| ----- | ----------------------------------------------------- | --------------------------- |
| **1** | `app/Actions/CoinRequest/CancelCoinRequestAction.php` | Add validation after step 2 |

**Example - Preventing cancellation after X hours:**

```php
// After permission validation in execute()
$hoursSinceCreation = $coinRequest->created_at->diffInHours(now());
if ($hoursSinceCreation > 24) {
    return ActionResult::failure(
        errors: ['time' => ['Cannot cancel requests older than 24 hours']],
        message: 'Cancellation window expired'
    );
}
```

### 🔗 Execution Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CANCELLATION FLOW CHAIN                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Route-Model Binding (finds CoinRequest)                                    │
│       │                                                                     │
│       ▼                                                                     │
│  CoinRequestPolicy::cancel() (authorization)                                │
│       │                                                                     │
│       ▼                                                                     │
│  CancelCoinRequestAction::execute() (business logic)                        │
│       │                                                                     │
│       ├── canBeCancelled() check                                            │
│       ├── Permission check (redundant defense)                              │
│       ├── Database UPDATE                                                   │
│       └── Log::info                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  CoinRequestResource (transform response)                                   │
│       │                                                                     │
│       ▼                                                                     │
│  ApiResponse::success() (format response)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                              | Reason                                  |
| -------------------------------------- | --------------------------------------- |
| `CoinRequestPolicy::cancel()` logic    | May allow unauthorized cancellations    |
| `CancelCoinRequestAction` DB update    | Status value must match enum            |
| `processed_by` / `processed_at` fields | Audit trail integrity                   |
| Status transition (pending→cancelled)  | Business rules depend on this           |
| ActionResult structure                 | All actions depend on this contract     |
| HTTP method (DELETE)                   | RESTful convention, clients expect this |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                         |
| ----------------------------------------- | -------------------------------------------------- |
| Forgetting to check `canBeCancelled()`    | Policy and action both check (defense in depth)    |
| Not refreshing model after update         | Always call `refresh()` before returning           |
| Returning old status in response          | Refresh ensures updated data                       |
| Missing audit logging                     | Action logs success and failure                    |
| Allowing reseller to cancel user requests | Policy explicitly checks owner or Super Admin only |
| Race condition on concurrent cancels      | Second request gets 403 (status no longer pending) |
| Not handling exceptions                   | Action wraps in try-catch                          |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                             ← Route definition
app/Http/Controllers/Api/V1/Economy/
  └── CoinRequestController.php                          ← Controller (destroy method)
app/Policies/Economy/
  └── CoinRequestPolicy.php                              ← Authorization (cancel method)
app/Actions/CoinRequest/
  └── CancelCoinRequestAction.php                        ← Business logic
app/Actions/
  └── ActionResult.php                                   ← Result wrapper
app/Models/Economy/
  └── CoinRequest.php                                    ← Eloquent model
app/Http/Resources/V1/Economy/
  └── CoinRequestResource.php                            ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
app/Enums/Economy/
  └── CoinRequestStatus.php                              ← Status enum (CANCELLED)
```

---

## Document Metadata

| Property            | Value                                        |
| ------------------- | -------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/coin-requests/{coinRequest}` |
| **Domain**          | Economy                                      |
| **Author**          | System Documentation                         |
| **Created**         | 2026-02-02                                   |
| **Laravel Version** | 12.x                                         |
| **PHP Version**     | 8.4                                          |
