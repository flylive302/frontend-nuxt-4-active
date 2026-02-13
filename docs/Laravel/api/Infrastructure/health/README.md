# GET /api/v1/health

> **Domain**: Infrastructure  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Health Check endpoint provides a simple mechanism for monitoring systems, load balancers, and deployment pipelines to verify that the FlyLive API is running and responding to requests.

### Responsibilities

- Confirm API availability
- Return current API version
- Provide consistent response format for health monitoring tools

### What It Owns

| Owned                | Description                               |
| -------------------- | ----------------------------------------- |
| API version response | Returns hardcoded API version information |
| Health status        | Confirms the API is operational           |

### External Dependencies

| Dependency     | Type          | Purpose                          |
| -------------- | ------------- | -------------------------------- |
| ApiResponse    | Utility Class | Standardized response formatting |
| Laravel Router | Framework     | Request routing                  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/health
```

### Authentication

❌ **None Required** - Public endpoint for monitoring

### Rate Limiting

| Limiter         | Key        | Config                       |
| --------------- | ---------- | ---------------------------- |
| Default Laravel | IP address | 60 requests/minute (default) |

### Request Headers

| Header             | Required | Type               | Description                |
| ------------------ | -------- | ------------------ | -------------------------- |
| `Accept`           | ❌       | `application/json` | Response format (optional) |
| `X-Correlation-ID` | ❌       | `string (UUID)`    | Request tracing ID         |

### Request Body Schema

**No request body required** - This is a GET request with no parameters.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "API is working",
  "data": {
    "version": "1.0.0"
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Response Field Details

| Field                 | Type     | Description                                         |
| --------------------- | -------- | --------------------------------------------------- |
| `status`              | `string` | Always "success" for healthy API                    |
| `message`             | `string` | Human-readable status message                       |
| `data.version`        | `string` | Current API version (semantic versioning)           |
| `meta.timestamp`      | `string` | ISO 8601 timestamp of response generation           |
| `meta.correlation_id` | `string` | UUID for request tracing (from header or generated) |

### HTTP Status Codes

| Code  | Condition                                          |
| ----- | -------------------------------------------------- |
| `200` | API is healthy and responding                      |
| `429` | Rate limit exceeded (if default limiter is active) |
| `500` | Internal server error (API unhealthy)              |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/health                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api.php:18-20                                                  │
│                                                                             │
│ Route Definition (inline closure):                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::get('/health', function () {                                     │ │
│ │     return ApiResponse::success(['version' => '1.0.0'], 'API is working');│ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (inherited from api.php prefix):                           │
│   1. api (group)  → Basic API middleware (if defined in Kernel)             │
│                                                                             │
│ Note: This endpoint uses an inline closure instead of a controller          │
│       for minimal overhead and maximum simplicity.                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ Location: Inline closure in routes/api.php:18                               │
│                                                                             │
│ No FormRequest validation - endpoint has no input parameters.               │
│                                                                             │
│ The closure executes immediately after routing is resolved.                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ Location: Inline closure (no dedicated controller)                          │
│                                                                             │
│ STEP 1: Prepare Response Data                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $data = ['version' => '1.0.0'];                                         │ │
│ │ // Hardcoded version string                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build Response via ApiResponse Utility                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success($data, 'API is working');                   │ │
│ │                                                                         │ │
│ │ Internally calls:                                                       │ │
│ │   response()->json([                                                    │ │
│ │       'status' => 'success',                                            │ │
│ │       'message' => 'API is working',                                    │ │
│ │       'data' => ['version' => '1.0.0'],                                 │ │
│ │       'meta' => [                                                       │ │
│ │           'timestamp' => now()->toISOString(),                          │ │
│ │           'correlation_id' => $correlationId,                           │ │
│ │       ],                                                                │ │
│ │   ], 200);                                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ No service layer involvement - endpoint is self-contained.                  │
│                                                                             │
│ The ApiResponse utility class handles response construction directly.       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ApiResponse (Utility Class)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Ensures consistent response structure across all APIs    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message, $meta, $statusCode) → Success response     │ │
│ │   • error($message, $errors, $statusCode, $meta) → Error response       │ │
│ │   • getCorrelationId() → Request tracking UUID                          │ │
│ │                                                                         │ │
│ │ Response Envelope Structure:                                            │ │
│ │   • status: "success" | "error"                                         │ │
│ │   • message: Human-readable message                                     │ │
│ │   • data: Response payload (null for errors)                            │ │
│ │   • meta: Timestamp + correlation_id                                    │ │
│ │   • errors: (error responses only) Validation/error details             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Correlation ID Handling                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php:182-185                            │ │
│ │ Responsibility: Request tracing across distributed systems              │ │
│ │ Reusable: YES (embedded in ApiResponse)                                 │ │
│ │                                                                         │ │
│ │ Logic:                                                                  │ │
│ │ ┌───────────────────────────────────────────────────────────────────┐   │ │
│ │ │ private static function getCorrelationId(): string {              │   │ │
│ │ │     return request()->header('X-Correlation-ID')                  │   │ │
│ │ │         ?? Str::uuid()->toString();                               │   │ │
│ │ │ }                                                                 │   │ │
│ │ └───────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                         │ │
│ │ Behavior:                                                               │ │
│ │   1. Check for X-Correlation-ID header from client                      │ │
│ │   2. If present, use client-provided ID (for distributed tracing)       │ │
│ │   3. If absent, generate new UUID v4                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│   None - endpoint does not access the database                              │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - no caching involved                                                │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - no background jobs dispatched                                      │
│                                                                             │
│ EXTERNAL API CALLS:                                                         │
│   None - endpoint is self-contained                                         │
│                                                                             │
│ Note: This endpoint intentionally avoids database/cache checks to ensure    │
│       it responds even when backend services are degraded.                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ STEP 1: ApiResponse::success() builds the response                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php:15-30                              │ │
│ │                                                                         │ │
│ │ public static function success(                                         │ │
│ │     mixed $data = null,                                                 │ │
│ │     string $message = 'Success',                                        │ │
│ │     array $meta = [],                                                   │ │
│ │     int $statusCode = 200                                               │ │
│ │ ): JsonResponse {                                                       │ │
│ │     return response()->json([                                           │ │
│ │         'status' => 'success',                                          │ │
│ │         'message' => $message,                                          │ │
│ │         'data' => $data,                                                │ │
│ │         'meta' => array_merge($meta, [                                  │ │
│ │             'timestamp' => now()->toISOString(),                        │ │
│ │             'correlation_id' => self::getCorrelationId(),               │ │
│ │         ]),                                                             │ │
│ │     ], $statusCode);                                                    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Final JSON Structure:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "API is working",                                          │ │
│ │   "data": {                                                             │ │
│ │     "version": "1.0.0"                                                  │ │
│ │   },                                                                    │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "2026-02-04T02:54:24.000000Z",                         │ │
│ │     "correlation_id": "550e8400-e29b-41d4-a716-446655440000"            │ │
│ │   }                                                                     │ │
│ │ }                                                                       │ │
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

| File                             | Used By Endpoints | Reusable    | Reasoning                                      |
| -------------------------------- | ----------------- | ----------- | ---------------------------------------------- |
| `routes/api.php` (closure)       | `/health` only    | ❌ Single   | Inline closure, endpoint-specific              |
| `app/Http/Utils/ApiResponse.php` | All API endpoints | ✅ Reusable | Global response utility used across entire API |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                        |
| ----- | ------ | -------------------------------- |
| None  | N/A    | Endpoint has no input parameters |

### Business Logic Errors (400)

| Error | Source | Condition                      |
| ----- | ------ | ------------------------------ |
| None  | N/A    | Endpoint has no business logic |

### System Errors (500)

| Error                            | Source                    | Condition                            |
| -------------------------------- | ------------------------- | ------------------------------------ |
| Internal server error            | Laravel exception handler | Unhandled exception in route closure |
| Framework initialization failure | Laravel bootstrap         | Config/service provider errors       |

### Edge Cases

| Case                  | Behavior                                             |
| --------------------- | ---------------------------------------------------- |
| Database unavailable  | Endpoint responds successfully (no DB dependency)    |
| Redis unavailable     | Endpoint responds successfully (no cache dependency) |
| High load             | May hit rate limiter (429 response)                  |
| Invalid Accept header | Still returns JSON (Laravel default behavior)        |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                LARAVEL ROUTER          ROUTE CLOSURE           API RESPONSE
   │                       │                       │                       │
   │  GET /api/v1/health   │                       │                       │
   │──────────────────────▶│                       │                       │
   │                       │                       │                       │
   │                       │ 1. Match route        │                       │
   │                       │    prefix: v1         │                       │
   │                       │    path: /health      │                       │
   │                       │──────────────────────▶│                       │
   │                       │                       │                       │
   │                       │                       │ 2. Prepare data       │
   │                       │                       │    ['version'=>'1.0.0']│
   │                       │                       │                       │
   │                       │                       │ 3. Call ApiResponse   │
   │                       │                       │    ::success()        │
   │                       │                       │──────────────────────▶│
   │                       │                       │                       │
   │                       │                       │                       │ 4. Get correlation ID
   │                       │                       │                       │    (from header or generate)
   │                       │                       │                       │
   │                       │                       │                       │ 5. Get current timestamp
   │                       │                       │                       │    now()->toISOString()
   │                       │                       │                       │
   │                       │                       │                       │ 6. Build JSON response
   │                       │                       │◀──────────────────────│
   │                       │                       │                       │
   │                       │◀──────────────────────│                       │
   │◀──────────────────────│                       │                       │
   │                       │                       │                       │
   │  200 OK + JSON        │                       │                       │
   │                       │                       │                       │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| Database connectivity check | Expand closure or create HealthController                         |
| Redis connectivity check    | Expand closure or create HealthController                         |
| Queue health check          | Expand closure or create HealthController                         |
| Detailed component status   | Create dedicated `HealthController` with `DeepHealthCheck` method |
| Custom health metrics       | Create `app/Services/Infrastructure/HealthService.php`            |

### 📝 Field Modification Guide

#### ➕ ADDING VERSION DETAILS

**Example: Adding `build_number` and `environment` to response**

| Step  | File                   | What to Change               |
| ----- | ---------------------- | ---------------------------- |
| **1** | `routes/api.php:18-20` | Expand data array in closure |

**Detailed Code Change:**

```php
// BEFORE: routes/api.php:18-20
Route::get('/health', function () {
    return ApiResponse::success(['version' => '1.0.0'], 'API is working');
});

