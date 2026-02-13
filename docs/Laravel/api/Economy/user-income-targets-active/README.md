# GET /api/v1/user/income/targets/active

> **Domain**: Economy - Agency Income  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Active Income Target endpoint retrieves the current active income target for the authenticated user. Each user can have at most one active target at a time. Returns null if no active target exists.

### Responsibilities

- Authenticate request via Sanctum token
- Retrieve single active income target
- Transform via resource

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Active target retrieval     | Returns current in-progress target                   |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `agency_income_targets`     | Database       | Income target tracking                      |
| AgencyIncomeService         | Service        | Active target retrieval                     |
| AgencyIncomeTargetResource  | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/income/targets/active
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

---

### Response Schemas

#### ✅ Success Response - With Active Target (200 OK)

```json
{
  "status": "success",
  "message": "Active target retrieved",
  "data": {
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
  }
}
```

#### ✅ Success Response - No Active Target (200 OK)

```json
{
  "status": "success",
  "message": "No active target",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Request successful                  |
| `401` | Unauthenticated                     |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/income.php:21                                              │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/targets/active',                                           │ │
│ │     [AgencyIncomeController::class, 'activeTarget']);                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyIncomeController.php         │
│ Method: activeTarget(Request $request) at line 46                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $target = $this->incomeService->getActiveTarget($userId);               │ │
│ │                                                                         │ │
│ │ if (! $target) {                                                        │ │
│ │     return ApiResponse::success(null, 'No active target');              │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AgencyIncomeTargetResource($target),                            │ │
│ │     'Active target retrieved'                                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Agency/AgencyIncomeService.php                           │
│ Method: getActiveTarget(int $userId) at line 204                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AgencyIncomeTarget::getActiveForUser($userId);                   │ │
│ │ // Uses scope: status = 'active' AND period_end >= now()                │ │
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
| User not authenticated            | 401 Unauthorized                                   |
| No active target                  | Returns data: null with success message            |
| Target just expired               | Returns null (processed by scheduled command)      |
| User left agency                  | Target cancelled, returns null                     |

---

## 6. Document Metadata

| Property            | Value                                    |
| ------------------- | ---------------------------------------- |
| **Endpoint**        | `GET /api/v1/user/income/targets/active` |
| **Domain**          | Economy - Agency Income                  |
| **Author**          | System Documentation                     |
| **Created**         | 2026-02-04                               |
| **Laravel Version** | 12.x                                     |
| **PHP Version**     | 8.4+                                     |
