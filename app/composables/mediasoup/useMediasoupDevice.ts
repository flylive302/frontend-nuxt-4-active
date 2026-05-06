import type { types as mediasoupTypes } from 'mediasoup-client';
import type { RtpCapabilities } from '~/types/room/audio';
import { createLogger } from '~/utils/logger';

// Lazy-loaded: mediasoup-client must NOT be statically imported because
// it uses the `debug` package which calls console.log.bind(console) —
// this crashes in Cloudflare Workers (workerd) runtime during SSR.
let _DeviceClass: typeof import('mediasoup-client')['Device'] | null = null;
async function getDeviceClass() {
  if (!_DeviceClass) {
    const mod = await import('mediasoup-client');
    _DeviceClass = mod.Device;
  }
  return _DeviceClass;
}

// ============================================
// Shared State (Module-level Singleton)
// ============================================
// CRITICAL: Module-level to be shared across all component instances

const device = ref<mediasoupTypes.Device | null>(null);

// ============================================
// Composable
// ============================================

/**
 * Mediasoup Device Management
 * 
 * Handles device initialization and loading with RTP capabilities.
 * Must be called before creating transports.
 */
export function useMediasoupDevice() {
  const log = createLogger('[MediasoupDevice]');

  // ========================================
  // Computed Properties
  // ========================================
  const isDeviceLoaded = computed(() => device.value?.loaded ?? false);

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Load the mediasoup device with RTP capabilities from the server.
   * Must be called before creating transports.
   * 
   * @param rtpCapabilities - RTP capabilities from server
   * @throws {Error} If the device/browser doesn't support WebRTC
   */
  async function loadDevice(rtpCapabilities: RtpCapabilities): Promise<void> {
    if (device.value?.loaded) {
      log.debug('Device already loaded');
      return;
    }

    // Check for basic WebRTC support
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
    }

    try {
      const Device = await getDeviceClass();
      device.value = new Device();
      await device.value.load({ routerRtpCapabilities: rtpCapabilities });
      log.debug('Device loaded');
    } catch (error) {
      // Handle UnsupportedError from mediasoup-client
      if (error instanceof Error && error.name === 'UnsupportedError') {
        log.error('Device not supported:', error.message);
        throw new Error('Audio is not supported on this device/browser. Please try using Chrome, Firefox, or Safari on a desktop or mobile device.');
      }
      throw error;
    }
  }

  /**
   * Reset device (called on cleanup)
   */
  function resetDevice(): void {
    device.value = null;
  }

  // ========================================
  // Return
  // ========================================
  return {
    device,
    isDeviceLoaded,
    loadDevice,
    resetDevice,
  };
}
