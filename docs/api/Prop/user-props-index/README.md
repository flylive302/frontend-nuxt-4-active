# GET /api/v1/user/props

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The User Props Index endpoint returns a paginated list of props owned by the authenticated user. Supports filtering by type and status (active/expired/all) with cursor-based pagination for efficient scrolling through large inventories.

### Responsibilities

- List user's owned props (UserProp records)
- Filter by prop type and status
- Provide cursor-based pagination
- Transform to API resource format

### What It Owns

| Owned                | Description                             |
| -------------------- | --------------------------------------- |
| Props inventory view | User's complete prop ownership list     |
| Filtering logic      | Type and status filtering               |
| Pagination           | Cursor-based with configurable per_page |

### Business Rules

| Rule                         | Description                              |
| ---------------------------- | ---------------------------------------- |
| Default status = active      | Only shows active props unless specified |
| Max per_page = 100           | Capped at 100 items per request          |
| Ordered by purchased_at DESC | Newest props first                       |
| Denormalized type filter     | Uses `prop_type` column for performance  |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/props
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Query Parameters

| Parameter  | Type     | Default  | Constraints                                        | Example   |
| ---------- | -------- | -------- | -------------------------------------------------- | --------- |
| `type`     | `string` | —        | Optional, one of PropType enum values              | `frame`   |
| `status`   | `string` | `active` | Optional, one of: `active`, `expired`, `all`       | `expired` |
| `per_page` | `int`    | `50`     | Optional, 1-100                                    | `20`      |
| `cursor`   | `string` | —        | Optional, pagination cursor from previous response | `eyJp...` |

### PropType Values

