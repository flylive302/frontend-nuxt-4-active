# POST /api/v1/uploads/auth-params

> **Domain**: Infrastructure  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Generates secure authentication parameters for client-side file uploads directly to ImageKit CDN, eliminating CORS issues and server-side upload bottlenecks.

### Responsibilities

- Validate requested upload folder against allowed list
- Generate signed authentication tokens with configurable expiration
- Return all parameters needed for client-side ImageKit upload

### What It Owns

| Owned                | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| Auth token generation| Creates signed tokens for secure client-side uploads            |
| Folder validation    | Ensures uploads only go to whitelisted folders                  |

### External Dependencies

| Dependency | Type           | Purpose                              |
| ---------- | -------------- | ------------------------------------ |
| ImageKit   | Package/CDN    | SDK for generating auth signatures   |
| Redis      | Infrastructure | Session storage for Sanctum auth     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/uploads/auth-params
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter    | Key       | Config                       |
| ---------- | --------- | ---------------------------- |
| `throttle` | User IP   | 10 requests per minute       |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "folder": "string",           // Required: one of allowed folders
  "expire_seconds": "integer"   // Optional: token expiry (60-3600), default 600
}
```

#### Field Details

| Field            | Type      | Constraints                                                 | Example               |
| ---------------- | --------- | ----------------------------------------------------------- | --------------------- |
| `folder`         | `string`  | Required, must be one of: `avatars`, `rooms`, `agencies/logos`, `agencies/national-ids`, `coin-request-proofs` | `"avatars"`           |
| `expire_seconds` | `integer` | Optional, min:60, max:3600, default:600                     | `600`                 |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Upload authentication parameters generated",
  "data": {
    "token": "random-uuid-token",
    "signature": "hmac-sha1-signature",
    "expire": 1738456800,
    "publicKey": "public_key_from_env",
    "folder": "avatars",
    "urlEndpoint": "https://ik.imagekit.io/flylive"
  },
  "meta": {
    "timestamp": "2026-02-02T03:40:00.000000Z",
    "correlation_id": "uuid"
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
    "folder": ["Invalid upload folder. Allowed: avatars, rooms, agencies/logos, agencies/national-ids, coin-request-proofs."]
  },
  "meta": {
    "timestamp": "2026-02-02T03:40:00.000000Z",
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

#### ❌ Rate Limit Exceeded (429)

```json
{
  "status": "error",
  "message": "Too Many Attempts.",
  "data": null
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to generate upload authentication",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T03:40:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Auth params generated successfully                  |
| `401` | Missing or invalid authentication token             |
| `422` | Validation failed (invalid folder, expire range)    |
| `429` | Rate limit exceeded (>10 requests per minute)       |
| `500` | ImageKit SDK failure or missing configuration       |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/uploads/auth-params                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/uploads.php:20                                             │
│ Route: Route::post('/auth-params', [UploadController::class, 'authParams']) │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets $request->user()          │
│   2. throttle:10,1 → Rate limits to 10 requests per minute                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum'])->prefix('uploads')->group(...);     │ │
│ │ Route::post('/auth-params', [UploadController::class, 'authParams'])    │ │
│ │     ->name('uploads.auth-params')                                       │ │
│ │     ->middleware('throttle:10,1');                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php               │
│                                                                             │
│ Authorization Check:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'folder' => [                                                   │ │
│ │             'required',                                                 │ │
│ │             'string',                                                   │ │
│ │             Rule::in([                                                  │ │
│ │                 'avatars', 'rooms', 'agencies/logos',                   │ │
│ │                 'agencies/national-ids', 'coin-request-proofs',         │ │
│ │             ]),                                                         │ │
│ │         ],                                                              │ │
│ │         'expire_seconds' => ['nullable', 'integer', 'min:60', 'max:3600'] │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Custom Error Messages:                                                      │
│   • folder.required → "Upload folder is required."                          │
│   • folder.in → "Invalid upload folder. Allowed: avatars,...               │
│   • expire_seconds.min → "Expiration must be at least 60 seconds."          │
│   • expire_seconds.max → "Expiration cannot exceed 3600 seconds (1 hour)."  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Infrastructure/UploadController.php       │
│ Method: authParams(GetUploadAuthParamsRequest $request): JsonResponse       │
│                                                                             │
│ Constructor Injection:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function __construct(                                            │ │
│ │     private ImageKitAuthService $authService                            │ │
│ │ ) {}                                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 1: Extract validated input                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to service with error handling                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     $authParams = $this->authService->getAuthParams(                    │ │
│ │         folder: $validated['folder'],                                   │ │
│ │         expireSeconds: $validated['expire_seconds'] ?? 600              │ │
│ │     );                                                                  │ │
│ │     return ApiResponse::success($authParams, 'Upload auth params...');  │ │
│ │ } catch (\InvalidArgumentException $e) {                                │ │
│ │     return ApiResponse::error($e->getMessage(), [...], 422);            │ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     return ApiResponse::serverError('Failed to generate upload...');    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Infrastructure/ImageKitAuthService.php                   │
│ Method: getAuthParams(string $folder, int $expireSeconds = 600)             │
│                                                                             │
│ STEP 1: Validate folder against allowed list (defense in depth)             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ private const ALLOWED_FOLDERS = [                                       │ │
│ │     'avatars', 'rooms', 'agencies/logos',                               │ │
│ │     'agencies/national-ids', 'coin-request-proofs',                     │ │
│ │ ];                                                                      │ │
│ │                                                                         │ │
│ │ if (!in_array($folder, self::ALLOWED_FOLDERS, true)) {                  │ │
│ │     throw new \InvalidArgumentException("Folder '{$folder}'...");       │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Initialize ImageKit SDK                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ private function getImageKit(): \ImageKit\ImageKit                      │ │
│ │ {                                                                       │ │
│ │     $publicKey = config('imagekit.public_key');                         │ │
│ │     $privateKey = config('imagekit.private_key');                       │ │
│ │     $urlEndpoint = config('imagekit.url_endpoint');                     │ │
│ │     // Validates all config present, throws Exception if not            │ │
│ │     return new \ImageKit\ImageKit($publicKey, $privateKey, $urlEndpoint);│
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Generate signed authentication parameters                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $expireTimestamp = time() + $expireSeconds;                             │ │
│ │ $authParams = $imageKit->getAuthenticationParameters('', $expireTimestamp);│
│ │                                                                         │ │
│ │ Log::info('ImageKit auth params generated', [                           │ │
│ │     'folder' => $folder,                                                │ │
│ │     'expire_seconds' => $expireSeconds,                                 │ │
│ │     'expire_timestamp' => $expireTimestamp,                             │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return structured response array                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'token' => $authParams->token,                                      │ │
│ │     'signature' => $authParams->signature,                              │ │
│ │     'expire' => $authParams->expire,                                    │ │
│ │     'publicKey' => (string) config('imagekit.public_key'),              │ │
│ │     'folder' => $folder,                                                │ │
│ │     'urlEndpoint' => (string) config('imagekit.url_endpoint'),          │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: ImageKit SDK (External Package)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Package: imagekit/imagekit                                              │ │
│ │ Responsibility: Generate signed upload authentication tokens            │ │
│ │ Reusable: YES (standard SDK, used across all upload scenarios)          │ │
│ │ Why It Exists: Industry standard for secure client-side CDN uploads     │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • getAuthenticationParameters($token, $expire) → generates HMAC-SHA1  │ │
│ │     signed token/signature pair for secure uploads                      │ │
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
│ │   • serverError($message) → 500 with generic message                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: GetUploadAuthParamsRequest (Form Request)                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php           │ │
│ │ Responsibility: Validate input before controller executes               │ │
│ │ Reusable: NO (specific to this endpoint)                                │ │
│ │ Why It Exists: Laravel best practice for validation separation          │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • authorize() → Ensures user is authenticated                         │ │
│ │   • rules() → Validates folder enum and expire_seconds range            │ │
│ │   • messages() → Custom error messages for better UX                    │ │
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
│   This endpoint does not access the database.                               │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│   Authentication tokens are generated fresh each request.                   │
│                                                                             │
│ EXTERNAL SERVICE CALLS:                                                     │
│                                                                             │
│ 1. ImageKit SDK (Local Computation):                                        │
│    Operation: getAuthenticationParameters()                                 │
│    Type: HMAC-SHA1 cryptographic signature generation                       │
│    Note: This is purely local computation, no network call involved         │
│                                                                             │
│ LOGGING:                                                                    │
│                                                                             │
│ 1. WRITE: Log::info('ImageKit auth params generated')                       │
│    Data: folder, expire_seconds, expire_timestamp                           │
│    Source: ImageKitAuthService::getAuthParams()                             │
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
│ │ return ApiResponse::success(                                            │ │
│ │     $authParams,  // Array from ImageKitAuthService                     │ │
│ │     'Upload authentication parameters generated'                        │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // Internal structure of ApiResponse::success():                        │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => $message,                                              │ │
│ │     'data' => $data,      // The auth params array                      │ │
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

| File                                          | Used By Endpoints              | Reusable | Reasoning                                           |
| --------------------------------------------- | ------------------------------ | -------- | --------------------------------------------------- |
| `GetUploadAuthParamsRequest.php`              | This endpoint only             | ❌       | Validation specific to auth-params request          |
| `UploadController.php`                        | `auth-params`, `folders`       | ⭕       | Contains multiple upload-related methods            |
| `ImageKitAuthService.php`                     | `auth-params`, `folders`, other| ✅       | Shared service for all ImageKit operations          |
| `ApiResponse.php`                             | All API endpoints              | ✅       | Standardized response utility across entire app     |
| `config/imagekit.php`                         | All ImageKit operations        | ✅       | Centralized configuration for CDN integration       |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                       | Source                        | Condition                                    |
| --------------------------- | ----------------------------- | -------------------------------------------- |
| `folder.required`           | `GetUploadAuthParamsRequest`  | Missing folder field in request              |
| `folder.in`                 | `GetUploadAuthParamsRequest`  | Folder not in allowed list                   |
| `expire_seconds.min`        | `GetUploadAuthParamsRequest`  | expire_seconds < 60                          |
| `expire_seconds.max`        | `GetUploadAuthParamsRequest`  | expire_seconds > 3600                        |
| Invalid folder (service)    | `ImageKitAuthService`         | Folder bypassed validation somehow           |

### Authentication Errors (401)

| Error              | Source            | Condition                         |
| ------------------ | ----------------- | --------------------------------- |
| `Unauthenticated`  | `auth:sanctum`    | Missing or invalid Bearer token   |

### Rate Limit Errors (429)

| Error               | Source          | Condition                                |
| ------------------- | --------------- | ---------------------------------------- |
| `Too Many Attempts` | `throttle:10,1` | More than 10 requests in 1 minute        |

### System Errors (500)

| Error                                      | Source               | Condition                           |
| ------------------------------------------ | -------------------- | ----------------------------------- |
| "ImageKit configuration is incomplete"     | `ImageKitAuthService`| Missing env vars                    |
| "Failed to generate upload authentication" | `UploadController`   | Any unhandled exception in service  |

### Edge Cases

| Case                                    | Behavior                                                      |
| --------------------------------------- | ------------------------------------------------------------- |
| Empty `expire_seconds`                  | Defaults to 600 seconds (10 minutes)                          |
| `expire_seconds = null`                 | Treated as empty, defaults to 600                             |
| Folder with slashes (e.g., `agencies/logos`) | Handled correctly, allowed folders include nested paths   |
| Missing ImageKit env vars               | Returns 500 with generic error message                        |
| Token used after expiry                 | Client-side ImageKit upload will fail (not server-controlled) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                   MIDDLEWARE              CONTROLLER             SERVICE               IMAGEKIT SDK
   │                          │                       │                      │                      │
   │ POST /auth-params        │                       │                      │                      │
   │ + Bearer token           │                       │                      │                      │
   │ + {folder, expire}       │                       │                      │                      │
   │─────────────────────────▶│                       │                      │                      │
   │                          │                       │                      │                      │
   │                          │ 1. auth:sanctum       │                      │                      │
   │                          │    validate token     │                      │                      │
   │                          │────────┐              │                      │                      │
   │                          │        │              │                      │                      │
   │                          │◀───────┘              │                      │                      │
   │                          │                       │                      │                      │
   │                          │ 2. throttle:10,1      │                      │                      │
   │                          │    check rate limit   │                      │                      │
   │                          │────────┐              │                      │                      │
   │                          │        │              │                      │                      │
   │                          │◀───────┘              │                      │                      │
   │                          │                       │                      │                      │
   │                          │ 3. Request validation │                      │                      │
   │                          │    (FormRequest)      │                      │                      │
   │                          │──────────────────────▶│                      │                      │
   │                          │                       │                      │                      │
   │                          │                       │ 4. authParams()      │                      │
   │                          │                       │    extract validated │                      │
   │                          │                       │────────┐             │                      │
   │                          │                       │        │             │                      │
   │                          │                       │◀───────┘             │                      │
   │                          │                       │                      │                      │
   │                          │                       │ 5. getAuthParams()   │                      │
   │                          │                       │──────────────────────▶│                      │
   │                          │                       │                      │                      │
   │                          │                       │                      │ 6. validate folder   │
   │                          │                       │                      │────────┐             │
   │                          │                       │                      │        │             │
   │                          │                       │                      │◀───────┘             │
   │                          │                       │                      │                      │
   │                          │                       │                      │ 7. getAuthParams()   │
   │                          │                       │                      │─────────────────────▶│
   │                          │                       │                      │                      │
   │                          │                       │                      │ 8. HMAC-SHA1 sign    │
   │                          │                       │                      │◀─────────────────────│
   │                          │                       │                      │                      │
   │                          │                       │                      │ 9. Log::info()       │
   │                          │                       │                      │────────┐             │
   │                          │                       │                      │        │             │
   │                          │                       │                      │◀───────┘             │
   │                          │                       │                      │                      │
   │                          │                       │ 10. Return params    │                      │
   │                          │                       │◀─────────────────────│                      │
   │                          │                       │                      │                      │
   │                          │                       │ 11. ApiResponse      │                      │
   │                          │                       │     ::success()      │                      │
   │                          │◀──────────────────────│                      │                      │
   │                          │                       │                      │                      │
   │◀─────────────────────────│                       │                      │                      │
   │                          │                       │                      │                      │
   │  200 OK + {token,        │                       │                      │                      │
   │    signature, expire,    │                       │                      │                      │
   │    publicKey, folder,    │                       │                      │                      │
   │    urlEndpoint}          │                       │                      │                      │
   │                          │                       │                      │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                                  |
| --------------------------- | --------------------------------------------------------- |
| New allowed folder          | `ImageKitAuthService::ALLOWED_FOLDERS` + `GetUploadAuthParamsRequest::rules()` |
| New response field          | `ImageKitAuthService::getAuthParams()` return array       |
| New request parameter       | `GetUploadAuthParamsRequest::rules()`                     |
| Rate limit change           | `routes/api/uploads.php` middleware                       |
| Upload size restrictions    | Client-side or ImageKit dashboard (not this endpoint)     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW ALLOWED FOLDER

| Step  | File                                              | What to Change                                    |
| ----- | ------------------------------------------------- | ------------------------------------------------- |
| **1** | `app/Services/Infrastructure/ImageKitAuthService.php` | Add folder to `ALLOWED_FOLDERS` const         |
| **2** | `app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php` | Add folder to `Rule::in([...])` array     |
| **3** | `config/imagekit.php`                             | Add to `allowed_folders` array (for reference)    |

#### ➕ ADDING A NEW REQUEST FIELD

| Step  | File                                              | What to Change                                    |
| ----- | ------------------------------------------------- | ------------------------------------------------- |
| **1** | `app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php` | Add validation rule in `rules()`          |
| **2** | `app/Http/Controllers/Api/V1/Infrastructure/UploadController.php` | Pass to service call               |
| **3** | `app/Services/Infrastructure/ImageKitAuthService.php` | Accept parameter in `getAuthParams()`         |

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                              | What to Change                                    |
| ----- | ------------------------------------------------- | ------------------------------------------------- |
| **1** | `app/Services/Infrastructure/ImageKitAuthService.php` | Add to return array in `getAuthParams()`      |
| **2** | PHPDoc                                            | Update `@return` type hint                        |

#### ➖ REMOVING A FOLDER

| Step  | File                                              | What to Change                                    |
| ----- | ------------------------------------------------- | ------------------------------------------------- |
| **1** | Check usages                                      | Ensure no client depends on the folder            |
| **2** | `app/Services/Infrastructure/ImageKitAuthService.php` | Remove from `ALLOWED_FOLDERS`                 |
| **3** | `app/Http/Requests/Api/V1/GetUploadAuthParamsRequest.php` | Remove from `Rule::in([...])`             |
| **4** | `config/imagekit.php`                             | Remove from `allowed_folders`                     |

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FOLDER FIELD FLOW                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐         │
│  │ Request JSON   │ ───▶ │ FormRequest    │ ───▶ │ Controller     │         │
│  │ {folder: "x"}  │      │ Rule::in([...])│      │ $validated[]   │         │
│  └────────────────┘      └────────────────┘      └────────────────┘         │
│                                                          │                  │
│                                                          ▼                  │
│                                                  ┌────────────────┐         │
│                                                  │ Service        │         │
│                                                  │ ALLOWED_FOLDERS│         │
│                                                  │ (defense depth)│         │
│                                                  └────────────────┘         │
│                                                          │                  │
│                                                          ▼                  │
│                                                  ┌────────────────┐         │
│                                                  │ Response       │         │
│                                                  │ {folder: "x"}  │         │
│                                                  └────────────────┘         │
│                                                                             │
│  NOTE: Folder is validated TWICE (FormRequest + Service) for security      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| `ALLOWED_FOLDERS` list           | Security boundary - limits where files can be uploaded      |
| ImageKit SDK initialization      | Breaking changes affect all uploads across the app          |
| Token expiration calculation     | `time() + $expireSeconds` is ImageKit-specific format       |
| `auth:sanctum` middleware        | Removing breaks authentication for this and other endpoints |
| `throttle:10,1` rate limit       | Prevents abuse; lowering may expose to DoS attacks          |

### 🚨 Common Pitfalls

| Pitfall                                              | Prevention                                                |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Adding folder to FormRequest but not Service         | Always update BOTH `Rule::in([])` AND `ALLOWED_FOLDERS`   |
| Removing folder without checking client usage        | Search codebase and mobile apps for folder references     |
| Setting expire_seconds too high                      | Max is 3600 (1 hour) - enforced by validation             |
| Expecting database access                            | This endpoint is stateless - no DB queries                |
| Caching auth params                                  | Never cache - tokens are time-sensitive and user-specific |
| Testing without ImageKit env vars                    | Will return 500; ensure `.env` has all IMAGEKIT_* vars    |

### 📁 File Locations Quick Reference

```
routes/api/uploads.php                                   ← Route definition
app/Http/Controllers/Api/V1/Infrastructure/
  └── UploadController.php                               ← Controller
app/Http/Requests/Api/V1/
  └── GetUploadAuthParamsRequest.php                     ← Request validation
app/Services/Infrastructure/
  └── ImageKitAuthService.php                            ← Business logic
app/Http/Utils/
  └── ApiResponse.php                                    ← Response utility
config/
  └── imagekit.php                                       ← ImageKit configuration
```

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `POST /api/v1/uploads/auth-params` |
| **Domain**          | Infrastructure                     |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-02                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4                                |
