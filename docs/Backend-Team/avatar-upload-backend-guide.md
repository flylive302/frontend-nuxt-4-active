# Frontend Guide: File & Avatar Uploads

This document provides a comprehensive guide for the frontend team to implement file and avatar upload features using the FlyLive API.

> [!NOTE]
> Currently, the API exposes specific endpoints for **Avatar Uploads**. Generic file upload endpoints are not yet public. This guide focuses on the Avatar Upload feature.

## Authentication

All upload endpoints require authentication. You must include the Bearer token in the `Authorization` header.

```http
Authorization: Bearer <your_access_token>
Accept: application/json
```

---

## Avatar Management

### 1. Upload Avatar

Uploads and updates the user's profile avatar. The image is automatically optimized and stored via ImageKit.

- **Endpoint**: `POST /api/v1/profile/avatar`
- **Content-Type**: `multipart/form-data`
- **Rate Limit**: `auth.rate_limit:avatar_upload` (Specific limit not hardcoded, but generally stricter than standard API)

#### Request Parameters

| Parameter | Type | Required | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `avatar` | File | Yes | The image file to upload. | Max **5MB**. Types: `jpg`, `jpeg`, `png`, `webp`. |

#### Example Request (JavaScript/FormData)

```javascript
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);

const response = await fetch('https://api.flylive.com/api/v1/profile/avatar', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        // Note: Do NOT set Content-Type header manually when using FormData, 
        // the browser sets it with the correct boundary.
    },
    body: formData
});
```

#### Success Response (200 OK)

```json
{
    "status": "success",
    "message": "Avatar uploaded successfully",
    "data": {
        "avatar_url": "https://ik.imagekit.io/flylive/avatars/profile_123_1733270000.jpg",
        "thumbnail_url": "https://ik.imagekit.io/flylive/avatars/profile_123_1733270000.jpg?tr=w-100,h-100,c-face",
        "file_id": "64f8a..."
    },
    "meta": {
        "timestamp": "2025-12-04T05:30:00.000Z",
        "correlation_id": "uuid-..."
    }
}
```

#### Error Responses

**422 Validation Error** (File too large, wrong type, or missing)
```json
{
    "status": "error",
    "message": "Validation failed",
    "data": null,
    "errors": {
        "avatar": [
            "The avatar file size must not exceed 5MB.",
            // or "The avatar must be a file of type: jpg, jpeg, png, webp."
        ]
    },
    "meta": { ... }
}
```

**401 Unauthorized**
```json
{
    "status": "error",
    "message": "Unauthenticated.",
    ...
}
```

---

### 2. Get Avatar URLs

Retrieve optimized URLs for the user's current avatar in various sizes.

- **Endpoint**: `GET /api/v1/profile/avatar/urls`
- **Method**: `GET`

#### Success Response (200 OK)

```json
{
    "status": "success",
    "message": "Avatar URLs retrieved successfully",
    "data": {
        "original": "https://ik.imagekit.io/flylive/avatars/profile_123.jpg",
        "transformations": {
            "thumbnail": "https://ik.imagekit.io/flylive/avatars/profile_123.jpg?tr=w-100,h-100,c-face",
            "small": "https://ik.imagekit.io/flylive/avatars/profile_123.jpg?tr=w-200,h-200,c-face",
            "medium": "https://ik.imagekit.io/flylive/avatars/profile_123.jpg?tr=w-400,h-400,c-face",
            "large": "https://ik.imagekit.io/flylive/avatars/profile_123.jpg?tr=w-800,h-800,c-face"
        }
    },
    "meta": { ... }
}
```

---

### 3. Delete Avatar

Removes the user's current avatar.

- **Endpoint**: `DELETE /api/v1/profile/avatar`
- **Method**: `DELETE`

#### Success Response (200 OK)

```json
{
    "status": "success",
    "message": "Avatar deleted successfully",
    "data": [],
    "meta": { ... }
}
```

---

## Best Practices

1.  **Client-Side Validation**: Always validate file size (< 5MB) and type (Images only) on the client side before uploading to save bandwidth and improve UX.
2.  **Optimistic UI**: When a user selects a file, display a local preview immediately using `URL.createObjectURL(file)` while the upload processes in the background.
3.  **Error Handling**: Gracefully handle 422 errors by displaying specific validation messages returned by the API (e.g., "File too large").
4.  **ImageKit Transformations**: The `thumbnail_url` returned in the upload response is optimized for small displays (100x100, face crop). Use it for navbar avatars or lists. Use the `GET /api/v1/profile/avatar/urls` endpoint if you need other sizes.
