# GET /api/v1/user/agency/join-requests

> **Domain**: User Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

The Join Requests endpoint returns incoming join requests for the agency managed by the authenticated user (as owner or admin). It provides a paginated list of pending requests from users who want to join the agency.

### Responsibilities

- Authenticate the current user
- Determine if user manages an agency (owner or admin)
- Return pending join requests with requester information
- Provide pagination support for large datasets

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Join request list retrieval | Fetches pending join requests for the managed agency |

### External Dependencies

| Dependency     | Type           | Purpose                          |
| -------------- | -------------- | -------------------------------- |
| Database       | Infrastructure | Query agency_join_requests table |
| users table    | Database       | Load requester user details      |
| agencies table | Database       | Verify agency ownership/admin    |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/agency/join-requests
```

### Authentication

✅ **Required** - Sanctum token required. User must be agency owner or admin.

### Rate Limiting

| Limiter       | Key       | Config          |
| ------------- | --------- | --------------- |
| API (default) | `user:id` | 60 requests/min |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type      | Default | Description                |
| ---------- | --------- | ------- | -------------------------- |
| `per_page` | `integer` | `20`    | Number of items per page   |
| `page`     | `integer` | `1`     | Page number for pagination |

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
      "message": "I would like to join your agency",
      "created_at": "2026-02-03T10:00:00.000000Z",
      "can_be_processed": true,
      "can_be_cancelled": true,
      "user": {
        "id": 456,
        "name": "John Doe",
        "signature": "ABC123",
        "avatar": "https://example.com/avatar.jpg",
        "frame": null,
        "gender": 1,
        "email": "john@example.com",
        "phone": "+1234567890",
        "country": "US",
        "date_of_birth": "1990-01-15",
        "wealth_xp": "1500",
        "charm_xp": "800"
      }
    }
  ],
  "links": {
    "first": "http://api.example.com/api/v1/user/agency/join-requests?page=1",
    "last": "http://api.example.com/api/v1/user/agency/join-requests?page=5",
    "prev": null,
    "next": "http://api.example.com/api/v1/user/agency/join-requests?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "path": "http://api.example.com/api/v1/user/agency/join-requests",
    "per_page": 20,
    "to": 20,
    "total": 100,
    "timestamp": "2026-02-03T10:00:00.000000Z",
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
    "timestamp": "2026-02-03T10:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not manage any agency.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-03T10:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                  |
| ----- | ------------------------------------------ |
| `200` | Success - join requests returned           |
| `401` | Unauthenticated - no valid token           |
| `403` | Forbidden - user doesn't manage any agency |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/agency/join-requests                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:98-99                                         │
│ Route: Route::get('/', [AgencyJoinRequestController::class, 'index'])       │
│        ->name('user.agency.join-requests')                                  │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token and loads user                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/Authenticate.php (Laravel default)                │
│                                                                             │
│ Sanctum middleware validates Bearer token and populates $request->user()    │
│ No custom FormRequest is used - uses standard Illuminate\Http\Request       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyJoinRequestController.php    │
│ Method: index(Request $request)                                             │
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
│ STEP 2: Get managed agency using trait method                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $this->getUserManagedAgency($user);                           │ │
│ │                                                                         │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not manage any agency.', [], 403);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Query pending join requests with user relation                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $requests = $agency->joinRequests()                                     │ │
│ │     ->pending()                                                         │ │
│ │     ->with(['user'])                                                    │ │
│ │     ->latest()                                                          │ │
│ │     ->paginate($request->input('per_page', 20));                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return resource collection                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyJoinRequestResource::collection($requests);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 TRAIT LAYER FLOW                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ TRAIT: ManagesUserAgency                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Concerns/ManagesUserAgency.php                                │ │
│ │ Method: getUserManagedAgency(User $user): ?Agency                       │ │
│ │                                                                         │ │
│ │ Logic Flow:                                                             │ │
│ │   1. Check if user owns an operational agency                           │ │
│ │      $ownedAgency = $user->ownedAgency;                                 │ │
│ │      if ($ownedAgency !== null && $ownedAgency->isOperational())        │ │
│ │          return $ownedAgency;                                           │ │
│ │                                                                         │ │
│ │   2. Check if user is admin of an operational agency                    │ │
│ │      $membership = $user->activeAgencyMembership()                      │ │
│ │          ->whereIn('role', ['owner', 'admin'])                          │ │
│ │          ->with('agency')                                               │ │
│ │          ->first();                                                     │ │
│ │      if ($membership !== null && $membership->agency->isOperational())  │ │
│ │          return $membership->agency;                                    │ │
│ │                                                                         │ │
│ │   3. Return null if no managed agency found                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyJoinRequest (Model)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyJoinRequest.php                           │ │
│ │ Responsibility: Eloquent model for join requests                        │ │
│ │ Reusable: YES (used by multiple join request endpoints)                 │ │
│ │ Why It Exists: Data layer for join request operations                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopePending() → Filters to PENDING status only                     │ │
│ │   • canBeProcessed() → Returns true if status == PENDING                │ │
│ │   • canBeCancelled() → Returns true if isPending()                      │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • agency() → BelongsTo Agency                                         │ │
│ │   • user() → BelongsTo User (requester)                                 │ │
│ │   • processor() → BelongsTo User (who approved/rejected)                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestStatus (Enum)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyJoinRequestStatus.php                      │ │
│ │ Responsibility: Type-safe status values with labels                     │ │
│ │ Reusable: YES (used across all join request features)                   │ │
│ │                                                                         │ │
│ │ Values: PENDING, APPROVED, REJECTED, CANCELLED                          │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable string                                     │ │
│ │   • canBeProcessed() → Returns $this === PENDING                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestResource (API Resource)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php        │ │
│ │ Responsibility: Transform join request for API response                 │ │
│ │ Reusable: YES (used by index, mine, approve endpoints)                  │ │
│ │                                                                         │ │
│ │ Output Fields:                                                          │ │
│ │   • id, status, status_label, message, created_at                       │ │
│ │   • can_be_processed, can_be_cancelled                                  │ │
│ │   • user (MinimalUserResource) - when user relation loaded              │ │
│ │   • agency (inline) - when agency relation loaded                       │ │
│ │   • processed_at, processed_by - when processed                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Minimal user data for nested references                 │ │
│ │ Reusable: YES (used by many resources for user embedding)               │ │
│ │                                                                         │ │
│ │ Output Fields (12):                                                     │ │
│ │   • id, name, signature, avatar, frame, gender                          │ │
│ │   • email, phone, country, date_of_birth                                │ │
│ │   • wealth_xp, charm_xp                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. [SELECT]: Get user's owned agency                                        │
│    Query: SELECT * FROM agencies WHERE user_id = ? LIMIT 1                  │
│    Source: ManagesUserAgency::getUserManagedAgency() via $user->ownedAgency │
│                                                                             │
│ 2. [SELECT]: Get user's active admin membership (if no owned agency)        │
│    Query: SELECT * FROM agency_members WHERE user_id = ?                    │
│           AND status = 'active' AND role IN ('owner', 'admin') LIMIT 1      │
│    Source: ManagesUserAgency via $user->activeAgencyMembership()            │
│                                                                             │
│ 3. [SELECT]: Get pending join requests for agency                           │
│    Query: SELECT * FROM agency_join_requests                                │
│           WHERE agency_id = ? AND status = 'pending'                        │
│           ORDER BY created_at DESC LIMIT ? OFFSET ?                         │
│    Source: Controller via $agency->joinRequests()->pending()                │
│                                                                             │
│ 4. [SELECT]: Eager load users for join requests                             │
│    Query: SELECT * FROM users WHERE id IN (?, ?, ...)                       │
│    Source: Controller via ->with(['user'])                                  │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ AgencyJoinRequestResource::collection($requests)                            │
│                                                                             │
│ For each join request, AgencyJoinRequestResource::toArray() builds:         │
│   1. Base fields: id, status, status_label, message, created_at             │
│   2. State flags: can_be_processed, can_be_cancelled                        │
│   3. User relation: Wraps in MinimalUserResource (since user is loaded)     │
│   4. Agency relation: Not included (agency not loaded for this endpoint)    │
│                                                                             │
│ Laravel's ResourceCollection wraps with pagination links & meta             │
│                                                                             │
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

| File                              | Used By Endpoints                                      | Reusable | Reasoning                                        |
| --------------------------------- | ------------------------------------------------------ | -------- | ------------------------------------------------ |
| `AgencyJoinRequestController.php` | join-requests, join-requests/mine, approve, reject     | ⭕       | Controller is endpoint-specific but groups logic |
| `ManagesUserAgency.php`           | join-requests, invitations, members, coin-reseller     | ✅       | Shared trait for agency management               |
| `AgencyJoinRequest.php`           | All join request endpoints, agency join, cancel        | ✅       | Core model for join requests                     |
| `AgencyJoinRequestResource.php`   | join-requests, mine, approve                           | ✅       | Shared resource transformer                      |
| `MinimalUserResource.php`         | Many endpoints (rooms, agencies, members, invitations) | ✅       | Universal user embedding resource                |
| `AgencyJoinRequestStatus.php`     | All join request features                              | ✅       | Shared enum for status values                    |
| `ApiResponse.php`                 | All API endpoints                                      | ✅       | Standardized response format                     |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error             | Source                       | Condition                  |
| ----------------- | ---------------------------- | -------------------------- |
| "Unauthenticated" | Controller `index()` line 40 | `$request->user()` is null |

### Authorization Errors (403)

| Error                           | Source                       | Condition                             |
| ------------------------------- | ---------------------------- | ------------------------------------- |
| "You do not manage any agency." | Controller `index()` line 46 | `getUserManagedAgency()` returns null |

### Edge Cases

| Case                                   | Behavior                                         |
| -------------------------------------- | ------------------------------------------------ |
| User owns agency but it's not approved | `isOperational()` returns false, 403 error       |
| User is member but not owner/admin     | `getUserManagedAgency()` returns null, 403 error |
| No pending join requests               | Returns empty array with pagination metadata     |
| per_page exceeds reasonable limit      | Laravel uses the value as-is (no built-in limit) |
| Invalid page number                    | Laravel returns empty data array                 |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            TRAIT                  DATABASE
   │                       │                       │                    │                       │
   │  GET /join-requests   │                       │                    │                       │
   │──────────────────────▶│                       │                    │                       │
   │                       │                       │                    │                       │
   │                       │ 1. Validate token     │                    │                       │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │                       │                    │                       │
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │    User loaded        │                    │                       │
   │                       │                       │                    │                       │
   │                       │ 2. Call index()       │                    │                       │
   │                       │──────────────────────▶│                    │                       │
   │                       │                       │                    │                       │
   │                       │                       │ 3. Get user        │                       │
   │                       │                       │  $request->user()  │                       │
   │                       │                       │                    │                       │
   │                       │                       │ 4. getUserManagedAgency()                  │
   │                       │                       │───────────────────▶│                       │
   │                       │                       │                    │                       │
   │                       │                       │                    │ 5. Query owned agency │
   │                       │                       │                    │──────────────────────▶│
   │                       │                       │                    │◀──────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │                    │ 6. Query membership   │
   │                       │                       │                    │    (if needed)        │
   │                       │                       │                    │──────────────────────▶│
   │                       │                       │                    │◀──────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │◀───────────────────│                       │
   │                       │                       │   Agency returned  │                       │
   │                       │                       │                    │                       │
   │                       │                       │ 7. Query pending join requests             │
   │                       │                       │──────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │ 8. Eager load users                        │
   │                       │                       │──────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────│
   │                       │                       │                    │                       │
   │                       │                       │ 9. Transform to Resource                   │
   │                       │                       │                    │                       │
   │                       │◀──────────────────────│                    │                       │
   │◀──────────────────────│                       │                    │                       │
   │                       │                       │                    │                       │
   │  200 OK + JSON        │                       │                    │                       │
   │                       │                       │                    │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                          |
| ------------------------- | ------------------------------------------------- |
| New filter parameter      | Controller `index()` - add query condition        |
| Additional response field | `AgencyJoinRequestResource::toArray()`            |
| New join request status   | `AgencyJoinRequestStatus` enum                    |
| Authorization rules       | Create `AgencyJoinRequestPolicy`                  |
| Caching                   | Wrap query in controller with `Cache::remember()` |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO JOIN REQUEST

| Step  | File                                                         | What to Change                       |
| ----- | ------------------------------------------------------------ | ------------------------------------ |
| **1** | **Database Migration**                                       | Add column to `agency_join_requests` |
| **2** | `app/Models/Agency/AgencyJoinRequest.php`                    | Add to `$fillable`                   |
| **3** | `app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php` | Add to `toArray()` output            |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                         | What to Change                         |
| ----- | ------------------------------------------------------------ | -------------------------------------- |
| **1** | `app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php` | Remove from `toArray()` output         |
| **2** | **Database Migration**                                       | Drop column (if safe/unused elsewhere) |

### 🔗 Field Flow Dependency Chain

```
Database (agency_join_requests)
         │
         ▼
