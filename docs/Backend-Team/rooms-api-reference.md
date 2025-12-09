# Room API Reference

Base URL: `/api/v1`

## Authentication
All endpoints except `GET` requests require a valid Bearer Token in the `Authorization` header.
`Authorization: Bearer <token>`

## Data Structures

### Room Object
```json
{
  "id": 1,
  "name": "My Awesome Room",
  "logo": "https://ik.imagekit.io/your_id/rooms/...",
  "type": "public", // or "private"
  "country": "US",
  "created_at": "2023-10-27T10:00:00.000000Z",
  "user": {
    "id": 1,
    "name": "John Doe",
    "avatar": { ... }
  }
}
```

---

## Endpoints

### 1. List Rooms
Get a paginated list of rooms.

**Endpoint:** `GET /rooms`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `country` (optional): Filter by 2-letter country code (e.g., `US`, `IN`).

**Response:**
```json
{
  "status": "success",
  "message": "Rooms retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "General Chat",
      "logo": "...",
      "type": "public",
      "country": "US",
      "created_at": "...",
      "user": { ... }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 75
  }
}
```

### 2. Get Room Details
Get details of a specific room.

**Endpoint:** `GET /rooms/{id}`

**Response:**
```json
{
  "status": "success",
  "message": "Room details retrieved successfully",
  "data": {
    "id": 1,
    "name": "General Chat",
    "logo": "...",
    "type": "public",
    "country": "US",
    "created_at": "...",
    "user": { ... }
  }
}
```

### 3. Create Room
Create a new room. A user can only have one room.

**Endpoint:** `POST /rooms`
**Content-Type:** `multipart/form-data`

**Body Parameters:**
- `name` (required, string, max: 40): Unique name of the room.
- `country` (required, string, size: 2): Country code (e.g., `US`).
- `type` (required, string): `public` or `private`.
- `password` (required if type is private, string): Plain text password for the room.
- `logo` (optional, file): Image file (jpg, png, webp, max 5MB).

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "Room created successfully",
  "data": {
    "id": 1,
    "name": "My Room",
    ...
  }
}
```

**Error (400 Bad Request):**
```json
{
  "status": "error",
  "message": "You already have a room",
  "data": []
}
```

### 4. Update Room
Update an existing room. Only the owner can update their room.

**Endpoint:** `POST /rooms/{id}?_method=PUT`
*(Note: Use POST with `_method=PUT` for file uploads in Laravel, or `PUT` if not uploading a file)*

**Body Parameters:**
- `name` (optional, string, max: 40)
- `country` (optional, string, size: 2)
- `type` (optional, string): `public` or `private`
- `password` (optional, string): Required if changing type to private.
- `logo` (optional, file)

**Response:**
```json
{
  "status": "success",
  "message": "Room updated successfully",
  "data": { ... }
}
```

### 5. Delete Room
Delete a room. Only the owner can delete their room.

**Endpoint:** `DELETE /rooms/{id}`

**Response:**
```json
    "data": null
}
```

### 6. Join Room
Verify password for a private room. Public rooms can also be joined (returns success immediately).

**Endpoint:** `POST /rooms/{id}/join`

**Body Parameters:**
- `password` (required, string): Plain text password for the room.

**Response (Success):**
```json
{
    "status": "success",
    "message": "Joined room successfully",
    "data": {
        "access": true
    }
}
```

**Response (Failure):**
```json
{
    "status": "error",
    "message": "Invalid password",
    "errors": {
        "password": [
            "Incorrect password"
        ]
    }
}
```
