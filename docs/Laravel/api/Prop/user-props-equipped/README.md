# GET /api/v1/user/props/equipped

> **Domain**: Prop  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-05

---

## 1. Domain Overview

### Purpose

The User Props Equipped endpoint returns the currently equipped props for the authenticated user, one per prop type. This provides a quick lookup for displaying active visual customizations (frames, signatures, chat bubbles, etc.).

### Responsibilities

- Retrieve equipped props per type
- Return structured map with type as key
- Cache results for performance (15 min TTL)

### What It Owns

| Owned                 | Description                                       |
| --------------------- | ------------------------------------------------- |
| Equipped props view   | User's currently equipped props by type           |
| Caching               | 15-minute cache with event-based invalidation     |

### Business Rules

| Rule                                | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| One per type                        | Only one equipped prop per type                    |
| All types returned                  | Response contains all PropType keys (null if none) |
| Cached                              | Results cached 15 minutes per user                 |

---

## 2. API Contract (OpenAPI-Style)

### Endpoint

```
GET /api/v1/user/props/equipped
```

### Authentication

✅ **Required** - Sanctum Bearer token (`Authorization: Bearer {token}`)

### Request Parameters

None.

---

### Response Schemas

#### ✅ Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Success",
  "data": {
    "equipped": {
      "frame": {
        "id": 12345,          // UserProp ID
        "prop_id": 100,       // Prop catalog ID
        "name": "Golden Frame",
        "asset_url": "https://cdn.../frame.png"
      },
      "signature": null,       // Not equipped
      "room_theme": null,
      "chat_bubble": {
        "id": 12346,
        "prop_id": 101,
        "name": "Sparkle Bubble",
        "asset_url": "https://cdn.../bubble.png"
      },
      "entry_animation": null
    }
  },
  "meta": {
    "timestamp": "2026-02-05T04:20:08.000000Z",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### HTTP Status Codes

| Code  | Condition                                    |
| ----- | -------------------------------------------- |
| `200` | Successfully retrieved equipped props        |
| `401` | Missing or invalid authentication token      |

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    GET /api/v1/user/props/equipped                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:51-52                                            │
│ Route: Route::get('/equipped', [...])                                       │
│        ->name('user.props.equipped')                                        │
│                                                                             │
│ Middleware: auth:sanctum                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER LOGIC                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/UserPropController.php:66-82         │
│ Method: equipped(Request $request): JsonResponse                            │
│                                                                             │
│ STEP 1: Delegate to service                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $equipped = $this->equipService->getEquippedProps($request->user()->id);│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Transform to response format                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = [];                                                           │ │
│ │ foreach ($equipped as $type => $userProp) {                             │ │
│ │     $result[$type] = $userProp ? [                                      │ │
│ │         'id'        => $userProp->id,                                   │ │
│ │         'prop_id'   => $userProp->prop_id,                              │ │
│ │         'name'      => $userProp->prop->name,                           │ │
│ │         'asset_url' => $userProp->prop->asset_url,                      │ │
│ │     ] : null;                                                           │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Return response                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ApiResponse::success(['equipped' => $result]);                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER (CACHED)                                                  │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Prop/PropEquipService.php:184-206                        │
│ Method: getEquippedProps(int $userId): array                                │
│                                                                             │
│ STEP 1: Check cache                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return Cache::remember(                                                 │ │
│ │     "user:{$userId}:equipped_props",                                    │ │
│ │     self::EQUIPPED_CACHE_TTL,    // 900 seconds = 15 minutes            │ │
│ │     function () use ($userId) {                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2 (cache miss): Query database                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $equipped = UserProp::with(['user'])                                    │ │
│ │     ->where('user_id', $userId)                                         │ │
│ │     ->where('status', PropStatus::ACTIVE)                               │ │
│ │     ->where('is_equipped', true)                                        │ │
│ │     ->get()                                                             │ │
│ │     ->keyBy(fn ($up) => $up->prop->type->value);                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3: Build result with all PropType keys                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = [];                                                           │ │
│ │ foreach (PropType::cases() as $type) {                                  │ │
│ │     $result[$type->value] = $equipped->get($type->value);  // or null   │ │
│ │ }                                                                       │ │
│ │ return $result;                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 CACHING STRATEGY                                                        │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ CACHE KEY: user:{userId}:equipped_props                                     │
│ TTL: 900 seconds (15 minutes)                                               │
│                                                                             │
│ INVALIDATION TRIGGERS:                                                      │
│   • PropEquipped event dispatched (equip action)                            │
│   • PropExpired event dispatched (expiration job)                           │
│   • TTL expiry (automatic after 15 minutes)                                 │
│                                                                             │
│ NOTE: No explicit invalidation on unequip (relies on TTL or next equip)     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS (Cache Miss Only)                                           │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ QUERY:                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SELECT * FROM user_props                                                │ │
│ │ WHERE user_id = 100                                                     │ │
│ │   AND status = 'active'                                                 │ │
│ │   AND is_equipped = true                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ RESULT: Maximum 5 rows (one per PropType)                                   │
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

| File                             | Used By Endpoints                          | Reusable | Reasoning                          |
| -------------------------------- | ------------------------------------------ | -------- | ---------------------------------- |
| `UserPropController.php`         | index, equipped, equip, unequip            | ⭕       | Controller-specific                |
| `PropEquipService.php`           | equip, unequip, equipped, ExpirePropsJob   | ✅       | Shared service logic               |
| `PropType.php` (Enum)            | All prop-related endpoints                 | ✅       | Domain enum                        |
| `PropStatus.php` (Enum)          | All prop-related endpoints                 | ✅       | Domain enum                        |
| `ApiResponse.php`                | All API endpoints                          | ✅       | Global response utility            |

---

## 5. Error Handling & Edge Cases

### Edge Cases

| Case                                    | Behavior                                          |
| --------------------------------------- | ------------------------------------------------- |
| No props equipped                       | All type keys present with `null` values          |
| Some types equipped                     | Equipped types have data, others `null`           |
| Equipped prop expired between cache     | Cached stale data until TTL or invalidation       |
| Concurrent equip during request         | Returns previous cached value                     |

### Cache Staleness

| Scenario                         | Maximum Staleness | Mitigation                         |
| -------------------------------- | ----------------- | ---------------------------------- |
| User equips prop                 | 0 seconds         | PropEquipped event invalidates     |
| User unequips prop               | 15 minutes        | TTL expiry (no event)              |
| Prop expires                     | 0 seconds         | PropExpired event invalidates      |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT          MIDDLEWARE           CONTROLLER           SERVICE             CACHE             DATABASE
   │                 │                    │                    │                  │                   │
   │ GET /user/props/equipped             │                    │                  │                   │
   │─────────────────▶                    │                    │                  │                   │
   │                 │                    │                    │                  │                   │
   │                 │ 1. auth:sanctum    │                    │                  │                   │
   │                 │───────────────────▶│                    │                  │                   │
   │                 │                    │                    │                  │                   │
   │                 │                    │ 2. getEquippedProps│                  │                   │
   │                 │                    │───────────────────▶│                  │                   │
   │                 │                    │                    │                  │                   │
   │                 │                    │                    │ 3. Cache::remember                   │
   │                 │                    │                    │─────────────────▶│                   │
   │                 │                    │                    │                  │                   │
   │                 │                    │                    │   [CACHE HIT]    │                   │
   │                 │                    │                    │◀─────────────────│                   │
   │                 │                    │                    │                  │                   │
   │                 │                    │                    │   [CACHE MISS]   │                   │
   │                 │                    │                    │─────────────────┼──────────────────▶│
   │                 │                    │                    │◀────────────────┼───────────────────│
   │                 │                    │                    │                  │                   │
   │                 │                    │◀───────────────────│                  │                   │
   │                 │                    │   Map of equipped  │                  │                   │
   │                 │                    │                    │                  │                   │
   │                 │                    │ 4. Transform       │                  │                   │
   │                 │                    │    to response     │                  │                   │
   │                 │                    │                    │                  │                   │
   │                 │◀───────────────────│ ApiResponse        │                  │                   │
   │◀────────────────│                    │                    │                  │                   │
   │                 │                    │                    │                  │                   │
   │  200 OK         │                    │                    │                  │                   │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                           | Location                                       |
| ---------------------------------- | ---------------------------------------------- |
| Additional prop data in response   | Controller transformation loop                 |
| Cache TTL adjustment               | `EQUIPPED_CACHE_TTL` constant in service       |
| Cache invalidation on unequip      | Add event dispatch to unequip method           |
| Include prop metadata              | Load prop relation in service query            |

### 📝 Performance Considerations

| Aspect                   | Implementation                              |
| ------------------------ | ------------------------------------------- |
| Caching                  | Redis cache with 15-minute TTL              |
| Event invalidation       | PropEquipped/PropExpired events clear cache |
| Query efficiency         | Max 5 rows (one per type)                   |

### ⚠️ What Should NOT Be Modified Casually

| Component                        | Reason                                               |
| -------------------------------- | ---------------------------------------------------- |
| Cache key format                 | Invalidation events depend on exact key              |
| PropType iteration               | Ensures all types present in response                |
| Null values for unequipped       | Frontend relies on predictable structure             |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 51-52)
app/Http/Controllers/Api/V1/Prop/
  └── UserPropController.php                         ← Controller (equipped, lines 66-82)
app/Services/Prop/
  └── PropEquipService.php                           ← Service (getEquippedProps, lines 184-206)
app/Events/Prop/
  └── PropEquipped.php                               ← Cache invalidation trigger
```

---

## 8. MSAB Realtime Event Contracts

No MSAB events are dispatched by this endpoint. This is a read-only cached query endpoint.

---

## 9. Document Metadata

| Property            | Value                                |
| ------------------- | ------------------------------------ |
| **Endpoint**        | `GET /api/v1/user/props/equipped`    |
| **Domain**          | Prop                                 |
| **Author**          | System Documentation                 |
| **Created**         | 2026-02-05                           |
| **Laravel Version** | 12.x                                 |
| **PHP Version**     | 8.4                                  |
