# POST /api/v1/auth/login

> **Domain**: Authentication  
> **Type**: Public Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-28

---

## 1. Domain Overview

### Purpose

Authenticates existing users via email+password or phone+password, issuing a Sanctum token for subsequent authenticated requests.

### Responsibilities

- Validate user credentials (email or phone + password)
- Enforce multi-layer rate limiting (credential, IP, and account-based)
- Check user eligibility (not blocked, not locked, email verified for email logins)
- Create authentication token with single-device policy
- Record login history asynchronously
- Detect suspicious login patterns via device fingerprinting
- Cache user permissions for fast authorization checks

### What It Owns

| Owned                  | Description                           |
| ---------------------- | ------------------------------------- |
| Session creation       | Creates new authentication token      |
| Login attempt tracking | Increments/resets login attempts      |
| Rate limit management  | Credential and IP-based rate limiting |
| Login history dispatch | Fires event for async recording       |

### External Dependencies

| Dependency            | Type           | Purpose                                             |
| --------------------- | -------------- | --------------------------------------------------- |
| Database (`users`)    | Eloquent       | User lookup, login attempts update                  |
| Laravel Sanctum       | Package        | Token creation and management                       |
| Redis/Cache           | Infrastructure | Rate limiting, permission caching, negative caching |
| RateLimiter (Laravel) | Facade         | Credential/IP blocking                              |
| Event System          | Laravel        | Async login history recording                       |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/auth/login
```

### Authentication

❌ **None Required** - Public endpoint for obtaining authentication tokens

### Rate Limiting

**Middleware-Level (Pre-Controller):**

| Limiter          | Key Pattern                            | Limits               |
| ---------------- | -------------------------------------- | -------------------- |
| Credential-based | `auth_credential:login:{email\|phone}` | 5 attempts / 15 min  |
| IP-based         | `auth_ip:{ip}`                         | 20 attempts / 60 min |

**Service-Level (In SessionService):**

| Limiter          | Key Pattern              | Limits               |
| ---------------- | ------------------------ | -------------------- |
| Credential-based | `login:credentials:{id}` | 5 attempts / 15 min  |
| IP-based         | `login:ip:{ip}`          | 10 attempts / 15 min |
| Account-based    | `login:user:{user_id}`   | 5 attempts / 30 min  |

### Middleware Stack

```
1. https.enforce         → Forces HTTPS in production
2. auth.rate_limit:login → AuthRateLimiting middleware
```

### Request Headers

| Header          | Required | Type               | Description                            |
| --------------- | -------- | ------------------ | -------------------------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format                    |
| `Accept`        | ✅       | `application/json` | Response format                        |
| `X-Client-Type` | ❌       | `string`           | Client identifier (web/mobile/desktop) |
| `User-Agent`    | ❌       | `string`           | Used for device fingerprinting         |
| `X-Device-ID`   | ❌       | `string`           | Persistent device identifier           |

### Request Body Schema

```json
{
  "email": "string|null", // Required if no phone, max 255, RFC email
  "phone": "string|null", // Required if no email, E.164 validated
  "country": "string|null", // Required with phone, 2-char ISO code
  "password": "string", // Required, min 1 char
  "remember_me": "boolean|null" // Optional, default false (reserved)
}
```

#### Field Details

| Field         | Type      | Constraints                                          | Example                |
| ------------- | --------- | ---------------------------------------------------- | ---------------------- |
| `email`       | `string`  | `required_without:phone`, max 255, email:rfc         | `"user@example.com"`   |
| `phone`       | `string`  | `required_without:email`, validated via PhoneService | `"5551234567"`         |
| `country`     | `string`  | `required_with:phone`, exactly 2 chars               | `"US"`                 |
| `password`    | `string`  | Required, min 1                                      | `"securePassword123!"` |
| `remember_me` | `boolean` | Optional                                             | `true`                 |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "signature": "3592010",
      "avatar": "https://cdn.example.com/avatars/123.jpg",
      "frame": null,
      "phone": "+923001234567",
      "country": "PK",
      "gender": "male",
      "date_of_birth": "1990-05-15",
      "coins": "1500",
      "diamonds": "250",
      "wealth_xp": "12500",
      "charm_xp": "8750",
      "is_profile_complete": true,
      "is_blocked": false,
      "blocked_at": null,
      "blocked_reason": null,
      "locked_until": null
    },
    "token": "1|abc123xyz...",
    "token_type": "Bearer",
    "expires_at": "2026-04-27T14:30:00.000000Z",
    "msab_token": "eyJhbGciOiJIUzI1NiJ9..."
  },
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
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
    "email": ["Either email or phone number is required for login."],
    "password": ["Password is required for login."]
  }
}
```

#### ❌ Authentication Failed (401)

