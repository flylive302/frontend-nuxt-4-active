# PUT /api/v1/profile

> **Domain**: User  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Profile Update endpoint allows authenticated users to modify their own profile information. This is the primary endpoint for user-initiated profile changes including name, email, password, phone number, gender, and date of birth.

### Responsibilities

- Authenticate request via Sanctum token
- Validate profile update fields
- Update user record in database within transaction
- Handle password changes with automatic hashing
- Handle phone number updates with E.164 formatting
- Handle unique field conflicts (email, signature)
- Return updated user profile

### What It Owns

| Owned                    | Description                                         |
| ------------------------ | --------------------------------------------------- |
| Profile field validation | Validates name, email, password, phone, gender, DOB |
| User data persistence    | Updates user record in database                     |
| Password security        | Auto-hashes via model cast                          |
| Uniqueness enforcement   | Email and signature uniqueness                      |

### External Dependencies

| Dependency               | Type        | Purpose                           |
| ------------------------ | ----------- | --------------------------------- |
| `users` table            | Database    | User data storage                 |
| Laravel Sanctum          | Package     | Token authentication              |
| UpdateUserProfileRequest | FormRequest | Input validation                  |
| UserService              | Service     | Business logic orchestration      |
| UpdateUserAction         | Action      | Update execution with transaction |
| UpdateUserDTO            | DTO         | Data transfer between layers      |
| BootstrapUserResource    | Resource    | Response transformation           |
| User Policy              | Policy      | Authorization                     |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/profile
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter         | Key        | Config              |
| --------------- | ---------- | ------------------- |
| `throttle.role` | Role-based | Varies by user role |

### Request Headers

| Header             | Required | Type               | Description                  |
| ------------------ | -------- | ------------------ | ---------------------------- |
| `Accept`           | ✅       | `application/json` | Response format              |
| `Content-Type`     | ✅       | `application/json` | Request body format          |
| `Authorization`    | ✅       | `Bearer {token}`   | Sanctum authentication token |
| `X-Correlation-ID` | ❌       | `string (UUID)`    | Request tracing ID           |

### Request Body Schema

```json
{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "password": "NewSecurePass1!",
  "password_confirmation": "NewSecurePass1!",
  "phone": "+923001234567",
  "country": "PK",
  "gender": 1,
  "date_of_birth": "1995-05-15",
  "signature": "johnupdated"
}
```

### Field Details

