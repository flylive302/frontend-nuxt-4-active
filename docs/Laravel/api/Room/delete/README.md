# DELETE /api/v1/rooms/{room}

> **Domain**: Room  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-01-30

---

## 1. Domain Overview

### Purpose

The Delete Room endpoint handles permanent removal of a room from the system, including cleanup of associated resources like logos stored in ImageKit, and dispatching appropriate events for system-wide notification.

### Responsibilities

- Authorize only room owners or users with `rooms.delete` permission
- Delete room logo from ImageKit if one exists
- Dispatch `RoomDeleted` event for system-wide notification
- Perform soft delete of the room record
- Return success or failure response

### What It Owns

| Owned          | Description                                      |
| -------------- | ------------------------------------------------ |
| Room deletion  | Soft deletes the `rooms` record                  |
| Logo cleanup   | Removes logo from ImageKit and clears references |
| Event dispatch | Dispatches `RoomDeleted` event                   |

### External Dependencies

| Dependency | Type           | Purpose                               |
| ---------- | -------------- | ------------------------------------- |
| PostgreSQL | Database       | Room record soft deletion             |
| ImageKit   | Infrastructure | Logo file deletion                    |
| Redis      | Cache          | Cache invalidation for room and logos |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/rooms/{room}
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Rate Limiting

| Limiter       | Key      | Config                  |
| ------------- | -------- | ----------------------- |
| `api_dynamic` | `user:X` | Dynamic rate by user ID |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Path Parameters

| Parameter | Type      | Constraints      | Example |
| --------- | --------- | ---------------- | ------- |
| `room`    | `integer` | Required, exists | `123`   |

### Request Body Schema

