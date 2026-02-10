# POST /api/v1/auth/register

> **Domain**: Authentication  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

The Registration endpoint handles new user account creation in the FlyLive platform. It supports dual registration methods: **email + password** or **phone number** based authentication.

### Responsibilities

- Create new user accounts with validated data
- Auto-generate unique 7-digit numeric signatures
- Assign default "User" role via Spatie Permissions
- Load-balance assignment to resellers
- Queue email verification (async)
- Generate Sanctum authentication tokens
- Return fully hydrated user data + Bearer token

### What It Owns

| Owned                       | Description                                     |
| --------------------------- | ----------------------------------------------- |
| User creation               | Creates new `users` record with hashed password |
| Signature generation        | Generates unique 7-digit ID with atomic locking |
| Role assignment             | Assigns default "User" role                     |
| Token creation              | Creates Sanctum personal access token           |
| Email verification dispatch | Queues verification email job                   |

### External Dependencies

| Dependency         | Type           | Purpose                             |
| ------------------ | -------------- | ----------------------------------- |
| `users` table      | Database       | User storage                        |
| Spatie Permissions | Package        | Role management                     |
| Laravel Sanctum    | Package        | Token authentication                |
| Redis/Cache        | Infrastructure | Signature locking, reseller caching |
| Queue (emails)     | Infrastructure | Async email dispatch                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/auth/register
```

### Authentication

❌ **None Required** - Public endpoint

### Rate Limiting

| Limiter                  | Key             | Config             |
| ------------------------ | --------------- | ------------------ |
| `throttle:auth_register` | Laravel default | Framework throttle |

### Request Headers

| Header             | Required | Type               | Description                                           |
| ------------------ | -------- | ------------------ | ----------------------------------------------------- |
| `Content-Type`     | ✅       | `application/json` | Request body format                                   |
| `Accept`           | ✅       | `application/json` | Response format                                       |
| `X-Client-Type`    | ❌       | `string`           | Client type: `web`, `mobile`, `admin`. Default: `web` |
| `X-Correlation-ID` | ❌       | `string (UUID)`    | Request tracing ID                                    |

### Request Body Schema

```json
{
  "name": "string", // Required, max: 255
  "email": "string|null", // Required if no phone, RFC email, unique
  "password": "string|null", // Required with email, min: 8, mixed case, numbers, symbols
  "phone": "string|null", // Required if no email, unique (E.164 after formatting)
  "country": "string|null", // Required with phone, 2 chars (ISO 3166-1 alpha-2)
  "signature": "string|null" // Optional, max: 255, lowercase alphanumeric + underscore
}
```

#### Field Details

| Field       | Type           | Constraints                                              | Example              |
| ----------- | -------------- | -------------------------------------------------------- | -------------------- |
| `name`      | `string`       | Required, max 255                                        | `"John Doe"`         |
| `email`     | `string\|null` | RFC email, unique                                        | `"john@example.com"` |
| `password`  | `string\|null` | Required with email, min 8, mixed case, numbers, symbols | `"P@ssw0rd!"`        |
| `phone`     | `string\|null` | Unique, validated via PhoneService                       | `"3001234567"`       |
| `country`   | `string\|null` | Required with phone, ISO 3166-1 alpha-2                  | `"PK"`               |
| `signature` | `string\|null` | Optional, lowercase + numbers + underscores only         | `"john_doe_123"`     |

#### Validation Rules Summary

- **Must have at least one identifier**: `email` OR `phone`
- **Email registration**: `email` + `password` required
- **Password strength**: 8+ chars, mixed case, numbers, symbols

---

### Response Schemas

#### ✅ Success Response (201 Created)

```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "signature": "3592010",
      "avatar": null,
      "frame": null,
      "phone": "+923001234567",
      "country": "PK",
      "gender": null,
      "date_of_birth": null,
      "coins": "0",
      "diamonds": "0",
      "wealth_xp": "0",
      "charm_xp": "0",
      "is_profile_complete": false,
      "is_blocked": false,
      "blocked_at": null,
      "blocked_reason": null,
      "locked_until": null
    },
    "token": "1|abc123xyz...",
    "token_type": "Bearer",
    "expires_at": "2026-04-26T13:14:21.000000Z",
    "msab_token": "eyJhbGciOiJIUzI1NiJ9..."
  },
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422 Unprocessable Entity)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "name": ["Your name is required to create an account."],
    "email": ["An account with this email already exists."],
    "password": ["Password must be at least 8 characters long."]
  },
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400)

