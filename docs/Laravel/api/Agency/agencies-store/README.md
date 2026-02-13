# POST /api/v1/agencies

> **Domain**: Agency  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-03

---

## 1. Domain Overview

### Purpose

This endpoint enables authenticated users to submit a new agency application. It creates an agency with PENDING status and automatically registers the applicant as the agency owner/member.

### Responsibilities

- Validate user eligibility (not blocked, no existing agency)
- Create agency record with PENDING status
- Create owner as first AgencyMember with OWNER role
- Handle pre-uploaded ImageKit URLs for logo and national ID images
- Cleanup uploaded files on failure

### What It Owns

| Owned                   | Description                                   |
| ----------------------- | --------------------------------------------- |
| Agency Creation         | Creates new `agencies` record                 |
| AgencyMember Creation   | Creates owner as first member with OWNER role |
| File Cleanup on Failure | Deletes pre-uploaded images if creation fails |

### External Dependencies

| Dependency | Type           | Purpose                                  |
| ---------- | -------------- | ---------------------------------------- |
| Database   | Infrastructure | Stores agency and agency_members records |
| ImageKit   | External API   | CDN for logo and national ID images      |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/agencies
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key     | Config                  |
| ------- | ------- | ----------------------- |
| Default | User ID | Laravel default limiter |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```json
{
  "name": "string", // Required, max 255 chars
  "country": "string", // Required, 2-letter ISO code
  "address": "string", // Required, max 1000 chars
  "logo_url": "string|null", // Optional, must be ImageKit URL
  "logo_file_id": "string|null", // Required if logo_url provided
  "national_id_images": [
    // Optional, array of 1-2 images
    {
      "url": "string", // Required, ImageKit URL
      "file_id": "string", // Required, ImageKit file ID
      "side": "string" // Required, "front" or "back"
    }
  ],
  "coin_reseller_id": "integer|null" // Optional, must exist in users table
}
```

#### Field Details

| Field                          | Type      | Constraints                     | Example                                 |
| ------------------------------ | --------- | ------------------------------- | --------------------------------------- |
| `name`                         | `string`  | Required, max 255               | `"Awesome Agency"`                      |
| `country`                      | `string`  | Required, 2-letter ISO          | `"PK"`                                  |
| `address`                      | `string`  | Required, max 1000              | `"123 Main St, Lahore"`                 |
| `logo_url`                     | `string`  | Optional, ImageKit URL regex    | `"https://ik.imagekit.io/.../logo.jpg"` |
| `logo_file_id`                 | `string`  | Required with logo_url, max 100 | `"abc123xyz"`                           |
| `national_id_images`           | `array`   | Optional, min 1, max 2 items    | See schema above                        |
| `national_id_images.*.url`     | `string`  | Required, ImageKit URL          | `"https://ik.imagekit.io/.../id.jpg"`   |
| `national_id_images.*.file_id` | `string`  | Required, max 100               | `"def456uvw"`                           |
| `national_id_images.*.side`    | `string`  | Required, in: front, back       | `"front"`                               |
| `coin_reseller_id`             | `integer` | Optional, exists in users       | `42`                                    |

---

### Response Schemas

#### ✅ Success Response (201)

```json
{
  "status": "success",
  "message": "Agency application submitted successfully.",
  "data": {
    "id": 1,
    "name": "Awesome Agency",
    "country": "PK",
    "logo": "https://ik.imagekit.io/.../logo.jpg",
    "status": "pending",
    "status_label": "Pending",
    "created_at": "2026-02-03T03:09:35.000000Z",
    "owner": {
      "id": 123,
      "name": "John Doe",
      "avatar": "https://..."
    }
  },
  "meta": {
    "timestamp": "2026-02-03T03:09:35.000000Z"
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
    "name": ["Agency name is required."],
    "country": ["Country must be a 2-letter ISO code (e.g., US, PK)."]
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null
}
```

#### ❌ Business Logic Error (422)

```json
{
  "status": "error",
  "message": "You already have an agency application or an existing agency.",
  "data": null,
  "errors": {
    "user_id": ["User already has an agency."]
  }
}
```

### HTTP Status Codes