| Field                   | Type      | Required | Constraints                                 | Description                                    |
| ----------------------- | --------- | -------- | ------------------------------------------- | ---------------------------------------------- |
| `name`                  | `string`  | ❌       | max:255                                     | User's display name                            |
| `email`                 | `string`  | ❌       | email, max:255, unique:users                | User's email (must be unique)                  |
| `password`              | `string`  | ❌       | min:8, 1 upper, 1 lower, 1 digit, 1 special | New password (auto-hashed)                     |
| `password_confirmation` | `string`  | ❌       | Required when `password` provided           | Must match password                            |
| `phone`                 | `string`  | ❌       | E.164 format, phone validation rule         | Phone number                                   |
| `country`               | `string`  | ❌       | ISO 3166-1 alpha-2                          | Country code (required with phone)             |
| `gender`                | `integer` | ❌       | in:1,2,3,4                                  | 1=male, 2=female, 3=other, 4=prefer not to say |
| `date_of_birth`         | `string`  | ❌       | date format                                 | Date in YYYY-MM-DD format                      |
| `signature`             | `string`  | ❌       | max:100, unique:users                       | Custom signature (must be unique)              |

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "id": 123,
    "name": "John Updated",
    "signature": "3592010",
    "avatar": "https://ik.imagekit.io/flylive/avatars/user_123.jpg",
    "frame": null,
    "phone": "+923001234567",
    "country": "PK",
    "gender": "male",
    "date_of_birth": "1995-05-15",
    "coins": "1500",
    "diamonds": "250",
    "wealth_xp": "5000",
    "charm_xp": "3200",
    "is_profile_complete": true,
    "is_blocked": false,
    "blocked_at": null,
    "blocked_reason": null,
    "locked_until": null
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
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
    "email": ["This email address is already taken."],
    "password": [
      "The password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
    ]
  },
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Failed to update profile. Please try again.",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-04T02:54:24.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Profile updated successfully            |
| `401` | Unauthenticated (missing/invalid token) |
| `403` | Forbidden (policy authorization failed) |
| `422` | Validation failed                       |
| `500` | Internal server error                   |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    PUT /api/v1/profile                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/profile.php:21                                             │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::put('/', [UserProfileController::class, 'update']);              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum     → Validates Bearer token, populates $request->user() │
│   2. throttle.role    → Role-based rate limiting                            │
│   3. https.enforce    → Enforces HTTPS in production                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/User/UpdateUserProfileRequest.php            │
│                                                                             │
│ Authorization Check (lines 10-30):                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     $routeUser = $this->route('user');                                  │ │
│ │     $currentUser = $this->user();                                       │ │
│ │                                                                         │ │
│ │     if ($currentUser === null) {                                        │ │
│ │         return false;                                                   │ │
│ │     }                                                                   │ │
│ │                                                                         │ │
│ │     // If no route user parameter, this is a profile update             │ │
│ │     if ($routeUser === null) {                                          │ │
│ │         return true;  // User updating their own profile                │ │
│ │     }                                                                   │ │
│ │     // ... admin check for other users                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Validation Rules (lines 37-82):                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'name' => ['sometimes', 'string', 'max:255'],                   │ │
│ │         'email' => [                                                    │ │
│ │             'sometimes',                                                │ │
│ │             'email',                                                    │ │
│ │             'max:255',                                                  │ │
│ │             'unique:users,email,' . $userId,                            │ │
│ │         ],                                                              │ │
│ │         'password' => [                                                 │ │
│ │             'sometimes',                                                │ │
│ │             'string',                                                   │ │
│ │             'min:8',                                                    │ │
│ │             'confirmed',                                                │ │
│ │             'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])...'  │ │
│ │         ],                                                              │ │
│ │         'phone' => ['sometimes', 'nullable', $phoneValidationRule],     │ │
│ │         'gender' => ['sometimes', 'nullable', 'integer', 'in:1,2,3,4'], │ │
│ │         'date_of_birth' => ['sometimes', 'nullable', 'date'],           │ │
│ │         'country' => ['sometimes', ...countryRules],                    │ │
│ │         'signature' => [                                                │ │
│ │             'sometimes', 'nullable', 'string', 'max:100',               │ │
│ │             'unique:users,signature,' . $userId                         │ │
│ │         ],                                                              │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/User/UserProfileController.php            │
│ Method: update(UpdateUserProfileRequest $request) at line 25                │
│                                                                             │
│ STEP 1: Get Authenticated User (line 27)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Null Check (lines 29-31)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('Authentication required');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Policy Authorization (line 33)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('update', $user);                                      │ │
│ │                                                                         │ │
│ │ // Uses UserPolicy::update() to verify user can update their own profile│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Call Service Layer (lines 35-42)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ try {                                                                   │ │
│ │     // Route through service layer                                      │ │
│ │     $updatedUser = $this->userService->updateUserProfile(               │ │
│ │         $user,                                                          │ │
│ │         $request->validated()                                           │ │
│ │     );                                                                  │ │
│ │                                                                         │ │
│ │     return ApiResponse::success(                                        │ │
│ │         new BootstrapUserResource($updatedUser),                        │ │
│ │         'Profile updated successfully'                                  │ │
│ │     );                                                                  │ │
│ │ } catch (\Exception $e) {                                               │ │
│ │     return ApiResponse::serverError('Failed to update profile...');     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/User/UserService.php                                     │
│ Method: updateUserProfile() at lines 66-83                                  │
│                                                                             │
│ STEP 1: Convert Array to DTO (lines 68-70)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = $userData instanceof UpdateUserDTO                               │ │
│ │     ? $userData                                                         │ │
│ │     : UpdateUserDTO::fromArray($userData);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Create and Execute Action (lines 72-76)                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $action = new UpdateUserAction(                                         │ │
│ │     userId: $user->id,                                                  │ │
│ │     dto: $dto                                                           │ │
│ │ );                                                                      │ │
│ │ $result = $action->execute();                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle Result (lines 78-82)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     throw new UserUpdateException(                                      │ │
│ │         $result->message ?? 'Failed to update user'                     │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return $result->data;  // Returns updated User model                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION EXECUTION                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Actions/User/UpdateUserAction.php                                 │
│ Method: execute() at lines 31-136                                           │
│                                                                             │
│ STEP 1: Begin Database Transaction (line 34)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return DB::transaction(function () {                                    │ │
│ │     // Find the user                                                    │ │
│ │     $user = User::findOrFail($this->userId);                            │ │
│ │     $originalData = $user->toArray();                                   │ │
│ │     ...                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Check for Updates (lines 46-52)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (!$this->dto->hasUpdates() && !$this->dto->hasRoles()) {             │ │
│ │     return ActionResult::success(                                       │ │
│ │         data: $user->load(['roles', 'permissions']),                    │ │
│ │         message: 'No changes to apply',                                 │ │
│ │         meta: ['user_id' => $user->id]                                  │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Update User Data (lines 55-58)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($this->dto->hasUpdates()) {                                         │ │
│ │     $user->update($this->dto->toModelArray());                          │ │
│ │     $user->refresh();                                                   │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ // toModelArray() returns only non-null fields:                         │ │
│ │ // ['name' => 'John', 'email' => 'john@example.com', ...]               │ │
│ │                                                                         │ │
│ │ // Password is automatically hashed by User model 'hashed' cast         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Log Success (lines 82-88)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Log::info('User updated successfully', [                                │ │
│ │     'user_id' => $user->id,                                             │ │
│ │     'admin_id' => Auth::id(),                                           │ │
│ │     'changes' => $this->dto->getUpdatedFields(),                        │ │
│ │     'roles_updated' => $this->dto->hasRoles(),                          │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return Result (lines 90-98)                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: $user->fresh(['roles', 'permissions']),                       │ │
│ │     message: 'User updated successfully',                               │ │
│ │     meta: [                                                             │ │
│ │         'user_id' => $user->id,                                         │ │
│ │         'fields_updated' => $this->dto->getUpdatedFields(),             │ │
│ │         'roles_updated' => $this->dto->hasRoles(),                      │ │
│ │     ]                                                                   │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UpdateUserDTO                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/User/UpdateUserDTO.php                                   │ │
│ │ Responsibility: Type-safe data transfer for profile updates            │ │
│ │ Reusable: YES (used by profile update, admin update)                    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toModelArray() → Returns non-null fields for Eloquent update        │ │
│ │   • hasUpdates() → Checks if there are model fields to update           │ │
│ │   • getUpdatedFields() → Returns list of fields being modified          │ │
│ │   • fromArray() → Static factory from validated request data            │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • ?string $name, ?string $email, ?string $password                    │ │
│ │   • ?string $phone, ?string $country, ?int $gender                      │ │
│ │   • ?string $dateOfBirth, ?string $signature                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User Model Password Cast                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Feature: 'hashed' cast for password field                               │ │
│ │                                                                         │ │
│ │ protected $casts = [                                                    │ │
│ │     'password' => 'hashed',  // Auto-hashes on assignment               │ │
│ │     ...                                                                 │ │
│ │ ];                                                                      │ │
│ │                                                                         │ │
│ │ Impact: Password is automatically hashed when set via:                  │ │
│ │   $user->update(['password' => 'plaintext']);                           │ │
│ │   → Stored as bcrypt hash                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: BootstrapUserResource (see profile-show docs)                    │
│                                                                             │
│ COMPONENT: ApiResponse (see previous docs)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS:                                                        │
│                                                                             │
│ 1. SELECT: Token validation (Sanctum middleware)                            │
│    Query: SELECT * FROM personal_access_tokens WHERE token = ?              │
│                                                                             │
│ 2. SELECT: User retrieval (Sanctum middleware)                              │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ 3. SELECT: User by ID (UpdateUserAction)                                    │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ 4. UPDATE: User record (UpdateUserAction)                                   │
│    Query: UPDATE users SET name=?, email=?, ... WHERE id = ?                │
│    Wrapped in: DB::transaction()                                            │
│                                                                             │
│ 5. SELECT: Refresh user after update                                        │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│   None - no caching in update flow                                          │
│                                                                             │
│ QUEUE OPERATIONS:                                                           │
│   None - synchronous update                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ Updated User model → BootstrapUserResource → ApiResponse::success()         │
│                                                                             │
│ (Same as profile-show endpoint - see that documentation for details)        │
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

| File                           | Used By Endpoints                     | Reusable    | Reasoning                          |
| ------------------------------ | ------------------------------------- | ----------- | ---------------------------------- |
| `UserProfileController.php`    | Profile endpoints only                | ⭕ Mixed    | Controller is endpoint-specific    |
| `UpdateUserProfileRequest.php` | Profile update, admin user update     | ✅ Reusable | Shared validation logic            |
| `UpdateUserDTO.php`            | Profile update, admin update, service | ✅ Reusable | Standard user update data transfer |
| `UpdateUserAction.php`         | UserService, any user update          | ✅ Reusable | Action pattern for user updates    |
| `UserService.php`              | Multiple controllers                  | ✅ Reusable | Central user business logic        |
| `BootstrapUserResource.php`    | Profile, Login, Register, Bootstrap   | ✅ Reusable | Standard user response format      |
| `ApiResponse.php`              | All API endpoints                     | ✅ Reusable | Global response utility            |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                | Source                   | Condition                        |
| -------------------- | ------------------------ | -------------------------------- |
| `email.unique`       | UpdateUserProfileRequest | Email already taken              |
| `password.min`       | UpdateUserProfileRequest | Password less than 8 characters  |
| `password.confirmed` | UpdateUserProfileRequest | password_confirmation mismatch   |
| `password.regex`     | UpdateUserProfileRequest | Missing required character types |
| `signature.unique`   | UpdateUserProfileRequest | Signature already taken          |
| `signature.max`      | UpdateUserProfileRequest | Signature exceeds 100 characters |
| `gender.in`          | UpdateUserProfileRequest | Gender not in 1,2,3,4            |
| `phone` (various)    | Phone validation rule    | Invalid phone format             |

### Business Logic Errors (400/403)

| Error                | Source               | Condition                          |
| -------------------- | -------------------- | ---------------------------------- |
| Authorization failed | UserPolicy::update() | User trying to update another user |

### System Errors (500)

| Error                        | Source           | Condition                      |
| ---------------------------- | ---------------- | ------------------------------ |
| Database transaction failure | UpdateUserAction | DB error during update         |
| UserUpdateException          | UserService      | Action returned failure result |

### Edge Cases

| Case                          | Behavior                                |
| ----------------------------- | --------------------------------------- |
| Empty request body            | Returns 200 with "No changes to apply"  |
| Only null fields provided     | Returns 200 with "No changes to apply"  |
| Password without confirmation | 422 - password_confirmation required    |
| Same email as current         | Email unique check ignores current user |
| Phone format inconsistency    | Formatted to E.164 before storage       |
| Concurrent update             | Last write wins (transaction isolation) |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE/ACTION          DATABASE
   │                       │                       │                       │                    │
   │  PUT /api/v1/profile  │                       │                       │                    │
   │  { name: "New Name" } │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │    Validate token     │                       │                    │
   │                       │───────────────────────────────────────────────────────────────────▶│
   │                       │◀───────────────────────────────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │ 2. throttle.role      │                       │                    │
   │                       │    Check rate limit   │                       │                    │
   │                       │                       │                       │                    │
   │                       │ 3. UpdateUserProfile  │                       │                    │
   │                       │    Request validates  │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 4. Get user from      │                    │
   │                       │                       │    request context    │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 5. authorize('update')│                    │
   │                       │                       │    via UserPolicy     │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 6. Call UserService   │                    │
   │                       │                       │    ->updateUserProfile│                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 7. Create DTO      │
   │                       │                       │                       │    from validated  │
   │                       │                       │                       │                    │
   │                       │                       │                       │ 8. Execute action  │
   │                       │                       │                       │    with transaction│
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │                    │
   │                       │                       │                       │    9. BEGIN TRANS  │
   │                       │                       │                       │                    │
   │                       │                       │                       │    10. SELECT user │
   │                       │                       │                       │                    │
   │                       │                       │                       │    11. UPDATE user │
   │                       │                       │                       │        SET name=...│
   │                       │                       │                       │                    │
   │                       │                       │                       │    12. COMMIT      │
   │                       │                       │◀───────────────────────────────────────────│
   │                       │                       │                       │                    │
   │                       │                       │ 13. Log update        │                    │
   │                       │                       │                       │                    │
   │                       │                       │◀──────────────────────│                    │
   │                       │                       │                       │                    │
   │                       │                       │ 14. Create resource   │                    │
   │                       │                       │                       │                    │
   │                       │                       │ 15. ApiResponse       │                    │
   │                       │                       │     ::success()       │                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │                       │                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
   │                       │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                                  |
| ------------------------- | --------------------------------------------------------- |
| New updatable field       | 1. Migration 2. UpdateUserProfileRequest 3. UpdateUserDTO |
| Field change notification | Add event listener for UserUpdated event                  |
| Change tracking/audit     | Implement observer on User model                          |
| Email change verification | Add to UpdateUserAction after email change                |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW UPDATABLE FIELD

**Example: Adding `bio` field to profile**

| Step  | File                                                         | What to Change              |
| ----- | ------------------------------------------------------------ | --------------------------- |
| **1** | **Database Migration**                                       | Add column to users table   |
| **2** | `app/Models/User/User.php`                                   | Add to $fillable array      |
| **3** | `app/Http/Requests/Api/V1/User/UpdateUserProfileRequest.php` | Add validation rule         |
| **4** | `app/DTOs/User/UpdateUserDTO.php`                            | Add property to constructor |
| **5** | `app/Http/Resources/V1/Auth/BootstrapUserResource.php`       | Add to toArray() response   |
| **6** | **API Documentation**                                        | Update this document        |

**Detailed Code Changes:**

```php
// STEP 1: Migration
Schema::table('users', function (Blueprint $table) {
    $table->text('bio')->nullable()->after('signature');
});

// STEP 2: User Model - add to $fillable
protected $fillable = [
    // ... existing fields
    'bio',
];

// STEP 3: UpdateUserProfileRequest - add to rules()
'bio' => ['sometimes', 'nullable', 'string', 'max:500'],

// STEP 4: UpdateUserDTO - add to constructor
public function __construct(
    // ... existing properties
    public readonly ?string $bio = null,
) {}

// And update toModelArray() accordingly

// STEP 5: BootstrapUserResource - add to toArray()
return [
    // ... existing fields
    'bio' => $this->bio,
];
```

#### ➖ REMOVING AN UPDATABLE FIELD

| Step  | File                           | What to Change         |
| ----- | ------------------------------ | ---------------------- |
| **1** | `UpdateUserProfileRequest.php` | Remove validation rule |
| **2** | `UpdateUserDTO.php`            | Remove property        |
| **3** | `BootstrapUserResource.php`    | Remove from response   |
| **4** | Migration (optional)           | Drop column if safe    |

#### ✏️ MODIFYING VALIDATION RULES

**Example: Making name required and adding minimum length**

```php
// BEFORE in UpdateUserProfileRequest::rules()
'name' => ['sometimes', 'string', 'max:255'],

// AFTER
'name' => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
```

### 🔗 Field Flow Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FIELD DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP Request Body { name: "New Name", ... }                                │
│       │                                                                     │
│       ▼                                                                     │
│  UpdateUserProfileRequest::rules()   ← Validates each field                 │
│       │                                                                     │
│       ▼                                                                     │
│  $request->validated()               ← Returns array of valid fields        │
│       │                                                                     │
│       ▼                                                                     │
│  UpdateUserDTO::fromArray()          ← Creates typed DTO                    │
│       │                                                                     │
│       ▼                                                                     │
│  UpdateUserDTO::toModelArray()       ← Filters out null values              │
│       │                                                                     │
│       ▼                                                                     │
│  User::update($data)                 ← Eloquent mass assignment             │
│       │                              │  + password 'hashed' cast             │
│       ▼                                                                     │
│  Database UPDATE                                                            │
│       │                                                                     │
│       ▼                                                                     │
│  $user->refresh()                    ← Reload from database                 │
│       │                                                                     │
│       ▼                                                                     │
│  BootstrapUserResource               ← Transforms for response              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                                   |
| ----------------------------- | -------------------------------------------------------- |
| Password 'hashed' cast        | Removing would store plaintext passwords                 |
| Unique constraint checks      | Ignores current user ID to allow no-change updates       |
| DB::transaction() wrapper     | Ensures atomic update of user + relationships            |
| UpdateUserDTO::toModelArray() | Filters nulls - breaking this causes unwanted overwrites |

### 🚨 Common Pitfalls

| Pitfall                       | Prevention                                               |
| ----------------------------- | -------------------------------------------------------- |
| Bypassing password hashing    | Always go through User model update with 'hashed' cast   |
| Overwriting with nulls        | UpdateUserDTO::toModelArray() filters null values        |
| Missing password_confirmation | 'confirmed' rule requires this field with password       |
| Email unique violation        | Unique rule ignores current user: unique:users,email,$id |
| Phone country mismatch        | Phone validation requires matching country code          |

### 📁 File Locations Quick Reference

```
routes/api/profile.php:21                           ← Route definition
app/Http/Controllers/Api/V1/User/
  └── UserProfileController.php:25-42               ← Controller method
app/Http/Requests/Api/V1/User/
  └── UpdateUserProfileRequest.php                  ← Request validation
app/DTOs/User/
  └── UpdateUserDTO.php                             ← Data transfer object
app/Services/User/
  └── UserService.php:66-83                         ← Service method
app/Actions/User/
  └── UpdateUserAction.php                          ← Update action
app/Http/Resources/V1/Auth/
  └── BootstrapUserResource.php                     ← Response transformer
app/Policies/
  └── UserPolicy.php                                ← Authorization policy
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not interact with MSAB real-time events.
> Section omitted per documentation standard.

---

## 9. Document Metadata

| Property            | Value                 |
| ------------------- | --------------------- |
| **Endpoint**        | `PUT /api/v1/profile` |
| **Domain**          | User                  |
| **Author**          | System Documentation  |
| **Created**         | 2026-02-04            |
| **Laravel Version** | 12.x                  |
| **PHP Version**     | 8.4+                  |