```json
{
  "status": "error",
  "message": "Either email or phone number is required for registration",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Registration failed: [error details]",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-01-27T13:14:21.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                                               |
| ----- | ----------------------------------------------------------------------- |
| `201` | User created successfully                                               |
| `400` | DTO validation failed (missing email/phone, missing password for email) |
| `422` | Request validation failed (invalid format, duplicates)                  |
| `429` | Rate limit exceeded                                                     |
| `500` | Internal server error                                                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/auth/register                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:21                                                │
│ Route: Route::post('/register', [AuthController::class, 'register'])        │
│         ->middleware('throttle:auth_register')                              │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. https.enforce      → Enforces HTTPS in production                      │
│   2. throttle:auth_register → Laravel's built-in rate limiter               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Auth/RegisterRequest.php                     │
│                                                                             │
│ Laravel auto-resolves FormRequest BEFORE controller method is called.      │
│                                                                             │
│ First Executable Line: RegisterRequest::authorize() at line 13              │
│   → Returns true (allows all requests)                                      │
│                                                                             │
│ Then: RegisterRequest::rules() at line 23                                   │
│   → Validates all incoming fields                                           │
│   → If validation fails → 422 response (never reaches controller)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/AuthController.php                   │
│ Method: register(RegisterRequest $request) at line 26                       │
│                                                                             │
│ STEP 1: Create DTO (lines 29-37)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = new RegisterUserDTO(                                             │ │
│ │     name: $request->validated('name'),                                  │ │
│ │     email: $request->validated('email'),                                │ │
│ │     password: $request->validated('password'),                          │ │
│ │     phone: $request->validated('phone'),                                │ │
│ │     country: $request->validated('country'),                 │ │
│ │     signature: $request->validated('signature')                         │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Extract client type from header (line 40)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $clientType = $request->header('X-Client-Type', 'web');                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Delegate to service (line 41)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->authenticationService->registerWithToken($dto, type); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Build response (lines 43-48)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AuthenticationResource($result),                                │ │
│ │     'User registered successfully',                                     │ │
│ │     [],                                                                 │ │
│ │     201                                                                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Error Handling:                                                             │
│   • InvalidArgumentException → 400 Bad Request                              │
│   • Exception → 500 Server Error                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────┐                 │
│ │ COORDINATOR SERVICE                                     │                 │
│ │ File: app/Services/Auth/AuthenticationService.php      │                 │
│ │ Method: registerWithToken() at line 51                 │                 │
│ │                                                         │                 │
│ │ Purpose: Thin orchestration layer that delegates to    │                 │
│ │          specialized services                           │                 │
│ │                                                         │                 │
│ │ Dependencies (constructor injected):                    │                 │
│ │   • RegistrationService                                │                 │
│ │   • SessionService                                     │                 │
│ │   • EmailVerificationService                           │                 │
│ │   • TokenManagementService                             │                 │
│ │   • SecurityEventLoggingService                        │                 │
│ └─────────────────────────────────────────────────────────┘                 │
│                         │                                                   │
│                         ▼                                                   │
│ ┌─────────────────────────────────────────────────────────┐                 │
│ │ STEP A: Register User                                   │                 │
│ │ Call: $user = $this->registrationService->register($dto)│                │
│ │ File: app/Services/Auth/RegistrationService.php:40     │                 │
│ │                                                         │                 │
│ │ INSIDE DB TRANSACTION:                                  │                 │
│ │                                                         │                 │
│ │   A.1 Generate Signature (line 44)                     │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $signature = $this->signatureGenerator->generate()│ │                 │
│ │   │                                                   │ │                 │
│ │   │ → Uses Redis lock for 5s (block for 3s max)       │ │                 │
│ │   │ → Generates random 7-digit number (1000000-9999999)│ │                │
│ │   │ → Checks uniqueness in DB (max 100 attempts)      │ │                 │
│ │   │ → Returns: "3592010"                              │ │                 │
│ │   │                                                   │ │                 │
│ │   │ File: app/Services/Auth/SignatureGeneratorService │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   A.2 Create User via Eloquent (lines 42-49)            │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $user = User::create([                            │ │                 │
│ │   │     'name' => $dto->name,                         │ │                 │
│ │   │     'email' => $dto->email,                       │ │                 │
│ │   │     'phone' => $dto->phone,                       │ │                 │
│ │   │     'country' => $dto->country,                   │ │                 │
│ │   │     'password' => $dto->password,                 │ │                 │
│ │   │     'signature' => $signature,                    │ │                 │
│ │   │ ]);                                               │ │                 │
│ │   │                                                   │ │                 │
│ │   │ Note: Password is auto-hashed by Model's 'hashed' │ │                 │
│ │   │ cast defined in User::$casts                      │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   A.3 Assign Default Role (line 58)                    │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $this->roleAssignmentService->assignDefaultRole() │ │                 │
│ │   │                                                   │ │                 │
│ │   │ → Gets cached "User" role (1hr TTL)               │ │                 │
│ │   │ → Calls Spatie's $user->assignRole()              │ │                 │
│ │   │                                                   │ │                 │
│ │   │ File: app/Services/Role/RoleAssignmentService.php │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   A.4 Assign Default Reseller (lines 61)               │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $this->ensureDefaultResellerAssigned($user)       │ │                 │
│ │   │                                                   │ │                 │
│ │   │ → Load-balances to reseller with fewest users     │ │                 │
│ │   │ → Cached for 60s to avoid DB hits                 │ │                 │
│ │   │ → Updates: default_reseller_id on user            │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   A.5 Queue Email Verification (lines 64-66)           │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ if ($user->email && !$user->email_verified_at) {  │ │                 │
│ │   │     SendEmailVerificationJob::dispatch($user);    │ │                 │
│ │   │ }                                                 │ │                 │
│ │   │                                                   │ │                 │
│ │   │ → Queued on "emails" queue                        │ │                 │
│ │   │ → 3 retries: 10s, 1m, 5m backoff                  │ │                 │
│ │   │                                                   │ │                 │
│ │   │ File: app/Jobs/Auth/SendEmailVerificationJob.php  │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   A.6 Refresh User (line 68)                           │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ return $user->fresh();                            │ │                 │
│ │   │ → Reloads from DB to get all computed attributes  │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ └─────────────────────────────────────────────────────────┘                 │
│                         │                                                   │
│                         ▼                                                   │
│ ┌─────────────────────────────────────────────────────────┐                 │
│ │ STEP B: Create Token                                    │                 │
│ │ Call: $this->tokenManagementService->createTokenWithModel()│              │
│ │ File: app/Services/Auth/TokenManagementService.php:65  │                 │
│ │                                                         │                 │
│ │   B.1 Get Configuration                                 │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $singleDevice = config('sanctum.single_device')   │ │                 │
│ │   │ $tokenScopes = config('sanctum.token_scopes')     │ │                 │
│ │   │ $tokenNames = config('sanctum.token_names')       │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   B.2 Revoke Existing Tokens (if single device)         │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ if ($singleDevice) {                              │ │                 │
│ │   │     $user->tokens()->delete();                    │ │                 │
│ │   │ }                                                 │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   B.3 Determine Abilities                               │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $abilities = $tokenScopes[$clientType] ?? ['*']   │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   B.4 Create Sanctum Token                              │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ $newToken = $user->createToken(                   │ │                 │
│ │   │     name: 'Web Token',                            │ │                 │
│ │   │     abilities: ['*'],                             │ │                 │
│ │   │     expiresAt: now()->addMinutes(129600) // 90 days│ │                │
│ │   │ );                                                │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ │   B.5 Return Both Token Model and Plain Text            │                 │
│ │   ┌───────────────────────────────────────────────────┐ │                 │
│ │   │ return [                                          │ │                 │
│ │   │     'token' => $newToken->accessToken,            │ │                 │
│ │   │     'plainText' => $newToken->plainTextToken      │ │                 │
│ │   │ ];                                                │ │                 │
│ │   └───────────────────────────────────────────────────┘ │                 │
│ │                                                         │                 │
│ └─────────────────────────────────────────────────────────┘                 │
│                         │                                                   │
│                         ▼                                                   │
│ ┌─────────────────────────────────────────────────────────┐                 │
│ │ STEP C: Build Result DTO                                │                 │
│ │ Back in: AuthenticationService.php (lines 57-61)       │                 │
│ │                                                         │                 │
│ │ return AuthenticationResultDTO::success(                │                 │
│ │     $user,                                              │                 │
│ │     $tokenResult['token'],     // PersonalAccessToken   │                 │
│ │     $tokenResult['plainText']  // "1|abc123..."         │                 │
│ │ );                                                      │                 │
│ │                                                         │                 │
│ │ File: app/DTOs/User/AuthenticationResultDTO.php        │                 │
│ └─────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RegisterRequest (Form Request)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Requests/Api/V1/Auth/RegisterRequest.php                 │ │
│ │ Responsibility: HTTP input validation before controller                 │ │
│ │ Reusable: ENDPOINT-SPECIFIC                                             │ │
│ │ Why It Exists: Encapsulates validation logic, auto-validates on request │ │
│ │                                                                         │ │
│ │ Key Rules:                                                              │ │
│ │   • name: required, string, max:255                                     │ │
│ │   • email: nullable, rfc email, unique:users, required_without:phone    │ │
│ │   • password: required_with:email, Password::min(8)->letters()          │ │
│ │               ->mixedCase()->numbers()->symbols()                       │ │
│ │   • phone: nullable, required_without:email, UniquePhone rule           │ │
│ │   • country: required_with:phone, size:2                          │ │
│ │   • signature: nullable, max:255, unique:users, regex:/^[a-z0-9_]+$/    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RegisterUserDTO                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/User/RegisterUserDTO.php                                 │ │
│ │ Responsibility: Transfer validated data between layers + business rules │ │
│ │ Reusable: YES (can be used by CLI, admin panel, tests)                  │ │
│ │ Why It Exists: Domain-level validation, type safety, decoupling         │ │
│ │                                                                         │ │
│ │ Business Validation (in constructor):                                   │ │
│ │   • Must have email OR phone (throws InvalidArgumentException)          │ │
│ │   • Email requires password (throws InvalidArgumentException)           │ │
│ │   • Phone requires country (throws InvalidArgumentException)            │ │
│ │                                                                         │ │
│ │ Helper Methods:                                                         │ │
│ │   • isEmailRegistration() → bool                                        │ │
│ │   • isPhoneRegistration() → bool                                        │ │
│ │   • getPrimaryIdentifier() → string                                     │ │
│ │   • toModelArray() → filtered array for Eloquent                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: UniquePhone (Validation Rule)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Rules/UniquePhone.php                                         │ │
│ │ Responsibility: Validate phone format + check uniqueness with E.164     │ │
│ │ Reusable: YES (used by RegisterRequest, UpdateProfileRequest, etc.)     │ │
│ │ Why It Exists: Phone validation requires E.164 normalization before     │ │
│ │                uniqueness check to prevent duplicate formatted phones   │ │
│ │                                                                         │ │
│ │ Dependencies:                                                           │ │
│ │   • PhoneService (E.164 formatting)                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SignatureGeneratorService                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/SignatureGeneratorService.php                   │ │
│ │ Responsibility: Generate unique 7-digit user IDs atomically            │ │
│ │ Reusable: YES (used by RegistrationService, admin user creation)        │ │
│ │ Why It Exists: Prevent race conditions with Redis lock, ensure unique   │ │
│ │                                                                         │ │
│ │ Algorithm:                                                              │ │
│ │   1. Acquire Redis lock (5s timeout, 3s block)                          │ │
│ │   2. Generate random int (1000000-9999999)                              │ │
│ │   3. Check DB uniqueness                                                │ │
│ │   4. Retry up to 100 times                                              │ │
│ │   5. Throw RuntimeException if exhausted                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoleAssignmentService                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Role/RoleAssignmentService.php                       │ │
│ │ Responsibility: Manage default role assignment for new users            │ │
│ │ Reusable: YES (registration, admin panel, seeding)                      │ │
│ │ Why It Exists: Centralize role logic, cache role lookups (1hr TTL)      │ │
│ │                                                                         │ │
│ │ Default Role: "User"                                                    │ │
│ │ Uses: Spatie Permissions package                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: TokenManagementService                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/TokenManagementService.php                      │ │
│ │ Responsibility: Sanctum token CRUD, single-device policy, cleanup       │ │
│ │ Reusable: YES (register, login, logout, password reset, security)       │ │
│ │ Why It Exists: Centralize token management, enforce policies            │ │
│ │                                                                         │ │
│ │ Key Features:                                                           │ │
│ │   • Single device enforcement (configurable)                            │ │
│ │   • Client-type based abilities (web/mobile/admin/api)                  │ │
│ │   • 90-day default expiration                                           │ │
│ │   • Token statistics aggregation                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SendEmailVerificationJob                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Jobs/Auth/SendEmailVerificationJob.php                        │ │
│ │ Responsibility: Async email verification dispatch                       │ │
│ │ Reusable: YES (registration, resend verification, admin trigger)        │ │
│ │ Why It Exists: Remove email latency (~50-200ms) from registration path  │ │
│ │                                                                         │ │
│ │ Queue: "emails"                                                         │ │
│ │ Retries: 3 (backoff: 10s, 60s, 300s)                                    │ │
│ │ Tags: ['email', 'verification', 'user:{id}']                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AuthenticationResultDTO                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/User/AuthenticationResultDTO.php                         │ │
│ │ Responsibility: Encapsulate auth result (user + token + status)         │ │
│ │ Reusable: YES (login, register, social auth)                            │ │
│ │ Why It Exists: Standardize auth response across all auth methods        │ │
│ │                                                                         │ │
│ │ Factory Methods:                                                        │ │
│ │   • ::success($user, $token, $tokenString)                              │ │
│ │   • ::failure($message)                                                 │ │
│ │                                                                         │ │
│ │ State Checks:                                                           │ │
│ │   • isSuccess() / isFailure()                                           │ │
│ │   • getTokenString() / getUserData()                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User (Eloquent Model)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: Eloquent model representing a user entity               │ │
│ │ Reusable: YES (used across entire application)                          │ │
│ │ Why It Exists: ORM model for database operations, entity relationships  │ │
│ │                                                                         │ │
│ │ Traits Used:                                                            │ │
│ │   • HasApiTokens (Sanctum) → $user->createToken(), $user->tokens()      │ │
│ │   • HasRoles (Spatie) → $user->assignRole(), $user->hasRole()           │ │
│ │   • Notifiable → Email/SMS notifications                                │ │
│ │   • SoftDeletes → Soft deletion support                                 │ │
│ │                                                                         │ │
│ │ Key Methods Used in Registration:                                       │ │
│ │   • User::create($data) → Insert new user record                        │ │
│ │   • $user->assignRole('User') → Assign default role (Spatie)            │ │
│ │   • $user->createToken(...) → Create Sanctum token                      │ │
│ │   • $user->fresh() → Reload from database                               │ │
│ │   • $user->tokens()->delete() → Revoke all tokens                       │ │
│ │                                                                         │ │
│ │ Key Casts:                                                              │ │
│ │   • phone → PhoneCast (E.164 formatting)                                │ │
│ │   • password → 'hashed' (auto-hashing)                                  │ │
│ │   • email_verified_at → datetime                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: Direct Eloquent Usage                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ The registration flow uses direct Eloquent calls (User::create())       │ │
│ │ rather than a repository pattern. This provides:                        │ │
│ │                                                                         │ │
│ │   • Simplified codebase with fewer abstraction layers                   │ │
│ │   • Direct access to Eloquent features (casts, events, etc.)            │ │
│ │   • Password auto-hashing via Model's 'hashed' cast                     │ │
│ │                                                                         │ │
│ │ Key Eloquent Features Used:                                             │ │
│ │   • User::create($data) → Mass assignment with $fillable protection     │ │
│ │   • 'hashed' cast → Automatic password hashing (bcrypt/argon2)          │ │
│ │   • PhoneCast → Automatic E.164 phone formatting                        │ │
│ │   • $user->fresh() → Reload model from database                         │ │
│ │                                                                         │ │
│ │ File: app/Models/User/User.php                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: PhoneService                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Infrastructure/PhoneService.php                      │ │
│ │ Responsibility: Phone number validation, formatting, normalization      │ │
│ │ Reusable: YES (used by UniquePhone rule, profile updates, etc.)         │ │
│ │ Why It Exists: Centralizes all phone handling logic                     │ │
│ │                                                                         │ │
│ │ Key Methods Used:                                                       │ │
│ │   • formatForStorage(phone, country) → Returns E.164 format             │ │
│ │   • isValid(phone, country) → Validates phone number                    │ │
│ │   • getDialCode(countryCode) → Returns dial code for country            │ │
│ │                                                                         │ │
│ │ Uses: libphonenumber library via Propaganistas\LaravelPhone             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Password Hashing (Model Cast)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Location: User Model $casts property                                    │ │
│ │ Cast: 'password' => 'hashed'                                            │ │
│ │ Responsibility: Secure password hashing (bcrypt/argon2)                 │ │
│ │ Reusable: YES (Laravel 10+ feature, used application-wide)              │ │
│ │ Why It Exists: Security - never store plaintext passwords               │ │
│ │                                                                         │ │
│ │ Usage in Registration:                                                  │ │
│ │   • Password is passed as plain text to User::create()                  │ │
│ │   • Model's 'hashed' cast auto-hashes before database storage           │ │
│ │                                                                         │ │
│ │ Algorithm: Configured in config/hashing.php (default: bcrypt)           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Check signature uniqueness                                       │
│    Query: SELECT EXISTS(SELECT * FROM users WHERE signature = ?)            │
│    Source: SignatureGeneratorService::isSignatureUnique()                  │
│                                                                             │
│ 2. INSERT: Create user record                                               │
│    Table: users                                                             │
│    Source: User::create() (direct Eloquent)                                │
│                                                                             │
│ 3. INSERT: Assign role (pivot table)                                        │
│    Table: model_has_roles                                                   │
│    Source: RoleAssignmentService → $user->assignRole()                     │
│                                                                             │
│ 4. SELECT: Get least-loaded reseller (cached 60s)                           │
│    Query: SELECT users.*, COUNT(...) FROM users WHERE role='Reseller'...   │
│    Source: RegistrationService::ensureDefaultResellerAssigned()            │
│                                                                             │
│ 5. UPDATE: Assign reseller to user                                          │
│    Query: UPDATE users SET default_reseller_id = ? WHERE id = ?            │
│    Source: RegistrationService (if reseller found)                         │
│                                                                             │
│ 6. INSERT: Create Sanctum token                                             │
│    Table: personal_access_tokens                                            │
│    Source: TokenManagementService → $user->createToken()                   │
│                                                                             │
│ 7. SELECT: Refresh user from DB                                             │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: $user->fresh()                                                   │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. LOCK: signature_generation (Redis, 5s TTL)                               │
│    Source: SignatureGeneratorService                                        │
│                                                                             │
│ 2. GET/SET: default_user_role (1hr TTL)                                     │
│    Source: RoleAssignmentService                                            │
│                                                                             │
│ 3. GET/SET: reseller:least_loaded (60s TTL)                                 │
│    Source: RegistrationService                                              │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│                                                                             │
│ 1. DISPATCH: SendEmailVerificationJob to "emails" queue                     │
│    Payload: Serialized User model                                           │
│    Source: RegistrationService                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ STEP 1: AuthenticationResource transforms AuthenticationResultDTO           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Auth/AuthenticationResource.php              │ │
│ │                                                                         │ │
│ │ Input: AuthenticationResultDTO($user, $token, $tokenString)             │ │
│ │                                                                         │ │
│ │ Output:                                                                 │ │
│ │ {                                                                       │ │
│ │   "user": BootstrapUserResource($user),                                 │ │
│ │   "token": "1|abc123...",                                               │ │
│ │   "token_type": "Bearer",                                               │ │
│ │   "expires_at": "2026-04-26T13:14:21.000000Z",                          │ │
│ │   "msab_token": "eyJhbGciOiJIUzI1NiJ9..."                               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: BootstrapUserResource transforms User model                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Auth/BootstrapUserResource.php               │ │
│ │                                                                         │ │
│ │ Input: User model                                                       │ │
│ │                                                                         │ │
│ │ Output: {                                                               │ │
│ │   "id": 123,                                                            │ │
│ │   "name": "John Doe",                                                   │ │
│ │   "signature": "3592010",                                               │ │
│ │   "avatar": null,                                                       │ │
│ │   "frame": null,                                                        │ │
│ │   "phone": "+923001234567",      // E.164 format                        │ │
│ │   "country": "PK",                                                │ │
│ │   "gender": null,                                                       │ │
│ │   "date_of_birth": null,                                                │ │
│ │   "coins": "0",                  // String for precision                │ │
│ │   "diamonds": "0",                                                      │ │
│ │   "wealth_xp": "0",                                                     │ │
│ │   "charm_xp": "0",                                                      │ │
│ │   "is_profile_complete": false,  // Missing gender + dob                │ │
│ │   "is_blocked": false,                                                  │ │
│ │   "blocked_at": null,                                                   │ │
│ │   "blocked_reason": null,                                               │ │
│ │   "locked_until": null                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: ApiResponse::success() wraps in standard envelope                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │                                                                         │ │
│ │ Final Response Structure:                                               │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "User registered successfully",                            │ │
│ │   "data": { ... AuthenticationResource output ... },                    │ │
│ │   "meta": {                                                             │ │
│ │     "timestamp": "2026-01-27T13:14:21.000000Z",                         │ │
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
│                    201 Created + JSON Body                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                            | Used By Endpoints                    | Reusable          | Reasoning                                                              |
| ------------------------------- | ------------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| `RegisterRequest.php`           | `/register` only                     | ❌ Single-purpose | Endpoint-specific validation rules                                     |
| `RegisterUserDTO.php`           | Register, Admin Create User          | ✅ Reusable       | Domain transfer object, CLI/test friendly                              |
| `AuthController.php`            | Register, Login, Logout, User        | ⭕ Mixed          | Controller is endpoint-specific, but methods can be reference patterns |
| `AuthenticationService.php`     | Register, Login, Logout, Social Auth | ✅ Reusable       | Coordinator/facade for all auth flows                                  |
| `RegistrationService.php`       | Register only                        | ⭕ Partially      | Core logic reusable, but tightly coupled to registration flow          |
| `TokenManagementService.php`    | All auth endpoints                   | ✅ Reusable       | Central token management for entire system                             |
| `SignatureGeneratorService.php` | Registration, Admin User Create      | ✅ Reusable       | Domain service for unique ID generation                                |
| `RoleAssignmentService.php`     | Registration, Admin Panel            | ✅ Reusable       | Centralized role management                                            |
| `SendEmailVerificationJob.php`  | Register, Resend Verification        | ✅ Reusable       | Async email dispatch                                                   |
| `AuthenticationResultDTO.php`   | Register, Login, Social Auth         | ✅ Reusable       | Standardized auth response container                                   |
| `AuthenticationResource.php`    | Register, Login, Social Auth         | ✅ Reusable       | API response transformer                                               |
| `BootstrapUserResource.php`     | Register, Login, /user, Profile      | ✅ Reusable       | User data transformer for frontend                                     |
| `UniquePhone.php`               | Register, Update Profile             | ✅ Reusable       | Phone validation with E.164 normalization                              |
| `ApiResponse.php`               | All API endpoints                    | ✅ Reusable       | Global response envelope utility                                       |
| `User.php` (Model)              | Entire application                   | ✅ Reusable       | Eloquent model with 'hashed' cast for auto password hashing            |
| `PhoneService.php`              | Register, Update Profile, Admin      | ✅ Reusable       | Phone validation and E.164 formatting                                  |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                    | Source             | Condition                       |
| ------------------------ | ------------------ | ------------------------------- |
| `name.required`          | `RegisterRequest`  | Name field empty                |
| `email.unique`           | `RegisterRequest`  | Email already exists in DB      |
| `email.required_without` | `RegisterRequest`  | No email AND no phone           |
| `password.required_with` | `RegisterRequest`  | Email provided without password |
| `password` rules         | `RegisterRequest`  | Password too weak               |
| `phone.unique`           | `UniquePhone` rule | Phone (E.164) already exists    |
| `country.required_with`  | `RegisterRequest`  | Phone without country           |

### Business Logic Errors (400)

| Error                            | Source                        | Condition                              |
| -------------------------------- | ----------------------------- | -------------------------------------- |
| "Either email or phone required" | `RegisterUserDTO::validate()` | Both email and phone null/empty        |
| "Password required with email"   | `RegisterUserDTO::validate()` | Email provided but password null/empty |
| "Phone country required"         | `RegisterUserDTO::validate()` | Phone provided but country null/empty  |

### System Errors (500)

| Error                                 | Source                      | Condition                            |
| ------------------------------------- | --------------------------- | ------------------------------------ |
| "Unable to generate unique signature" | `SignatureGeneratorService` | 100 attempts exhausted (very rare)   |
| DB transaction failure                | `RegistrationService`       | Database error during user creation  |
| Redis lock timeout                    | `SignatureGeneratorService` | Redis unavailable or high contention |

### Edge Cases

| Case                          | Behavior                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| Duplicate signature collision | Retry up to 100 times with new random number                    |
| Email queue failure           | Job retries 3 times with exponential backoff, logs error        |
| No default "User" role        | Logs warning, skips role assignment (user created successfully) |
| No available resellers        | User created without default_reseller_id (nullable field)       |
| Phone formatting fails        | `UniquePhone` rule returns validation error                     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE LAYER              DATABASE/CACHE/QUEUE
   │                       │                       │                       │                            │
   │  POST /register       │                       │                       │                            │
   │──────────────────────▶│                       │                       │                            │
   │                       │                       │                       │                            │
   │                       │ 1. HTTPS enforce      │                       │                            │
   │                       │ 2. throttle check     │                       │                            │
   │                       │──────────────────────▶│                       │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 3. RegisterRequest    │                            │
   │                       │                       │    validates input    │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │ 4. Check email unique      │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 5. UniquePhone::validate   │
   │                       │                       │                       │    (format + uniqueness)   │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 6. Create DTO         │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 7. Call authService   │                            │
   │                       │                       │    .registerWithToken │                            │
   │                       │                       │──────────────────────▶│                            │
   │                       │                       │                       │                            │
   │                       │                       │                       │ 8. Begin Transaction       │
   │                       │                       │                       │───────────────────────────▶│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 9. Acquire Redis lock      │
   │                       │                       │                       │───────────────────────────▶│ CACHE
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 10. Generate signature     │
   │                       │                       │                       │     check uniqueness       │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 11. INSERT user            │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 12. Get cached role        │
   │                       │                       │                       │───────────────────────────▶│ CACHE
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 13. INSERT role pivot      │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 14. Get cached reseller    │
   │                       │                       │                       │───────────────────────────▶│ CACHE
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 15. UPDATE user reseller   │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 16. DISPATCH email job     │
   │                       │                       │                       │───────────────────────────▶│ QUEUE
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 17. Commit Transaction     │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 18. SELECT fresh user      │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 19. Revoke old tokens      │
   │                       │                       │                       │    (if single device)      │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 20. INSERT sanctum token   │
   │                       │                       │                       │───────────────────────────▶│ DB
   │                       │                       │                       │◀───────────────────────────│
   │                       │                       │                       │                            │
   │                       │                       │                       │ 21. Build result DTO       │
   │                       │                       │◀──────────────────────│                            │
   │                       │                       │                       │                            │
   │                       │                       │ 22. AuthResource      │                            │
   │                       │                       │     transforms        │                            │
   │                       │                       │                       │                            │
   │                       │                       │ 23. ApiResponse       │                            │
   │                       │                       │     wraps             │                            │
   │                       │◀──────────────────────│                       │                            │
   │◀──────────────────────│                       │                       │                            │
   │                       │                       │                       │                            │
   │  201 Created + JSON   │                       │                       │                            │
   │                       │                       │                       │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Auth Methods

| Addition               | Location                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| New registration field | 1. Add to `RegisterRequest::rules()` 2. Add to `RegisterUserDTO` 3. Add to `RegistrationService::register()` |
| New auth provider      | Create in `app/Services/Auth/` following `SocialAuthService` pattern                                         |
| New token scope        | Add to `config/sanctum.php` under `token_scopes`                                                             |
| New user role          | Add to seeder, `RoleAssignmentService` will pick it up                                                       |
| Custom validation rule | Create in `app/Rules/`, add to `RegisterRequest`                                                             |

---

### 📝 Field Modification Guide

This section provides step-by-step instructions for adding, removing, or modifying fields in the registration flow.

---

#### ➕ ADDING A NEW FIELD

**Example: Adding a `referral_code` field**

Follow these steps **in order** (dependencies matter):

| Step  | File                                                   | What to Change                                                |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------- |
| **1** | **Database Migration**                                 | Create migration to add column to `users` table               |
| **2** | `app/Models/User/User.php`                             | Add field to `$fillable` array (if mass-assignable)           |
| **3** | `app/Http/Requests/Api/V1/Auth/RegisterRequest.php`    | Add validation rule for the new field                         |
| **4** | `app/DTOs/User/RegisterUserDTO.php`                    | Add property to constructor + update `toModelArray()`         |
| **5** | `app/Http/Controllers/Api/V1/Auth/AuthController.php`  | Pass new field to DTO: `$request->validated('referral_code')` |
| **6** | `app/Services/Auth/RegistrationService.php`            | Access from DTO if special logic needed                       |
| **7** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Add to response if frontend needs it                          |
| **8** | **Tests**                                              | Update feature/unit tests                                     |

**Detailed Code Changes:**

```php
// STEP 1: Migration
Schema::table('users', function (Blueprint $table) {
    $table->string('referral_code')->nullable()->after('signature');
});