| Code  | Condition                                         |
| ----- | ------------------------------------------------- |
| `201` | Agency application created successfully           |
| `401` | Unauthenticated - missing or invalid token        |
| `403` | Unauthorized - user blocked or already has agency |
| `422` | Validation failed or business rule violation      |
| `500` | Database or system error                          |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/agencies                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/agencies.php:29                                            │
│ Route: Route::post('/', [AgencyController::class, 'store'])                 │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum  → Validates Bearer token, sets authenticated user        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 FIRST CODE EXECUTED                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Agency/CreateAgencyRequest.php               │
│                                                                             │
│ STEP 1: Authorization Check                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function authorize(): bool                                       │ │
│ │ {                                                                       │ │
│ │     return $this->user() !== null;                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Validation Rules                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name'     => ['required', 'string', 'max:255']                         │ │
│ │ 'country'  => ['required', 'string', 'size:2']                          │ │
│ │ 'address'  => ['required', 'string', 'max:1000']                        │ │
│ │ 'logo_url' => ['nullable', 'url', 'regex:' . $urlPattern]               │ │
│ │ 'logo_file_id' => ['nullable', 'string', 'max:100', 'required_with:..'] │ │
│ │ 'national_id_images' => ['nullable', 'array', 'min:1', 'max:2']         │ │
│ │ 'national_id_images.*.url' => ['required', 'url', 'regex:...']          │ │
│ │ 'national_id_images.*.file_id' => ['required', 'string', 'max:100']     │ │
│ │ 'national_id_images.*.side' => ['required', 'string', 'in:front,back']  │ │
│ │ 'coin_reseller_id' => ['nullable', 'integer', 'exists:users,id']        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: ImageKit URL regex validates against config('imagekit.url_endpoint')  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Agency/AgencyController.php:80-143        │
│ Method: store(CreateAgencyRequest $request, CreateAgencyAction $action,     │
│               AgencyUploadService $uploadService)                           │
│                                                                             │
│ STEP 1: Policy Authorization                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('create', Agency::class);                              │ │
│ │                                                                         │ │
│ │ // AgencyPolicy::create() checks:                                       │ │
│ │ // - User is not blocked                                                │ │
│ │ // - User does not already own an agency                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Extract Logo Data                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $logoData = null;                                                       │ │
│ │ if (isset($validated['logo_url'])) {                                    │ │
│ │     $logoData = [                                                       │ │
│ │         'url' => $validated['logo_url'],                                │ │
│ │         'file_id' => $validated['logo_file_id'],                        │ │
│ │     ];                                                                  │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Build DTO                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $dto = CreateAgencyDTO::fromArray([                                     │ │
│ │     'user_id' => $user->id,                                             │ │
│ │     'name' => $validated['name'],                                       │ │
│ │     'country' => $validated['country'],                                 │ │
│ │     'address' => $validated['address'],                                 │ │
│ │     'logo' => $logoData['url'] ?? null,                                 │ │
│ │     'logo_file_id' => $logoData['file_id'] ?? null,                     │ │
│ │     'national_id_images' => $nationalIdImages,                          │ │
│ │     'coin_reseller_id' => $validated['coin_reseller_id'] ?? null,       │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Execute Action                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($dto);                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Handle Failure (Cleanup)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $result->isSuccess()) {                                           │ │
│ │     if ($logoData !== null) {                                           │ │
│ │         $uploadService->deleteLogo($logoData['file_id']);               │ │
│ │     }                                                                   │ │
│ │     if ($nationalIdImages !== null) {                                   │ │
│ │         $uploadService->deleteNationalIdImages($nationalIdImages);      │ │
│ │     }                                                                   │ │
│ │     return ApiResponse::error($result->getMessage(), ...);              │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Return Success Response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     new AgencyResource($result->getData()),                             │ │
│ │     $result->getMessage() ?? 'Agency application submitted...',         │ │
│ │     [],                                                                 │ │
│ │     201,                                                                │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ ACTION: CreateAgencyAction (app/Actions/Agency/CreateAgencyAction.php)      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/Agency/CreateAgencyAction.php:24-71                   │ │
│ │ Method: execute(CreateAgencyDTO $dto): ActionResult                     │ │
│ │                                                                         │ │
│ │ STEP 1: Check for existing agency                                       │ │
│ │ ────────────────────────────────────────────────────────────────────    │ │
│ │ if (Agency::where('user_id', $dto->userId)->exists()) {                 │ │
│ │     return ActionResult::failure(                                       │ │
│ │         message: 'You already have an agency...',                       │ │
│ │         errors: ['user_id' => ['User already has an agency.']],         │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ STEP 2: Database Transaction                                            │ │
│ │ ────────────────────────────────────────────────────────────────────    │ │
│ │ return DB::transaction(function () use ($dto) {                         │ │
│ │     // Create the agency                                                │ │
│ │     $agency = Agency::create([                                          │ │
│ │         'user_id' => $dto->userId,                                      │ │
│ │         'name' => $dto->name,                                           │ │
│ │         'country' => $dto->country,                                     │ │
│ │         'address' => $dto->address,                                     │ │
│ │         'logo' => $dto->logo,                                           │ │
│ │         'logo_file_id' => $dto->logoFileId,                             │ │
│ │         'national_id_images' => $dto->nationalIdImages,                 │ │
│ │         'coin_reseller_id' => $dto->coinResellerId,                     │ │
│ │         'status' => AgencyStatus::PENDING,                              │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     // Create owner as first member                                     │ │
│ │     AgencyMember::create([                                              │ │
│ │         'agency_id' => $agency->id,                                     │ │
│ │         'user_id' => $dto->userId,                                      │ │
│ │         'role' => AgencyMemberRole::OWNER,                              │ │
│ │         'status' => AgencyMemberStatus::ACTIVE,                         │ │
│ │     ]);                                                                 │ │
│ │                                                                         │ │
│ │     $agency->load('owner');                                             │ │
│ │                                                                         │ │
│ │     return ActionResult::success(data: $agency, ...);                   │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: CreateAgencyDTO (Data Transfer Object)                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/DTOs/Agency/CreateAgencyDTO.php                               │ │
│ │ Responsibility: Immutable data container for agency creation          │ │
│ │ Reusable: YES (standard DTO pattern)                                   │ │
│ │ Why It Exists: Type-safe data transfer between layers                  │ │
│ │                                                                         │ │
│ │ Properties:                                                             │ │
│ │   • userId: int                                                         │ │
│ │   • name: string                                                        │ │
│ │   • country: string (uppercase by fromArray)                            │ │
│ │   • address: string                                                     │ │
│ │   • logo: ?string                                                       │ │
│ │   • logoFileId: ?string                                                 │ │
│ │   • nationalIdImages: ?array                                            │ │
│ │   • coinResellerId: ?int                                                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • fromArray() → Creates DTO from validated request data               │ │
│ │   • toArray() → Converts DTO back to array                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyPolicy (Authorization)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Agency/AgencyPolicy.php:42-55                        │ │
│ │ Responsibility: Authorization logic for agency operations               │ │
│ │ Reusable: YES (shared across all agency endpoints)                      │ │
│ │ Why It Exists: Centralized authorization rules                          │ │
│ │                                                                         │ │
│ │ Key Method - create():                                                  │ │
│ │   • Returns false if user is blocked                                    │ │
│ │   • Returns false if user already owns an agency (any status)           │ │
│ │   • Otherwise returns true                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: AgencyUploadService (Cleanup)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Agency/AgencyUploadService.php                       │ │
│ │ Responsibility: Delete pre-uploaded images on failure                   │ │
│ │ Reusable: YES (used by other agency operations)                         │ │
│ │ Why It Exists: Cleanup orphaned CDN files                               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deleteLogo(string $fileId) → Delete logo from ImageKit              │ │
│ │   • deleteNationalIdImages(array $images) → Delete ID images            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (Result Pattern)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Encapsulate success/failure outcomes                    │ │
│ │ Reusable: YES (used by all action classes)                              │ │
│ │ Why It Exists: Consistent result handling across actions                │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success(data, message, meta) → Create success result                │ │
│ │   • failure(message, errors) → Create failure result                    │ │
│ │   • fromException(e, message) → Create from exception                   │ │
│ │   • isSuccess() → Check if operation succeeded                          │ │
│ │   • getData() → Get result data                                         │ │
│ │   • getMessage() → Get result message                                   │ │
│ │   • getErrors() → Get validation errors                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. [SELECT]: Check existing agency                                          │
│    Query: SELECT EXISTS(SELECT * FROM agencies WHERE user_id = ?)           │
│    Source: CreateAgencyAction (before transaction)                          │
│                                                                             │
│ 2. [INSERT]: Create agency record                                           │
│    Query: INSERT INTO agencies (user_id, name, country, ...)                │
│    Source: CreateAgencyAction (in transaction)                              │
│                                                                             │
│ 3. [INSERT]: Create agency member record                                    │
│    Query: INSERT INTO agency_members (agency_id, user_id, role, status)     │
│    Source: CreateAgencyAction (in transaction)                              │
│                                                                             │
│ 4. [SELECT]: Load owner relationship                                        │
│    Query: SELECT * FROM users WHERE id = ?                                  │
│    Source: CreateAgencyAction ($agency->load('owner'))                      │
│                                                                             │
│ EXTERNAL CALLS (on failure only):                                           │
│                                                                             │
│ 1. [DELETE]: ImageKit logo file                                             │
│    API: ImageKit delete file                                                │
│    Source: AgencyUploadService                                              │
│                                                                             │
│ 2. [DELETE]: ImageKit national ID images                                    │
│    API: ImageKit delete file (for each image)                               │
│    Source: AgencyUploadService                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Resources/V1/Agency/AgencyResource.php                       │
│                                                                             │
│ Transforms Agency model into standardized response:                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [                                                                       │ │
│ │     'id' => $agency->id,                                                │ │
│ │     'name' => $agency->name,                                            │ │
│ │     'country' => $agency->country,                                      │ │
│ │     'logo' => $agency->logo,                                            │ │
│ │     'status' => $agency->status->value,                                 │ │
│ │     'status_label' => $agency->status->label(),                         │ │
│ │     'created_at' => $agency->created_at->toISOString(),                 │ │
│ │     'owner' => new MinimalUserResource($agency->owner),  // If loaded   │ │
│ │ ]                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Note: For POST, only owner is loaded. member_count, address, coin_reseller  │
│ are included based on agency status and user permissions.                   │
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

| File                       | Used By Endpoints             | Reusable | Reasoning                          |
| -------------------------- | ----------------------------- | -------- | ---------------------------------- |
| `CreateAgencyRequest.php`  | POST /agencies                | ❌       | Single-purpose for agency creation |
| `CreateAgencyDTO.php`      | POST /agencies                | ❌       | Specific to agency creation data   |
| `CreateAgencyAction.php`   | POST /agencies                | ❌       | Single action for agency creation  |
| `AgencyPolicy.php`         | All agency endpoints          | ✅       | Shared authorization across domain |
| `AgencyResource.php`       | GET/POST agencies endpoints   | ✅       | Standard agency response format    |
| `AgencyUploadService.php`  | POST /agencies, PUT /agencies | ✅       | Reusable file cleanup logic        |
| `ActionResult.php`         | All action classes            | ✅       | Standard result pattern            |
| `Agency.php` (Model)       | All agency endpoints          | ✅       | Core domain model                  |
| `AgencyMember.php` (Model) | All agency member operations  | ✅       | Core domain model                  |
| `MinimalUserResource.php`  | Multiple domains              | ✅       | Lightweight user representation    |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                          | Source              | Condition                              |
| ------------------------------ | ------------------- | -------------------------------------- |
| `name.required`                | CreateAgencyRequest | Name field is missing                  |
| `name.max`                     | CreateAgencyRequest | Name exceeds 255 characters            |
| `country.required`             | CreateAgencyRequest | Country code is missing                |
| `country.size`                 | CreateAgencyRequest | Country is not 2 characters            |
| `address.required`             | CreateAgencyRequest | Address field is missing               |
| `address.max`                  | CreateAgencyRequest | Address exceeds 1000 characters        |
| `logo_url.regex`               | CreateAgencyRequest | Logo URL not from ImageKit CDN         |
| `logo_file_id.required_with`   | CreateAgencyRequest | File ID missing when logo_url provided |
| `national_id_images.max`       | CreateAgencyRequest | More than 2 national ID images         |
| `national_id_images.*.side.in` | CreateAgencyRequest | Side is not "front" or "back"          |
| `coin_reseller_id.exists`      | CreateAgencyRequest | Coin reseller user does not exist      |

### Business Logic Errors (422)

| Error                                                       | Source             | Condition                   |
| ----------------------------------------------------------- | ------------------ | --------------------------- |
| "You already have an agency application or existing agency" | CreateAgencyAction | User already owns an agency |

### Authorization Errors (403)

| Error                          | Source       | Condition                   |
| ------------------------------ | ------------ | --------------------------- |
| "This action is unauthorized." | AgencyPolicy | User is blocked             |
| "This action is unauthorized." | AgencyPolicy | User already owns an agency |

### System Errors (500)

| Error                                 | Source             | Condition                   |
| ------------------------------------- | ------------------ | --------------------------- |
| "Failed to create agency application" | CreateAgencyAction | Database transaction failed |

### Edge Cases

| Case                            | Behavior                                     |
| ------------------------------- | -------------------------------------------- |
| Race condition: dual submission | First wins; second gets "already has agency" |
| ImageKit file already deleted   | Cleanup continues, logs warning              |
| Transaction rollback            | Agency + member both rolled back             |
| User blocked mid-request        | Policy check happens before DB transaction   |
| Invalid ImageKit URL domain     | Rejected at validation with regex error      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                   DATABASE
   │                       │                       │                    │                         │
   │  POST /api/v1/agencies│                       │                    │                         │
   │──────────────────────▶│                       │                    │                         │
   │                       │                       │                    │                         │
   │                       │ 1. auth:sanctum       │                    │                         │
   │                       │   validate token      │                    │                         │
   │                       │──────────────────────▶│                    │                         │
   │                       │                       │                    │                         │
   │                       │                       │ 2. CreateAgency    │                         │
   │                       │                       │    Request         │                         │
   │                       │                       │    validate()      │                         │
   │                       │                       │                    │                         │
   │                       │                       │ 3. authorize()     │                         │
   │                       │                       │    AgencyPolicy    │                         │
   │                       │                       │    ::create()      │                         │
   │                       │                       │                    │                         │
   │                       │                       │                    │ 4. Check existing       │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                         │
   │                       │                       │                    │ 5. BEGIN TRANSACTION   │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │                    │                         │
   │                       │                       │                    │ 6. INSERT agency       │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                         │
   │                       │                       │                    │ 7. INSERT member       │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                         │
   │                       │                       │                    │ 8. SELECT owner        │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │                    │◀───────────────────────│
   │                       │                       │                    │                         │
   │                       │                       │                    │ 9. COMMIT              │
   │                       │                       │                    │───────────────────────▶│
   │                       │                       │◀───────────────────│                         │
   │                       │                       │                    │                         │
   │                       │                       │ 10. AgencyResource │                         │
   │                       │                       │     transform      │                         │
   │                       │◀──────────────────────│                    │                         │
   │◀──────────────────────│                       │                    │                         │
   │                       │                       │                    │                         │
   │  201 Created + JSON   │                       │                    │                         │
   │                       │                       │                    │                         │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                  | Location                                                      |
| ------------------------- | ------------------------------------------------------------- |
| New required field        | CreateAgencyRequest, CreateAgencyDTO, Agency model, migration |
| New optional field        | CreateAgencyRequest, CreateAgencyDTO, Agency model, migration |
| Pre-creation validation   | CreateAgencyAction (before transaction)                       |
| Post-creation side effect | CreateAgencyAction (inside transaction)                       |
| Additional file uploads   | AgencyUploadService                                           |
| New authorization rule    | AgencyPolicy::create()                                        |
| Response field            | AgencyResource::toArray()                                     |

### 📝 Field Modification Guide

#### ➕ ADDING A NEW FIELD

| Step  | File                                                      | What to Change                             |
| ----- | --------------------------------------------------------- | ------------------------------------------ |
| **1** | **Database Migration**                                    | Add column to `agencies` table             |
| **2** | `app/Models/Agency/Agency.php`                            | Add to `$fillable` array                   |
| **3** | `app/Http/Requests/Api/V1/Agency/CreateAgencyRequest.php` | Add validation rule in `rules()`           |
| **4** | `app/DTOs/Agency/CreateAgencyDTO.php`                     | Add property + `fromArray()` + `toArray()` |
| **5** | `app/Http/Controllers/Api/V1/Agency/AgencyController.php` | Pass to DTO in controller                  |
| **6** | `app/Actions/Agency/CreateAgencyAction.php`               | Map DTO property to Agency::create()       |
| **7** | `app/Http/Resources/V1/Agency/AgencyResource.php`         | Add to response array (if needed)          |

#### ➖ REMOVING A FIELD

| Step  | File                                                      | What to Change                    |
| ----- | --------------------------------------------------------- | --------------------------------- |
| **1** | `app/Http/Requests/Api/V1/Agency/CreateAgencyRequest.php` | Remove validation rule            |
| **2** | `app/DTOs/Agency/CreateAgencyDTO.php`                     | Remove property + factory methods |
| **3** | `app/Http/Controllers/Api/V1/Agency/AgencyController.php` | Remove from DTO instantiation     |
| **4** | `app/Actions/Agency/CreateAgencyAction.php`               | Remove from Agency::create()      |
| **5** | `app/Http/Resources/V1/Agency/AgencyResource.php`         | Remove from response              |
| **6** | **Database Migration**                                    | Drop column (if safe/required)    |

### 🔗 Field Flow Dependency Chain

```
Request Body
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ CreateAgencyRequest::rules()                         │
│   → Validates input fields                           │
│   → Checks ImageKit URL regex                        │
│   → Validates coin_reseller_id exists                │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ CreateAgencyDTO::fromArray()                         │
│   → Maps validated data to typed properties          │
│   → Uppercases country code                          │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ CreateAgencyAction::execute()                        │
│   → Maps DTO properties to Agency::create()          │
│   → Creates AgencyMember for owner                   │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ Agency Model                                         │
│   → $fillable controls mass assignment               │
│   → $casts handles type conversion                   │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ AgencyResource::toArray()                            │
│   → Transforms model to API response                 │
│   → Conditional fields based on user/status          │
└──────────────────────────────────────────────────────┘
```

### ⚠️ What Should NOT Be Modified Casually

| Component                   | Reason                                           |
| --------------------------- | ------------------------------------------------ |
| Transaction boundary        | Must wrap agency + member creation atomically    |
| AgencyMember creation       | Owner MUST be created as first member            |
| Status = PENDING            | New agencies must be PENDING for review workflow |
| AgencyMemberRole::OWNER     | Creator MUST have OWNER role initially           |
| ImageKit URL regex          | Security: prevents arbitrary URLs in database    |
| country uppercase transform | Consistency: all country codes stored uppercase  |
| Policy::create() checks     | Authorization: prevents abuse by blocked users   |

### 🚨 Common Pitfalls

| Pitfall                            | Prevention                                         |
| ---------------------------------- | -------------------------------------------------- |
| Forgetting $fillable for new field | Always add new fields to Agency::$fillable         |
| Skipping DTO property              | Update fromArray(), toArray(), and constructor     |
| Not cleaning up files on failure   | Controller handles cleanup via AgencyUploadService |
| Breaking transaction atomicity     | Keep Agency + AgencyMember creation in same tx     |
| Missing country uppercase          | DTO::fromArray() handles this automatically        |
| Forgetting validation message      | Add to messages() for user-friendly errors         |
| Not loading owner relationship     | Action must call $agency->load('owner')            |
| Changing status from PENDING       | New agencies MUST start as PENDING                 |

### 📁 File Locations Quick Reference

```
routes/api/agencies.php                                   ← Route definition (line 29)
app/Http/Controllers/Api/V1/Agency/
  └── AgencyController.php                                ← Controller (store method)
app/Http/Requests/Api/V1/Agency/
  └── CreateAgencyRequest.php                             ← Request validation
app/DTOs/Agency/
  └── CreateAgencyDTO.php                                 ← Data transfer object
app/Actions/Agency/
  └── CreateAgencyAction.php                              ← Business logic
app/Services/Agency/
  └── AgencyUploadService.php                             ← File cleanup service
app/Policies/Agency/
  └── AgencyPolicy.php                                    ← Authorization (create method)
app/Http/Resources/V1/Agency/
  └── AgencyResource.php                                  ← Response transformer
app/Models/Agency/
  ├── Agency.php                                          ← Agency model
  └── AgencyMember.php                                    ← AgencyMember model
app/Enums/Agency/
  ├── AgencyStatus.php                                    ← Status enum (PENDING)
  ├── AgencyMemberRole.php                                ← Role enum (OWNER)
  └── AgencyMemberStatus.php                              ← Member status (ACTIVE)
```

---

## Document Metadata

| Property            | Value                   |
| ------------------- | ----------------------- |
| **Endpoint**        | `POST /api/v1/agencies` |
| **Domain**          | Agency                  |
| **Author**          | System Documentation    |
| **Created**         | 2026-02-03              |
| **Laravel Version** | 12.x                    |
| **PHP Version**     | 8.4                     |
