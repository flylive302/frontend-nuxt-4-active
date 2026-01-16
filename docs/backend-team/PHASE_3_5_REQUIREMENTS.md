# Phase 3+5 Backend Requirements

> **Required for: Asset Caching & PWA Integration**
> 
> This document outlines backend (Laravel) and MSAB requirements for the Asset Downloader and PWA phases.

---

## 1. MSAB Requirements

### Enhanced `asset:invalidate` Event

> [!IMPORTANT]
> The current `asset:invalidate` payload only has `asset_ids`. We need URL-based invalidation.

**Updated Payload:**
```typescript
interface AssetInvalidatePayload {
  url: string           // Full asset URL (required)
  giftId?: number       // Optional, for tracking
  priority?: 'critical' | 'normal'  // If critical, client re-downloads immediately
  reason?: string       // Debug info (gift updated, deleted, etc.)
}
```

**Trigger Scenarios:**
- Gift animation updated
- Gift deleted
- Gift thumbnail changed
- Admin refreshes asset

**Target:** Broadcast to all connected clients

---

## 2. Laravel Requirements

### 2.1 Gift Size Data (Optional - Deferred)

Add `size_bytes` to gift response for accurate cellular consent UX:

```php
// GiftResource.php
'size_bytes' => $this->getAnimationFileSize(), // bytes, null if unknown
```

**Priority:** LOW (frontend uses Content-Length fallback)

---

### 2.2 VAPID Keys for Push Notifications (Phase 10)

Already in bootstrap response:
```php
'vapid_public_key' => config('webpush.vapid.public_key')
```

**Status:** ✅ Already implemented

---

### 2.3 Asset Invalidation Trigger

When admin updates gift animation, emit to MSAB:

```php
// In GiftController or GiftService
event(new AssetInvalidatedEvent([
    'url' => $gift->animation_url,
    'giftId' => $gift->id,
    'priority' => $gift->sort_order <= 30 ? 'critical' : 'normal',
    'reason' => 'animation_updated'
]));
```

**MSAB should relay this as `asset:invalidate` socket event.**

---

## 3. Summary

| Requirement | Team | Priority | Status |
|-------------|------|----------|--------|
| Enhanced `asset:invalidate` payload | MSAB | HIGH | 📋 Update needed |
| Asset invalidation event trigger | Laravel | HIGH | 📋 New |
| Gift `size_bytes` field | Laravel | LOW | 📋 Deferred |
| VAPID keys in bootstrap | Laravel | N/A | ✅ Done |

---

## Questions

1. **MSAB**: Can you implement the enhanced payload for `asset:invalidate`?
2. **Laravel**: Where should `AssetInvalidatedEvent` be dispatched from? (GiftController, Observer, or Service?)
3. **Both**: Timeline estimate for these changes?
