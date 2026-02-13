# GET /api/v1/user/income/targets/history

> **Domain**: Economy - Agency Income  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Income Target History endpoint retrieves a filtered, paginated history of income targets for the authenticated user. Supports filtering by status and tier, with configurable limit.

### Responsibilities

- Authenticate request via Sanctum token
- Parse optional query filters (status, tier, limit)
- Retrieve filtered target history
- Transform via resource collection

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Filtered target history     | Returns targets matching criteria                    |
| Query parameter parsing     | status, tier, limit                                  |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `agency_income_targets`     | Database       | Income target tracking                      |
| AgencyIncomeService         | Service        | Target history retrieval                    |
| AgencyIncomeTargetResource  | Resource       | Response transformation                     |
| AgencyIncomeTargetStatus    | Enum           | Status validation                           |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/income/targets/history
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Query Parameters

| Parameter | Type     | Required | Default | Constraints     | Description                        |
| --------- | -------- | -------- | ------- | --------------- | ---------------------------------- |
| `status`  | `string` | ❌       | null    | AgencyIncomeTargetStatus enum | Filter by status |
| `tier`    | `string` | ❌       | null    | T1-T10          | Filter by tier                     |
| `limit`   | `integer`| ❌       | 20      | 1-100           | Maximum results                    |

### Valid Status Values

- `active` - Currently in progress
- `completed` - Successfully completed
- `failed` - Expired without completion
- `cancelled` - Cancelled (user left agency)

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 122,
      "tier": "T2",
      "status": "completed",
      "required_coins": 50000,
      "earned_coins": 50000,
      "progress_percentage": 100,
      "member_diamond_reward": 250,
      "owner_diamond_reward": 50,
      "member_reward_claimed": true,
      "owner_reward_claimed": true,
      "period_start": "2026-01-01T00:00:00.000000Z",
      "period_end": "2026-01-31T23:59:59.000000Z",
      "days_remaining": 0,
      "completed_at": "2026-01-25T14:30:00.000000Z",
      "created_at": "2026-01-01T00:00:00.000000Z"
    }
  ]
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | History retrieved successfully      |
| `401` | Unauthenticated                     |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/income.php:22                                              │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/targets/history',                                          │ │
│ │     [AgencyIncomeController::class, 'history']);                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyIncomeController.php         │
│ Method: history(Request $request) at line 69                                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return AgencyIncomeTargetResource::collection([]);                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $status = $request->query('status');                                    │ │
│ │ $tier = $request->query('tier');                                        │ │
│ │ $limit = min((int) ($request->query('limit', 20)), 100);                │ │
│ │                                                                         │ │
│ │ $statusEnum = $status ? AgencyIncomeTargetStatus::tryFrom($status)      │ │
│ │     : null;                                                             │ │
│ │                                                                         │ │
│ │ $targets = $this->incomeService->getTargetHistory(                      │ │
│ │     $userId,                                                            │ │
│ │     $statusEnum,                                                        │ │
│ │     $tier,                                                              │ │
│ │     $limit                                                              │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ return AgencyIncomeTargetResource::collection($targets);                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Agency/AgencyIncomeService.php                           │
│ Method: getTargetHistory() at lines 212-230                                 │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = AgencyIncomeTarget::forUser($userId)                           │ │
│ │     ->with('definition')                                                │ │
│ │     ->orderBy('created_at', 'desc');                                    │ │
│ │                                                                         │ │
│ │ if ($status) {                                                          │ │
│ │     $query->where('status', $status);                                   │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ if ($tier) {                                                            │ │
│ │     $query->where('tier', $tier);                                       │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return $query->limit($limit)->get();                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `AgencyIncomeController.php`                  | All income endpoints                 | ⭕ Mixed   |
| `AgencyIncomeService.php`                     | Income endpoints, gift processing    | ✅ Reusable|
| `AgencyIncomeTargetResource.php`              | targets, activeTarget, history       | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| Invalid status value              | tryFrom returns null, no filter applied            |
| Limit > 100                       | Capped at 100                                      |
| Limit <= 0                        | Uses default 20                                    |
| No matching targets               | Returns empty data: []                             |

---

## 6. Document Metadata

| Property            | Value                                     |
| ------------------- | ----------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/income/targets/history` |
| **Domain**          | Economy - Agency Income                   |
| **Author**          | System Documentation                      |
| **Created**         | 2026-02-04                                |
| **Laravel Version** | 12.x                                      |
| **PHP Version**     | 8.4+                                      |
