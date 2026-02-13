# PUT /api/v1/coin-requests/user/default-reseller

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

The Update Default Reseller endpoint allows the authenticated user to set or change their preferred reseller for coin requests. This enables the app to pre-populate the reseller field when creating new coin requests, improving user experience.

### Responsibilities

- Validate that the provided `reseller_id` exists and belongs to a user with the Reseller role
- Update the authenticated user's `default_reseller_id` field in the database
- Reload the relationship to provide the updated reseller data in the response
- Return formatted reseller data for UI consumption

### What It Owns

| Owned                    | Description                                                          |
| ------------------------ | -------------------------------------------------------------------- |
| Default reseller update  | Updates the `default_reseller_id` field on the authenticated user    |
| Reseller role validation | Ensures only valid Reseller role users can be set as default         |
| Response formatting      | Transforms the reseller User model into ResellerResource JSON format |

### External Dependencies

| Dependency | Type           | Purpose                                |
| ---------- | -------------- | -------------------------------------- |
| Database   | Infrastructure | Users table with foreign key           |
| Sanctum    | Package        | Authentication middleware              |
| Spatie     | Package        | Role checking via `User::role()` scope |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT /api/v1/coin-requests/user/default-reseller
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config               |
| ------- | ------- | -------------------- |
| API     | User IP | `config/rate-limits` |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "reseller_id": "integer" // Required, must exist in users table with Reseller role
}
```

#### Field Details

| Field         | Type      | Constraints                                      | Example |
| ------------- | --------- | ------------------------------------------------ | ------- |
| `reseller_id` | `integer` | Required, must exist in users with Reseller role | `123`   |

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Default reseller updated successfully",
  "data": {
    "id": 123,
    "name": "John Reseller",
    "signature": "JRS001",
    "contact": "+1234567890",
    "avatar": "https://example.com/avatar.jpg"
  },
  "meta": {
    "timestamp": "2026-02-02T08:33:22.000000Z",
    "correlation_id": "uuid-v4-string"
  }
}
```

#### Response Field Details

