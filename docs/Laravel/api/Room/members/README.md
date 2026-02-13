# GET /api/v1/rooms/{room}/members

> **Domain**: Room  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

The Room Members endpoint retrieves all active members of a specific room, returning their user details, roles, and membership status. This endpoint is publicly accessible (no authentication required).

### Responsibilities

- Retrieve all active members for a given room
- Include nested user details for each member
- Order members by role hierarchy (owner → admin → member)

### What It Owns

| Owned            | Description                                    |
| ---------------- | ---------------------------------------------- |
| Member Listing   | Returns room membership data with user details |
| Role-based Order | Members sorted by `role_order` column          |

### External Dependencies

| Dependency | Type           | Purpose                              |
| ---------- | -------------- | ------------------------------------ |
| PostgreSQL | Database       | Stores room_members and users tables |
| Redis      | Infrastructure | Membership caching (used elsewhere)  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/rooms/{room}/members
```

### Authentication

❌ **None Required** - This is a public endpoint

### Rate Limiting

| Limiter | Key        | Config                        |
| ------- | ---------- | ----------------------------- |
| Global  | IP address | Default Laravel rate limiting |

### Request Headers

| Header         | Required | Type               | Description     |
| -------------- | -------- | ------------------ | --------------- |
| `Accept`       | ✅       | `application/json` | Response format |
| `Content-Type` | ❌       | N/A                | No request body |

### Path Parameters

| Parameter | Type      | Constraints      | Example |
| --------- | --------- | ---------------- | ------- |
| `room`    | `integer` | Required, exists | `123`   |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Success",
  "data": [
    {
      "id": "integer", // RoomMember ID
      "user": {
        // MinimalUserResource (12 fields)
        "id": "integer",
        "name": "string",
        "signature": "string",
        "avatar": "string|null",
        "frame": "string|null", // Conditional
        "gender": "string",
        "email": "string",
        "phone": "string|null",
        "country": "string|null",
        "date_of_birth": "string|null", // Date format: YYYY-MM-DD
        "wealth_xp": "string", // Numeric string
        "charm_xp": "string" // Numeric string
      },
      "role": "string", // "owner" | "admin" | "member"
      "role_label": "string", // "Owner" | "Admin" | "Member"
      "status": "string", // Always "active" for this endpoint
      "joined_at": "string|null" // ISO8601 format
    }
  ],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found (404)

```json
{
  "status": "error",
  "message": "No query results for model [App\\Models\\Room\\Room] {id}",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                            |
| ----- | ------------------------------------ |
| `200` | Members retrieved successfully       |
| `404` | Room not found (route model binding) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/rooms/{room}/members                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:22                                     │
│ Route: Route::get('/{room}/members', [RoomMemberController::class, 'index'])│
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. api  → Default API middleware group                                    │
│                                                                             │
│ Route Model Binding:                                                        │
│   • {room} → Room::findOrFail($id)                                          │
│   • Throws ModelNotFoundException if room not found                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomMemberController.php             │
│                                                                             │
│ No dedicated Form Request - uses route model binding only                   │
│ Room model is automatically resolved by Laravel                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomMemberController.php:32-37       │
│ Method: index(Room $room): JsonResponse                                     │
│                                                                             │
│ STEP 1: Delegate to service for member retrieval                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function index(Room $room): JsonResponse                         │ │
│ │ {                                                                       │ │
│ │     $members = $this->memberService->getRoomMembers($room->id);         │ │
│ │                                                                         │ │
│ │     return ApiResponse::success(RoomMemberResource::collection($members));│
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ The controller:                                                             │
│   1. Calls RoomMemberService::getRoomMembers() with room ID                 │
│   2. Wraps result in RoomMemberResource::collection()                       │
│   3. Returns via ApiResponse::success()                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomMemberService.php:202-209                       │
│ Method: getRoomMembers(int $roomId): Collection                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function getRoomMembers(int $roomId): Collection                 │ │
│ │ {                                                                       │ │
│ │     return RoomMember::where('room_id', $roomId)                        │ │
│ │         ->where('status', RoomMemberStatus::ACTIVE)                     │ │
│ │         ->with('user')                                                  │ │
│ │         ->orderBy('role_order')                                         │ │
│ │         ->get();                                                        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Query Logic:                                                                │
│   • Filters by room_id                                                      │
│   • Only ACTIVE status members (excludes LEFT, KICKED, BANNED)              │
│   • Eager loads user relationship to prevent N+1                            │
│   • Orders by role_order (owner=1, admin=2, member=3)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomMember (Model)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomMember.php                                    │ │
│ │ Responsibility: Room membership data and relationships                  │ │
│ │ Reusable: YES (used by all room membership operations)                  │ │
│ │ Why It Exists: Central model for room-user membership                   │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • $with = ['user'] → Always eager loads user                          │ │
│ │   • role → RoomMemberRole enum cast                                     │ │
│ │   • status → RoomMemberStatus enum cast                                 │ │
│ │   • role_order → Auto-set on create/update based on role                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberRole (Enum)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberRole.php                                 │ │
│ │ Responsibility: Define member role hierarchy                            │ │
│ │ Reusable: YES (used across room domain)                                 │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • OWNER = 'owner' → label: "Owner"                                    │ │
│ │   • ADMIN = 'admin' → label: "Admin"                                    │ │
│ │   • MEMBER = 'member' → label: "Member"                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberStatus (Enum)                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomMemberStatus.php                               │ │
│ │ Responsibility: Define membership status values                         │ │
│ │ Reusable: YES (used across room domain)                                 │ │
│ │                                                                         │ │
│ │ Values:                                                                 │ │
│ │   • ACTIVE = 'active'                                                   │ │
│ │   • LEFT = 'left'                                                       │ │
│ │   • KICKED = 'kicked'                                                   │ │
│ │   • BANNED = 'banned'                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomMemberResource (Resource)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Room/RoomMemberResource.php                 │ │
│ │ Responsibility: Transform RoomMember model to JSON                      │ │
│ │ Reusable: YES (used by all member-related endpoints)                    │ │
│ │                                                                         │ │
│ │ Output (6 fields):                                                      │ │
│ │   • id → Member ID                                                      │ │
│ │   • user → MinimalUserResource (when loaded)                            │ │
│ │   • role → Role value string                                            │ │
│ │   • role_label → Human-readable role label                              │ │
│ │   • status → Status value string                                        │ │
│ │   • joined_at → ISO8601 formatted timestamp                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: MinimalUserResource (Resource)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/User/MinimalUserResource.php                │ │
│ │ Responsibility: Minimal user data for nested embedding                  │ │
│ │ Reusable: YES (room owner, members, agency members, etc.)               │ │
│ │                                                                         │ │
│ │ Output (12 fields):                                                     │ │
│ │   • id, name, signature, avatar, frame, gender                          │ │
│ │   • email, phone, country, date_of_birth                                │ │
│ │   • wealth_xp, charm_xp                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Wrap data in standard success response                  │ │
│ │   • error() → Wrap error in standard error response                     │ │
│ │   • Adds timestamp and correlation_id to all responses                  │ │
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
│ 1. SELECT (Route Model Binding): Find room by ID                            │
│    Query: SELECT * FROM rooms WHERE id = ? LIMIT 1                          │
│    Source: Laravel Route Model Binding                                      │
│                                                                             │
│ 2. SELECT: Get active members for room with users                           │
│    Query: SELECT * FROM room_members                                        │
│           WHERE room_id = ? AND status = 'active'                           │
│           ORDER BY role_order ASC                                           │
│    Source: RoomMemberService::getRoomMembers()                              │
│                                                                             │
│ 3. SELECT: Eager load users for members                                     │
│    Query: SELECT * FROM users WHERE id IN (...)                             │
│    Source: Eloquent eager loading via with('user')                          │
│                                                                             │
│ CACHE OPERATIONS: None for this endpoint                                    │
│                                                                             │
│ QUEUE OPERATIONS: None for this endpoint                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ 1. RoomMemberResource::collection($members) transforms each RoomMember      │
│ 2. Each member's user is transformed via MinimalUserResource                │
│ 3. ApiResponse::success() wraps the collection                              │
│ 4. Adds meta with timestamp and correlation_id                              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(RoomMemberResource::collection($members));  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                          | Used By Endpoints                              | Reusable | Reasoning                                              |
| ----------------------------- | ---------------------------------------------- | -------- | ------------------------------------------------------ |
| `RoomMemberController.php`    | Room member operations                         | ⭕       | Controller-specific, but methods are reusable patterns |
| `RoomMemberService.php`       | All member operations (list, join, kick, etc.) | ✅       | Central service for room membership                    |
| `RoomMember.php` (Model)      | All room membership operations                 | ✅       | Core data access model                                 |
| `RoomMemberResource.php`      | Member list, join, membership endpoints        | ✅       | Standard member data transformer                       |
| `MinimalUserResource.php`     | Room, Agency, Gift, many nested user contexts  | ✅       | Universal minimal user representation                  |
| `RoomMemberRole.php` (Enum)   | All room member operations                     | ✅       | Role definitions used domain-wide                      |
| `RoomMemberStatus.php` (Enum) | All room member operations                     | ✅       | Status definitions used domain-wide                    |
| `ApiResponse.php`             | All API endpoints                              | ✅       | Universal response utility                             |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

This endpoint has no request body validation - no 422 errors possible.

### Business Logic Errors (400)

This endpoint has no business logic errors - it's a simple read operation.

### System Errors (404)

| Error                                    | Source              | Condition             |
| ---------------------------------------- | ------------------- | --------------------- |
| "No query results for model [Room] {id}" | Route Model Binding | Room ID doesn't exist |

### System Errors (500)

| Error                   | Source       | Condition                   |
| ----------------------- | ------------ | --------------------------- |
| "Internal server error" | Database/App | Database connection failure |
| "Internal server error" | Database/App | Unexpected query exception  |

### Edge Cases

| Case                      | Behavior                                        |
| ------------------------- | ----------------------------------------------- |
| Room has no members       | Returns empty array `[]` with 200 status        |
| Room has only owner       | Returns array with single owner member          |
| Large member count        | No pagination - returns all members (by design) |
| Deleted/soft-deleted room | 404 via route model binding                     |
| Non-ACTIVE status members | Filtered out - only ACTIVE members returned     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              LARAVEL ROUTER         CONTROLLER              SERVICE LAYER              DATABASE
   │                       │                       │                       │                       │
   │ GET /rooms/{id}/members                       │                       │                       │
   │──────────────────────▶│                       │                       │                       │
   │                       │                       │                       │                       │
   │                       │ 1. Route Model        │                       │                       │
   │                       │    Binding            │                       │                       │
   │                       │───────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                       │     SELECT room       │
   │                       │◀──────────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                       │
   │                       │ 2. Call index()       │                       │                       │
   │                       │──────────────────────▶│                       │                       │
   │                       │                       │                       │                       │
   │                       │                       │ 3. getRoomMembers()   │                       │
   │                       │                       │──────────────────────▶│                       │
   │                       │                       │                       │                       │
   │                       │                       │                       │ 4. Query members      │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │   SELECT members      │
   │                       │                       │                       │   WHERE room_id=?     │
   │                       │                       │                       │   AND status='active' │
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │                       │ 5. Eager load users   │
   │                       │                       │                       │──────────────────────▶│
   │                       │                       │                       │   SELECT users        │
   │                       │                       │                       │   WHERE id IN (...)   │
   │                       │                       │                       │◀──────────────────────│
   │                       │                       │                       │                       │
   │                       │                       │◀──────────────────────│                       │
   │                       │                       │  Collection<RoomMember>                       │
   │                       │                       │                       │                       │
   │                       │                       │ 6. Transform via                              │
   │                       │                       │    RoomMemberResource::collection()           │
   │                       │                       │                       │                       │
   │                       │                       │ 7. Wrap in ApiResponse::success()             │
   │                       │                       │                       │                       │
   │                       │◀──────────────────────│                       │                       │
   │◀──────────────────────│                       │                       │                       │
   │                       │                       │                       │                       │
   │  200 OK + JSON        │                       │                       │                       │
   │                       │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Additional member filters | `RoomMemberService::getRoomMembers()` add query conditions  |
| Pagination support        | Controller + service method, use `ApiResponse::paginated()` |
| New member response field | `RoomMemberResource::toArray()`                             |
| New user field in member  | `MinimalUserResource::toArray()`                            |
| Sort options              | Add request parameter handling in controller                |
| Role-based filtering      | Add query parameter and filter in service                   |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO MEMBER RESPONSE

| Step  | File                                                | What to Change                         |
| ----- | --------------------------------------------------- | -------------------------------------- |
| **1** | **Database Migration** (if new column)              | Add column to `room_members` table     |
| **2** | `app/Models/Room/RoomMember.php`                    | Add to `$fillable`, add cast if needed |
| **3** | `app/Http/Resources/V1/Room/RoomMemberResource.php` | Add field to `toArray()` return        |

#### ➕ ADDING A NEW FIELD TO NESTED USER

| Step  | File                                                 | What to Change           |
| ----- | ---------------------------------------------------- | ------------------------ |
| **1** | `app/Http/Resources/V1/User/MinimalUserResource.php` | Add field to `toArray()` |

> **Warning**: MinimalUserResource is used in many places - changes affect all endpoints!

#### ➖ REMOVING A FIELD

| Step  | File                                                | What to Change             |
| ----- | --------------------------------------------------- | -------------------------- |
| **1** | `app/Http/Resources/V1/Room/RoomMemberResource.php` | Remove field from response |
| **2** | **Database Migration** (if column removal)          | Drop column (if safe)      |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────┐
│   Database Column   │
│  (room_members.*)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   RoomMember Model  │
│   ($fillable, $casts)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ RoomMemberResource  │
│   (toArray())       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   JSON Response     │
└─────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                    | Reason                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| `MinimalUserResource`        | Used by 10+ endpoints - changes have wide impact               |
| `ApiResponse` structure      | Breaking change for all API consumers                          |
| `role_order` logic           | Affects member ordering across the application                 |
| `RoomMemberRole` enum values | Requires data migration if values change                       |
| `$with = ['user']` in Model  | Removing causes N+1 queries or broken resource transformations |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                           |
| ------------------------------------ | ---------------------------------------------------- |
| N+1 query on users                   | Keep `with('user')` in service query                 |
| Breaking MinimalUserResource changes | Test all endpoints using this resource before deploy |
| Returning non-ACTIVE members         | Always filter by `status = ACTIVE`                   |
| Forgetting to order by role_order    | Include `orderBy('role_order')` in query             |
| Missing room existence check         | Route model binding handles this automatically       |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:22                    ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomMemberController.php                       ← Controller (index method)
app/Services/Room/
  └── RoomMemberService.php                          ← Service (getRoomMembers)
app/Models/Room/
  └── RoomMember.php                                 ← Model with relationships
app/Http/Resources/V1/Room/
  └── RoomMemberResource.php                         ← Response transformer
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                        ← Nested user transformer
app/Enums/Room/
  ├── RoomMemberRole.php                             ← Role enum
  └── RoomMemberStatus.php                           ← Status enum
app/Http/Utils/
  └── ApiResponse.php                                ← Response utility
```

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `GET /api/v1/rooms/{room}/members` |
| **Domain**          | Room                               |
| **Author**          | System Documentation               |
| **Created**         | 2026-01-30                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4+                               |
