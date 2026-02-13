# PUT /api/v1/user/agency/coin-reseller

> **Domain**: User / Agency Membership  
> **Type**: Protected Endpoint (Owner Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

The Change Coin Reseller endpoint allows an agency owner to assign or remove a coin reseller for their agency. When updated, the reseller change cascades to all active members and the owner.

### Responsibilities

- Verify the authenticated user owns an agency
- Authorize the coin reseller change via policy
- Validate the selected user has the "Reseller" role (if provided)
- Update agency's `coin_reseller_id`
- Cascade reseller assignment to all active members' `default_reseller_id`
- Update owner's `default_reseller_id` to match

### What It Owns

| Owned                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| Agency reseller update  | Updates agency's `coin_reseller_id` field         |
| Member reseller cascade | Updates all active members' `default_reseller_id` |
| Owner reseller update   | Updates agency owner's `default_reseller_id`      |

### External Dependencies

| Dependency | Type     | Purpose                               |
| ---------- | -------- | ------------------------------------- |
| MySQL      | Database | Stores agency, member, and user data  |
| Spatie     | Package  | Role checking (`hasRole('Reseller')`) |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/user/agency/coin-reseller
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter  | Key     | Config           |
| -------- | ------- | ---------------- |
| Standard | User ID | Default throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "coin_reseller_id": "integer|null" // Optional - User ID of reseller, or null to remove
}
```

#### Field Details

| Field              | Type     | Constraints | Example                         |
| ------------------ | -------- | ----------- | ------------------------------- | ---- |
| `coin_reseller_id` | `integer | null`       | Optional, must exist in `users` | `42` |

---

### Response Schemas

#### ✅ Success Response (200) - Reseller Assigned

```json
{
  "status": "success",
  "message": "Agency coin reseller updated successfully.",
  "data": {
    "id": 1,
    "name": "My Agency",
    "country": "US",
    "logo": "https://example.com/logo.png",
    "status": "approved",
    "status_label": "Approved",
    "created_at": "2026-01-15T10:30:00.000000Z",
    "owner": {
      "id": 10,
      "name": "Agency Owner",
      "signature": "owner123"
    },
    "member_count": 15,
    "address": "123 Main Street",
    "coin_reseller": {
      "id": 42,
      "name": "Reseller User",
      "signature": "reseller42"
    }
  },
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response (200) - Reseller Removed

```json
{
  "status": "success",
  "message": "Agency coin reseller removed.",
  "data": {
    "id": 1,
    "name": "My Agency",
    "country": "US",
    "logo": "https://example.com/logo.png",
    "status": "approved",
    "status_label": "Approved",
    "created_at": "2026-01-15T10:30:00.000000Z",
    "owner": {
      "id": 10,
      "name": "Agency Owner",
      "signature": "owner123"
    },
    "member_count": 15,
    "address": "123 Main Street"
  },
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
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
    "coin_reseller_id": ["The selected coin reseller does not exist."]
  },
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthenticated Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ No Owned Agency Error (404)

```json
{
  "status": "error",
  "message": "You do not own an agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
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
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Business Logic Error (422) - Not Operational

```json
{
  "status": "error",
  "message": "Agency is not operational.",
  "data": null,
  "errors": {
    "agency_id": ["Agency is not operational."]
  },
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Business Logic Error (422) - Not a Reseller

```json
{
  "status": "error",
  "message": "Selected user is not a reseller.",
  "data": null,
  "errors": {
    "coin_reseller_id": ["User is not a reseller."]
  },
  "meta": {
    "timestamp": "2026-02-03T17:12:20.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                        |
| ----- | ------------------------------------------------ |
| `200` | Coin reseller updated/removed successfully       |
| `401` | User not authenticated                           |
| `403` | User not authorized (not owner or official)      |
| `404` | User does not own an agency                      |
| `422` | Validation error or agency not operational       |
| `500` | Database transaction failure or unexpected error |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    PUT /api/v1/user/agency/coin-reseller                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:66-67                                         │
│ Route: Route::put('/coin-reseller',                                         │
│            [AgencyMembershipController::class, 'changeCoinReseller'])       │
│        ->name('user.agency.coin-reseller')                                  │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads User                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Agency/ChangeCoinResellerRequest.php         │
│                                                                             │
│ Authorization Check:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'coin_reseller_id' => ['nullable', 'integer', 'exists:users,id']│ │
│ │     ];                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Error Messages:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'coin_reseller_id.exists' => 'The selected coin reseller does not exist.'│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php     │
│ Method: changeCoinReseller(ChangeCoinResellerRequest $request,              │
│                            ChangeCoinResellerAction $action)                │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Fetch owned agency                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $user->ownedAgency;                                           │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not own an agency.', [], 404);    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Authorize via policy                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('changeCoinReseller', $agency);                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Get validated reseller (if provided)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ $reseller = null;                                                       │ │
│ │ if (isset($validated['coin_reseller_id']) &&                            │ │
│ │     $validated['coin_reseller_id'] !== null) {                          │ │
│ │     $reseller = User::find($validated['coin_reseller_id']);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Execute action and return response                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($agency, $reseller, $user);                  │ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage() ?? 'An error occurred',                   │ │
│ │         $result->getErrors(), 422                                       │ │
│ │     );                                                                   │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AgencyResource($result->getData()),                             │ │
│ │     $result->getMessage(),                                              │ │
│ │ );                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyPolicy.php:162-166                          │
│ Method: changeCoinReseller(User $user, Agency $agency): bool                │
│                                                                             │
│ Authorization Logic:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function changeCoinReseller(User $user, Agency $agency): bool    │ │
│ │ {                                                                       │ │
│ │     // Only owner or officials can change                               │ │
│ │     return $agency->isOwnedBy($user) || $this->isOfficial($user);       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SERVICE LAYER FLOW (ACTION)                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/ChangeCoinResellerAction.php                       │
│ Method: execute(Agency $agency, ?User $reseller, User $actor): ActionResult │
│                                                                             │
│ STEP 1: Validate agency is operational                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $agency->isOperational()) {                                       │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'Agency is not operational.',                          │ │
│ │         errors: ['agency_id' => ['Agency is not operational.']],        │ │
│ │     );                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validate reseller has correct role (if provided)                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($reseller !== null && ! $reseller->hasRole('Reseller')) {           │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'Selected user is not a reseller.',                    │ │
│ │         errors: ['coin_reseller_id' => ['User is not a reseller.']],    │ │
│ │     );                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($agency, $reseller) {           │ │
│ │     // ... transaction logic                                            │ │
│ │ });                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Store old reseller for meta                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $resellerId = $reseller?->id;                                           │ │
│ │ $oldResellerId = $agency->coin_reseller_id;                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Update agency coin reseller                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency->update(['coin_reseller_id' => $resellerId]);                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Get active member IDs and cascade update                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $memberIds = $agency->activeMembers()->pluck('user_id')->toArray();     │ │
│ │ if (count($memberIds) > 0) {                                             │ │
│ │     User::whereIn('id', $memberIds)                                      │ │
│ │         ->update(['default_reseller_id' => $resellerId]);                │ │
│ │ }                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Update owner's default reseller                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ User::where('id', $agency->user_id)                                      │ │
│ │     ->update(['default_reseller_id' => $resellerId]);                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Refresh agency and load reseller relationship                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency->refresh();                                                       │ │
│ │ $agency->load('coinReseller');                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 9: Return success result with updated agency                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                            │ │
│ │     data: $agency,                                                        │ │
│ │     message: $reseller !== null                                          │ │
│ │         ? 'Agency coin reseller updated successfully.'                   │ │
│ │         : 'Agency coin reseller removed.',                               │ │
│ │     meta: [                                                               │ │
│ │         'agency_id' => $agency->id,                                       │ │
│ │         'old_reseller_id' => $oldResellerId,                              │ │
│ │         'new_reseller_id' => $resellerId,                                 │ │
│ │         'members_updated' => count($memberIds) + 1, // +1 for owner      │ │
│ │     ],                                                                     │ │
│ │ );                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ChangeCoinResellerRequest (Form Request)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Requests/Api/V1/Agency/ChangeCoinResellerRequest.php     │ │
│ │ Responsibility: Validate coin_reseller_id input                         │ │
│ │ Reusable: NO (endpoint-specific)                                        │ │
│ │ Why It Exists: Centralized validation with custom error messages        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • authorize() → Checks user is authenticated                          │ │
│ │   • rules() → Returns validation rules                                  │ │
│ │   • messages() → Custom error messages                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action outcome container                   │ │
│ │ Reusable: YES (used by all Action classes)                              │ │
│ │ Why It Exists: Consistent success/failure handling across actions       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta) → Create success result             │ │
│ │   • failure($errors, $message) → Create failure result                  │ │
│ │   • fromException($e, $message) → Create failure from exception         │ │
│ │   • isSuccess() / isFailure() → Check result status                     │ │
│ │   • getMessage() / getErrors() → Retrieve result details                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyPolicy (Authorization Policy)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Agency/AgencyPolicy.php                              │ │
│ │ Responsibility: Agency-related authorization checks                     │ │
│ │ Reusable: YES (used by all agency controllers)                          │ │
│ │ Why It Exists: Centralized authorization logic                          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • changeCoinReseller($user, $agency) → Check permission               │ │
│ │   • isOwnedBy($user) → Check ownership                                  │ │
│ │   • isOfficial($user) → Check admin/super admin role                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyResource (API Resource)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyResource.php                   │ │
│ │ Responsibility: Transform Agency model to API response                  │ │
│ │ Reusable: YES (used by all agency endpoints)                            │ │
│ │ Why It Exists: Consistent agency JSON structure                         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray($request) → Transform to array                              │ │
│ │   • canViewAgencySensitiveFields($request, $agency) → Check access      │ │
│ │                                                                         │ │
│ │ Contains coin_reseller field (loaded conditionally):                    │ │
│ │   • Returns MinimalUserResource for coinReseller when loaded            │ │
│ │   • Only visible to owner/member/admin                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Utility)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response construction                 │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent API response format                           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta, $statusCode) → Success response     │ │
│ │   • error($message, $errors, $statusCode, $meta) → Error response       │ │
│ │   • getCorrelationId() → Get or generate request correlation ID         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order within transaction):                          │
│                                                                             │
│ 1. SELECT: Get owned agency                                                 │
│    Query: SELECT * FROM agencies WHERE user_id = ? LIMIT 1                  │
│    Source: User::ownedAgency relationship (lazy loaded in controller)      │
│                                                                             │
│ 2. SELECT: Get reseller user (if provided)                                  │
│    Query: SELECT * FROM users WHERE id = ? LIMIT 1                          │
│    Source: User::find($validated['coin_reseller_id'])                       │
│                                                                             │
│ 3. UPDATE: Set agency coin reseller                                         │
│    Query: UPDATE agencies SET coin_reseller_id = ? WHERE id = ?             │
│    Source: ChangeCoinResellerAction                                         │
│                                                                             │
│ 4. SELECT: Get active member user IDs                                       │
│    Query: SELECT user_id FROM agency_members                                │
│           WHERE agency_id = ? AND status = 'active'                         │
│    Source: Agency::activeMembers()->pluck('user_id')                        │
│                                                                             │
│ 5. UPDATE: Cascade reseller to all active members                           │
│    Query: UPDATE users SET default_reseller_id = ?                          │
│           WHERE id IN (...)                                                  │
│    Source: ChangeCoinResellerAction                                         │
│                                                                             │
│ 6. UPDATE: Update owner's default reseller                                  │
│    Query: UPDATE users SET default_reseller_id = ? WHERE id = ?             │
│    Source: ChangeCoinResellerAction                                         │
│                                                                             │
│ 7. SELECT: Refresh agency model                                             │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: $agency->refresh()                                               │
│                                                                             │
│ 8. SELECT: Load coin reseller relationship                                  │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $agency->load('coinReseller')                                    │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Agency/AgencyResource.php                       │
│                                                                             │
│ The AgencyResource transforms the agency model including:                   │
│   • Basic fields: id, name, country, logo, status, status_label, created_at│
│   • Owner info: MinimalUserResource via loaded 'owner' relationship        │
│   • Member count: active_members_count for approved agencies                │
│   • Sensitive fields (for owner/member/admin):                              │
│     - address                                                               │
│     - coin_reseller (MinimalUserResource if loaded)                         │
│                                                                             │
│ Final Response via ApiResponse::success():                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                                │ │
│ │     'status' => 'success',                                               │ │
│ │     'message' => 'Agency coin reseller updated successfully.',          │ │
│ │     'data' => AgencyResource::toArray(),                                 │ │
│ │     'meta' => [                                                           │ │
│ │         'timestamp' => now()->toISOString(),                             │ │
│ │         'correlation_id' => self::getCorrelationId(),                    │ │
│ │     ],                                                                     │ │
│ │ ], 200);                                                                   │ │
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