// STEP 2: User Model ($fillable)
protected $fillable = [
    // ... existing fields
    'referral_code',
];

// STEP 3: RegisterRequest::rules()
public function rules(): array
{
    return [
        // ... existing rules
        'referral_code' => ['nullable', 'string', 'max:50', 'exists:referral_codes,code'],
    ];
}

// STEP 4: RegisterUserDTO
public function __construct(
    public readonly string $name,
    // ... existing params
    public readonly ?string $referralCode = null,  // ADD HERE
) {
    $this->validate();
}

public function toModelArray(): array
{
    return array_filter([
        // ... existing fields
        'referral_code' => $this->referralCode,  // ADD HERE
    ], fn($value) => $value !== null);
}

// STEP 5: AuthController::register()
$dto = new RegisterUserDTO(
    name: $request->validated('name'),
    // ... existing params
    referralCode: $request->validated('referral_code'),  // ADD HERE
);

// STEP 6: RegistrationService::register() (if special logic needed)
// The field is already passed via $dto->toModelArray() to repository
// Only add explicit handling if business logic required:
if ($dto->referralCode) {
    $this->processReferral($user, $dto->referralCode);
}

// STEP 7: BootstrapUserResource::toArray() (if needed in response)
return [
    // ... existing fields
    'referral_code' => $this->resource->referral_code,
];
```

---

#### ➖ REMOVING A FIELD

**Example: Removing the `signature` field (user-provided)**

> ⚠️ **WARNING**: Be careful removing fields that may be used elsewhere in the system.

| Step  | File                                                   | What to Change                           |
| ----- | ------------------------------------------------------ | ---------------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Auth/RegisterRequest.php`    | Remove validation rule                   |
| **2** | `app/DTOs/User/RegisterUserDTO.php`                    | Remove property, update `toModelArray()` |
| **3** | `app/Http/Controllers/Api/V1/Auth/AuthController.php`  | Remove from DTO instantiation            |
| **4** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php` | Remove from response (if applicable)     |
| **5** | **Database Migration** (optional)                      | Drop column if no longer needed anywhere |
| **6** | **Tests**                                              | Remove field from test payloads          |

**Detailed Code Changes:**

```php
// STEP 1: RegisterRequest::rules() - REMOVE these lines:
// 'signature' => [
//     'nullable',
//     'max:255',
//     'unique:users,signature',
//     'regex:/^[a-z0-9_]+$/',
// ],

