# POST /api/v1/internal/auth/validate

> **Domain**: Internal / Auth  
> **Type**: Internal Endpoint (MSAB Only)  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Validates a Sanctum authentication token and returns the user's lightweight profile for MSAB socket authentication.

### Responsibilities

- Authenticate user via Sanctum bearer token
- Return minimal user data for socket session initialization
- Enable MSAB to verify user identity before establishing WebSocket connection

### What It Owns

| Owned            | Description                               |
| ---------------- | ----------------------------------------- |
| Token Validation | Delegates to Sanctum middleware           |
| User Response    | Returns `MinimalUserResource` (12 fields) |

### External Dependencies

| Dependency      | Type           | Purpose                    |
| --------------- | -------------- | -------------------------- |
| Laravel Sanctum | Package        | Token-based authentication |
| Redis           | Infrastructure | Rate limiter storage       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/internal/auth/validate
```

### Authentication

✅ **Required** - Bearer token via `Authorization` header (Sanctum) + Internal API key

### Rate Limiting

| Limiter        | Key                         | Config                               |
| -------------- | --------------------------- | ------------------------------------ |
| `internal_api` | `internal:{X-Internal-Key}` | 1000 requests/minute per service key |

### Request Headers

| Header           | Required | Type               | Description               |
| ---------------- | -------- | ------------------ | ------------------------- |
| `Content-Type`   | ✅       | `application/json` | Request body format       |
| `Accept`         | ✅       | `application/json` | Response format           |
| `Authorization`  | ✅       | `Bearer {token}`   | Sanctum user token        |
| `X-Internal-Key` | ✅       | `string`           | MSAB internal service key |

### Request Body Schema

```json
{}
```

No request body required - authentication is via headers only.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "id": 123,
  "name": "John Doe",
  "signature": "FLY-ABC123",
  "avatar": "https://cdn.example.com/avatars/123.jpg",
  "frame": "gold_vip",
  "gender": 1,
  "email": "john@example.com",
  "phone": "+1234567890",
  "country": "US",
  "date_of_birth": "1990-01-15",
  "wealth_xp": "15000",
  "charm_xp": "8500"
}
```

#### ❌ Unauthenticated (401)

```json
{
  "message": "Unauthenticated."
}
```

#### ❌ Invalid Internal Key (403)

```json
{
  "message": "Unauthorized. Invalid internal key.",
  "error_code": "INTERNAL_AUTH_FAILED"
}
```

#### ❌ Rate Limited (429)

```json
{
  "message": "Too Many Attempts."
}
```

### HTTP Status Codes

