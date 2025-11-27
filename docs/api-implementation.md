# API Specification & Nuxt 4 Integration Guide

**Backend Version:** Laravel 12.x
**Frontend Target:** Nuxt 4
**API Version:** v1
**Base URL:** `https://www.laravel-backend.com/api/v1`

---

## 1. API Contract Standards

### Authentication
*   **Mechanism:** Laravel Sanctum (Bearer Token).
*   **Header:** `Authorization: Bearer <token>`
*   **CSRF:** For SPA mode (if same domain), use `sanctum/csrf-cookie`. For API mode (mobile/separate domain), rely on token. *Recommendation: Use Bearer token for consistency across SSR/CSR.*

### Response Format
All API responses follow a strict `ApiResponse` envelope.

**Success Response (200/201):**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }, // Object or Array
  "errors": [],
  "status": 200
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "message": "Error description",
  "data": [],
  "errors": {
    "field_name": ["Validation error message"]
  },
  "status": 422
}
```

### Data Conventions
*   **Dates:** ISO 8601 Strings (`YYYY-MM-DDTHH:mm:ss.ssssssZ`).
*   **IDs:** Integers (BigInt) or Strings (if UUIDs used, but currently BigInt).
*   **Pagination:** Standard Laravel pagination in `data` or `meta` (if using Resources).
    *   *Note: The current `ApiResponse` wrapper might wrap the paginated resource. Ensure frontend handles `data.data` vs `data` correctly.*
*   **Phone Numbers:** E.164 format (e.g., `+1234567890`).

---

## 2. Endpoints Specification

### A. Authentication

#### 1. Register
*   **Method:** `POST`
*   **Path:** `/auth/register`
*   **Auth:** Public
*   **Rate Limit:** `auth_register` (Strict)

**Request Body:**
```json
{
  "name": "John Doe",           // Required, String, Max 255
  "email": "john@example.com",  // Required (or phone), Email, Unique
  "password": "Password123!",   // Required with email, Min 8, Mixed case, numbers, symbols
  "phone": "1234567890",        // Required (or email), String
  "phone_country": "US",        // Required with phone, ISO 2-char code
  "signature": "john_doe_99"    // Optional, Unique, a-z0-9_ only
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "name": "John Doe", ... },
    "token": "1|laravel_sanctum_token...",
    "token_type": "Bearer",
    "expires_at": "2025-12-31T23:59:59Z",
    "permissions": []
  }
}
```

#### 2. Login
*   **Method:** `POST`
*   **Path:** `/auth/login`
*   **Auth:** Public
*   **Rate Limit:** `auth.rate_limit:login`

**Request Body:**
```json
{
  "email": "john@example.com", // Required (or phone)
  "phone": "1234567890",       // Required (or email)
  "phone_country": "US",       // Required with phone
  "password": "Password123!",  // Required
  "remember_me": true          // Optional, Boolean
}
```

**Success Response (200 OK):**
*   Same `data` structure as Register.

#### 3. Logout
*   **Method:** `POST`
*   **Path:** `/auth/logout`
*   **Auth:** Bearer Token
*   **Response:** `success: true`

#### 4. Get Authenticated User
*   **Method:** `GET`
*   **Path:** `/auth/user`
*   **Auth:** Bearer Token
*   **Response:** Returns full `UserResource` (see below).

#### 5. Social Auth
*   **Redirect:** `GET /auth/social/{provider}/redirect` (Providers: `google`, `facebook`, `apple`)
*   **Callback:** `POST /auth/social/{provider}/callback`

---

### B. User Profile

#### 1. Get Profile
*   **Method:** `GET`
*   **Path:** `/profile`
*   **Auth:** Bearer Token
*   **Response:** `UserResource`

#### 2. Update Profile
*   **Method:** `PUT`
*   **Path:** `/profile`
*   **Auth:** Bearer Token
*   **Request Body:** (Partial updates allowed)
    *   `name`, `signature`, `phone`, `phone_country`, etc.

#### 3. Upload Avatar
*   **Method:** `POST`
*   **Path:** `/profile/avatar`
*   **Auth:** Bearer Token
*   **Headers:** `Content-Type: multipart/form-data`
*   **Body:**
    *   `avatar`: File (jpg, jpeg, png, webp), Max 5MB.

#### 4. Delete Avatar
*   **Method:** `DELETE`
*   **Path:** `/profile/avatar`

---

### C. Email Verification

*   **Verify:** `POST /auth/email/verify` (Body: `{ "token": "..." }`)
*   **Resend:** `POST /auth/email/resend`
*   **Status:** `GET /auth/email/status`

---

### D. Account Management

*   **Delete Account:** `DELETE /account/delete` (Irreversible for user)

---

### E. Users (Public/Protected)

#### 1. List Users
*   **Method:** `GET`
*   **Path:** `/users`
*   **Auth:** Bearer Token
*   **Query Params:** `page` (int), `per_page` (int)

#### 2. Show User
*   **Method:** `GET`
*   **Path:** `/users/{id}`
*   **Auth:** Bearer Token
*   **Response:** `UserResource` (Public fields only unless Admin/Self).

---

## 3. Data Types & Interfaces (TypeScript)

### User Interface
```typescript
export interface User {
  id: number;
  name: string;
  signature: string | null;
  avatar: {
    original: string;
    thumbnail: string;
    medium: string;
    large: string;
  } | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Private / Admin / Own Profile Only
  email?: string;
  phone?: {
    raw: string;
    formatted: string;
    country: string;
  };
  phone_country?: string;
  last_login_at?: string;
  roles?: string[];
  permissions?: string[];
  
