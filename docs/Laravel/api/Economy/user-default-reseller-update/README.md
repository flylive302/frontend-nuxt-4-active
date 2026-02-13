# PUT /api/v1/user/default-reseller

> **Domain**: Economy - Reseller Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Update Default Reseller endpoint allows the authenticated user to set or change their preferred reseller. The selected user must have the Reseller role.

### Responsibilities

- Authenticate request via Sanctum token
- Validate reseller_id exists and has Reseller role
- Update user's default_reseller_id column
- Return updated reseller info

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Default reseller update     | Sets user's preferred reseller                       |
| Reseller role validation    | Ensures target user has Reseller role                |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `users` table               | Database       | User with default_reseller_id               |
| UpdateDefaultResellerRequest| FormRequest    | Validation with role check                  |
| ResellerResource            | Resource       | Response transformation                     |
| Spatie Permission           | Package        | Role verification in validation             |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/user/default-reseller
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Request Body Schema

```json
{
  "reseller_id": 456
}
```

### Field Details

| Field         | Type      | Required | Constraints                    | Description        |
| ------------- | --------- | -------- | ------------------------------ | ------------------ |
| `reseller_id` | `integer` | ✅       | Must exist with Reseller role  | Target reseller ID |

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Default reseller updated successfully",
  "data": {
    "id": 456,
    "name": "John Reseller",
    "signature": "john_reseller",
    "contact": "+1234567890",
    "avatar": "https://imagekit.io/avatar/456.jpg"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "reseller_id": ["The selected reseller is not valid."]
  }
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Reseller updated successfully       |
| `401` | Unauthenticated                     |
| `422` | Validation failed                   |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:19                                       │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::put('/user/default-reseller',                                    │ │
│ │     [ResellerController::class, 'updateDefault']);                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware: auth:sanctum                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 VALIDATION                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Reseller/UpdateDefaultResellerRequest.php    │
│                                                                             │
│ Rules (lines 31-39):                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'reseller_id' => [                                                      │ │
│ │     'required',                                                         │ │
│ │     'integer',                                                          │ │
│ │     Rule::exists('users', 'id')->where(function ($query) {              │ │
│ │         // Only allow selecting users who have the Reseller role        │ │
│ │         $query->whereIn('id', User::role('Reseller')->pluck('id'));     │ │
│ │     }),                                                                 │ │
│ │ ]                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/ResellerController.php             │
│ Method: updateDefault(UpdateDefaultResellerRequest $request) at line 76     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('User not authenticated');         │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ $resellerId = $request->validated('reseller_id');                       │ │
│ │                                                                         │ │
│ │ $user->update(['default_reseller_id' => $resellerId]);                  │ │
│ │                                                                         │ │
│ │ // Reload the relationship                                              │ │
│ │ $user->load('defaultReseller');                                         │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new ResellerResource($user->defaultReseller),                       │ │
│ │     'Default reseller updated successfully'                             │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `ResellerController.php`                      | Reseller endpoints                   | ⭕ Mixed   |
| `UpdateDefaultResellerRequest.php`            | Update default reseller only         | ❌ Single  |
| `ResellerResource.php`                        | All reseller responses               | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                                      | Condition                        |
| ------------------------------------------ | -------------------------------- |
| `reseller_id.required`                     | Field not provided               |
| `reseller_id.exists` (invalid)             | User doesn't exist or not reseller |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| Setting same reseller again       | Succeeds (no-op update)                            |
| Reseller loses role after set     | Still stored, validation only on write             |
| Null to clear default             | Not supported, must provide valid ID               |

---

## 6. Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `PUT /api/v1/user/default-reseller`|
| **Domain**          | Economy - Reseller Management      |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-04                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4+                               |
