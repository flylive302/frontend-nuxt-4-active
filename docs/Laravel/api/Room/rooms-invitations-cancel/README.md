# DELETE /api/v1/rooms/{room}/invitations/{invitationId}

> **Domain**: Room - Invitations  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

The Cancel Invitation endpoint allows room administrators to cancel a previously sent room invitation. Only room members with member management permissions (admins/owner) can cancel invitations.

### Responsibilities

- Authenticate request via Sanctum token
- Verify user is room member with management permissions
- Cancel the specified invitation via service
- Return success confirmation

### What It Owns

| Owned                       | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| Invitation cancellation     | Removes pending invitations                          |
| Permission verification     | Checks user can manage members                       |

### External Dependencies

| Dependency                  | Type           | Purpose                                     |
| --------------------------- | -------------- | ------------------------------------------- |
| `room_invitations` table    | Database       | Invitation storage                          |
| Laravel Sanctum             | Package        | Token authentication                        |
| RoomInvitationService       | Service        | Invitation business logic                   |
| RoomMemberService           | Service        | Permission checking                         |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
DELETE /api/v1/rooms/{room}/invitations/{invitationId}
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum  
✅ **Permission** - Room member with manage members capability

### Route Parameters

| Parameter       | Type      | Required | Description             |
| --------------- | --------- | -------- | ----------------------- |
| `room`          | `integer` | ✅       | Room ID                 |
| `invitationId`  | `integer` | ✅       | Invitation ID to cancel |

### Request Headers

| Header             | Required | Type                  | Description                  |
| ------------------ | -------- | --------------------- | ---------------------------- |
| `Accept`           | ✅       | `application/json`    | Response format              |
| `Authorization`    | ✅       | `Bearer {token}`      | Sanctum authentication token |

### Request Body Schema

**No request body** - DELETE request with path parameters only.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Invitation cancelled",
  "data": null
}
```

#### ❌ Unauthorized Error (401)

```json
{
  "status": "error",
  "message": "Unauthenticated.",
  "data": null
}
```

#### ❌ Forbidden Error (403)

```json
{
  "status": "error",
  "message": "You do not have permission to cancel this invitation.",
  "data": null
}
```

#### ❌ Not Found Error (404)

```json
{
  "status": "error",
  "message": "Invitation not found.",
  "data": null
}
```

### HTTP Status Codes

| Code  | Condition                           |
| ----- | ----------------------------------- |
| `200` | Invitation cancelled successfully   |
| `401` | Unauthenticated                     |
| `403` | No permission to manage members     |
| `404` | Invitation not found                |
| `500` | Internal server error               |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/room-membership.php:67                                     │
│                                                                             │
│ Route Definition:                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Route::delete('/invitations/{invitationId}',                            │ │
│ │     [RoomInvitationController::class, 'cancel'])                        │ │
│ │     ->whereNumber('invitationId');                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Middleware: auth:sanctum (line 27)                                          │
│ Parent prefix: rooms/{room} (line 59)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Room/RoomInvitationController.php         │
│ Method: cancel(Request $request, Room $room, int $invitationId) at line 141 │
│                                                                             │
│ STEP 1: Get User (lines 143-147)                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │                                                                         │ │
│ │ if ($user === null) {                                                   │ │
│ │     return ApiResponse::unauthorized();                                 │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Cancel via Service (line 149)                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->invitationService->cancelInvitation($invitationId, $user->id);   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return Success (line 151)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(null, 'Invitation cancelled');              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Room/RoomInvitationService.php                           │
│ Method: cancelInvitation()                                                  │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Find invitation by ID                                                │ │
│ │ 2. Verify user's room membership exists                                 │ │
│ │ 3. Verify user has manage members permission                            │ │
│ │ 4. Mark invitation as cancelled                                         │ │
│ │ 5. Return confirmation                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                                          | Used By Endpoints                    | Reusable   |
| --------------------------------------------- | ------------------------------------ | ---------- |
| `RoomInvitationController.php`                | All invitation endpoints             | ⭕ Mixed   |
| `RoomInvitationService.php`                   | Invitation management                | ✅ Reusable|
| `RoomMemberService.php`                       | Member permission checking           | ✅ Reusable|

---

## 5. Error Handling & Edge Cases

### Authorization Errors (403)

| Error                              | Condition                              |
| ---------------------------------- | -------------------------------------- |
| Not a room member                  | User not in the room's member list     |
| No manage permission               | Role doesn't have member management    |

### Not Found Errors (404)

| Error                              | Condition                              |
| ---------------------------------- | -------------------------------------- |
| Invitation not found               | Invalid ID or already cancelled        |
| Room not found                     | Route model binding fails              |

### Edge Cases

| Case                              | Behavior                                           |
| --------------------------------- | -------------------------------------------------- |
| Already cancelled invitation      | 404 (query for pending only)                       |
| Already accepted invitation       | Service throws exception                           |
| Expired invitation                | Still can be cancelled                             |
| Self-sent invitation              | Can cancel own sent invitations                    |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT                MIDDLEWARE              CONTROLLER            SERVICE               DATABASE
   │                       │                       │                       │                    │
   │DELETE /{room}/        │                       │                       │                    │
   │invitations/{id}       │                       │                       │                    │
   │──────────────────────▶│                       │                       │                    │
   │                       │ 1. auth:sanctum       │                       │                    │
   │                       │ 2. Route model bind   │                       │                    │
   │                       │──────────────────────▶│                       │                    │
   │                       │                       │ 3. cancelInvitation() │                    │
   │                       │                       │──────────────────────▶│                    │
   │                       │                       │                       │ 4. SELECT          │
   │                       │                       │                       │    invitation      │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │                       │ 5. Check perms     │
   │                       │                       │                       │ 6. UPDATE          │
   │                       │                       │                       │    cancelled       │
   │                       │                       │                       │───────────────────▶│
   │                       │                       │                       │◀───────────────────│
   │                       │                       │◀──────────────────────│                    │
   │                       │◀──────────────────────│                       │                    │
   │◀──────────────────────│                       │                       │                    │
   │  200 OK + JSON        │                       │                       │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                        | Location                                              |
| ------------------------------- | ----------------------------------------------------- |
| Notification on cancel          | RoomInvitationService::cancelInvitation()             |
| Audit logging                   | Add to service after successful cancel                |
| Bulk cancel                     | New controller method, loop in service                |

### 📁 File Locations Quick Reference

```
routes/api/room-membership.php:67                   ← Route definition
app/Http/Controllers/Api/V1/Room/
  └── RoomInvitationController.php:141-157          ← Controller method
app/Services/Room/
  └── RoomInvitationService.php                     ← Cancel logic
  └── RoomMemberService.php                         ← Permission check
```

---

## 8. MSAB Realtime Event Contracts

> This endpoint does not emit MSAB real-time events. Invitation cancellation is a synchronous operation that doesn't require real-time notification.

---

## 9. Document Metadata

| Property            | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| **Endpoint**        | `DELETE /api/v1/rooms/{room}/invitations/{invitationId}`|
| **Domain**          | Room - Invitations                                      |
| **Author**          | System Documentation                                    |
| **Created**         | 2026-02-04                                              |
| **Laravel Version** | 12.x                                                    |
| **PHP Version**     | 8.4+                                                    |
