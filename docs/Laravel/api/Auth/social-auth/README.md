# Social Authentication Endpoints

> **Domain**: Authentication  
> **Version**: V1  
> **Last Updated**: 2026-01-27

---

## Endpoints Overview

| Method | Endpoint                                  | Auth      | Description            |
| ------ | ----------------------------------------- | --------- | ---------------------- |
| `GET`  | `/api/v1/auth/social/{provider}/redirect` | ❌ Public | Get OAuth redirect URL |
| `GET`  | `/api/v1/auth/social/{provider}/callback` | ❌ Public | Handle OAuth callback  |

### Supported Providers

- `google`
- `facebook`
- `apple`

---

## 1. Domain Overview

### Purpose

Enable users to authenticate using third-party OAuth providers (Google, Facebook, Apple). Supports both new user registration and existing user login via social accounts.

### Responsibilities

- Generate OAuth redirect URLs for supported providers
- Handle OAuth callbacks and exchange codes for user data
- Create new users from social profile data
- Link social accounts to existing users (by email match)
- Issue authentication tokens after successful social auth

### What It Owns

| Owned                   | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `social_accounts` table | Provider links (provider, provider_id, user_id) |
| OAuth flow coordination | Redirect URL generation, callback handling      |

### External Dependencies

| Dependency                   | Type     | Purpose                    |
| ---------------------------- | -------- | -------------------------- |
| Laravel Socialite            | Package  | OAuth provider integration |
| Database (`users`)           | Eloquent | User creation/lookup       |
| Database (`social_accounts`) | Eloquent | Provider account links     |
| TokenManagementService       | Service  | Token creation             |

---

# GET /api/v1/auth/social/{provider}/redirect

## 2.1 API Contract

### Endpoint

```
GET /api/v1/auth/social/{provider}/redirect
```

### Path Parameters

| Parameter  | Type     | Constraints               | Description         |
| ---------- | -------- | ------------------------- | ------------------- |
| `provider` | `string` | `google\|facebook\|apple` | OAuth provider name |

### Authentication

❌ **None Required** - Public endpoint

### Middleware Stack

```
1. https.enforce → Forces HTTPS in production
```

### Request Headers

| Header   | Required | Type               | Description     |
| -------- | -------- | ------------------ | --------------- |
| `Accept` | ✅       | `application/json` | Response format |

### Response Schemas

#### ✅ Success (200)

```json
{
  "status": "success",
  "message": "Social authentication redirect URL generated",
  "data": {
    "redirect_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    "provider": "google"
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "uuid"
  }
}
```

| Field          | Type     | Description                  |
| -------------- | -------- | ---------------------------- |
| `redirect_url` | `string` | Full OAuth authorization URL |
| `provider`     | `string` | Confirmed provider name      |

#### ❌ Invalid Provider (400)

