# POST /api/v1/user/agency/invitations

> **Domain**: User Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Allows agency owners or administrators to send invitations to users to join their agency. The invited user receives a real-time notification via MSAB (Message Streaming and Broadcasting).

### Responsibilities

- Validate that the current user manages an agency
- Authorize invitation creation via policy
- Check target user eligibility (not already member, not blocked, no pending invitation)
- Create invitation record with expiration
- Emit real-time notification to invitee

### What It Owns

| Owned                | Description                                  |
| -------------------- | -------------------------------------------- |
| `agency_invitations` | Creates new pending invitation records       |
| MSAB Event Emission  | Triggers real-time `agency.invitation` event |

### External Dependencies

| Dependency                 | Type           | Purpose                            |
| -------------------------- | -------------- | ---------------------------------- |
| `agency_invitations` table | Database       | Stores invitation records          |
| `agencies` table           | Database       | Validates agency operational state |
| `agency_members` table     | Database       | Checks existing membership         |
| `agency_user_blocks` table | Database       | Checks if user blocked agency      |
| MSABEventService           | Infrastructure | Real-time notification via Redis   |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/agency/invitations
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key   | Config           |
| ------- | ----- | ---------------- |
| Default | `api` | `config/app.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "user_id": "integer" // Required, must exist in users table
}
```

#### Field Details