// STEP 2: RegisterUserDTO - REMOVE from constructor:
// public readonly ?string $signature = null,
// AND from toModelArray():
// 'signature' => $this->signature,

// STEP 3: AuthController::register() - REMOVE:
// signature: $request->validated('signature'),

// STEP 4: BootstrapUserResource - REMOVE if was added:
// 'signature' => $this->resource->signature,

// STEP 5: Migration (if dropping entirely - BE CAREFUL)
Schema::table('users', function (Blueprint $table) {
    $table->dropColumn('signature');
});
```

---

#### ✏️ MODIFYING AN EXISTING FIELD

**Example: Making `email` required (removing phone-only registration)**

| Step  | File                                                | What to Change                                         |
| ----- | --------------------------------------------------- | ------------------------------------------------------ |
| **1** | `app/Http/Requests/Api/V1/Auth/RegisterRequest.php` | Change `required_without:phone` to `required`          |
| **2** | `app/DTOs/User/RegisterUserDTO.php`                 | Update `validate()` method business rules              |
| **3** | **Tests**                                           | Update tests expecting phone-only registration to fail |

**Example: Changing password complexity**

```php
// RegisterRequest::rules()
'password' => [
    'required_with:email',
    Password::min(12)        // Changed from 8 to 12
        ->letters()
        ->mixedCase()
        ->numbers()
        ->symbols()
        ->uncompromised(),   // Added: check against breached passwords
],
```

---

#### 🔗 Field Flow Dependency Chain

Understanding how data flows helps identify what to modify:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP Request Body                                                          │
│       │                                                                     │
│       ▼                                                                     │
│  RegisterRequest::rules()          ← Validation rules for the field        │
│       │                                                                     │
│       ▼                                                                     │
│  $request->validated('field')      ← Retrieves validated value             │
│       │                                                                     │
│       ▼                                                                     │
│  RegisterUserDTO::__construct()    ← Stores in typed property              │
│       │                                                                     │
│       ▼                                                                     │
│  RegisterUserDTO::toModelArray()   ← Converts to array for Eloquent        │
│       │                                                                     │
│       ▼                                                                     │
│  UserRepository::create($data)     ← Passes to Eloquent                    │
│       │                                                                     │
│       ▼                                                                     │
│  User::create($data)               ← Eloquent mass assignment              │
│       │                                 (field must be in $fillable)        │
│       ▼                                                                     │
│  Database INSERT                   ← Column must exist in migration        │
│       │                                                                     │
│       ▼                                                                     │
│  BootstrapUserResource::toArray()  ← Transforms for API response           │
│       │                            (if field needed in response)            │
│       ▼                                                                     │
│  JSON Response                                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

#### 📋 Field Modification Checklist

Use this checklist when making field changes:

**For Adding a Field:**

- [ ] Migration created and run
- [ ] Field added to `User::$fillable`
- [ ] Validation rule added to `RegisterRequest`
- [ ] Property added to `RegisterUserDTO` constructor
- [ ] `toModelArray()` updated in DTO
- [ ] Field passed from controller to DTO
- [ ] Resource updated (if needed in response)
- [ ] Custom error message added (if needed)
- [ ] API documentation updated
- [ ] Tests updated

**For Removing a Field:**

- [ ] Verified field is not used elsewhere (grep codebase)
- [ ] Removed from `RegisterRequest`
- [ ] Removed from `RegisterUserDTO`
- [ ] Removed from controller
- [ ] Removed from resource (if applicable)
- [ ] Migration to drop column (if safe)
- [ ] Tests updated
- [ ] API documentation updated

**For Modifying a Field:**

- [ ] Validation rules updated
- [ ] DTO validation updated (if business rules changed)
- [ ] Migration for column changes (if type/constraint changed)
- [ ] Tests updated to reflect new behavior

### ⚠️ What Should NOT Be Modified Casually

| Component                                     | Reason                                                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| `RegisterUserDTO::validate()`                 | Business invariants - changing breaks consistency          |
| `SignatureGeneratorService` range             | Database has existing signatures in 1M-9.99M range         |
| `TokenManagementService::createToken()`       | Single device policy affects all clients                   |
| `User::$casts['password']`                    | 'hashed' cast ensures passwords are never stored plaintext |
| Database transaction in `RegistrationService` | Removing risks partial state                               |

### 🚨 Common Pitfalls

| Pitfall                        | Prevention                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| Bypassing password hashing     | Model's 'hashed' cast auto-hashes - use User::create() properly   |
| Phone uniqueness without E.164 | Always use `UniquePhone` rule, not raw unique:users               |
| Signature collision under load | Redis lock prevents - don't remove lock                           |
| Slow registration              | Email is queued - don't make it synchronous                       |
| Role assignment failure        | Service logs warning but doesn't fail registration - check logs   |
| Token expiration mismatch      | Default 90 days in `config/sanctum.php`, don't hardcode elsewhere |

### 📁 File Locations Quick Reference

```
routes/api/auth.php                          ← Route definition
app/Http/Controllers/Api/V1/Auth/
  └── AuthController.php                     ← Controller
