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

---

## 3. Endpoint Execution Waterfall (DETAILED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST ARRIVES                                │
│                    POST /api/v1/props/12345/unequip                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ENTRY POINT                                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ File: routes/api/props.php:66-68                                            │
│ Route: Route::post('/{userProp}/unequip', [...])                            │
│        ->whereNumber('userProp')                                            │
│        ->name('props.unequip')                                              │
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
│ File: app/Http/Controllers/Api/V1/Prop/UserPropController.php:101-110       │
│ Method: unequip(Request $request, int $userProp): JsonResponse              │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $result = $this->equipService->unequip($request->user()->id, $userProp);│ │
│ │                                                                         │ │
│ │ if ($result->isFailure()) {                                             │ │
│ │     return ApiResponse::error(...);                                     │ │
│ │ }                                                                       │ │
│ │                                                                         │ │
│ │ return ApiResponse::success(null, $result->getMessage());               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: Returns null data on success (no data needed for unequip)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.3 SERVICE LAYER FLOW                                                      │
│─────────────────────────────────────────────────────────────────────────────│
│ File: app/Services/Prop/PropEquipService.php:123-169                        │
│ Method: unequip(int $userId, int $userPropId): ActionResult                 │
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
│ STEP 3 (in txn): Check if already unequipped (idempotent)                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ if (! $userProp->is_equipped) {                                         │ │
│ │     return ['already_unequipped' => true];  // Early return success     │ │
│ │ }                                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 4 (in txn): Get strategy and execute unequip                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ $strategy = self::getStrategyFor($userProp->prop->type);                │ │
│ │ $unequipResult = $strategy->unequip($userProp);                         │ │
│ │                                                                         │ │
│ │ // Sets is_equipped = false                                             │ │
│ │ // Type-specific cleanup (e.g., clear user.frame_url)                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STEP 5: Return ActionResult                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ return ActionResult::success(message: 'Prop unequipped.');              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ NOTE: No event dispatched on unequip (cache invalidated implicitly)         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.4 STRATEGY PATTERN (Same as Equip)                                        │
│─────────────────────────────────────────────────────────────────────────────│
│                                                                             │
│ INTERFACE: PropEquipStrategyInterface                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ unequip(UserProp $userProp): array   // Execute unequip                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ STRATEGY BEHAVIOR (unequip):                                                │
│ ┌──────────────────┬─────────────────────────────┬────────────────────────┐ │
│ │ Prop Type        │ Strategy Class              │ Unequip Behavior       │ │
│ ├──────────────────┼─────────────────────────────┼────────────────────────┤ │
│ │ frame            │ FrameEquipStrategy          │ Clears user.frame_url  │ │
│ │ signature        │ SignatureEquipStrategy      │ Clears user profile    │ │
│ │ room_theme       │ RoomThemeEquipStrategy      │ Resets room settings   │ │
│ │ chat_bubble      │ SimpleEquipStrategy         │ Just sets is_equipped=f│ │
│ │ entry_animation  │ SimpleEquipStrategy         │ Just sets is_equipped=f│ │
│ └──────────────────┴─────────────────────────────┴────────────────────────┘ │
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
│ 2. UPDATE: Set is_equipped = false                                          │
│    ┌─────────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE user_props SET is_equipped = false WHERE id = 12345          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ 3. UPDATE (type-specific): E.g., clear user.frame_url for frame type        │
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

| File                             | Used By Endpoints                        | Reusable | Reasoning                      |
| -------------------------------- | ---------------------------------------- | -------- | ------------------------------ |
| `UserPropController.php`         | equip, unequip, index, equipped          | ⭕       | Controller with shared context |
| `PropEquipService.php`           | equip, unequip, equipped, ExpirePropsJob | ✅       | Core equip/unequip logic       |
| `PropEquipStrategyInterface.php` | All equip/unequip operations             | ✅       | Strategy contract              |
| `PropNotOwnedException.php`      | equip, unequip                           | ✅       | Domain exception               |
| `ApiResponse.php`                | All API endpoints                        | ✅       | Global response utility        |

---

## 5. Error Handling & Edge Cases

### Authorization/Ownership Errors (403)

| Error Code       | Message                   | Condition                       |
| ---------------- | ------------------------- | ------------------------------- |
| `prop_not_owned` | You do not own this prop. | UserProp doesn't belong to user |

### System Errors (500)

| Error Code       | Message                                       | Condition            |
| ---------------- | --------------------------------------------- | -------------------- |
| `unequip_failed` | An error occurred while unequipping the prop. | Unexpected exception |

### Edge Cases

| Case                                | Behavior                                |
| ----------------------------------- | --------------------------------------- |
| Unequip already-unequipped prop     | Returns success (idempotent)            |
| Unequip another user's prop         | 403 `prop_not_owned`                    |
| Unequip non-existent UserProp ID    | 403 `prop_not_owned` (same treatment)   |
| Unequip expired prop                | Allowed (just sets is_equipped = false) |
| Race condition (concurrent unequip) | `lockForUpdate` ensures consistency     |

