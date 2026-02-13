# GET /api/v1/user/agency/invitations/sent

> **Domain**: User Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Returns the paginated list of invitations that the authenticated user's managed agency (owned or admin of) has sent to prospective members.

### Responsibilities

- Verify the user is authenticated
- Determine the agency the user manages (owner or admin role)
- Retrieve invitations sent by that agency with related user and inviter data
- Return paginated results with invitation metadata

### What It Owns

| Owned                      | Description                                         |
| -------------------------- | --------------------------------------------------- |
| Sent invitations retrieval | Lists invitations sent by the user's managed agency |

### External Dependencies

| Dependency | Type           | Purpose                           |
| ---------- | -------------- | --------------------------------- |
| MySQL      | Database       | Store/retrieve agency invitations |
| Sanctum    | Authentication | Validates bearer token            |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/agency/invitations/sent
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key       | Config                   |
| ------- | --------- | ------------------------ |
| Default | `user:id` | `config('sanctum.rate')` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type      | Default | Constraints     | Description                |
| ---------- | --------- | ------- | --------------- | -------------------------- |
| `per_page` | `integer` | `20`    | Optional, 1-100 | Number of items per page   |
| `page`     | `integer` | `1`     | Optional, ≥1    | Page number for pagination |

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
      "user": {
        "id": 456,
        "name": "John Doe",
        "signature": "JD12345",
        "avatar": "https://...",
        "gender": "male",
        "email": "john@example.com",
        "phone": "+1234567890",
        "country": "US",
        "date_of_birth": "1990-01-01",
        "wealth_xp": "5000",
        "charm_xp": "3000"
      },
      "invited_by": {
        "id": 789,
        "name": "Agency Admin",
        "signature": "AA67890",
        "avatar": "https://...",
        "gender": "male",
        "email": "admin@example.com",
        "phone": "+0987654321",
        "country": "US",
        "date_of_birth": "1985-05-15",
        "wealth_xp": "10000",
        "charm_xp": "8000"
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
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": []
}
```

#### ❌ Not Managing Agency (403)

```json
{
  "status": "error",
  "message": "You do not manage any agency.",
  "data": null,
  "errors": []
}
```

### HTTP Status Codes

| Code  | Condition                                   |
| ----- | ------------------------------------------- |
| `200` | Success - invitations retrieved             |
| `401` | User not authenticated                      |
| `403` | User does not manage any operational agency |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                GET /api/v1/user/agency/invitations/sent                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:77-78                                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/sent', [AgencyInvitationController::class, 'sent'])        │ │
│ │     ->name('user.agency.invitations.sent');                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates bearer token, sets $request->user()           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No Form Request - controller uses Request directly                          │
│                                                                             │
│ Query parameters (per_page, page) are optional and handled by paginate()    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyInvitationController.php     │
│ Method: sent(Request $request)                                              │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get user's managed agency (via ManagesUserAgency trait)             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $this->getUserManagedAgency($user);                           │ │
│ │                                                                         │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not manage any agency.', [], 403);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Query sent invitations with eager loading                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitations = $agency->invitations()                                   │ │
│ │     ->with(['user', 'inviter'])                                         │ │
│ │     ->latest()                                                          │ │
│ │     ->paginate($request->input('per_page', 20));                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return paginated resource collection                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyInvitationResource::collection($invitations);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service - uses ManagesUserAgency trait directly                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ManagesUserAgency (Trait)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Concerns/ManagesUserAgency.php                                │ │
│ │ Responsibility: Determines which agency a user can manage               │ │
│ │ Reusable: YES (shared across agency management controllers)             │ │
│ │ Why It Exists: Centralizes owner/admin agency lookup logic              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getUserManagedAgency(User $user): ?Agency                           │ │
│ │     1. Checks user->ownedAgency (if operational)                        │ │
│ │     2. Checks user->activeAgencyMembership with owner/admin role        │ │
│ │     3. Returns Agency or null                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyInvitationResource (Resource)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyInvitationResource.php         │ │
│ │ Responsibility: Transforms AgencyInvitation model to JSON               │ │
│ │ Reusable: YES (used by multiple invitation endpoints)                   │ │
│ │ Why It Exists: Consistent invitation representation across API          │ │
│ │                                                                         │ │
│ │ Response Fields:                                                        │ │
│ │   • id, status, status_label, expires_at, created_at                    │ │
│ │   • is_expired, can_respond                                             │ │
│ │   • user (MinimalUserResource) - if relationship loaded                 │ │
│ │   • invited_by (MinimalUserResource) - if relationship loaded           │ │
│ │   • agency (conditional) - for received invitations                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Transforms User model to minimal JSON for embedding     │ │
│ │ Reusable: YES (used throughout API for nested user refs)                │ │
│ │ Why It Exists: Lightweight user representation for nested resources     │ │
│ │                                                                         │ │
│ │ Response Fields (12):                                                   │ │
│ │   • id, name, signature, avatar, frame, gender                          │ │
│ │   • email, phone, country, date_of_birth                                │ │
│ │   • wealth_xp, charm_xp                                                 │ │
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
│ 1. SELECT: Get user's owned agency                                          │
│    Query: SELECT * FROM agencies WHERE user_id = ? LIMIT 1                  │
│    Source: User::ownedAgency()                                              │
│                                                                             │
│ 2. SELECT: Get user's active agency membership (if no owned agency)         │
│    Query: SELECT * FROM agency_members                                      │
│           WHERE user_id = ? AND status = 'active'                           │
│           AND role IN ('owner', 'admin') LIMIT 1                            │
│    Source: User::activeAgencyMembership()                                   │
│                                                                             │
│ 3. SELECT: Get paginated invitations with eager loading                     │
│    Query: SELECT * FROM agency_invitations                                  │
│           WHERE agency_id = ?                                               │
│           ORDER BY created_at DESC                                          │
│           LIMIT ? OFFSET ?                                                  │
│    Source: Agency::invitations()                                            │
│                                                                             │
│ 4. SELECT: Eager load invited users                                         │
│    Query: SELECT * FROM users WHERE id IN (...)                             │
│    Source: with(['user'])                                                   │
│                                                                             │
│ 5. SELECT: Eager load inviters                                              │
│    Query: SELECT * FROM users WHERE id IN (...)                             │
│    Source: with(['inviter'])                                                │
│                                                                             │
│ 6. COUNT: Total invitations for pagination meta                             │
│    Query: SELECT COUNT(*) FROM agency_invitations WHERE agency_id = ?       │
│    Source: paginate()                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ AgencyInvitationResource::collection($invitations)                          │
│   → Returns Laravel's AnonymousResourceCollection                           │
│   → Automatically includes pagination links/meta                            │
│   → Each invitation transformed by AgencyInvitationResource::toArray()      │
│   → Nested user/inviter transformed by MinimalUserResource                  │
│                                                                             │
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

| File                                 | Used By Endpoints                    | Reusable | Reasoning                                  |
| ------------------------------------ | ------------------------------------ | -------- | ------------------------------------------ |
| `ManagesUserAgency.php`              | All agency management endpoints      | ✅       | Shared trait for owner/admin agency lookup |
| `AgencyInvitationResource.php`       | All invitation endpoints             | ✅       | Standard invitation transformation         |
| `MinimalUserResource.php`            | Many endpoints with nested users     | ✅       | Lightweight user representation            |
| `AgencyInvitationController::sent()` | Only this endpoint                   | ❌       | Specific to sent invitations listing       |
| `Agency::invitations()`              | Multiple agency/invitation endpoints | ✅       | Standard HasMany relationship              |
| `User::ownedAgency()`                | Agency management endpoints          | ✅       | Standard HasOne relationship               |
| `User::activeAgencyMembership()`     | Agency management endpoints          | ✅       | Standard membership query                  |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source                | Condition                     |
| ------------------ | --------------------- | ----------------------------- |
| "Unauthenticated." | Controller null check | $request->user() returns null |

### Authorization Errors (403)

| Error                           | Source     | Condition                           |
| ------------------------------- | ---------- | ----------------------------------- |
| "You do not manage any agency." | Controller | getUserManagedAgency() returns null |

### Edge Cases

| Case                                    | Behavior                                        |
| --------------------------------------- | ----------------------------------------------- |
| No invitations sent                     | Returns empty `data` array with pagination meta |
| User owns non-operational agency        | Returns 403 (agency must be operational)        |
| User is admin of non-operational agency | Returns 403 (agency must be operational)        |
| Expired invitations                     | Included in results (all invitations returned)  |
| Cancelled/declined invitations          | Included in results (all statuses returned)     |
| Large per_page value                    | Laravel handles pagination limits gracefully    |
| Invalid per_page type                   | Laravel casts to integer via input()            |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            TRAIT/MODEL               DATABASE
   │                       │                       │                       │                       │
   │  GET /invitations/sent│                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. auth:sanctum       │                       │                       │
   │                       │   validate token      │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 2. $request->user()   │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. getUserManagedAgency()                     │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. SELECT agencies    │
   │                       │                       │                       │   WHERE user_id = ?   │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. Check isOperational│
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. $agency->invitations()                     │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 7. SELECT invitations │
   │                       │                       │                       │   with user, inviter  │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │                       │                       │
   │                       │                       │ 8. Transform via      │                       │
   │                       │                       │   AgencyInvitationResource                    │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  200 + JSON           │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location                                     |
| ----------------------------- | -------------------------------------------- |
| Filter by status              | Controller `sent()` - add query parameter    |
| Search by invitee name        | Controller `sent()` - add whereHas condition |
| New invitation response field | `AgencyInvitationResource::toArray()`        |
| New user field in response    | `MinimalUserResource::toArray()`             |
| Additional eager loading      | Controller `sent()` - add to `with()` array  |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                        | What to Change                  |
| ----- | ----------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Resources/V1/Agency/AgencyInvitationResource.php` | Add field to `$data` array      |
| **2** | If from relation, add to `with()` in controller             | Add relation name to eager load |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                        | What to Change                       |
| ----- | ----------------------------------------------------------- | ------------------------------------ |
| **1** | `app/Http/Resources/V1/Agency/AgencyInvitationResource.php` | Remove from `$data` array            |
| **2** | If relation no longer needed, remove from `with()`          | Remove from eager load in controller |

