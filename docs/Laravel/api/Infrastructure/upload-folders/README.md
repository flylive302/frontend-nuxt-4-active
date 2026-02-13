# GET /api/v1/uploads/folders

> **Domain**: Infrastructure  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Returns the list of allowed upload folders for client-side file uploads to ImageKit CDN, enabling clients to validate folder selections before requesting upload authentication.

### Responsibilities

- Provide the complete list of allowed upload folders
- Enable client-side validation before requesting auth params
- Serve as a single source of truth for valid upload destinations

### What It Owns

| Owned           | Description                                          |
| --------------- | ---------------------------------------------------- |
| Folder metadata | Exposes allowed folder list from ImageKitAuthService |

### External Dependencies

| Dependency | Type           | Purpose                          |
| ---------- | -------------- | -------------------------------- |
| Redis      | Infrastructure | Session storage for Sanctum auth |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/uploads/folders
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key | Config                        |
| ------- | --- | ----------------------------- |
| None    | N/A | Uses default Laravel throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
None - This is a GET request with no body
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Allowed folders retrieved",
  "data": {
    "folders": [
      "avatars",
      "rooms",
      "agencies/logos",
      "agencies/national-ids",
      "coin-request-proofs"
    ]
  },
  "meta": {
    "timestamp": "2026-02-02T03:43:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Folders list retrieved successfully     |
| `401` | Missing or invalid authentication token |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/uploads/folders                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/uploads.php:26                                             │
│ Route: Route::get('/folders', [UploadController::class, 'folders'])         │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets $request->user()          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->prefix('uploads')->group(...);     │ │
│ │ Route::get('/folders', [UploadController::class, 'folders'])            │ │
│ │     ->name('uploads.folders');                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ NO FORM REQUEST - Direct controller method invocation                       │
│                                                                             │
│ This endpoint has no request body and no validation requirements.           │
│ The auth:sanctum middleware handles authentication before the controller.   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Infrastructure/UploadController.php:69-74 │
│ Method: folders(): JsonResponse                                             │
│                                                                             │
│ Constructor Injection:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function __construct(                                            │ │
│ │     private ImageKitAuthService $authService                            │ │
│ │ ) {}                                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 1: Delegate to service and return response                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function folders(): JsonResponse                                 │ │
│ │ {                                                                       │ │
│ │     return ApiResponse::success([                                       │ │
│ │         'folders' => $this->authService->getAllowedFolders(),           │ │
│ │     ], 'Allowed folders retrieved');                                    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Infrastructure/ImageKitAuthService.php:112-115           │
│ Method: getAllowedFolders(): array<string>                                  │
│                                                                             │
│ STEP 1: Return static constant array                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ private const ALLOWED_FOLDERS = [                                       │ │
│ │     'avatars',                                                          │ │
│ │     'rooms',                                                            │ │
│ │     'agencies/logos',                                                   │ │
│ │     'agencies/national-ids',                                            │ │
│ │     'coin-request-proofs',                                              │ │
│ │ ];                                                                      │ │
│ │                                                                         │ │
│ │ public function getAllowedFolders(): array                              │ │
│ │ {                                                                       │ │
│ │     return self::ALLOWED_FOLDERS;                                       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: This is a simple getter returning a static constant.                  │
│       No database queries, no external calls, no computation.               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ImageKitAuthService (Domain Service)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Infrastructure/ImageKitAuthService.php               │ │
│ │ Responsibility: Centralized ImageKit operations and folder management   │ │
│ │ Reusable: YES (used by auth-params and folders endpoints)               │ │
│ │ Why It Exists: Single source of truth for allowed upload destinations   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getAllowedFolders() → returns array of allowed folder strings       │ │
│ │   • isFolderAllowed($folder) → checks if folder is in allowed list     │ │
│ │   • getAuthParams($folder, $expire) → generates upload auth tokens     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Response Utility)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Consistent API response structure across entire app      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success($data, $message) → 200 with standard wrapper                │ │
│ │   • error($message, $errors, $code) → Error with details                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS: None                                                   │
│   This endpoint returns a hardcoded constant - no database access.          │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│   Static data requires no caching.                                          │
│                                                                             │
│ EXTERNAL SERVICE CALLS: None                                                │
│   No external APIs or services are called.                                  │
│                                                                             │
│ LOGGING: None                                                               │
│   This simple getter does not log any information.                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Response built via ApiResponse::success() utility:                          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'folders' => $this->authService->getAllowedFolders(),               │ │
│ │ ], 'Allowed folders retrieved');                                        │ │
│ │                                                                         │ │
│ │ // Internal structure of ApiResponse::success():                        │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Allowed folders retrieved',                           │ │
│ │     'data' => [                                                         │ │
│ │         'folders' => ['avatars', 'rooms', ...]                          │ │
│ │     ],                                                                  │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => request()->header('X-Correlation-ID')       │ │
│ │             ?? Str::uuid()->toString(),                                 │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
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

