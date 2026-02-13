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

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/props/12345/equip                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:62-64                                            │
│ Route: Route::post('/{userProp}/equip', [...])                              │
│        ->whereNumber('userProp')                                            │
│        ->name('props.equip')                                                │
│                                                                             │
│ Middleware Chain:                                                           │
│   1. auth:sanctum        → Validates Bearer token                           │
│                                                                             │
│ NOTE: No Route Model Binding — uses integer parameter directly              │
│       Ownership validated in service layer                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER RESPONSIBILITIES                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Http/Controllers/Api/V1/Prop/UserPropController.php:87-96         │
│ Method: equip(Request $request, int $userProp): JsonResponse                │
│                                                                             │
│ STEP 1: Delegate to service                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->equipService->equip($request->user()->id, $userProp);  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2: Handle response                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(                                          │ │
│ │         $result->getMessage(),                                          │ │
│ │         $result->getHttpStatus(),   // 400 or 403                       │ │
│ │         $result->getErrorCode()                                         │ │
│ │     );                                                                  │ │
│ │ }                                                                       │ │
│ │ return ApiResponse::success($result->getData(), $result->getMessage()); │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Prop/PropEquipService.php:54-118                         │
│ Method: equip(int $userId, int $userPropId): ActionResult                   │
│                                                                             │
│ STEP 1: Begin database transaction                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = DB::transaction(function () use ($userId, $userPropId) {      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 2 (in txn): Load and lock UserProp with ownership check                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $userProp = UserProp::with(['prop', 'user'])                            │ │
│ │     ->where('id', $userPropId)                                          │ │
│ │     ->where('user_id', $userId)       // Ownership check                │ │
│ │     ->lockForUpdate()                                                   │ │
│ │     ->first();                                                          │ │
│ │                                                                         │ │
│ │ if (! $userProp) throw new PropNotOwnedException;  // 403               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 3 (in txn): Get equip strategy for prop type (Strategy Pattern)       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $strategy = self::getStrategyFor($userProp->prop->type);                │ │
│ │                                                                         │ │
│ │ // Strategy map:                                                        │ │
│ │ //   frame         → FrameEquipStrategy                                 │ │
│ │ //   signature     → SignatureEquipStrategy                             │ │
│ │ //   room_theme    → RoomThemeEquipStrategy                             │ │
│ │ //   chat_bubble   → SimpleEquipStrategy                                │ │
│ │ //   entry_animation → SimpleEquipStrategy                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4 (in txn): Validate equip is allowed                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $strategy->validate($userProp);                                         │ │
│ │ // Throws PropExpiredException if status != ACTIVE (400)                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5 (in txn): Auto-unequip existing prop of same type                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $this->unequipExistingOfType($userId, $userProp->prop->type, $userProp->id);│
│ │                                                                         │ │
│ │ // Query: Find equipped props of same type (using indexed prop_type)    │ │
│ │ // For each: call strategy->unequip() to clean up                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 6 (in txn): Execute equip via strategy                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $equipResult = $strategy->equip($userProp);                             │ │
│ │                                                                         │ │
│ │ // Sets is_equipped = true                                              │ │
│ │ // Type-specific side effects (e.g., update user.frame_url)             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 7 (after txn): Dispatch PropEquipped event                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ event(new PropEquipped(                                                 │ │
│ │     userId: $userId,                                                    │ │
│ │     propId: $result['user_prop']->prop_id,                              │ │
│ │     userPropId: $result['user_prop']->id,                               │ │
│ │     propType: $result['type']                                           │ │
│ │ ));                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 8: Return ActionResult                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(                                           │ │
│ │     data: [                                                             │ │
│ │         'equipped_prop_id' => $result['user_prop']->id,                 │ │
│ │         'type' => $result['type'],                                      │ │
│ │     ],                                                                  │ │
│ │     message: 'Prop equipped.'                                           │ │
│ │ );                                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 STRATEGY PATTERN COMPONENTS                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ INTERFACE: PropEquipStrategyInterface                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ validate(UserProp $userProp): void   // Throws if invalid               │ │
│ │ equip(UserProp $userProp): array     // Execute equip                   │ │
│ │ unequip(UserProp $userProp): array   // Execute unequip                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STRATEGY MAP:                                                               │
│ ┌──────────────────┬─────────────────────────────┬────────────────────────┐ │
│ │ Prop Type        │ Strategy Class              │ Special Behavior       │ │
│ ├──────────────────┼─────────────────────────────┼────────────────────────┤ │
│ │ frame            │ FrameEquipStrategy          │ Updates user.frame_url │ │
│ │ signature        │ SignatureEquipStrategy      │ Updates user profile   │ │
│ │ room_theme       │ RoomThemeEquipStrategy      │ Updates room settings  │ │
│ │ chat_bubble      │ SimpleEquipStrategy         │ Just sets is_equipped  │ │
│ │ entry_animation  │ SimpleEquipStrategy         │ Just sets is_equipped  │ │
│ └──────────────────┴─────────────────────────────┴────────────────────────┘ │
│                                                                             │
│ File Locations:                                                             │
│   app/Services/Prop/Strategies/                                             │
│     ├── PropEquipStrategyInterface.php                                      │
│     ├── FrameEquipStrategy.php                                              │
│     ├── SignatureEquipStrategy.php                                          │
│     ├── RoomThemeEquipStrategy.php                                          │
│     └── SimpleEquipStrategy.php                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.5 DATA ACCESS                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ DATABASE OPERATIONS (within transaction):                                   │
│                                                                             │
│ 1. SELECT FOR UPDATE: Load UserProp with ownership check                    │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM user_props                                            │  │
│    │ WHERE id = 12345 AND user_id = 100                                  │  │
│    │ FOR UPDATE                                                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 2. SELECT FOR UPDATE: Find existing equipped of same type                   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ SELECT * FROM user_props                                            │  │
│    │ WHERE user_id = 100 AND is_equipped = true                          │  │
│    │   AND prop_type = 'frame' AND id != 12345                           │  │
│    │ FOR UPDATE                                                          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 3. UPDATE: Unequip existing (if any)                                        │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE user_props SET is_equipped = false WHERE id = <old_id>       │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 4. UPDATE: Equip new prop                                                   │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE user_props SET is_equipped = true WHERE id = 12345           │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 5. UPDATE (type-specific): E.g., update user.frame_url for frame type       │
│                                                                             │
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

