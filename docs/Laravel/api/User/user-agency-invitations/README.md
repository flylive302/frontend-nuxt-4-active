# GET /api/v1/user/agency/invitations

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieves a paginated list of agency invitations received by the authenticated user. Returns only valid (pending and not expired) invitations.

### Responsibilities

- Authenticate user via Sanctum token
- Query user's received invitations with valid scope
- Eager load related agency and inviter data
- Return paginated response with invitation details

### What It Owns

| Owned             | Description                                           |
| ----------------- | ----------------------------------------------------- |
| Invitations Query | Builds and executes the query for user's invitations  |
| Response Format   | Transforms invitations into standardized API response |

### External Dependencies

| Dependency | Type           | Purpose                          |
| ---------- | -------------- | -------------------------------- |
| Database   | Infrastructure | Query `agency_invitations` table |
| Sanctum    | Package        | JWT/API token authentication     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/agency/invitations
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key       | Config           |
| ------- | --------- | ---------------- |
| Global  | IP + User | `config/api.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type      | Default | Description                 |
| ---------- | --------- | ------- | --------------------------- |
| `per_page` | `integer` | `20`    | Items per page (pagination) |
| `page`     | `integer` | `1`     | Page number                 |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "data": [
    {
      "id": 123,
      "status": "pending",
      "status_label": "Pending",
      "expires_at": "2026-02-10T12:00:00.000000Z",
      "created_at": "2026-02-03T12:00:00.000000Z",
      "is_expired": false,
      "can_respond": true,
      "agency": {
        "id": 456,
        "name": "Example Agency",
        "country": "US",
        "logo": "https://cdn.example.com/logo.jpg"
      },
      "invited_by": {
        "id": 789,
        "name": "John Doe",
        "signature": "ABC123",
        "avatar": "https://cdn.example.com/avatar.jpg",
        "frame": null,
        "gender": 1,
        "email": "john@example.com",
        "phone": "+1234567890",
        "country": "US",
        "date_of_birth": "1990-01-15",
        "wealth_xp": "1000",
        "charm_xp": "500"
      }
    }
  ],
  "links": {
    "first": "...",
    "last": "...",
    "prev": null,
    "next": "..."
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "per_page": 20,
    "to": 20,
    "total": 100
  }
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                         |
| ----- | --------------------------------- |
| `200` | Success with invitations list     |
| `401` | Invalid or missing authentication |
| `500` | Server error                      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/agency/invitations                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:74                                            │
│ Route: Route::get('/', [AgencyInvitationController::class, 'index'])        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::prefix('user/agency')->group(function () {                       │ │
│ │     Route::prefix('invitations')->group(function () {                   │ │
│ │         Route::get('/', [AgencyInvitationController::class, 'index'])   │ │
│ │             ->name('user.agency.invitations');                          │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, loads User                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 MIDDLEWARE EXECUTION                                                    │
│─────────────────────────────────────────────────────────────────────────────│
│ File: vendor/laravel/sanctum/src/Guard.php                                  │
│                                                                             │
│ Sanctum validates the Bearer token from Authorization header:               │
│   1. Extracts token from header                                             │
│   2. Queries personal_access_tokens table                                   │
│   3. Validates token hash and expiration                                    │
│   4. Loads User model and sets auth()->user()                               │
│                                                                             │
│ If token invalid → Returns 401 Unauthenticated                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php     │
│ Method: index(Request $request): AnonymousResourceCollection               │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return AgencyInvitationResource::collection([]);                    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build invitations query with scopes and eager loading              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitations = $user                                                    │ │
│ │     ->agencyInvitations()      // HasMany relationship                  │ │
│ │     ->valid()                   // Scope: pending + not expired         │ │
│ │     ->with(['agency', 'inviter']) // Eager load relationships           │ │
│ │     ->latest()                  // Order by created_at DESC             │ │
│ │     ->paginate($request->input('per_page', 20));                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return resource collection                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyInvitationResource::collection($invitations);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 MODEL & RELATIONSHIP LAYER                                              │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ RELATIONSHIP: User->agencyInvitations()                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php:341-344                                  │ │
│ │                                                                         │ │
│ │ public function agencyInvitations(): HasMany                            │ │
│ │ {                                                                       │ │
│ │     return $this->hasMany(AgencyInvitation::class);                     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ SCOPE: valid()                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyInvitation.php:136-140                    │ │
│ │                                                                         │ │
│ │ public function scopeValid(Builder $query): Builder                     │ │
│ │ {                                                                       │ │
│ │     return $query->where('status', AgencyInvitationStatus::PENDING)     │ │
│ │         ->where('expires_at', '>', now());                              │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ FILTERS OUT:                                                            │ │
│ │   • Non-pending invitations (accepted, declined, cancelled, expired)    │ │
│ │   • Expired invitations (expires_at <= now)                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EAGER LOADED RELATIONSHIPS:                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ agency(): BelongsTo<Agency>   → app/Models/Agency/AgencyInvitation.php  │ │
│ │ inviter(): BelongsTo<User>    → via 'invited_by' foreign key            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyInvitation (Model)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyInvitation.php                            │ │
│ │ Responsibility: Represents invitation to join an agency                 │ │
│ │ Reusable: YES (used by multiple invitation endpoints)                   │ │
│ │                                                                         │ │
│ │ Key Properties:                                                         │ │
│ │   • id, agency_id, user_id, invited_by                                  │ │
│ │   • status (AgencyInvitationStatus enum)                                │ │
│ │   • expires_at (default: 7 days from creation)                          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopeValid() → filters pending + not expired                        │ │
│ │   • isExpired() → checks if invitation has expired                      │ │
│ │   • canRespond() → checks if can accept/decline                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyInvitationStatus (Enum)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyInvitationStatus.php                       │ │
│ │ Responsibility: Defines invitation lifecycle states                     │ │
│ │ Reusable: YES (shared across invitation operations)                     │ │
│ │                                                                         │ │
│ │ Values: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED                 │ │
│ │ Methods: label(), isFinal(), canRespond(), color(), icon()              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Minimal user data for nested references                 │ │
│ │ Reusable: YES (used across many endpoints for user embedding)           │ │
│ │                                                                         │ │
│ │ Returns 12 fields: id, name, signature, avatar, frame, gender,          │ │
│ │   email, phone, country, date_of_birth, wealth_xp, charm_xp             │ │
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
│ 1. SELECT: Get user's valid invitations                                     │
│    Query:                                                                   │
│    SELECT * FROM `agency_invitations`                                       │
│    WHERE `user_id` = ?                                                      │
│      AND `status` = 'pending'                                               │
│      AND `expires_at` > NOW()                                               │
│    ORDER BY `created_at` DESC                                               │
│    LIMIT ? OFFSET ?                                                         │
│    Source: AgencyInvitationController::index()                              │
│                                                                             │
│ 2. SELECT: Eager load agencies                                              │
│    Query: SELECT * FROM `agencies` WHERE `id` IN (?, ?, ...)                │
│    Source: with(['agency'])                                                 │
│                                                                             │
│ 3. SELECT: Eager load inviters                                              │
│    Query: SELECT * FROM `users` WHERE `id` IN (?, ?, ...)                   │
│    Source: with(['inviter'])                                                │
│                                                                             │
│ 4. COUNT: Pagination total                                                  │
│    Query: SELECT COUNT(*) FROM `agency_invitations` WHERE ...               │
│    Source: paginate()                                                       │
│                                                                             │
│ INDEX USAGE:                                                                │
│   • `agency_invitations_valid_scope_idx` on (status, expires_at)            │
│   • `agency_invitations_user_id_status_index` on (user_id, status)          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Agency/AgencyInvitationResource.php             │
│                                                                             │
│ Transform each invitation:                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = [                                                               │ │
│ │     'id' => $invitation->id,                                            │ │
│ │     'status' => $invitation->status->value,                             │ │
│ │     'status_label' => $invitation->status->label(),                     │ │
│ │     'expires_at' => $invitation->expires_at?->toISOString(),            │ │
│ │     'created_at' => $invitation->created_at?->toISOString(),            │ │
│ │     'is_expired' => $invitation->isExpired(),                           │ │
│ │     'can_respond' => $invitation->canRespond(),                         │ │
│ │ ];                                                                      │ │
│ │                                                                         │ │
│ │ // Agency info (for invitee view)                                       │ │
│ │ if ($invitation->relationLoaded('agency')) {                            │ │
│ │     $data['agency'] = [                                                 │ │
│ │         'id' => $invitation->agency->id,                                │ │
│ │         'name' => $invitation->agency->name,                            │ │
│ │         'country' => $invitation->agency->country,                      │ │
│ │         'logo' => $invitation->agency->logo,                            │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // Inviter info                                                         │ │
│ │ if ($invitation->relationLoaded('inviter')) {                           │ │
│ │     $data['invited_by'] = new MinimalUserResource($invitation->inviter);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Laravel automatically wraps in paginated response structure                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + Paginated JSON Body                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                | Used By Endpoints                        | Reusable | Reasoning                                         |
| ----------------------------------- | ---------------------------------------- | -------- | ------------------------------------------------- |
| `AgencyInvitationController.php`    | All invitation endpoints                 | ⭕       | Controller specific, but methods are modular      |
| `AgencyInvitation.php` (Model)      | invite, accept, decline, sent, cancel    | ✅       | Core domain model for all invitation operations   |
| `AgencyInvitationResource.php`      | All invitation list/detail endpoints     | ✅       | Standardized invitation response format           |
| `MinimalUserResource.php`           | 20+ endpoints (rooms, agencies, members) | ✅       | Generic user embedding resource                   |
| `AgencyInvitationStatus.php` (Enum) | All invitation status operations         | ✅       | Central status definition                         |
| `User.php` (agencyInvitations())    | This endpoint only                       | ⭕       | Relationship defined on User, specific to invites |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source        | Condition                     |
| ------------------ | ------------- | ----------------------------- |
| "Unauthenticated." | Sanctum Guard | Missing/invalid/expired token |

### System Errors (500)

| Error               | Source          | Condition                   |
| ------------------- | --------------- | --------------------------- |
| Database connection | Query Execution | Database unavailable        |
| Query timeout       | paginate()      | Very large dataset + no idx |

### Edge Cases

| Case                           | Behavior                                          |
| ------------------------------ | ------------------------------------------------- |
| No invitations                 | Returns empty `data: []` with pagination meta     |
| All invitations expired        | Returns empty list (valid scope filters them out) |
| User is null (shouldn't occur) | Returns empty collection (safety fallback)        |
| per_page = 0                   | Laravel treats as default (20)                    |
| per_page > 100                 | Consider adding validation (not currently)        |
| Inviter user deleted           | MinimalUserResource handles null gracefully       |
| Agency deleted                 | Cascade delete removes invitation (FK constraint) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                SANCTUM GUARD           CONTROLLER            MODEL                  DATABASE
   │                        │                       │                    │                       │
   │  GET /user/agency/     │                       │                    │                       │
   │  invitations           │                       │                    │                       │
   │──────────────────────▶│                       │                    │                       │
   │                        │                       │                    │                       │
   │                        │ 1. Validate token     │                    │                       │
   │                        │──────────────────────────────────────────────────────────────────▶│
   │                        │                       │                    │                       │
   │                        │◀──────────────────────────────────────────────────────────────────│
   │                        │    User loaded        │                    │                       │
   │                        │                       │                    │                       │
   │                        │ 2. Pass to controller │                    │                       │
   │                        │──────────────────────▶│                    │                       │
   │                        │                       │                    │                       │
   │                        │                       │ 3. Get user        │                       │
   │                        │                       │   invitations      │                       │
   │                        │                       │───────────────────▶│                       │
   │                        │                       │                    │                       │
   │                        │                       │                    │ 4. Query with         │
   │                        │                       │                    │    valid() scope      │
   │                        │                       │                    │──────────────────────▶│
   │                        │                       │                    │                       │
   │                        │                       │                    │◀──────────────────────│
   │                        │                       │                    │    Invitations        │
   │                        │                       │                    │                       │
   │                        │                       │                    │ 5. Eager load         │
   │                        │                       │                    │    agency, inviter    │
   │                        │                       │                    │──────────────────────▶│
   │                        │                       │                    │                       │
   │                        │                       │                    │◀──────────────────────│
   │                        │                       │                    │    Related data       │
   │                        │                       │                    │                       │
   │                        │                       │◀───────────────────│                       │
   │                        │                       │    Paginator       │                       │
   │                        │                       │                    │                       │
   │                        │                       │ 6. Transform via   │                       │
   │                        │                       │    Resource        │                       │
   │                        │                       │                    │                       │
   │                        │◀──────────────────────│                    │                       │
   │◀──────────────────────│                       │                    │                       │
   │                        │                       │                    │                       │
   │  200 OK + JSON         │                       │                    │                       │
   │                        │                       │                    │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                   | Location                                      |
| -------------------------- | --------------------------------------------- |
| New filter (by agency)     | Controller query + query parameter validation |
| New response field         | `AgencyInvitationResource::toArray()`         |
| Different sorting          | Controller query before `->latest()`          |
| Cache layer                | Wrap query in Cache::remember() in controller |
| New scope (e.g., byStatus) | `AgencyInvitation` model                      |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                        | What to Change                 |
| ----- | ----------------------------------------------------------- | ------------------------------ |
| **1** | `app/Http/Resources/V1/Agency/AgencyInvitationResource.php` | Add field to `$data` array     |
| **2** | If from relation, ensure eager loaded in controller         | Add to `with([...])` if needed |
| **3** | Update API documentation                                    | Add to response schema         |

#### ➕ ADDING A NEW FILTER PARAMETER

| Step  | File                                                 | What to Change               |
| ----- | ---------------------------------------------------- | ---------------------------- |
| **1** | `AgencyInvitationController::index()`                | Add query parameter handling |
| **2** | Optionally add new scope to `AgencyInvitation` model | Create scopeByX() method     |
| **3** | Update API documentation                             | Add to query parameters      |

#### ➖ REMOVING A RESPONSE FIELD

| Step  | File                                                        | What to Change              |
| ----- | ----------------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Resources/V1/Agency/AgencyInvitationResource.php` | Remove from `$data` array   |
| **2** | If relation no longer needed, remove from `with([])`        | Controller eager loading    |
| **3** | Update API documentation                                    | Remove from response schema |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD FLOW: agency.name                              │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Controller                Model                    Resource                │
│  with(['agency'])    →     agency(): BelongsTo  →   $data['agency']['name'] │
│                            ↓                                                │
│                      agencies table                                         │
│                      └── name column                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD FLOW: invited_by.name                          │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  Controller                Model                    Resource                │
│  with(['inviter'])   →     inviter(): BelongsTo →   MinimalUserResource     │
│                            (invited_by FK)          └── name field          │
│                            ↓                                                │
│                      users table                                            │
│                      └── name column                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding a computed field (e.g., `days_until_expiry`)