| File                      | Used By Endpoints                    | Reusable | Reasoning                                       |
| ------------------------- | ------------------------------------ | -------- | ----------------------------------------------- |
| `UploadController.php`    | `auth-params`, `folders`             | ⭕       | Contains multiple upload-related methods        |
| `ImageKitAuthService.php` | `auth-params`, `folders`, validation | ✅       | Shared service for all ImageKit operations      |
| `ApiResponse.php`         | All API endpoints                    | ✅       | Standardized response utility across entire app |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error | Source | Condition                                  |
| ----- | ------ | ------------------------------------------ |
| None  | N/A    | No validation - this endpoint has no input |

### Business Logic Errors (400)

| Error | Source | Condition                         |
| ----- | ------ | --------------------------------- |
| None  | N/A    | No business logic errors possible |

### Authentication Errors (401)

| Error             | Source         | Condition                       |
| ----------------- | -------------- | ------------------------------- |
| `Unauthenticated` | `auth:sanctum` | Missing or invalid Bearer token |

### System Errors (500)

| Error | Source | Condition                              |
| ----- | ------ | -------------------------------------- |
| None  | N/A    | Static data return - no failure points |

### Edge Cases

| Case                    | Behavior                                            |
| ----------------------- | --------------------------------------------------- |
| Empty folder list       | Returns empty array (if ALLOWED_FOLDERS is emptied) |
| Concurrent requests     | Safe - returns same static data                     |
| Unauthenticated request | Returns 401 before reaching controller              |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                   MIDDLEWARE              CONTROLLER             SERVICE
   │                          │                       │                      │
   │ GET /uploads/folders     │                       │                      │
   │ + Bearer token           │                       │                      │
   │─────────────────────────▶│                       │                      │
   │                          │                       │                      │
   │                          │ 1. auth:sanctum       │                      │
   │                          │    validate token     │                      │
   │                          │────────┐              │                      │
   │                          │        │              │                      │
   │                          │◀───────┘              │                      │
   │                          │                       │                      │
   │                          │ 2. Pass to controller │                      │
   │                          │──────────────────────▶│                      │
   │                          │                       │                      │
   │                          │                       │ 3. folders()         │
   │                          │                       │    called            │
   │                          │                       │────────┐             │
   │                          │                       │        │             │
   │                          │                       │◀───────┘             │
   │                          │                       │                      │
   │                          │                       │ 4. getAllowedFolders()
   │                          │                       │──────────────────────▶│
   │                          │                       │                      │
   │                          │                       │                      │ 5. Return static
   │                          │                       │                      │    ALLOWED_FOLDERS
   │                          │                       │                      │────────┐
   │                          │                       │                      │        │
   │                          │                       │                      │◀───────┘
   │                          │                       │                      │
   │                          │                       │ 6. Return array      │
   │                          │                       │◀─────────────────────│
   │                          │                       │                      │
   │                          │                       │ 7. ApiResponse       │
   │                          │                       │    ::success()       │
   │                          │◀──────────────────────│                      │
   │                          │                       │                      │
   │◀─────────────────────────│                       │                      │
   │                          │                       │                      │
   │  200 OK + {              │                       │                      │
   │    folders: [...]        │                       │                      │
   │  }                       │                       │                      │
   │                          │                       │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                                 | Location                                                      |
