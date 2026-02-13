# POST /api/v1/agencies/{agency}/join

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Submit a request to join a specific agency. Creates a pending join request record that can be approved or rejected by the agency owner or admin.

### Responsibilities

- Validate incoming request data (optional message field)
- Create a new join request with pending status
- Verify the user is not already a member or blocked by the agency
- Check for existing pending requests to prevent duplicates
- Emit real-time notification to agency owner via MSAB event service
- Return the created join request with associated user and agency data

### What It Owns

| Owned                  | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| Join request creation  | Creates new `agency_join_requests` record                   |
| Duplicate prevention   | Ensures only one pending request per user-agency pair       |
| Real-time notification | Emits MSAB event to notify agency owner of new join request |

### External Dependencies

| Dependency   | Type           | Purpose                                                |
| ------------ | -------------- | ------------------------------------------------------ |
| Database     | Infrastructure | Create join request record, check existing memberships |
| Sanctum      | Auth Package   | Bearer token authentication                            |
| MSAB (Redis) | Real-time      | Notify agency owner of new join request                |
| Rate Limiter | Middleware     | Throttle join requests (10 per minute)                 |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/agencies/{agency}/join
```

### Authentication

✅ **Required** - Valid Sanctum Bearer token

### Rate Limiting

| Limiter    | Key    | Config                                                    |
| ---------- | ------ | --------------------------------------------------------- |
| `throttle` | `10,1` | 10 requests per minute per user (custom endpoint limiter) |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type      | Required | Description                     |
| --------- | --------- | -------- | ------------------------------- |
| `agency`  | `integer` | ✅       | Agency ID (route model binding) |

### Request Body Schema

```json
{
  "message": "string|null" // Optional, max 500 characters - reason for joining
}
```

#### Field Details

| Field     | Type     | Constraints            | Example                         |
| --------- | -------- | ---------------------- | ------------------------------- |
| `message` | `string` | Optional, max 500 char | `"I'd love to join your team!"` |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Join request submitted successfully.",
  "data": {
    "id": 123,
    "status": "pending",
    "status_label": "Pending",
    "message": "I'd love to join your team!",
    "created_at": "2026-02-03T03:28:58.000000Z",
    "can_be_processed": true,
    "can_be_cancelled": true,
    "agency": {
      "id": 1,
      "name": "Super Stars Agency",
      "country": "US",
      "logo": "https://imagekit.io/..."
    },
    "user": {
      "id": 456,
      "name": "John Doe",
      "signature": "sig_abc123",
      "avatar": "https://imagekit.io/...",
      "frame": "frame_001",
      "gender": "male",
      "email": "john@example.com",
      "phone": "+1234567890",
      "country": "US",
      "date_of_birth": "1990-01-15",
      "wealth_xp": "15000",
      "charm_xp": "8500"
    }
  },
  "meta": {
    "timestamp": "2026-02-03T03:28:58.000000Z",
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
    "message": ["The join request message cannot exceed 500 characters."]
  },
  "meta": {
    "timestamp": "2026-02-03T03:28:58.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "You already have a pending join request for this agency.",
  "data": null,
  "errors": {
    "user_id": ["Pending request already exists."]
  },
  "meta": {
    "timestamp": "2026-02-03T03:28:58.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "message": "Agency not found"
}
```

#### ❌ Rate Limited (429)

```json
{
  "message": "Too Many Attempts."
}
```

### HTTP Status Codes