- `frame`
- `signature`
- `room_theme`
- `chat_bubble`
- `entry_animation`

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "props": [
      {
        "id": 12345, // UserProp ID
        "prop_id": 100, // Prop catalog ID
        "type": "frame", // PropType
        "name": "Golden Frame", // Prop name
        "thumbnail_url": "https://cdn.../thumb.png",
        "asset_url": "https://cdn.../asset.png",
        "purchased_at": "2026-02-01T12:00:00.000000Z",
        "expires_at": "2026-03-01T12:00:00.000000Z",
        "is_equipped": true, // Boolean
        "source_type": "purchase", // purchase | gift | reward
        "days_remaining": 24, // Computed, integer
        "is_valid": true // Computed, not expired
      }
    ],
    "pagination": {
      "next_cursor": "eyJwdXJjaGFzZWRfYXQi...", // null if no more
      "prev_cursor": null, // null if first page
      "has_more": true, // Boolean
      "per_page": 50 // Requested per_page
    }
  },
  "meta": {
    "timestamp": "2026-02-05T04:11:48.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### ❌ Validation Error (422)

```json
{
  "status": "error",
  "message": "The type field must be one of: frame, signature, room_theme, chat_bubble, entry_animation.",
  "data": null,
  "errors": {
    "type": ["The type field must be one of: ..."]
  },
  "meta": {...}
}
```

### HTTP Status Codes

| Code  | Condition                                 |
| ----- | ----------------------------------------- |
| `200` | Successfully retrieved props              |
| `401` | Missing or invalid authentication token   |
| `422` | Validation error (invalid type or status) |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/props?status=active                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:48-49                                            │
│ Route: Route::get('/', [...])                                               │
│        ->name('user.props.index')                                           │
│                                                                             │
│ Middleware Chain:                                                           │
│   1. auth:sanctum        → Validates Bearer token                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 REQUEST VALIDATION                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Requests/Prop/ListUserPropsRequest.php:23-29                 │
│                                                                             │
│ Rules:                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 'type'     => ['nullable', 'string', 'in:frame,signature,...'],         │ │
│ │ 'status'   => ['nullable', 'string', 'in:active,expired,all'],          │ │
│ │ 'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Authorization: Returns true (auth handled by middleware)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 CONTROLLER LOGIC                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/UserPropController.php:26-61         │
│ Method: index(ListUserPropsRequest $request): JsonResponse                  │
│                                                                             │
│ STEP 1: Extract parameters                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $user = $request->user();                                               │ │
│ │ $status = $request->input('status', 'active');   // Default: active     │ │
│ │ $perPage = min($request->integer('per_page', 50), 100);  // Cap at 100  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Build query                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $query = UserProp::query()                                              │ │
│ │     ->where('user_id', $user->id)                                       │ │
│ │     ->orderBy('purchased_at', 'desc')                                   │ │
│ │     ->orderBy('id', 'desc');   // Stable sort for cursor pagination     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Apply type filter (uses denormalized prop_type column)              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($type = $request->input('type')) {                                  │ │
│ │     $query->where('prop_type', $type);   // P-3 performance fix         │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4: Apply status filter                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($status === 'active') {                                             │ │
│ │     $query->where('status', PropStatus::ACTIVE);                        │ │
│ │ } elseif ($status === 'expired') {                                      │ │
│ │     $query->where('status', PropStatus::EXPIRED);                       │ │
│ │ }                                                                       │ │
│ │ // status = 'all' → no filter                                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Paginate                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $props = $query->cursorPaginate($perPage);                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6: Transform and respond                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success([                                           │ │
│ │     'props' => UserPropResource::collection($props),                    │ │
│ │     'pagination' => [                                                   │ │
│ │         'next_cursor' => $props->nextCursor()?->encode(),               │ │
│ │         'prev_cursor' => $props->previousCursor()?->encode(),           │ │
│ │         'has_more' => $props->hasMorePages(),                           │ │
│ │         'per_page' => $perPage,                                         │ │
│ │     ],                                                                  │ │
│ │ ]);                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 RESOURCE TRANSFORMATION                                                 │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Resources/V1/Prop/UserPropResource.php:18-33                 │
│                                                                             │
│ Transforms UserProp model to API response:                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return [                                                                │ │
│ │     'id'            => $this->id,                                       │ │
│ │     'prop_id'       => $this->prop_id,                                  │ │
│ │     'type'          => $this->prop->type->value,      // From relation  │ │
│ │     'name'          => $this->prop->name,             // From relation  │ │
│ │     'thumbnail_url' => $this->prop->thumbnail_url,    // From relation  │ │
│ │     'asset_url'     => $this->prop->asset_url,        // From relation  │ │
│ │     'purchased_at'  => $this->purchased_at->toIso8601String(),          │ │
│ │     'expires_at'    => $this->expires_at->toIso8601String(),            │ │
│ │     'is_equipped'   => $this->is_equipped,                              │ │
│ │     'source_type'   => $this->source_type->value,     // Enum           │ │
│ │     'days_remaining'=> $this->days_remaining,         // Computed       │ │
│ │     'is_valid'      => $this->is_valid,               // Computed       │ │
│ │ ];                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ COMPUTED ATTRIBUTES (in UserProp model):                                    │
│   • days_remaining: max(0, now()->diffInDays($this->expires_at, false))     │
│   • is_valid: $this->status === PropStatus::ACTIVE                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ QUERY (with all filters applied):                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM user_props                                                │ │
│ │ WHERE user_id = 100                                                     │ │
│ │   AND prop_type = 'frame'          -- Type filter (if provided)         │ │
│ │   AND status = 'active'            -- Status filter (default)           │ │
│ │ ORDER BY purchased_at DESC, id DESC                                     │ │
│ │ LIMIT 51                           -- per_page + 1 for cursor check     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ INDEXES UTILIZED:                                                           │
│   • idx_user_props_user_id_status_purchased_at                              │
│   • idx_user_props_prop_type (for type filter)                              │
│                                                                             │
│ EAGER LOADING: UserProp loads 'prop' relation for resource transformation   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE SENT                                  │
│                    200 OK + JSON Body                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Reusability Matrix

| File                       | Used By Endpoints               | Reusable | Reasoning                    |
| -------------------------- | ------------------------------- | -------- | ---------------------------- |
| `UserPropController.php`   | index, equipped, equip, unequip | ⭕       | Controller-specific          |
| `ListUserPropsRequest.php` | user/props index only           | ❌       | Endpoint-specific validation |
| `UserPropResource.php`     | All UserProp responses          | ✅       | Shared transformation        |
| `PropStatus.php` (Enum)    | All prop-related endpoints      | ✅       | Domain enum                  |
| `PropType.php` (Enum)      | All prop-related endpoints      | ✅       | Domain enum                  |
| `ApiResponse.php`          | All API endpoints               | ✅       | Global response utility      |

---

## 5. Error Handling & Edge Cases

### Validation Errors (422)

| Field      | Message                                   | Condition            |
| ---------- | ----------------------------------------- | -------------------- |
| `type`     | The type field must be one of: ...        | Invalid prop type    |
| `status`   | The status field must be one of: ...      | Invalid status value |
| `per_page` | The per_page must be at least 1 / max 100 | Out of range         |