// AFTER: routes/api.php:18-23
Route::get('/health', function () {
    return ApiResponse::success([
        'version' => '1.0.0',
        'build_number' => config('app.build_number', 'unknown'),
        'environment' => config('app.env'),
    ], 'API is working');
});
```

#### ➕ ADDING DEEP HEALTH CHECK

**Example: Creating a comprehensive health endpoint with DB/Redis checks**

| Step  | File                                                              | What to Change                  |
| ----- | ----------------------------------------------------------------- | ------------------------------- |
| **1** | `app/Http/Controllers/Api/V1/Infrastructure/HealthController.php` | Create new controller           |
| **2** | `app/Services/Infrastructure/HealthService.php`                   | Create service with check logic |
| **3** | `routes/api.php`                                                  | Add new route for deep check    |

**Controller Example:**

```php
// app/Http/Controllers/Api/V1/Infrastructure/HealthController.php
class HealthController extends Controller
{
    public function __construct(
        private HealthService $healthService,
    ) {}

    public function check(): JsonResponse
    {
        return ApiResponse::success([
            'version' => '1.0.0',
        ], 'API is working');
    }

    public function deepCheck(): JsonResponse
    {
        $health = $this->healthService->checkAll();

        return ApiResponse::success($health, 'Health check complete');
    }
}
```

#### ✏️ MODIFYING VERSION NUMBER

| Step  | File                | What to Change        |
| ----- | ------------------- | --------------------- |
| **1** | `routes/api.php:19` | Update version string |

**Better Approach** - Centralize version in config:

```php
// config/app.php
'api_version' => env('API_VERSION', '1.0.0'),

