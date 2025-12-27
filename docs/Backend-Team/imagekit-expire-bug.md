# URGENT: ImageKit Auth Params Bug Fix

## Issue

The `/api/v1/uploads/auth-params` endpoint is returning the `expire` field incorrectly.

**Current (Wrong):**
```json
{
  "expire": 300,  // ← This is just the expire_seconds value
}
```

**Expected (Correct):**
```json
{
  "expire": 1735354200  // ← Unix timestamp = current_time + expire_seconds
}
```

## The Bug

ImageKit expects `expire` to be a **Unix timestamp** (seconds since January 1, 1970).

The backend is returning `300` (the number of seconds requested), but should return:

```php
$expire = time() + $expireSeconds;
// or
$expire = Carbon::now()->addSeconds($expireSeconds)->timestamp;
```

## Evidence

Console shows:
```
expire: 300
expireDate: '1970-01-01T00:05:00.000Z'  // ← 55 years in the past!
```

ImageKit error:
```
"Expire parameter should be a Unix time in less than 1 hour into the future"
```

## Fix Required

In the backend auth params generation:

```php
// BEFORE (wrong)
$data = [
    'expire' => $expireSeconds,  // ← Bug: returning duration, not timestamp
    // ...
];

// AFTER (correct)
$data = [
    'expire' => time() + $expireSeconds,  // ← Fix: return actual timestamp
    // ...
];
```

## Priority

**CRITICAL** - Agency creation is completely blocked until this is fixed.