┌─────────────────────────┐
│ AgencyJoinRequest Model │ ◄── casts status to AgencyJoinRequestStatus enum
└─────────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ AgencyJoinRequestResource     │ ◄── transforms model for API
└───────────────────────────────┘
         │
         ▼ (when user loaded)
┌───────────────────────────────┐
│ MinimalUserResource           │ ◄── embeds user details
└───────────────────────────────┘
         │
         ▼
    JSON Response
```

### 📋 Field Modification Checklists

#### Adding a New Query Filter

- [ ] Add parameter extraction in controller (`$request->input('filter_name')`)
- [ ] Add query condition (`->when($filter, fn($q) => $q->where(...))`)
- [ ] Document in API contract query parameters
- [ ] Add validation if complex value

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `ManagesUserAgency` trait        | Shared across many agency management endpoints            |
| `scopePending()` query scope     | Core filter for pending status, used by multiple features |
| `AgencyJoinRequestResource`      | Changes affect multiple endpoints (index, mine, approve)  |
| `MinimalUserResource` fields     | Used by dozens of endpoints across the application        |
| `AgencyJoinRequestStatus` values | Existing statuses are persisted in database               |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                             |
| ------------------------------------------ | ------------------------------------------------------ |
| Forgetting to eager load `user` relation   | Always use `->with(['user'])` for this endpoint        |
| Removing required fields from resource     | Check frontend dependencies before removing            |
| Changing `isOperational()` logic in Agency | This affects all agency management features            |
| Not handling null user properly            | Controller already has null check (line 39)            |
| Breaking `getPending()` scope behavior     | Test thoroughly - affects approval/rejection workflows |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                    ← Route definition (line 98-99)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyJoinRequestController.php                      ← Controller (index method)
app/Concerns/
  └── ManagesUserAgency.php                                ← Trait for agency management
app/Models/Agency/
  └── AgencyJoinRequest.php                                ← Eloquent model
  └── Agency.php                                           ← Agency model (relationships)
app/Enums/Agency/
  └── AgencyJoinRequestStatus.php                          ← Status enum
app/Http/Resources/V1/Agency/
  └── AgencyJoinRequestResource.php                        ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                              ← User embedding resource
app/Http/Utils/
  └── ApiResponse.php                                      ← Standardized response helper
```

---

## Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/agency/join-requests` |
| **Domain**          | User Agency Management                  |
| **Author**          | System Documentation                    |
| **Created**         | 2026-02-03                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
