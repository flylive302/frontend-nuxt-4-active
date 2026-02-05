# POST /api/v1/props/{userProp}/unequip

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Unequip endpoint allows authenticated users to unequip a prop they own. This removes the prop's visual effect from the user's profile, chat bubbles, or room without deleting the ownership record.

### Responsibilities

- Verify user owns the prop (UserProp record)
- Execute type-specific unequip logic via Strategy pattern
- Handle idempotent unequip (already unequipped = success)

### What It Owns

| Owned           | Description                            |
| --------------- | -------------------------------------- |
| Unequip logic   | Sets `is_equipped = false` on UserProp |
| Type strategies | Delegates to type-specific strategies  |

### Business Rules

| Rule               | Description                                  |
| ------------------ | -------------------------------------------- |
| Ownership required | User must own the UserProp                   |
| Idempotent         | Unequipping already-unequipped prop succeeds |
| Strategy-based     | Each prop type has custom unequip behavior   |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/props/{userProp}/unequip
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Authorization

✅ **Implicit** - Service verifies `user_id` matches authenticated user

### Path Parameters

| Parameter  | Type  | Constraints                            | Example |
| ---------- | ----- | -------------------------------------- | ------- |
| `userProp` | `int` | Required, ID of user's UserProp record | `12345` |

### Request Body

None required.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Prop unequipped.",
  "data": null,
  "meta": {
    "timestamp": "2026-02-05T04:09:28.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Forbidden (403) - Not Owned

```json
{
  "status": "error",
  "message": "You do not own this prop.",
  "data": null,
  "errors": {
    "code": "prop_not_owned"
  },
  "meta": {
    "timestamp": "2026-02-05T04:09:28.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully unequipped prop            |
| `401` | Missing or invalid authentication token |
| `403` | User doesn't own this prop              |
| `500` | Server error                            |