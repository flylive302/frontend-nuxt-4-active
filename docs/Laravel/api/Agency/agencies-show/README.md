# GET /api/v1/agencies/{agency}

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieve detailed information about a single agency by its ID. Returns agency details with conditional field visibility based on user role and relationship to the agency.

### Responsibilities

- Fetch a single agency by ID using Laravel model route binding
- Authorize access via `AgencyPolicy::view`
- Eager load related `owner` and `coinReseller` relationships
- Return agency data with role-based field visibility

### What It Owns

| Owned              | Description                                        |
| ------------------ | -------------------------------------------------- |
| Agency data access | Retrieves and formats single agency record         |
| Field visibility   | Controls which fields are visible based on context |

### External Dependencies

| Dependency | Type           | Purpose                                  |
| ---------- | -------------- | ---------------------------------------- |
| Database   | Infrastructure | Fetch agency and related user records    |
| Sanctum    | Auth Package   | Bearer token authentication              |
| Policy     | Authorization  | Determine view access based on user role |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/agencies/{agency}
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

---

### Response Schemas

#### ✅ Success Response (200)

**Public Fields (all authenticated users viewing approved agencies):**

```json
{
  "data": {
    "id": 1,
    "name": "string",
    "country": "PK",
    "logo": "https://imagekit.io/...",
    "status": "approved",
    "status_label": "Approved",
    "created_at": "2026-01-15T10:30:00.000000Z",
    "owner": {
      "id": 123,
      "name": "Agency Owner",
      "avatar": "https://...",
      "signature": "sig_abc123"
    },
    "member_count": 15
  },
  "meta": {
    "timestamp": "2026-02-03T03:14:18.000000Z",
    "correlation_id": "uuid"
  }
}
```

**Additional Fields for Owner/Member/Admin:**

```json
{
  "data": {
    "...public_fields...",
    "address": "123 Main Street, Lahore, Pakistan",
    "coin_reseller": {
      "id": 456,
      "name": "Reseller Name",
      "avatar": "https://..."
    }
  }
}
```

**Admin-Only Additional Fields:**

```json
{
  "data": {
    "...sensitive_fields...",
    "national_id_images": [
      {"url": "https://...", "file_id": "file_123"}
    ],
    "dissolved_at": "2026-01-20T00:00:00.000000Z",
    "reviewed_by": { "id": 1, "name": "Admin User" },
    "reviewed_at": "2026-01-16T12:00:00.000000Z"
  }
}
```

**Rejected Agency (Owner/Admin only):**

```json
{
  "data": {
    "...fields...",
    "rejection_note": "Invalid documents provided"
  }
}
```

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

