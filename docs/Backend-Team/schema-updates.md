# Frontend Integration Guide: Economys

> **Target Audience:** Frontend Team
> **Context:** MSAB Audio Server Integration

This document outlines the data structures changes made to the users and rooms schemas.

## 1. User Profile Data

The `User` object (via `UserResource` / `/api/v1/user`) now includes the following economy fields. **Note:** Unlike the internal server payload, these are **flat fields** on the user object.

```json
{
  "id": 12345,
  "name": "St. Fox",
  "avatar": "...",
  // Economy Fields
  "coins": "100.500",       // User's spending balance
  "diamonds": "50.000",     // User's earned currency
  "wealth_xp": "1200.000",  // Sender progression
  "charm_xp": "800.000",    // Recipient progression
  ...
}
```

> **Display Note:** All currency values are returned as **strings** to preserve decimal precision. Please parse them as floats/decimals for display, but be careful with floating-point math on the client.

---
## 2. Room Status

The backend now tracks `is_live` and `participant_count` for all rooms.

- This is updated automatically by the Audio Server.
- You can rely on this data when fetching Room lists from the HTTP API.