```
No request body required
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Room deleted successfully",
  "data": null,
  "meta": {
    "timestamp": "2026-01-30T12:00:00.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Authorization Error (403)

```json
{
  "status": "error",
  "message": "This action is unauthorized.",
  "data": null,
  "errors": {}
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Resource not found",
  "data": null,
  "errors": {}
}
```

#### ❌ Business Logic Error (400)

```json
{
  "status": "error",
  "message": "Failed to delete room",
  "data": null,
  "errors": {
    "room": ["Failed to delete room"]
  }
}
```

#### ❌ Server Error (500)

```json
{
  "status": "error",
  "message": "An unexpected error occurred while deleting the room",
  "data": null,
  "errors": {
    "exception": "Error message"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Room deleted successfully               |
| `400` | Deletion failed (business logic error)  |
| `403` | User not authorized to delete this room |
| `404` | Room not found                          |
| `500` | Unexpected server error                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    DELETE /api/v1/rooms/{room}                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/rooms.php:48-49                                            │
│ Route: Route::delete('/{room}', [RoomController::class, 'destroy'])         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware(['auth:sanctum', 'throttle:api_dynamic'])             │ │
│ │     ->prefix('rooms')->name('rooms.')->group(function () {              │ │
│ │         // ...                                                          │ │
│ │         Route::delete('/{room}', [RoomController::class, 'destroy'])    │ │
│ │             ->name('destroy');                                          │ │
│ │     });                                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum    → Verifies Bearer token, loads authenticated user      │
│   2. throttle:api_dynamic → Dynamic rate limiting based on user             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 ROUTE MODEL BINDING                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Room/Room.php                                              │
│                                                                             │
│ Laravel automatically resolves {room} parameter to Room model instance.     │
│ Uses implicit route model binding with Room::findOrFail($id).               │
│ If room not found, throws ModelNotFoundException → 404 response.            │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ class Room extends Model                                                │ │
│ │ {                                                                       │ │
│ │     use SoftDeletes;                                                    │ │
│ │     // Only non-deleted rooms can be resolved                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomController.php:235-253           │
│ Method: destroy(Room $room, DeleteRoomAction $action)                       │
│                                                                             │
│ STEP 1: Authorization Check                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->authorize('delete', $room);                                      │ │
│ │                                                                         │ │
│ │ // Calls RoomPolicy::delete() which checks:                             │ │
│ │ // - User is room owner (user_id === $room->user_id)                    │ │
│ │ // - OR user has 'rooms.delete' permission                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Execute Delete Action                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $action->execute($room);                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Handle Result                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->message ?? 'Failed to delete room',                    │ │
│ │         $result->errors ?? [],                                          │ │
│ │         400                                                             │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(                                            │ │
│ │     null,                                                               │ │
│ │     $result->message ?? 'Room deleted successfully'                     │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 AUTHORIZATION LAYER                                                     │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomPolicy (Policy)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Policies/Room/RoomPolicy.php:58-61                            │ │
│ │ Responsibility: Authorize room deletion                                 │ │
│ │ Reusable: YES (shared across Room domain)                               │ │
│ │ Why It Exists: Centralized authorization logic for rooms                │ │
│ │                                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ public function delete(User $user, Room $room): bool                │ │ │
│ │ │ {                                                                   │ │ │
│ │ │     return $this->isOwner($user, $room)                             │ │ │
│ │ │         || $user->can('rooms.delete');                              │ │ │
│ │ │ }                                                                   │ │ │
│ │ │                                                                     │ │ │
│ │ │ private function isOwner(User $user, Room $room): bool              │ │ │
│ │ │ {                                                                   │ │ │
│ │ │     return $user->id === $room->user_id;                            │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 ACTION LAYER                                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: DeleteRoomAction (Action)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/Room/DeleteRoomAction.php                             │ │
│ │ Responsibility: Orchestrate room deletion with transaction              │ │
│ │ Reusable: YES (can be called from CLI, queues, etc.)                    │ │
│ │ Why It Exists: Encapsulates deletion business logic                     │ │
│ │                                                                         │ │
│ │ Key Operations:                                                         │ │
│ │   • execute() → Orchestrates deletion in DB transaction                 │ │
│ │                                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ public function execute(Room $room): ActionResult                   │ │ │
│ │ │ {                                                                   │ │ │
│ │ │     try {                                                           │ │ │
│ │ │         return DB::transaction(function () use ($room) {            │ │ │
│ │ │             // 1. Store data for event before deletion              │ │ │
│ │ │             $roomId = $room->id;                                    │ │ │
│ │ │             $roomName = $room->name;                                │ │ │
│ │ │             $ownerId = $room->user_id;                              │ │ │
│ │ │                                                                     │ │ │
│ │ │             // 2. Delete logo from ImageKit                         │ │ │
│ │ │             if ($room->logo !== null) {                             │ │ │
│ │ │                 $this->roomLogoService->deleteLogo($room);          │ │ │
│ │ │             }                                                       │ │ │
│ │ │                                                                     │ │ │
│ │ │             // 3. Dispatch RoomDeleted event                        │ │ │
│ │ │             event(new RoomDeleted($room, Auth::user()));            │ │ │
│ │ │                                                                     │ │ │
│ │ │             // 4. Soft delete the room                              │ │ │
│ │ │             $room->delete();                                        │ │ │
│ │ │                                                                     │ │ │
│ │ │             return ActionResult::success(null, 'Deleted');          │ │ │
│ │ │         });                                                         │ │ │
│ │ │     } catch (\Exception $e) {                                       │ │ │
│ │ │         return ActionResult::fromException($e);                     │ │ │
│ │ │     }                                                               │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomLogoService (Service)                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Services/Room/RoomLogoService.php:29-73                       │ │
│ │ Responsibility: Handle logo file deletion from ImageKit                 │ │
│ │ Reusable: YES (used by update and delete operations)                    │ │
│ │ Why It Exists: Centralized logo management with ImageKit integration    │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • deleteLogo() → Delete from ImageKit and clear DB references         │ │
│ │   • invalidateCache() → Clear room logo cache                           │ │
│ │                                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ public function deleteLogo(Room $room): bool                        │ │ │
│ │ │ {                                                                   │ │ │
│ │ │     // Get file ID (stored or extracted from URL)                   │ │ │
│ │ │     $fileId = $room->logo_file_id ??                                │ │ │
│ │ │         $this->extractFileIdFromUrl($room->logo);                   │ │ │
│ │ │                                                                     │ │ │
│ │ │     // Delete from ImageKit                                         │ │ │
│ │ │     if ($fileId !== null) {                                         │ │ │
│ │ │         $this->imageKitService->deleteFile($fileId);                │ │ │
│ │ │     }                                                               │ │ │
│ │ │                                                                     │ │ │
│ │ │     // Clear DB references                                          │ │ │
│ │ │     $room->update(['logo' => null, 'logo_file_id' => null]);        │ │ │
│ │ │                                                                     │ │ │
│ │ │     // Invalidate cache                                             │ │ │
│ │ │     $this->invalidateCache($room);                                  │ │ │
│ │ │                                                                     │ │ │
│ │ │     return true;                                                    │ │ │
│ │ │ }                                                                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomDeleted (Event)                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Events/Room/RoomDeleted.php                                   │ │
│ │ Responsibility: Notify system of room deletion                          │ │
│ │ Reusable: NO (specific to deletion event)                               │ │
│ │ Why It Exists: Enables decoupled system reactions to room deletion      │ │
│ │                                                                         │ │
│ │ Event Payload:                                                          │ │
│ │   • room: Room model (before deletion)                                  │ │
│ │   • actor: User who performed deletion                                  │ │
│ │   • event_type: 'room.deleted'                                          │ │
│ │   • deleted_at: ISO timestamp                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ActionResult (DTO)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Actions/ActionResult.php                                      │ │
│ │ Responsibility: Standardized action result container                    │ │
│ │ Reusable: YES (used by all Actions)                                     │ │
│ │ Why It Exists: Consistent return type from Actions                      │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → Create successful result                                │ │
│ │   • failure() → Create failure result with errors                       │ │
│ │   • fromException() → Create failure from caught exception              │ │
│ │   • isSuccess() / isFailure() → Check result status                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API controllers)                             │ │
│ │ Why It Exists: Consistent API response structure                        │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → 200 response with data                                  │ │
│ │   • error() → Error response with status code                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.7 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT (Route Model Binding): Find room by ID                            │
│    Query: SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL LIMIT 1   │
│    Source: Laravel implicit binding                                         │
│                                                                             │
│ 2. UPDATE (Logo cleanup): Clear logo references                             │
│    Query: UPDATE rooms SET logo = NULL, logo_file_id = NULL WHERE id = ?    │
│    Source: RoomLogoService::deleteLogo()                                    │
│                                                                             │
│ 3. UPDATE (Soft delete): Set deleted_at timestamp                           │
│    Query: UPDATE rooms SET deleted_at = NOW() WHERE id = ?                  │
│    Source: Room::delete() (SoftDeletes trait)                               │
│                                                                             │
│ EXTERNAL API CALLS:                                                         │
│                                                                             │
│ 1. DELETE: ImageKit file deletion                                           │
│    Endpoint: DELETE https://api.imagekit.io/v1/files/{fileId}               │
│    Source: RoomLogoService → ImageKitService::deleteFile()                  │
│                                                                             │
│ CACHE OPERATIONS:                                                           │
│                                                                             │
│ 1. FORGET: room:{id}:logo                                                   │
│    Source: RoomLogoService::invalidateCache()                               │
│                                                                             │
│ 2. FLUSH TAGS: room:{id}                                                    │
│    Source: CacheService::safeFlushTags()                                    │
│                                                                             │
│ 3. PURGE: ImageKit CDN cache for logo URL                                   │
│    Source: ImageKitService::purgeCache()                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.8 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ File: app/Http/Utils/ApiResponse.php                                        │
│                                                                             │
│ Success Response (200):                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(                                            │ │
│ │     null,                                // No data for delete          │ │
│ │     'Room deleted successfully'          // Success message             │ │
│ │ );                                                                      │ │
│ │                                                                         │ │
│ │ // Produces:                                                            │ │
│ │ {                                                                       │ │
│ │   "status": "success",                                                  │ │
│ │   "message": "Room deleted successfully",                               │ │
│ │   "data": null,                                                         │ │
│ │   "meta": { "timestamp": "...", "correlation_id": "..." }               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Error Response (400):                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::error(                                              │ │
│ │     'Failed to delete room',             // Error message               │ │
│ │     ['room' => ['Failed to delete room']],                              │ │
│ │     400                                  // Status code                 │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body (success)                             │
│                    400/403/404/500 + JSON Body (error)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                      | Used By Endpoints                | Reusable | Reasoning                                    |
| ------------------------- | -------------------------------- | -------- | -------------------------------------------- |
| `RoomController.php`      | All Room endpoints               | ⭕       | Controller-specific methods but shared class |
| `RoomPolicy.php`          | All Room endpoints               | ✅       | Centralized room authorization               |
| `DeleteRoomAction.php`    | DELETE /rooms/{room}             | ❌       | Specific to deletion                         |
| `RoomLogoService.php`     | create, update, delete rooms     | ✅       | Reusable logo management                     |
| `ImageKitService.php`     | All file upload/delete endpoints | ✅       | Infrastructure service                       |
| `CacheService.php`        | All cached endpoints             | ✅       | Cache management utility                     |
| `Room.php` (Model)        | All Room endpoints               | ✅       | Core Room model                              |
| `RoomDeleted.php` (Event) | DELETE /rooms/{room}             | ❌       | Deletion-specific event                      |
| `ActionResult.php`        | All Action classes               | ✅       | Standard action result DTO                   |
| `ApiResponse.php`         | All API controllers              | ✅       | Standard API response utility                |

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                          | Source                 | Condition                                            |
| ------------------------------ | ---------------------- | ---------------------------------------------------- |
| "This action is unauthorized." | `RoomPolicy::delete()` | User is not room owner AND lacks `rooms.delete` perm |

### Not Found Errors (404)

| Error                | Source              | Condition                        |
| -------------------- | ------------------- | -------------------------------- |
| "Resource not found" | Route Model Binding | Room with given ID doesn't exist |
| "Resource not found" | Route Model Binding | Room was already soft deleted    |

### Business Logic Errors (400)

| Error                   | Source             | Condition                     |
| ----------------------- | ------------------ | ----------------------------- |
| "Failed to delete room" | `DeleteRoomAction` | Database delete returns false |

### System Errors (500)

| Error                                                  | Source             | Condition                          |
| ------------------------------------------------------ | ------------------ | ---------------------------------- |
| "An unexpected error occurred while deleting the room" | `DeleteRoomAction` | Database exception during deletion |

### Edge Cases

| Case                         | Behavior                                                      |
| ---------------------------- | ------------------------------------------------------------- |
| Room has no logo             | Logo deletion step is skipped                                 |
| ImageKit deletion fails      | Logo cleared from DB anyway, error logged, continues deletion |
| Room already deleted         | 404 returned (soft delete excludes from binding)              |
| Concurrent deletion attempts | First succeeds, second gets 404                               |
| Room has active members      | Members remain orphaned (cascade not enforced)                |
| Transaction rollback         | All changes within transaction are rolled back                |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            ACTION                    SERVICE/EVENT            DATABASE/IMAGEKIT
   │                       │                       │                    │                            │                        │
   │  DELETE /rooms/{id}   │                       │                    │                            │                        │
   │──────────────────────▶│                       │                    │                            │                        │
   │                       │                       │                    │                            │                        │
   │                       │ 1. auth:sanctum       │                    │                            │                        │
   │                       │   (verify token)      │                    │                            │                        │
   │                       │──────────────────────▶│                    │                            │                        │
   │                       │                       │                    │                            │                        │
   │                       │                       │ 2. Route Model     │                            │                        │
   │                       │                       │    Binding         │                            │                        │
   │                       │                       │─────────────────────────────────────────────────────────────────────────▶│
   │                       │                       │                    │                            │                  SELECT│
   │                       │                       │◀─────────────────────────────────────────────────────────────────────────│
   │                       │                       │                    │                            │                        │
   │                       │                       │ 3. authorize()     │                            │                        │
   │                       │                       │──▶ RoomPolicy::    │                            │                        │
   │                       │                       │    delete()        │                            │                        │
   │                       │                       │                    │                            │                        │
   │                       │                       │ 4. Execute action  │                            │                        │
   │                       │                       │───────────────────▶│                            │                        │
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │ 5. Begin Transaction       │                        │
   │                       │                       │                    │─────────────────────────────────────────────────────▶│
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │ 6. deleteLogo()            │                        │
   │                       │                       │                    │───────────────────────────▶│                        │
   │                       │                       │                    │                            │ 7. Delete from ImageKit│
   │                       │                       │                    │                            │───────────────────────▶│
   │                       │                       │                    │                            │◀───────────────────────│
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │                            │ 8. UPDATE (clear logo) │
   │                       │                       │                    │                            │───────────────────────▶│
   │                       │                       │                    │                            │◀───────────────────────│
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │                            │ 9. Invalidate cache    │
   │                       │                       │                    │◀──────────────────────────│                        │
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │ 10. Dispatch RoomDeleted   │                        │
   │                       │                       │                    │───────────────────────────▶│                        │
   │                       │                       │                    │◀──────────────────────────│                        │
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │ 11. Soft delete room       │                        │
   │                       │                       │                    │─────────────────────────────────────────────────────▶│
   │                       │                       │                    │                            │                  UPDATE│
   │                       │                       │                    │◀─────────────────────────────────────────────────────│
   │                       │                       │                    │                            │                        │
   │                       │                       │                    │ 12. Commit Transaction     │                        │
   │                       │                       │                    │─────────────────────────────────────────────────────▶│
   │                       │                       │                    │◀─────────────────────────────────────────────────────│
   │                       │                       │                    │                            │                        │
   │                       │                       │◀──────────────────│                            │                        │
   │                       │                       │   ActionResult     │                            │                        │
   │                       │                       │                    │                            │                        │
   │                       │                       │ 13. Build response │                            │                        │
   │                       │◀──────────────────────│   ApiResponse::    │                            │                        │
   │                       │                       │   success()        │                            │                        │
   │◀──────────────────────│                       │                    │                            │                        │
   │                       │                       │                    │                            │                        │
   │  200 OK + JSON        │                       │                    │                            │                        │
   │                       │                       │                    │                            │                        │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                           |
| --------------------------- | -------------------------------------------------- |
| New pre-deletion check      | `DeleteRoomAction::execute()` before logo deletion |
| New post-deletion action    | Add listener to `RoomDeleted` event                |
| Additional authorization    | `RoomPolicy::delete()` method                      |
| Cascade delete related data | `DeleteRoomAction::execute()` inside transaction   |
| Admin audit logging         | Add listener to `RoomDeleted` event                |

### 📝 Field Modification Guide

#### ➕ ADDING PRE-DELETION VALIDATION

| Step  | File                                                 | What to Change                      |
| ----- | ---------------------------------------------------- | ----------------------------------- |
| **1** | `app/Actions/Room/DeleteRoomAction.php`              | Add validation before logo deletion |
| **2** | Return `ActionResult::failure()` if validation fails |

#### ➕ ADDING CASCADE DELETE FOR RELATED DATA

| Step  | File                                                     | What to Change                      |
| ----- | -------------------------------------------------------- | ----------------------------------- |
| **1** | `app/Actions/Room/DeleteRoomAction.php`                  | Add delete calls inside transaction |
| **2** | Example: `$room->members()->delete()` before room delete |

#### ➕ ADDING POST-DELETION NOTIFICATION

| Step  | File                                     | What to Change                      |
| ----- | ---------------------------------------- | ----------------------------------- |
| **1** | `app/Listeners/Room/`                    | Create new listener class           |
| **2** | `app/Providers/EventServiceProvider.php` | Register listener for `RoomDeleted` |

### 🔗 Deletion Flow Dependency Chain

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DELETION FLOW                                  │
└──────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │ Authorization│    │Logo Cleanup │    │Soft Delete  │
   │ RoomPolicy   │    │RoomLogoSvc  │    │Room Model   │
   └─────────────┘    └─────────────┘    └─────────────┘
          │                   │                   │
          │                   ▼                   │
          │           ┌─────────────┐             │
          │           │  ImageKit   │             │
          │           │  (External) │             │
          │           └─────────────┘             │
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  RoomDeleted    │
                    │    (Event)      │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Listeners     │
                    │  (If any)       │
                    └─────────────────┘
```

### 📋 Pre-Deletion Checklist

When adding cascade deletes:

- [ ] Room members should be deleted INSIDE the transaction
- [ ] Room invitations should be deleted INSIDE the transaction
- [ ] Room blocks should be deleted INSIDE the transaction
- [ ] All deletes must happen BEFORE the room delete
- [ ] Event should be dispatched AFTER related data is cleaned

### ⚠️ What Should NOT Be Modified Casually

| Component             | Reason                                                      |
| --------------------- | ----------------------------------------------------------- |
| Transaction wrapper   | Ensures atomicity of logo cleanup + deletion                |
| Event dispatch timing | Must be BEFORE actual delete while model still exists       |
| Soft delete trait     | Hard delete would break data integrity and audit trails     |
| Authorization check   | Security boundary - must always verify ownership/permission |
| Logo cleanup order    | Must happen before room delete to maintain file references  |

### 🚨 Common Pitfalls

| Pitfall                        | Prevention                                              |
| ------------------------------ | ------------------------------------------------------- |
| Dispatching event after delete | Model data is needed for event - dispatch before delete |
| Forgetting transaction         | Always wrap multi-step deletes in DB::transaction()     |
| Hard deleting room             | Use soft delete to maintain referential integrity       |
| Not handling ImageKit failures | Continue with deletion even if ImageKit fails           |
| Not checking authorization     | Always call `$this->authorize()` before action          |
| Orphaned room members          | Consider implementing cascade deletes if needed         |
| Missing cache invalidation     | Logo service handles this automatically                 |

### 📁 File Locations Quick Reference

```
routes/api/rooms.php                                 ← Route definition (line 48-49)
app/Http/Controllers/Api/V1/Room/
  └── RoomController.php                             ← Controller (destroy method)
app/Policies/Room/
  └── RoomPolicy.php                                 ← Authorization (delete method)
app/Actions/Room/
  └── DeleteRoomAction.php                           ← Business logic action
app/Services/Room/
  └── RoomLogoService.php                            ← Logo deletion service
app/Events/Room/
  └── RoomDeleted.php                                ← Deletion event
app/Models/Room/
  └── Room.php                                       ← Room model (SoftDeletes)
app/Actions/
  └── ActionResult.php                               ← Action result DTO
app/Http/Utils/
  └── ApiResponse.php                                ← API response utility
```

---

## Document Metadata

| Property            | Value                         |
| ------------------- | ----------------------------- |
| **Endpoint**        | `DELETE /api/v1/rooms/{room}` |
| **Domain**          | Room                          |
| **Author**          | System Documentation          |
| **Created**         | 2026-01-30                    |
| **Laravel Version** | 12.x                          |
| **PHP Version**     | 8.4                           |