| ---------------------------------------- | ------------------------------------------------------------- |
| New allowed folder                       | `ImageKitAuthService::ALLOWED_FOLDERS` constant               |
| Rate limiting                            | `routes/api/uploads.php` - add `->middleware('throttle:...')` |
| Folder metadata (e.g., max size)         | Create new method in `ImageKitAuthService`                    |
| Caching (if folder list becomes dynamic) | Add cache layer in service method                             |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FOLDER

| Step  | File                                                      | What to Change                           |
| ----- | --------------------------------------------------------- | ---------------------------------------- |
| **1** | `app/Services/Infrastructure/ImageKitAuthService.php`     | Add folder to `ALLOWED_FOLDERS` const    |
| **2** | `app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php` | Add to `Rule::in([...])` for auth-params |
| **3** | Update API documentation                                  | Document the new folder option           |

#### ➖ REMOVING A FOLDER

| Step  | File                                                      | What to Change                     |
| ----- | --------------------------------------------------------- | ---------------------------------- |
| **1** | Check client usage                                        | Ensure no client depends on folder |
| **2** | `app/Services/Infrastructure/ImageKitAuthService.php`     | Remove from `ALLOWED_FOLDERS`      |
| **3** | `app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php` | Remove from `Rule::in([...])`      |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FOLDERS DATA FLOW (SIMPLE)                               │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  ┌─────────────────────┐      ┌─────────────────────┐                       │
│  │ ImageKitAuthService │ ───▶ │ Controller          │                       │
│  │ ALLOWED_FOLDERS     │      │ wraps in data key   │                       │
│  │ (static constant)   │      │                     │                       │
│  └─────────────────────┘      └─────────────────────┘                       │
│                                        │                                    │
│                                        ▼                                    │
│                               ┌─────────────────────┐                       │
│                               │ ApiResponse         │                       │
│                               │ ::success()         │                       │
│                               │ adds meta/timestamp │                       │
│                               └─────────────────────┘                       │
│                                        │                                    │
│                                        ▼                                    │
│                               ┌─────────────────────┐                       │
│                               │ JSON Response       │                       │
│                               │ {folders: [...]}   │                       │
│                               └─────────────────────┘                       │
│                                                                             │
│  NOTE: Single source of truth in ALLOWED_FOLDERS constant                   │
│        Used by both /folders and /auth-params endpoints                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| `ALLOWED_FOLDERS` list      | Security boundary - adding folders expands upload attack surface |
| Response structure          | Clients depend on `data.folders` array format                    |
| `auth:sanctum` middleware   | Removing exposes folder list to unauthenticated users            |
| Controller method signature | Breaking change for route binding                                |

### 🚨 Common Pitfalls

| Pitfall                                              | Prevention                                             |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Adding folder here but not in auth-params validation | Always sync with `GetUploadAuthParamsRequest::rules()` |
| Removing folder without checking mobile clients      | Search codebase and mobile apps for folder references  |
| Making folder list dynamic from DB                   | Would require caching strategy and migration           |
| Caching this endpoint                                | Not needed - static data, ~0ms response time           |
| Adding rate limiting without reason                  | This endpoint is cheap; rate limiting adds overhead    |

### 📁 File Locations Quick Reference

```
routes/api/uploads.php                                   ← Route definition (line 26)
app/Http/Controllers/Api/V1/Infrastructure/
  └── UploadController.php                               ← Controller (lines 69-74)
app/Services/Infrastructure/
  └── ImageKitAuthService.php                            ← Service with ALLOWED_FOLDERS
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
```

---

## Document Metadata

| Property            | Value                         |
| ------------------- | ----------------------------- |
| **Endpoint**        | `GET /api/v1/uploads/folders` |
| **Domain**          | Infrastructure                |
| **Author**          | System Documentation          |
| **Created**         | 2026-02-02                    |
| **Laravel Version** | 12.x                          |
| **PHP Version**     | 8.4                           |
