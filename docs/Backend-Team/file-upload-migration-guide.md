# File Upload API Migration Guide

## Overview

We've migrated from server-side file uploads to **client-side direct uploads** to ImageKit CDN. This eliminates CORS issues, request timeouts, and provides upload progress feedback.

---

## Migration Summary

| Before                          | After                               |
| ------------------------------- | ----------------------------------- |
| `multipart/form-data` with file | JSON with pre-uploaded URLs         |
| Files sent through our API      | Files uploaded directly to ImageKit |
| No progress feedback            | Full progress tracking              |
| CORS/timeout issues             | No CORS, no timeouts                |

---

## New Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEW 3-STEP UPLOAD FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Step 1: Get Auth Token                                                    │
│   ───────────────────────                                                   │
│   POST /api/v1/uploads/auth-params                                          │
│   → Returns: token, signature, expire, publicKey                            │
│                                                                             │
│   Step 2: Upload to ImageKit                                                │
│   ──────────────────────────                                                │
│   POST https://upload.imagekit.io/api/v1/files/upload                       │
│   → Returns: fileId, url                                                    │
│                                                                             │
│   Step 3: Submit to API                                                     │
│   ─────────────────────                                                     │
│   POST /api/v1/agencies (or other endpoints)                                │
│   → Send URLs and file IDs instead of actual files                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Get Upload Authentication

### Request

```http
POST /api/v1/uploads/auth-params
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "folder": "avatars",
  "expire_seconds": 600
}
```

### Parameters

| Field            | Type    | Required | Description                            |
| ---------------- | ------- | -------- | -------------------------------------- |
| `folder`         | string  | ✅ Yes   | Upload destination folder              |
| `expire_seconds` | integer | No       | Token validity (60-3600, default: 600) |

### Allowed Folders

| Folder                  | Use Case              |
| ----------------------- | --------------------- |
| `avatars`               | User profile pictures |
| `rooms`                 | Room logos            |
| `agencies/logos`        | Agency logos          |
| `agencies/national-ids` | National ID images    |
| `coin-request-proofs`   | Payment proof images  |

### Response

```json
{
  "success": true,
  "message": "Upload authentication parameters generated",
  "data": {
    "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "signature": "abc123def456...",
    "expire": 1735354200,
    "publicKey": "public_ABC123XYZ",
    "folder": "avatars",
    "urlEndpoint": "https://ik.imagekit.io/flylive"
  }
}
```

### Rate Limiting

- **10 requests per minute** per user
- Use one auth token per upload batch when possible

---

## Step 2: Upload to ImageKit

### Request

```http
POST https://upload.imagekit.io/api/v1/files/upload
Content-Type: multipart/form-data
```

### Form Fields

| Field       | Type   | Required | Value                          |
| ----------- | ------ | -------- | ------------------------------ |
| `file`      | File   | ✅ Yes   | The actual file to upload      |
| `fileName`  | string | ✅ Yes   | Desired filename               |
| `folder`    | string | ✅ Yes   | From auth response             |
| `publicKey` | string | ✅ Yes   | From auth response             |
| `signature` | string | ✅ Yes   | From auth response             |
| `expire`    | string | ✅ Yes   | From auth response (as string) |
| `token`     | string | ✅ Yes   | From auth response             |

### Response

```json
{
  "fileId": "6478abc123def456",
  "name": "photo_1735354200.jpg",
  "url": "https://ik.imagekit.io/flylive/avatars/photo_1735354200.jpg",
  "thumbnailUrl": "https://ik.imagekit.io/flylive/tr:n-ik_ml_thumbnail/avatars/photo_1735354200.jpg",
  "height": 800,
  "width": 800,
  "size": 125430,
  "filePath": "/avatars/photo_1735354200.jpg",
  "fileType": "image"
}
```

### TypeScript Example

```typescript
async function uploadToImageKit(
  file: File,
  authParams: {
    token: string;
    signature: string;
    expire: number;
    publicKey: string;
    folder: string;
  }
): Promise<{ fileId: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("folder", authParams.folder);
  formData.append("publicKey", authParams.publicKey);
  formData.append("signature", authParams.signature);
  formData.append("expire", authParams.expire.toString());
  formData.append("token", authParams.token);

  const response = await fetch(
    "https://upload.imagekit.io/api/v1/files/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  const result = await response.json();
  return {
    fileId: result.fileId,
    url: result.url,
  };
}
```

### Upload Progress (with XMLHttpRequest)