#### 🔄 ADDING STATUS FILTER

| Step  | File                             | What to Change                         |
| ----- | -------------------------------- | -------------------------------------- |
| **1** | `AgencyInvitationController.php` | Add status validation and query filter |

```php
// Add after line 103 in sent() method
$status = $request->input('status');
$query = $agency->invitations()->with(['user', 'inviter']);

if ($status) {
    $query->where('status', $status);
}

$invitations = $query->latest()->paginate($request->input('per_page', 20));
```

### 🔗 Field Flow Dependency Chain

```
Request Query Params
        │
        ▼
┌───────────────────┐
│   per_page, page  │ → paginate() accepts these
└───────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│         AgencyInvitationResource          │
│ id, status, status_label, expires_at,     │
│ created_at, is_expired, can_respond       │
│ ┌─────────────────────────────────────┐   │
│ │ user → MinimalUserResource          │   │
│ └─────────────────────────────────────┘   │
│ ┌─────────────────────────────────────┐   │
│ │ invited_by → MinimalUserResource    │   │
│ └─────────────────────────────────────┘   │
└───────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                 | Reason                                                      |
| ------------------------- | ----------------------------------------------------------- |
| `ManagesUserAgency` trait | Shared by multiple controllers; changes affect all          |
| `MinimalUserResource`     | Used extensively; field changes affect many APIs            |
| `Agency::invitations()`   | Core relationship; changes could break other features       |
| `isOperational()` check   | Security gate; removing allows access to suspended agencies |

### 🚨 Common Pitfalls

| Pitfall                                 | Prevention                                             |
| --------------------------------------- | ------------------------------------------------------ |
| N+1 query on user/inviter               | Always use `with(['user', 'inviter'])`                 |
| Forgetting isOperational check          | Always call `getUserManagedAgency()` which includes it |
| Exposing sensitive user data            | Use `MinimalUserResource`, not full `UserResource`     |
| Returning invitations from wrong agency | Use trait method, don't query invitations directly     |
| Missing pagination                      | Always use `paginate()`, never `get()`                 |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:77-78                             ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyInvitationController.php:93-116               ← Controller::sent()
app/Concerns/
  └── ManagesUserAgency.php                               ← Trait for agency lookup
app/Http/Resources/V1/Agency/
  └── AgencyInvitationResource.php                        ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                             ← Nested user transformer
app/Models/Agency/
  ├── Agency.php                                          ← invitations() relationship
  └── AgencyInvitation.php                                ← Model with scopes/helpers
app/Models/User/
  └── User.php                                            ← ownedAgency, activeAgencyMembership
```

---

## Document Metadata

| Property            | Value                                      |
| ------------------- | ------------------------------------------ |
| **Endpoint**        | `GET /api/v1/user/agency/invitations/sent` |
| **Domain**          | User Agency Management                     |
| **Author**          | System Documentation                       |
| **Created**         | 2026-02-03                                 |
| **Laravel Version** | 12.x                                       |
| **PHP Version**     | 8.4                                        |
