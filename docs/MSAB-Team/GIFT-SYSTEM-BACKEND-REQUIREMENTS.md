# Gift System Backend Requirements

This document outlines the requirements and current implementation details for the gifting system on the FlyLive frontend, to be shared with the MSAB team for backend coordination.

## 1. Request: Rate Limit Adjustment

Currently, the server enforces a rate limit of **30 gifts per minute**, which results in the error:
`Too many gifts, please slow down`.

### Required Change:
We request to **remove or significantly increase** this rate limit. For a premium social experience, users often "spam" gifts (combos) rapidly. Any restriction on this flow directly impacts engagement and revenue.

---

## 2. Frontend Implementation: Gift Queue

To ensure system stability regardless of rate limits, the frontend has implemented a **socket emission queue**.

- **Mechanism**: Each gift send (including rapid combos) is added to a local queue.
- **Spacing**: The queue processes one gift every **100ms** (configurable via `GIFT_QUEUE_INTERVAL_MS`).
- **Visuals**: The sender sees instant visual feedback (animation + coin deduction) regardless of queue status.

---

## 3. Gift Socket Payloads

The frontend interacts with the MSAB backend using the following payloads:

### Sending a Gift (`gift:send`)
**Event**: `gift:send` (Client → Server)
```json
{
  "roomId": "string",
  "giftId": "number",
  "recipientId": "number",
  "quantity": "number"
}
```

### Receiving a Gift (`gift:received`)
**Event**: `gift:received` (Server → All)
```json
{
  "senderId": "number",
  "senderName": "string",
  "senderAvatar": "string",
  "roomId": "string",
  "giftId": "number",
  "recipientId": "number",
  "quantity": "number"
}
```

### Handling Errors (`gift:error`)
**Event**: `gift:error` (Server → Sender)
Used for rolling back optimistic coin updates if a transaction fails.

---

## 4. Frontend Coin Handling

The frontend manages user balances **optimistically** for the best UX:

1. **On Send**: Deduct `price * count` immediately from `authStore.user.coins`.
2. **On Error**: If `gift:error` is received, we use the `refundPendingCoins` helper in `useGiftSending.ts` to restore the balance.
3. **Optimistic Sync**: The backend is expected to follow up with the actual balance deduction in the database.

---

> [!NOTE]
> By combining frontend queuing and backend rate-limit relaxation, we achieve a high-performance gifting system that feels "instant" to the user while maintaining server reliability.