| File                             | Used By Endpoints                        | Reusable | Reasoning                           |
| -------------------------------- | ---------------------------------------- | -------- | ----------------------------------- |
| `UserPropController.php`         | equip, unequip, index, equipped          | ⭕       | Controller-specific, shared context |
| `PropEquipService.php`           | equip, unequip, equipped, ExpirePropsJob | ✅       | Core equip/unequip logic            |
| `PropEquipStrategyInterface.php` | All equip/unequip operations             | ✅       | Strategy contract                   |
| `FrameEquipStrategy.php`         | Frame prop type only                     | ❌       | Type-specific                       |
| `SimpleEquipStrategy.php`        | chat_bubble, entry_animation             | ✅       | Shared simple logic                 |
| `PropNotOwnedException.php`      | equip, unequip                           | ✅       | Domain exception                    |
| `PropExpiredException.php`       | equip, ExpirePropsJob                    | ✅       | Domain exception                    |
| `PropEquipped.php` (Event)       | equip                                    | ✅       | Domain event                        |
| `ApiResponse.php`                | All API endpoints                        | ✅       | Global response utility             |

---

## 5. Error Handling & Edge Cases

### Authorization/Ownership Errors (403)

| Error Code       | Message                   | Condition                       |
| ---------------- | ------------------------- | ------------------------------- |
| `prop_not_owned` | You do not own this prop. | UserProp doesn't belong to user |

### Business Logic Errors (400)

| Error Code     | Message                | Condition                   |
| -------------- | ---------------------- | --------------------------- |
| `prop_expired` | This prop has expired. | UserProp `status != ACTIVE` |

### System Errors (500)

| Error Code     | Message                                     | Condition            |
| -------------- | ------------------------------------------- | -------------------- |
| `equip_failed` | An error occurred while equipping the prop. | Unexpected exception |

### Edge Cases

| Case                                 | Behavior                                |
| ------------------------------------ | --------------------------------------- |
| Equip already-equipped prop          | No change, still returns success        |
| Equip with another prop of same type | Previous prop auto-unequipped           |
| Equip expired prop                   | 400 `prop_expired`                      |
| Equip another user's prop            | 403 `prop_not_owned`                    |
| Equip non-existent UserProp ID       | 403 `prop_not_owned` (same treatment)   |
| Race condition (concurrent equip)    | `lockForUpdate` prevents inconsistency  |
| Prop expires during equip            | Validated in strategy; fails if expired |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT          MIDDLEWARE           CONTROLLER           SERVICE            STRATEGY            DATABASE
   │                 │                    │                    │                  │                    │
   │ POST /props/12345/equip              │                    │                  │                    │
   │─────────────────▶                    │                    │                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │ 1. auth:sanctum    │                    │                  │                    │
   │                 │───────────────────▶│                    │                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │ 2. equipService    │                  │                    │
   │                 │                    │    ->equip()       │                  │                    │
   │                 │                    │───────────────────▶│                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 3. BEGIN TXN     │                    │
   │                 │                    │                    │──────────────────┼───────────────────▶│
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 4. lockForUpdate │                    │
   │                 │                    │                    │    + ownership   │                    │
   │                 │                    │                    │──────────────────┼───────────────────▶│
   │                 │                    │                    │◀─────────────────┼────────────────────│
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 5. getStrategyFor│                    │
   │                 │                    │                    │   (prop->type)   │                    │
   │                 │                    │                    │─────────────────▶│                    │
   │                 │                    │                    │◀─────────────────│                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 6. validate()    │                    │
   │                 │                    │                    │─────────────────▶│                    │
   │                 │                    │                    │    [IF EXPIRED → 400 Error]          │
   │                 │                    │                    │◀─────────────────│                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 7. unequipExisting                   │
   │                 │                    │                    │    OfType()      │                    │
   │                 │                    │                    │──────────────────┼───────────────────▶│
   │                 │                    │                    │◀─────────────────┼────────────────────│
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 8. equip()       │                    │
   │                 │                    │                    │─────────────────▶│                    │
   │                 │                    │                    │                  │───────────────────▶│
   │                 │                    │                    │                  │ UPDATE user_props  │
   │                 │                    │                    │                  │◀───────────────────│
   │                 │                    │                    │◀─────────────────│                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 9. COMMIT TXN    │                    │
   │                 │                    │                    │──────────────────┼───────────────────▶│
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │10. event(        │                    │
   │                 │                    │                    │  PropEquipped)   │                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │◀───────────────────│                  │                    │
   │                 │                    │ ActionResult       │                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │11. ApiResponse     │                  │                    │
   │                 │◀───────────────────│   ::success()      │                  │                    │
   │◀────────────────│                    │                    │                  │                    │
   │                 │                    │                    │                  │                    │
   │  200 OK         │                    │                    │                  │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                | Location                                       |