| Field       | Type           | Description                            |
| ----------- | -------------- | -------------------------------------- |
| `id`        | `integer`      | Reseller user's unique identifier      |
| `name`      | `string`       | Reseller's display name                |
| `signature` | `string`       | Reseller's unique signature/ID code    |
| `contact`   | `string\|null` | Phone (formatted) or email as fallback |
| `avatar`    | `string\|null` | URL to reseller's avatar image         |

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "reseller_id": ["Please select a reseller."]
  },
  "meta": {
    "timestamp": "2026-02-02T08:33:22.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Invalid Reseller Error (422)

```json
{
  "status": "error",
  "message": "Validation failed",
  "data": null,
  "errors": {
    "reseller_id": ["The selected reseller is not valid."]
  },
  "meta": {
    "timestamp": "2026-02-02T08:33:22.000000Z",
    "correlation_id": "uuid"
  }
}
```

> **Note**: This error occurs when the provided ID doesn't exist or the user doesn't have the Reseller role.

#### ❌ Unauthenticated Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-02T08:33:22.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "User not authenticated",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-02T08:33:22.000000Z",
    "correlation_id": "uuid"
  }
}
```

> **Note**: This occurs when `$request->user()` returns null despite middleware passing (edge case).

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "Internal server error",
  "data": null,
  "meta": {
    "timestamp": "2026-02-02T08:33:22.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                |
| ----- | ---------------------------------------- |
| `200` | Default reseller updated successfully    |
| `401` | Missing or invalid auth token            |
| `401` | User not authenticated (edge case)       |
| `422` | Missing reseller_id field                |
| `422` | Invalid reseller_id (not found/not role) |
| `500` | Database or server error                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                PUT /api/v1/coin-requests/user/default-reseller              │
│                Body: { "reseller_id": 123 }                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/coin-requests.php:19                                       │
│ Route: Route::put('/user/default-reseller',                                 │
│        [ResellerController::class, 'updateDefault'])                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     // ...                                                              │ │
│ │     Route::put('/user/default-reseller',                                │ │
│ │         [ResellerController::class, 'updateDefault']);                  │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Sanctum bearer token, sets $request->user()  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Reseller/UpdateDefaultResellerRequest.php    │
│                                                                             │
│ This FormRequest validates the incoming request BEFORE the controller       │
│ method executes. If validation fails, a 422 response is returned.           │
│                                                                             │
│ AUTHORIZATION CHECK:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return true;  // No additional authorization beyond auth:sanctum    │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ VALIDATION RULES:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function rules(): array                                          │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'reseller_id' => [                                              │ │
│ │             'required',                                                 │ │
│ │             'integer',                                                  │ │
│ │             Rule::exists('users', 'id')->where(function ($query) {      │ │
│ │                 // Only allow selecting users with Reseller role        │ │
│ │                 $query->whereIn('id', User::role('Reseller')->pluck('id')); │
│ │             }),                                                         │ │
│ │         ],                                                              │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CUSTOM ERROR MESSAGES:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function messages(): array                                       │ │
│ │ {                                                                       │ │
│ │     return [                                                            │ │
│ │         'reseller_id.required' => 'Please select a reseller.',          │ │
│ │         'reseller_id.exists' => 'The selected reseller is not valid.',  │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/ResellerController.php:76          │
│ Method: updateDefault(UpdateDefaultResellerRequest $request): JsonResponse  │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Verify user is authenticated (defensive check)                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized('User not authenticated');         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Get validated reseller_id                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $resellerId = $request->validated('reseller_id');                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Update user's default_reseller_id                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->update(['default_reseller_id' => $resellerId]);                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Reload the relationship to get fresh data                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user->load('defaultReseller');                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Return formatted reseller response                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new ResellerResource($user->defaultReseller),                       │ │
│ │     'Default reseller updated successfully'                             │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ This endpoint does NOT use a dedicated service layer.                       │
│                                                                             │
│ The controller directly:                                                    │
│   1. Updates the User model via Eloquent                                    │
│   2. Reloads the relationship for response formatting                       │
│                                                                             │
│ This is appropriate for simple update operations without complex business   │
│ logic. The validation (ensuring Reseller role) is handled by FormRequest.   │
│                                                                             │
│ USER MODEL RELATIONSHIP:                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // app/Models/User/User.php:383                                         │ │
│ │ /**                                                                     │ │
│ │  * Get the user's default reseller.                                     │ │
│ │  *                                                                      │ │
│ │  * @return BelongsTo<User, $this>                                       │ │
│ │  */                                                                     │ │
│ │ public function defaultReseller(): BelongsTo                            │ │
│ │ {                                                                       │ │
│ │     return $this->belongsTo(User::class, 'default_reseller_id');        │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ USER MODEL FILLABLE (allows mass assignment):                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // app/Models/User/User.php:78                                          │ │
│ │ protected $fillable = [                                                 │ │
│ │     // ...                                                              │ │
│ │     'default_reseller_id',  // line 94                                  │ │
│ │     // ...                                                              │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: UpdateDefaultResellerRequest (FormRequest)                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Requests/Api/V1/Reseller/UpdateDefaultResellerRequest.php │
│ │ Responsibility: Validate and authorize default reseller update request  │ │
│ │ Reusable: NO (endpoint-specific)                                        │ │
│ │ Why It Exists: Encapsulate validation logic with custom error messages  │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • authorize() → Always returns true (auth middleware handles)         │ │
│ │   • rules() → Validates reseller_id exists with Reseller role           │ │
│ │   • messages() → Custom user-friendly error messages                    │ │
│ │                                                                         │ │
│ │ Validation Strategy:                                                    │ │
│ │   Uses Rule::exists() with a where clause that queries                  │ │
│ │   User::role('Reseller')->pluck('id') to get valid reseller IDs         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: User (Model)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/User/User.php                                          │ │
│ │ Responsibility: Core user entity with default reseller relationship     │ │
│ │ Reusable: YES (central model used across entire application)            │ │
│ │ Why It Exists: Represents users in the system                           │ │
│ │                                                                         │ │
│ │ Key Fields:                                                             │ │
│ │   • default_reseller_id → Foreign key to users table (nullable)         │ │
│ │                                                                         │ │
│ │ Key Relationships:                                                      │ │
│ │   • defaultReseller() → BelongsTo(User::class, 'default_reseller_id')   │ │
│ │   • assignedUsers() → HasMany(User::class, 'default_reseller_id')       │ │
│ │                                                                         │ │
│ │ Key Scopes (used in validation):                                        │ │
│ │   • role('Reseller') → Spatie's HasRoles trait filter                   │ │
│ │                                                                         │ │
│ │ Key Cast:                                                               │ │
│ │   • phone → PhoneCast::class (auto-formats as PhoneNumber object)       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ResellerResource (API Resource)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Resources/V1/Economy/ResellerResource.php                │ │
│ │ Responsibility: Transform User model into reseller JSON response        │ │
│ │ Reusable: YES (used by /resellers, /user/default-reseller GET/PUT)      │ │
│ │ Why It Exists: Consistent reseller data format across API               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • toArray(Request $request) → Returns:                                │ │
│ │     ┌───────────────────────────────────────────────────────────────┐   │ │
│ │     │ return [                                                      │   │ │
│ │     │     'id' => $this->id,                                        │   │ │
│ │     │     'name' => $this->name,                                    │   │ │
│ │     │     'signature' => $this->signature,                          │   │ │
│ │     │     'contact' => $this->formatted_phone ?? $this->email,      │   │ │
│ │     │     'avatar' => $this->avatar,                                │   │ │
│ │     │ ];                                                            │   │ │
│ │     └───────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized API response formatting                    │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent response structure across entire API          │ │
│ │                                                                         │ │
│ │ Key Methods Used:                                                       │ │
│ │   • success($data, $message) → Standard success response (200)          │ │
│ │   • unauthorized($message) → Unauthorized error response (401)          │ │
│ │   • getCorrelationId() → Request tracking ID from header or UUID        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: Rule::exists (Validation Rule)                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: vendor/laravel/framework/src/Illuminate/Validation/Rules/Exists.php│
│ │ Responsibility: Validate that a value exists in a database table        │ │
│ │ Reusable: YES (Laravel built-in validation rule)                        │ │
│ │ Why It Exists: Database existence validation with custom constraints    │ │
│ │                                                                         │ │
│ │ Usage in This Endpoint:                                                 │ │
│ │   • Rule::exists('users', 'id')->where(fn($q) => ...)                   │ │
│ │   • Ensures the ID exists AND belongs to a Reseller role user           │ │
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
│ 1. SELECT: Get all Reseller role user IDs (during validation)               │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ -- User::role('Reseller')->pluck('id')                               │ │
│    │ SELECT users.id                                                      │ │
│    │ FROM users                                                           │ │
│    │ INNER JOIN model_has_roles ON users.id = model_has_roles.model_id    │ │
│    │   AND model_has_roles.model_type = 'App\\Models\\User\\User'         │ │
│    │ INNER JOIN roles ON model_has_roles.role_id = roles.id               │ │
│    │ WHERE roles.name = 'Reseller'                                        │ │
│    │   AND users.deleted_at IS NULL                                       │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: UpdateDefaultResellerRequest::rules()                            │
│    Tables: users, model_has_roles, roles                                    │
│                                                                             │
│ 2. SELECT: Check if reseller_id exists in results (validation)              │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ -- Rule::exists check                                                │ │
│    │ SELECT COUNT(*) AS aggregate                                         │ │
│    │ FROM users                                                           │ │
│    │ WHERE id = {$reseller_id}                                            │ │
│    │   AND id IN ({$reseller_ids_from_step_1})                            │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: Laravel validation layer                                         │
│    Tables: users                                                             │
│                                                                             │
│ 3. UPDATE: Set user's default_reseller_id                                   │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ UPDATE users                                                         │ │
│    │ SET default_reseller_id = {$reseller_id},                            │ │
│    │     updated_at = NOW()                                               │ │
│    │ WHERE id = {$authenticated_user_id}                                  │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: User::update()                                                   │
│    Tables: users                                                             │
│                                                                             │
│ 4. SELECT: Load the defaultReseller relationship                            │
│    Query Pattern:                                                           │
│    ┌─────────────────────────────────────────────────────────────────────┐ │
│    │ -- $user->load('defaultReseller')                                    │ │
│    │ SELECT *                                                             │ │
│    │ FROM users                                                           │ │
│    │ WHERE users.id = {$new_reseller_id}                                  │ │
│    │   AND users.deleted_at IS NULL                                       │ │
│    │ LIMIT 1                                                              │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│    Source: Eloquent relationship loading                                    │
│    Tables: users                                                             │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
│ MODEL EVENTS TRIGGERED:                                                     │
│   • User::updated event → Fires UserUpdated event (cache invalidation)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ RESOURCE TRANSFORMATION:                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // Single resource transformation                                       │ │
│ │ new ResellerResource($user->defaultReseller)                            │ │
│ │ └─> Calls ResellerResource::toArray()                                   │ │
│ │                                                                         │ │
│ │ // app/Http/Resources/V1/Economy/ResellerResource.php:25                │ │
│ │ return [                                                                │ │
│ │     'id' => $this->id,                                                  │ │
│ │     'name' => $this->name,                                              │ │
│ │     'signature' => $this->signature,                                    │ │
│ │     'contact' => $this->formatted_phone ?? $this->email,                │ │
│ │     'avatar' => $this->avatar,                                          │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ FINAL WRAPPING: ApiResponse                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ // app/Http/Utils/ApiResponse.php:15                                    │ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Default reseller updated successfully',               │ │
│ │     'data' => $data,  // ResellerResource                               │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => self::getCorrelationId(),                   │ │
│ │     ],                                                                  │ │
│ │ ], 200);                                                                │ │
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

| File                                   | Used By Endpoints                                          | Reusable | Reasoning                                           |
| -------------------------------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------- |
| `ResellerController.php`               | `/resellers`, `/user/default-reseller` GET/PUT             | ⭕       | Reseller-specific but has multiple methods          |
| `UpdateDefaultResellerRequest.php`     | `PUT /user/default-reseller` only                          | ❌       | Endpoint-specific validation                        |
| `ResellerResource.php`                 | `/resellers`, `/user/default-reseller`, `/coin-requests/*` | ✅       | Standard reseller data format across economy domain |
| `ApiResponse.php`                      | All API endpoints                                          | ✅       | Universal response formatter                        |
| `User.php`                             | Entire application                                         | ✅       | Core user model                                     |
| `User::defaultReseller()` relationship | `/user/default-reseller`, coin request creation            | ✅       | Reusable relationship for any reseller lookup       |
| `User::role()` scope                   | Role-based queries across application                      | ✅       | Spatie Permission package scope                     |
| `Rule::exists()`                       | All validation requiring DB existence                      | ✅       | Laravel built-in validation rule                    |
| `routes/api/coin-requests.php`         | Coin request domain routes                                 | ⭕       | Domain-specific route file                          |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                                     | Source                         | Condition                           |
| ----------------------------------------- | ------------------------------ | ----------------------------------- |
| `reseller_id.required`                    | `UpdateDefaultResellerRequest` | Missing `reseller_id` in body       |
| `reseller_id.integer`                     | `UpdateDefaultResellerRequest` | `reseller_id` is not an integer     |
| `reseller_id.exists` (not valid reseller) | `UpdateDefaultResellerRequest` | ID doesn't exist in users table     |
| `reseller_id.exists` (not Reseller role)  | `UpdateDefaultResellerRequest` | User exists but lacks Reseller role |

### Authentication Errors (401)

| Error                    | Source                                           | Condition                       |
| ------------------------ | ------------------------------------------------ | ------------------------------- |
| "Unauthenticated."       | `auth:sanctum` middleware                        | Missing or invalid Bearer token |
| "Unauthenticated."       | `auth:sanctum` middleware                        | Expired Sanctum token           |
| "User not authenticated" | `ResellerController::updateDefault()` line 80-82 | `$request->user()` returns null |

### Business Logic Errors (400)

This endpoint has **no business logic errors** - all validation is handled by the FormRequest.

### System Errors (500)

| Error                 | Source              | Condition                              |
| --------------------- | ------------------- | -------------------------------------- |
| Database connection   | Eloquent            | MySQL connection failure               |
| Query execution error | `User::update()`    | Constraint violation (unlikely)        |
| Role query failure    | `User::role()`      | Spatie tables missing/corrupted        |
| Foreign key violation | Database constraint | Concurrent deletion of reseller (rare) |

### Edge Cases

| Case                                    | Behavior                                               |
| --------------------------------------- | ------------------------------------------------------ |
| Setting same reseller again             | Works normally, no error (idempotent)                  |
| Reseller is soft-deleted after query    | Validation passes, update may succeed but FK null risk |
| User setting themselves as reseller     | Fails validation (user must have Reseller role)        |
| Reseller loses role after validation    | Edge case - update succeeds, relationship intact       |
| High concurrency on reseller validation | Possible race condition - validation vs actual update  |
| User is in the process of being deleted | Auth middleware prevents access (token invalid)        |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              FORMREQUEST          CONTROLLER            USER MODEL              DATABASE
   │                       │                       │                    │                       │                     │
   │  PUT /api/v1/coin-    │                       │                    │                       │                     │
   │  requests/user/       │                       │                    │                       │                     │
   │  default-reseller     │                       │                    │                       │                     │
   │  { "reseller_id": 123 }                       │                    │                       │                     │
   │──────────────────────>│                       │                    │                       │                     │
   │                       │                       │                    │                       │                     │
   │                       │ 1. auth:sanctum       │                    │                       │                     │
   │                       │    validate token     │                    │                       │                     │
   │                       │──────────────────────>│                    │                       │                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │ 2. Authorize       │                       │                     │
   │                       │                       │    (returns true)  │                       │                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │ 3. Get Reseller    │                       │                     │
   │                       │                       │    role user IDs   │                       │                     │
   │                       │                       │───────────────────────────────────────────────────────────────────>│
   │                       │                       │<───────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                       │                     │
   │                       │                       │ 4. Validate        │                       │                     │
   │                       │                       │    reseller_id     │                       │                     │
   │                       │                       │    exists in IDs   │                       │                     │
   │                       │                       │───────────────────────────────────────────────────────────────────>│
   │                       │                       │<───────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                       │                     │
   │                       │                       │ 5. If invalid:     │                       │                     │
   │                       │                       │    return 422      │                       │                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │ 6. Pass to         │                       │                     │
   │                       │                       │    controller      │                       │                     │
   │                       │                       │───────────────────>│                       │                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │ 7. $request->user()   │                     │
   │                       │                       │                    │──────────────────────>│                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │ 8. Get validated      │                     │
   │                       │                       │                    │    reseller_id        │                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │ 9. $user->update()    │                     │
   │                       │                       │                    │──────────────────────>│                     │
   │                       │                       │                    │                       │ 10. UPDATE query    │
   │                       │                       │                    │                       │───────────────────>│
   │                       │                       │                    │                       │<───────────────────│
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │                       │ 11. UserUpdated     │
   │                       │                       │                    │                       │     event fired     │
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │ 12. $user->load()     │                     │
   │                       │                       │                    │    defaultReseller    │                     │
   │                       │                       │                    │──────────────────────>│                     │
   │                       │                       │                    │                       │ 13. SELECT query    │
   │                       │                       │                    │                       │───────────────────>│
   │                       │                       │                    │                       │<───────────────────│
   │                       │                       │                    │<──────────────────────│                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │ 14. Transform via     │                     │
   │                       │                       │                    │     ResellerResource  │                     │
   │                       │                       │                    │                       │                     │
   │                       │                       │                    │ 15. Wrap in           │                     │
   │                       │                       │                    │     ApiResponse::     │                     │
   │                       │                       │                    │     success()         │                     │
   │                       │                       │                    │                       │                     │
   │                       │<──────────────────────────────────────────│                       │                     │
   │<──────────────────────│                       │                    │                       │                     │
   │                       │                       │                    │                       │                     │
   │  200 OK + JSON        │                       │                    │                       │                     │
   │                       │                       │                    │                       │                     │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                               |
| ------------------------- | ------------------------------------------------------ |
| New validation rules      | `UpdateDefaultResellerRequest::rules()`                |
| New response field        | `ResellerResource::toArray()`                          |
| Pre-update business logic | Create a Service class and inject into controller      |
| Post-update notifications | Listen to `UserUpdated` event in event handler         |
| Audit logging             | Add observer or use model events                       |
| Rate limiting per user    | Add middleware group in `routes/api/coin-requests.php` |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW REQUEST FIELD

| Step  | File                                                                 | What to Change                     |
| ----- | -------------------------------------------------------------------- | ---------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Reseller/UpdateDefaultResellerRequest.php` | Add validation rule                |
| **2** | `app/Http/Controllers/Api/V1/Agency/ResellerController.php`          | Use `$request->validated('field')` |
| **3** | `app/Models/User/User.php` (if persisting)                           | Add to `$fillable` array           |
| **4** | Database Migration (if new column)                                   | Add column to `users` table        |

**Example: Adding `notify_on_change` field**

```php
// UpdateDefaultResellerRequest.php
public function rules(): array
{
    return [
        'reseller_id' => [...],
        'notify_on_change' => ['sometimes', 'boolean'],  // <-- add here
    ];
}

// ResellerController.php
$notifyOnChange = $request->validated('notify_on_change', false);
// Use $notifyOnChange for notification logic
```

#### ➕ ADDING A NEW RESPONSE FIELD

| Step  | File                                                 | What to Change                        |
| ----- | ---------------------------------------------------- | ------------------------------------- |
| **1** | `app/Http/Resources/V1/Economy/ResellerResource.php` | Add field to `toArray()` return array |

#### ➖ REMOVING A REQUEST FIELD

| Step  | File                                                                 | What to Change            |
| ----- | -------------------------------------------------------------------- | ------------------------- |
| **1** | `app/Http/Requests/Api/V1/Reseller/UpdateDefaultResellerRequest.php` | Remove validation rule    |
| **2** | `app/Http/Controllers/Api/V1/Agency/ResellerController.php`          | Remove usage of the field |

#### 🔄 MODIFYING VALIDATION RULES

| Step  | File                                                                 | What to Change              |
| ----- | -------------------------------------------------------------------- | --------------------------- |
| **1** | `app/Http/Requests/Api/V1/Reseller/UpdateDefaultResellerRequest.php` | Modify rules array          |
| **2** | Same file                                                            | Update messages() if needed |

### 🔗 Field Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│               FIELD FLOW: request.reseller_id → database → response          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request Body { "reseller_id": 123 }                                         │
│       │                                                                      │
│       ▼                                                                      │
│  UpdateDefaultResellerRequest  → Validates reseller_id exists with role      │
│       │                                                                      │
│       ▼                                                                      │
│  ResellerController            → Gets validated value, updates user          │
│       │                                                                      │
│       ▼                                                                      │
│  User::update()                → Sets default_reseller_id in database        │
│       │                                                                      │
│       ▼                                                                      │
│  UserUpdated Event             → Published for cache invalidation            │
│       │                                                                      │
│       ▼                                                                      │
│  User::load('defaultReseller') → Reloads relationship with new data          │
│       │                                                                      │
│       ▼                                                                      │
│  ResellerResource              → Transforms User → JSON structure            │
│       │                                                                      │
│       ▼                                                                      │
│  ApiResponse::success()        → Wraps in standard response envelope         │
│       │                                                                      │
│       ▼                                                                      │
│  JSON Response                 → Final HTTP response to client               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 📋 Field Modification Checklists

#### Adding role-based restrictions

- [ ] Add role check in `UpdateDefaultResellerRequest::authorize()`
- [ ] Return 403 Forbidden if unauthorized
- [ ] Document new authorization requirement
- [ ] Add test cases for unauthorized users

#### Changing the reseller validation logic

- [ ] Modify `Rule::exists()->where()` in `UpdateDefaultResellerRequest::rules()`
- [ ] Update error messages in `messages()` method
- [ ] Test with edge cases (deleted users, role changes)
- [ ] Update API documentation

#### Adding caching for Reseller role IDs

- [ ] Cache the `User::role('Reseller')->pluck('id')` result
- [ ] Add cache invalidation when users get/lose Reseller role
- [ ] Consider cache TTL vs data freshness tradeoff
- [ ] Add cache tags for targeted invalidation

### ⚠️ What Should NOT Be Modified Casually

| Component                               | Reason                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| `default_reseller_id` foreign key       | Database constraint with cascading delete behavior              |
| `Rule::exists` validation logic         | Security-critical - prevents setting arbitrary user as reseller |
| `ApiResponse` structure                 | Breaking change for all API consumers                           |
| `ResellerResource` field names          | Breaking change for all endpoints using this resource           |
| Authentication middleware               | Security-critical - requires thorough testing                   |
| User model's `$fillable` for this field | Removing would break the update functionality                   |
| Defensive null check for user           | Keep even if middleware should handle auth                      |

### 🚨 Common Pitfalls

| Pitfall                              | Prevention                                                      |
| ------------------------------------ | --------------------------------------------------------------- |
| Forgetting to reload relationship    | Always use `$user->load()` after update to get fresh data       |
| N+1 query in validation              | `User::role()` is executed once, but consider caching for scale |
| Race condition in validation         | Reseller may lose role between validation and update (rare)     |
| Breaking ResellerResource contract   | Any changes affect multiple endpoints (/resellers, GET, etc.)   |
| Removing defensive null check        | Keep `$user === null` check even if middleware should prevent   |
| Not handling validation errors in FE | Always return proper 422 responses with field-specific errors   |
| Forgetting to test role validation   | Test with: valid reseller, non-reseller user, non-existent ID   |
| Mass-assignment vulnerability        | `default_reseller_id` is in `$fillable` - verify it should be   |

### 📁 File Locations Quick Reference

```
routes/api/coin-requests.php                        ← Route definition (line 19)
app/Http/Controllers/Api/V1/Agency/
  └── ResellerController.php                        ← Controller (updateDefault method, line 76)
app/Http/Requests/Api/V1/Reseller/
  └── UpdateDefaultResellerRequest.php              ← Request validation
app/Http/Resources/V1/Economy/
  └── ResellerResource.php                          ← Response transformer
app/Http/Utils/
  └── ApiResponse.php                               ← Response utility
app/Models/User/
  └── User.php                                      ← User model (defaultReseller, line 383)
                                                      $fillable includes default_reseller_id (line 94)
database/migrations/
  └── 0001_01_01_000000_create_users_table.php      ← Migration (default_reseller_id, line 47)
```

---

## Document Metadata

| Property            | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Endpoint**        | `PUT /api/v1/coin-requests/user/default-reseller` |
| **Domain**          | Economy                                           |
| **Author**          | System Documentation                              |
| **Created**         | 2026-02-02                                        |
| **Laravel Version** | 12.x                                              |
| **PHP Version**     | 8.4                                               |