| Code  | Condition                       |
| ----- | ------------------------------- |
| `200` | Token valid, user data returned |
| `401` | Invalid/expired Sanctum token   |
| `403` | Invalid X-Internal-Key header   |
| `429` | Rate limit exceeded             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/internal/auth/validate                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/internal.php:20-21                                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::post('/auth/validate', [AuthController::class, 'validateToken']) │ │
│ │     ->middleware('auth:sanctum');                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. InternalAuth        → Validates X-Internal-Key header                  │
│   2. throttle:internal_api → 1000 req/min per service key                   │
│   3. auth:sanctum        → Validates Bearer token, attaches user            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 INTERNAL AUTH MIDDLEWARE                                                │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/InternalAuth.php:16-29                            │
│                                                                             │
│ Validates X-Internal-Key against configured secret:                         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $internalKey = $request->header('X-Internal-Key');                      │ │
│ │ $expectedKey = config('services.msab.internal_key');                    │ │
│ │                                                                         │ │
│ │ if (! hash_equals($expectedKey, $internalKey)) {                        │ │
│ │     return response()->json([                                           │ │
│ │         'message' => 'Unauthorized. Invalid internal key.',             │ │
│ │         'error_code' => 'INTERNAL_AUTH_FAILED',                         │ │
│ │     ], 403);                                                            │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 RATE LIMITER                                                            │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Providers/AppServiceProvider.php:210-214                          │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ RateLimiter::for('internal_api', function (Request $request) {          │ │
│ │     $internalKey = $request->header('X-Internal-Key', 'unknown');       │ │
│ │     return Limit::perMinute(1000)->by("internal:{$internalKey}");       │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SANCTUM AUTHENTICATION                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ Sanctum's built-in middleware validates Bearer token and attaches           │
│ the authenticated User model to $request->user().                           │
│                                                                             │
│ If token is invalid/expired → Returns 401 Unauthenticated                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Internal/AuthController.php:15-26                │
│ Method: validateToken(Request $request)                                     │
│                                                                             │
│ STEP 1: Get authenticated user from request                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return response()->json(['message' => 'Unauthenticated.'], 401);    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Return MinimalUserResource                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json(new MinimalUserResource($user));                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/User/MinimalUserResource.php:27-43              │
│                                                                             │
│ COMPONENT: MinimalUserResource (API Resource)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Responsibility: Transform User model to minimal JSON payload            │ │
│ │ Reusable: YES (used across multiple endpoints)                          │ │
│ │ Fields Returned: 12                                                     │ │
│ │                                                                         │ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'signature' => $this->signature,                                    │ │
│ │     'avatar' => $this->avatar,                                          │ │
│ │     'frame' => $this->whenHas('frame'),                                 │ │
│ │     'gender' => $this->gender,                                          │ │
│ │     'email' => $this->email,                                            │ │
│ │     'phone' => $this->phone,                                            │ │
│ │     'country' => $this->country,                                        │ │
│ │     'date_of_birth' => $this->date_of_birth?->toDateString(),           │ │
│ │     'wealth_xp' => (string) (int) $this->wealth_xp,                     │ │
│ │     'charm_xp' => (string) (int) $this->charm_xp,                       │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                           200 + JSON Body                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                      | Used By Endpoints              | Reusable | Reasoning                    |
| ------------------------- | ------------------------------ | -------- | ---------------------------- |
| `InternalAuth.php`        | All internal endpoints         | ✅       | Shared middleware            |
| `MinimalUserResource.php` | Room members, agency, profiles | ✅       | Designed for embedding       |
| `AuthController.php`      | This endpoint only             | ❌       | Internal-specific controller |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

Not applicable - no request body validation.

### Authentication Errors (401)

| Error             | Source         | Condition                     |
| ----------------- | -------------- | ----------------------------- |
| "Unauthenticated" | `auth:sanctum` | Token missing/invalid/expired |

### Authorization Errors (403)

| Error                                | Source         | Condition               |
| ------------------------------------ | -------------- | ----------------------- |
| "Unauthorized. Invalid internal key" | `InternalAuth` | X-Internal-Key mismatch |

### Edge Cases

| Case                              | Behavior                    |
| --------------------------------- | --------------------------- |
| Token valid but user soft-deleted | Sanctum returns 401         |
| Missing X-Internal-Key header     | 403 before token validation |
| Rate limit exceeded               | 429 with Retry-After header |

---

## 6. Sequence Diagram (Textual)

```
 MSAB                    MIDDLEWARE                CONTROLLER              RESOURCE
   │                         │                         │                      │
   │  POST /auth/validate    │                         │                      │
   │  + X-Internal-Key       │                         │                      │
   │  + Bearer token         │                         │                      │
   │────────────────────────▶│                         │                      │
   │                         │                         │                      │
   │                         │ 1. InternalAuth         │                      │
   │                         │    hash_equals(key)     │                      │
   │                         │                         │                      │
   │                         │ 2. throttle:internal_api│                      │
   │                         │    Check rate limit     │                      │
   │                         │                         │                      │
   │                         │ 3. auth:sanctum         │                      │
   │                         │    Validate token       │                      │
   │                         │    Attach user          │                      │
   │                         │                         │                      │
   │                         │────────────────────────▶│                      │
   │                         │                         │                      │
   │                         │                         │ 4. Get $request->user()
   │                         │                         │───────────────────── │
   │                         │                         │                      │
   │                         │                         │ 5. Build MinimalUserResource
   │                         │                         │─────────────────────▶│
   │                         │                         │◀─────────────────────│
   │                         │                         │                      │
   │                         │◀────────────────────────│                      │
   │◀────────────────────────│                         │                      │
   │                         │                         │                      │
   │  200 + User JSON        │                         │                      │
   │                         │                         │                      │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                       |
| --------------------------- | ------------------------------ |
| New user fields in response | `MinimalUserResource.php`      |
| Additional auth checks      | `AuthController@validateToken` |
| New rate limit rules        | `AppServiceProvider`           |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD TO RESPONSE

| Step  | File                                                 | What to Change           |
| ----- | ---------------------------------------------------- | ------------------------ |
| **1** | `app/Http/Resources/V1/User/MinimalUserResource.php` | Add field to `toArray()` |
| **2** | Update MSAB client                                   | Handle new field         |

#### ➖ REMOVING A FIELD FROM RESPONSE

| Step  | File                                                 | What to Change          |
| ----- | ---------------------------------------------------- | ----------------------- |
| **1** | Coordinate with MSAB team                            | Ensure field not in use |
| **2** | `app/Http/Resources/V1/User/MinimalUserResource.php` | Remove from `toArray()` |

### ⚠️ What Should NOT Be Modified Casually

| Component             | Reason                                        |
| --------------------- | --------------------------------------------- |
| `MinimalUserResource` | Used by multiple endpoints, changes propagate |
| `InternalAuth`        | Security boundary for all internal endpoints  |
| Response field types  | MSAB client expects specific types            |

### 🚨 Common Pitfalls

| Pitfall                      | Prevention                                  |
| ---------------------------- | ------------------------------------------- |
| Changing XP field to numeric | Keep as string - prevents JS precision loss |
| Removing middleware          | All internal endpoints need X-Internal-Key  |
| Adding database queries      | Keep this endpoint fast for socket auth     |

### 📁 File Locations Quick Reference

```
routes/api/internal.php                              ← Route definition
app/Http/Middleware/InternalAuth.php                 ← Internal key validation
app/Http/Controllers/Internal/
  └── AuthController.php                             ← Controller
app/Http/Resources/V1/User/
  └── MinimalUserResource.php                        ← Response transformer
config/services.php                                  ← MSAB key config
```

---

## 8. MSAB Event Contracts

### Incoming (MSAB → Laravel)

This endpoint receives requests FROM MSAB when a user connects to a WebSocket room.

| Field          | Type   | Description                     |
| -------------- | ------ | ------------------------------- |
| Authorization  | Header | Bearer token from mobile client |
| X-Internal-Key | Header | MSAB service authentication     |

### Outgoing (Laravel → MSAB)

No events are emitted by this endpoint.

---

## Document Metadata

| Property            | Value                              |
| ------------------- | ---------------------------------- |
| **Endpoint**        | `POST /api/internal/auth/validate` |
| **Domain**          | Internal / Auth                    |
| **Author**          | System Documentation               |
| **Created**         | 2026-02-04                         |
| **Laravel Version** | 12.x                               |
| **PHP Version**     | 8.4+                               |
