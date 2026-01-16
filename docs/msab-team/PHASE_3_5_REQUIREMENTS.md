# Phase 3+5 MSAB Requirements

> **Asset Invalidation Event Enhancement**
> 
> Updates needed to `asset:invalidate` event for the Asset Caching phase.

---

## Current Implementation

```typescript
// Current (basic)
{
  asset_ids: string[]
}
```

## Required Enhancement

```typescript
// Enhanced payload
interface AssetInvalidatePayload {
  url: string           // Full asset URL (e.g., '/room/gifts/vip/castle/playable.webm')
  giftId?: number       // Optional gift ID for tracking
  priority?: 'critical' | 'normal'  // Critical = re-download immediately
  reason?: string       // Debug: 'animation_updated', 'gift_deleted', etc.
}
```

**Why the change?**
- Frontend caches assets by URL, not ID
- Priority determines if client waits for WiFi or downloads immediately
- Reason helps debugging cache invalidation issues

---

## Event Flow

```
Laravel (Gift Updated)
    ↓
AssetInvalidatedEvent
    ↓
MSAB receives event
    ↓
MSAB broadcasts `asset:invalidate` to all sockets
    ↓
Frontend deletes from Cache Storage + re-downloads if critical
```

---

## Frontend Handler

```typescript
socket.on('asset:invalidate', async (payload) => {
  await cacheStorage.deleteAsset(payload.url)
  await assetIndex.delete(payload.url)
  
  if (payload.priority === 'critical') {
    assetDownloader.enqueueManual(payload.url, { priority: 'critical' })
  }
})
```

---

## Questions

1. How should Laravel → MSAB communication work for this event? (HTTP? Redis pub/sub?)
2. Timeline for implementation?
