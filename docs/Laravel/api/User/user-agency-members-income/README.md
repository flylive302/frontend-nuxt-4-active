# GET /api/v1/user/agency/members/income

> **Domain**: User → Agency Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

Retrieves income statistics for all members of an agency that the authenticated user manages (as owner or admin), with cursor pagination support for scalability.

### Responsibilities

- Verify user manages an agency (owned or admin role)
- Paginate agency members using cursor-based pagination
- Bulk fetch active income targets for member progress
- Aggregate historical income statistics (completed targets)
- Return combined income data with pagination metadata

### What It Owns

| Owned                | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| Members Income Query | Aggregates income data from `agency_income_targets` table   |
| Pagination Strategy  | Uses cursor pagination for efficient large dataset handling |

### External Dependencies

| Dependency     | Type           | Purpose                                      |
| -------------- | -------------- | -------------------------------------------- |
| MySQL Database | Infrastructure | Stores members, targets, and historical data |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/agency/members/income
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter | Key       | Config                 |
| ------- | --------- | ---------------------- |
| Default | IP + User | 60 requests per minute |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Query Parameters

| Parameter  | Type     | Default | Constraints      | Description                    |
| ---------- | -------- | ------- | ---------------- | ------------------------------ |
| `per_page` | `int`    | `20`    | Min: 1, Max: 100 | Number of members per page     |
| `cursor`   | `string` | `null`  | Optional         | Cursor for pagination position |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Members income retrieved",
  "data": {
    "agency_id": "int", // Agency ID
    "agency_name": "string", // Agency display name
    "members": [
      {
        "user_id": "int", // Member's user ID
        "name": "string", // Member's display name
        "avatar_url": "string|null", // Avatar URL
        "joined_at": "string", // ISO8601 timestamp
        "current_target": {
          // null if no active target
          "tier": "string", // e.g., "t1", "t2", "t3"
          "required_coins": "float", // Target goal
          "earned_coins": "float", // Progress so far
          "progress_percentage": "float", // 0-100 percentage
          "coins_to_complete": "float", // Remaining coins needed
          "days_remaining": "int", // Days until target expires
          "diamond_reward": "int" // Diamond reward on completion
        },
        "total_diamonds_earned": "int", // Lifetime diamonds from targets
        "total_coins_contributed": "float", // Lifetime coins earned
        "completed_targets_count": "int" // Number of completed targets
      }
    ]
  },
  "meta": {
    "pagination": {
      "per_page": "int",
      "next_cursor": "string|null",
      "prev_cursor": "string|null",
      "has_more": "boolean"
    },
    "timestamp": "2026-02-03T17:58:25.000000Z",
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
    "timestamp": "2026-02-03T17:58:25.000000Z",
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
    "timestamp": "2026-02-03T17:58:25.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                    |
| ----- | -------------------------------------------- |
| `200` | Members income data retrieved successfully   |
| `401` | User not authenticated                       |
| `403` | User doesn't manage any agency (owner/admin) |
| `500` | Database or server error                     |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                GET /api/v1/user/agency/members/income                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:115-116                                       │
│ Route: Route::get('/income', [AgencyMemberController::class, 'income'])     │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates bearer token, attaches user to request        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: Sanctum Authentication Middleware                                     │
│                                                                             │
│ Validates the bearer token and attaches the User model to the request.      │
│ No custom Form Request - uses base Illuminate\Http\Request                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyMemberController.php:63-151  │
│ Method: income(Request $request, AgencyIncomeService $incomeService)        │
│                                                                             │
│ STEP 1: Verify user authentication                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::error('Unauthenticated.', [], 401);             │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get user's managed agency using ManagesUserAgency trait            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $agency = $this->getUserManagedAgency($user);                           │ │
│ │ if ($agency === null) {                                                 │ │
│ │     return ApiResponse::error('You do not manage any agency.', [], 403);│ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Parse pagination parameters                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $perPage = min((int) $request->input('per_page', 20), 100);             │ │
│ │ $cursor = $request->input('cursor');                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Get paginated members via service                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membersPaginated = $incomeService->getMembersIncomeForAgencyPaginated( │ │
│ │     $agency->id,                                                        │ │
│ │     $perPage,                                                           │ │
│ │     $cursor                                                             │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Bulk fetch active targets for user IDs                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userIds = $membersPaginated->pluck('user_id')->toArray();              │ │
│ │ $activeTargets = AgencyIncomeTarget::whereIn('user_id', $userIds)       │ │
│ │     ->active()                                                          │ │
│ │     ->get()                                                             │ │
│ │     ->keyBy('user_id');                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Bulk fetch historical stats with aggregation                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $historicalStats = AgencyIncomeTarget::whereIn('user_id', $userIds)     │ │
│ │     ->completed()                                                       │ │
│ │     ->select(                                                           │ │
│ │         'user_id',                                                      │ │
│ │         DB::raw('SUM(earned_coins) as total_coins'),                    │ │
│ │         DB::raw('SUM(CASE WHEN member_reward_claimed = true             │ │
│ │                   THEN member_diamond_reward ELSE 0 END)                │ │
│ │                   as total_diamonds'),                                  │ │
│ │         DB::raw('COUNT(*) as completed_count')                          │ │
│ │     )                                                                   │ │
│ │     ->groupBy('user_id')                                                │ │
│ │     ->get()                                                             │ │
│ │     ->keyBy('user_id');                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7: Build member data array with income details                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $membersData = collect($membersPaginated->items())->map(function ($m) { │ │
│ │     return [                                                            │ │
│ │         'user_id' => $m->user_id,                                       │ │
│ │         'name' => $m->user->name ?? 'Unknown',                          │ │
│ │         'avatar_url' => $m->user->avatar,                               │ │
│ │         'joined_at' => $m->created_at->toIso8601String(),               │ │
│ │         'current_target' => $activeTarget ? [...] : null,               │ │
│ │         'total_diamonds_earned' => (int) ($stats->total_diamonds ?? 0), │ │
│ │         'total_coins_contributed' => (float) ($stats->total_coins ?? 0),│ │
│ │         'completed_targets_count' => (int) ($stats->completed_count??0),│ │
│ │     ];                                                                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ SERVICE: AgencyIncomeService                                                │
│ File: app/Services/Agency/AgencyIncomeService.php:562-578                   │
│                                                                             │
│ Method: getMembersIncomeForAgencyPaginated($agencyId, $perPage, $cursor)    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = AgencyMember::where('agency_id', $agencyId)                    │ │
│ │     ->where('status', 'active')                                         │ │
│ │     ->with(['user:id,name,avatar'])                                     │ │
│ │     ->orderBy('id');                                                    │ │
│ │                                                                         │ │
│ │ return $query->cursorPaginate($perPage, ['*'], 'cursor', $cursor);      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Returns: CursorPaginator<AgencyMember> with eager-loaded user data          │
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
│ │ Responsibility: Determine if user manages an agency                     │ │
│ │ Reusable: YES (used by multiple agency controllers)                     │ │
│ │ Why It Exists: Centralizes agency management permission check           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getUserManagedAgency($user) → Returns Agency or null                │ │
│ │     - Checks ownedAgency relationship first                             │ │
│ │     - Falls back to admin membership                                    │ │
│ │     - Validates agency is operational                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyIncomeTarget (Model)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyIncomeTarget.php                          │ │
│ │ Responsibility: Represents member income targets                        │ │
│ │ Reusable: YES (core income tracking model)                              │ │
│ │                                                                         │ │
│ │ Key Scopes Used:                                                        │ │
│ │   • scopeActive() → Filters status = 'active'                           │ │
│ │   • scopeCompleted() → Filters status = 'completed'                     │ │
│ │                                                                         │ │
│ │ Key Attributes:                                                         │ │
│ │   • progress_percentage (computed)                                      │ │
│ │   • days_remaining (computed)                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyMember (Model)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Agency/AgencyMember.php                                │ │
│ │ Responsibility: Represents agency membership                            │ │
│ │ Reusable: YES (used across agency features)                             │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • user() → BelongsTo User                                             │ │
│ │   • agency() → BelongsTo Agency                                         │ │
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
│ 1. SELECT: Get user's owned agency                                          │
│    Query: SELECT * FROM agencies WHERE owner_id = ? AND status = 'approved' │
│    Source: ManagesUserAgency::getUserManagedAgency()                        │
│                                                                             │
│ 2. SELECT: Get admin membership (if no owned agency)                        │
│    Query: SELECT * FROM agency_members WHERE user_id = ?                    │
│           AND role IN ('owner', 'admin') AND status = 'active'              │
│    Source: ManagesUserAgency::getUserManagedAgency()                        │
│                                                                             │
│ 3. SELECT: Get paginated agency members                                     │
│    Query: SELECT * FROM agency_members WHERE agency_id = ?                  │
│           AND status = 'active' ORDER BY id LIMIT ?                         │
│    Source: AgencyIncomeService::getMembersIncomeForAgencyPaginated()        │
│                                                                             │
│ 4. SELECT: Bulk fetch active income targets                                 │
│    Query: SELECT * FROM agency_income_targets                               │
│           WHERE user_id IN (?) AND status = 'active'                        │
│    Source: Controller inline query                                          │
│                                                                             │
│ 5. SELECT: Aggregate historical stats                                       │
│    Query: SELECT user_id, SUM(earned_coins), COUNT(*)                       │
│           FROM agency_income_targets                                        │
│           WHERE user_id IN (?) AND status = 'completed'                     │
│           GROUP BY user_id                                                  │
│    Source: Controller inline query                                          │
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
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│                                                                             │
│ Uses ApiResponse::success() with custom meta for pagination:                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'agency_id' => $agency->id,                                         │ │
│ │     'agency_name' => $agency->name,                                     │ │
│ │     'members' => $membersData->toArray(),                               │ │
│ │ ], 'Members income retrieved', [                                        │ │
│ │     'pagination' => [                                                   │ │
│ │         'per_page' => $membersPaginated->perPage(),                     │ │
│ │         'next_cursor' => $membersPaginated->nextCursor()?->encode(),    │ │
│ │         'prev_cursor' => $membersPaginated->previousCursor()?->encode(),│ │
│ │         'has_more' => $membersPaginated->hasMorePages(),                │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                          200 + JSON Body                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                             | Used By Endpoints                        | Reusable | Reasoning                                      |
| -------------------------------- | ---------------------------------------- | -------- | ---------------------------------------------- |
| `AgencyMemberController.php`     | members/income, members/{member}/kick    | ⭕       | Methods are specific, but controller is shared |
| `ManagesUserAgency.php` (Trait)  | Multiple agency management endpoints     | ✅       | Generic agency ownership/admin check           |
| `AgencyIncomeService.php`        | Income targets, member stats, processing | ✅       | Core service for all income-related operations |
| `AgencyIncomeTarget.php` (Model) | All income target features               | ✅       | Central model for target tracking              |
| `AgencyMember.php` (Model)       | All agency member features               | ✅       | Core membership model                          |
| `ApiResponse.php`                | All API endpoints                        | ✅       | Standard response utility                      |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error              | Source     | Condition                     |
| ------------------ | ---------- | ----------------------------- |
| "Unauthenticated." | Controller | User is null after auth check |

### Authorization Errors (403)

| Error                           | Source     | Condition                                    |
| ------------------------------- | ---------- | -------------------------------------------- |
| "You do not manage any agency." | Controller | User has no owned agency or admin membership |

### System Errors (500)

| Error               | Source  | Condition                          |
| ------------------- | ------- | ---------------------------------- |
| Database connection | Service | DB connection failure              |
| Query timeout       | Service | Large dataset query takes too long |

### Edge Cases

| Case                            | Behavior                                           |
| ------------------------------- | -------------------------------------------------- |
| No members in agency            | Returns empty `members` array                      |
| Member has no active target     | `current_target` is `null`                         |
| Member has no completed targets | Stats default to 0                                 |
| Invalid cursor format           | Laravel handles gracefully, returns first page     |
| per_page exceeds 100            | Capped to 100                                      |
| per_page is 0 or negative       | Laravel uses default (1)                           |
| Member's user deleted           | `name` defaults to "Unknown", `avatar_url` is null |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                 TRAIT                     SERVICE                  DATABASE
   │                       │                       │                        │                          │                        │
   │  GET /income          │                       │                        │                          │                        │
   │──────────────────────▶│                       │                        │                          │                        │
   │                       │                       │                        │                          │                        │
   │                       │ 1. auth:sanctum       │                        │                          │                        │
   │                       │   validates token     │                        │                          │                        │
   │                       │──────────────────────▶│                        │                          │                        │
   │                       │                       │                        │                          │                        │
   │                       │                       │ 2. get user            │                          │                        │
   │                       │                       │   $request->user()     │                          │                        │
   │                       │                       │                        │                          │                        │
   │                       │                       │ 3. getUserManagedAgency│                          │                        │
   │                       │                       │───────────────────────▶│                          │                        │
   │                       │                       │                        │                          │                        │
   │                       │                       │                        │ 4. check owned agency    │                        │
   │                       │                       │                        │─────────────────────────────────────────────────▶│
   │                       │                       │                        │◀─────────────────────────────────────────────────│
   │                       │                       │                        │                          │                        │
   │                       │                       │                        │ 5. check admin membership│                        │
   │                       │                       │                        │─────────────────────────────────────────────────▶│
   │                       │                       │                        │◀─────────────────────────────────────────────────│
   │                       │                       │                        │                          │                        │
   │                       │                       │◀───────────────────────│ return agency            │                        │
   │                       │                       │                        │                          │                        │
   │                       │                       │ 6. getMembersIncome... │                          │                        │
   │                       │                       │─────────────────────────────────────────────────▶│                        │
   │                       │                       │                        │                          │                        │
   │                       │                       │                        │                          │ 7. SELECT members      │
   │                       │                       │                        │                          │───────────────────────▶│
   │                       │                       │                        │                          │◀───────────────────────│
   │                       │                       │                        │                          │                        │
   │                       │                       │◀─────────────────────────────────────────────────│ paginator              │
   │                       │                       │                        │                          │                        │
   │                       │                       │ 8. active targets                                 │                        │
   │                       │                       │──────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────────────────────────────────│
   │                       │                       │                        │                          │                        │
   │                       │                       │ 9. historical stats                               │                        │
   │                       │                       │──────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │◀──────────────────────────────────────────────────────────────────────────│
   │                       │                       │                        │                          │                        │
   │                       │                       │ 10. build response     │                          │                        │
   │                       │◀──────────────────────│                        │                          │                        │
   │◀──────────────────────│                       │                        │                          │                        │
   │                       │                       │                        │                          │                        │
   │  200 + JSON           │                       │                        │                          │                        │
   │                       │                       │                        │                          │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                      |
| ------------------------- | --------------------------------------------- |
| New member field          | Controller map function + adjust response     |
| New target stat           | Add to aggregation query in controller        |
| Filtering/sorting options | Add query params + extend service method      |
| Caching                   | Service layer before database queries         |
| Rate limiting             | Route middleware in `routes/api/agencies.php` |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW MEMBER FIELD

| Step  | File                               | What to Change                     |
| ----- | ---------------------------------- | ---------------------------------- |
| **1** | `AgencyMemberController.php`       | Add to `$membersData` map function |
| **2** | Database Migration (if new column) | Add column to relevant table       |
| **3** | Model (if relationship/accessor)   | Add accessor/relationship          |
| **4** | API Documentation                  | Update response schema             |

#### ➕ ADDING A NEW TARGET STAT

| Step  | File                         | What to Change                              |
| ----- | ---------------------------- | ------------------------------------------- |
| **1** | `AgencyMemberController.php` | Add to `$historicalStats` aggregation query |
| **2** | `AgencyMemberController.php` | Add to `$membersData` map return array      |
| **3** | API Documentation            | Update response schema                      |

#### ➖ REMOVING A FIELD

| Step  | File                         | What to Change           |
| ----- | ---------------------------- | ------------------------ |
| **1** | `AgencyMemberController.php` | Remove from map function |
| **2** | API Documentation            | Update response schema   |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MEMBER FIELD FLOW                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ AgencyMember (DB)                                                           │
│       │                                                                     │
│       ▼                                                                     │
│ service.getMembersIncomeForAgencyPaginated()                                │
│       │                                                                     │
│       ▼                                                                     │
│ Controller map function                                                     │
│       │                                                                     │
│       ▼                                                                     │
│ Response data array                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TARGET STATS FLOW                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ AgencyIncomeTarget (DB)                                                     │
│       │                                                                     │
│       ▼                                                                     │
│ Controller bulk queries (activeTargets, historicalStats)                    │
│       │                                                                     │
│       ▼                                                                     │
│ Controller map function merges data                                         │
│       │                                                                     │
│       ▼                                                                     │
│ Response data array                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

**Adding a computed field:**

- [ ] Add calculation in controller map function
- [ ] Document in API response schema
- [ ] Add tests for edge cases

**Adding a database field:**

- [ ] Create migration
- [ ] Add to model `$fillable` if needed
- [ ] Add to eager loading (`with()`) if relationship
- [ ] Add to controller map function
- [ ] Document in API response schema

### ⚠️ What Should NOT Be Modified Casually

| Component                          | Reason                                         |
| ---------------------------------- | ---------------------------------------------- |
| `ManagesUserAgency` trait          | Shared by many controllers, changes affect all |
| `AgencyIncomeTarget` scopes        | Used for income calculations across the system |
| Cursor pagination logic            | Breaking change for clients using cursors      |
| `ApiResponse::success()` structure | Standard response format used everywhere       |
| User ID array extraction           | Must match the paginated results exactly       |

### 🚨 Common Pitfalls

| Pitfall                                   | Prevention                                            |
| ----------------------------------------- | ----------------------------------------------------- |
| N+1 queries in map function               | Data is bulk-fetched before mapping; maintain pattern |
| Missing null checks on user relationships | Always use null coalescing (`??`)                     |
| Cursor ordering inconsistency             | Always order by `id` for cursor pagination            |
| Forgetting to update aggregation query    | Test new stats thoroughly                             |
| per_page bypass allows >100               | `min()` enforces 100 max                              |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php:115-116                     ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyMemberController.php                    ← Controller
app/Concerns/
  └── ManagesUserAgency.php                         ← Trait for agency access
app/Services/Agency/
  └── AgencyIncomeService.php                       ← Business logic
app/Models/Agency/
  ├── AgencyMember.php                              ← Member model
  └── AgencyIncomeTarget.php                        ← Target model
app/Http/Utils/
  └── ApiResponse.php                               ← Response utility
```

---

## Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/agency/members/income` |
| **Domain**          | User → Agency Management                 |
| **Author**          | System Documentation                     |
| **Created**         | 2026-02-03                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4                                      |
