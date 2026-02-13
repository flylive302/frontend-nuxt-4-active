# GET /api/v1/admin/accounts/deletion-stats

> **Domain**: Admin - Account Management  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Deletion Stats endpoint provides aggregate statistics about deleted user accounts for administrative monitoring and compliance reporting. It returns counts of total deleted users, restorable accounts, recent deletions, and the oldest deletion timestamp.

### Responsibilities

- Authenticate request via Sanctum token
- Verify admin role (Admin or Super Admin)
- Query deleted users with optimized aggregation
- Return statistics for compliance dashboard

### What It Owns

| Owned                   | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| Stats aggregation       | Computes counts across soft-deleted users            |
| Recent deletions calc   | Filters for last 30 days                             |

### External Dependencies

| Dependency              | Type           | Purpose                                     |
| ----------------------- | -------------- | ------------------------------------------- |
| `users` table           | Database       | User data with soft deletes                 |
| Laravel Sanctum         | Package        | Token authentication                        |
| Spatie Permission       | Package        | Role verification                           |
| AccountDeletionService  | Service        | Stats computation                           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/admin/accounts/deletion-stats
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum  
✅ **Role Required** - Admin or Super Admin

### Rate Limiting

| Limiter              | Key               | Config                              |
| -------------------- | ----------------- | ----------------------------------- |
| `throttle:api_admin` | Admin rate limit  | Stricter limit for admin endpoints  |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |
| `X-Correlation-ID` | ❌       | `string (UUID)`       | Request tracing ID           |

### Request Body Schema