| File                             | Used By Endpoints                              | Reusable | Reasoning                            |
| -------------------------------- | ---------------------------------------------- | -------- | ------------------------------------ |
| `AgencyMembershipController.php` | user-agency/\*, dissolve, leave, coin-reseller | ❌       | Endpoint-specific controller         |
| `ChangeCoinResellerRequest.php`  | PUT /api/v1/user/agency/coin-reseller          | ❌       | Single-purpose request validation    |
| `ChangeCoinResellerAction.php`   | PUT /api/v1/user/agency/coin-reseller          | ❌       | Single-purpose reseller action       |
| `AgencyPolicy.php`               | All agency endpoints                           | ✅       | Centralized agency authorization     |
| `AgencyResource.php`             | All agency endpoints                           | ✅       | Standard agency response format      |
| `MinimalUserResource.php`        | All endpoints returning user info              | ✅       | Minimal user data transformer        |
| `ApiResponse.php`                | All API endpoints                              | ✅       | Global response utility              |
| `ActionResult.php`               | All Action classes                             | ✅       | Global result pattern implementation |
| `Agency.php` (Model)             | All agency endpoints                           | ✅       | Core domain model                    |
| `User.php` (Model)               | All authenticated endpoints                    | ✅       | Core user model                      |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                      | Source                      | Condition                        |
| -------------------------- | --------------------------- | -------------------------------- |
| `coin_reseller_id.exists`  | `ChangeCoinResellerRequest` | User ID doesn't exist in `users` |
| `coin_reseller_id.integer` | `ChangeCoinResellerRequest` | Value is not an integer          |

