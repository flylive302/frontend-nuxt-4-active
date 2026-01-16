# Backend Type Unification Requirements

> **From**: Frontend Team  
> **To**: Laravel Team  
> **Date**: 2026-01-16  
> **Priority**: HIGH

---

## Summary

We've implemented the Bootstrap system. To unify types and reduce code duplication, we need **all endpoints** to use the same formats defined in bootstrap.

---

## 1. BootstrapUser (Main User Type)

### Endpoints to Update

| Endpoint | Current | Required |
|----------|---------|----------|
| `POST /auth/login` | `User` (old) | `BootstrapUser` |
| `POST /auth/register` | `User` (old) | `BootstrapUser` |
| `PUT /profile` | `User` (old) | `BootstrapUser` |
| `PUT /profile/avatar` | `User` (old) | `BootstrapUser` |

### Format

```php
return [
    'id' => $this->id,
    'name' => $this->name,
    'signature' => $this->signature,
    'avatar' => $this->avatar_url,  // Single URL string!
    'phone' => $this->phone,
    'phone_country' => $this->phone_country,
    'phone_country_code' => $this->phone_country_code,
    'gender' => $this->gender,  // 'male' | 'female' | null
    'date_of_birth' => $this->date_of_birth?->toDateString(),
    'coins' => $this->coins,
    'diamonds' => $this->diamonds,
    'wealth_xp' => $this->wealth_xp,
    'charm_xp' => $this->charm_xp,
    'is_profile_complete' => (bool) $this->is_profile_complete,  // FLAT!
    'is_blocked' => (bool) $this->is_blocked,
    'blocked_at' => $this->blocked_at,
    'blocked_reason' => $this->blocked_reason,
    'locked_until' => $this->locked_until,
];
```

---

## 2. MinimalUser (Nested User References)

Use this for `room.owner`, room members, agency members, gift sender/receiver.

### Format

```php
return [
    'id' => $this->id,
    'name' => $this->name,
    'signature' => $this->signature,
    'avatar' => $this->avatar_url,  // Single URL string!
    'gender' => $this->gender,  // string
    'date_of_birth' => $this->date_of_birth?->toDateString(),
    'wealth_xp' => $this->wealth_xp,
    'charm_xp' => $this->charm_xp,
];
```

### Endpoints Affected

- `GET /rooms/{id}` → `room.owner` should be `MinimalUser`
- `GET /rooms/{id}/members` → each member
- Agency endpoints → member references

---

## 3. Room Type Changes

| Field | OLD | NEW |
|-------|-----|-----|
| `room.user` | Full user object | `room.owner` (MinimalUser) |
| `room.level_xp` | — | `room.room_xp` |
| `room.logo` | Object | `string \| null` |

---

## 4. Avatar Format (EVERYWHERE)

| OLD | NEW |
|-----|-----|
| `{large, medium, original, thumbnail}` | `string \| null` |

Frontend uses Nuxt Image with ImageKit for transforms. Single URL is sufficient.

---

## 5. Income Target Fields

| OLD | NEW |
|-----|-----|
| `period_start` | `start_date` |
| `period_end` | `end_date` |
| `tier` (number) | `tier` (string: "T1", "T2", etc.) |

---

## 6. LevelStatus & LevelBadge

Already correct in bootstrap. Just ensure these match everywhere:

```php
// LevelStatus
return [
    'current_level' => $level,
    'level_name' => $name,
    'current_xp' => $xp,
    'xp_for_next_level' => $nextXp,
    'xp_remaining' => $remaining,
    'progress_percentage' => $percent,
    'badge' => $badge ? [
        'id' => $badge->id,
        'name' => $badge->name,
        'image_url' => $badge->image_url,
    ] : null,
    'next_level' => $next ? [
        'level' => $next->level,
        'name' => $next->name,
        'required_xp' => $next->required_xp,
    ] : null,
];

// LevelBadge
return [
    'id' => $this->id,
    'name' => $this->name,
    'image_url' => $this->image_url,
    'category' => $this->category,  // 'wealth' | 'charm' | 'room' | 'special'
];
```

---

## 7. APIs to Deprecate (After Frontend Migration)

| API | Replaced By |
|-----|-------------|
| `GET /auth/user` | Bootstrap (on app start) |
| `GET /profile/levels` | Bootstrap `user_data.levels` |
| `GET /levels/config` | Bootstrap `config.*_levels` |

Keep these for now but plan to remove.

---

## Summary of Breaking Changes

| Category | OLD | NEW |
|----------|-----|-----|
| Avatar | Object | Single URL string |
| Profile complete | `profile_completion.is_complete` | `is_profile_complete` |
| Gender | Number | String enum |
| Room owner | `room.user` | `room.owner` (MinimalUser) |
| Room XP | `room.level_xp` | `room.room_xp` |
| Income dates | `period_start/end` | `start_date/end_date` |

---

## Benefits

- **Single resource per entity type**
- **Consistent API responses**
- **~50% less type definitions**
- **No frontend type conversions**

---

## Questions?

Let me know if any fields are unclear or if there are backend constraints.
