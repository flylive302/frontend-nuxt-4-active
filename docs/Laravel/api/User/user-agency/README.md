# GET /api/v1/user/agency

> **Domain**: User / Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieves the authenticated user's current agency relationship - either as an owner of an agency or as a member of one.

### Responsibilities

- Check if user owns an agency
- Check if user has active agency membership
- Return appropriate agency details with owner/membership context
- Apply field visibility rules based on user relationship

### What It Owns

| Owned                      | Description                                 |
| -------------------------- | ------------------------------------------- |
| User's agency relationship | Returns owned or member agency with context |
| Ownership status           | Determines if user is owner or member       |
| Membership details         | Returns membership info for non-owners      |

### External Dependencies

| Dependency | Type           | Purpose                         |
| ---------- | -------------- | ------------------------------- |
| Database   | PostgreSQL     | Users, agencies, agency_members |
| Sanctum    | Authentication | Token validation                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/agency
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config                       |
| ------- | ------- | ---------------------------- |
| Default | User ID | Laravel default rate limiter |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
No request body required (GET request)
```

---

### Response Schemas

#### ✅ Success Response - User Owns Agency (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "agency": {
      "id": "integer",
      "name": "string",
      "country": "string",
      "logo": "string|null",
      "status": "string",           // "pending", "approved", "rejected", "dissolved"
      "status_label": "string",     // Human-readable status
      "created_at": "ISO8601",
      "owner": {                    // MinimalUserResource
        "id": "integer",
        "name": "string",
        "signature": "string",
        "avatar": "string|null",
        "frame": "string|null",
        "gender": "integer",
        "email": "string",
        "phone": "string|null",
        "country": "string|null",
        "date_of_birth": "string|null",
        "wealth_xp": "string",
        "charm_xp": "string"
      },
      "member_count": "integer",    // Only if approved
      "address": "string",          // Sensitive field (owner/member only)
      "coin_reseller": {...}        // MinimalUserResource (if set, sensitive)
    },
    "membership": null,             // null when user is owner
    "is_owner": true
  },
  "meta": {
    "timestamp": "ISO8601",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response - User Is Member (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "agency": {
      "id": "integer",
      "name": "string",
      "country": "string",
      "logo": "string|null",
      "status": "string",
      "status_label": "string",
      "created_at": "ISO8601",
      "owner": {...},               // MinimalUserResource
      "member_count": "integer",
      "address": "string",          // Visible to members
      "coin_reseller": {...}        // If set
    },
    "membership": {                 // AgencyMemberResource
      "id": "integer",
      "role": "string",             // "admin", "member"
      "role_label": "string",
      "status": "string",           // "active"
      "status_label": "string",
      "joined_at": "ISO8601"
    },
    "is_owner": false
  },
  "meta": {
    "timestamp": "ISO8601",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response - User Has No Agency (200)

```json
{
  "status": "success",
  "message": "You are not part of any agency.",
  "data": null,
  "meta": {
    "timestamp": "ISO8601",
    "correlation_id": "uuid"
  }
}
```

#### ✅ Success Response - Not Authenticated (200)

```json
{
  "status": "success",
  "message": "Not authenticated.",
  "data": null,
  "meta": {
    "timestamp": "ISO8601",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Authentication Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "ISO8601",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                             |
| ----- | ------------------------------------- |
| `200` | Success (with data, null, or message) |
| `401` | Missing/invalid authentication token  |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/agency                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:57                                            │
│ Route: Route::get('/', [AgencyMembershipController::class, 'show'])         │
│        ->name('user.agency.show')                                           │
│                                                                             │
│ Route is wrapped in:                                                        │
│   Route::prefix('user/agency')->group(function () { ... })                  │
│   Route::middleware(['auth:sanctum'])->group(function () { ... })           │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Sanctum bearer token                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: vendor/laravel/sanctum/...                                            │
│                                                                             │
│ No custom FormRequest used - endpoint uses base Illuminate\Http\Request     │
│ Sanctum middleware validates the bearer token and populates $request->user()│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Token validation happens automatically                               │ │
│ │ // $request->user() returns authenticated User or null                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMembershipController.php     │
│ Method: show(Request $request)                                              │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::success(null, 'Not authenticated.');            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check for owned agency                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $ownedAgency = $user->ownedAgency()                                     │ │
│ │     ->with(['owner', 'coinReseller'])                                   │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($ownedAgency !== null) {                                            │ │
│ │     return ApiResponse::success([                                       │ │
│ │         'agency' => new AgencyResource($ownedAgency),                   │ │
│ │         'membership' => null,                                           │ │
│ │         'is_owner' => true,                                             │ │
│ │     ]);                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Check for active membership                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membership = $user->activeAgencyMembership()                           │ │
│ │     ->with(['agency.owner', 'agency.coinReseller'])                     │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if ($membership !== null) {                                             │ │
│ │     return ApiResponse::success([                                       │ │
│ │         'agency' => new AgencyResource($membership->agency),            │ │
│ │         'membership' => new AgencyMemberResource($membership),          │ │
│ │         'is_owner' => false,                                            │ │
│ │     ]);                                                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: No agency found                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'You are not part of any agency.');   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service layer for this endpoint.                               │
│ Logic is handled directly in controller using Eloquent relationships.       │
│                                                                             │
│ Relationship access pattern:                                                │
│   User → ownedAgency() → HasOne<Agency>                                     │
│   User → activeAgencyMembership() → HasOne<AgencyMember>                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: AgencyResource (API Resource)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyResource.php                   │ │
│ │ Responsibility: Transforms Agency model to API response                 │ │
│ │ Reusable: YES (used by all agency endpoints)                            │ │
│ │ Why It Exists: Consistent agency representation with field visibility   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Transforms Agency to array with conditional fields      │ │
│ │   • canViewAgencySensitiveFields() → Checks owner/member/admin access   │ │
│ │                                                                         │ │
│ │ Conditional Fields:                                                     │ │
│ │   • member_count → Only for approved agencies                           │ │
│ │   • address, coin_reseller → Sensitive (owner/member/admin)             │ │
│ │   • rejection_note → Only for rejected status + sensitive access        │ │
│ │   • national_id_images, reviewed_by → Admin only                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMemberResource (API Resource)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyMemberResource.php             │ │
│ │ Responsibility: Transforms AgencyMember model to API response           │ │
│ │ Reusable: YES (used by member listing endpoints)                        │ │
│ │ Why It Exists: Consistent membership representation                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Transforms membership to array                          │ │
│ │   • isAgencyAdmin() → Checks if viewer is agency admin                  │ │
│ │                                                                         │ │
│ │ Conditional Fields:                                                     │ │
│ │   • invited_by → Admin/owner only                                       │ │
│ │   • left_at, leave_reason, removed_by → Final status + admin            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Minimal user info for nested references                 │ │
│ │ Reusable: YES (used across all domains for owner/user embedding)        │ │
│ │ Why It Exists: Optimized 12-field user representation                   │ │
│ │                                                                         │ │
│ │ Fields: id, name, signature, avatar, frame, gender, email, phone,       │ │
│ │         country, date_of_birth, wealth_xp, charm_xp                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Consistent API response formatting                      │ │
│ │ Reusable: YES (used by ALL API endpoints)                               │ │
│ │ Why It Exists: Enforces standard response structure                     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Standard success response with meta                     │ │
│ │   • error() → Standard error response with meta                         │ │
│ │   • getCorrelationId() → Request tracking ID                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BaseResource (Abstract Resource)                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/BaseResource.php                               │ │
│ │ Responsibility: Common resource helper methods                          │ │
│ │ Reusable: YES (extended by all API resources)                           │ │
│ │ Why It Exists: Role-based field visibility helpers                      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • canViewAdminFields() → Super Admin / Admin check                    │ │
│ │   • canViewModeratorFields() → Includes Moderator                       │ │
│ │   • userHasRole() → Role checking utility                               │ │
│ │   • formatTimestamp() → ISO8601 formatting                              │ │
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
│ 1. SELECT (ownedAgency): Query user's owned agency with relations           │
│    Query: SELECT * FROM agencies WHERE user_id = ? LIMIT 1                  │
│           + eager load owner, coinReseller                                  │
│    Source: User::ownedAgency()->with([...])->first()                        │
│                                                                             │
│ 2. SELECT (activeAgencyMembership): Query active membership (if no owned)   │
│    Query: SELECT * FROM agency_members                                      │
│           WHERE user_id = ? AND status = 'active' LIMIT 1                   │
│           + eager load agency.owner, agency.coinReseller                    │
│    Source: User::activeAgencyMembership()->with([...])->first()             │
│                                                                             │
│ 3. SELECT (member_count - optional): Get active members count               │
│    Query: SELECT count(*) FROM agency_members                               │
│           WHERE agency_id = ? AND status = 'active'                         │
│    Source: Agency::activeMembers()->count() (fallback if not preloaded)     │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - Direct database queries only                                       │
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
│                                                                             │
│ Response built using ApiResponse::success() with nested Resources:          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'agency' => new AgencyResource($agency),     // Transforms Agency   │ │
│ │     'membership' => $membership ? new AgencyMemberResource($membership) │ │
│ │                                 : null,                                 │ │
│ │     'is_owner' => $isOwner,                      // Boolean flag        │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ApiResponse::success() wraps data with:                                     │
│   • status: "success"                                                       │
│   • message: "Success" (or custom message)                                  │
│   • data: The array above (or null)                                         │
│   • meta: { timestamp, correlation_id }                                     │
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

| File                                             | Used By Endpoints                    | Reusable | Reasoning                                 |
| ------------------------------------------------ | ------------------------------------ | -------- | ----------------------------------------- |
| `AgencyMembershipController.php`                 | user/agency/\*                       | ⭕       | Methods shared within user agency context |
| `AgencyResource.php`                             | All agency endpoints                 | ✅       | Standard agency representation            |
| `AgencyMemberResource.php`                       | Member listing, membership endpoints | ✅       | Standard member representation            |
| `MinimalUserResource.php`                        | All domains needing user embedding   | ✅       | Optimized nested user data                |
| `BaseResource.php`                               | All API resources                    | ✅       | Common resource helper methods            |
| `ApiResponse.php`                                | ALL API endpoints                    | ✅       | Standardized response wrapper             |
| `User.php` (ownedAgency, activeAgencyMembership) | Agency membership features           | ✅       | Eloquent relationships                    |
| `Agency.php`                                     | All agency operations                | ✅       | Core agency model                         |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

N/A - This endpoint has no request body or parameters to validate.

### Business Logic Errors (400)

N/A - This endpoint does not produce business logic errors.

### System Errors (500)

| Error                | Source           | Condition                       |
| -------------------- | ---------------- | ------------------------------- |
| Database exception   | Eloquent queries | Database connection failure     |
| Unexpected exception | Any component    | Uncaught exception in execution |

### Edge Cases

| Case                                  | Behavior                                                     |
| ------------------------------------- | ------------------------------------------------------------ |
| User null after auth middleware       | Returns success with null data + "Not authenticated."        |
| User owns agency with pending status  | Returns agency with pending status, sensitive fields visible |
| User owns dissolved agency            | Returns dissolved agency info                                |
| Agency has no coin reseller set       | coin_reseller field omitted from response                    |
| User is both owner and has membership | Owner takes priority - membership not queried                |
| Agency approved but no members yet    | member_count shows 0                                         |
| active_members_count not preloaded    | Falls back to count() query (potential N+1)                  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE                 CONTROLLER               DATABASE
   │                     │                           │                       │
   │  GET /api/v1/user/agency                        │                       │
   │  Authorization: Bearer {token}                  │                       │
   │────────────────────▶│                           │                       │
   │                     │                           │                       │
   │                     │ 1. auth:sanctum           │                       │
   │                     │    Validate token         │                       │
   │                     │────────────────────────────────────────────────────▶│
   │                     │                           │                       │
   │                     │◀────────────────────────────────────────────────────│
   │                     │    user record            │                       │
   │                     │                           │                       │
   │                     │ 2. Dispatch to controller │                       │
   │                     │──────────────────────────▶│                       │
   │                     │                           │                       │
   │                     │                           │ 3. $user = $request->user()
   │                     │                           │                       │
   │                     │                           │ 4. Query ownedAgency  │
   │                     │                           │──────────────────────▶│
   │                     │                           │                       │
   │                     │                           │◀──────────────────────│
   │                     │                           │    Agency|null        │
   │                     │                           │                       │
   │                     │                           │ 5. If null, query     │
   │                     │                           │    activeAgencyMembership
   │                     │                           │──────────────────────▶│
   │                     │                           │                       │
   │                     │                           │◀──────────────────────│
   │                     │                           │    AgencyMember|null  │
   │                     │                           │                       │
   │                     │                           │ 6. Build Resources    │
   │                     │                           │    AgencyResource     │
   │                     │                           │    AgencyMemberResource│
   │                     │                           │                       │
   │                     │                           │ 7. ApiResponse::success()
   │                     │◀──────────────────────────│                       │
   │                     │                           │                       │
   │◀────────────────────│                           │                       │
   │                     │                           │                       │
   │  200 OK + JSON      │                           │                       │
   │  {status, message,  │                           │                       │
   │   data, meta}       │                           │                       │
   │                     │                           │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                         | Location                                         |
| -------------------------------- | ------------------------------------------------ |
| New agency field in response     | `AgencyResource::toArray()`                      |
| New membership field in response | `AgencyMemberResource::toArray()`                |
| Additional sensitive field check | `AgencyResource::canViewAgencySensitiveFields()` |
| New agency relationship          | `User.php` + eager load in controller            |
| Caching for performance          | Controller or create dedicated service           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO AGENCY RESPONSE

| Step  | File                                                 | What to Change                        |
| ----- | ---------------------------------------------------- | ------------------------------------- |
| **1** | `database/migrations/xxxx_add_field_to_agencies.php` | Add column to agencies table          |
| **2** | `app/Models/Agency/Agency.php`                       | Add to `$fillable` if mass-assignable |
| **3** | `app/Http/Resources/V1/Agency/AgencyResource.php`    | Add field to `toArray()` output       |
| **4** | Consider field visibility                            | Add to sensitive/admin conditional    |

#### ➕ ADDING A NEW FIELD TO MEMBERSHIP RESPONSE

| Step  | File                                                       | What to Change                  |
| ----- | ---------------------------------------------------------- | ------------------------------- |
| **1** | `database/migrations/xxxx_add_field_to_agency_members.php` | Add column                      |
| **2** | `app/Models/Agency/AgencyMember.php`                       | Add to `$fillable`              |
| **3** | `app/Http/Resources/V1/Agency/AgencyMemberResource.php`    | Add field to `toArray()` output |

#### ➖ REMOVING A FIELD

| Step  | File                                              | What to Change                 |
| ----- | ------------------------------------------------- | ------------------------------ |
| **1** | `app/Http/Resources/V1/Agency/AgencyResource.php` | Remove from `toArray()` output |
| **2** | Update API documentation                          | Remove from response schema    |
| **3** | (Optional) Database migration                     | Drop column if cleanup needed  |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIELD FLOW DEPENDENCY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Database Tables                                                            │
│  ┌─────────────┐    ┌─────────────────┐    ┌───────────────┐                │
│  │   users     │───▶│   agencies      │───▶│ agency_members│                │
│  │             │    │   (user_id FK)  │    │ (agency_id FK)│                │
│  └─────────────┘    └─────────────────┘    └───────────────┘                │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌─────────────┐    ┌─────────────────┐    ┌───────────────┐                │
│  │ User Model  │    │  Agency Model   │    │ AgencyMember  │                │
│  │ ownedAgency │───▶│                 │    │    Model      │                │
│  │ activeMembr │───▶│                 │◀───│               │                │
│  └─────────────┘    └─────────────────┘    └───────────────┘                │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                      Controller                                  │        │
│  │  AgencyMembershipController::show()                              │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌───────────────┐   ┌─────────────────┐   ┌─────────────────────┐          │
│  │ ApiResponse   │   │ AgencyResource  │   │ AgencyMemberResource│          │
│  └───────────────┘   └─────────────────┘   └─────────────────────┘          │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                        JSON Response                             │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding Sensitive Field

- [ ] Add to `canViewAgencySensitiveFields()` conditional block
- [ ] Test with owner, member, and non-member users
- [ ] Test with admin users (should always see)
- [ ] Update API documentation

#### Adding Admin-Only Field

- [ ] Add to `canViewAdminFields()` conditional block
- [ ] Test with regular users (should not see)
- [ ] Test with Super Admin / Admin roles (should see)
- [ ] Update API documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                        |
| -------------------------------- | --------------------------------------------- |
| `ownedAgency()` relationship     | Core ownership logic, affects many endpoints  |
| `activeAgencyMembership()` scope | Filters on `status = 'active'`, vital logic   |
| `ApiResponse` structure          | Breaking change for all API consumers         |
| `BaseResource` role checks       | Affects field visibility across ALL resources |
| Owner vs Member priority check   | Business logic: owner takes precedence        |

### 🚨 Common Pitfalls

| Pitfall                                    | Prevention                                       |
| ------------------------------------------ | ------------------------------------------------ |
| Forgetting to eager load relations         | Always check ->with() before accessing relations |
| N+1 on member_count                        | Preload `active_members_count` when available    |
| Exposing sensitive fields to non-members   | Always use `canViewAgencySensitiveFields()`      |
| Breaking null checks on optional relations | Check `relationLoaded()` before accessing        |
| Returning membership when user is owner    | Owner check comes first, short-circuits          |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                  ← Route definition (line 57)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyMembershipController.php                     ← Controller (show method)
app/Http/Resources/V1/Agency/
  ├── AgencyResource.php                                 ← Agency transformer
  └── AgencyMemberResource.php                           ← Member transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                            ← User embedding
app/Http/Resources/
  └── BaseResource.php                                   ← Base resource helpers
app/Http/Utils/
  └── ApiResponse.php                                    ← Response wrapper
app/Models/Agency/
  ├── Agency.php                                         ← Agency model
  └── AgencyMember.php                                   ← Member model
app/Models/User/
  └── User.php                                           ← User model (relationships)
```

---

## Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `GET /api/v1/user/agency` |
| **Domain**          | User / Agency             |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-03                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