### Business Logic Errors (422)

| Error                              | Source                     | Condition                         |
| ---------------------------------- | -------------------------- | --------------------------------- |
| "Agency is not operational."       | `ChangeCoinResellerAction` | Agency status is not operational  |
| "Selected user is not a reseller." | `ChangeCoinResellerAction` | User doesn't have "Reseller" role |

### Authentication Errors (401)

| Error              | Source                       | Condition                 |
| ------------------ | ---------------------------- | ------------------------- |
| "Unauthenticated." | `AgencyMembershipController` | User is not authenticated |

### Authorization Errors (403)

| Error                          | Source         | Condition                     |
| ------------------------------ | -------------- | ----------------------------- |
| "This action is unauthorized." | `AgencyPolicy` | User is not owner or official |

### Not Found Errors (404)

| Error                       | Source                       | Condition                |
| --------------------------- | ---------------------------- | ------------------------ |
| "You do not own an agency." | `AgencyMembershipController` | User has no owned agency |

### System Errors (500)

| Error                             | Source                     | Condition                    |
| --------------------------------- | -------------------------- | ---------------------------- |
| "Failed to change coin reseller." | `ChangeCoinResellerAction` | Database transaction failure |

### Edge Cases

| Case                             | Behavior                                   |
| -------------------------------- | ------------------------------------------ |
| Agency with no members           | Only owner's reseller updated (count = 1)  |
| Setting same reseller as current | Update proceeds, no-op for database values |
| Null coin_reseller_id            | Reseller removed, message reflects removal |
| Reseller user exists but no role | Returns 422 "User is not a reseller"       |
| Pending/Rejected agency          | Returns 422 "Agency is not operational"    |
| Transaction fails mid-update     | All changes rolled back                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                 POLICY               DATABASE
   │                       │                       │                    │                      │                     │
   │  PUT /user/agency/    │                       │                    │                      │                     │
   │  coin-reseller        │                       │                    │                      │                     │
   │  {coin_reseller_id:42}│                       │                    │                      │                     │
   │──────────────────────▶│                       │                    │                      │                     │
   │                       │                       │                    │                      │                     │
   │                       │ 1. auth:sanctum       │                    │                      │                     │
   │                       │──────────────────────▶│                    │                      │                     │
   │                       │                       │                    │                      │                     │
   │                       │                       │ 2. Validate request│                      │                     │
   │                       │                       │────────────────────────────────────────────────────────────────▶│
   │                       │                       │ (coin_reseller_id exists:users,id)        │                     │
   │                       │                       │◀────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │ 3. Get ownedAgency │                      │                     │
   │                       │                       │────────────────────────────────────────────────────────────────▶│
   │                       │                       │ Agency             │                      │                     │
   │                       │                       │◀────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │ 4. authorize('changeCoinReseller', $agency)                    │
   │                       │                       │──────────────────────────────────────────▶│                     │
   │                       │                       │                    │                      │ 5. isOwnedBy()      │
   │                       │                       │                    │                      │    OR isOfficial()  │
   │                       │                       │◀──────────────────────────────────────────│                     │
   │                       │                       │                    │                      │                     │
   │                       │                       │ 6. Find reseller   │                      │                     │
   │                       │                       │────────────────────────────────────────────────────────────────▶│
   │                       │                       │ User(42)           │                      │                     │
   │                       │                       │◀────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │ 7. execute($agency, $reseller, $user)     │                     │
   │                       │                       │───────────────────▶│                      │                     │
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 8. Check isOperational()                  │
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 9. Check hasRole('Reseller')              │
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 10. Begin transaction│                     │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 11. Update agency coin_reseller_id        │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │◀───────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 12. Get active member IDs                 │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │◀───────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 13. Update members' default_reseller_id   │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │◀───────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 14. Update owner's default_reseller_id    │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │◀───────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 15. Commit transaction                    │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │◀───────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │                    │ 16. Refresh & load coinReseller           │
   │                       │                       │                    │───────────────────────────────────────────▶│
   │                       │                       │                    │◀───────────────────────────────────────────│
   │                       │                       │                    │                      │                     │
   │                       │                       │◀──────────────────│ ActionResult::success│                     │
   │                       │◀──────────────────────│ AgencyResource    │                      │                     │
   │◀──────────────────────│                       │                    │                      │                     │
   │                       │                       │                    │                      │                     │
   │  200 OK + JSON        │                       │                    │                      │                     │
   │                       │                       │                    │                      │                     │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                       | Location                                                |