| Code  | Condition                                              |
| ----- | ------------------------------------------------------ |
| `201` | Join request created successfully                      |
| `401` | No valid authentication token                          |
| `404` | Agency ID does not exist (route model binding fail)    |
| `422` | Validation error or business logic prevented creation  |
| `429` | Rate limit exceeded (more than 10 requests per minute) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              POST /api/v1/agencies/{agency}/join                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:37-40                                         │
│ Route: Route::post('/{agency}/join', [AgencyController::class, 'join'])     │
│        ->middleware('throttle:10,1')                                        │
│        ->name('agencies.join')                                              │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, resolves authenticated user   │
│   2. throttle:10,1 → Limits to 10 requests per minute per user             │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {agency} → Resolved to App\Models\Agency\Agency via implicit binding   │
│   • If not found → 404 response automatically                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Agency/JoinAgencyRequest.php                 │
│                                                                             │
│ Form Request Validation:                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'message' => ['nullable', 'string', 'max:500'],                │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Custom messages():                                                      │ │
│ │   'message.max' => 'The join request message cannot exceed 500 chars.' │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Authorization:                                                              │
│   • authorize() returns true (no additional checks in request)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:159-188       │
│ Method: join(JoinAgencyRequest $request, Agency $agency,                    │
│              CreateJoinRequestAction $action): JsonResponse                 │
│                                                                             │
│ STEP 1: Get Authenticated User                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Create DTO from Validated Data                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = JoinRequestDTO::fromArray([                                      │ │
│ │     'agency_id' => $agency->id,                                         │ │
│ │     'user_id' => $user->id,                                             │ │
│ │     'message' => $request->validated('message'),                        │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ Maps request + route data → immutable DTO                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute Action                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($dto);                                       │ │
│ │                                                                         │ │
│ │ Action encapsulates all business logic                                  │ │
│ │ Returns ActionResult (success/failure with data)                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Handle Action Result                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage() ?? 'An error occurred',                   │ │
│ │         $result->getErrors(),                                           │ │
│ │         422                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AgencyJoinRequestResource($result->getData()),                  │ │
│ │     $result->getMessage() ?? 'Join request submitted',                  │ │
│ │     [],                                                                 │ │
│ │     201                                                                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/CreateJoinRequestAction.php:21-126                 │
│ Method: execute(JoinRequestDTO $dto): ActionResult                          │
│                                                                             │
│ STEP 1: Validate Agency Exists                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = Agency::find($dto->agencyId);                                 │ │
│ │                                                                         │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'Agency not found.',                                   │ │
│ │         errors: ['agency_id' => ['Agency not found.']],                │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check Agency is Operational                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $agency->isOperational()) {                                       │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This agency is not accepting join requests.',         │ │
│ │         errors: ['agency_id' => ['Agency is not operational.']],       │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ isOperational() → status === AgencyStatus::APPROVED                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Validate User Exists                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = User::find($dto->userId);                                       │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'User not found.',                                     │ │
│ │         errors: ['user_id' => ['User not found.']],                    │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Check User is NOT Already a Member                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->hasMember($user)) {                                        │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You are already a member of this agency.',            │ │
│ │         errors: ['user_id' => ['Already a member.']],                  │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ hasMember() → checks activeMembers()->where('user_id', $userId)->exists │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Check User is NOT Blocked by Agency                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $isBlocked = AgencyUserBlock::where('agency_id', $dto->agencyId)        │ │
│ │     ->where('user_id', $dto->userId)                                    │ │
│ │     ->where('blocker_type', AgencyBlockerType::AGENCY)                  │ │
│ │     ->exists();                                                         │ │
│ │                                                                         │ │
│ │ if ($isBlocked) {                                                       │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You are not allowed to send join requests...',        │ │
│ │         errors: ['user_id' => ['Blocked by agency.']],                 │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Check for Existing Pending Request                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $hasPendingRequest = AgencyJoinRequest::where('agency_id', $dto->...)   │ │
│ │     ->where('user_id', $dto->userId)                                    │ │
│ │     ->pending()  // scope: status = 'pending'                          │ │
│ │     ->exists();                                                         │ │
│ │                                                                         │ │
│ │ if ($hasPendingRequest) {                                               │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You already have a pending join request...',          │ │
│ │         errors: ['user_id' => ['Pending request already exists.']],    │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Create Join Request in Transaction                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($dto) {                         │ │
│ │     $request = AgencyJoinRequest::create([                              │ │
│ │         'agency_id' => $dto->agencyId,                                  │ │
│ │         'user_id' => $dto->userId,                                      │ │
│ │         'message' => $dto->message,                                     │ │
│ │         'status' => AgencyJoinRequestStatus::PENDING,                   │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     $request->load(['agency', 'user']);                                 │ │
│ │                                                                         │ │
│ │     // Real-time notification                                           │ │
│ │     $this->msabEventService->emitAgencyJoinRequest(                     │ │
│ │         $request->id,                                                   │ │
│ │         $request->agency->user_id, // Agency owner                      │ │
│ │         $request->user_id,                                              │ │
│ │         $request->user->name,                                           │ │
│ │         $request->user->avatar,                                         │ │
│ │         $request->message                                               │ │
│ │     );                                                                  │ │
│ │                                                                         │ │
│ │     return ActionResult::success(                                       │ │
│ │         data: $request,                                                 │ │
│ │         message: 'Join request submitted successfully.',                │ │
│ │         meta: ['request_id' => $request->id, 'agency_id' => ...]       │ │
│ │     );                                                                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EXCEPTION HANDLING:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ } catch (\Throwable $e) {                                               │ │
│ │     return ActionResult::fromException($e, 'Failed to submit...');      │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Captures any database or system errors                                  │ │
│ │ Returns unified failure format with exception details                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: JoinRequestDTO (Data Transfer Object)                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Agency/JoinRequestDTO.php                                │ │
│ │ Responsibility: Immutable data container for join request data          │ │
│ │ Reusable: YES (used by CreateJoinRequestAction)                         │ │
│ │ Why It Exists: Decouples controller from action, type-safe data flow    │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • agencyId: int (readonly)                                            │ │
│ │   • userId: int (readonly)                                              │ │
│ │   • message: ?string (readonly)                                         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray(array) → static factory method                           │ │
│ │   • toArray() → back to associative array                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Unified success/failure container for action results    │ │
│ │ Reusable: YES (used by all action classes)                              │ │
│ │ Why It Exists: Eliminates exceptions for business logic, explicit flow  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(data, message, meta) → create success result               │ │
│ │   • failure(errors, message) → create failure result                   │ │
│ │   • fromException(Throwable) → wrap exceptions                         │ │
│ │   • isSuccess() / isFailure() → check outcome                          │ │
│ │   • getData() / getErrors() / getMessage() → access data               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MSABEventService (Real-time Events)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Realtime/MSABEventService.php                            │ │
│ │ Responsibility: Emit real-time events to MSAB server via Redis pub/sub  │ │
│ │ Reusable: YES (used across multiple domains)                            │ │
│ │ Why It Exists: Push notifications to connected clients in real-time     │ │
│ │                                                                         │ │
│ │ Key Method Used:                                                        │ │
│ │   • emitAgencyJoinRequest(requestId, ownerId, userId, name, avatar, msg)│ │
│ │     → Publishes 'agency.join_request' event to owner's channel          │ │
│ │     → Payload: request_id, user info, message                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequest (Model)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyJoinRequest.php                           │ │
│ │ Responsibility: Eloquent model for join request records                 │ │
│ │ Reusable: YES (used by all join request operations)                     │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • agency() → BelongsTo Agency                                         │ │
│ │   • user() → BelongsTo User (requester)                                 │ │
│ │   • processor() → BelongsTo User (who approved/rejected)                │ │
│ │                                                                         │ │
│ │ Key Scopes:                                                             │ │
│ │   • pending() → WHERE status = 'pending'                                │ │
│ │   • byAgency(int) → filter by agency                                    │ │
│ │   • byUser(int) → filter by user                                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isPending() → check if status is pending                           │ │
│ │   • canBeProcessed() → status->canBeProcessed()                        │ │
│ │   • canBeCancelled() → isPending()                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestStatus (Enum)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyJoinRequestStatus.php                      │ │
│ │ Responsibility: Define join request lifecycle states                    │ │
│ │ Reusable: YES (used across agency domain)                               │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • PENDING = 'pending'     → Initial state                             │ │
│ │   • APPROVED = 'approved'   → Agency accepted request                   │ │
│ │   • REJECTED = 'rejected'   → Agency declined request                   │ │
│ │   • CANCELLED = 'cancelled' → User withdrew request                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → human-readable label                                      │ │
│ │   • isFinal() → true for APPROVED, REJECTED, CANCELLED                  │ │
│ │   • canBeProcessed() → true only for PENDING                            │ │
│ │   • color() → Filament UI color                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Helper)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response construction                 │ │
│ │ Reusable: YES (used across all API controllers)                         │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(data, message, meta, statusCode) → 2xx response            │ │
│ │   • error(message, errors, statusCode) → 4xx/5xx response              │ │
│ │   • unauthorized(message) → 401 response                               │ │
│ │                                                                         │ │
│ │ Response Structure:                                                     │ │
│ │   { status, message, data, meta: { timestamp, correlation_id } }       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. [SELECT]: Agency by ID (via route model binding)                         │
│    Query: SELECT * FROM agencies WHERE id = ? AND deleted_at IS NULL        │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. [SELECT]: Agency verification (in action)                                │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: Agency::find($dto->agencyId)                                     │
│                                                                             │
│ 3. [SELECT]: User verification                                              │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: User::find($dto->userId)                                         │
│                                                                             │
│ 4. [SELECT]: Check active membership                                        │
│    Query: SELECT COUNT(*) FROM agency_members                               │
│           WHERE agency_id = ? AND user_id = ? AND status = 'active'         │
│    Source: $agency->hasMember($user) → activeMembers()->where(...)->exists()│
│                                                                             │
│ 5. [SELECT]: Check if user is blocked                                       │
│    Query: SELECT COUNT(*) FROM agency_user_blocks                           │
│           WHERE agency_id = ? AND user_id = ? AND blocker_type = 'agency'   │
│    Source: AgencyUserBlock::where(...)->exists()                            │
│    Index Used: Composite index                                              │
│                                                                             │
│ 6. [SELECT]: Check for pending request                                      │
│    Query: SELECT COUNT(*) FROM agency_join_requests                         │
│           WHERE agency_id = ? AND user_id = ? AND status = 'pending'        │
│    Source: AgencyJoinRequest::where(...)->pending()->exists()               │
│    Index Used: agency_join_requests_pending_check_idx                       │
│                                                                             │
│ 7. [INSERT]: Create join request (in transaction)                           │
│    Query: INSERT INTO agency_join_requests                                  │
│           (agency_id, user_id, message, status, created_at, updated_at)     │
│           VALUES (?, ?, ?, 'pending', now(), now())                         │
│    Source: AgencyJoinRequest::create([...])                                 │
│                                                                             │
│ 8. [SELECT]: Eager load agency                                              │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: $request->load(['agency'])                                       │
│                                                                             │
│ 9. [SELECT]: Eager load user                                                │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $request->load(['user'])                                         │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Join requests are dynamic data, not cached                         │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   MSAB Event: Dispatched to emit queue (via Redis pub/sub)                  │
│     Event: 'agency.join_request'                                            │
│     Target: Agency owner (user_id from agency)                              │
│     Payload: request_id, user info, message                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php:24-64      │
│                                                                             │
│ BASE FIELDS (always included):                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = [                                                               │ │
│ │     'id' => $joinRequest->id,                                           │ │
│ │     'status' => $joinRequest->status->value,          // 'pending'     │ │
│ │     'status_label' => $joinRequest->status->label(),  // 'Pending'     │ │
│ │     'message' => $joinRequest->message,                                 │ │
│ │     'created_at' => $joinRequest->created_at->toISOString(),            │ │
│ │     'can_be_processed' => $joinRequest->canBeProcessed(),  // true     │ │
│ │     'can_be_cancelled' => $joinRequest->canBeCancelled(),  // true     │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Agency Info (if relation loaded)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($joinRequest->relationLoaded('agency')) {                           │ │
│ │     $data['agency'] = [                                                 │ │
│ │         'id' => $joinRequest->agency->id,                               │ │
│ │         'name' => $joinRequest->agency->name,                           │ │
│ │         'country' => $joinRequest->agency->country,                     │ │
│ │         'logo' => $joinRequest->agency->logo,                           │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: User Info (if relation loaded)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($joinRequest->relationLoaded('user')) {                             │ │
│ │     $data['user'] = new MinimalUserResource($joinRequest->user);        │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ MinimalUserResource includes:                                           │ │
│ │   id, name, signature, avatar, frame, gender, email, phone, country,    │ │
│ │   date_of_birth, wealth_xp, charm_xp                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Processed Info (for completed requests)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($joinRequest->processed_at !== null) {                              │ │
│ │     $data['processed_at'] = $joinRequest->processed_at->toISOString();  │ │
│ │                                                                         │ │
│ │     if ($joinRequest->relationLoaded('processor')                       │ │
│ │         && $joinRequest->processor !== null) {                          │ │
│ │         $data['processed_by'] = new MinimalUserResource(...);           │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Note: For new requests, processed_at is null so this block is skipped   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL RESPONSE (wrapped by ApiResponse::success()):                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Join request submitted successfully.",                    │ │
│ │   "data": { ...resource toArray() output... },                         │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "ISO8601 datetime",                                    │ │
│ │     "correlation_id": "uuid"                                            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
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

| File                            | Used By Endpoints                 | Reusable | Reasoning                                  |
| ------------------------------- | --------------------------------- | -------- | ------------------------------------------ |
| `AgencyController.php`          | All agency endpoints              | ⭕       | Contains multiple agency methods           |
| `JoinAgencyRequest.php`         | `join` endpoint only              | ❌       | Specific validation for join requests      |
| `JoinRequestDTO.php`            | `CreateJoinRequestAction`         | ⭕       | Used by join action, could support updates |
| `CreateJoinRequestAction.php`   | `join` endpoint only              | ❌       | Single-purpose action for join request     |
| `AgencyJoinRequest.php` (Model) | All join request operations       | ✅       | Core model used throughout                 |
| `AgencyJoinRequestResource.php` | Join request views/responses      | ✅       | Reused for list, show, create responses    |
| `AgencyJoinRequestStatus.php`   | All join request operations       | ✅       | Status enum used across agency domain      |
| `MSABEventService.php`          | Many domains (gifts, agency, etc) | ✅       | Centralized real-time event emission       |
| `ActionResult.php`              | All action classes                | ✅       | Standard result pattern across application |
| `ApiResponse.php`               | All API controllers               | ✅       | Standard response formatting               |
| `MinimalUserResource.php`       | Many endpoints across domains     | ✅       | Generic minimal user representation        |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error            | Source              | Condition                 |
| ---------------- | ------------------- | ------------------------- |
| `message.max`    | `JoinAgencyRequest` | Message exceeds 500 chars |
| `message.string` | `JoinAgencyRequest` | Message is not a string   |

### Business Logic Errors (422)

| Error                                            | Source                    | Condition                                          |
| ------------------------------------------------ | ------------------------- | -------------------------------------------------- |
| `"Agency not found."`                            | `CreateJoinRequestAction` | Agency ID doesn't exist (redundant with 404)       |
| `"This agency is not accepting join requests."`  | `CreateJoinRequestAction` | Agency status is not APPROVED                      |
| `"User not found."`                              | `CreateJoinRequestAction` | User ID doesn't exist (edge case, shouldn't occur) |
| `"You are already a member of this agency."`     | `CreateJoinRequestAction` | User is already an active member                   |
| `"You are not allowed to send join requests..."` | `CreateJoinRequestAction` | Agency has blocked this user                       |
| `"You already have a pending join request..."`   | `CreateJoinRequestAction` | Pending request already exists for this pair       |

### System Errors (500)

| Error                              | Source                    | Condition                   |
| ---------------------------------- | ------------------------- | --------------------------- |
| `"Failed to submit join request."` | `CreateJoinRequestAction` | Database transaction failed |

### Not Found Errors (404)

| Error                | Source              | Condition                                  |
| -------------------- | ------------------- | ------------------------------------------ |
| `"Agency not found"` | Route Model Binding | Agency ID doesn't exist or is soft-deleted |

### Rate Limit Errors (429)

| Error                  | Source          | Condition                             |
| ---------------------- | --------------- | ------------------------------------- |
| `"Too Many Attempts."` | `throttle:10,1` | More than 10 join requests per minute |

### Authentication Errors (401)

| Error                | Source         | Condition                       |
| -------------------- | -------------- | ------------------------------- |
| `"Unauthenticated."` | `auth:sanctum` | Missing or invalid Bearer token |

### Edge Cases

| Case                                      | Behavior                                                    |
| ----------------------------------------- | ----------------------------------------------------------- |
| User joins agency they previously left    | Allowed (membership status was left/kicked, not active)     |
| User sends request without message        | Allowed (message is nullable)                               |
| User blocked by agency, then unblocked    | After unblock, can submit join request again                |
| Approved request exists, user submits new | Allowed (pending check only, approved requests don't block) |
| Rejected request exists, user re-applies  | Allowed (pending check only, rejected requests don't block) |
| Agency owner joins their own agency       | Fails (owner is already a member in agency_members)         |
| Request during high concurrency           | DB transaction ensures atomicity                            |
| MSAB event fails                          | Logged but doesn't fail request (fire-and-forget)           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT             MIDDLEWARE           CONTROLLER           ACTION              MODEL/SERVICE          DATABASE/QUEUE
   │                    │                    │                   │                      │                     │
   │  POST /agencies/1/join                  │                   │                      │                     │
   │────────────────────▶│                   │                   │                      │                     │
   │                    │                   │                   │                      │                     │
   │                    │ 1. auth:sanctum   │                   │                      │                     │
   │                    │──────────────────────────────────────────────────────────────────────────────────▶│
   │                    │                   │                   │                      │ Validate token       │
   │                    │◀──────────────────────────────────────────────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │ 2. throttle:10,1  │                   │                      │                     │
   │                    │ (rate limit check)│                   │                      │                     │
   │                    │                   │                   │                      │                     │
   │                    │ 3. Route Model Bind                   │                      │                     │
   │                    │──────────────────────────────────────────────────────────────────────────────────▶│
   │                    │                   │                   │                      │ SELECT agency        │
   │                    │◀──────────────────────────────────────────────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │ 4. JoinAgencyRequest validation       │                      │                     │
   │                    │ (message: nullable, max:500)          │                      │                     │
   │                    │                   │                   │                      │                     │
   │                    │ 5. join(Request, Agency)              │                      │                     │
   │                    │──────────────────▶│                   │                      │                     │
   │                    │                   │                   │                      │                     │
   │                    │                   │ 6. Create DTO     │                      │                     │
   │                    │                   │────────────────────────────────────────▶│                     │
   │                    │                   │                   │ JoinRequestDTO       │                     │
   │                    │                   │                   │                      │                     │
   │                    │                   │ 7. execute(DTO)   │                      │                     │
   │                    │                   │──────────────────▶│                      │                     │
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 8. Check agency operational               │
   │                    │                   │                   │──────────────────────────────────────────▶│
   │                    │                   │                   │                      │ SELECT agency        │
   │                    │                   │                   │◀──────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 9. Check hasMember()                      │
   │                    │                   │                   │──────────────────────────────────────────▶│
   │                    │                   │                   │                      │ COUNT agency_members │
   │                    │                   │                   │◀──────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 10. Check blocked                         │
   │                    │                   │                   │──────────────────────────────────────────▶│
   │                    │                   │                   │                      │ COUNT blocks         │
   │                    │                   │                   │◀──────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 11. Check pending request                 │
   │                    │                   │                   │──────────────────────────────────────────▶│
   │                    │                   │                   │                      │ COUNT join_requests  │
   │                    │                   │                   │◀──────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 12. DB::transaction  │                     │
   │                    │                   │                   │──────────────────────────────────────────▶│
   │                    │                   │                   │                      │ BEGIN                │
   │                    │                   │                   │                      │ INSERT join_request  │
   │                    │                   │                   │                      │ COMMIT               │
   │                    │                   │                   │◀──────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 13. load(['agency', 'user'])              │
   │                    │                   │                   │──────────────────────────────────────────▶│
   │                    │                   │                   │                      │ SELECT agency, user  │
   │                    │                   │                   │◀──────────────────────────────────────────│
   │                    │                   │                   │                      │                     │
   │                    │                   │                   │ 14. MSAB Event       │                     │
   │                    │                   │                   │─────────────────────▶│                     │
   │                    │                   │                   │                      │ 15. Redis pub/sub    │
   │                    │                   │                   │                      │────────────────────▶│
   │                    │                   │                   │                      │◀────────────────────│
   │                    │                   │                   │◀─────────────────────│                     │
   │                    │                   │                   │                      │                     │
   │                    │                   │ ActionResult::success                    │                     │
   │                    │                   │◀──────────────────│                      │                     │
   │                    │                   │                   │                      │                     │
   │                    │                   │ 16. ApiResponse::success(Resource, 201)  │                     │
   │                    │◀──────────────────│                   │                      │                     │
   │◀────────────────────│                   │                   │                      │                     │
   │                    │                   │                   │                      │                     │
   │  201 + JSON        │                   │                   │                      │                     │
   │                    │                   │                   │                      │                     │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location(s)                                             |
| ------------------------------- | ------------------------------------------------------- |
| New validation rule for message | `JoinAgencyRequest::rules()`                            |
| New field in join request       | Migration → Model::$fillable → DTO → Action → Resource  |
| Additional business rule        | `CreateJoinRequestAction::execute()` before transaction |
| New MSAB event                  | `MSABEventService` with new emit method                 |
| Rate limit adjustment           | `routes/api/agencies.php` throttle middleware           |
| New join request status         | `AgencyJoinRequestStatus` enum + state machine logic    |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO JOIN REQUEST

| Step  | File                                                          | What to Change                   |
| ----- | ------------------------------------------------------------- | -------------------------------- |
| **1** | `database/migrations/xxxx_add_field_agency_join_requests.php` | Add column                       |
| **2** | `app/Models/Agency/AgencyJoinRequest.php`                     | Add to `$fillable` array         |
| **3** | `app/DTOs/Agency/JoinRequestDTO.php`                          | Add property + fromArray/toArray |
| **4** | `app/Http/Requests/Api/V1/Agency/JoinAgencyRequest.php`       | Add validation rule              |
| **5** | `app/Actions/Agency/CreateJoinRequestAction.php`              | Use DTO property in create()     |
| **6** | `app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php`  | Add to toArray() output          |

#### ➖ REMOVING A FIELD FROM JOIN REQUEST

| Step  | File                                                         | What to Change               |
| ----- | ------------------------------------------------------------ | ---------------------------- |
| **1** | `app/Http/Requests/Api/V1/Agency/JoinAgencyRequest.php`      | Remove validation rule       |
| **2** | `app/DTOs/Agency/JoinRequestDTO.php`                         | Remove property              |
| **3** | `app/Actions/Agency/CreateJoinRequestAction.php`             | Remove from create() array   |
| **4** | `app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php` | Remove from toArray() output |
| **5** | (Optional) database migration                                | Drop column if safe          |

#### ➕ ADDING A NEW BUSINESS RULE

| Step  | File                                             | What to Change                     |
| ----- | ------------------------------------------------ | ---------------------------------- |
| **1** | `app/Actions/Agency/CreateJoinRequestAction.php` | Add check before transaction block |
| **2** | Add return `ActionResult::failure()` if fails    | With message and errors array      |

### 🔗 Field Flow Dependency Chain

```
Request Body (JSON)
        │
        ▼
JoinAgencyRequest::rules()
        │
        │── Validates: message (nullable, string, max:500)
        │
        ▼
AgencyController::join()
        │
        │── Creates JoinRequestDTO::fromArray([
        │       'agency_id' => $agency->id,
        │       'user_id' => $user->id,
        │       'message' => $request->validated('message'),
        │   ])
        │
        ▼
CreateJoinRequestAction::execute(JoinRequestDTO)
        │
        │── Validates: agency operational, user not member, not blocked, no pending
        │── Transaction: AgencyJoinRequest::create([...])
        │── Side effect: MSABEventService->emitAgencyJoinRequest()
        │
        ▼
AgencyJoinRequest Model
        │
        │── $fillable: agency_id, user_id, message, status, processed_by, processed_at
        │── casts(): status => AgencyJoinRequestStatus, processed_at => datetime
        │── relations: agency(), user(), processor()
        │
        ▼
AgencyJoinRequestResource::toArray()
        │
        │── Base fields: id, status, status_label, message, created_at, can_*
        │── Conditional: agency (if loaded), user (if loaded), processed_* (if set)
        │
        ▼
ApiResponse::success(Resource, message, [], 201)
        │
        └── { status, message, data, meta: { timestamp, correlation_id } }
```

### 📋 Field Modification Checklists

#### Adding a New Join Request Field

- [ ] Create database migration
- [ ] Add to `AgencyJoinRequest::$fillable`
- [ ] Add to `AgencyJoinRequest::casts()` if needed (enum/date)
- [ ] Add property to `JoinRequestDTO`
- [ ] Update `JoinRequestDTO::fromArray()` and `toArray()`
- [ ] Add validation to `JoinAgencyRequest::rules()`
- [ ] Update `CreateJoinRequestAction` to use new field
- [ ] Add to `AgencyJoinRequestResource::toArray()`
- [ ] Update API documentation

#### Adding a New Validation Rule

- [ ] Add rule in `JoinAgencyRequest::rules()`
- [ ] Add custom message in `JoinAgencyRequest::messages()` if needed
- [ ] Update API documentation with new constraint

### ⚠️ What Should NOT Be Modified Casually

| Component               | Reason                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `isOperational()` check | Only approved agencies should accept join requests          |
| `hasMember()` check     | Prevents duplicate membership                               |
| Block check order       | Agency-level block should be checked before pending request |
| `pending()` scope       | Only one pending request per user-agency pair allowed       |
| DB transaction wrapping | Ensures atomicity of create + load operations               |
| MSAB event emission     | Agency owners rely on real-time notifications               |
| Rate limiting (10/min)  | Prevents abuse/spam of join requests                        |
| ActionResult pattern    | Consistent error handling across all actions                |

### 🚨 Common Pitfalls

| Pitfall                                      | Prevention                                                   |
| -------------------------------------------- | ------------------------------------------------------------ |
| Removing pending check allows duplicates     | Always check for existing pending before insert              |
| Changing status enum values                  | Breaking change for all clients, coordinate migration        |
| Not wrapping in transaction                  | Race condition could create duplicates                       |
| MSAB event with unchecked data               | Always validate user data exists before emitting             |
| Rate limit too strict                        | Users may legitimately apply to multiple agencies quickly    |
| Rate limit too loose                         | Spam/abuse of join request system                            |
| Forgetting to load relations before resource | Response will be missing agency/user data                    |
| Not handling exception in action             | Unexpected errors could leak to client                       |
| Modifying block check to user type           | AGENCY blocker type = agency blocked user, not user blocking |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:37-40                               ← Route definition with rate limit
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php:159-188                           ← Controller join() method
app/Http/Requests/Api/V1/Agency/
  └── JoinAgencyRequest.php                                  ← Form Request validation
app/DTOs/Agency/
  └── JoinRequestDTO.php                                     ← Data transfer object
app/Actions/Agency/
  └── CreateJoinRequestAction.php                            ← Business logic action
app/Models/Agency/
  ├── Agency.php                                             ← Agency model (isOperational, hasMember)
  ├── AgencyJoinRequest.php                                  ← Join request model
  └── AgencyUserBlock.php                                    ← Block records
app/Enums/Agency/
  ├── AgencyStatus.php                                       ← Agency status enum
  ├── AgencyJoinRequestStatus.php                            ← Join request status enum
  └── AgencyBlockerType.php                                  ← Block type enum (AGENCY/USER)
app/Services/Gift/
  └── MSABEventService.php                                   ← Real-time event emission
app/Http/Resources/V1/Agency/
  └── AgencyJoinRequestResource.php                          ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                                ← Embedded user resource
app/Actions/
  └── ActionResult.php                                       ← Result pattern utility
app/Http/Utils/
  └── ApiResponse.php                                        ← Response helper
database/migrations/
  └── 2025_12_27_000004_create_agency_join_requests_table.php ← Table schema
```

---

## Document Metadata

| Property            | Value                                 |
| ------------------- | ------------------------------------- |
| **Endpoint**        | `POST /api/v1/agencies/{agency}/join` |
| **Domain**          | Agency                                |
| **Author**          | System Documentation                  |
| **Created**         | 2026-02-03                            |
| **Laravel Version** | 12.x                                  |
| **PHP Version**     | 8.4                                   |
