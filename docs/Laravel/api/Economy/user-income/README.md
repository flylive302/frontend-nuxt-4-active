# GET /api/v1/user/income

> **Domain**: Economy - Agency Income  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The User Income endpoint retrieves comprehensive income statistics for the authenticated user, including active income targets, historical earnings, and time-based summaries. This data powers the income dashboard in client applications.

### Responsibilities

- Authenticate request via Sanctum token
- Retrieve active income target (if any)
- Aggregate completed targets and diamond earnings
- Calculate time-based summaries (today, week, month, all-time)
- Compile recent earnings history

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Income statistics           | Aggregates user's income data from multiple sources  |
| Active target status        | Current progress on income target                    |
| Time-based summaries        | Today, week, month, all-time earnings                |
| Recent earnings             | Last 7 days of transaction history                   |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `agency_income_targets`     | Database       | Income target tracking                      |
| `transactions` table        | Database       | Income transaction history                  |
| Laravel Sanctum             | Package        | Token authentication                        |
| AgencyIncomeService         | Service        | Income statistics calculation               |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/income
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
  "status": "success",
  "message": "Income statistics retrieved",
  "data": {
    "summary": {
      "total_coins_earned": "125000.0000",
      "total_diamonds": 850,
      "claimable_rewards": 2,
      "pending_targets": 1
    },
    "total_earned": "125000.0000",
    "total_this_month": "45000.0000",
    "total_this_week": "12000.0000",
    "total_today": "3500.0000",
    "average_daily": "4166.6667",
    "active_target": {
      "tier": "T3",
      "earned_coins": 45000.5,
      "required_coins": 100000,
      "progress_percentage": 45.0,
      "days_remaining": 18,
      "diamond_reward": 500
    },
    "completed_targets": 5,
    "total_diamonds_earned": 850,
    "recent_earnings": [
      {
        "date": "2026-02-04",
        "date_formatted": "04 February, 2026",
        "amount": "3500.0000",
        "source": "gift",
        "count": 12
      },
      {
        "date": "2026-02-03",
        "date_formatted": "03 February, 2026",
        "amount": "2800.0000",
        "source": "agency_income",
        "count": 8
      }
    ]
  }
}
```

#### ✅ Success Response - No Active Target (200 OK)

```json
{
  "status": "success",
  "message": "Income statistics retrieved",
  "data": {
    "summary": {
      "total_coins_earned": "0.0000",
      "total_diamonds": 0,
      "claimable_rewards": 0,
      "pending_targets": 0
    },
    "total_earned": "0.0000",
    "total_this_month": "0.0000",
    "total_this_week": "0.0000",
    "total_today": "0.0000",
    "average_daily": "0.0000",
    "active_target": null,
    "completed_targets": 0,
    "total_diamonds_earned": 0,
    "recent_earnings": []
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated."
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Stats retrieved successfully        |
| `401` | Unauthenticated                     |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/income                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/income.php:17                                              │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/', [AgencyIncomeController::class, 'stats']);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware: auth:sanctum (line 15)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyIncomeController.php         │
│ Method: stats(Request $request) at line 27                                  │
│                                                                             │
│ STEP 1: Get User (lines 29-35)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $userId = $user->id;                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get Stats (line 36)                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $stats = $this->incomeService->getIncomeStats($userId);                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Response (line 38)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($stats, 'Income statistics retrieved');    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Agency/AgencyIncomeService.php                           │
│ Method: getIncomeStats(int $userId) at lines 355-403                        │
│                                                                             │
│ STEP 1: Get Active Target (line 357)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $activeTarget = $this->getActiveTarget($userId);                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Aggregate Completed Targets (lines 358-367)                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $completedTargets = AgencyIncomeTarget::forUser($userId)                │ │
│ │     ->completed()->count();                                             │ │
│ │ $totalDiamondsEarned = AgencyIncomeTarget::forUser($userId)             │ │
│ │     ->completed()                                                       │ │
│ │     ->where('member_reward_claimed', true)                              │ │
│ │     ->sum('member_diamond_reward');                                     │ │
│ │ $totalCoinsEarned = AgencyIncomeTarget::forUser($userId)                │ │
│ │     ->completed()->sum('earned_coins');                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get Summary Totals - Optimized (lines 376-377)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $summaryTotals = $this->getSummaryTotals($userId);                      │ │
│ │ // Single query with conditional aggregation for:                       │ │
│ │ // - total_earned                                                       │ │
│ │ // - total_this_month                                                   │ │
│ │ // - total_this_week                                                    │ │
│ │ // - total_today                                                        │ │
│ │ // - average_daily (calculated from last 30 days)                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Get Recent Earnings (line 374)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $recentEarnings = $this->getRecentEarnings($userId);                    │ │
│ │ // Last 7 days, grouped by date and type                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Build Response Array (lines 379-403)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'summary' => [...],                                                 │ │
│ │     'total_earned' => $summaryTotals['total_earned'],                   │ │
│ │     'active_target' => $activeTarget ? [...] : null,                    │ │
│ │     'completed_targets' => $completedTargets,                           │ │
│ │     'recent_earnings' => $recentEarnings,                               │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   | Reasoning                                    |
| --------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------- |
| `AgencyIncomeController.php`                  | All income endpoints                 | ⭕ Mixed   | Controller for income domain                 |
| `AgencyIncomeService.php`                     | Income endpoints, gift processing    | ✅ Reusable| Core income business logic                   |
| `ApiResponse.php`                             | All API endpoints                    | ✅ Reusable| Standardized response format                 |

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| User not agency member            | Returns stats with active_target: null             |
| No completed targets              | All totals return 0                                |
| No recent earnings                | recent_earnings: []                                |
| First day of month/week           | Respective period totals may be 0                  |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │GET /user/income       │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 2. getIncomeStats()   │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 3. SELECT          │
   │                       │                       │                       │    active target   │
   │                       │                       │                       │    + aggregations  │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| New summary metric              | AgencyIncomeService::getIncomeStats()                 |
| Change time periods             | AgencyIncomeService::getSummaryTotals()               |
| Add more recent days            | getRecentEarnings($userId, $days) parameter           |

### 📁 File Locations Quick Reference

```
routes/api/income.php:17                            ← Route definition
app/Http/Controllers/Api/V1/Agency/
  └── AgencyIncomeController.php:27-38              ← Controller method
app/Services/Agency/
  └── AgencyIncomeService.php:355-403               ← Stats calculation
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit MSAB events. Income target completion events (`income_target_completed`) are emitted by the `addToIncomeTarget()` method when processing gifts, not by this read-only stats endpoint.

---

## 9. Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `GET /api/v1/user/income` |
| **Domain**          | Economy - Agency Income   |
| **Author**          | System Documentation      |
| **Created**         | 2026-02-04                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4+                      |
