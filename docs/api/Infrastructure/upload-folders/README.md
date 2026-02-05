# GET /api/v1/uploads/folders

> **Domain**: Infrastructure  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-02

---

## 1. Domain Overview

### Purpose

Returns the list of allowed upload folders for client-side file uploads to ImageKit CDN, enabling clients to validate folder selections before requesting upload authentication.

### Responsibilities

- Provide the complete list of allowed upload folders
- Enable client-side validation before requesting auth params
- Serve as a single source of truth for valid upload destinations

### What It Owns

| Owned           | Description                                          |
| --------------- | ---------------------------------------------------- |
| Folder metadata | Exposes allowed folder list from ImageKitAuthService |

### External Dependencies

| Dependency | Type           | Purpose                          |
| ---------- | -------------- | -------------------------------- |
| Redis      | Infrastructure | Session storage for Sanctum auth |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/uploads/folders
```

### Authentication

✅ **Required** - Bearer token via Laravel Sanctum

### Rate Limiting

| Limiter | Key | Config                        |
| ------- | --- | ----------------------------- |
| None    | N/A | Uses default Laravel throttle |

### Request Headers

| Header          | Required | Type               | Description          |
| --------------- | -------- | ------------------ | -------------------- |
| `Accept`        | ✅       | `application/json` | Response format      |
| `Authorization` | ✅       | `Bearer {token}`   | Authentication token |

### Request Body Schema

```
None - This is a GET request with no body
```

---

### Response Schemas

#### ✅ Success Response (200)

```json
{
  "status": "success",
  "message": "Allowed folders retrieved",
  "data": {
    "folders": [
      "avatars",
      "rooms",
      "agencies/logos",
      "agencies/national-ids",
      "coin-request-proofs"
    ]
  },
  "meta": {
    "timestamp": "2026-02-02T03:43:00.000000Z",
    "correlation_id": "uuid"
  }
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

### HTTP Status Codes

| Code  | Condition                               |
| ----- | --------------------------------------- |
| `200` | Folders list retrieved successfully     |
| `401` | Missing or invalid authentication token |