### Edge Cases

| Case                              | Behavior                                    |
| --------------------------------- | ------------------------------------------- |
| No props owned                    | Empty `props` array, `has_more = false`     |
| All props expired                 | Empty with `status=active` (default)        |
| Request expired with `status=all` | Returns both active and expired             |
| `per_page` > 100                  | Silently capped to 100                      |
| Invalid cursor                    | Laravel throws 500, cursor validation fails |
| User has 1000+ props              | Cursor pagination handles efficiently       |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT          MIDDLEWARE           CONTROLLER           QUERY            RESOURCE
   │                 │                    │                    │                 │
   │ GET /user/props?type=frame           │                    │                 │
   │─────────────────▶                    │                    │                 │
   │                 │                    │                    │                 │
   │                 │ 1. auth:sanctum    │                    │                 │
   │                 │───────────────────▶│                    │                 │
   │                 │                    │                    │                 │
   │                 │                    │ 2. Validate        │                 │
   │                 │                    │    params          │                 │
   │                 │                    │                    │                 │
   │                 │                    │ 3. Build query     │                 │
   │                 │                    │    with filters    │                 │
   │                 │                    │───────────────────▶│                 │
   │                 │                    │                    │                 │
   │                 │                    │◀───────────────────│                 │
   │                 │                    │   CursorPaginator  │                 │
   │                 │                    │                    │                 │
   │                 │                    │ 4. Transform       │                 │
   │                 │                    │    to resource     │                 │
   │                 │                    │───────────────────┼────────────────▶│
   │                 │                    │◀──────────────────┼─────────────────│
   │                 │                    │                    │                 │
   │                 │                    │ 5. ApiResponse     │                 │
   │                 │◀───────────────────│   ::success()      │                 │
   │◀────────────────│                    │                    │                 │
   │                 │                    │                    │                 │
   │  200 OK         │                    │                    │                 │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                       | Location                                  |
| ------------------------------ | ----------------------------------------- |
| New filter (e.g., is_equipped) | `ListUserPropsRequest` rules + controller |
| New response field             | `UserPropResource::toArray()`             |
| Include prop details           | Add eager loading in controller query     |
| Sorting options                | Add sort param + apply in controller      |

### 📝 Performance Considerations

| Aspect           | Implementation                              |
| ---------------- | ------------------------------------------- |
| Type filtering   | Uses denormalized `prop_type` column (P-3)  |
| Pagination       | Cursor-based (not offset) for efficiency    |
| Relation loading | Prop relation loaded for resource transform |
| Index coverage   | user_id + status + purchased_at indexed     |

### ⚠️ What Should NOT Be Modified Casually

| Component                      | Reason                                 |
| ------------------------------ | -------------------------------------- |
| Default status = active        | Frontend relies on this behavior       |
| Cursor pagination              | Offset would break with large datasets |
| Sort order (purchased_at DESC) | Stable sort required for cursor        |
| Denormalized type filter       | Reverting would cause N+1 queries      |

### 🚨 Common Pitfalls

| Pitfall                         | Prevention                                |
| ------------------------------- | ----------------------------------------- |
| Adding whereHas for type filter | Use denormalized prop_type column instead |
| Using offset pagination         | Cursor is more efficient for scrolling    |
| Forgetting prop relation        | Resource needs it for name, type, urls    |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 48-49)
app/Http/Controllers/Api/V1/Prop/
  └── UserPropController.php                         ← Controller (index method, lines 26-61)
app/Http/Requests/Prop/
  └── ListUserPropsRequest.php                       ← Validation (lines 23-29)
app/Http/Resources/V1/Prop/
  └── UserPropResource.php                           ← Resource transformation (lines 18-33)
app/Enums/Prop/
  ├── PropStatus.php                                 ← Status enum
  └── PropType.php                                   ← Type enum
```

---

## 8. MSAB Realtime Event Contracts

No MSAB events are dispatched by this endpoint. This is a read-only query endpoint.

---

## 9. Document Metadata

| Property            | Value                    |
| ------------------- | ------------------------ |
| **Endpoint**        | `GET /api/v1/user/props` |
| **Domain**          | Prop                     |
| **Author**          | System Documentation     |
| **Created**         | 2026-02-05               |
| **Laravel Version** | 12.x                     |
| **PHP Version**     | 8.4                      |
