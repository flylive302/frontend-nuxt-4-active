# GET /api/v1/admin/accounts/restorable

> **Domain**: Admin - Account Management  
> **Type**: Protected Admin Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Restorable Users endpoint retrieves a list of soft-deleted user accounts that can be restored. Accounts are restorable if they have a preserved signature (which is kept during PII purge for transaction history compliance).

### Responsibilities

- Authenticate request via Sanctum token
- Verify admin role (Admin or Super Admin)
- Query soft-deleted users with preserved signatures
- Return collection of restorable user profiles

### What It Owns

| Owned                   | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| Restorable filtering    | Filters for trashed users with signatures            |
| User list retrieval     | Returns ordered collection by deletion date          |

### External Dependencies

| Dependency              | Type           | Purpose                                     |
| ----------------------- | -------------- | ------------------------------------------- |
| `users` table           | Database       | User data with soft deletes                 |
| Laravel Sanctum         | Package        | Token authentication                        |
| Spatie Permission       | Package        | Role verification                           |
| AccountDeletionService  | Service        | Restorable users query                      |
| BootstrapUserResource   | Resource       | User data transformation                    |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/admin/accounts/restorable
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
  "message": "Restorable users retrieved successfully.",
  "data": [
    {
      "id": 456,
      "name": null,
      "signature": "3592010",
      "avatar": null,
      "frame": null,
      "phone": null,
      "country": null,
      "gender": "male",
      "date_of_birth": null,
      "coins": "1500",
      "diamonds": "250",
      "wealth_xp": "5000",
      "charm_xp": "3200",
      "is_profile_complete": false,
      "is_blocked": true,
      "blocked_at": "2026-01-15T10:30:00.000000Z",
      "blocked_reason": "Account deleted - PII purged for compliance",
      "locked_until": null
    }
  ],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_restorable": 1
  }
}
```

#### ✅ Empty Response (200 OK)

```json
{
  "status": "success",
  "message": "Restorable users retrieved successfully.",
  "data": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_restorable": 0
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

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Users retrieved successfully        |
| `401` | Unauthenticated                     |
| `403` | User lacks Admin/Super Admin role   |
| `429` | Rate limit exceeded                 |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/admin/accounts/restorable                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/admin.php:26                                               │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/restorable',                                               │ │
│ │     [AccountDeletionController::class, 'getRestorableUsers']);          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain: auth:sanctum, role:Admin|Super Admin, throttle:api_admin  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/AccountDeletionController.php        │
│ Method: getRestorableUsers(Request $request) at line 124                    │
│                                                                             │
│ STEP 1: Authorization Check (line 126)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('viewAny', User::class);                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Call Service (line 129)                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $users = $this->accountDeletionService->getRestorableUsers();           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Response (lines 131-140)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Restorable users retrieved successfully.',            │ │
│ │     'data' => BootstrapUserResource::collection($users),                │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $request->header('X-Correlation-ID'),       │ │
│ │         'total_restorable' => $users->count(),                          │ │
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
│ Method: getRestorableUsers() at lines 231-237                               │
│                                                                             │
│ Query (lines 233-236):                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return User::onlyTrashed()                                              │ │
│ │     ->whereNotNull('signature')   // Only users with preserved sigs     │ │
│ │     ->orderBy('deleted_at', 'desc')                                     │ │
│ │     ->get();                                                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Signature is preserved during PII purge for transaction history.      │
│       Users without signatures cannot be restored (permanently deleted).    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 RESOURCE TRANSFORMATION                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php                  │
│                                                                             │
│ Note: Most fields will be null for deleted users (PII purged)               │
│ Preserved fields: id, signature, coins, diamonds, xp values, blocked info   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `AccountDeletionController.php`               | All account lifecycle endpoints      | ⭕ Mixed   | Controller for account management            |
| `AccountDeletionService.php`                  | Delete, restore, stats endpoints     | ✅ Reusable| Core account lifecycle service               |
| `BootstrapUserResource.php`                   | Profile, auth, admin endpoints       | ✅ Reusable| Standard user response format                |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                           | Source                | Condition                        |
| ------------------------------- | --------------------- | -------------------------------- |
| User lacks admin role           | Role middleware       | User not Admin/Super Admin       |
| viewAny policy denied           | UserPolicy@viewAny    | Policy returns false             |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| No restorable users               | Returns empty array with total_restorable: 0       |
| All signatures purged             | Returns empty array (no users can be restored)     |
| Large number of deleted users     | Returns all (consider pagination for production)   |

---

## 6. Sequence Diagram (Textual)

```
 ADMIN CLIENT           MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │GET /restorable        │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │ 2. role check         │                       │                    │
   │                       │ 3. throttle           │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 4. authorize()        │                    │
   │                       │                       │ 5. getRestorable()    │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 6. SELECT users   │
   │                       │                       │                       │    WHERE deleted  │
   │                       │                       │                       │    AND signature  │
   │                       │                       │                       │    IS NOT NULL    │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │ 7. Transform via      │                    │
   │                       │                       │    Resource           │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| Pagination                      | Add paginate() to service, update controller          |
| Search by signature             | Add query parameter, filter in service                |
| Include deletion metadata       | Extend BootstrapUserResource for trashed users        |

### 📁 File Locations Quick Reference

```
routes/api/admin.php:26                             ← Route definition
app/Http/Controllers/Api/V1/User/
  └── AccountDeletionController.php:124-143         ← Controller method
app/Services/User/
  └── AccountDeletionService.php:231-237            ← Query logic
app/Http/Resources/V1/Auth/
  └── BootstrapUserResource.php                     ← Response transformer
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.

---

## 9. Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `GET /api/v1/admin/accounts/restorable`  |
| **Domain**          | Admin - Account Management               |
| **Author**          | System Documentation                     |
| **Created**         | 2026-02-04                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4+                                     |