| Field     | Type      | Constraints                       | Example |
| --------- | --------- | --------------------------------- | ------- |
| `user_id` | `integer` | Required, exists in `users` table | `42`    |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Invitation sent successfully.",
  "data": {
    "id": 1,
    "status": "pending",
    "status_label": "Pending",
    "expires_at": "2026-02-10T17:00:00.000000Z",
    "created_at": "2026-02-03T17:00:00.000000Z",
    "is_expired": false,
    "can_respond": true,
    "agency": {
      "id": 1,
      "name": "Top Agency",
      "country": "US",
      "logo": "https://example.com/logo.png"
    },
    "user": {
      "id": 42,
      "name": "John Doe",
      "signature": "johndoe123",
      "avatar": "https://example.com/avatar.png"
    },
    "invited_by": {
      "id": 1,
      "name": "Admin User",
      "signature": "admin123",
      "avatar": "https://example.com/admin.png"
    }
  },
  "meta": {
    "timestamp": "2026-02-03T17:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T17:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ No Managed Agency (403)

```json
{
  "status": "error",
  "message": "You do not manage any agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T17:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

#### ❌ Authorization Failed (403)

```json
{
  "message": "This action is unauthorized."
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "user_id": ["The user id field is required."]
  }
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "User is already a member of this agency.",
  "data": null,
  "errors": {
    "user_id": ["User is already a member."]
  },
  "meta": {
    "timestamp": "2026-02-03T17:00:00.000000Z",
    "correlation_id": "uuid-string"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                      |
| ----- | ---------------------------------------------- |
| `201` | Invitation created successfully                |
| `401` | User not authenticated                         |
| `403` | User doesn't manage agency or lacks permission |
| `422` | Validation failure or business rule violation  |
| `500` | Database transaction or MSAB emission failure  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/user/agency/invitations                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:80-82                                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/', [AgencyInvitationController::class, 'send'])           │ │
│ │     ->name('user.agency.invitations.send');                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, attaches User to request       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED (Controller Method Entry)                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php:118 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function send(Request $request, InviteMemberAction $action)      │ │
│ │ {                                                                       │ │
│ │     $user = $request->user();                                           │ │
│ │     if ($user === null) {                                               │ │
│ │         return ApiResponse::error('Unauthenticated.', [], 401);         │ │
│ │     }                                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: Uses inline validation instead of dedicated FormRequest               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 MANAGED AGENCY RESOLUTION                                               │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Concerns/ManagesUserAgency.php:18-37                              │
│                                                                             │
│ Controller uses ManagesUserAgency trait to find agency user can manage:     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $this->getUserManagedAgency($user);                           │ │
│ │                                                                         │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not manage any agency.', [], 403);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Trait logic:                                                                │
│   1. Check $user->ownedAgency (if operational, return it)                   │
│   2. Check activeAgencyMembership with role in ['owner', 'admin']           │
│   3. Return null if neither condition met                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 AUTHORIZATION CHECK                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyInvitationPolicy.php:51-67                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('create', [AgencyInvitation::class, $agency]);         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Policy create() method checks:                                              │
│   1. Agency must be operational (isOperational())                           │
│   2. User is official (Super Admin/Admin) → allowed                         │
│   3. User is owner or admin of agency (canManageMembers()) → allowed        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function create(User $user, Agency $agency): bool                │ │
│ │ {                                                                       │ │
│ │     if (!$agency->isOperational()) { return false; }                    │ │
│ │     if ($this->isOfficial($user)) { return true; }                      │ │
│ │     $member = $agency->getMember($user);                                │ │
│ │     return $member !== null && $member->canManageMembers();             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 INLINE VALIDATION                                                       │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php:135 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validate([                                       │ │
│ │     'user_id' => ['required', 'integer', 'exists:users,id'],            │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Throws 422 ValidationException if:                                          │
│   - user_id is missing                                                      │
│   - user_id is not an integer                                               │
│   - user_id doesn't exist in users table                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DTO CONSTRUCTION                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/DTOs/Agency/InviteMemberDTO.php:25-31                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = InviteMemberDTO::fromArray([                                     │ │
│ │     'agency_id' => $agency->id,                                         │ │
│ │     'user_id' => $validated['user_id'],                                 │ │
│ │     'invited_by' => $user->id,                                          │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ DTO Properties:                                                             │
│   • agencyId: int (agency sending invitation)                               │
│   • userId: int (user being invited)                                        │
│   • invitedBy: int (user sending invitation)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 ACTION EXECUTION                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/Agency/InviteMemberAction.php:29-128                      │
│                                                                             │
│ STEP 1: Load & Validate Agency                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = Agency::find($dto->agencyId);                                 │ │
│ │ if ($agency === null) { return ActionResult::failure(...); }            │ │
│ │ if (!$agency->isOperational()) { return ActionResult::failure(...); }   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Load & Validate Target User                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = User::find($dto->userId);                                       │ │
│ │ if ($user === null) { return ActionResult::failure(...); }              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check Not Already Member                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->hasMember($user)) {                                        │ │
│ │     return ActionResult::failure('User is already a member...');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Check User Block                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $isBlocked = AgencyUserBlock::where('agency_id', $dto->agencyId)        │ │
│ │     ->where('user_id', $dto->userId)                                    │ │
│ │     ->where('blocker_type', AgencyBlockerType::USER)                    │ │
│ │     ->exists();                                                         │ │
│ │ if ($isBlocked) { return ActionResult::failure(...); }                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Check No Pending Invitation                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $hasPendingInvitation = AgencyInvitation::where('agency_id', ...)       │ │
│ │     ->where('user_id', ...)->valid()->exists();                         │ │
│ │ if ($hasPendingInvitation) { return ActionResult::failure(...); }       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Create Invitation (in transaction)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () use ($dto) {                         │ │
│ │     $invitation = AgencyInvitation::create([                            │ │
│ │         'agency_id' => $dto->agencyId,                                  │ │
│ │         'user_id' => $dto->userId,                                      │ │
│ │         'invited_by' => $dto->invitedBy,                                │ │
│ │         'status' => AgencyInvitationStatus::PENDING,                    │ │
│ │         'expires_at' => now()->addDays($ttlDays),                       │ │
│ │     ]);                                                                 │ │
│ │     ...                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 MSAB EVENT EMISSION                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Realtime/MSABEventService.php:182-207                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->msabEventService->emitAgencyInvitation(                          │ │
│ │     $invitation->id,                                                    │ │
│ │     $invitation->user_id,        // invitee receives notification       │ │
│ │     $invitation->agency_id,                                             │ │
│ │     $invitation->agency->name,                                          │ │
│ │     $invitation->agency->logo,                                          │ │
│ │     $invitation->invited_by,                                            │ │
│ │     $invitation->inviter->name                                          │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Emits 'agency.invitation' event to invitee via Redis pub/sub               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.9 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Agency/AgencyInvitationResource.php:23-60       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AgencyInvitationResource($result->getData()),                   │ │
│ │     $result->getMessage() ?? 'Invitation sent successfully.',           │ │
│ │     [],                                                                 │ │
│ │     201,                                                                │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Resource includes:                                                          │
│   • id, status, status_label, expires_at, created_at                        │
│   • is_expired, can_respond                                                 │
│   • agency (if loaded): id, name, country, logo                             │
│   • user (if loaded): MinimalUserResource                                   │
│   • invited_by (if loaded): MinimalUserResource                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                          201 + JSON Body                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints                                | Reusable | Reasoning                                      |
| ------------------------------ | ------------------------------------------------ | -------- | ---------------------------------------------- |
| `ManagesUserAgency.php`        | invitations/send, invitations/sent, members/kick | ✅       | Shared trait for agency management controllers |
| `AgencyInvitationPolicy.php`   | All invitation endpoints                         | ✅       | Centralizes invitation authorization           |
| `InviteMemberDTO.php`          | invitations/send only                            | ❌       | Specific to invitation sending                 |
| `InviteMemberAction.php`       | invitations/send only                            | ❌       | Endpoint-specific business logic               |
| `AgencyInvitationResource.php` | All invitation endpoints                         | ✅       | Shared resource for invitation responses       |
| `MSABEventService.php`         | Multiple endpoints (gifts, invitations)          | ✅       | Shared real-time event service                 |
| `AgencyInvitation.php` (model) | All invitation endpoints                         | ✅       | Core domain model                              |
| `ApiResponse.php`              | All API endpoints                                | ✅       | Standardized response wrapper                  |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error              | Source            | Condition                            |
| ------------------ | ----------------- | ------------------------------------ |
| `user_id.required` | Inline Validation | user_id not provided                 |
| `user_id.integer`  | Inline Validation | user_id is not an integer            |
| `user_id.exists`   | Inline Validation | user_id doesn't exist in users table |

### Business Logic Errors (422)

| Error                                      | Source               | Condition                                       |
| ------------------------------------------ | -------------------- | ----------------------------------------------- |
| "Agency not found."                        | `InviteMemberAction` | Agency ID mismatch (rare edge case)             |
| "Agency is not operational."               | `InviteMemberAction` | Agency suspended, dissolved, or pending         |
| "User not found."                          | `InviteMemberAction` | User deleted between validation and action      |
| "User is already a member of this agency." | `InviteMemberAction` | Target user has active membership               |
| "This user has blocked invitations..."     | `InviteMemberAction` | User blocked agency via agency_user_blocks      |
| "A pending invitation already exists..."   | `InviteMemberAction` | Valid (pending + not expired) invitation exists |

### Authorization Errors (403)

| Error                           | Source               | Condition                               |
| ------------------------------- | -------------------- | --------------------------------------- |
| "You do not manage any agency." | Controller           | User not owner/admin of any agency      |
| "This action is unauthorized."  | Policy authorization | Agency not operational or no permission |

### Authentication Errors (401)

| Error              | Source     | Condition           |
| ------------------ | ---------- | ------------------- |
| "Unauthenticated." | Controller | No valid auth token |

### System Errors (500)

| Error                        | Source               | Condition                      |
| ---------------------------- | -------------------- | ------------------------------ |
| "Failed to send invitation." | `InviteMemberAction` | DB transaction or MSAB failure |

### Edge Cases

| Case                                   | Behavior                                             |
| -------------------------------------- | ---------------------------------------------------- |
| Inviting oneself                       | Allowed but would fail on "already member" check     |
| Race condition: user joins via request | Transaction prevents duplicate membership            |
| Expired invitation exists              | New invitation allowed (scopeValid excludes expired) |
| Cancelled/declined invitation exists   | New invitation allowed (scopeValid checks pending)   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE         CONTROLLER          TRAIT/POLICY          ACTION               DATABASE            MSAB
   │                     │                  │                    │                   │                     │                 │
   │ POST /invitations   │                  │                    │                   │                     │                 │
   │────────────────────▶│                  │                    │                   │                     │                 │
   │                     │ 1. auth:sanctum  │                    │                   │                     │                 │
   │                     │─────────────────▶│                    │                   │                     │                 │
   │                     │                  │                    │                   │                     │                 │
   │                     │                  │ 2. getUserManaged  │                   │                     │                 │
   │                     │                  │    Agency()        │                   │                     │                 │
   │                     │                  │───────────────────▶│                   │                     │                 │
   │                     │                  │                    │ 3. SELECT agency  │                     │                 │
   │                     │                  │                    │──────────────────────────────────────────▶│                │
   │                     │                  │◀───────────────────│◀─────────────────────────────────────────│                │
   │                     │                  │                    │                   │                     │                 │
   │                     │                  │ 4. authorize()     │                   │                     │                 │
   │                     │                  │───────────────────▶│                   │                     │                 │
   │                     │                  │                    │ 5. SELECT member  │                     │                 │
   │                     │                  │                    │──────────────────────────────────────────▶│                │
   │                     │                  │◀───────────────────│◀─────────────────────────────────────────│                │
   │                     │                  │                    │                   │                     │                 │
   │                     │                  │ 6. validate()      │                   │                     │                 │
   │                     │                  │───────────────────▶│ 7. EXISTS users   │                     │                 │
   │                     │                  │                    │──────────────────────────────────────────▶│                │
   │                     │                  │◀───────────────────│◀─────────────────────────────────────────│                │
   │                     │                  │                    │                   │                     │                 │
   │                     │                  │ 8. action.execute()│                   │                     │                 │
   │                     │                  │──────────────────────────────────────▶│                     │                 │
   │                     │                  │                    │                   │ 9. SELECT agency    │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │◀────────────────────│                 │
   │                     │                  │                    │                   │ 10. SELECT user     │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │◀────────────────────│                 │
   │                     │                  │                    │                   │ 11. EXISTS members  │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │◀────────────────────│                 │
   │                     │                  │                    │                   │ 12. EXISTS blocks   │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │◀────────────────────│                 │
   │                     │                  │                    │                   │ 13. EXISTS pending  │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │◀────────────────────│                 │
   │                     │                  │                    │                   │ 14. BEGIN TX        │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │ 15. INSERT invite   │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │◀────────────────────│                 │
   │                     │                  │                    │                   │ 16. COMMIT          │                 │
   │                     │                  │                    │                   │────────────────────▶│                 │
   │                     │                  │                    │                   │                     │                 │
   │                     │                  │                    │                   │ 17. emitAgencyInvitation()            │
   │                     │                  │                    │                   │────────────────────────────────────────▶│
   │                     │                  │                    │                   │◀───────────────────────────────────────│
   │                     │                  │◀─────────────────────────────────────│                     │                 │
   │                     │◀─────────────────│                    │                   │                     │                 │
   │◀────────────────────│                  │                    │                   │                     │                 │
   │                     │                  │                    │                   │                     │                 │
   │  201 + JSON         │                  │                    │                   │                     │                 │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                           |
| -------------------------- | -------------------------------------------------- |
| New validation rule        | `AgencyInvitationController::send()` inline array  |
| New business check         | `InviteMemberAction::execute()` before transaction |
| New response field         | `AgencyInvitationResource::toArray()`              |
| New authorization rule     | `AgencyInvitationPolicy::create()`                 |
| New real-time notification | `MSABEventService`                                 |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUEST FIELD

| Step  | File                                                      | What to Change                      |
| ----- | --------------------------------------------------------- | ----------------------------------- |
| **1** | `app/Http/Controllers/.../AgencyInvitationController.php` | Add to inline validation rules      |
| **2** | `app/DTOs/Agency/InviteMemberDTO.php`                     | Add property and update fromArray() |
| **3** | `app/Actions/Agency/InviteMemberAction.php`               | Use new DTO property in create()    |
| **4** | **Database Migration**                                    | Add column if persisting            |
| **5** | `app/Models/Agency/AgencyInvitation.php`                  | Add to $fillable                    |

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                        | What to Change           |
| ----- | ----------------------------------------------------------- | ------------------------ |
| **1** | `app/Http/Resources/V1/Agency/AgencyInvitationResource.php` | Add to toArray() return  |
| **2** | `app/Models/Agency/AgencyInvitation.php`                    | Add accessor if computed |

#### ➖ REMOVING A FIELD

| Step  | File                             | What to Change         |
| ----- | -------------------------------- | ---------------------- |
| **1** | `AgencyInvitationController.php` | Remove from validation |
| **2** | `InviteMemberDTO.php`            | Remove property        |
| **3** | `InviteMemberAction.php`         | Remove from create()   |
| **4** | `AgencyInvitationResource.php`   | Remove from response   |
| **5** | **Database Migration**           | Drop column (if safe)  |

### 🔗 Field Flow Dependency Chain

```
Request Body (user_id)
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ AgencyInvitationController::send()                               │
│   • Inline validation: ['user_id' => 'required|integer|exists'] │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ InviteMemberDTO                                                  │
│   • agencyId: from $agency->id                                   │
│   • userId: from $validated['user_id']                           │
│   • invitedBy: from $user->id                                    │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ InviteMemberAction                                               │
│   • Creates AgencyInvitation with all DTO fields                 │
│   • Emits MSAB event with invitation details                     │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ AgencyInvitationResource                                         │
│   • Returns id, status, agency, user, invited_by                 │
└──────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                 |
| --------------------------- | ------------------------------------------------------ |
| `ManagesUserAgency` trait   | Shared by multiple agency management endpoints         |
| `AgencyInvitationPolicy`    | Authorization changes affect all invitation operations |
| MSAB event structure        | Frontend clients expect specific payload format        |
| `scopeValid()` scope        | Critical for determining respondable invitations       |
| Transaction boundary        | Ensures atomicity of invitation + notification         |
| `DEFAULT_TTL_DAYS` constant | Changes invitation validity period globally            |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                                  |
| ----------------------------------------- | ----------------------------------------------------------- |
| Forgetting to check agency operational    | Always check `isOperational()` before invitation operations |
| Not loading relations for resource        | Ensure `->load(['agency', 'user', 'inviter'])` is called    |
| Duplicate invitations                     | Check `valid()` scope which checks pending + not expired    |
| MSAB failure silently ignored             | Action wraps in try-catch but transaction still commits     |
| Changing inline validation to FormRequest | Would require updating controller method signature          |
| Testing without auth token                | 401 returned before any validation                          |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:80-82                 ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyInvitationController.php:118-159  ← Controller method
app/Concerns/
  └── ManagesUserAgency.php                   ← Agency resolution trait
app/Policies/Agency/
  └── AgencyInvitationPolicy.php:51-67        ← Authorization policy
app/DTOs/Agency/
  └── InviteMemberDTO.php                     ← Data transfer object
app/Actions/Agency/
  └── InviteMemberAction.php                  ← Business logic action
app/Models/Agency/
  ├── Agency.php                              ← Agency model
  └── AgencyInvitation.php                    ← Invitation model
app/Services/Gift/
  └── MSABEventService.php:182-207            ← Real-time notification
app/Http/Resources/V1/Agency/
  └── AgencyInvitationResource.php            ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                         ← Response helper
```

---

## Document Metadata

| Property            | Value                                  |
| ------------------- | -------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/agency/invitations` |
| **Domain**          | User Agency Management                 |
| **Author**          | System Documentation                   |
| **Created**         | 2026-02-03                             |
| **Laravel Version** | 12.x                                   |
| **PHP Version**     | 8.4                                    |
