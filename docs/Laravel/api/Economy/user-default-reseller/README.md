# GET /api/v1/user/default-reseller

> **Domain**: Economy - Reseller Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Get Default Reseller endpoint retrieves the authenticated user's selected default reseller. Users can set a preferred reseller to streamline coin purchase requests.

### Responsibilities

- Authenticate request via Sanctum token
- Retrieve user's default reseller relationship
- Transform via ResellerResource

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Default reseller lookup     | Returns user's preferred reseller                    |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `users` table               | Database       | User with defaultReseller relationship      |
| ResellerResource            | Resource       | Response transformation                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/default-reseller
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

---

### Response Schemas

#### ✅ Success Response - With Default Reseller (200 OK)

```json
{
  "status": "success",
  "message": "Default reseller retrieved successfully",
  "data": {
    "id": 456,
    "name": "John Reseller",
    "signature": "john_reseller",
    "contact": "+1234567890",
    "avatar": "https://imagekit.io/avatar/456.jpg"
  }
}
```

#### ✅ Success Response - No Default Set (200 OK)

```json
{
  "status": "success",
  "message": "No default reseller set",
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
│ File: routes/api/coin-requests.php:18                                       │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/user/default-reseller',                                    │ │
│ │     [ResellerController::class, 'showDefault']);                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware: auth:sanctum                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/ResellerController.php             │
│ Method: showDefault(Request $request) at line 50                            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('User not authenticated');         │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $defaultReseller = $user->defaultReseller;                              │ │
│ │                                                                         │ │
│ │ if ($defaultReseller === null) {                                        │ │
│ │     return ApiResponse::success(null, 'No default reseller set');       │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new ResellerResource($defaultReseller),                             │ │
│ │     'Default reseller retrieved successfully'                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `ResellerController.php`                      | Reseller endpoints                   | ⭕ Mixed   |
| `ResellerResource.php`                        | All reseller responses               | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| No default reseller set           | Returns data: null with success message            |
| Default reseller deleted          | Relationship returns null                          |
| Default lost Reseller role        | Still returned (role not checked on retrieval)     |

---

## 6. Document Metadata

| Property            | Value                             |
| ------------------- | --------------------------------- |
| **Endpoint**        | `GET /api/v1/user/default-reseller` |
| **Domain**          | Economy - Reseller Management     |
| **Author**          | System Documentation              |
| **Created**         | 2026-02-04                        |
| **Laravel Version** | 12.x                              |
| **PHP Version**     | 8.4+                              |
