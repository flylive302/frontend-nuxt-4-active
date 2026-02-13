# POST /api/v1/user/room/invitations/{id}/decline

> **Domain**: User / Room Membership  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-01

---

## 1. Domain Overview

### Purpose

The Decline Invitation endpoint allows authenticated users to decline a pending room invitation they have received, marking it as declined without joining the room.

### Responsibilities

- Authenticate the requesting user
- Validate the invitation exists and belongs to the user
- Check invitation status (must be pending)
- Decline the invitation by updating its status to `declined`
- Set the `responded_at` timestamp
- Return success response confirming the decline

### What It Owns

| Owned              | Description                                       |
| ------------------ | ------------------------------------------------- |
| Invitation Status  | Updates `room_invitations.status` to `declined`   |
| Response Timestamp | Updates `room_invitations.responded_at` timestamp |

### External Dependencies

| Dependency | Type     | Purpose                |
| ---------- | -------- | ---------------------- |
| PostgreSQL | Database | Stores invitation data |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/user/room/invitations/{id}/decline
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter    | Key         | Config                  |
| ---------- | ----------- | ----------------------- |
| `throttle` | `user:{id}` | Default API rate limits |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Content-Type`  | ✅       | `application/json` | Request body format  |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### URL Parameters

| Parameter | Type      | Constraints       | Example |
| --------- | --------- | ----------------- | ------- |
| `id`      | `integer` | Required, numeric | `123`   |

### Request Body

No request body required.

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Invitation declined",
  "data": null,
  "meta": {
    "timestamp": "2026-02-01T03:31:30.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthorized",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T03:31:30.000000Z",
    "correlation_id": "uuid"
  }
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Invitation not found",
  "data": null,
  "errors": [],
  "meta": {
    "timestamp": "2026-02-01T03:31:30.000000Z",
    "correlation_id": "uuid"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                               |
| ----- | ------------------------------------------------------- |
| `200` | Invitation declined successfully                        |
| `401` | User not authenticated                                  |
| `404` | Invitation not found, not for this user, or not pending |
| `500` | Unexpected server error                                 |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│             POST /api/v1/user/room/invitations/{id}/decline                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:44                                     │
│ Route: Route::post('/invitations/{id}/decline',                             │
│        [RoomInvitationController::class, 'decline'])->whereNumber('id')     │
│                                                                             │
│ Route Group: prefix('user/room') + middleware('auth:sanctum')               │
│                                                                             │
│ Middleware Chain (in order):                                                │
│   1. auth:sanctum → Validates Bearer token, loads authenticated user       │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::middleware('auth:sanctum')->group(function () {                  │ │
│ │     Route::prefix('user/room')->group(function () {                     │ │
│ │         Route::post('/invitations/{id}/decline',                        │ │
│ │             [RoomInvitationController::class, 'decline'])               │ │
│ │             ->whereNumber('id');                                        │ │
│ │     });                                                                 │ │
│ │ });                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER HANDLES REQUEST                                              │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php:71-91   │
│ Method: decline(Request $request, int $id): JsonResponse                    │
│                                                                             │
│ STEP 1: Get authenticated user                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Find pending invitation for this user                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation = RoomInvitation::where('id', $id)                          │ │
│ │     ->where('invitee_id', $user->id)                                    │ │
│ │     ->pending()  // scope: status = 'pending'                           │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (!$invitation) {                                                     │ │
│ │     return ApiResponse::notFound('Invitation not found');               │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Decline the invitation (model method)                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $invitation->decline();                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Return success response                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Invitation declined');               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 MODEL METHOD (decline)                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Models/Room/RoomInvitation.php:132-137                            │
│ Method: decline(): void                                                     │
│                                                                             │
│ Updates invitation status to DECLINED:                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ public function decline(): void                                         │ │
│ │ {                                                                       │ │
│ │     $this->status = RoomInvitationStatus::DECLINED;                     │ │
│ │     $this->responded_at = now();                                        │ │
│ │     $this->save();                                                      │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 SUPPORTING COMPONENTS                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ COMPONENT: RoomInvitation (Model)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Models/Room/RoomInvitation.php                                │ │
│ │ Responsibility: Represents invitation records                           │ │
│ │ Reusable: YES (used across invitation operations)                       │ │
│ │ Why It Exists: Encapsulates invitation state and behavior               │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • scopePending() → filters by status == PENDING                       │ │
│ │   • decline() → sets status to DECLINED, responded_at to now, saves     │ │
│ │   • isPending() → checks if status == PENDING                           │ │
│ │   • accept() → sets status to ACCEPTED                                  │ │
│ │   • cancel() → sets status to CANCELLED                                 │ │
│ │   • expire() → sets status to EXPIRED                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: RoomInvitationStatus (Enum)                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Enums/Room/RoomInvitationStatus.php                           │ │
│ │ Responsibility: Defines invitation status values                        │ │
│ │ Reusable: YES (type-safe status handling)                               │ │
│ │                                                                         │ │
│ │ Values: PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED                 │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • label() → returns human-readable label                              │ │
│ │   • color() → returns UI color (danger for declined)                    │ │
│ │   • isFinal() → returns true for all except PENDING                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPONENT: ApiResponse (Utility)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ File: app/Http/Utils/ApiResponse.php                                    │ │
│ │ Responsibility: Standardized JSON response formatting                   │ │
│ │ Reusable: YES (used by all API endpoints)                               │ │
│ │ Why It Exists: Provides consistent response structure                   │ │
│ │                                                                         │ │
│ │ Key Methods:                                                            │ │
│ │   • success() → returns 200 with data                                   │ │
│ │   • unauthorized() → returns 401 error                                  │ │
│ │   • notFound() → returns 404 error                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS / EXTERNAL CALLS                                            │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (in order):                                             │
│                                                                             │
│ 1. SELECT: Find pending invitation for user                                 │
│    Query: SELECT * FROM room_invitations                                    │
│           WHERE id = ?                                                      │
│           AND invitee_id = ?                                                │
│           AND status = 'pending'                                            │
│           LIMIT 1                                                           │
│    Source: Controller::decline()                                            │
│                                                                             │
│ 2. UPDATE: Decline invitation                                               │
│    Query: UPDATE room_invitations                                           │
│           SET status = 'declined',                                          │
│               responded_at = NOW(),                                         │
│               updated_at = NOW()                                            │
│           WHERE id = ?                                                      │
│    Source: RoomInvitation::decline()                                        │
│                                                                             │
│ CACHE OPERATIONS: None                                                      │
│                                                                             │
│ QUEUE OPERATIONS: None                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.6 RESPONSE CONSTRUCTION                                                   │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Utils/ApiResponse.php:15-30                                  │
│ Method: ApiResponse::success(null, 'Invitation declined')                   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return response()->json([                                               │ │
│ │     'status' => 'success',                                              │ │
│ │     'message' => 'Invitation declined',                                 │ │
│ │     'data' => null,                                                     │ │
│ │     'meta' => [                                                         │ │
│ │         'timestamp' => now()->toISOString(),                            │ │
│ │         'correlation_id' => $correlationId                              │ │
│ │     ]                                                                   │ │
│ │ ], 200);                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                         200 + JSON Body                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                           | Used By Endpoints         | Reusable | Reasoning                                |
| ------------------------------ | ------------------------- | -------- | ---------------------------------------- |
| `RoomInvitationController.php` | All invitation endpoints  | ⭕       | Controller methods are endpoint-specific |
| `RoomInvitation.php`           | All invitation operations | ✅       | Model with status helpers                |
| `RoomInvitationStatus.php`     | All invitation operations | ✅       | Type-safe status enum                    |
| `ApiResponse.php`              | All API endpoints         | ✅       | Consistent response formatting           |

---

## 5. Error Handling & Edge Cases

### Authentication Errors (401)

| Error          | Source     | Condition              |
| -------------- | ---------- | ---------------------- |
| `Unauthorized` | Controller | User not authenticated |

### Not Found Errors (404)

| Error                  | Source     | Condition                                     |
| ---------------------- | ---------- | --------------------------------------------- |
| `Invitation not found` | Controller | ID doesn't exist                              |
| `Invitation not found` | Controller | Invitation exists but not for this user       |
| `Invitation not found` | Controller | Invitation exists but status is not 'pending' |

### System Errors (500)

| Error                     | Source        | Condition            |
| ------------------------- | ------------- | -------------------- |
| Database connection error | DB operations | Database unreachable |
| Unexpected exception      | Any component | Unhandled error      |

### Edge Cases

| Case                                   | Behavior                                            |
| -------------------------------------- | --------------------------------------------------- |
| Same invitation declined twice         | Second attempt returns 404 (status already changed) |
| Invitation already accepted            | Returns 404 (pending scope filters it out)          |
| Invitation already cancelled           | Returns 404 (pending scope filters it out)          |
| Invitation already expired             | Returns 404 (pending scope filters it out)          |
| Decline own invitation sent as inviter | Would fail - invitee_id check prevents this         |
| Concurrent decline requests            | No conflict - both would succeed with same result   |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER                  MODEL                    DATABASE
   │                       │                       │                         │                          │
   │  POST /user/room/     │                       │                         │                          │
   │  invitations/{id}/    │                       │                         │                          │
   │  decline              │                       │                         │                          │
   │──────────────────────▶│                       │                         │                          │
   │                       │                       │                         │                          │
   │                       │ 1. auth:sanctum       │                         │                          │
   │                       │   (verify token)      │                         │                          │
   │                       │──────────────────────▶│                         │                          │
   │                       │                       │                         │                          │
   │                       │                       │ 2. Get user             │                          │
   │                       │                       │   $request->user()      │                          │
   │                       │                       │                         │                          │
   │                       │                       │ 3. SELECT invitation    │                          │
   │                       │                       │   WHERE id=? AND        │                          │
   │                       │                       │   invitee_id=? AND      │                          │
   │                       │                       │   status='pending'      │                          │
   │                       │                       │─────────────────────────┼─────────────────────────▶│
   │                       │                       │◀────────────────────────┼──────────────────────────│
   │                       │                       │                         │                          │
   │                       │                       │ 4. Check if found       │                          │
   │                       │                       │   (null → 404)          │                          │
   │                       │                       │                         │                          │
   │                       │                       │ 5. $invitation->        │                          │
   │                       │                       │     decline()           │                          │
   │                       │                       │────────────────────────▶│                          │
   │                       │                       │                         │                          │
   │                       │                       │                         │ 6. UPDATE invitation     │
   │                       │                       │                         │    status='declined'     │
   │                       │                       │                         │    responded_at=NOW()    │
   │                       │                       │                         │─────────────────────────▶│
   │                       │                       │                         │◀─────────────────────────│
   │                       │                       │                         │                          │
   │                       │                       │◀────────────────────────│                          │
   │                       │                       │                         │                          │
   │                       │                       │ 7. ApiResponse::        │                          │
   │                       │                       │   success(null,...)     │                          │
   │                       │◀──────────────────────│                         │                          │
   │◀──────────────────────│                       │                         │                          │
   │                       │                       │                         │                          │
   │  200 + JSON           │                       │                         │                          │
   │                       │                       │                         │                          │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                      | Location(s)                                  |
| ----------------------------- | -------------------------------------------- |
| Post-decline notification     | Controller after `$invitation->decline()`    |
| Decline with reason           | Add `reason` parameter, store in invitation  |
| Real-time event on decline    | Controller after decline() or model observer |
| Rate limit decline attempts   | Middleware or controller                     |
| Soft delete instead of status | Change `decline()` to use soft delete        |

### 📝 Field Modification Guide

#### ➕ ADDING DECLINE REASON

| Step  | File                                                    | What to Change                      |
| ----- | ------------------------------------------------------- | ----------------------------------- |
| **1** | **Database Migration**                                  | Add `decline_reason` column         |
| **2** | `app/Models/Room/RoomInvitation.php`                    | Add to `$fillable`                  |
| **3** | `app/Http/Controllers/.../RoomInvitationController.php` | Accept reason from request          |
| **4** | `app/Models/Room/RoomInvitation.php`                    | Update `decline()` to accept reason |

#### ➕ ADDING POST-DECLINE NOTIFICATION

| Step  | File                                                        | What to Change                      |
| ----- | ----------------------------------------------------------- | ----------------------------------- |
| **1** | `app/Notifications/Room/InvitationDeclinedNotification.php` | Create notification class           |
| **2** | `app/Http/Controllers/.../RoomInvitationController.php`     | Dispatch notification after decline |
| **3** | `app/Models/Room/RoomInvitation.php`                        | Load inviter relationship           |

#### ➖ REMOVING responded_at TRACKING

| Step  | File                                 | What to Change          |
| ----- | ------------------------------------ | ----------------------- |
| **1** | `app/Models/Room/RoomInvitation.php` | Remove from `decline()` |
| **2** | `app/Models/Room/RoomInvitation.php` | Remove from `$fillable` |
| **3** | **Database Migration**               | Drop column (if safe)   |

### 🔗 Field Flow Dependency Chain

```
URL Parameter {id}
       │
       ▼