```typescript
function uploadWithProgress(
  file: File,
  authParams: AuthParams,
  onProgress: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", file.name);
    formData.append("folder", authParams.folder);
    formData.append("publicKey", authParams.publicKey);
    formData.append("signature", authParams.signature);
    formData.append("expire", authParams.expire.toString());
    formData.append("token", authParams.token);

    xhr.open("POST", "https://upload.imagekit.io/api/v1/files/upload");
    xhr.send(formData);
  });
}
```

---

## Step 3: Submit to API

After uploading to ImageKit, submit the URLs to our API.

---

## Updated API Endpoints

### 1. User Avatar

**Endpoint Changed:** `POST` → `PUT`

```http
PUT /api/v1/profile/avatar
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "url": "https://ik.imagekit.io/flylive/avatars/photo.jpg",
  "file_id": "6478abc123def456"
}
```

| Field     | Type   | Required | Description                                 |
| --------- | ------ | -------- | ------------------------------------------- |
| `url`     | string | ✅ Yes   | ImageKit URL (must start with our endpoint) |
| `file_id` | string | ✅ Yes   | ImageKit file ID for cleanup                |

---

### 2. Create Room

```http
POST /api/v1/rooms
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Cool Room",
  "type": "public",
  "country": "US",
  "logo_url": "https://ik.imagekit.io/flylive/rooms/logo.jpg",
  "logo_file_id": "6478abc123def456"
}
```

| Field          | Type   | Required               | Description           |
| -------------- | ------ | ---------------------- | --------------------- |
| `name`         | string | ✅ Yes                 | Room name             |
| `type`         | string | ✅ Yes                 | `public` or `private` |
| `country`      | string | ✅ Yes                 | 2-letter ISO code     |
| `password`     | string | Required if private    | Room password         |
| `logo_url`     | string | No                     | ImageKit URL          |
| `logo_file_id` | string | Required with logo_url | ImageKit file ID      |

---

### 3. Update Room

```http
PUT /api/v1/rooms/{id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Updated Room Name",
  "logo_url": "https://ik.imagekit.io/flylive/rooms/new-logo.jpg",
  "logo_file_id": "6478abc123def789"
}
```

---

### 4. Create Agency

```http
POST /api/v1/agencies
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "My Agency",
  "country": "US",
  "address": "123 Main Street, City, Country",
  "logo_url": "https://ik.imagekit.io/flylive/agencies/logos/logo.jpg",
  "logo_file_id": "6478abc123def456",
  "national_id_images": [
    {
      "url": "https://ik.imagekit.io/flylive/agencies/national-ids/front.jpg",
      "file_id": "6478abc123front",
      "side": "front"
    },
    {
      "url": "https://ik.imagekit.io/flylive/agencies/national-ids/back.jpg",
      "file_id": "6478abc123back",
      "side": "back"
    }
  ],
  "coin_reseller_id": 123
}
```

| Field                          | Type    | Required               | Description                       |
| ------------------------------ | ------- | ---------------------- | --------------------------------- |
| `name`                         | string  | ✅ Yes                 | Agency name (max 255)             |
| `country`                      | string  | ✅ Yes                 | 2-letter ISO code                 |
| `address`                      | string  | ✅ Yes                 | Full address (max 1000)           |
| `logo_url`                     | string  | No                     | Agency logo URL                   |
| `logo_file_id`                 | string  | Required with logo_url | Logo file ID                      |
| `national_id_images`           | array   | No                     | Array of ID images (min 1, max 2) |
| `national_id_images.*.url`     | string  | ✅ Yes                 | Image URL                         |
| `national_id_images.*.file_id` | string  | ✅ Yes                 | Image file ID                     |
| `national_id_images.*.side`    | string  | ✅ Yes                 | `front` or `back`                 |
| `coin_reseller_id`             | integer | No                     | Reseller user ID                  |

---

### 5. Create Coin Request

```http
POST /api/v1/coin-requests
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "amount": 1000,
  "message": "Payment via bank transfer",
  "reseller_id": 123,
  "proofs": [
    {
      "url": "https://ik.imagekit.io/flylive/coin-request-proofs/receipt1.jpg",
      "file_id": "6478abc123proof1"
    },
    {
      "url": "https://ik.imagekit.io/flylive/coin-request-proofs/receipt2.jpg",
      "file_id": "6478abc123proof2"
    }
  ]
}
```

| Field              | Type    | Required | Description                  |
| ------------------ | ------- | -------- | ---------------------------- |
| `amount`           | number  | ✅ Yes   | Coin amount (min 1)          |
| `message`          | string  | No       | Optional message (max 1000)  |
| `reseller_id`      | integer | No       | Uses default if not provided |
| `proofs`           | array   | No       | Payment proof images (max 3) |
| `proofs.*.url`     | string  | ✅ Yes   | Proof image URL              |
| `proofs.*.file_id` | string  | ✅ Yes   | Proof file ID                |

