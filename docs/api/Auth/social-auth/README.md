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