┌──────────────────┐
│ room_invitations │
│ - id             │──────────────────────────────────────┐
│ - invitee_id     │──────────────────┐                   │
│ - status         │                  │                   │
│ - responded_at   │                  │                   │
└──────────────────┘                  │                   │
                                      ▼                   ▼
                                ┌──────────┐        ┌───────────┐
                                │ users    │        │ (updated) │
                                │(invitee) │        │ status →  │
                                │          │        │ 'declined'│
                                └──────────┘        └───────────┘
```

### 📋 Field Modification Checklists

#### [ ] Adding New Response Data Checklist

- [ ] Modify controller to load relationships
- [ ] Create or update Resource class
- [ ] Pass Resource to ApiResponse::success()
- [ ] Update documentation

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                           |
| ----------------------------- | ------------------------------------------------ |
| `pending()` scope filter      | Ensures only pending invitations can be declined |
| `invitee_id` check            | Security: prevents declining others' invitations |
| `responded_at` timestamp      | Audit trail for when invitation was responded to |
| Status transition to DECLINED | Maintains consistent state machine               |

### 🚨 Common Pitfalls

| Pitfall                               | Prevention                                        |
| ------------------------------------- | ------------------------------------------------- |
| Declining expired invitation          | Not an issue - `pending()` scope filters them out |
| Not checking invitee ownership        | Query includes `invitee_id` check                 |
| Returning wrong status on not found   | Use 404 for all not-found scenarios               |
| Forgetting to update responded_at     | Handled in model's `decline()` method             |
| Race condition on concurrent declines | Safe - status update is idempotent                |
| Confusing decline with cancel         | Decline is for invitee, Cancel is for inviter     |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php                 ← Route definition (line 44)
app/Http/Controllers/Api/V1/Room/
  └── RoomInvitationController.php             ← Controller (decline method: 71-91)
app/Models/Room/
  └── RoomInvitation.php                       ← Model (decline: 132-137, pending: 58-61)
app/Enums/Room/
  └── RoomInvitationStatus.php                 ← Status enum with DECLINED value
app/Http/Utils/
  └── ApiResponse.php                          ← Response utility
database/migrations/
  └── 2025_12_29_100002_create_room_invitations_table.php  ← Table schema
```

---

## 8. Comparison with Related Endpoints

| Aspect            | Decline                  | Accept                                      |
| ----------------- | ------------------------ | ------------------------------------------- |
| **Status Result** | `declined`               | `accepted`                                  |
| **Side Effects**  | None                     | Creates room membership                     |
| **Service Layer** | Not used                 | Uses `RoomInvitationService`                |
| **Transaction**   | Not needed               | Required (invitation + member)              |
| **Validation**    | Only ownership + pending | + Expiry, blocked, already member, capacity |
| **Complexity**    | Simple                   | Complex                                     |

---

## Document Metadata

| Property            | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Endpoint**        | `POST /api/v1/user/room/invitations/{id}/decline` |
| **Domain**          | User / Room Membership                            |
| **Author**          | System Documentation                              |
| **Created**         | 2026-02-01                                        |
| **Laravel Version** | 12.x                                              |
| **PHP Version**     | 8.4+                                              |