- [ ] Add computation in `AgencyInvitationResource::toArray()`
- [ ] Or add accessor in `AgencyInvitation` model
- [ ] Update documentation

#### Adding agency relationship field (e.g., `agency.member_count`)

- [ ] Ensure agency is eager loaded (already is)
- [ ] Add field to agency array in `AgencyInvitationResource`
- [ ] Consider N+1 if accessing relation on Agency

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `valid()` scope conditions         | Core business logic - changes affect all invitation views |
| `agencyInvitations()` relationship | Used by multiple endpoints                                |
| Response field names               | Breaking API change for clients                           |
| Pagination structure               | Laravel standard, clients depend on meta/links format     |
| `MinimalUserResource` fields       | Shared across 20+ endpoints                               |

### 🚨 Common Pitfalls

| Pitfall                                  | Prevention                                     |
| ---------------------------------------- | ---------------------------------------------- |
| Adding relation without eager loading    | Always check N+1 - add to `with([])` if needed |
| Forgetting expired check in valid scope  | The scope handles this - don't override        |
| Changing response structure              | Version API or document breaking changes       |
| Not handling soft-deleted inviter/agency | FK constraints cascade delete invitations      |
| Exposing sensitive user data             | Use MinimalUserResource, not full UserResource |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:74                              ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyInvitationController.php                    ← Controller (index method)
app/Models/Agency/
  └── AgencyInvitation.php                              ← Model + scopes + relationships
app/Models/User/
  └── User.php                                          ← agencyInvitations() relationship
app/Http/Resources/V1/Agency/
  └── AgencyInvitationResource.php                      ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                           ← Nested user resource
app/Enums/Agency/
  └── AgencyInvitationStatus.php                        ← Status enum
database/migrations/
  └── 2025_12_27_000003_create_agency_invitations_table.php  ← Table schema
```

---

## Document Metadata

| Property            | Value                                 |
| ------------------- | ------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/agency/invitations` |
| **Domain**          | Agency                                |
| **Author**          | System Documentation                  |
| **Created**         | 2026-02-03                            |
| **Laravel Version** | 12.x                                  |
| **PHP Version**     | 8.4                                   |