| ------------------------------ | ------------------------------------------------------- |
| Pre-change validation          | `ChangeCoinResellerAction::execute()` (before tx)       |
| Post-change notifications      | `ChangeCoinResellerAction::execute()` (after tx commit) |
| Reseller change history        | Add `agency_reseller_changes` table and logging         |
| Additional authorization rules | `AgencyPolicy::changeCoinReseller()`                    |
| Cache invalidation             | `ChangeCoinResellerAction::execute()` (after tx)        |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO REQUEST

| Step  | File                                                                | What to Change           |
| ----- | ------------------------------------------------------------------- | ------------------------ |
| **1** | `app/Http/Requests/Api/V1/Agency/ChangeCoinResellerRequest.php`     | Add validation rule      |
| **2** | `app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php` | Pass to action           |
| **3** | `app/Actions/Agency/ChangeCoinResellerAction.php`                   | Accept and use parameter |

#### ➕ ADDING RESELLER CHANGE NOTIFICATION

| Step  | File                                              | What to Change               |
| ----- | ------------------------------------------------- | ---------------------------- |
| **1** | `app/Actions/Agency/ChangeCoinResellerAction.php` | Inject MSABEventService      |
| **2** | `app/Actions/Agency/ChangeCoinResellerAction.php` | Emit event after transaction |
| **3** | `app/Services/Realtime/MSABEventService.php`          | Add `emitResellerChanged()`  |

