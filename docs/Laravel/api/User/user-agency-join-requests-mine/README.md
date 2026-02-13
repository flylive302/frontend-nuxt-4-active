# GET /api/v1/user/agency/join-requests/mine

> **Domain**: User Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

This endpoint retrieves all agency join requests sent by the authenticated user. It allows users to view the status of their pending, approved, rejected, or cancelled join requests to various agencies.

### Responsibilities

- Authenticate and identify the requesting user
- Retrieve all join requests made by the user
- Eager load agency details for each request
- Paginate results for efficient data transfer
- Transform join requests into API resources

### What It Owns

| Owned                | Description                                            |
| -------------------- | ------------------------------------------------------ |
| User's join requests | Retrieves all join requests for the authenticated user |
| Pagination           | Controls per_page parameter for result pagination      |

### External Dependencies

| Dependency         | Type           | Purpose                                  |
| ------------------ | -------------- | ---------------------------------------- |
| Database (MySQL)   | Infrastructure | Stores agency_join_requests and agencies |
| Sanctum            | Package        | Authentication via Bearer token          |
| Eloquent Relations | Framework      | Loads agency relationship                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/agency/join-requests/mine
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter     | Key       | Config                |
| ----------- | --------- | --------------------- |
| Default API | `user:id` | `config/throttle.php` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type      | Default | Constraints     | Description                |
| ---------- | --------- | ------- | --------------- | -------------------------- |
| `per_page` | `integer` | `20`    | Optional, 1-100 | Number of results per page |
| `page`     | `integer` | `1`     | Optional        | Page number                |

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
      "created_at": "2026-02-03T12:30:00.000000Z",
      "can_be_processed": true,
      "can_be_cancelled": true,
      "agency": {
        "id": 456,
        "name": "FlyLive Agency",
        "country": "US",
        "logo": "https://example.com/logo.png"
      }
    }
  ],
  "links": {
    "first": "https://api.example.com/api/v1/user/agency/join-requests/mine?page=1",
    "last": "https://api.example.com/api/v1/user/agency/join-requests/mine?page=5",
    "prev": null,
    "next": "https://api.example.com/api/v1/user/agency/join-requests/mine?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "per_page": 20,
    "to": 20,
    "total": 100,
    "path": "https://api.example.com/api/v1/user/agency/join-requests/mine",
    "timestamp": "2026-02-03T12:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### Response Field Details

| Field              | Type      | Description                                          |
| ------------------ | --------- | ---------------------------------------------------- | ----------------------------------- |
| `id`               | `integer` | Unique join request ID                               |
| `status`           | `string`  | Status value: pending, approved, rejected, cancelled |
| `status_label`     | `string`  | Human-readable status label                          |
| `message`          | `string   | null`                                                | Optional message from the requester |
| `created_at`       | `string`  | ISO 8601 timestamp of request creation               |
| `can_be_processed` | `boolean` | Whether request can be approved/rejected             |
| `can_be_cancelled` | `boolean` | Whether request can be cancelled by requester        |
| `agency.id`        | `integer` | Agency ID                                            |
| `agency.name`      | `string`  | Agency name                                          |
| `agency.country`   | `string`  | Agency country code                                  |
| `agency.logo`      | `string   | null`                                                | Agency logo URL                     |

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully retrieved join requests    |
| `401` | Missing or invalid authentication token |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/agency/join-requests/mine               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:94                                            │
│ Route: Route::get('/mine', [AgencyJoinRequestController::class, 'mine'])    │
│        ->name('user.agency.join-requests.mine')                             │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, loads authenticated user       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ No FormRequest - Uses base Illuminate\Http\Request                          │
│                                                                             │
│ Authentication is handled by auth:sanctum middleware.                       │
│ No additional validation required for this read-only endpoint.              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyJoinRequestController.php    │
│ Method: mine(Request $request)                                              │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return AgencyJoinRequestResource::collection([]);                   │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Fetch user's join requests with eager loading                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $joinRequests = $user                                                   │ │
│ │     ->agencyJoinRequests()                                              │ │
│ │     ->with(['agency:id,name,country,logo'])                             │ │
│ │     ->latest()                                                          │ │
│ │     ->paginate($request->input('per_page', 20));                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return paginated resource collection                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyJoinRequestResource::collection($joinRequests);            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No dedicated service layer for this endpoint.                               │
│ Logic is handled directly in the controller due to simplicity.              │
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
│ │ Responsibility: Represents user's join request to an agency             │ │
│ │ Reusable: YES (used across all join request endpoints)                  │ │
│ │ Why It Exists: Eloquent model for agency_join_requests table            │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • agency() → BelongsTo relationship to Agency                         │ │
│ │   • user() → BelongsTo relationship to User                             │ │
│ │   • isPending() → Check if status is pending                            │ │
│ │   • canBeProcessed() → Check if request can be approved/rejected        │ │
│ │   • canBeCancelled() → Check if request can be cancelled                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestResource (API Resource)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php        │ │
│ │ Responsibility: Transforms join request model to JSON response          │ │
│ │ Reusable: YES (used by all join request endpoints)                      │ │
│ │ Why It Exists: Consistent API response formatting                       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray() → Transforms model to array                               │ │
│ │     - Includes agency info when 'agency' relation is loaded             │ │
│ │     - Includes user info when 'user' relation is loaded                 │ │
│ │     - Includes processor info for processed requests                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyJoinRequestStatus (Enum)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Agency/AgencyJoinRequestStatus.php                      │ │
│ │ Responsibility: Defines valid join request statuses                     │ │
│ │ Reusable: YES (used across all agency join request logic)               │ │
│ │ Why It Exists: Type-safe status values with helper methods              │ │
│ │                                                                         │ │
│ │ Cases:                                                                  │ │
│ │   • PENDING = 'pending'                                                 │ │
│ │   • APPROVED = 'approved'                                               │ │
│ │   • REJECTED = 'rejected'                                               │ │
│ │   • CANCELLED = 'cancelled'                                             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → Human-readable status label                               │ │
│ │   • canBeProcessed() → Check if request can be processed                │ │
│ │   • isFinal() → Check if status is terminal                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User (Model - Relationship)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php:351                                      │ │
│ │ Responsibility: Provides agencyJoinRequests() relationship              │ │
│ │ Reusable: YES (User model is application-wide)                          │ │
│ │                                                                         │ │
│ │ Relationship:                                                           │ │
│ │   • agencyJoinRequests() → HasMany<AgencyJoinRequest>                   │ │
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
│ 1. SELECT (Paginated): User's join requests                                 │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ SELECT * FROM `agency_join_requests`                                  ││
│    │ WHERE `user_id` = ?                                                   ││
│    │ ORDER BY `created_at` DESC                                            ││
│    │ LIMIT 20 OFFSET 0                                                     ││
│    └───────────────────────────────────────────────────────────────────────┘│
│    Source: User::agencyJoinRequests()->latest()->paginate()                 │
│                                                                             │
│ 2. SELECT (Eager Load): Agencies for loaded requests                        │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ SELECT `id`, `name`, `country`, `logo`                                ││
│    │ FROM `agencies`                                                       ││
│    │ WHERE `id` IN (?, ?, ...)                                             ││
│    └───────────────────────────────────────────────────────────────────────┘│
│    Source: with(['agency:id,name,country,logo'])                            │
│                                                                             │
│ 3. COUNT: Total records for pagination meta                                 │
│    ┌───────────────────────────────────────────────────────────────────────┐│
│    │ SELECT COUNT(*) FROM `agency_join_requests`                           ││
│    │ WHERE `user_id` = ?                                                   ││
│    └───────────────────────────────────────────────────────────────────────┘│
│    Source: paginate() internally                                            │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ AgencyJoinRequestResource::collection() transforms paginated results:       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ For each AgencyJoinRequest:                                             │ │
│ │                                                                         │ │
│ │ $data = [                                                               │ │
│ │     'id' => $joinRequest->id,                                           │ │
│ │     'status' => $joinRequest->status->value,                            │ │
│ │     'status_label' => $joinRequest->status->label(),                    │ │
│ │     'message' => $joinRequest->message,                                 │ │
│ │     'created_at' => $joinRequest->created_at->toISOString(),            │ │
│ │     'can_be_processed' => $joinRequest->canBeProcessed(),               │ │
│ │     'can_be_cancelled' => $joinRequest->canBeCancelled(),               │ │
│ │ ];                                                                      │ │
│ │                                                                         │ │
│ │ // Agency is always loaded for 'mine' endpoint                          │ │
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
│ BaseResource adds metadata via with():                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'meta' => [                                                             │ │
│ │     'timestamp' => now()->toISOString(),                                │ │
│ │     'correlation_id' => $request->header('X-Correlation-ID', uuid()),   │ │
│ │ ]                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                                     | Used By Endpoints                     | Reusable | Reasoning                                 |
| ---------------------------------------- | ------------------------------------- | -------- | ----------------------------------------- |
| `AgencyJoinRequestController.php`        | mine, index, approve, reject          | ⭕       | Controller methods are endpoint-specific  |
| `AgencyJoinRequestResource.php`          | All join request endpoints            | ✅       | Shared resource for consistent formatting |
| `AgencyJoinRequest.php` (Model)          | All join request endpoints            | ✅       | Core model for join request data          |
| `AgencyJoinRequestStatus.php` (Enum)     | All join request logic                | ✅       | Status values and helper methods          |
| `User.php` (agencyJoinRequests relation) | All user-related join request queries | ✅       | Standard Eloquent relationship            |
| `BaseResource.php`                       | All API resources                     | ✅       | Common metadata and helper methods        |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                       |
| ----- | ------ | ----------------------------------------------- |
| N/A   | N/A    | No validation rules for this read-only endpoint |

### Business Logic Errors (400)

| Error | Source | Condition                                            |
| ----- | ------ | ---------------------------------------------------- |
| N/A   | N/A    | No business logic errors for this read-only endpoint |

### System Errors (500)

| Error                       | Source              | Condition                      |
| --------------------------- | ------------------- | ------------------------------ |
| Database connection failure | Database connection | Unable to connect to database  |
| Query timeout               | Eloquent paginate() | Database query exceeds timeout |

### Edge Cases

| Case                              | Behavior                                   |
| --------------------------------- | ------------------------------------------ |
| User has no join requests         | Returns empty `data` array with pagination |
| User is null (middleware failure) | Returns empty resource collection          |
| Agency was deleted                | Join request still shown, agency null      |
| Very large per_page value         | Laravel caps to max allowed by paginator   |
| Negative page number              | Laravel treats as page 1                   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                 MODEL                   DATABASE
   │                       │                       │                       │                          │
   │  GET /join-requests/mine                      │                       │                          │
   │──────────────────────▶│                       │                       │                          │
   │                       │                       │                       │                          │
   │                       │ 1. auth:sanctum       │                       │                          │
   │                       │   Validate token      │                       │                          │
   │                       │   Load user           │                       │                          │
   │                       │──────────────────────▶│                       │                          │
   │                       │                       │                       │                          │
   │                       │                       │ 2. Get user           │                          │
   │                       │                       │   $request->user()    │                          │
   │                       │                       │                       │                          │
   │                       │                       │ 3. Build query        │                          │
   │                       │                       │──────────────────────▶│                          │
   │                       │                       │                       │                          │
   │                       │                       │                       │ 4. Execute query         │
   │                       │                       │                       │   agencyJoinRequests()   │
   │                       │                       │                       │   ->with(agency)         │
   │                       │                       │                       │   ->latest()             │
   │                       │                       │                       │   ->paginate()           │
   │                       │                       │                       │─────────────────────────▶│
   │                       │                       │                       │◀─────────────────────────│
   │                       │                       │                       │                          │
   │                       │                       │ 5. Eager load         │                          │
   │                       │                       │   agencies            │                          │
   │                       │                       │                       │─────────────────────────▶│
   │                       │                       │                       │◀─────────────────────────│
   │                       │                       │                       │                          │
   │                       │                       │◀──────────────────────│                          │
   │                       │                       │                       │                          │
   │                       │                       │ 6. Transform to       │                          │
   │                       │                       │   ResourceCollection  │                          │
   │                       │                       │                       │                          │
   │                       │◀──────────────────────│                       │                          │
   │◀──────────────────────│                       │                       │                          │
   │                       │                       │                       │                          │
   │  200 OK + JSON        │                       │                       │                          │
   │                       │                       │                       │                          │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition               | Location(s)                                               |
| ---------------------- | --------------------------------------------------------- |
| New response field     | `AgencyJoinRequestResource::toArray()`                    |
| New query filter       | `AgencyJoinRequestController::mine()` before `paginate()` |
| Status-based filtering | Add query parameter handling in controller                |
| Caching                | Add cache layer in controller before query                |
| Search by agency name  | Add `whereHas()` to filter agencies                       |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                         | What to Change                       |
| ----- | ------------------------------------------------------------ | ------------------------------------ |
| **1** | **Database Migration** (if new column)                       | Add column to `agency_join_requests` |
| **2** | `app/Models/Agency/AgencyJoinRequest.php`                    | Add to `$fillable` (if writable)     |
| **3** | `app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php` | Add field to `toArray()` method      |

**Example: Adding `expires_at` field**

```php
// In AgencyJoinRequestResource::toArray()
$data = [
    // ... existing fields
    'expires_at' => $joinRequest->expires_at?->toISOString(),
];
```

#### ➕ ADDING A QUERY FILTER (e.g., status filter)

| Step  | File                                                                 | What to Change              |
| ----- | -------------------------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Agency/AgencyJoinRequestController.php` | Add filter to query builder |

**Example: Adding status filter**

```php
// In mine() method
$query = $user->agencyJoinRequests()
    ->with(['agency:id,name,country,logo']);

if ($request->has('status')) {
    $query->where('status', $request->input('status'));
}

$joinRequests = $query->latest()->paginate($request->input('per_page', 20));
```

#### ➖ REMOVING A FIELD

| Step  | File                                                         | What to Change                 |
| ----- | ------------------------------------------------------------ | ------------------------------ |
| **1** | `app/Http/Resources/V1/Agency/AgencyJoinRequestResource.php` | Remove from `toArray()` method |
| **2** | **Database Migration** (if removing column)                  | Drop column (if safe)          |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIELD FLOW FOR 'mine' ENDPOINT                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Database                     Model                      Resource           │
│  ┌────────────────┐     ┌────────────────────┐    ┌──────────────────────┐  │
│  │ agency_join_   │     │ AgencyJoinRequest  │    │ AgencyJoinRequest    │  │
│  │ requests       │────▶│ attributes         │───▶│ Resource::toArray()  │  │
│  │                │     │                    │    │                      │  │
│  │ id             │     │ id                 │    │ id                   │  │
│  │ status         │     │ status (enum cast) │    │ status, status_label │  │
│  │ message        │     │ message            │    │ message              │  │
│  │ created_at     │     │ created_at         │    │ created_at           │  │
│  └────────────────┘     └────────────────────┘    └──────────────────────┘  │
│         │                        │                         │                │
│         ▼                        ▼                         ▼                │
│  ┌────────────────┐     ┌────────────────────┐    ┌──────────────────────┐  │
│  │ agencies       │     │ Agency             │    │ agency object in     │  │
│  │ (eager load)   │────▶│ (via relation)     │───▶│ response             │  │
│  │                │     │                    │    │                      │  │
│  │ id, name       │     │ id, name           │    │ id, name             │  │
│  │ country, logo  │     │ country, logo      │    │ country, logo        │  │
│  └────────────────┘     └────────────────────┘    └──────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding a Query Parameter

- [ ] Add parameter handling in controller `mine()` method
- [ ] Document new parameter in API contract
- [ ] Add validation if needed (type, range, etc.)
- [ ] Update tests to cover new parameter

#### Adding a New Response Field

- [ ] If database field: create migration
- [ ] Update model `$fillable` if writable
- [ ] Add to resource `toArray()` method
- [ ] Update API contract documentation
- [ ] Update tests to verify new field

### ⚠️ What Should NOT Be Modified Casually

| Component                       | Reason                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `auth:sanctum` middleware       | Breaking would disable authentication for all API routes |
| `AgencyJoinRequestResource`     | Shared across all join request endpoints                 |
| `AgencyJoinRequest` model       | Core model used by multiple features                     |
| Database schema                 | Requires migration and may affect other endpoints        |
| `agencyJoinRequests()` relation | Used by multiple controllers and services                |

### 🚨 Common Pitfalls

| Pitfall                                      | Prevention                                                    |
| -------------------------------------------- | ------------------------------------------------------------- |
| N+1 query on agencies                        | Always use `with(['agency:id,name,country,logo'])` eager load |
| Loading unnecessary agency columns           | Use column selection in eager load                            |
| Modifying shared resource for one endpoint   | Add conditional fields using `relationLoaded()` checks        |
| Breaking pagination by removing `paginate()` | Keep pagination for scalability                               |
| Not handling null user                       | Always check `$request->user()` before querying               |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:94                                ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyJoinRequestController.php                     ← Controller (mine method)
app/Models/Agency/
  └── AgencyJoinRequest.php                               ← Model
app/Enums/Agency/
  └── AgencyJoinRequestStatus.php                         ← Status enum
app/Http/Resources/V1/Agency/
  └── AgencyJoinRequestResource.php                       ← API resource
app/Http/Resources/
  └── BaseResource.php                                    ← Base resource class
app/Models/User/
  └── User.php                                            ← User model (relationship)
database/migrations/
  └── 2025_12_27_000004_create_agency_join_requests_table.php  ← Migration
```

---

## Document Metadata

| Property            | Value                                        |
| ------------------- | -------------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/agency/join-requests/mine` |
| **Domain**          | User Agency                                  |
| **Author**          | System Documentation                         |
| **Created**         | 2026-02-03                                   |
| **Laravel Version** | 12.x                                         |
| **PHP Version**     | 8.4+                                         |
