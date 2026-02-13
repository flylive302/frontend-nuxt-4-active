# Room API Documentation

> **Domain**: Room  
> **Version**: V1  
> **Last Updated**: 2026-01-29

---

## Overview

The Room domain manages live rooms where users can gather, chat, and interact. It supports:

- Public and private rooms (password-protected)
- Multi-room membership (users can be in multiple rooms)
- Role-based permissions (Owner > Admin > Member)
- Join requests and invitations workflow
- User blocking

---

## Endpoints Summary

### Room CRUD (`/api/v1/rooms`)

| Method | Endpoint           | Auth | Description                             |
| ------ | ------------------ | ---- | --------------------------------------- |
| GET    | `/rooms`           | No   | List all rooms with filtering           |
| GET    | `/rooms/{id}`      | No   | Get room details                        |
| POST   | `/rooms`           | ✅   | Create a new room                       |
| PUT    | `/rooms/{id}`      | ✅   | Update room details                     |
| DELETE | `/rooms/{id}`      | ✅   | Delete a room                           |
| POST   | `/rooms/{id}/join` | ✅   | Verify password for private room access |

### Room Membership (`/api/v1/rooms/{id}`)

| Method | Endpoint                            | Auth | Description                  |
| ------ | ----------------------------------- | ---- | ---------------------------- |
| GET    | `/rooms/{id}/members`               | No   | List room members            |
| POST   | `/rooms/{id}/join-request`          | ✅   | Submit join request          |
| DELETE | `/rooms/{id}/join-request`          | ✅   | Cancel join request          |
| DELETE | `/rooms/{id}/membership`            | ✅   | Leave room (drop membership) |
| DELETE | `/rooms/{id}/members/{userId}`      | ✅   | Kick member (owner/admin)    |
| PATCH  | `/rooms/{id}/members/{userId}/role` | ✅   | Change member role           |

### Invitations

| Method | Endpoint                              | Auth | Description                 |
| ------ | ------------------------------------- | ---- | --------------------------- |
| GET    | `/user/room/invitations`              | ✅   | Get my invitations          |
| POST   | `/user/room/invitations/{id}/accept`  | ✅   | Accept invitation           |
| POST   | `/user/room/invitations/{id}/decline` | ✅   | Decline invitation          |
| GET    | `/rooms/{id}/invitations`             | ✅   | Get room's sent invitations |
| POST   | `/rooms/{id}/invitations`             | ✅   | Send invitation             |
| DELETE | `/rooms/{id}/invitations/{invId}`     | ✅   | Cancel invitation           |

### Blocking

| Method | Endpoint                      | Auth | Description        |
| ------ | ----------------------------- | ---- | ------------------ |
| GET    | `/rooms/{id}/blocks`          | ✅   | List blocked users |
| POST   | `/rooms/{id}/blocks`          | ✅   | Block user         |
| DELETE | `/rooms/{id}/blocks/{userId}` | ✅   | Unblock user       |

---

## Room Types

| Type    | Enum Value | Password Required | Join Flow                      |
| ------- | ---------- | ----------------- | ------------------------------ |
| Public  | `public`   | No                | Direct join via join-request   |
| Private | `private`  | Yes               | Password verification required |

---

## Member Roles

| Role     | Permissions                                        |
| -------- | -------------------------------------------------- |
| `owner`  | Full control (delete room, manage all members)     |
| `admin`  | Manage members, approve requests, send invitations |
| `member` | Participate in room                                |

---

## Key Components

### Controllers

| Controller                                                                                                                            | Purpose                           |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [RoomController](file:///home/xha/FlyLive/backend-Laravel-12/app/Http/Controllers/Api/V1/Room/RoomController.php)                     | Room CRUD + password verification |
| [RoomMembershipController](file:///home/xha/FlyLive/backend-Laravel-12/app/Http/Controllers/Api/V1/Room/RoomMembershipController.php) | Membership, invitations, blocking |

### Actions

| Action                     | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `CreateRoomAction`         | Create room with validation             |
| `UpdateRoomAction`         | Update room details                     |
| `DeleteRoomAction`         | Delete room                             |
| `VerifyRoomPasswordAction` | Verify password for private room access |

### Services

| Service                 | Purpose                         |
| ----------------------- | ------------------------------- |
| `RoomMemberService`     | Join, leave, kick, role changes |
| `RoomInvitationService` | Invitations and join requests   |
| `RoomBlockService`      | User blocking                   |
| `RoomLevelService`      | Room XP and leveling            |

### Request Classes

| Request                    | Endpoint                                        |
| -------------------------- | ----------------------------------------------- |
| `CreateRoomRequest`        | POST `/rooms`                                   |
| `UpdateRoomRequest`        | PUT `/rooms/{id}`                               |
| `JoinRoomRequest`          | POST `/rooms/{id}/join` (password verification) |
| `SubmitJoinRequestRequest` | POST `/rooms/{id}/join-request`                 |

---

## Response Format

All responses use the standard `ApiResponse` format:

```json
{
  "status": "success",
  "message": "Room created successfully",
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-29T00:00:00.000000Z"
  }
}
```

---

## Recent Changes (2026-01-29)

The following changes were made to address audit findings:

| Change                                                 | Files Affected                                                |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| Removed broken `giftLeaderboard` endpoint              | `RoomController`, `routes/api/rooms.php`                      |
| Renamed `JoinRoomAction` → `VerifyRoomPasswordAction`  | Accurate naming                                               |
| Made password optional in `JoinRoomRequest`            | For public rooms                                              |
| Replaced string literals with enums                    | `Internal/RoomController`, `RoomMemberService`                |
| Renamed `JoinRoomRequest` → `SubmitJoinRequestRequest` | Avoid naming collision                                        |
| Removed deprecated methods                             | `RoomMember`, `RoomMemberService`, `RoomMembershipController` |
| Removed deprecated `/leave` route                      | `routes/api/room-membership.php`                              |

See [Room Domain Audit Report](file:///home/xha/FlyLive/backend-Laravel-12/docs/domain/room-domain-audit.md) for full audit details.