app/Http/Requests/Api/V1/Auth/
  └── RegisterRequest.php                    ← Request validation
app/DTOs/User/
  ├── RegisterUserDTO.php                    ← Data transfer object
  └── AuthenticationResultDTO.php            ← Result container
app/Models/User/
  └── User.php                               ← Eloquent model (with 'hashed' cast)
app/Services/Auth/
  ├── AuthenticationService.php              ← Coordinator
  ├── RegistrationService.php                ← Core registration logic
  ├── TokenManagementService.php             ← Token CRUD
  ├── SignatureGeneratorService.php          ← Unique ID generation
  └── EmailVerificationService.php           ← Email verification
app/Services/Role/
  └── RoleAssignmentService.php              ← Role management
app/Services/Infrastructure/
  └── PhoneService.php                       ← Phone validation & formatting
app/Jobs/Auth/
  └── SendEmailVerificationJob.php           ← Async email
app/Http/Resources/V1/
  ├── AuthenticationResource.php             ← Auth response transformer
  └── BootstrapUserResource.php              ← User data transformer
app/Rules/
  └── UniquePhone.php                        ← Phone validation rule
app/Http/Utils/
  └── ApiResponse.php                        ← Response envelope
```

---

## Document Metadata

| Property            | Value                        |
| ------------------- | ---------------------------- |
| **Endpoint**        | `POST /api/v1/auth/register` |
| **Domain**          | Authentication               |
| **Author**          | System Documentation         |
| **Created**         | 2026-01-27                   |
| **Laravel Version** | 12.x                         |
| **PHP Version**     | 8.4                          |
