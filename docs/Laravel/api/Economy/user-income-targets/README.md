# GET /api/v1/user/income/targets

> **Domain**: Economy - Agency Income  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Income Targets endpoint retrieves a paginated list of all income targets for the authenticated user, including active, completed, failed, and cancelled targets. This provides a historical view of the user's income target journey.

### Responsibilities

- Authenticate request via Sanctum token
- Retrieve all income targets (limit 50)
- Include target definitions for context
- Transform via resource

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Target list                 | All user's income targets                            |
| Default pagination          | Returns up to 50 targets                             |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `agency_income_targets`     | Database       | Income target tracking                      |
| AgencyIncomeService         | Service        | Target history retrieval                    |
| AgencyIncomeTargetResource  | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/income/targets
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |

### Request Body Schema

**No request body** - GET request with no parameters.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 123,
      "tier": "T3",
      "status": "active",
      "required_coins": 100000,
      "earned_coins": 45000.5,
      "progress_percentage": 45.0,
      "member_diamond_reward": 500,
      "owner_diamond_reward": 100,
      "member_reward_claimed": false,
      "owner_reward_claimed": false,
      "period_start": "2026-02-01T00:00:00.000000Z",
      "period_end": "2026-02-28T23:59:59.000000Z",
      "days_remaining": 24,
      "created_at": "2026-02-01T00:00:00.000000Z"
    },
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

#### ✅ Empty Response (200 OK)

```json
{
  "data": []
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Targets retrieved successfully      |
| `401` | Unauthenticated                     |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/income.php:20                                              │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/targets', [AgencyIncomeController::class, 'targets']);     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyIncomeController.php         │
│ Method: targets(Request $request) at line 100                               │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return AgencyIncomeTargetResource::collection([]);                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $targets = $this->incomeService->getTargetHistory($userId, limit: 50);  │ │
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
| User not authenticated            | Returns empty collection                           |
| No targets exist                  | Returns empty data: []                             |
| User never had agency membership  | Returns empty data: []                             |

---

## 6. Document Metadata

| Property            | Value                             |
| ------------------- | --------------------------------- |
| **Endpoint**        | `GET /api/v1/user/income/targets` |
| **Domain**          | Economy - Agency Income           |
| **Author**          | System Documentation              |
| **Created**         | 2026-02-04                        |
| **Laravel Version** | 12.x                              |
| **PHP Version**     | 8.4+                              |
