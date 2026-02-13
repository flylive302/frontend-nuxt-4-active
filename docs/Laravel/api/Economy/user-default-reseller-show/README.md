# GET /api/v1/user/default-reseller

> **Domain**: Economy  
> **Type**: Protected Endpoint  
> **Version**: V1  
> **Last Updated**: 2026-02-04

---

## 1. Domain Overview

### Purpose

Retrieves the authenticated user's configured default reseller for coin purchases.

### Responsibilities

- Return the user's preferred reseller
- Return null if no default set

---

## 2. API Contract

### Endpoint

```
GET /api/v1/user/default-reseller
```

### Authentication

✅ **Required** - Bearer token via Sanctum

### Response Schemas

#### ✅ Success (200) - Has Default Reseller

```json
{
  "status": "success",
  "message": "Default reseller retrieved",
  "data": {
    "id": 456,
    "name": "John's Coin Shop",
    "signature": "johnscoins",
    "avatar": "https://ik.imagekit.io/..."
  }
}
```

#### ✅ Success (200) - No Default Reseller

```json
{
  "status": "success",
  "message": "No default reseller set",
  "data": null
}
```

---

## 3. Execution Waterfall

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.1 ROUTE: routes/api/coin-requests.php:32                                  │
│ Route::get('/user/default-reseller', [ResellerController::class, 'getDefault'])│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3.2 CONTROLLER: ResellerController.php:60-80                                │
│ getDefault(Request $request):                                               │
│   - Get authenticated user                                                  │
│   - Access user->defaultReseller relationship                               │
│   - Return reseller or null                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Error Handling

| Code  | Condition                  |
| ----- | -------------------------- |
| `200` | Success (reseller or null) |
| `401` | Unauthenticated            |

---

## 5. File Locations

```
routes/api/coin-requests.php:32              ← Route
app/Http/Controllers/Api/V1/Agency/ResellerController.php ← Controller
app/Models/User/User.php                     ← defaultReseller relationship
```

---

## 6. Document Metadata

| Property     | Value                               |
| ------------ | ----------------------------------- |
| **Endpoint** | `GET /api/v1/user/default-reseller` |
| **Domain**   | Economy                             |
| **Created**  | 2026-02-04                          |
