# GET /api/v1/agencies/{agency}/members

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieve a paginated list of active members for a specific agency. Returns membership details with user information and conditional admin fields based on the requesting user's role and relationship to the agency.

### Responsibilities

- Fetch paginated active members for a specific agency
- Authorize access via `AgencyPolicy::view`
- Eager load related `user` and `inviter` relationships with optimized field selection
- Return cursor-paginated member data with role-based field visibility

### What It Owns

| Owned                 | Description                                          |
| --------------------- | ---------------------------------------------------- |
| Agency member listing | Retrieves and formats active agency member records   |
| Field visibility      | Controls which fields are visible based on user role |

### External Dependencies

| Dependency | Type           | Purpose                                         |
| ---------- | -------------- | ----------------------------------------------- |
| Database   | Infrastructure | Fetch agency members and related user records   |
| Sanctum    | Auth Package   | Bearer token authentication                     |
| Policy     | Authorization  | Determine view access based on user role/status |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/agencies/{agency}/members
```

### Authentication

✅ **Required** - Valid Sanctum Bearer token

### Rate Limiting

| Limiter | Key   | Config                     |
| ------- | ----- | -------------------------- |
| Default | `api` | Standard API rate limiting |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type      | Required | Description                     |
| --------- | --------- | -------- | ------------------------------- |
| `agency`  | `integer` | ✅       | Agency ID (route model binding) |

### Query Parameters

| Parameter  | Type      | Required | Default | Description                            |
| ---------- | --------- | -------- | ------- | -------------------------------------- |
| `per_page` | `integer` | ❌       | `20`    | Number of members per page (max: 100)  |
| `cursor`   | `string`  | ❌       | `null`  | Cursor for pagination (from next link) |

---

### Response Schemas

#### ✅ Success Response (200)

**Standard Member Fields (all authenticated users viewing approved agencies):**

```json
{
  "data": [
    {
      "id": 1,
      "role": "member",
      "role_label": "Member",
      "status": "active",
      "status_label": "Active",
      "joined_at": "2026-01-15T10:30:00.000000Z",
      "user": {
        "id": 123,
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
    }
  ],
  "links": {
    "first": null,
    "last": null,
    "prev": null,
    "next": "http://api.example.com/api/v1/agencies/1/members?cursor=eyJpZCI..."
  },
  "meta": {
    "path": "http://api.example.com/api/v1/agencies/1/members",
    "per_page": 20,
    "next_cursor": "eyJpZCI...",
    "prev_cursor": null,
    "timestamp": "2026-02-03T03:24:17.000000Z",
    "correlation_id": "uuid"
  }
}
```

**Additional Fields for Agency Admin/Owner:**

```json
{
  "data": [
    {
      "...standard_fields...",
      "invited_by": {
        "id": 456,
        "name": "Agency Admin",
        "avatar": "https://...",
        "signature": "sig_xyz789"
      }
    }
  ]
}
```

**Additional Fields for Kicked/Left Members (Admin/Owner view):**

```json
{
  "data": [
    {
      "...standard_fields...",
      "left_at": "2026-01-20T00:00:00.000000Z",
      "leave_reason": "Violated community guidelines",
      "removed_by": {
        "id": 789,
        "name": "Agency Owner",
        "avatar": "https://..."
      }
    }
  ]
}
```

> **Note:** The endpoint only returns **active** members. The kicked/left member fields are shown here for completeness but would only appear if the query scope was modified to include non-active members.

#### ❌ Not Found (404)

```json
{
  "message": "Agency not found"
}
```

#### ❌ Forbidden (403)

```json
{
  "message": "This action is unauthorized."
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Agency found, user authorized, members returned     |
| `401` | No valid authentication token                       |
| `403` | User not authorized to view non-public agency       |
| `404` | Agency ID does not exist (route model binding fail) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│              GET /api/v1/agencies/{agency}/members                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:35                                            │
│ Route: Route::get('/{agency}/members', [AgencyController::class, 'members'])│
│        ->name('agencies.members')                                           │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, resolves authenticated user   │
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
│ File: app/Http/Controllers/Controller.php (via authorize trait)            │
│                                                                             │
│ No Form Request - Direct controller method execution                        │
│ Route model binding provides Agency instance directly                       │
│ Query parameters (per_page) handled in controller                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:145-157       │
│ Method: members(Request $request, Agency $agency): AnonymousResourceCollection│
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('view', $agency);                                      │ │
│ │                                                                         │ │
│ │ Invokes: AgencyPolicy::view(User $user, Agency $agency)                │ │
│ │   - Approved agencies: Always viewable                                  │ │
│ │   - Non-approved: Owner/Member/Admin only                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Query Active Members with Eager Loading                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $members = $agency->activeMembers()                                     │ │
│ │     ->with([                                                            │ │
│ │         'user:id,name,avatar,frame,signature,gender,date_of_birth,     │ │
│ │               wealth_xp,charm_xp,email,phone,country',                  │ │
│ │         'inviter:id,name,avatar,frame,signature,gender,date_of_birth,  │ │
│ │                wealth_xp,charm_xp,email,phone,country'                  │ │
│ │     ])                                                                  │ │
│ │     ->cursorPaginate($request->input('per_page', 20));                  │ │
│ │                                                                         │ │
│ │ Uses activeMembers() scope (status = 'active')                          │ │
│ │ Column selection minimizes data fetched                                 │ │
│ │ Cursor pagination for efficient large dataset handling                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Resource Collection                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyMemberResource::collection($members);                      │ │
│ │                                                                         │ │
│ │ Returns AnonymousResourceCollection with pagination metadata            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 POLICY AUTHORIZATION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Policies/Agency/AgencyPolicy.php:27-37                            │
│ Method: view(User $user, Agency $agency): bool                              │
│                                                                             │
│ Authorization Logic:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function view(User $user, Agency $agency): bool                  │ │
│ │ {                                                                       │ │
│ │     // Public approved agencies viewable by anyone                      │ │
│ │     if ($agency->isApproved()) {                                        │ │
│ │         return true;                                                    │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // Non-public: owner/member/admin only                              │ │
│ │     return $this->isOwnerOrMember($user, $agency)                       │ │
│ │         || $this->isOfficial($user);                                    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Helper Methods:                                                             │
│   • isOwnerOrMember() → checks $agency->isOwnedBy() or $agency->hasMember() │
│   • isOfficial() → checks hasAnyRole(['Super Admin', 'Admin'])              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: Agency (Model)                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/Agency.php                                      │ │
│ │ Responsibility: Eloquent model with relationships and helper methods    │ │
│ │ Reusable: YES (used by all agency endpoints)                            │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • activeMembers() → HasMany AgencyMember (status = ACTIVE)            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isApproved() → checks status === AgencyStatus::APPROVED             │ │
│ │   • isOwnedBy(User|int) → checks user_id match                          │ │
│ │   • hasMember(User|int) → checks activeMembers for user_id              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMember (Model)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyMember.php                                │ │
│ │ Responsibility: Represents user membership in an agency                 │ │
│ │ Reusable: YES (used by all agency member operations)                    │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user() → BelongsTo User (the member)                                │ │
│ │   • inviter() → BelongsTo User (who invited the member)                 │ │
│ │   • agency() → BelongsTo Agency                                         │ │
│ │   • remover() → BelongsTo User (who removed the member)                 │ │
│ │                                                                         │ │
│ │ Key Properties (cast via enums):                                        │ │
│ │   • role → AgencyMemberRole (owner, admin, member)                      │ │
│ │   • status → AgencyMemberStatus (active, suspended, kicked, left)       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canManageMembers() → role->canManageMembers() && isActive()         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMemberRole (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyMemberRole.php                             │ │
│ │ Responsibility: Define member roles within an agency                    │ │
│ │ Reusable: YES (used across agency domain)                               │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • OWNER = 'owner'                                                     │ │
│ │   • ADMIN = 'admin'                                                     │ │
│ │   • MEMBER = 'member'                                                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → human-readable label                                      │ │
│ │   • canManageMembers() → true for OWNER, ADMIN                          │ │
│ │   • canManageAgency() → true for OWNER only                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMemberStatus (Enum)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyMemberStatus.php                           │ │
│ │ Responsibility: Define member statuses within an agency                 │ │
│ │ Reusable: YES (used across agency domain)                               │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • ACTIVE = 'active'                                                   │ │
│ │   • SUSPENDED = 'suspended'                                             │ │
│ │   • KICKED = 'kicked'                                                   │ │
│ │   • LEFT = 'left'                                                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → human-readable label                                      │ │
│ │   • isFinal() → true for KICKED, LEFT                                   │ │
│ │   • hasAccess() → true for ACTIVE only                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Transforms User model to minimal API representation     │ │
│ │ Reusable: YES (used across many endpoints for embedded user data)       │ │
│ │                                                                         │ │
│ │ Key Fields (12 total):                                                  │ │
│ │   • id, name, signature, avatar, frame                                  │ │
│ │   • gender, email, phone, country                                       │ │
│ │   • date_of_birth, wealth_xp, charm_xp                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Parent Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Provides common helpers for all API resources           │ │
│ │ Reusable: YES (parent class for all resources)                          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • with() → Adds meta.timestamp and meta.correlation_id               │ │
│ │   • canViewAdminFields() → checks Super Admin / Admin role              │ │
│ │   • userHasRole() → role checking helper                                │ │
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
│ 2. [SELECT]: Active agency members (with cursor pagination)                 │
│    Query: SELECT * FROM agency_members                                      │
│           WHERE agency_id = ? AND status = 'active'                         │
│           ORDER BY id ASC                                                   │
│           LIMIT 21                                                          │
│    Source: Agency::activeMembers()->cursorPaginate()                        │
│    Note: Fetches per_page + 1 to determine if more pages exist              │
│                                                                             │
│ 3. [SELECT]: Member users (eager loaded)                                    │
│    Query: SELECT id,name,avatar,frame,signature,gender,date_of_birth,       │
│           wealth_xp,charm_xp,email,phone,country                            │
│           FROM users WHERE id IN (?, ?, ...)                                │
│    Source: with('user:...')                                                 │
│                                                                             │
│ 4. [SELECT]: Inviters (eager loaded)                                        │
│    Query: SELECT id,name,avatar,frame,signature,gender,date_of_birth,       │
│           wealth_xp,charm_xp,email,phone,country                            │
│           FROM users WHERE id IN (?, ?, ...)                                │
│    Source: with('inviter:...')                                              │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Members list is not cached (dynamic data)                          │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None                                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Agency/AgencyMemberResource.php:24-61           │
│                                                                             │
│ BASE FIELDS (always included):                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = [                                                               │ │
│ │     'id' => $member->id,                                                │ │
│ │     'role' => $member->role->value,                                     │ │
│ │     'role_label' => $member->role->label(),                             │ │
│ │     'status' => $member->status->value,                                 │ │
│ │     'status_label' => $member->status->label(),                         │ │
│ │     'joined_at' => $member->created_at->toISOString(),                  │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: User (if relation loaded)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($member->relationLoaded('user')) {                                  │ │
│ │     $data['user'] = new MinimalUserResource($member->user);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Admin fields (agency admin/owner or platform admin)            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($this->canViewAdminFields($request) || $this->isAgencyAdmin(...)) { │ │
│ │     if ($member->relationLoaded('inviter') && $member->inviter) {       │ │
│ │         $data['invited_by'] = new MinimalUserResource($member->inviter);│ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // For kicked/left members only                                     │ │
│ │     if ($member->status->isFinal()) {                                   │ │
│ │         $data['left_at'] = $member->left_at?->toISOString();            │ │
│ │         $data['leave_reason'] = $member->leave_reason;                  │ │
│ │         if ($member->relationLoaded('remover') && $member->remover) {   │ │
│ │             $data['removed_by'] = new MinimalUserResource(...);         │ │
│ │         }                                                               │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ isAgencyAdmin() Helper (private method in AgencyMemberResource):            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ private function isAgencyAdmin(Request $request, AgencyMember $member)  │ │
│ │ {                                                                       │ │
│ │     $user = $request->user();                                           │ │
│ │     if ($user === null) return false;                                   │ │
│ │                                                                         │ │
│ │     $agency = $member->agency;                                          │ │
│ │     if ($agency->isOwnedBy($user)) return true;                         │ │
│ │                                                                         │ │
│ │     $actorMember = $agency->getMember($user);                           │ │
│ │     return $actorMember !== null && $actorMember->canManageMembers();   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body (paginated)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                       | Used By Endpoints             | Reusable | Reasoning                                   |
| -------------------------- | ----------------------------- | -------- | ------------------------------------------- |
| `AgencyController.php`     | All agency endpoints          | ⭕       | Contains multiple agency methods            |
| `AgencyPolicy.php`         | All agency authorization      | ✅       | Shared policy for all agency actions        |
| `Agency.php` (Model)       | Entire agency domain          | ✅       | Core model used throughout                  |
| `AgencyMember.php` (Model) | All agency member operations  | ✅       | Core model for membership data              |
| `AgencyMemberResource.php` | `members`, member management  | ✅       | Reused wherever member data is returned     |
| `AgencyMemberRole.php`     | All agency member operations  | ✅       | Role enum used across agency domain         |
| `AgencyMemberStatus.php`   | All agency member operations  | ✅       | Status enum used across agency domain       |
| `MinimalUserResource.php`  | Many endpoints across domains | ✅       | Generic minimal user representation         |
| `BaseResource.php`         | All API resources             | ✅       | Parent class providing metadata and helpers |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                          | Source         | Condition                                            |
| ------------------------------ | -------------- | ---------------------------------------------------- |
| "This action is unauthorized." | `AgencyPolicy` | Non-approved agency + user is not owner/member/admin |

### Not Found Errors (404)

| Error              | Source              | Condition                                  |
| ------------------ | ------------------- | ------------------------------------------ |
| "Agency not found" | Route Model Binding | Agency ID doesn't exist or is soft-deleted |

### Authentication Errors (401)

| Error              | Source         | Condition                       |
| ------------------ | -------------- | ------------------------------- |
| "Unauthenticated." | `auth:sanctum` | Missing or invalid Bearer token |

### Edge Cases

| Case                                   | Behavior                                                |
| -------------------------------------- | ------------------------------------------------------- |
| Agency with no active members          | Returns empty `data` array with pagination metadata     |
| Agency with 1000+ active members       | Cursor pagination handles efficiently without offset    |
| User viewing their own membership      | Can see their own data; admin fields depend on role     |
| Agency owner viewing members           | Sees all fields including `invited_by`                  |
| Regular user viewing public agency     | Sees standard fields, no `invited_by` or removal info   |
| Member without inviter (joined direct) | `invited_by` field omitted from response                |
| per_page exceeds maximum               | Laravel's paginate() allows, consider adding validation |
| Invalid cursor format                  | Returns 400 Bad Request from cursor pagination          |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            POLICY                  MODEL/RESOURCE          DATABASE
   │                       │                       │                    │                         │                      │
   │  GET /agencies/1/members                      │                    │                         │                      │
   │──────────────────────▶│                       │                    │                         │                      │
   │                       │                       │                    │                         │                      │
   │                       │ 1. Validate token     │                    │                         │                      │
   │                       │────────────────────────────────────────────────────────────────────────────────────────────▶│
   │                       │◀────────────────────────────────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                         │                      │
   │                       │ 2. Route Model Bind   │                    │                         │                      │
   │                       │────────────────────────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                    │                         │ SELECT FROM agencies │
   │                       │◀────────────────────────────────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                         │                      │
   │                       │ 3. members(Agency)    │                    │                         │                      │
   │                       │──────────────────────▶│                    │                         │                      │
   │                       │                       │                    │                         │                      │
   │                       │                       │ 4. authorize()     │                         │                      │
   │                       │                       │───────────────────▶│                         │                      │
   │                       │                       │                    │ 5. view() check         │                      │
   │                       │                       │                    │────────────────────────▶│                      │
   │                       │                       │                    │◀────────────────────────│                      │
   │                       │                       │◀───────────────────│ returns bool            │                      │
   │                       │                       │                    │                         │                      │
   │                       │                       │ 6. activeMembers()->with()->cursorPaginate()│                      │
   │                       │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │                       │                    │                         │ SELECT agency_members │
   │                       │                       │                    │                         │ SELECT users (eager)  │
   │                       │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                         │                      │
   │                       │                       │ 7. AgencyMemberResource::collection()        │                      │
   │                       │                       │────────────────────────────────────────────▶│                      │
   │                       │                       │                    │                         │ 8. toArray() per member│
   │                       │                       │                    │                         │ 9. isAgencyAdmin check │
   │                       │                       │◀────────────────────────────────────────────│ JSON array            │
   │                       │◀──────────────────────│                    │                         │                      │
   │◀──────────────────────│                       │                    │                         │                      │
   │                       │                       │                    │                         │                      │
   │  200 + JSON (paginated)                       │                    │                         │                      │
   │                       │                       │                    │                         │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                          | Location(s)                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| New member response field         | `AgencyMemberResource::toArray()` with visibility check      |
| New member filter (e.g., by role) | `AgencyController::members()` - add query parameter handling |
| New authorization rule            | `AgencyPolicy` (new method) or adjust `view()`               |
| New eager-loaded relationship     | `AgencyController::members()` - add to `with()` array        |
| Search by member name             | Add `$request->has('search')` filter in controller           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO MEMBER RESPONSE

| Step  | File                                                    | What to Change                             |
| ----- | ------------------------------------------------------- | ------------------------------------------ |
| **1** | `database/migrations/xxxx_add_field_agency_members.php` | Add column to agency_members table         |
| **2** | `app/Models/Agency/AgencyMember.php`                    | Add to `$fillable` array                   |
| **3** | `app/Http/Resources/V1/Agency/AgencyMemberResource.php` | Add field to `$data` array with visibility |

#### ➕ ADDING A NEW RELATIONSHIP TO MEMBER RESPONSE

| Step  | File                                                    | What to Change                                          |
| ----- | ------------------------------------------------------- | ------------------------------------------------------- |
| **1** | `app/Models/Agency/AgencyMember.php`                    | Define new relationship method                          |
| **2** | `app/Http/Controllers/.../AgencyController.php`         | Add to `with()` call in `members()` method              |
| **3** | `app/Http/Resources/V1/Agency/AgencyMemberResource.php` | Add conditional inclusion with `relationLoaded()` check |

#### ➖ REMOVING A FIELD FROM MEMBER RESPONSE

| Step  | File                                                    | What to Change                  |
| ----- | ------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Agency/AgencyMemberResource.php` | Remove field from `$data` array |
| **2** | (Optional) database migration                           | Drop column if no longer needed |

### 🔗 Field Flow Dependency Chain

```
Database (agency_members table)
        │
        ▼
AgencyMember Model (app/Models/Agency/AgencyMember.php)
        │
        │── $fillable array
        │── casts() (role, status enums)
        │── relationships (user, inviter, remover, agency)
        │
        ▼
Agency::activeMembers() scope
        │
        │── WHERE status = 'active'
        │
        ▼
AgencyController::members()
        │
        │── authorize('view', $agency)
        │── with(['user:...', 'inviter:...'])
        │── cursorPaginate()
        │
        ▼
AgencyMemberResource::toArray()
        │
        │── Base fields (always)
        │── User (if relationLoaded)
        │── Admin fields (if canViewAdminFields or isAgencyAdmin)
        │      ├── invited_by
        │      └── Removal info (if status.isFinal)
        │
        ▼
JSON Response (AnonymousResourceCollection with pagination)
```

### 📋 Field Modification Checklists

#### Adding a New Member Attribute

- [ ] Create database migration
- [ ] Add to `AgencyMember::$fillable`
- [ ] Add to `AgencyMember::casts()` if needed (enum/date)
- [ ] Add to `AgencyMemberResource::toArray()`
- [ ] Consider visibility (admin-only vs public)
- [ ] Update API documentation

#### Adding a Filter/Sort Option

- [ ] Add query parameter handling in controller
- [ ] Add validation if strict values required
- [ ] Update API contract documentation
- [ ] Consider performance (add index if needed)

### ⚠️ What Should NOT Be Modified Casually

| Component                         | Reason                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| `AgencyPolicy::view()` logic      | Core access control - changes affect member visibility     |
| `activeMembers()` scope           | Changes which members are returned; may expose kicked data |
| `isAgencyAdmin()` logic           | Controls who sees inviter info and removal details         |
| Cursor pagination to offset-based | Cursor pagination is more efficient for large datasets     |
| Eager loading column selections   | Optimized for performance, changing may expose data        |
| Role/Status enum values           | Breaking change for all clients                            |

### 🚨 Common Pitfalls

| Pitfall                                          | Prevention                                             |
| ------------------------------------------------ | ------------------------------------------------------ |
| Forgetting `relationLoaded()` before accessing   | Always check before including relationship in response |
| Adding sensitive fields without visibility check | Use `canViewAdminFields()` or `isAgencyAdmin()`        |
| N+1 query when checking agency admin status      | In resource, agency is accessed via loaded relation    |
| Removing activeMembers filter                    | Would expose kicked/left members incorrectly           |
| Breaking cursor pagination by adding ORDER BY    | Cursor pagination requires consistent ordering         |
| Not handling null inviter                        | Check `$member->inviter !== null` before using         |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                     ← Route definition (line 35)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php:145-157                          ← Controller members() method
app/Policies/Agency/
  └── AgencyPolicy.php:27-37                                ← view() authorization
app/Models/Agency/
  ├── Agency.php                                            ← Eloquent model (activeMembers scope)
  └── AgencyMember.php                                      ← Member model
app/Enums/Agency/
  ├── AgencyMemberRole.php                                  ← Role enum (owner, admin, member)
  └── AgencyMemberStatus.php                                ← Status enum (active, kicked, etc.)
app/Http/Resources/V1/Agency/
  └── AgencyMemberResource.php                              ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                               ← Embedded user resource
app/Http/Resources/
  └── BaseResource.php                                      ← Parent resource class
database/migrations/
  └── 2025_12_27_000002_create_agency_members_table.php     ← Table schema
```

---

## Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `GET /api/v1/agencies/{agency}/members` |
| **Domain**          | Agency                                  |
| **Author**          | System Documentation                    |
| **Created**         | 2026-02-03                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
