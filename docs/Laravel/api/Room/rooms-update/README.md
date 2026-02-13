# PUT/PATCH /api/v1/rooms/{room}

> **Domain**: Room - Management  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Room Update endpoint allows room owners to update their room's settings including name, type (public/private), password, country, and logo. Supports partial updates via both PUT and PATCH methods.

### Responsibilities

- Authenticate request via Sanctum token
- Authorize via RoomPolicy (owner only)
- Validate room update data
- Execute update via UpdateRoomAction
- Handle logo URL updates (pre-uploaded to ImageKit)
- Return updated room resource

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Room settings update        | Name, type, password, country, logo                  |
| Partial update support      | Both PUT and PATCH accepted                          |
| Logo URL handling           | Validates ImageKit URLs                              |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `rooms` table               | Database       | Room data storage                           |
| Laravel Sanctum             | Package        | Token authentication                        |
| RoomPolicy                  | Policy         | Owner authorization                         |
| UpdateRoomAction            | Action         | Business logic                              |
| UpdateRoomDTO               | DTO            | Data transfer                               |
| ImageKit                    | External       | Logo storage                                |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
PUT  /api/v1/rooms/{room}
PATCH /api/v1/rooms/{room}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum  
✅ **Policy** - RoomPolicy@update (owner only)

### Route Parameters

