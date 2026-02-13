# POST /api/v1/invitations/{invitation}/accept

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Accept an agency invitation and become a member of the agency. This endpoint allows an invited user to join an agency that has sent them an invitation.

### Responsibilities

- Validate that the authenticated user is the invitation recipient
- Verify the invitation is pending and not expired
- Verify the agency is still operational
- Create or update agency membership record
- Inherit agency's coin reseller preference
- Update invitation status to accepted
- Return the new member record

### What It Owns

| Owned                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| Invitation acceptance     | Updates invitation status to `accepted`      |
| Membership creation       | Creates `agency_members` record for the user |
| Coin reseller inheritance | Updates user's default reseller from agency  |

### External Dependencies

| Dependency   | Type       | Purpose                            |
| ------------ | ---------- | ---------------------------------- |
| Database     | PostgreSQL | Stores invitations, members, users |
| Transactions | Database   | Ensures atomic membership creation |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/invitations/{invitation}/accept
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter          | Key     | Config                       |
| ---------------- | ------- | ---------------------------- |
| Default throttle | User ID | `config/sanctum.php` default |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter    | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| `invitation` | `integer` | The ID of the invitation to accept |

### Request Body Schema

No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "You have successfully joined the agency.",
  "data": {
    "id": 123,
    "role": "member",
    "role_label": "Member",
    "status": "active",
    "status_label": "Active",
    "joined_at": "2026-02-03T12:00:00.000000Z",
    "user": {
      "id": 456,
      "name": "John Doe",
      "signature": "john123",
      "avatar": "https://example.com/avatar.jpg",
      "level": 10
    }
  },
  "meta": {
    "timestamp": "2026-02-03T12:00:00.000000Z",
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

#### ❌ Validation/Business Error (422)

```json
{
  "status": "error",
  "message": "This invitation cannot be accepted.",
  "data": null,
  "errors": {
    "status": ["Invitation is expired."]
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Agency\\AgencyInvitation].",
  "data": null,
  "errors": {}
}
```

### HTTP Status Codes

| Code  | Condition                                       |
| ----- | ----------------------------------------------- |
| `200` | Invitation accepted, membership created         |
| `401` | Unauthenticated request                         |
| `403` | User is not the invitation recipient            |
| `404` | Invitation not found                            |
| `422` | Invitation expired, not pending, or other error |
| `500` | Database transaction failure                    |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                POST /api/v1/invitations/{invitation}/accept                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:140-143                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('invitations')->group(function () {                       │ │
│ │     // Accept invitation                                                │ │
│ │     Route::post('/{invitation}/accept',                                 │ │
│ │         [AgencyInvitationController::class, 'accept'])                  │ │
│ │         ->name('invitations.accept');                                   │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Authenticates user via Bearer token                     │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {invitation} → Resolves to AgencyInvitation model instance              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Agency/AgencyInvitation.php                                │
│                                                                             │
│ Laravel automatically resolves {invitation} to AgencyInvitation model.      │
│ If not found, returns 404 automatically.                                    │
│                                                                             │
│ Model Properties:                                                           │
│   • id, agency_id, user_id, invited_by, status, expires_at                 │
│                                                                             │
│ Key Relationships:                                                          │
│   • agency() → BelongsTo Agency                                            │
│   • user() → BelongsTo User (invitee)                                      │
│   • inviter() → BelongsTo User (who sent invitation)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php     │
│ Method: accept(Request $request, AgencyInvitation $invitation,              │
│                AcceptInvitationAction $action)                              │
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('accept', $invitation);                                │ │
│ │                                                                         │ │
│ │ → Calls AgencyInvitationPolicy::accept()                                │ │
│ │ → Verifies user is the invitation recipient                             │ │
│ │ → Verifies invitation canRespond() (pending & not expired)              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get Authenticated User                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Execute Accept Action                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($invitation, $user);                         │ │
│ │                                                                         │ │
│ │ → Delegates to AcceptInvitationAction                                   │ │
│ │ → Returns ActionResult with success/failure                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Handle Result                                                       │
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
│ │     new AgencyMemberResource($result->getData()),                       │ │
│ │     $result->getMessage(),                                              │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyInvitationPolicy.php                        │
│ Method: accept(User $user, AgencyInvitation $invitation)                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function accept(User $user, AgencyInvitation $invitation): bool  │ │
│ │ {                                                                       │ │
│ │     // Only the invitee can accept                                      │ │
│ │     if ($invitation->user_id !== $user->id) {                           │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     return $invitation->canRespond();                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Authorization Checks:                                                       │
│   1. User must be the invitation recipient (user_id match)                  │
│   2. Invitation must be respondable (pending + not expired)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION LAYER (BUSINESS LOGIC)                                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/AcceptInvitationAction.php                         │
│ Method: execute(AgencyInvitation $invitation, User $user)                   │
│                                                                             │
│ STEP 1: Verify User Authorization                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($invitation->user_id !== $user->id) {                               │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You are not authorized to accept this invitation.',   │ │
│ │         errors: ['invitation_id' => ['Not authorized.']],               │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Verify Invitation Can Be Responded To                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $invitation->canRespond()) {                                      │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This invitation cannot be accepted.',                 │ │
│ │         errors: ['status' => ['Invitation is ' .                        │ │
│ │             ($invitation->isExpired() ? 'expired' : 'not pending') .    │ │
│ │             '.']]                                                       │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Verify Agency is Operational                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $invitation->agency;                                          │ │
│ │                                                                         │ │
│ │ if (! $agency->isOperational()) {                                       │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'This agency is no longer operational.',               │ │
│ │         errors: ['agency_id' => ['Agency is not operational.']],        │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Check Existing Membership                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->hasMember($user)) {                                        │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You are already a member of this agency.',            │ │
│ │         errors: ['user_id' => ['Already a member.']],                   │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Database Transaction                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($invitation, $user, $agency) {  │ │
│ │     // Update invitation status                                         │ │
│ │     $invitation->update([                                               │ │
│ │         'status' => AgencyInvitationStatus::ACCEPTED,                   │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     // Create or update membership                                      │ │
│ │     $member = AgencyMember::updateOrCreate(                             │ │
│ │         ['agency_id' => $agency->id, 'user_id' => $user->id],           │ │
│ │         [                                                               │ │
│ │             'role' => AgencyMemberRole::MEMBER,                         │ │
│ │             'status' => AgencyMemberStatus::ACTIVE,                     │ │
│ │             'invited_by' => $invitation->invited_by,                    │ │
│ │             'left_at' => null,                                          │ │
│ │             'leave_reason' => null,                                     │ │
│ │             'removed_by' => null,                                       │ │
│ │         ]                                                               │ │
│ │     );                                                                  │ │
│ │                                                                         │ │
│ │     // Inherit coin reseller from agency                                │ │
│ │     if ($agency->coin_reseller_id !== null) {                           │ │
│ │         $user->update(['default_reseller_id' => $agency->coin_reseller_id]);│ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     $member->load(['agency', 'user', 'inviter']);                       │ │
│ │                                                                         │ │
│ │     return ActionResult::success(                                       │ │
│ │         data: $member,                                                  │ │
│ │         message: 'You have successfully joined the agency.',            │ │
│ │         meta: [                                                         │ │
│ │             'member_id' => $member->id,                                 │ │
│ │             'agency_id' => $agency->id,                                 │ │
│ │             'role' => AgencyMemberRole::MEMBER->value,                  │ │
│ │         ],                                                              │ │
│ │     );                                                                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyInvitation (Model)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyInvitation.php                            │ │
│ │ Responsibility: Represents an agency invitation                          │ │
│ │ Reusable: YES (used by all invitation endpoints)                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canRespond() → isPending() && !isExpired()                          │ │
│ │   • isPending() → status === PENDING                                    │ │
│ │   • isExpired() → isPending() && expires_at->isPast()                   │ │
│ │   • agency() → BelongsTo relationship                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Agency (Model)                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/Agency.php                                      │ │
│ │ Responsibility: Represents an agency entity                              │ │
│ │ Reusable: YES (used by all agency endpoints)                            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isOperational() → status->isOperational()                           │ │
│ │   • hasMember(User) → checks active membership                          │ │
│ │   • coin_reseller_id → reseller to inherit                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMember (Model)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyMember.php                                │ │
│ │ Responsibility: Represents agency membership                             │ │
│ │ Reusable: YES (used by all member endpoints)                            │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • agency_id, user_id, role, status, invited_by                        │ │
│ │   • left_at, leave_reason, removed_by                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (DTO)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Encapsulates action execution results                    │ │
│ │ Reusable: YES (used by all action classes)                              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(data, message, meta) → Create success result                │ │
│ │   • failure(errors, message) → Create failure result                    │ │
│ │   • isSuccess() → Check if action succeeded                             │ │
│ │   • getData() → Get result data                                         │ │
│ │   • getErrors() → Get error details                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyInvitationStatus (Enum)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyInvitationStatus.php                       │ │
│ │ Responsibility: Defines invitation lifecycle states                      │ │
│ │ Reusable: YES (used by all invitation operations)                       │ │
│ │                                                                         │ │
│ │ Values: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMemberRole (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyMemberRole.php                             │ │
│ │ Values: OWNER, ADMIN, MEMBER                                            │ │
│ │ Note: New members always get MEMBER role                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMemberStatus (Enum)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyMemberStatus.php                           │ │
│ │ Values: ACTIVE, SUSPENDED, KICKED, LEFT                                 │ │
│ │ Note: New members always get ACTIVE status                              │ │
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
│ 1. READ: Fetch AgencyInvitation by ID (Route Model Binding)                 │
│    Query: SELECT * FROM agency_invitations WHERE id = ?                     │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. READ: Fetch related Agency                                               │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│    Source: AgencyInvitation->agency relationship                            │
│                                                                             │
│ 3. READ: Check existing membership                                          │
│    Query: SELECT EXISTS(                                                    │
│             SELECT * FROM agency_members                                    │
│             WHERE agency_id = ? AND user_id = ? AND status = 'active'       │
│           )                                                                 │
│    Source: Agency::hasMember()                                              │
│                                                                             │
│ 4. UPDATE: Mark invitation as accepted (inside transaction)                 │
│    Query: UPDATE agency_invitations SET status = 'accepted' WHERE id = ?    │
│    Source: AcceptInvitationAction                                           │
│                                                                             │
│ 5. UPSERT: Create or update membership (inside transaction)                 │
│    Query: INSERT INTO agency_members (...) ON DUPLICATE KEY UPDATE ...      │
│    Source: AgencyMember::updateOrCreate()                                   │
│                                                                             │
│ 6. UPDATE: Inherit coin reseller (inside transaction, conditional)          │
│    Query: UPDATE users SET default_reseller_id = ? WHERE id = ?             │
│    Source: User::update()                                                   │
│                                                                             │
│ 7. READ: Load member relationships for response                             │
│    Query: SELECT * FROM agencies WHERE id = ?                               │
│           SELECT * FROM users WHERE id IN (?, ?)                            │
│    Source: AgencyMember::load(['agency', 'user', 'inviter'])                │
│                                                                             │
│ TRANSACTION BOUNDARY:                                                       │
│   • Steps 4-6 are wrapped in DB::transaction()                              │
│   • Ensures atomic membership creation                                      │
│   • Rolls back on any exception                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Agency/AgencyMemberResource.php                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id' => $member->id,                                                │ │
│ │     'role' => $member->role->value,                                     │ │
│ │     'role_label' => $member->role->label(),                             │ │
│ │     'status' => $member->status->value,                                 │ │
│ │     'status_label' => $member->status->label(),                         │ │
│ │     'joined_at' => $member->created_at->toISOString(),                  │ │
│ │     'user' => new MinimalUserResource($member->user),                   │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Wrapped by ApiResponse::success():                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "You have successfully joined the agency.",                │ │
│ │   "data": { ... member resource ... },                                  │ │
│ │   "meta": { "timestamp": "...", "correlation_id": "..." }               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                           200 + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                | Used By Endpoints                         | Reusable | Reasoning                                       |
| ----------------------------------- | ----------------------------------------- | -------- | ----------------------------------------------- |
| `AgencyInvitationController.php`    | All invitation endpoints                  | ⭕       | Controller methods are endpoint-specific        |
| `AcceptInvitationAction.php`        | Only accept invitation endpoint           | ❌       | Single-purpose action for accepting invitations |
| `AgencyInvitationPolicy.php`        | All invitation endpoints                  | ✅       | Centralized authorization logic                 |
| `AgencyInvitation.php` (Model)      | All invitation endpoints                  | ✅       | Core model for invitations                      |
| `Agency.php` (Model)                | All agency endpoints                      | ✅       | Core model for agencies                         |
| `AgencyMember.php` (Model)          | All member endpoints                      | ✅       | Core model for memberships                      |
| `AgencyMemberResource.php`          | Member list, accept, approve join request | ✅       | Reusable API resource                           |
| `ActionResult.php`                  | All action classes                        | ✅       | Generic result wrapper                          |
| `ApiResponse.php`                   | All API endpoints                         | ✅       | Standardized response formatter                 |
| `AgencyInvitationStatus.php` (Enum) | All invitation operations                 | ✅       | Defines invitation states                       |
| `AgencyMemberRole.php` (Enum)       | All member operations                     | ✅       | Defines member roles                            |
| `AgencyMemberStatus.php` (Enum)     | All member operations                     | ✅       | Defines member statuses                         |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                          | Source                   | Condition                               |
| ------------------------------ | ------------------------ | --------------------------------------- |
| "This action is unauthorized." | `AgencyInvitationPolicy` | User is not the invitation recipient    |
| "This action is unauthorized." | `AgencyInvitationPolicy` | Invitation is not pending or is expired |

### Business Logic Errors (422)

| Error                                      | Source                   | Condition                         |
| ------------------------------------------ | ------------------------ | --------------------------------- |
| "You are not authorized to accept this..." | `AcceptInvitationAction` | user_id mismatch (double check)   |
| "This invitation cannot be accepted."      | `AcceptInvitationAction` | Invitation expired or not pending |
| "This agency is no longer operational."    | `AcceptInvitationAction` | Agency status is not operational  |
| "You are already a member of this agency." | `AcceptInvitationAction` | User has active membership        |

### System Errors (500)

| Error                          | Source                   | Condition                   |
| ------------------------------ | ------------------------ | --------------------------- |
| "Failed to accept invitation." | `AcceptInvitationAction` | Database transaction failed |

### Not Found Errors (404)

| Error                                            | Source        | Condition             |
| ------------------------------------------------ | ------------- | --------------------- |
| "No query results for model [AgencyInvitation]." | Route Binding | Invalid invitation ID |

### Edge Cases

| Case                               | Behavior                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| Re-joining after leaving           | `updateOrCreate` clears left_at, leave_reason, removed_by |
| Agency has coin_reseller_id        | User inherits coin reseller preference                    |
| Agency has no coin_reseller_id     | User's default_reseller_id unchanged                      |
| Concurrent accept/decline requests | DB transaction prevents race conditions                   |
| Invitation just expired            | Policy/action checks prevent acceptance                   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE            CONTROLLER           POLICY              ACTION                DATABASE
   │                     │                     │                   │                   │                      │
   │ POST /invitations   │                     │                   │                   │                      │
   │ /{id}/accept        │                     │                   │                   │                      │
   │─────────────────────▶                     │                   │                   │                      │
   │                     │                     │                   │                   │                      │
   │                     │ 1. auth:sanctum     │                   │                   │                      │
   │                     │ Validate token      │                   │                   │                      │
   │                     │─────────────────────▶                   │                   │                      │
   │                     │                     │                   │                   │                      │
   │                     │                     │ 2. Route Binding  │                   │                      │
   │                     │                     │───────────────────────────────────────────────────────────────▶
   │                     │                     │                   │                   │   SELECT invitation   │
   │                     │                     │◀──────────────────────────────────────────────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │ 3. authorize()    │                   │                      │
   │                     │                     │──────────────────▶│                   │                      │
   │                     │                     │                   │ Check user_id     │                      │
   │                     │                     │                   │ Check canRespond  │                      │
   │                     │                     │◀──────────────────│                   │                      │
   │                     │                     │                   │                   │                      │
   │                     │                     │ 4. execute()      │                   │                      │
   │                     │                     │─────────────────────────────────────▶│                      │
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 5. Load agency       │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 6. Check membership  │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 7. BEGIN TRANSACTION │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 8. UPDATE invitation │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 9. UPSERT member     │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 10. UPDATE user      │
   │                     │                     │                   │                   │ (if coin_reseller)   │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 11. COMMIT           │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │                   │                   │ 12. Load relations   │
   │                     │                     │                   │                   │──────────────────────▶
   │                     │                     │                   │                   │◀─────────────────────│
   │                     │                     │                   │                   │                      │
   │                     │                     │◀─────────────────────────────────────│                      │
   │                     │                     │                   │                   │                      │
   │                     │                     │ 13. Build response│                   │                      │
   │                     │◀────────────────────│                   │                   │                      │
   │◀────────────────────│                     │                   │                   │                      │
   │                     │                     │                   │                   │                      │
   │  200 + AgencyMember │                     │                   │                   │                      │
   │                     │                     │                   │                   │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                    |
| --------------------------- | ------------------------------------------- |
| New validation rules        | `AcceptInvitationAction::execute()`         |
| Pre-accept hooks            | `AcceptInvitationAction` before transaction |
| Post-accept events          | `AcceptInvitationAction` after transaction  |
| New member response fields  | `AgencyMemberResource::toArray()`           |
| Authorization changes       | `AgencyInvitationPolicy::accept()`          |
| New invitation status logic | `AgencyInvitationStatus` enum               |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO MEMBERSHIP RESPONSE

| Step  | File                                                    | What to Change                  |
| ----- | ------------------------------------------------------- | ------------------------------- |
| **1** | `database/migrations/`                                  | Add column to `agency_members`  |
| **2** | `app/Models/Agency/AgencyMember.php`                    | Add to `$fillable` array        |
| **3** | `app/Actions/Agency/AcceptInvitationAction.php`         | Set value in `updateOrCreate()` |
| **4** | `app/Http/Resources/V1/Agency/AgencyMemberResource.php` | Add to `toArray()` output       |

#### ➕ ADDING A NEW VALIDATION CHECK

| Step  | File                                            | What to Change                   |
| ----- | ----------------------------------------------- | -------------------------------- |
| **1** | `app/Actions/Agency/AcceptInvitationAction.php` | Add check before transaction     |
| **2** | Return `ActionResult::failure()` with error     | Provide meaningful error message |

#### ➖ REMOVING A FIELD

| Step  | File                                                    | What to Change                 |
| ----- | ------------------------------------------------------- | ------------------------------ |
| **1** | `app/Http/Resources/V1/Agency/AgencyMemberResource.php` | Remove from `toArray()`        |
| **2** | `app/Actions/Agency/AcceptInvitationAction.php`         | Remove from `updateOrCreate()` |
| **3** | `app/Models/Agency/AgencyMember.php`                    | Remove from `$fillable`        |
| **4** | Database migration                                      | Drop column (if safe)          |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCEPT INVITATION FLOW                              │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  URL Parameter                                                              │
│  ┌─────────────┐                                                            │
│  │ {invitation}│ ─────▶ Route Model Binding ─────▶ AgencyInvitation        │
│  └─────────────┘                                                            │
│                                                                             │
│  AgencyInvitation ─────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  ├── user_id ──────────────▶ Used for authorization                   │    │
│  ├── status ───────────────▶ Check isPending()                        │    │
│  ├── expires_at ───────────▶ Check isExpired()                        │    │
│  ├── invited_by ───────────▶ Set on AgencyMember                      │    │
│  └── agency ───────────────▶ Agency model                              │    │
│                             │                                          │    │
│                             ├── isOperational() ──▶ Validate           │    │
│                             ├── hasMember() ──────▶ Check existing     │    │
│                             └── coin_reseller_id ─▶ Inherit to user    │    │
│                                                                             │
│  AgencyMember (created) ───────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  ├── id ───────────────────▶ AgencyMemberResource                     │    │
│  ├── role ─────────────────▶ MEMBER (default)                         │    │
│  ├── status ───────────────▶ ACTIVE (default)                         │    │
│  ├── invited_by ───────────▶ From invitation                          │    │
│  └── user, agency, inviter ▶ Loaded relationships                     │    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Before Adding a Field

- [ ] Verify the field doesn't already exist
- [ ] Decide if field should be in `$fillable`
- [ ] Consider if field needs validation
- [ ] Check if field affects response

#### Before Removing a Field

- [ ] Search for all usages in codebase
- [ ] Check if field is used in other endpoints
- [ ] Verify no mobile/frontend dependencies
- [ ] Plan database migration timing

### ⚠️ What Should NOT Be Modified Casually

| Component                            | Reason                                            |
| ------------------------------------ | ------------------------------------------------- |
| `AgencyInvitationPolicy::accept()`   | Authorization logic; affects security             |
| `AcceptInvitationAction` transaction | Atomic operation; must complete fully or rollback |
| `AgencyInvitationStatus` enum        | Breaking change for existing invitations          |
| `AgencyMemberRole` enum              | Affects permissions across the system             |
| `updateOrCreate()` unique keys       | Could create duplicate memberships                |
| Coin reseller inheritance            | Affects user's default payment settings           |

### 🚨 Common Pitfalls

| Pitfall                               | Prevention                                      |
| ------------------------------------- | ----------------------------------------------- |
| Forgetting to check `isOperational()` | Agency might be dissolved/suspended             |
| Not using transaction                 | Could leave partial state on error              |
| Missing `load()` for relationships    | Response will have null nested objects          |
| Ignoring `updateOrCreate()` behavior  | May not properly handle re-joining members      |
| Skipping coin reseller null check     | Could clear user's existing reseller preference |
| Not checking `canRespond()` in policy | Allows accepting expired invitations            |
| Returning wrong HTTP status           | 422 for business errors, not 400                |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                              ← Route definition (line 140-143)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyInvitationController.php                 ← Controller (accept method)
app/Actions/Agency/
  └── AcceptInvitationAction.php                     ← Business logic action
app/Policies/Agency/
  └── AgencyInvitationPolicy.php                     ← Authorization policy
app/Models/Agency/
  ├── Agency.php                                     ← Agency model
  ├── AgencyInvitation.php                           ← Invitation model
  └── AgencyMember.php                               ← Member model
app/Enums/Agency/
  ├── AgencyInvitationStatus.php                     ← Invitation status enum
  ├── AgencyMemberRole.php                           ← Member role enum
  └── AgencyMemberStatus.php                         ← Member status enum
app/Http/Resources/V1/Agency/
  └── AgencyMemberResource.php                       ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                                ← API response helper
app/Actions/
  └── ActionResult.php                               ← Action result wrapper
```

---

## Document Metadata

| Property            | Value                                          |
| ------------------- | ---------------------------------------------- |
| **Endpoint**        | `POST /api/v1/invitations/{invitation}/accept` |
| **Domain**          | Agency                                         |
| **Author**          | System Documentation                           |
| **Created**         | 2026-02-03                                     |
| **Laravel Version** | 12.x                                           |
| **PHP Version**     | 8.4                                            |