| ----------------------- | ---------------------------------------------- |
| New prop type           | Add to STRATEGY_MAP in PropEquipService        |
| New strategy class      | Create in `Strategies/` implementing interface |
| Pre-equip validation    | Add to strategy's validate() method            |
| Post-equip side effects | Add to strategy's equip() method               |
| Equip notifications     | Add listener to PropEquipped event             |

### 📝 Adding a New Prop Type

| Step  | File                              | What to Change               |
| ----- | --------------------------------- | ---------------------------- |
| **1** | `PropType.php` (Enum)             | Add new case                 |
| **2** | Create `NewTypeEquipStrategy.php` | Implement interface          |
| **3** | `PropEquipService.php`            | Add to STRATEGY_MAP constant |

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                                             |
| ----------------------------- | -------------------------------------------------- |
| STRATEGY_MAP                  | Single source of truth; affects ExpirePropsJob too |
| `lockForUpdate()` on UserProp | Prevents race conditions                           |
| Auto-unequip logic            | Business rule: one per type                        |
| PropEquipped event dispatch   | Cache invalidation depends on it                   |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                    |
| -------------------------------------- | --------------------------------------------- |
| Forgetting to add to STRATEGY_MAP      | New types will throw InvalidArgumentException |
| Not implementing all interface methods | PHP will error on missing methods             |
| Skipping validation in strategy        | Expired props could be equipped               |
| Removing lockForUpdate                 | Race conditions could cause multiple equipped |
| Not dispatching PropEquipped           | Cache becomes stale                           |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 62-64)
app/Http/Controllers/Api/V1/Prop/
  └── UserPropController.php                         ← Controller (equip method, lines 87-96)
app/Services/Prop/
  ├── PropEquipService.php                           ← Service (equip method, lines 54-118)
  └── Strategies/
      ├── PropEquipStrategyInterface.php             ← Strategy interface
      ├── FrameEquipStrategy.php                     ← Frame-specific logic
      ├── SignatureEquipStrategy.php                 ← Signature-specific logic
      ├── RoomThemeEquipStrategy.php                 ← Room theme logic
      └── SimpleEquipStrategy.php                    ← Generic equip logic
app/Exceptions/Prop/
  ├── PropNotOwnedException.php                      ← 403, 'prop_not_owned'
  └── PropExpiredException.php                       ← 400, 'prop_expired'
app/Events/Prop/
  └── PropEquipped.php                               ← Domain event
```

---

## 8. MSAB Realtime Event Contracts

### PropEquipped Event

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Event: PropEquipped                                                         │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Events/Prop/PropEquipped.php                                      │
│ Dispatched: After successful equip (outside transaction)                    │
│                                                                             │
│ Payload:                                                                    │
│   • userId: int       - User who equipped                                   │
│   • propId: int       - Prop ID (catalog)                                   │
│   • userPropId: int   - UserProp record ID                                  │
│   • propType: string  - Prop type ('frame', 'signature', etc.)              │
│                                                                             │
│ Listeners:                                                                  │
│   • InvalidateEquippedPropsCache → Clears user:{id}:equipped_props          │
│   • (Potential) BroadcastEquipChange → MSAB notification                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Document Metadata

| Property            | Value                                 |
| ------------------- | ------------------------------------- |
| **Endpoint**        | `POST /api/v1/props/{userProp}/equip` |
| **Domain**          | Prop                                  |
| **Author**          | System Documentation                  |
| **Created**         | 2026-02-05                            |
| **Laravel Version** | 12.x                                  |
| **PHP Version**     | 8.4                                   |
