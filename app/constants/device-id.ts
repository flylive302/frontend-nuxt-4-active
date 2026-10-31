// account-bans 05 — how long boot waits for the native `Device.getId()` before
// starting on the stored random UUID. A hung bridge call must never stall boot.
export const NATIVE_DEVICE_ID_TIMEOUT_MS = 1500
