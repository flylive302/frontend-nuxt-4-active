# Agency System — Frontend API Specification

> **Version**: 1.0.0  
> **Last Updated**: 2025-12-27  
> **Authors**: Backend Engineering Team  
> **Audience**: Frontend Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL & Headers](#base-url--headers)
4. [Response Format](#response-format)
5. [Enums & Constants](#enums--constants)
6. [Data Contracts (Response Schemas)](#data-contracts-response-schemas)
7. [API Endpoints](#api-endpoints)
   - [Public Agency Endpoints](#public-agency-endpoints)
   - [User Agency Management](#user-agency-management)
   - [Invitation Endpoints](#invitation-endpoints)
   - [Join Request Endpoints](#join-request-endpoints)
   - [Member Management](#member-management)
   - [Block Management](#block-management)
8. [Authorization Matrix](#authorization-matrix)
9. [Error Handling](#error-handling)
10. [State Management](#state-management)
11. [Edge Cases & Business Rules](#edge-cases--business-rules)
12. [Loading & Retry Patterns](#loading--retry-patterns)

---

## Overview

The Agency System enables users to create and manage agencies, invite members, handle join requests, and manage memberships. This specification documents **exactly what is implemented** in the backend.

### Core Concepts

| Concept          | Description                                                                     |
| ---------------- | ------------------------------------------------------------------------------- |
| **Agency**       | An organization created by a user (owner). One user can own at most one agency. |
| **Member**       | A user who belongs to an agency with a specific role.                           |
| **Invitation**   | An offer sent by agency owner/admin to a user to join. Expires after 7 days.    |
| **Join Request** | A request from a user to join an agency. Requires approval.                     |
| **Block**        | Bi-directional mechanism to prevent future requests/invitations.                |

---

## Authentication

All endpoints require **Sanctum token authentication**.

```
Authorization: Bearer {token}
```

### Token Acquisition

Tokens are obtained via `/api/v1/auth/login` or `/api/v1/auth/register`.

---

## Base URL & Headers

### Base URL

```
https://api.flylive.app/api/v1
```

### Required Headers

| Header          | Value              | Required           |
| --------------- | ------------------ | ------------------ |
| `Authorization` | `Bearer {token}`   | Yes                |
| `Accept`        | `application/json` | Yes                |
| `Content-Type`  | `application/json` | Yes (for POST/PUT) |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {
    /* response payload */
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description.",
  "errors": {
    "field_name": ["Validation error message"]
  }
}
```

### Paginated Response (Cursor Pagination)

```json
{
  "data": [
    /* array of resources */
  ],
  "links": {
    "first": "...",
    "last": "...",
    "prev": "...",
    "next": "..."
  },
  "meta": {
    "path": "/api/v1/agencies",
    "per_page": 20,
    "next_cursor": "eyJpZCI6MTAsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0",
    "prev_cursor": null
  }
}
```

---

## Enums & Constants

### AgencyStatus

| Value       | Label     | Description             | Color     | Icon                      |
| ----------- | --------- | ----------------------- | --------- | ------------------------- |
| `pending`   | Pending   | Awaiting admin approval | `warning` | `heroicon-o-clock`        |
| `approved`  | Approved  | Active and operational  | `success` | `heroicon-o-check-circle` |
| `rejected`  | Rejected  | Application rejected    | `danger`  | `heroicon-o-x-circle`     |
| `blocked`   | Blocked   | Suspended by admin      | `danger`  | `heroicon-o-no-symbol`    |
| `dissolved` | Dissolved | Owner closed the agency | `gray`    | `heroicon-o-archive-box`  |

**Operational Status**: Only `approved` agencies are operational (can accept members, send invitations).

---

### AgencyMemberRole

| Value    | Label  | Description       | Can Manage Members | Can Manage Agency | Can Leave          |
| -------- | ------ | ----------------- | ------------------ | ----------------- | ------------------ |
| `owner`  | Owner  | Agency creator    | ✅                 | ✅                | ❌ (must dissolve) |
| `admin`  | Admin  | Delegated manager | ✅                 | ❌                | ✅                 |
| `member` | Member | Standard member   | ❌                 | ❌                | ✅                 |

**UI Colors**: `owner` = `primary`, `admin` = `info`, `member` = `gray`

---

### AgencyMemberStatus

| Value       | Label     | Description             | Is Terminal | Has Access |
| ----------- | --------- | ----------------------- | ----------- | ---------- |
| `active`    | Active    | Member in good standing | ❌          | ✅         |
| `suspended` | Suspended | Temporarily suspended   | ❌          | ❌         |
| `kicked`    | Kicked    | Removed by owner/admin  | ✅          | ❌         |
| `left`      | Left      | Voluntarily left        | ✅          | ❌         |

---

### AgencyInvitationStatus

| Value       | Label     | Is Terminal | Can Respond |
| ----------- | --------- | ----------- | ----------- |
| `pending`   | Pending   | ❌          | ✅          |
| `accepted`  | Accepted  | ✅          | ❌          |
| `declined`  | Declined  | ✅          | ❌          |
| `expired`   | Expired   | ✅          | ❌          |
| `cancelled` | Cancelled | ✅          | ❌          |

---

### AgencyJoinRequestStatus

| Value       | Label     | Is Terminal | Can Be Processed |
| ----------- | --------- | ----------- | ---------------- |
| `pending`   | Pending   | ❌          | ✅               |
| `approved`  | Approved  | ✅          | ❌               |
| `rejected`  | Rejected  | ✅          | ❌               |
| `cancelled` | Cancelled | ✅          | ❌               |

---

### AgencyBlockerType

| Value    | Label               | Effect                                        |
| -------- | ------------------- | --------------------------------------------- |
| `agency` | Agency blocked user | User cannot send join requests to this agency |
| `user`   | User blocked agency | Agency cannot send invitations to this user   |

---

## Data Contracts (Response Schemas)

### AgencyResource

**Base Fields** (always present):

```typescript
interface AgencyBase {
  id: number;
  name: string;
  country: string; // ISO 3166-1 alpha-2 (e.g., "US", "PK")
  logo: string | null; // ImageKit URL
  status: "pending" | "approved" | "rejected" | "blocked" | "dissolved";
  status_label: string; // Human-readable label
  created_at: string; // ISO 8601

  // Present when relation loaded
  owner?: {
    id: number;
    name: string;
    avatar: string | null;
    signature: string | null;
  };

  // Only for approved agencies
  member_count?: number;
}
```

**Sensitive Fields** (visible to owner, members, admins):

```typescript
interface AgencySensitive extends AgencyBase {
  address: string;

  // If coin reseller is set
  coin_reseller?: {
    id: number;
    name: string;
    signature: string | null;
  };

  // Only if status is "rejected"
  rejection_note?: string;
}
```

**Admin-Only Fields** (visible to Super Admin/Admin):

```typescript
interface AgencyAdmin extends AgencySensitive {
  national_id_images: Array<{
    url: string;
    file_id: string;
    side: "front" | "back";
  }> | null;
  dissolved_at: string | null;

  // If reviewed
  reviewed_by?: {
    id: number;
    name: string;
  };
  reviewed_at?: string;
}
```

---

### AgencyMemberResource

**Base Fields**:

```typescript
interface AgencyMemberBase {
  id: number;
  role: "owner" | "admin" | "member";
  role_label: string;
  status: "active" | "suspended" | "kicked" | "left";
  status_label: string;
  joined_at: string; // ISO 8601

  user: {
    id: number;
    name: string;
    avatar: string | null;
    signature: string | null;
  };
}
```

**Admin/Owner Fields** (visible to agency owner/admin):

```typescript
interface AgencyMemberAdmin extends AgencyMemberBase {
  invited_by?: {
    id: number;
    name: string;
  } | null;

  // For kicked/left members
  left_at?: string | null;
  leave_reason?: string | null;
  removed_by?: {
    id: number;
    name: string;
  } | null;
}
```

---

### AgencyInvitationResource

```typescript
interface AgencyInvitation {
  id: number;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  status_label: string;
  expires_at: string; // ISO 8601
  created_at: string;
  is_expired: boolean;
  can_respond: boolean; // true if pending AND not expired

  // For invitee view
  agency?: {
    id: number;
    name: string;
    country: string;
    logo: string | null;
  };

  // For agency owner view (sent invitations)
  user?: {
    id: number;
    name: string;
    avatar: string | null;
    signature: string | null;
  };

  invited_by: {
    id: number;
    name: string;
  };
}
```

---

### AgencyJoinRequestResource

```typescript
interface AgencyJoinRequest {
  id: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_label: string;
  message: string | null; // Optional message from requester
  created_at: string;
  can_be_processed: boolean; // true if pending

  // For requester view
  agency?: {
    id: number;
    name: string;
    country: string;
    logo: string | null;
  };

  // For agency owner view
  user?: {
    id: number;
    name: string;
    avatar: string | null;
    signature: string | null;
  };

  // For processed requests
  processed_at?: string;
  processed_by?: {
    id: number;
    name: string;
  };
}
```

---

### UserAgencyResponse

Response for `/api/v1/user/agency`:

```typescript
interface UserAgencyResponse {
  // null if user has no agency
  agency: AgencyResource | null;

  // null if user is owner (not a member record)
  membership: AgencyMemberResource | null;

  // true if user owns the agency
  is_owner: boolean;
}
```

---

## API Endpoints

### Public Agency Endpoints

#### List Approved Agencies

```http
GET /api/v1/agencies
```

**Query Parameters**:

| Parameter  | Type    | Required | Description                                 |
| ---------- | ------- | -------- | ------------------------------------------- |
| `search`   | string  | No       | Search by name (partial match)              |
| `country`  | string  | No       | Filter by country code (ISO 3166-1 alpha-2) |
| `per_page` | integer | No       | Items per page (default: 20, max: 100)      |
| `cursor`   | string  | No       | Cursor for pagination                       |

**Response**: Paginated list of `AgencyResource` (approved agencies only)

**Authorization**: Any authenticated user

---

#### View Single Agency

```http
GET /api/v1/agencies/{agency_id}
```

**Path Parameters**:

| Parameter   | Type    | Description |
| ----------- | ------- | ----------- |
| `agency_id` | integer | Agency ID   |

**Response**: `AgencyResource`

**Authorization**:

- Approved agencies: Any authenticated user
- Non-approved agencies: Owner, member, or admin only

**Error Codes**:

- `403`: Unauthorized to view this agency
- `404`: Agency not found

---

#### Get Agency Members

```http
GET /api/v1/agencies/{agency_id}/members
```

**Query Parameters**:

| Parameter  | Type    | Required | Description                  |
| ---------- | ------- | -------- | ---------------------------- |
| `per_page` | integer | No       | Items per page (default: 20) |
| `cursor`   | string  | No       | Cursor for pagination        |

**Response**: Paginated list of `AgencyMemberResource` (active members only)

**Authorization**: Same as viewing agency

---

#### Create Agency Application

```http
POST /api/v1/agencies
```

**Request Body**:

```typescript
interface CreateAgencyRequest {
  name: string; // Required, max 255 chars
  country: string; // Required, exactly 2 chars (ISO 3166-1 alpha-2)
  address: string; // Required, max 1000 chars
  logo?: string; // Optional, valid URL (ImageKit)
  logo_file_id?: string; // Optional, ImageKit file ID
  national_id_images?: Array<{
    url: string; // Required within array
    file_id: string; // Required within array
    side: "front" | "back"; // Required within array
  }>;
  coin_reseller_id?: number; // Optional, must exist in users table
}
```

**Response**: `AgencyResource` (status = "pending")

**Authorization**:

- User must NOT be blocked (`is_blocked = false`)
- User must NOT already own an agency (any status)

**Error Codes**:

- `403`: User is blocked or already owns an agency
- `422`: Validation error

**Error Messages**:

```json
{
  "success": false,
  "message": "You already own an agency.",
  "errors": {}
}
```

---

#### Request to Join Agency

```http
POST /api/v1/agencies/{agency_id}/join
```

**Request Body**:

```typescript
interface JoinAgencyRequest {
  message?: string; // Optional, max 500 chars
}
```

**Response**: `AgencyJoinRequestResource`

**Authorization**:

- Agency must be `approved` (operational)
- User must NOT already be a member
- User must NOT be blocked by the agency
- User must NOT have a pending request

**Error Codes**:

- `422`: Validation failed (see error messages below)

**Specific Error Messages**:

| Condition              | Message                                                     |
| ---------------------- | ----------------------------------------------------------- |
| Agency not operational | "This agency is not accepting join requests."               |
| Already a member       | "You are already a member of this agency."                  |
| Blocked by agency      | "You are not allowed to send join requests to this agency." |
| Pending request exists | "You already have a pending join request for this agency."  |

---

#### Cancel Join Request

```http
DELETE /api/v1/agencies/{agency_id}/join
```

**Response**:

```json
{
  "success": true,
  "message": "Join request cancelled.",
  "data": null
}
```

**Authorization**: Only the requester can cancel their own pending request

**Error Codes**:

- `404`: No pending join request found

---

#### Block Agency (User Blocks Agency)

```http
POST /api/v1/agencies/{agency_id}/block
```

**Effect**: Agency cannot send invitations to this user

**Response**:

```json
{
  "success": true,
  "message": "Agency blocked successfully.",
  "data": null
}
```

---

#### Unblock Agency

```http
DELETE /api/v1/agencies/{agency_id}/block
```

**Response**:

```json
{
  "success": true,
  "message": "Agency unblocked.",
  "data": null
}
```

**Error Codes**:

- `404`: No block found

---

### User Agency Management

#### Get User's Agency

```http
GET /api/v1/user/agency
```

**Response**:

If user owns or is a member of an agency:

```json
{
  "success": true,
  "data": {
    "agency": { /* AgencyResource */ },
    "membership": { /* AgencyMemberResource or null */ },
    "is_owner": true | false
  }
}
```

If user has no agency:

```json
{
  "success": true,
  "message": "You are not part of any agency.",
  "data": null
}
```

---

#### Leave Agency

```http
POST /api/v1/user/agency/leave
```

**Request Body**:

```typescript
interface LeaveAgencyRequest {
  reason?: string; // Optional, max 500 chars
}
```

**Response**:

```json
{
  "success": true,
  "message": "You have left the agency.",
  "data": null
}
```

**Authorization**:

- User must be a member (not owner)
- Owners cannot leave — they must dissolve

**Error Codes**:

- `404`: Not a member of any agency
- `422`: Owners cannot leave (must dissolve)

---

#### Dissolve Agency (Owner Only)

```http
DELETE /api/v1/user/agency
```

**Effect**:

- Sets agency status to `dissolved`
- All members are kicked (`status = kicked`)
- Members' `default_reseller_id` is set to `null`

**Response**:

```json
{
  "success": true,
  "message": "Agency dissolved successfully.",
  "data": null
}
```

**Authorization**: Agency owner only (approved agencies only)

**Error Codes**:

- `404`: User does not own an agency
- `403`: Cannot dissolve non-approved agency

---

#### Change Coin Reseller (Owner Only)

```http
PUT /api/v1/user/agency/coin-reseller
```

**Request Body**:

```typescript
interface ChangeCoinResellerRequest {
  coin_reseller_id: number | null; // User ID or null to remove
}
```

**Response**: Updated `AgencyResource`

**Side Effect**: All active members' `default_reseller_id` is updated to match

**Authorization**: Agency owner only

**Error Codes**:

- `404`: User does not own an agency
- `422`: Invalid reseller ID

---

### Invitation Endpoints

#### Get Received Invitations

```http
GET /api/v1/user/agency/invitations
```

**Query Parameters**:

| Parameter  | Type    | Required | Description                  |
| ---------- | ------- | -------- | ---------------------------- |
| `per_page` | integer | No       | Items per page (default: 20) |

**Response**: Paginated list of `AgencyInvitationResource` (valid pending invitations only)

**Note**: Uses standard offset pagination, not cursor pagination

---

#### Get Sent Invitations (Owner/Admin)

```http
GET /api/v1/user/agency/invitations/sent
```

**Response**: Paginated list of `AgencyInvitationResource`

**Authorization**: User must own or be admin of an agency

**Error Codes**:

- `403`: "You do not manage any agency."

---

#### Send Invitation (Owner/Admin)

```http
POST /api/v1/user/agency/invitations
```

**Request Body**:

```typescript
interface SendInvitationRequest {
  user_id: number; // Required, must exist
}
```

**Response**: `AgencyInvitationResource`

**Authorization**:

- User must own or be admin of an operational agency
- Target user must not be a member
- Target user must not have blocked the agency
- No existing pending invitation

**Error Codes**:

- `403`: Not authorized to invite
- `422`: Validation error

**Specific Error Messages**:

| Condition                 | Message                                               |
| ------------------------- | ----------------------------------------------------- |
| User already member       | "User is already a member of this agency."            |
| User blocked agency       | "This user has blocked invitations from your agency." |
| Pending invitation exists | "This user already has a pending invitation."         |

---

#### Cancel Invitation (Owner/Admin/Inviter)

```http
DELETE /api/v1/user/agency/invitations/{invitation_id}
```

**Response**:

```json
{
  "success": true,
  "message": "Invitation cancelled.",
  "data": null
}
```

**Authorization**:

- The inviter can cancel their own invitation
- Agency owner can cancel any invitation
- Officials (Super Admin/Admin) can cancel any

---

#### Accept Invitation

```http
POST /api/v1/invitations/{invitation_id}/accept
```

**Response**: `AgencyMemberResource` (the new membership)

**Side Effect**: User's `default_reseller_id` is set to agency's `coin_reseller_id`

**Authorization**: Only the invitee can accept

**Preconditions**:

- Invitation must be `pending`
- Invitation must not be expired
- User must not already be a member of another agency

**Error Codes**:

- `403`: Not authorized or cannot respond
- `422`: Already a member of another agency

---

#### Decline Invitation

```http
POST /api/v1/invitations/{invitation_id}/decline
```

**Response**:

```json
{
  "success": true,
  "message": "Invitation declined.",
  "data": null
}
```

**Authorization**: Only the invitee can decline

---

### Join Request Endpoints

#### Get Incoming Join Requests (Owner/Admin)

```http
GET /api/v1/user/agency/join-requests
```

**Response**: Paginated list of `AgencyJoinRequestResource` (pending only)

**Authorization**: User must own or be admin of an agency

---

#### Approve Join Request

```http
POST /api/v1/user/agency/join-requests/{join_request_id}/approve
```

**Response**: `AgencyJoinRequestResource` (updated with processor info)

**Side Effect**:

- Creates `AgencyMember` record with `role = member`, `status = active`
- Sets user's `default_reseller_id` to agency's `coin_reseller_id`

**Authorization**: Agency owner/admin

---

#### Reject Join Request

```http
POST /api/v1/user/agency/join-requests/{join_request_id}/reject
```

**Response**:

```json
{
  "success": true,
  "message": "Join request rejected.",
  "data": null
}
```

**Authorization**: Agency owner/admin

---

### Member Management

#### Kick Member

```http
DELETE /api/v1/user/agency/members/{member_id}
```

**Request Body**:

```typescript
interface KickMemberRequest {
  reason?: string; // Optional, max 500 chars
}
```

**Response**:

```json
{
  "success": true,
  "message": "Member removed from agency.",
  "data": null
}
```

**Side Effect**: Member's `default_reseller_id` is set to `null`

**Authorization Hierarchy**:

- Owner can kick admins and members
- Admin can kick members only (not other admins)
- Officials (Super Admin/Admin) can kick anyone except owner

**Error Codes**:

- `403`: Not authorized to kick this member

---

### Block Management

#### Block User (Agency Blocks User)

```http
POST /api/v1/user/agency/users/{user_id}/block
```

**Effect**: User cannot send join requests to this agency

**Response**:

```json
{
  "success": true,
  "message": "User blocked successfully.",
  "data": null
}
```

**Authorization**: Agency owner/admin

---

#### Unblock User

```http
DELETE /api/v1/user/agency/users/{user_id}/block
```

**Response**:

```json
{
  "success": true,
  "message": "User unblocked.",
  "data": null
}
```

**Error Codes**:

- `404`: User is not blocked

---

## Authorization Matrix

### System Roles (Spatie)

| Permission            | Super Admin | Admin | Moderator | User              |
| --------------------- | ----------- | ----- | --------- | ----------------- |
| View any agency       | ✅          | ✅    | ✅        | Own/approved only |
| Create agency         | ✅          | ✅    | ❌        | ✅                |
| Approve/Reject agency | ✅          | ✅    | ❌        | ❌                |
| Block agency          | ✅          | ✅    | ❌        | ❌                |
| Delete agency (hard)  | ✅          | ❌    | ❌        | ❌                |
| Manage any agency     | ✅          | ✅    | ❌        | ❌                |

### Agency-Level Roles

| Action                | Owner    | Admin        | Member |
| --------------------- | -------- | ------------ | ------ |
| Edit agency details   | ✅       | ❌           | ❌     |
| Change coin reseller  | ✅       | ❌           | ❌     |
| Invite members        | ✅       | ✅           | ❌     |
| Cancel invitations    | ✅ (all) | Own only     | ❌     |
| Approve join requests | ✅       | ✅           | ❌     |
| Reject join requests  | ✅       | ✅           | ❌     |
| Block/unblock users   | ✅       | ✅           | ❌     |
| Kick members          | ✅ (all) | Members only | ❌     |
| Leave agency          | ❌       | ✅           | ✅     |
| Dissolve agency       | ✅       | ❌           | ❌     |

---

## Error Handling

### HTTP Status Codes

| Code  | Meaning           | Frontend Action                            |
| ----- | ----------------- | ------------------------------------------ |
| `200` | Success           | Process response                           |
| `201` | Created           | Process response, refresh lists            |
| `400` | Bad Request       | Show error message                         |
| `401` | Unauthenticated   | Redirect to login                          |
| `403` | Forbidden         | Show access denied message                 |
| `404` | Not Found         | Show not found message                     |
| `422` | Validation Error  | Show field errors                          |
| `429` | Too Many Requests | Show rate limit message, implement backoff |
| `500` | Server Error      | Show generic error, retry                  |

### Error Response Structure

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  errors: Record<string, string[]>;
}
```

### Common Error Codes

| Error Code               | Context       | Description                               |
| ------------------------ | ------------- | ----------------------------------------- |
| `AGENCY_RESELLER_LOCKED` | Coin purchase | User is in agency, cannot change reseller |

### Coin Reseller Lock Error

When a member tries to change their coin reseller:

```json
{
  "success": false,
  "message": "You are part of an agency. Your coin reseller is {reseller_name} (@{reseller_signature}). Only the agency owner can change the coin reseller. To choose a different reseller, you must leave the agency.",
  "error_code": "AGENCY_RESELLER_LOCKED"
}
```

---

## State Management

### Recommended State Structure

```typescript
interface AgencyState {
  // User's own agency context
  userAgency: {
    agency: Agency | null;
    membership: AgencyMember | null;
    isOwner: boolean;
    loading: boolean;
    error: string | null;
  };

  // Public agency browsing
  agencies: {
    items: Agency[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    cursor: string | null;
    filters: {
      search: string;
      country: string;
    };
  };

  // Agency detail view
  currentAgency: {
    agency: Agency | null;
    members: AgencyMember[];
    membersLoading: boolean;
    membersCursor: string | null;
    loading: boolean;
    error: string | null;
  };

  // Invitations received
  receivedInvitations: {
    items: AgencyInvitation[];
    loading: boolean;
    error: string | null;
  };

  // Invitations sent (owner/admin)
  sentInvitations: {
    items: AgencyInvitation[];
    loading: boolean;
    error: string | null;
  };

  // Join requests (owner/admin)
  joinRequests: {
    items: AgencyJoinRequest[];
    loading: boolean;
    error: string | null;
  };
}
```

### State Invalidation Triggers

| Action               | Invalidate                              |
| -------------------- | --------------------------------------- |
| Create agency        | `userAgency`                            |
| Accept invitation    | `userAgency`, `receivedInvitations`     |
| Decline invitation   | `receivedInvitations`                   |
| Leave agency         | `userAgency`                            |
| Dissolve agency      | `userAgency`                            |
| Send invitation      | `sentInvitations`                       |
| Cancel invitation    | `sentInvitations`                       |
| Submit join request  | Agency join button state                |
| Cancel join request  | Agency join button state                |
| Approve join request | `joinRequests`, `currentAgency.members` |
| Reject join request  | `joinRequests`                          |
| Kick member          | `currentAgency.members`                 |
| Change coin reseller | `userAgency`                            |

---

## Edge Cases & Business Rules

### One Agency Per User

- A user can own at most **one** agency (regardless of status)
- Check before showing "Create Agency" button
- **API Check**: Policy returns `false` if user already has an agency

### Invitation Expiry

- Invitations expire after **7 days** (configurable)
- `expires_at` is set on creation
- Frontend should check `can_respond` before showing accept/decline buttons
- Expired invitations should appear grayed out with "Expired" badge

### Coin Reseller Inheritance

1. **On Join**: Member's `default_reseller_id` = Agency's `coin_reseller_id`
2. **While Member**: Cannot change own reseller (locked)
3. **On Leave/Kick**: `default_reseller_id` = `null`
4. **On Reseller Change**: All active members updated

### Owner Cannot Leave

- Owners must **dissolve** the agency to leave
- `canLeave` returns `false` for `owner` role
- Show "Dissolve Agency" instead of "Leave"

### Dissolution Effects

- Agency status → `dissolved`
- All members status → `kicked`
- All members' reseller → `null`
- Agency can be revived by admin (future feature)

### Pending Request Deduplication

- User cannot have multiple pending join requests to same agency
- User cannot have multiple pending invitations from same agency
- Check before allowing new request/invitation

### Block Priority

| Blocker            | Effect               | Check On                |
| ------------------ | -------------------- | ----------------------- |
| Agency blocks user | User cannot join     | Join request submission |
| User blocks agency | Agency cannot invite | Invitation send         |

---

## Loading & Retry Patterns

### Optimistic Updates

**Safe for optimistic updates**:

- Accept/decline invitation → Remove from list
- Cancel join request → Update button state
- Block/unblock agency → Update icon

**Not safe for optimistic updates** (wait for server):

- Create agency
- Approve join request
- Kick member
- Dissolve agency

### Loading States

| Operation      | Show Loading          | Disable            |
| -------------- | --------------------- | ------------------ |
| List agencies  | Skeleton cards        | -                  |
| View agency    | Page loader           | -                  |
| Create agency  | Submit button spinner | Form               |
| Join/Leave     | Button spinner        | All agency actions |
| Accept/Decline | Button spinner        | Both buttons       |
| Approve/Reject | Row spinner           | Both buttons       |

### Retry Strategy

```typescript
const retryConfig = {
  maxRetries: 3,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
  retryCondition: (error: AxiosError) => {
    const status = error.response?.status;
    return status === undefined || status >= 500 || status === 429;
  },
};
```

### Rate Limiting

| Endpoint Group  | Limit      | Window   |
| --------------- | ---------- | -------- |
| General API     | Role-based | Per hour |
| Agency creation | 5          | Per hour |
| Invitations     | 20         | Per hour |

**429 Response**:

```json
{
  "message": "Too Many Attempts.",
  "retry_after": 3600
}
```

---

## Appendix: Full Endpoint Reference

| Method   | Endpoint                                  | Description                |
| -------- | ----------------------------------------- | -------------------------- |
| `GET`    | `/agencies`                               | List approved agencies     |
| `POST`   | `/agencies`                               | Create agency application  |
| `GET`    | `/agencies/{id}`                          | View single agency         |
| `GET`    | `/agencies/{id}/members`                  | Get agency members         |
| `POST`   | `/agencies/{id}/join`                     | Request to join            |
| `DELETE` | `/agencies/{id}/join`                     | Cancel join request        |
| `POST`   | `/agencies/{id}/block`                    | Block agency (user→agency) |
| `DELETE` | `/agencies/{id}/block`                    | Unblock agency             |
| `GET`    | `/user/agency`                            | Get user's agency          |
| `POST`   | `/user/agency/leave`                      | Leave agency               |
| `DELETE` | `/user/agency`                            | Dissolve agency            |
| `PUT`    | `/user/agency/coin-reseller`              | Change coin reseller       |
| `GET`    | `/user/agency/invitations`                | Get received invitations   |
| `GET`    | `/user/agency/invitations/sent`           | Get sent invitations       |
| `POST`   | `/user/agency/invitations`                | Send invitation            |
| `DELETE` | `/user/agency/invitations/{id}`           | Cancel invitation          |
| `GET`    | `/user/agency/join-requests`              | Get incoming requests      |
| `POST`   | `/user/agency/join-requests/{id}/approve` | Approve request            |
| `POST`   | `/user/agency/join-requests/{id}/reject`  | Reject request             |
| `DELETE` | `/user/agency/members/{id}`               | Kick member                |
| `POST`   | `/user/agency/users/{id}/block`           | Block user (agency→user)   |
| `DELETE` | `/user/agency/users/{id}/block`           | Unblock user               |
| `POST`   | `/invitations/{id}/accept`                | Accept invitation          |
| `POST`   | `/invitations/{id}/decline`               | Decline invitation         |
