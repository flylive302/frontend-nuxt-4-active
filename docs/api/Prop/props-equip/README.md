# POST /api/v1/props/{userProp}/equip

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The Props Equip endpoint allows authenticated users to equip a prop they own. Equipped props are visible on the user's profile, chat bubbles, room themes, etc. Only one prop of each type can be equipped at a time; equipping a new prop auto-unequips any previously equipped prop of the same type.

### Responsibilities

- Verify user owns the prop (UserProp record)
- Validate prop is not expired
- Execute type-specific equip logic via Strategy pattern
- Auto-unequip any currently equipped prop of same type
- Dispatch PropEquipped event for cache invalidation

### What It Owns

| Owned           | Description                             |
| --------------- | --------------------------------------- |
| Equip logic     | Sets `is_equipped = true` on UserProp   |
| Type strategies | Delegates to type-specific strategies   |
| Auto-unequip    | Ensures only one equipped prop per type |

### Business Rules

| Rule               | Description                                |
| ------------------ | ------------------------------------------ |
| One per type       | Only one prop of each type can be equipped |
| Ownership required | User must own the UserProp                 |
| Not expired        | Prop must have `status = ACTIVE`           |
| Strategy-based     | Each prop type has custom equip behavior   |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
POST /api/v1/props/{userProp}/equip
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
  "message": "Prop equipped.",
  "data": {
    "equipped_prop_id": 12345, // int, UserProp ID
    "type": "frame" // string, prop type
  },
  "meta": {
    "timestamp": "2026-02-05T04:06:08.000000Z",
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
    "timestamp": "2026-02-05T04:06:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Bad Request (400) - Expired

```json
{
  "status": "error",
  "message": "This prop has expired.",
  "data": null,
  "errors": {
    "code": "prop_expired"
  },
  "meta": {
    "timestamp": "2026-02-05T04:06:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Successfully equipped prop              |
| `400` | Prop has expired                        |
| `401` | Missing or invalid authentication token |
| `403` | User doesn't own this prop              |
| `500` | Server error                            |