| Code  | Condition                                      |
| ----- | ---------------------------------------------- |
| `200` | Agency found and user authorized to view       |
| `401` | No valid authentication token                  |
| `403` | User not authorized to view non-public agency  |
| `404` | Agency ID does not exist (model binding fails) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/agencies/{agency}                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:32                                            │
│ Route: Route::get('/{agency}', [AgencyController::class, 'show'])           │
│        ->name('agencies.show')                                              │
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
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:68-78         │
│ Method: show(Agency $agency): AgencyResource                                │
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
│ STEP 2: Eager Load Relationships                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency->load([                                                         │ │
│ │     'owner:id,name,avatar,frame,signature,gender,date_of_birth,        │ │
│ │            wealth_xp,charm_xp,email,phone,country',                     │ │
│ │     'coinReseller:id,name,avatar,frame,signature,gender,date_of_birth, │ │
│ │                   wealth_xp,charm_xp,email,phone,country'               │ │
│ │ ]);                                                                     │ │
│ │                                                                         │ │
│ │ Uses column selection to minimize data fetched                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Resource                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return new AgencyResource($agency);                                     │ │
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
│ │   • owner() → BelongsTo User via user_id                                │ │
│ │   • coinReseller() → BelongsTo User via coin_reseller_id                │ │
│ │   • activeMembers() → HasMany AgencyMember (status = ACTIVE)            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isApproved() → checks status === AgencyStatus::APPROVED             │ │
│ │   • isOwnedBy(User|int) → checks user_id match                          │ │
│ │   • hasMember(User|int) → checks activeMembers for user_id              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Transforms User model to minimal API representation     │ │
│ │ Reusable: YES (used across many endpoints for embedded user data)       │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • id, name, avatar, frame, signature                                  │ │
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
│ 2. [SELECT]: Owner user (eager loaded)                                      │
│    Query: SELECT id,name,avatar,... FROM users WHERE id = ?                │
│    Source: Agency::load('owner:...')                                        │
│                                                                             │
│ 3. [SELECT]: Coin reseller user (eager loaded)                              │
│    Query: SELECT id,name,avatar,... FROM users WHERE id = ?                │
│    Source: Agency::load('coinReseller:...')                                 │
│                                                                             │
│ 4. [SELECT]: Active member count (conditional, in resource)                 │
│    Query: SELECT COUNT(*) FROM agency_members WHERE agency_id = ?           │
│           AND status = 'active'                                             │
│    Source: AgencyResource::toArray() for approved agencies                  │
│    Note: Uses active_members_count if preloaded, falls back to query        │
│                                                                             │
│ 5. [SELECT]: Membership check (conditional, in resource)                    │
│    Query: SELECT EXISTS(...) FROM agency_members WHERE agency_id = ?        │
│           AND user_id = ? AND status = 'active'                             │
│    Source: canViewAgencySensitiveFields() → agency->hasMember()             │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Agency show is not cached                                          │
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
│ File: app/Http/Resources/V1/Agency/AgencyResource.php:24-75                 │
│                                                                             │
│ Field Visibility Logic:                                                     │
│                                                                             │
│ BASE FIELDS (always included):                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = [                                                               │ │
│ │     'id' => $agency->id,                                                │ │
│ │     'name' => $agency->name,                                            │ │
│ │     'country' => $agency->country,                                      │ │
│ │     'logo' => $agency->logo,                                            │ │
│ │     'status' => $agency->status->value,                                 │ │
│ │     'status_label' => $agency->status->label(),                         │ │
│ │     'created_at' => $agency->created_at->toISOString(),                 │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Owner (if relation loaded)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->relationLoaded('owner')) {                                 │ │
│ │     $data['owner'] = new MinimalUserResource($agency->owner);           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Member count (approved agencies only)                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($agency->isApproved()) {                                            │ │
│ │     $data['member_count'] = $agency->active_members_count               │ │
│ │         ?? $agency->activeMembers()->count();                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Sensitive fields (owner/member/admin)                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($this->canViewAgencySensitiveFields($request, $agency)) {           │ │
│ │     $data['address'] = $agency->address;                                │ │
│ │     if ($agency->relationLoaded('coinReseller') && ...) {               │ │
│ │         $data['coin_reseller'] = new MinimalUserResource(...);          │ │
│ │     }                                                                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CONDITIONAL: Rejection note (rejected status + sensitive access)            │
│ CONDITIONAL: Admin-only fields (national_id_images, dissolved_at, reviewer) │
│                                                                             │
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

| File                      | Used By Endpoints              | Reusable | Reasoning                                   |
| ------------------------- | ------------------------------ | -------- | ------------------------------------------- |
| `AgencyController.php`    | All agency endpoints           | ⭕       | Contains multiple agency methods            |
| `AgencyPolicy.php`        | All agency authorization       | ✅       | Shared policy for all agency actions        |
| `Agency.php` (Model)      | Entire agency domain           | ✅       | Core model used throughout                  |
| `AgencyResource.php`      | `index`, `show`, `store`, etc. | ✅       | Reused wherever agency data is returned     |
| `MinimalUserResource.php` | Many endpoints across domains  | ✅       | Generic minimal user representation         |
| `BaseResource.php`        | All API resources              | ✅       | Parent class providing metadata and helpers |

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

| Case                                  | Behavior                                               |
| ------------------------------------- | ------------------------------------------------------ |
| Approved agency viewed by random user | Returns public fields + owner + member_count           |
| Pending agency viewed by owner        | Returns all fields owner is authorized to see          |
| Pending agency viewed by non-owner    | Returns 403 Forbidden                                  |
| Dissolved agency viewed by admin      | Returns full data including dissolved_at               |
| Agency with no coin_reseller set      | coin_reseller field omitted from response              |
| Agency with no logo                   | logo field is null                                     |
| Member count query fallback           | Uses count query if active_members_count not preloaded |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            POLICY                  MODEL/RESOURCE          DATABASE
   │                       │                       │                    │                         │                      │
   │  GET /agencies/123    │                       │                    │                         │                      │
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
   │                       │ 3. show(Agency)       │                    │                         │                      │
   │                       │──────────────────────▶│                    │                         │                      │
   │                       │                       │                    │                         │                      │
   │                       │                       │ 4. authorize()     │                         │                      │
   │                       │                       │───────────────────▶│                         │                      │
   │                       │                       │                    │ 5. view() check         │                      │
   │                       │                       │                    │────────────────────────▶│                      │
   │                       │                       │                    │◀────────────────────────│                      │
   │                       │                       │◀───────────────────│ returns bool            │                      │
   │                       │                       │                    │                         │                      │
   │                       │                       │ 6. Load relations  │                         │                      │
   │                       │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │                       │                    │                         │ SELECT owner, reseller│
   │                       │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                         │                      │
   │                       │                       │ 7. new AgencyResource                        │                      │
   │                       │                       │────────────────────────────────────────────▶│                      │
   │                       │                       │                    │                         │ 8. canView checks     │
   │                       │                       │                    │                         │────────────────────▶│
   │                       │                       │                    │                         │◀────────────────────│
   │                       │                       │◀────────────────────────────────────────────│ JSON array            │
   │                       │◀──────────────────────│                    │                         │                      │
   │◀──────────────────────│                       │                    │                         │                      │
   │                       │                       │                    │                         │                      │
   │  200 + JSON           │                       │                    │                         │                      │
   │                       │                       │                    │                         │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location(s)                                        |
| ----------------------------- | -------------------------------------------------- |
| New response field            | `AgencyResource::toArray()` with visibility check  |
| New authorization rule        | `AgencyPolicy::view()` method                      |
| New eager-loaded relationship | `AgencyController::show()` - add to `load()` array |
| New model attribute           | `Agency` model `$fillable` + migration             |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                              | What to Change                             |
| ----- | ------------------------------------------------- | ------------------------------------------ |
| **1** | `database/migrations/xxxx_add_field_agencies.php` | Add column to agencies table               |
| **2** | `app/Models/Agency/Agency.php`                    | Add to `$fillable` array                   |
| **3** | `app/Http/Resources/V1/Agency/AgencyResource.php` | Add field to `$data` array with visibility |

#### ➕ ADDING A NEW RELATIONSHIP TO RESPONSE

| Step  | File                                              | What to Change                                          |
| ----- | ------------------------------------------------- | ------------------------------------------------------- |
| **1** | `app/Models/Agency/Agency.php`                    | Define new relationship method                          |
| **2** | `app/Http/Controllers/.../AgencyController.php`   | Add to `load()` call in `show()` method                 |
| **3** | `app/Http/Resources/V1/Agency/AgencyResource.php` | Add conditional inclusion with `relationLoaded()` check |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                              | What to Change                  |
| ----- | ------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Agency/AgencyResource.php` | Remove field from `$data` array |
| **2** | (Optional) database migration                     | Drop column if no longer needed |

### 🔗 Field Flow Dependency Chain

```
Database (agencies table)
        │
        ▼
Agency Model (app/Models/Agency/Agency.php)
        │
        │── $fillable array
        │── casts()
        │── relationships (owner, coinReseller)
        │
        ▼
AgencyController::show()
        │
        │── authorize('view', $agency)
        │── load(['owner:...', 'coinReseller:...'])
        │
        ▼
AgencyResource::toArray()
        │
        │── Base fields (always)
        │── Owner (if relationLoaded)
        │── Member count (if approved)
        │── Sensitive (if canViewAgencySensitiveFields)
        │── Admin-only (if canViewAdminFields)
        │
        ▼
JSON Response
```

### ⚠️ What Should NOT Be Modified Casually

| Component                              | Reason                                                     |
| -------------------------------------- | ---------------------------------------------------------- |
| `AgencyPolicy::view()` logic           | Core access control - changes affect who can view agencies |
| Route model binding                    | Automatic 404 handling for missing agencies                |
| `canViewAgencySensitiveFields()` logic | Controls PII exposure (address, coin reseller)             |
| `canViewAdminFields()` checks          | National ID images are highly sensitive                    |
| Eager loading column selections        | Optimized for performance, changing may expose data        |

### 🚨 Common Pitfalls

| Pitfall                                              | Prevention                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Forgetting `relationLoaded()` check before accessing | Always check before including relationship in response         |
| Adding sensitive fields without visibility check     | Use `canViewAgencySensitiveFields()` or `canViewAdminFields()` |
| N+1 query on member count                            | Use `withCount('activeMembers')` when eager loading            |
| Breaking policy for non-approved agencies            | Test with pending/rejected/dissolved statuses                  |
| Exposing national_id_images to non-admins            | Only include in `canViewAdminFields()` block                   |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                     ← Route definition (line 32)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php:68-78                            ← Controller show() method
app/Policies/Agency/
  └── AgencyPolicy.php:27-37                                ← view() authorization
app/Models/Agency/
  └── Agency.php                                            ← Eloquent model
app/Http/Resources/V1/Agency/
  └── AgencyResource.php                                    ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                               ← Embedded user resource
app/Http/Resources/
  └── BaseResource.php                                      ← Parent resource class
```

---

## Document Metadata

| Property            | Value                           |
| ------------------- | ------------------------------- |
| **Endpoint**        | `GET /api/v1/agencies/{agency}` |
| **Domain**          | Agency                          |
| **Author**          | System Documentation            |
| **Created**         | 2026-02-03                      |
| **Laravel Version** | 12.x                            |
| **PHP Version**     | 8.4                             |