**No request body** - GET request with no parameters.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Account deletion statistics retrieved successfully.",
  "data": {
    "total_deleted": 156,
    "restorable": 142,
    "recent_deletions": 23,
    "oldest_deletion": "2024-06-15T10:30:00.000000Z"
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "User does not have the right roles.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to retrieve deletion statistics",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Stats retrieved successfully        |
| `401` | Unauthenticated                     |
| `403` | User lacks Admin/Super Admin role   |
| `429` | Rate limit exceeded                 |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/admin/accounts/deletion-stats                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/admin.php:27                                               │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/deletion-stats',                                           │ │
│ │     [AccountDeletionController::class, 'getDeletionStats']);            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (lines 17):                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware([                                                     │ │
│ │     'auth:sanctum',                   // Token auth                     │ │
│ │     'role:Admin|Super Admin',         // Spatie role check              │ │
│ │     'throttle:api_admin'              // Admin rate limiting            │ │
│ │ ])->group(...)                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/AccountDeletionController.php        │
│ Method: getDeletionStats(Request $request) at line 149                      │
│                                                                             │
│ STEP 1: Authorization Check (line 151)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('viewAny', User::class);                               │ │
│ │ // Uses UserPolicy@viewAny - verifies admin privileges                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call Service (line 154)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $stats = $this->accountDeletionService->getDeletionStats();             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Response (lines 156-164)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Account deletion statistics retrieved...',            │ │
│ │     'data' => $stats,                                                   │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $request->header('X-Correlation-ID'),       │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/AccountDeletionService.php                          │
│ Method: getDeletionStats() at lines 255-271                                 │
│                                                                             │
│ Optimized Single Query (lines 257-264):                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $stats = User::onlyTrashed()                                            │ │
│ │     ->selectRaw('                                                       │ │
│ │         COUNT(*) as total_deleted,                                      │ │
│ │         COUNT(CASE WHEN signature IS NOT NULL THEN 1 END) as restorable,│ │
│ │         COUNT(CASE WHEN deleted_at >= ? THEN 1 END) as recent_deletions,│ │
│ │         MIN(deleted_at) as oldest_deletion                              │ │
│ │     ', [now()->subDays(30)])                                            │ │
│ │     ->first();                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Return Stats Array (lines 266-271):                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'total_deleted' => (int) ($stats->total_deleted ?? 0),              │ │
│ │     'restorable' => (int) ($stats->restorable ?? 0),                    │ │
│ │     'recent_deletions' => (int) ($stats->recent_deletions ?? 0),        │ │
│ │     'oldest_deletion' => $stats->oldest_deletion,                       │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT: Token validation (Sanctum middleware)                            │
│    Query: SELECT * FROM personal_access_tokens WHERE token = ?              │
│                                                                             │
│ 2. SELECT: User retrieval with roles (Role middleware)                      │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Query: SELECT * FROM model_has_roles WHERE model_id = ?                  │
│                                                                             │
│ 3. SELECT: Aggregated stats (single optimized query)                        │
│    Query:                                                                   │
│    SELECT                                                                   │
│      COUNT(*) as total_deleted,                                             │
│      COUNT(CASE WHEN signature IS NOT NULL THEN 1 END) as restorable,       │
│      COUNT(CASE WHEN deleted_at >= '2026-01-05 00:00:00' THEN 1 END)        │
│        as recent_deletions,                                                 │
│      MIN(deleted_at) as oldest_deletion                                     │
│    FROM users WHERE deleted_at IS NOT NULL                                  │
│                                                                             │
│ Performance Note:                                                           │
│   Uses single query with conditional aggregation instead of 4 separate      │
│   queries, reducing database round-trips from 4 to 1.                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `AccountDeletionController.php`               | All account lifecycle endpoints      | ⭕ Mixed   | Controller for account management            |
| `AccountDeletionService.php`                  | Delete, restore, stats endpoints     | ✅ Reusable| Core account lifecycle service               |
| `UserPolicy.php`                              | All user-related admin endpoints     | ✅ Reusable| Authorization policies                       |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                           | Source                | Condition                        |
| ------------------------------- | --------------------- | -------------------------------- |
| User lacks admin role           | Role middleware       | User not Admin/Super Admin       |
| viewAny policy denied           | UserPolicy@viewAny    | Policy returns false             |

### System Errors (500)

| Error                        | Source                    | Condition                        |
| ---------------------------- | ------------------------- | -------------------------------- |
| Database query failure       | getDeletionStats()        | DB connection error              |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| No deleted users exist            | Returns all zeros: {total_deleted: 0, ...}         |
| No recent deletions               | recent_deletions: 0, other stats still returned    |
| All signatures purged             | restorable: 0 (no users can be restored)           |
| Very large deleted user count     | Single aggregation query handles efficiently       |

---

## 6. Sequence Diagram (Textual)

```
 ADMIN CLIENT           MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │GET /deletion-stats    │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 2. role:Admin|Super   │                       │                    │
   │                       │    Admin              │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 3. throttle:api_admin │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 4. authorize()        │                    │
   │                       │                       │    viewAny            │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 5. getDeletionStats() │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 6. SELECT         │
   │                       │                       │                       │    aggregated     │
   │                       │                       │                       │    stats          │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │                       │                    │
   │                       │                       │ 7. JSON response      │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │                       │                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| Additional stats                | AccountDeletionService::getDeletionStats()            |
| Time period filtering           | Add request parameter, modify selectRaw()             |
| Stats caching                   | Add cache layer in service method                     |
| Export to CSV                   | New controller method using same service              |

### 📝 Field Modification Guide

#### ➕ ADDING NEW STATS FIELD

**Example: Add `average_account_age` stat**

```php
// AccountDeletionService::getDeletionStats()
$stats = User::onlyTrashed()
    ->selectRaw('
        COUNT(*) as total_deleted,
        COUNT(CASE WHEN signature IS NOT NULL THEN 1 END) as restorable,
        COUNT(CASE WHEN deleted_at >= ? THEN 1 END) as recent_deletions,
        MIN(deleted_at) as oldest_deletion,
        AVG(DATEDIFF(deleted_at, created_at)) as avg_account_age_days
    ', [now()->subDays(30)])
    ->first();

return [
    // ... existing stats
    'avg_account_age_days' => (int) ($stats->avg_account_age_days ?? 0),
];
```

### 📁 File Locations Quick Reference

```
routes/api/admin.php:27                             ← Route definition
app/Http/Controllers/Api/V1/User/
  └── AccountDeletionController.php:149-167         ← Controller method
app/Services/User/
  └── AccountDeletionService.php:255-271            ← Stats computation
app/Policies/
  └── UserPolicy.php                                ← viewAny authorization
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                                        |
| ------------------- | -------------------------------------------- |
| **Endpoint**        | `GET /api/v1/admin/accounts/deletion-stats`  |
| **Domain**          | Admin - Account Management                   |
| **Author**          | System Documentation                         |
| **Created**         | 2026-02-04                                   |
| **Laravel Version** | 12.x                                         |
| **PHP Version**     | 8.4+                                         |