| Parameter | Type      | Required | Description             |
| --------- | --------- | -------- | ----------------------- |
| `room`    | `integer` | ✅       | Room ID                 |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Content-Type`     | ✅       | `application/json`    | Request body format          |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |

### Request Body Schema

All fields are optional for partial updates:

```json
{
  "name": "My Updated Room",
  "type": "private",
  "password": "secret123",
  "country": "US",
  "logo_url": "https://ik.imagekit.io/flylive/rooms/logo.jpg",
  "logo_file_id": "abc123xyz"
}
```

### Field Details

| Field          | Type     | Required   | Constraints                                | Description                    |
| -------------- | -------- | ---------- | ------------------------------------------ | ------------------------------ |
| `name`         | `string` | ❌         | min:3, max:40, alphanumeric+spaces_-       | Room display name              |
| `type`         | `string` | ❌         | enum: public, private                      | Room visibility type           |
| `password`     | `string` | ❌*        | min:4, max:20, required if type=private    | Room password                  |
| `country`      | `string` | ❌         | size:2, alpha (ISO code)                   | Room country                   |
| `logo_url`     | `string` | ❌         | URL, must match ImageKit endpoint          | Pre-uploaded logo URL          |
| `logo_file_id` | `string` | ❌*        | max:100, required with logo_url            | ImageKit file ID               |

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Room updated successfully",
  "data": {
    "id": 123,
    "name": "My Updated Room",
    "type": "private",
    "country": "US",
    "logo": "https://ik.imagekit.io/flylive/rooms/logo.jpg",
    "level": 5,
    "level_progress": {
      "current_xp": 1500,
      "required_xp": 2000,
      "percentage": 75
    },
    "owner": {
      "id": 456,
      "name": "Owner Name",
      "signature": "owner_sig"
    },
    "member_count": 25,
    "created_at": "2026-01-15T10:30:00.000000Z"
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
    "name": ["This room name is already taken."],
    "password": ["Password is required for private rooms."]
  }
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Room updated successfully           |
| `400` | Action failed                       |
| `401` | Unauthenticated                     |
| `403` | Not room owner                      |
| `404` | Room not found                      |
| `422` | Validation failed                   |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:45                                               │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::match(['put', 'patch'], '/{room}',                               │ │
│ │     [RoomController::class, 'update'])->name('update');                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware: auth:sanctum, throttle:api_dynamic                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 VALIDATION                                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Api/V1/Room/UpdateRoomRequest.php                   │
│                                                                             │
│ prepareForValidation() (lines 32-43):                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ - Uppercase country code                                                │ │
│ │ - Normalize empty password to null                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Rules (lines 56-86):                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'name' => ['sometimes', 'string', 'min:3', 'max:40',                    │ │
│ │     'regex:/^[a-zA-Z0-9\s\-_]+$/',                                      │ │
│ │     Rule::unique('rooms', 'name')->ignore($this->route('room'))],       │ │
│ │ 'type' => ['sometimes', 'string', new Enum(RoomType::class)],           │ │
│ │ 'password' => ['nullable', 'string', 'min:4', 'max:20',                 │ │
│ │     'required_if:type,private'],                                        │ │
│ │ 'country' => ['sometimes', 'string', 'size:2', 'alpha'],                │ │
│ │ 'logo_url' => ['nullable', 'url', 'regex:<imagekit_pattern>'],          │ │
│ │ 'logo_file_id' => ['nullable', 'string', 'max:100',                     │ │
│ │     'required_with:logo_url'],                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php                   │
│ Method: update() at lines 189-233                                           │
│                                                                             │
│ STEP 1: Policy Authorization (line 200)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('update', $room);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build DTO (lines 202-203)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $validated = $request->validated();                                     │ │
│ │ $dto = UpdateRoomDTO::fromArray($validated);                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Extract Logo Data (lines 205-212)                                   │
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
│ STEP 4: Execute Action (lines 214-218)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($room, $dto, $logoData);                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return Response (lines 220-232)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(..., 400);                                │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success(new RoomResource($result->data), ...);      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `RoomController.php`                          | All room CRUD endpoints              | ⭕ Mixed   |
| `UpdateRoomRequest.php`                       | Room update only                     | ❌ Single  |
| `UpdateRoomAction.php`                        | Room update only                     | ❌ Single  |
| `RoomResource.php`                            | All room read endpoints              | ✅ Reusable|
| `RoomPolicy.php`                              | All room management endpoints        | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Error                                | Condition                              |
| ------------------------------------ | -------------------------------------- |
| `name.unique`                        | Room name taken by another room        |
| `name.regex`                         | Invalid characters in name             |
| `password.required_if`               | Private room without password          |
| `logo_url.regex`                     | Logo not from ImageKit CDN             |
| `logo_file_id.required_with`         | Logo URL without file ID               |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| Empty password string             | Normalized to null (password removed)              |
| Changing public to private        | Password becomes required                          |
| Same name as current              | Allowed (unique rule ignores self)                 |
| Non-owner update attempt          | 403 Forbidden via policy                           |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER        ACTION              DATABASE
   │                       │                       │                 │                    │
   │PUT/PATCH /{room}      │                       │                 │                    │
   │──────────────────────▶│                       │                 │                    │
   │                       │ 1. auth:sanctum       │                 │                    │
   │                       │ 2. Validate request   │                 │                    │
   │                       │──────────────────────▶│                 │                    │
   │                       │                       │ 3. authorize()  │                    │
   │                       │                       │ 4. Build DTO    │                    │
   │                       │                       │ 5. execute()    │                    │
   │                       │                       │────────────────▶│                    │
   │                       │                       │                 │ 6. UPDATE room    │
   │                       │                       │                 │───────────────────▶│
   │                       │                       │                 │◀───────────────────│
   │                       │                       │◀────────────────│                    │
   │                       │                       │ 7. RoomResource │                    │
   │                       │◀──────────────────────│                 │                    │
   │◀──────────────────────│                       │                 │                    │
   │  200 OK + JSON        │                       │                 │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| New room field                  | UpdateRoomRequest::rules(), UpdateRoomDTO, action     |
| New room type                   | RoomType enum                                         |
| Additional logo validation      | UpdateRoomRequest                                     |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php:45                              ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php:189-233                     ← Controller method
app/Http/Requests/Api/V1/Room/
  └── UpdateRoomRequest.php                          ← Request validation
app/Actions/Room/
  └── UpdateRoomAction.php                           ← Business logic
app/DTOs/Room/
  └── UpdateRoomDTO.php                              ← Data transfer object
app/Policies/
  └── RoomPolicy.php                                 ← Authorization
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit MSAB real-time events. Room metadata updates are handled locally and do not require real-time notification.

---

## 9. Document Metadata

| Property            | Value                           |
| ------------------- | ------------------------------- |
| **Endpoint**        | `PUT/PATCH /api/v1/rooms/{room}`|
| **Domain**          | Room - Management               |
| **Author**          | System Documentation            |
| **Created**         | 2026-02-04                      |
| **Laravel Version** | 12.x                            |
| **PHP Version**     | 8.4+                            |