#### ➖ REMOVING MEMBER CASCADE

To stop cascading reseller change to members:

| Step  | File                                              | What to Change                   |
| ----- | ------------------------------------------------- | -------------------------------- |
| **1** | `app/Actions/Agency/ChangeCoinResellerAction.php` | Remove steps 6-7 (member update) |

### 🔗 Field Flow Dependency Chain

```
PUT Request with coin_reseller_id
       │
       ▼
┌──────────────────────────┐
│ ChangeCoinResellerRequest│ ─────────────── Validates coin_reseller_id
│   • nullable             │
│   • integer              │
│   • exists:users,id      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ User.ownedAgency         │ ─────────────── Agency exists check
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ AgencyPolicy             │ ─────────────── Authorization check
│   ::changeCoinReseller() │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ChangeCoinResellerAction         │
│   │                              │
│   ├─ isOperational() check       │
│   ├─ hasRole('Reseller') check   │
│   │                              │
│   ├─ agency.coin_reseller_id     │ → new reseller ID or null
│   ├─ members[].default_reseller_id│ → cascaded to all active members
│   └─ owner.default_reseller_id   │ → updated for agency owner
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────┐
│ AgencyResource           │ ─────────────── Response transformation
│   • coin_reseller field  │
└──────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding Reseller Change Reason Field

- [ ] Update `ChangeCoinResellerRequest` (add `reason` validation)
- [ ] Update `ChangeCoinResellerAction` (accept reason parameter)
- [ ] Create migration for `agency_reseller_changes` audit table
- [ ] Log change with reason in action

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                           |
| --------------------------- | ------------------------------------------------ |
| `DB::transaction()` wrapper | Ensures atomicity of agency + member updates     |
| Member cascade logic        | Members rely on `default_reseller_id` for coins  |
| Owner update logic          | Owner must also receive reseller assignment      |
| `hasRole('Reseller')` check | Prevents non-resellers from being assigned       |
| `isOperational()` check     | Ensures only active agencies can change reseller |

### 🚨 Common Pitfalls

| Pitfall                             | Prevention                                         |
| ----------------------------------- | -------------------------------------------------- |
| Forgetting to check Reseller role   | Action already validates `hasRole('Reseller')`     |
| Not cascading to members            | Keep member update logic in transaction            |
| Orphaned owner reseller             | Always update owner in same transaction as members |
| Invalid reseller ID                 | FormRequest validates `exists:users,id`            |
| Setting reseller on inactive agency | Action checks `isOperational()` first              |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:66-67                                ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyMembershipController.php                         ← Controller
app/Http/Requests/Api/V1/Agency/
  └── ChangeCoinResellerRequest.php                          ← Request validation
app/Actions/Agency/
  └── ChangeCoinResellerAction.php                           ← Business logic
app/Policies/Agency/
  └── AgencyPolicy.php                                       ← Authorization
app/Http/Resources/V1/Agency/
  └── AgencyResource.php                                     ← Response transformer
app/Models/Agency/
  └── Agency.php                                             ← Agency model
app/Models/User/
  └── User.php                                               ← User model
app/Actions/
  └── ActionResult.php                                       ← Result pattern
app/Http/Utils/
  └── ApiResponse.php                                        ← Response utility
```

---

## Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `PUT /api/v1/user/agency/coin-reseller` |
| **Domain**          | User / Agency Membership                |
| **Author**          | System Documentation                    |
| **Created**         | 2026-02-03                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