---

## 6. Sequence Diagram (Textual)

```
 CLIENT          MIDDLEWARE           CONTROLLER           SERVICE            STRATEGY            DATABASE
   │                 │                    │                    │                  │                    │
   │ POST /props/12345/unequip            │                    │                  │                    │
   │─────────────────▶                    │                    │                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │ 1. auth:sanctum    │                    │                  │                    │
   │                 │───────────────────▶│                    │                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │ 2. equipService    │                  │                    │
   │                 │                    │    ->unequip()     │                  │                    │
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
   │                 │                    │                    │ 5. Check         │                    │
   │                 │                    │                    │    is_equipped   │                    │
   │                 │                    │                    │    [IF false → early return success] │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 6. getStrategyFor│                    │
   │                 │                    │                    │─────────────────▶│                    │
   │                 │                    │                    │◀─────────────────│                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 7. unequip()     │                    │
   │                 │                    │                    │─────────────────▶│                    │
   │                 │                    │                    │                  │───────────────────▶│
   │                 │                    │                    │                  │ UPDATE user_props  │
   │                 │                    │                    │                  │◀───────────────────│
   │                 │                    │                    │◀─────────────────│                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │                    │ 8. COMMIT TXN    │                    │
   │                 │                    │                    │──────────────────┼───────────────────▶│
   │                 │                    │                    │                  │                    │
   │                 │                    │◀───────────────────│                  │                    │
   │                 │                    │ ActionResult       │                  │                    │
   │                 │                    │                    │                  │                    │
   │                 │                    │ 9. ApiResponse     │                  │                    │
   │                 │◀───────────────────│   ::success(null)  │                  │                    │
   │◀────────────────│                    │                    │                  │                    │
   │                 │                    │                    │                  │                    │
   │  200 OK         │                    │                    │                  │                    │
```

---

## 7. Extension & Maintenance Notes

### ✅ Where to Add New Features

| Addition                    | Location                                        |
| --------------------------- | ----------------------------------------------- |
| Unequip confirmation prompt | Frontend only - API is stateless                |
| Unequip cooldown            | Add check in service before unequip             |
| Unequip notifications       | Dispatch event after unequip (not current impl) |

### 📝 Key Differences from Equip

| Aspect        | Equip                          | Unequip                 |
| ------------- | ------------------------------ | ----------------------- |
| Response data | `{equipped_prop_id, type}`     | `null`                  |
| Validation    | Checks if expired              | No expiry check         |
| Auto-unequip  | Unequips same-type props first | N/A                     |
| Event         | PropEquipped dispatched        | No event dispatched     |
| Idempotent    | Re-equipping succeeds          | Re-unequipping succeeds |

### ⚠️ What Should NOT Be Modified Casually

| Component                     | Reason                            |
| ----------------------------- | --------------------------------- |
| Idempotent check              | Clients may retry; must not fail  |
| `lockForUpdate()` on UserProp | Prevents race conditions          |
| Strategy delegation           | Type-specific cleanup must happen |

### 🚨 Common Pitfalls

| Pitfall                                | Prevention                                    |
| -------------------------------------- | --------------------------------------------- |
| Adding expiry check to unequip         | Users should be able to unequip expired props |
| Returning error for already unequipped | Must be idempotent for client retries         |
| Forgetting strategy cleanup            | Always delegate to strategy                   |

### 📁 File Locations Quick Reference

```
routes/api/props.php                                 ← Route definition (lines 66-68)
app/Http/Controllers/Api/V1/Prop/
  └── UserPropController.php                         ← Controller (unequip method, lines 101-110)
app/Services/Prop/
  ├── PropEquipService.php                           ← Service (unequip method, lines 123-169)
  └── Strategies/
      └── [Same strategies as equip]
app/Exceptions/Prop/
  └── PropNotOwnedException.php                      ← 403, 'prop_not_owned'
```

---

## 8. MSAB Realtime Event Contracts

No MSAB events are currently dispatched on unequip. If needed in the future:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Potential Event: PropUnequipped                                             │
│─────────────────────────────────────────────────────────────────────────────│
│ Currently: Not implemented                                                  │
│                                                                             │
│ If implemented, suggested payload:                                          │
│   • userId: int       - User who unequipped                                 │
│   • propId: int       - Prop ID (catalog)                                   │
│   • userPropId: int   - UserProp record ID                                  │
│   • propType: string  - Prop type                                           │
│                                                                             │
│ Use cases:                                                                  │
│   • Cache invalidation (currently handled by TTL)                           │
│   • Real-time UI updates in rooms                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Document Metadata

| Property            | Value                                   |
| ------------------- | --------------------------------------- |
| **Endpoint**        | `POST /api/v1/props/{userProp}/unequip` |
| **Domain**          | Prop                                    |
| **Author**          | System Documentation                    |
| **Created**         | 2026-02-05                              |
| **Laravel Version** | 12.x                                    |
| **PHP Version**     | 8.4                                     |