  // Computed
  profile_completion?: {
    overall_percentage: number;
    is_complete: boolean;
  };
}
```

### Auth Response Interface
```typescript
export interface AuthResponse {
  user: User;
  token: string;
  token_type: string;
  expires_at: string;
  permissions: string[];
}
```

---

## 4. Nuxt 4 Integration Guidelines

### Recommended Composables

#### `useApi`
Centralized fetch wrapper using `ofetch` (built-in to Nuxt).
*   Auto-attach `Authorization` header from Pinia store.
*   Handle 401 (Unauthorized) by redirecting to login.
*   Unwrap `ApiResponse` envelope automatically (return `response.data` or throw error).

```typescript
// composables/useApi.ts
export const useApi = <T>(url: string, options: any = {}) => {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();
  
  return useFetch<ApiResponse<T>>(url, {
    baseURL: config.public.apiBase,
    headers: {
      Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
      Accept: 'application/json',
      ...options.headers
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        authStore.logout();
        navigateTo('/login');
      }
    },
    ...options
  });
}
```

#### `useAuth`
Encapsulate auth logic.
*   `login(credentials)`
*   `register(data)`
*   `logout()`
*   `fetchUser()`

### State Management (Pinia)
**Store:** `stores/auth.ts`
*   **State:** `user: User | null`, `token: string | null`, `isAuthenticated: boolean`.
*   **Persist:** Use `pinia-plugin-persistedstate` to keep token in `localStorage` / `cookies`.

### Error Handling
*   **Validation Errors (422):** Map `response.errors` to form fields.
*   **Global Errors (500):** Show toast notification (e.g., Nuxt UI Toast).

### Optimistic UI
For simple updates (e.g., "Update Profile"), update the local Pinia state immediately before the API call returns. Revert if it fails.

---

## 5. Reliability & Safety Rules

1.  **Strict Typing:** Always use the defined TypeScript interfaces. Do not use `any`.
2.  **Validation:** Frontend validation (Zod or Vuelidate) should match backend rules (e.g., Password complexity, Email format) to provide instant feedback.
3.  **Error Boundaries:** Wrap critical components (like Payment or Profile) in `<NuxtErrorBoundary>` to prevent full app crashes.
4.  **Versioning:** The API is at `/v1`. Do not hardcode paths; use the `apiBase` runtime config.