```json
{
  "status": "error",
  "message": "Unsupported social provider: twitter",
  "data": [],
  "meta": { ... }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to generate social authentication URL",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                     |
| ----- | ----------------------------- |
| `200` | Redirect URL generated        |
| `400` | Unsupported provider          |
| `500` | Socialite/configuration error |

---

## 2.2 Execution Waterfall

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              GET /api/v1/auth/social/{provider}/redirect                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT                                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:26-27                                             │
│ Route: Route::get('/{provider}/redirect', [...])                            │
│        ->where('provider', 'google|facebook|apple');                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER                                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/SocialAuthController.php:24-45       │
│ Method: redirect(string $provider)                                          │
│                                                                             │
│ FLOW:                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Validate provider via SocialAuthService::isValidProvider()          │ │
│ │    → If invalid: return 400                                             │ │
│ │                                                                         │ │
│ │ 2. Get redirect URL from Socialite                                      │ │
│ │    $redirectUrl = Socialite::driver($provider)                          │ │
│ │                            ->redirect()                                 │ │
│ │                            ->getTargetUrl();                            │ │
│ │                                                                         │ │
│ │ 3. Return URL for client to redirect to                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: Returns URL string, NOT a redirect response                           │
│       (SPA clients handle redirect themselves)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# GET /api/v1/auth/social/{provider}/callback

## 3.1 API Contract

### Endpoint

```
GET /api/v1/auth/social/{provider}/callback
```

### Path Parameters

| Parameter  | Type     | Constraints               | Description         |
| ---------- | -------- | ------------------------- | ------------------- |
| `provider` | `string` | `google\|facebook\|apple` | OAuth provider name |

### Query Parameters (from OAuth provider)

| Parameter | Type     | Description              |
| --------- | -------- | ------------------------ |
| `code`    | `string` | OAuth authorization code |
| `state`   | `string` | CSRF state token         |

### Authentication

❌ **None Required** - Public endpoint (OAuth callback)

### Rate Limiting

| Limiter                  | Key Pattern         | Limits                    |
| ------------------------ | ------------------- | ------------------------- |
| `auth.rate_limit:social` | IP/credential-based | Configured via middleware |

### Middleware Stack

```
1. https.enforce         → Forces HTTPS in production
2. auth.rate_limit:social → Prevents callback abuse
```

### Response Schemas

#### ✅ Success - Existing User Login (200)

```json
{
  "status": "success",
  "message": "Logged in successfully",
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
    "expires_at": "2026-02-26T15:00:00.000000Z",
    "msab_token": "eyJhbGciOiJIUzI1NiJ9..."
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ✅ Success - New User Registration (200)

```json
{
  "status": "success",
  "message": "Account created and logged in successfully",
  "data": {
    "user": {
      "id": 456,
      "name": "Jane Smith",
      "signature": "7821045",
      "avatar": null,
      "frame": null,
      "phone": null,
      "country": null,
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
    "token": "2|def456xyz...",
    "token_type": "Bearer",
    "expires_at": "2026-02-26T15:00:00.000000Z",
    "msab_token": "eyJhbGciOiJIUzI1NiJ9..."
  },
  "meta": {
    "timestamp": "2026-01-27T15:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

#### ❌ Invalid Provider (400)

```json
{
  "status": "error",
  "message": "Unsupported social provider: twitter",
  "data": [],
  "meta": { ... }
}
```

#### ❌ OAuth/Auth Failed (400)

```json
{
  "status": "error",
  "message": "Social authentication failed",
  "data": [],
  "meta": { ... }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Social authentication failed. Please try again.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                                     |
| ----- | --------------------------------------------- |
| `200` | Authentication successful (login or register) |
| `400` | Invalid provider or OAuth error               |
| `429` | Rate limited                                  |
| `500` | Server error                                  |

---

## 3.2 Execution Waterfall

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              GET /api/v1/auth/social/{provider}/callback                    │
│              ?code=...&state=...                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT                                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/auth.php:29-31                                             │
│ Route: Route::get('/{provider}/callback', [...])                            │
│        ->where('provider', 'google|facebook|apple')                         │
│        ->middleware('auth.rate_limit:social');                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER                                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Auth/SocialAuthController.php:47-100      │
│ Method: callback(string $provider, Request $request)                        │
│                                                                             │
│ STEP 1: Validate provider                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$this->socialAuthService->isValidProvider($provider))              │ │
│ │     → return 400                                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Get social user from provider                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $socialUser = Socialite::driver($provider)->user();                     │ │
│ │                                                                         │ │
│ │ Socialite exchanges ?code for access token, then fetches user profile   │ │
│ │ Returns: id, name, email, avatar from provider                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle social callback via service                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->socialAuthService->handleSocialCallback(...)           │ │
│ │                                                                         │ │
│ │ if ($result->isFailure()) → return 400                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Create authentication token                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $clientType = $tokenManagementService->getRecommendedClientType(...)    │ │
│ │ $tokenResult = $tokenManagementService->createTokenWithModel(...)       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4.5: Generate MSAB JWT for audio server                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $msabToken = $msabJwtService->generateToken($user)                      │ │
│ │ → HMAC-SHA256, 24h expiry, 16 user fields + isSpeaker                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return authentication response                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return AuthenticationResource($authResult)                              │ │
│ │   includes: user, token, token_type, expires_at, msab_token             │ │
│ │                                                                         │ │
│ │ Message varies:                                                         │ │
│ │   • New user: "Account created and logged in successfully"              │ │
│ │   • Existing: "Logged in successfully"                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER: SocialAuthService.handleSocialCallback()                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Auth/SocialAuthService.php:36-79                         │
│                                                                             │
│ WRAPPED IN DB TRANSACTION:                                                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Extract social user data                                             │ │
│ │    → name, email, avatar, provider_id                                   │ │
│ │                                                                         │ │
│ │ 2. Check if social account exists                                       │ │
│ │    Query: SELECT * FROM social_accounts                                 │ │
│ │           WHERE provider = ? AND provider_id = ?                        │ │
│ │                                                                         │ │
│ │ 3A. IF social account exists:                                           │ │
│ │    → handleExistingSocialAccount() - updates data, returns user         │ │
│ │                                                                         │ │
│ │ 3B. ELSE check for existing user by email:                              │ │
│ │    Query: SELECT * FROM users WHERE email = ?                           │ │
│ │                                                                         │ │
│ │ 4A. IF user exists by email:                                            │ │
│ │    → linkSocialAccount() - creates social_accounts entry                │ │
│ │                                                                         │ │
│ │ 4B. ELSE create new user:                                               │ │
│ │    → createUserFromSocial() - creates user + social account             │ │
│ │    → Generates unique signature                                         │ │
│ │    → Sets random password                                               │ │
│ │    → Auto-verifies email                                                │ │
│ │    → Assigns default role                                               │ │
│ │    → Dispatches UserRegistered event                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Authentication Flow Diagram

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  CLIENT  │     │   YOUR API   │     │  OAUTH PROVIDER │     │   DATABASE   │
└────┬─────┘     └──────┬───────┘     └────────┬────────┘     └──────┬───────┘
     │                  │                      │                     │
     │ 1. GET /redirect │                      │                     │
     │─────────────────▶│                      │                     │
     │                  │                      │                     │
     │ 2. {redirect_url}│                      │                     │
     │◀─────────────────│                      │                     │
     │                  │                      │                     │
     │ 3. User redirects to OAuth provider     │                     │
     │─────────────────────────────────────────▶                     │
     │                  │                      │                     │
     │ 4. User authenticates with provider     │                     │
     │◀────────────────────────────────────────│                     │
     │                  │                      │                     │
     │ 5. Redirect to /callback?code=...       │                     │
     │─────────────────▶│                      │                     │
     │                  │                      │                     │
     │                  │ 6. Exchange code     │                     │
     │                  │  for access token    │                     │
     │                  │─────────────────────▶│                     │
     │                  │◀─────────────────────│                     │
     │                  │                      │                     │
     │                  │ 7. Fetch user profile│                     │
     │                  │─────────────────────▶│                     │
     │                  │◀─────────────────────│                     │
     │                  │                      │                     │
     │                  │ 8. Find/create user  │                     │
     │                  │──────────────────────────────────────────────▶
     │                  │◀─────────────────────────────────────────────│
     │                  │                      │                     │
     │ 9. {user, token} │                      │                     │
     │◀─────────────────│                      │                     │
```

---

## 5. Reusability Matrix

| File                         | Used By Endpoints         | Reusable    | Reasoning                       |
| ---------------------------- | ------------------------- | ----------- | ------------------------------- |
| `SocialAuthController.php`   | redirect, callback        | ⭕ Mixed    | Controller is endpoint-specific |
| `SocialAuthService.php`      | callback, account linking | ✅ Reusable | Central social auth logic       |
| `TokenManagementService.php` | Login, Social Auth        | ✅ Reusable | Token creation                  |
| `AuthenticationResource.php` | Login, Register, Social   | ✅ Reusable | Auth response format            |
| `SocialAuthResultDTO.php`    | Service layer             | ✅ Reusable | Social auth result container    |
| `SocialAccount.php` (Model)  | Service layer             | ✅ Reusable | Social account entity           |

---

## 6. Error Handling & Edge Cases

### OAuth Errors

| Error                | Source     | Condition                                 |
| -------------------- | ---------- | ----------------------------------------- |
| Unsupported provider | Controller | Provider not in `google\|facebook\|apple` |
| OAuth state mismatch | Socialite  | CSRF protection fail                      |
| OAuth code invalid   | Socialite  | Expired or already used code              |
| Provider unreachable | Socialite  | Network/API issues                        |

### Business Logic Cases

| Case                          | Behavior                              |
| ----------------------------- | ------------------------------------- |
| New user (no matching email)  | Creates user, auto-verifies email     |
| Existing email match          | Links social account to existing user |
| Social account already linked | Returns existing user (login)         |
| User blocked                  | Returns failure from service          |
| Provider email empty          | Creates user without email            |

### Edge Cases

| Case                            | Behavior                                   |
| ------------------------------- | ------------------------------------------ |
| Users clicks "deny" on OAuth    | Callback gets error params, returns 400    |
| Same email, different providers | Links both providers to same user          |
| Provider changes user's email   | Social account uses provider_id, not email |
| Token creation fails            | Returns 500                                |

---

## 7. Extension & Maintenance Notes

### ✅ Adding a New Provider

| Step  | Location                                 | What to Change                                         |
| ----- | ---------------------------------------- | ------------------------------------------------------ |
| **1** | `routes/api/auth.php`                    | Add provider to `where()` constraint                   |
| **2** | `SocialAuthService::SUPPORTED_PROVIDERS` | Add to constant array                                  |
| **3** | `config/services.php`                    | Add provider credentials                               |
| **4** | `.env`                                   | Add `{PROVIDER}_CLIENT_ID`, `{PROVIDER}_CLIENT_SECRET` |

### ⚠️ What Should NOT Be Modified Casually

| Component                              | Reason                                      |
| -------------------------------------- | ------------------------------------------- |
| DB transaction in handleSocialCallback | Ensures atomic user+social account creation |
| Provider_id matching                   | Primary key for social accounts             |
| Rate limiting on callback              | Prevents OAuth abuse                        |
| Email auto-verification                | Security assumption for OAuth emails        |

### 📁 File Locations Quick Reference

```
routes/api/auth.php:25-32                         ← Route definitions
app/Http/Controllers/Api/V1/Auth/
  └── SocialAuthController.php                    ← Controller
app/Services/Auth/
  ├── SocialAuthService.php                       ← Core service
  └── TokenManagementService.php                  ← Token creation
app/DTOs/User/
  └── SocialAuthResultDTO.php                     ← Result container
app/Models/User/
  ├── User.php                                    ← User model
  └── SocialAccount.php                           ← Social link model
config/services.php                               ← OAuth credentials
```

---

## Document Metadata

| Property            | Value                    |
| ------------------- | ------------------------ |
| **Endpoints**       | `/redirect`, `/callback` |
| **Providers**       | Google, Facebook, Apple  |
| **Domain**          | Authentication           |
| **Author**          | System Documentation     |
| **Created**         | 2026-01-27               |
| **Laravel Version** | 12.x                     |
| **PHP Version**     | 8.4                      |