// routes/api.php:18-20
Route::get('/health', function () {
    return ApiResponse::success([
        'version' => config('app.api_version'),
    ], 'API is working');
});
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GET /api/v1/health                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  Route Closure                                                              │
│       │                                                                     │
│       ▼                                                                     │
│  ApiResponse::success()        ← Builds response envelope                   │
│       │                                                                     │
│       ├──► data: ['version' => '1.0.0']        ← Hardcoded in closure       │
│       │                                                                     │
│       ├──► meta.timestamp                       ← now()->toISOString()      │
│       │                                                                     │
│       └──► meta.correlation_id                  ← Header or UUID            │
│                                                                     │
│                                                                             │
│  JSON Response                                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                    |
| --------------------------- | --------------------------------------------------------- |
| Response envelope structure | All clients expect consistent `status/message/data/meta`  |
| `correlation_id` logic      | Distributed tracing depends on this behavior              |
| HTTP status code (200)      | Monitoring tools expect 200 for healthy status            |
| Endpoint path `/health`     | External monitoring may be configured for this exact path |

### 🚨 Common Pitfalls

| Pitfall                           | Prevention                                            |
| --------------------------------- | ----------------------------------------------------- |
| Adding database check to /health  | Use separate `/health/deep` endpoint for heavy checks |
| Removing correlation_id           | Breaks distributed tracing - never remove             |
| Changing response structure       | All dashboards/monitors depend on exact format        |
| Adding authentication             | Health checks must be public for load balancers       |
| Heavy computation in health check | Keep /health lightweight for rapid response           |

### 📁 File Locations Quick Reference

```
routes/api.php:18-20                     ← Route definition (inline closure)
app/Http/Utils/ApiResponse.php           ← Response utility class
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                |
| ------------------- | -------------------- |
| **Endpoint**        | `GET /api/v1/health` |
| **Domain**          | Infrastructure       |
| **Author**          | System Documentation |
| **Created**         | 2026-02-04           |
| **Laravel Version** | 12.x                 |
| **PHP Version**     | 8.4+                 |