---

## Complete Upload Flow Example

```typescript
// uploadService.ts

interface AuthParams {
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
  folder: string;
  urlEndpoint: string;
}

interface UploadResult {
  fileId: string;
  url: string;
}

export async function getUploadAuth(
  folder: string,
  accessToken: string
): Promise<AuthParams> {
  const response = await fetch("/api/v1/uploads/auth-params", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folder }),
  });

  if (!response.ok) {
    throw new Error("Failed to get upload authentication");
  }

  const { data } = await response.json();
  return data;
}

export async function uploadFile(
  file: File,
  authParams: AuthParams,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  formData.append("folder", authParams.folder);
  formData.append("publicKey", authParams.publicKey);
  formData.append("signature", authParams.signature);
  formData.append("expire", authParams.expire.toString());
  formData.append("token", authParams.token);

  // Use XMLHttpRequest for progress tracking
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText);
          resolve({ fileId: result.fileId, url: result.url });
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));

      xhr.open("POST", "https://upload.imagekit.io/api/v1/files/upload");
      xhr.send(formData);
    });
  }

  // Use fetch for simple uploads
  const response = await fetch(
    "https://upload.imagekit.io/api/v1/files/upload",
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  const result = await response.json();
  return { fileId: result.fileId, url: result.url };
}

// Usage Example: Create Agency with Images
export async function createAgencyWithImages(
  agencyData: { name: string; country: string; address: string },
  logo: File | null,
  nationalIdFront: File | null,
  nationalIdBack: File | null,
  accessToken: string,
  onProgress?: (file: string, percent: number) => void
) {
  const payload: any = { ...agencyData };

  // Upload logo if provided
  if (logo) {
    const auth = await getUploadAuth("agencies/logos", accessToken);
    const result = await uploadFile(logo, auth, (p) => onProgress?.("logo", p));
    payload.logo_url = result.url;
    payload.logo_file_id = result.fileId;
  }

  // Upload national ID images
  const nationalIdImages: any[] = [];

  if (nationalIdFront) {
    const auth = await getUploadAuth("agencies/national-ids", accessToken);
    const result = await uploadFile(nationalIdFront, auth, (p) =>
      onProgress?.("id_front", p)
    );
    nationalIdImages.push({
      url: result.url,
      file_id: result.fileId,
      side: "front",
    });
  }

  if (nationalIdBack) {
    const auth = await getUploadAuth("agencies/national-ids", accessToken);
    const result = await uploadFile(nationalIdBack, auth, (p) =>
      onProgress?.("id_back", p)
    );
    nationalIdImages.push({
      url: result.url,
      file_id: result.fileId,
      side: "back",
    });
  }

  if (nationalIdImages.length > 0) {
    payload.national_id_images = nationalIdImages;
  }

  // Submit to API
  const response = await fetch("/api/v1/agencies", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create agency");
  }

  return response.json();
}
```

---

## Error Handling

### Auth Params Errors

| Status | Error          | Action                     |
| ------ | -------------- | -------------------------- |
| 401    | Unauthorized   | Refresh access token       |
| 422    | Invalid folder | Check allowed folders list |
| 429    | Rate limited   | Wait and retry             |

### ImageKit Upload Errors

| Status | Error              | Action                    |
| ------ | ------------------ | ------------------------- |
| 400    | Invalid parameters | Check all required fields |
| 401    | Invalid signature  | Get fresh auth params     |
| 413    | File too large     | Check file size (5MB max) |

### API Submission Errors

| Status | Error                | Action                              |
| ------ | -------------------- | ----------------------------------- |
| 422    | Validation error     | Check URL format, file_id presence  |
| 400    | URL not from our CDN | Ensure URL starts with our endpoint |

---

## Validation Rules

### URL Validation

All URLs must start with: `https://ik.imagekit.io/flylive/`

### File Size

- Maximum: **5MB per file**
- Validated on ImageKit side

### Allowed Types

- `jpg`, `jpeg`, `png`, `webp`
- Validated on ImageKit side

---

## Migration Checklist

- [ ] Update avatar upload to use PUT with URL/file_id
- [ ] Update room creation/update forms for logo_url
- [ ] Update agency creation form for all image fields
- [ ] Update coin request form for proof images
- [ ] Add upload progress indicators
- [ ] Add retry logic for failed uploads
- [ ] Update TypeScript types for new request shapes
- [ ] Test all upload flows end-to-end

---

## Questions?

Contact the backend team for any clarification on the API changes.