```json
{
  "status": "error",
  "message": "Invalid credentials",
  "data": null,
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Rate Limited (429)

```json
{
  "status": "error",
  "message": "Too many login attempts. Please try again later.",
  "data": null,
  "meta": {
    "timestamp": "2026-01-27T14:30:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

Response Headers:

```
Retry-After: 300
X-RateLimit-Reset: 1706362800
```

#### ❌ Account Blocked (401)

```json
{
  "status": "error",
  "message": "Account is blocked: Violation of terms of service",
  "data": null
}
```

#### ❌ Account Locked (401)

```json
{
  "status": "error",
  "message": "Account is temporarily locked. Try again in 1500 seconds.",
  "data": null
}
```

#### ❌ Email Verification Required (401)

```json
{
  "status": "error",
  "message": "Email verification required. Please check your email.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                           |
| ----- | --------------------------------------------------- |
| `200` | Login successful, token issued                      |
| `401` | Invalid credentials, blocked, locked, or unverified |
| `422` | Validation failed                                   |
| `429` | Rate limit exceeded                                 |
| `500` | Unexpected server error                             |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/auth/login                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:22                                                │
│ Route: Route::post('/login', [AuthController::class, 'login'])              │
│        ->middleware('auth.rate_limit:login');                               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. https.enforce        → Redirects to HTTPS in production                │
│   2. auth.rate_limit:login → AuthRateLimiting (progressive blocking)        │
│                                                                             │
│ Note: Rate limiting happens BEFORE controller execution                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1.1 AUTH RATE LIMITING MIDDLEWARE                                         │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Middleware/AuthRateLimiting.php                              │
│                                                                             │
│ PRE-REQUEST CHECKS (before controller):                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Check IP-based blocking                                              │ │
│ │    Key: auth_ip:{ip}                                                    │ │
│ │    Limit: 20 attempts / 60 minutes                                      │ │
│ │    → If exceeded: Return 429 immediately                                │ │
│ │                                                                         │ │
│ │ 2. Check credential-based rate limiting                                 │ │
│ │    Key: auth_credential:login:{email|phone}                             │ │
│ │    Limit: 5 attempts / 15 minutes                                       │ │
│ │    → If exceeded: Return 429 immediately                                │ │
│ │                                                                         │ │
│ │ 3. Check user account locking                                           │ │
│ │    Queries: User::where('email', ...)->first()                          │ │
│ │    Uses negative caching to prevent enumeration attacks                 │ │
│ │    → If locked: Return 429 with lock time remaining                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ POST-RESPONSE HANDLING (after controller):                                  │ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ • If 401 response → handleFailedAttempt()                               │ │
│ │   - Hit credential rate limiter                                         │ │
│ │   - Hit IP rate limiter                                                 │ │
│ │   - Increment user.login_attempts                                       │ │
│ │   - Log security event                                                  │ │
│ │   - Escalate to IP blocking if threshold reached                        │ │
│ │                                                                         │ │
│ │ • If 200 response → handleSuccessfulAttempt()                           │ │
│ │   - Clear credential rate limiter                                       │ │
│ │   - Reset user.login_attempts                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED - FORM REQUEST VALIDATION                           │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Auth/LoginRequest.php                        │
│                                                                             │
│ VALIDATION RULES:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'email' => ['nullable', 'email:rfc', 'max:255', 'required_without:phone']│
│ │ 'phone' => [                                                            │ │
│ │     'nullable', 'string', 'required_without:email',                     │ │
│ │     Closure: validates via PhoneService::isValid()                      │ │
│ │ ]                                                                       │ │
│ │ 'country' => ['required_with:phone', 'nullable', 'string', 'size:2']│
│ │ 'password' => ['required', 'string', 'min:1']                           │ │
│ │ 'remember_me' => ['nullable', 'boolean']                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PHONE VALIDATION (inline closure):                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $fullPhone = $country . $phone;                                    │ │
│ │ if (!app(PhoneService::class)->isValid($fullPhone)) {                   │ │
│ │     $fail('The phone number is invalid.');                              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Failure → 422 Validation Error with field-specific messages                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/AuthController.php:55-79             │
│ Method: login(LoginRequest $request): JsonResponse                          │
│                                                                             │
│ STEP 1: Create DTO from validated data                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = new LoginUserDTO(                                                │ │
│ │     email: $request->validated('email'),                                │ │
│ │     phone: $request->validated('phone'),                                │ │
│ │     country: $request->validated('country'),                 │ │
│ │     password: $request->validated('password'),                          │ │
│ │     rememberMe: $request->validated('remember_me', false)               │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Delegate to AuthenticationService                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->authenticationService->login($dto);                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle result and return response                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error($result->message ?? 'Login failed', [], 401);│
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AuthenticationResource($result),                                │ │
│ │     'Login successful'                                                  │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Controller Responsibilities:                                                │
│   • Transform request → DTO                                                 │
│   • Delegate to service layer                                               │
│   • Transform result → response                                             │
│   • NO business logic here                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ LAYER 1: AuthenticationService (Facade/Coordinator)                    │ │
│ │ File: app/Services/Auth/AuthenticationService.php:64-70                 │ │
│ │                                                                         │ │
│ │ public function login(LoginUserDTO $dto): AuthenticationResultDTO      │ │
│ │ {                                                                       │ │
│ │     return $this->sessionService->login($dto);  // Delegates            │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ Why: Thin facade for all auth operations                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                       │
│                                     ▼                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ LAYER 2: SessionService (Core Login Orchestrator)                       │ │
│ │ File: app/Services/Auth/SessionService.php:35-131                        │ │
│ │                                                                         │ │
│ │ Dependencies Injected:                                                  │ │
│ │   • TokenManagementService                                              │ │
│ │   • CacheService                                                        │ │
│ │   • SecurityEventLoggingService                                         │ │
│ │   • BlockingService                                                     │ │
│ │   • Hasher (password verification)                                      │ │
│ │   • DeviceFingerprintService                                            │ │
│ │                                                                         │ │
│ │ EXECUTION STEPS (in order):                                             │ │
│ │                                                                         │ │
│ │ 1. EARLY BLOCKING CHECK                                                 │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $ip = RequestContext::ip();                                         │ │ │
│ │ │ $deviceId = RequestContext::deviceId();                             │ │ │
│ │ │ if ($this->blockingService->isBlocked($ip, $deviceId)) {            │ │ │
│ │ │     return AuthenticationResultDTO::failure('Access denied.');      │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 2. GET IDENTIFIER & FIND USER                                           │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $identifier = $dto->getPrimaryIdentifier(); // email or phone       │ │ │
│ │ │ $user = $this->findUserByIdentifier($dto);  // Direct Eloquent      │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 3. CHECK SERVICE-LEVEL RATE LIMITS                                      │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $this->checkLoginRateLimits($identifier, $user);                    │ │ │
│ │ │ // Throws TooManyLoginAttemptsException if exceeded                 │ │ │
│ │ │ // Limits: credential (5/15min), IP (10/15min), user (5/30min)      │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 4. USER NOT FOUND → FAIL                                                │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ if ($user === null) {                                               │ │ │
│ │ │     $this->incrementLoginAttempts($identifier, null);               │ │ │
│ │ │     $this->logFailedAuthentication($identifier);                    │ │ │
│ │ │     return AuthenticationResultDTO::failure('Invalid credentials'); │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 5. CHECK USER CAN LOGIN                                                 │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ if (!$this->canUserLogin($user, $dto)) {                            │ │ │
│ │ │     // Checks: is_blocked, isLocked(), isEmailVerified()            │ │ │
│ │ │     $this->incrementLoginAttempts($identifier, $user);              │ │ │
│ │ │     return AuthenticationResultDTO::failure(...blocked/locked msg); │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 6. VERIFY PASSWORD                                                      │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ if ($user->password === null ||                                     │ │ │
│ │ │     !$this->hasher->check($dto->password, $user->password)) {       │ │ │
│ │ │     $this->incrementLoginAttempts($identifier, $user);              │ │ │
│ │ │     $this->logFailedAuthentication($identifier);                    │ │ │
│ │ │     return AuthenticationResultDTO::failure('Invalid credentials'); │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 7. HANDLE SUCCESSFUL LOGIN                                              │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $this->handleSuccessfulLogin($user);                                │ │ │
│ │ │   → $user->resetLoginAttempts()                                     │ │ │
│ │ │   → event(new LoginHistoryRecorded(...)) // Async                   │ │ │
│ │ │ $this->clearLoginRateLimits($identifier, $user);                    │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 8. DEVICE FINGERPRINT ANALYSIS                                          │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $analysis = $this->deviceFingerprintService                         │ │ │
│ │ │     ->analyzeLoginAttempt($user);                                   │ │ │
│ │ │ if ($analysis['suspicious']) {                                      │ │ │
│ │ │     $this->securityLogger->logSecurityEvent('suspicious_login',...);│ │ │
│ │ │ }                                                                   │ │ │
│ │ │ // Note: Still allows login, just logs suspicious activity          │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 9. LOG SUCCESSFUL AUTH                                                  │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $this->securityLogger->logSuccessfulAuthentication($user);          │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 10. CREATE TOKEN                                                        │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $clientType = $this->tokenManagementService                         │ │ │
│ │ │     ->getRecommendedClientType(RequestContext::userAgent());        │ │ │
│ │ │ $tokenString = $this->tokenManagementService                        │ │ │
│ │ │     ->createToken($user, $clientType);                              │ │ │
│ │ │ $token = $user->tokens()->latest()->first();                        │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 11. CACHE USER PERMISSIONS                                              │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ $this->cacheService->cacheUserPermissions($user);                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ 12. RETURN SUCCESS                                                      │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ return AuthenticationResultDTO::success($user, $token, $tokenString);│ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: LoginUserDTO (Data Transfer Object)                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/User/LoginUserDTO.php                                    │ │
│ │ Responsibility: Encapsulates login credentials with validation          │ │
│ │ Reusable: YES (Login, CLI commands, tests)                              │ │
│ │ Why It Exists: Type-safe credential transfer, business rule validation  │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • email?: string                                                      │ │
│ │   • phone?: string                                                      │ │
│ │   • country?: string                                               │ │
│ │   • password: string                                                    │ │
│ │   • rememberMe: bool                                                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • validate() → Throws InvalidArgumentException                        │ │
│ │   • isEmailLogin(), isPhoneLogin() → Determine login type               │ │
│ │   • getPrimaryIdentifier() → Returns email or phone                     │ │
│ │   • getCredentials() → Returns array for auth attempt                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BlockingService                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/User/BlockingService.php                             │ │
│ │ Responsibility: Check if IP or device is blocked                        │ │
│ │ Reusable: YES (All auth endpoints)                                      │ │
│ │ Why It Exists: Centralized permanent/temporary blocking logic           │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • isBlocked(ip, deviceId) → Check if access denied                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: DeviceFingerprintService                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/DeviceFingerprintService.php                    │ │
│ │ Responsibility: Detect suspicious login patterns                        │ │
│ │ Reusable: YES (Login, security monitoring)                              │ │
│ │ Why It Exists: Security - detect account takeover attempts              │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • analyzeLoginAttempt(user) → Returns ['suspicious' => bool, ...]     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: SecurityEventLoggingService                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/SecurityEventLoggingService.php                 │ │
│ │ Responsibility: Log security-related events                             │ │
│ │ Reusable: YES (All auth operations)                                     │ │
│ │ Why It Exists: Audit trail, suspicious activity detection               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • logSecurityEvent(type, data)                                        │ │
│ │   • logSuccessfulAuthentication(user)                                   │ │
│ │   • logFailedAuthentication(identifier)                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RequestContext                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Infrastructure/RequestContext.php                    │ │
│ │ Responsibility: Access current request data (IP, device, user agent)    │ │
│ │ Reusable: YES (Application-wide)                                        │ │
│ │ Why It Exists: Static access to request context without injection       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • RequestContext::ip() → Current IP                                   │ │
│ │   • RequestContext::deviceId() → X-Device-ID header                     │ │
│ │   • RequestContext::userAgent() → User-Agent header                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: TokenManagementService                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Auth/TokenManagementService.php                      │ │
│ │ Responsibility: Sanctum token CRUD                                      │ │
│ │ Reusable: YES (Register, Login, Logout, Token Refresh)                  │ │
│ │ Why It Exists: Centralized token management, single-device policy       │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • createToken(user, clientType) → Revokes old + creates new           │ │
│ │   • getRecommendedClientType(userAgent) → Determines client type        │ │
│ │                                                                         │ │
│ │ Single-Device Policy: Previous tokens are revoked before creating new   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: CacheService                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Cache/CacheService.php                               │ │
│ │ Responsibility: Application-level caching                               │ │
│ │ Reusable: YES (Application-wide)                                        │ │
│ │ Why It Exists: Centralized cache management                             │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • cacheUserPermissions(user) → Cache roles/permissions for fast lookup│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User (Eloquent Model)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: User entity with auth-related methods                   │ │
│ │ Reusable: YES (Entire application)                                      │ │
│ │                                                                         │ │
│ │ Key Methods Used in Login:                                              │ │
│ │   • $user->is_blocked → Check if permanently blocked                    │ │
│ │   • $user->isLocked() → Check if temporarily locked                     │ │
│ │   • $user->getLockTimeRemaining() → Seconds until unlock                │ │
│ │   • $user->isEmailVerified() → Check email verification                 │ │
│ │   • $user->incrementLoginAttempts() → Track failed attempts             │ │
│ │   • $user->resetLoginAttempts() → Clear on success                      │ │
│ │   • $user->tokens() → Sanctum token relationship                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AuthenticationResultDTO                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/User/AuthenticationResultDTO.php                         │ │
│ │ Responsibility: Standardized auth operation result                      │ │
│ │ Reusable: YES (Register, Login, Social Auth)                            │ │
│ │ Why It Exists: Consistent success/failure handling                      │ │
│ │                                                                         │ │
│ │ Factory Methods:                                                        │ │
│ │   • ::success(user, token, tokenString)                                 │ │
│ │   • ::failure(message)                                                  │ │
│ │                                                                         │ │
│ │ Check Methods:                                                          │ │
│ │   • isSuccess(), isFailure()                                            │ │
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
│ 1. SELECT user by email or phone (findUserByIdentifier)                     │
│    Query: SELECT * FROM users WHERE email = ? / phone = ?                   │
│    Source: Direct Eloquent via SessionService::findUserByIdentifier()       │
│                                                                             │
│ 2. UPDATE login_attempts on failure                                         │
│    Query: UPDATE users SET login_attempts = ... WHERE id = ?                │
│    Source: User::incrementLoginAttempts()                                   │
│                                                                             │
│ 3. UPDATE login_attempts/last_login_at on success                           │
│    Query: UPDATE users SET login_attempts = 0, last_login_at = NOW()...     │
│    Source: User::resetLoginAttempts()                                       │
│                                                                             │
│ 4. DELETE old tokens (single-device policy)                                 │
│    Query: DELETE FROM personal_access_tokens WHERE tokenable_id = ?         │
│    Source: TokenManagementService::createToken()                            │
│                                                                             │
│ 5. INSERT new token                                                         │
│    Query: INSERT INTO personal_access_tokens ...                            │
│    Source: $user->createToken()                                             │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. CHECK: Rate limit keys (RateLimiter facade)                              │
│    Keys: login:credentials:{id}, login:ip:{ip}, login:user:{user_id}        │
│                                                                             │
│ 2. INCREMENT: Rate limit counters on failure                                │
│    TTL: 15-30 minutes depending on key type                                 │
│                                                                             │
│ 3. CLEAR: Rate limit counters on success                                    │
│    Source: RateLimiter::clear()                                             │
│                                                                             │
│ 4. GET: Negative user cache (AuthRateLimiting middleware)                   │
│    Key: auth:user_not_found:{identifier}                                    │
│    TTL: 60 seconds                                                          │
│    Purpose: Prevent DB enumeration attacks                                  │
│                                                                             │
│ 5. SET: User permissions cache                                              │
│    Key: user:{id}:permissions                                               │
│    Source: CacheService::cacheUserPermissions()                             │
│                                                                             │
│ EVENT DISPATCH:                                                             │
│                                                                             │
│ 1. LoginHistoryRecorded (async)                                             │
│    Payload: user, ipAddress, userAgent, deviceId, loginAt                   │
│    Purpose: Record login history without blocking response                  │
│    Latency Savings: 50-200ms                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Auth/AuthenticationResource.php                 │
│                                                                             │
│ SUCCESS PATH:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ AuthenticationResultDTO                                                 │ │
│ │         │                                                               │ │
│ │         ▼                                                               │ │
│ │ AuthenticationResource::toArray()                                       │ │
│ │         │                                                               │ │
│ │         ├── 'user' => BootstrapUserResource($user)                      │ │
│ │         │     • id, name, signature, avatar, frame                      │ │
│ │         │     • phone, country, gender, date_of_birth                   │ │
│ │         │     • coins, diamonds, wealth_xp, charm_xp                    │ │
│ │         │     • is_profile_complete, is_blocked, blocked_at             │ │
│ │         │     • blocked_reason, locked_until                            │ │
│ │         │                                                               │ │
│ │         ├── 'token' => $authResult->getTokenString()                    │ │
│ │         ├── 'token_type' => 'Bearer'                                    │ │
│ │         ├── 'expires_at' => $token->expires_at                          │ │
│ │         └── 'msab_token' => $authResult->msabToken (MSAB JWT)           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL OUTPUT:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ApiResponse::success(                                                   │ │
│ │     new AuthenticationResource($result),                                │ │
│ │     'Login successful'                                                  │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ → HTTP 200 + JSON envelope with status, message, data, meta             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
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

| File                              | Used By Endpoints                    | Reusable          | Reasoning                              |
| --------------------------------- | ------------------------------------ | ----------------- | -------------------------------------- |
| `LoginRequest.php`                | `/login` only                        | ❌ Single-purpose | Endpoint-specific validation rules     |
| `LoginUserDTO.php`                | Login, CLI commands                  | ⭕ Partially      | Could be reused by admin impersonation |
| `AuthController.php`              | Register, Login, Logout, User        | ⭕ Mixed          | Controller is endpoint-specific        |
| `AuthenticationService.php`       | Register, Login, Logout, Social Auth | ✅ Reusable       | Coordinator for all auth flows         |
| `SessionService.php`              | Login, Logout                        | ✅ Reusable       | Session management for all flows       |
| `TokenManagementService.php`      | All auth endpoints                   | ✅ Reusable       | Central token management               |
| `BlockingService.php`             | All auth endpoints                   | ✅ Reusable       | IP/device blocking logic               |
| `DeviceFingerprintService.php`    | Login, security                      | ✅ Reusable       | Suspicious pattern detection           |
| `SecurityEventLoggingService.php` | All auth operations                  | ✅ Reusable       | Security audit logging                 |
| `AuthRateLimiting.php`            | Login, Social Auth, Email Verify     | ✅ Reusable       | Progressive rate limiting middleware   |
| `AuthenticationResultDTO.php`     | Register, Login, Social Auth         | ✅ Reusable       | Standardized auth response container   |
| `AuthenticationResource.php`      | Register, Login, Social Auth         | ✅ Reusable       | API response transformer               |
| `BootstrapUserResource.php`       | Register, Login, /user, Profile      | ✅ Reusable       | User data transformer                  |
| `ApiResponse.php`                 | All API endpoints                    | ✅ Reusable       | Global response envelope               |
| `RequestContext.php`              | Application-wide                     | ✅ Reusable       | Static request data access             |
| `CacheService.php`                | Application-wide                     | ✅ Reusable       | Centralized caching                    |
| `User.php` (Model)                | Entire application                   | ✅ Reusable       | User entity model                      |
| `PhoneService.php`                | Register, Login, Profile             | ✅ Reusable       | Phone validation/formatting            |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                    | Source         | Condition                      |
| ------------------------ | -------------- | ------------------------------ |
| `email.required_without` | `LoginRequest` | No email AND no phone          |
| `email.email`            | `LoginRequest` | Invalid email format           |
| `phone.required_without` | `LoginRequest` | No phone AND no email          |
| `phone` (closure)        | `LoginRequest` | Invalid phone via PhoneService |
| `country.required_with`  | `LoginRequest` | Phone without country          |
| `country.size`           | `LoginRequest` | Country not 2 chars            |
| `password.required`      | `LoginRequest` | Password missing               |
| `password.min`           | `LoginRequest` | Password empty                 |

### Business Logic Errors (401)

| Error                              | Source           | Condition                        |
| ---------------------------------- | ---------------- | -------------------------------- |
| "Invalid credentials"              | `SessionService` | User not found OR wrong password |
| "Access denied."                   | `SessionService` | IP or device blocked             |
| "Account is blocked: {reason}"     | `SessionService` | `user.is_blocked = true`         |
| "Account is temporarily locked..." | `SessionService` | `user.isLocked()` returns true   |
| "Email verification required..."   | `SessionService` | Email login + email not verified |

### Rate Limit Errors (429)

| Error                                              | Source             | Condition                            |
| -------------------------------------------------- | ------------------ | ------------------------------------ |
| "IP address temporarily blocked..."                | `AuthRateLimiting` | 20+ IP attempts / 60 min             |
| "Too many login attempts..."                       | `AuthRateLimiting` | 5+ credential attempts / 15 min      |
| "Account temporarily locked..."                    | `AuthRateLimiting` | Account locked via login_attempts    |
| "Too many failed login attempts for this account." | `SessionService`   | 5+ service-level credential attempts |
| "Too many login attempts from this location."      | `SessionService`   | 10+ service-level IP attempts        |

### System Errors (500)

| Error                                   | Source           | Condition                      |
| --------------------------------------- | ---------------- | ------------------------------ |
| "Failed to create authentication token" | `SessionService` | Token creation failed          |
| "Login failed: {message}"               | `SessionService` | Unexpected exception           |
| "Login failed. Please try again."       | `AuthController` | Caught exception in controller |

### Edge Cases

| Case                                   | Behavior                                             |
| -------------------------------------- | ---------------------------------------------------- |
| Email + phone both provided            | Email takes precedence (isEmailLogin checked first)  |
| User exists but no password set        | Returns "Invalid credentials" (social-only accounts) |
| Suspicious login pattern detected      | Login still succeeds, but logged for review          |
| remember_me = true                     | Currently reserved, no effect on token TTL           |
| User deleted (soft delete)             | Eloquent returns null, "Invalid credentials"         |
| Concurrent login from multiple devices | Previous tokens revoked (single-device policy)       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT              MIDDLEWARE            CONTROLLER           SERVICES                    DATABASE/CACHE
   │                     │                     │                    │                            │
   │  POST /login        │                     │                    │                            │
   │────────────────────▶│                     │                    │                            │
   │                     │                     │                    │                            │
   │                     │ 1. AuthRateLimiting │                    │                            │
   │                     │   (check IP rate)   ─────────────────────────────────────────────────▶│
   │                     │◀──────────────────────────────────────────────────────── RateLimiter │
   │                     │                     │                    │                            │
   │                     │ 2. Check credential │                    │                            │
   │                     │    rate limit       ─────────────────────────────────────────────────▶│
   │                     │◀──────────────────────────────────────────────────────── RateLimiter │
   │                     │                     │                    │                            │
   │                     │ 3. Check account    │                    │                            │
   │                     │    lock (negative   ─────────────────────────────────────────────────▶│
   │                     │    cache check)     │                    │                      Cache │
   │                     │                     ─────────────────────────────────────────────────▶│
   │                     │◀───────────────────────────────────────────────────────── User model │
   │                     │                     │                    │                            │
   │                     │ 4. Forward to       │                    │                            │
   │                     │    controller       │                    │                            │
   │                     │────────────────────▶│                    │                            │
   │                     │                     │                    │                            │
   │                     │                     │ 5. LoginRequest    │                            │
   │                     │                     │    validation      │                            │
   │                     │                     │    (PhoneService)  ─────────────────────────────▶
   │                     │                     │◀───────────────────────────────────────────────│
   │                     │                     │                    │                            │
   │                     │                     │ 6. Create          │                            │
   │                     │                     │    LoginUserDTO    │                            │
   │                     │                     │                    │                            │
   │                     │                     │ 7. Call            │                            │
   │                     │                     │    AuthService     │                            │
   │                     │                     │───────────────────▶│                            │
   │                     │                     │                    │                            │
   │                     │                     │                    │ 8. BlockingService.        │
   │                     │                     │                    │    isBlocked()       ─────▶│
   │                     │                     │                    │◀───────────────────────────│
   │                     │                     │                    │                            │
   │                     │                     │                    │ 9. Find user               │
   │                     │                     │                    │    (Eloquent)        ─────▶│
   │                     │                     │                    │◀───── SELECT users ...─────│
   │                     │                     │                    │                            │
   │                     │                     │                    │ 10. Check rate limits      │
   │                     │                     │                    │     (service level)  ─────▶│
   │                     │                     │                    │◀───────────── RateLimiter ─│
   │                     │                     │                    │                            │
   │                     │                     │                    │ 11. canUserLogin()         │
   │                     │                     │                    │     (blocked/locked/       │
   │                     │                     │                    │      verified checks)      │
   │                     │                     │                    │                            │
   │                     │                     │                    │ 12. Hasher::check()        │
   │                     │                     │                    │     (password verify)      │
   │                     │                     │                    │                            │
   │                     │                     │                    │ 13. handleSuccessfulLogin()│
   │                     │                     │                    │     - resetLoginAttempts()─▶│
   │                     │                     │                    │◀───── UPDATE users ...────│
   │                     │                     │                    │     - event(LoginHistory) ─▶│
   │                     │                     │                    │                      EVENT │
   │                     │                     │                    │                            │
   │                     │                     │                    │ 14. clearLoginRateLimits() │
   │                     │                     │                    │     (clear counters)  ────▶│
   │                     │                     │                    │◀───────────── RateLimiter ─│
   │                     │                     │                    │                            │
   │                     │                     │                    │ 15. analyzeLoginAttempt()  │
   │                     │                     │                    │     (fingerprinting)       │
   │                     │                     │                    │                            │
   │                     │                     │                    │ 16. createToken()          │
   │                     │                     │                    │     - delete old tokens ───▶│
   │                     │                     │                    │◀───── DELETE tokens ... ──│
   │                     │                     │                    │     - create new token ───▶│
   │                     │                     │                    │◀───── INSERT tokens ... ──│
   │                     │                     │                    │                            │
   │                     │                     │                    │ 17. cacheUserPermissions() │
   │                     │                     │                    │     (cache roles)     ────▶│
   │                     │                     │                    │◀───────────────────── SET ─│
   │                     │                     │                    │                            │
   │                     │                     │ 18. Return         │                            │
   │                     │                     │◀───────────────────│                            │
   │                     │                     │    AuthResult      │                            │
   │                     │                     │                    │                            │
   │                     │                     │ 19. Transform      │                            │
   │                     │                     │    to Resource     │                            │
   │                     │                     │                    │                            │
   │                     │ 20. Post-response   │                    │                            │
   │                     │    rate limit       │                    │                            │
   │                     │    handling (clear) ─────────────────────────────────────────────────▶│
   │                     │◀──────────────────────────────────────────────────────── RateLimiter │
   │                     │                     │                    │                            │
   │◀────────────────────│                     │                    │                            │
   │                     │                     │                    │                            │
   │  200 + Token + User │                     │                    │                            │
   │                     │                     │                    │                            │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                     | Location                                              |
| ---------------------------- | ----------------------------------------------------- |
| New login method (e.g., OTP) | Create dedicated service, add route, new DTO          |
| New rate limit type          | Add key in `SessionService::getRateLimitKeys()`       |
| Login security check         | Add to `SessionService::canUserLogin()`               |
| Post-login webhook           | Add after `handleSuccessfulLogin()` in SessionService |
| New suspicious pattern       | Add to `DeviceFingerprintService`                     |
| Login event handling         | Listen to `LoginHistoryRecorded` event                |

---

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD (e.g., `captcha_token`)

| Step  | File                                                  | What to Change                     |
| ----- | ----------------------------------------------------- | ---------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Auth/LoginRequest.php`      | Add validation rule                |
| **2** | `app/DTOs/User/LoginUserDTO.php`                      | Add property to constructor        |
| **3** | `app/Http/Controllers/Api/V1/Auth/AuthController.php` | Pass to DTO                        |
| **4** | `app/Services/Auth/SessionService.php`                | Add verification logic (if needed) |
| **5** | **Tests**                                             | Update tests                       |

**Code Changes:**

```php
// STEP 1: LoginRequest::rules()
'captcha_token' => ['required', 'string'],

// STEP 2: LoginUserDTO
public function __construct(
    // ... existing params
    public readonly ?string $captchaToken = null,  // ADD
) { ... }

// STEP 3: AuthController::login()
$dto = new LoginUserDTO(
    // ... existing params
    captchaToken: $request->validated('captcha_token'),  // ADD
);

// STEP 4: SessionService::login() (if verification needed)
if ($dto->captchaToken && !$this->captchaService->verify($dto->captchaToken)) {
    return AuthenticationResultDTO::failure('Invalid captcha');
}
```

#### ➖ REMOVING A FIELD (e.g., `remember_me`)

| Step  | File                                                  | What to Change         |
| ----- | ----------------------------------------------------- | ---------------------- |
| **1** | `app/Http/Requests/Api/V1/Auth/LoginRequest.php`      | Remove validation rule |
| **2** | `app/DTOs/User/LoginUserDTO.php`                      | Remove property        |
| **3** | `app/Http/Controllers/Api/V1/Auth/AuthController.php` | Remove from DTO        |
| **4** | **Tests**                                             | Update tests           |

---

### ⚠️ What Should NOT Be Modified Casually

| Component                                | Reason                                          |
| ---------------------------------------- | ----------------------------------------------- |
| `SessionService.login()` order of checks | Security - blocking before expensive operations |
| Rate limit keys/thresholds               | Security - prevents brute force                 |
| Password verification via Hasher         | Security - never use raw comparison             |
| Single-device token policy               | Business decision - affects all clients         |
| Negative user cache                      | Security - prevents enumeration attacks         |
| Event dispatch for LoginHistory          | Performance - keeps hot path fast               |

### 🚨 Common Pitfalls

| Pitfall                  | Prevention                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| Leaking user existence   | Always return "Invalid credentials" for both not found AND wrong password |
| Bypassing rate limits    | Never create alternate login paths without rate limiting                  |
| Blocking sync operations | Login history is async for a reason - don't make it sync                  |
| Removing blocking checks | Early blocking check is critical for DoS protection                       |
| Password in logs         | Never log passwords or password hashes                                    |
| Token in error responses | Never include token info in error responses                               |

### 📁 File Locations Quick Reference

```
routes/api/auth.php:22                           ← Route definition
app/Http/Middleware/
  └── AuthRateLimiting.php                       ← Progressive rate limiting
app/Http/Controllers/Api/V1/Auth/
  └── AuthController.php:55-79                   ← Controller method
app/Http/Requests/Api/V1/Auth/
  └── LoginRequest.php                           ← Request validation
app/DTOs/User/
  ├── LoginUserDTO.php                           ← Credentials transfer
  └── AuthenticationResultDTO.php                ← Result container
app/Models/User/
  └── User.php                                   ← Eloquent model
app/Services/Auth/
  ├── AuthenticationService.php                  ← Facade/coordinator
  ├── SessionService.php                         ← Core login logic
  ├── TokenManagementService.php                 ← Token CRUD
  ├── BlockingService.php                        ← IP/device blocking
  ├── DeviceFingerprintService.php               ← Suspicious pattern detection
  └── SecurityEventLoggingService.php            ← Security audit logging
app/Services/Infrastructure/
  ├── RequestContext.php                         ← Request data access
  └── PhoneService.php                           ← Phone validation
app/Services/Cache/
  └── CacheService.php                           ← Permission caching
app/Http/Resources/V1/
  ├── AuthenticationResource.php                 ← Auth response transformer
  └── BootstrapUserResource.php                  ← User data transformer
app/Events/
  └── LoginHistoryRecorded.php                   ← Async login history event
```

---

## Document Metadata

| Property            | Value                     |
| ------------------- | ------------------------- |
| **Endpoint**        | `POST /api/v1/auth/login` |
| **Domain**          | Authentication            |
| **Author**          | System Documentation      |
| **Created**         | 2026-01-27                |
| **Laravel Version** | 12.x                      |
| **PHP Version**     | 8.4                       |
