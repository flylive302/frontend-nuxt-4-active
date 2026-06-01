<script setup lang="ts">
/**
 * LuckyRoomAnnouncement
 *
 * SVGA slide-in animation for room-scoped big wins (Epic, Huge, Mega).
 * Slides in from right, stays centered for ~4s, then slides out left.
 * Displays SVGA animation with text overlay showing user + multiplier.
 *
 * The SVGA URL comes from the backend via `lucky_room_announcement_svga` setting.
 */
import type { LuckyRoomAnnouncement } from '~/types/lucky';

// ============================================
// Props & Emits
// ============================================

const props = defineProps<{
  announcement: LuckyRoomAnnouncement;
  visible: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

// ============================================
// Lifecycle (shared composable)
// ============================================

const canvasRef = ref<HTMLCanvasElement | null>(null);
const svgaUrl = computed(() => props.announcement?.svga_url ?? '');

const { animationPhase } = useLuckyAnnouncementLifecycle({
  canvasRef,
  svgaUrl,
  stayDuration: 4000,
  visible: toRef(props, 'visible'),
  onDismiss: () => emit('dismiss'),
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && animationPhase !== 'done'"
      class="lucky-room-overlay"
      :class="`lucky-room--${animationPhase}`"
    >
      <div class="lucky-room-content">
        <!-- SVGA Animation Canvas -->
        <canvas
          ref="canvasRef"
          class="lucky-room-svga"
          width="400"
          height="300"
        />

        <!-- Text Overlay -->
        <div class="lucky-room-text">
          <div class="lucky-room-user">
            <img
              v-if="announcement.user_avatar"
              :src="announcement.user_avatar"
              :alt="announcement.user_name"
              class="lucky-room-avatar"
            >
            <span class="lucky-room-name">{{ announcement.user_name }}</span>
          </div>
          <div class="lucky-room-multiplier">
            ×{{ announcement.multiplier }}
          </div>
          <div class="lucky-room-tier">{{ announcement.tier_name }}</div>
          <div class="lucky-room-coins">
            +{{ announcement.coins_won.toLocaleString() }} coins
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lucky-room-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  pointer-events: none;
}

.lucky-room-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Slide-in from right */
.lucky-room--enter .lucky-room-content {
  transform: translateX(120vw);
}

/* Center stay */
.lucky-room--stay .lucky-room-content {
  transform: translateX(0);
}

/* Slide-out to left */
.lucky-room--exit .lucky-room-content {
  transform: translateX(-120vw);
}

.lucky-room-svga {
  width: 300px;
  height: 250px;
  object-fit: contain;
}

.lucky-room-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
}

.lucky-room-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lucky-room-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.6);
}

.lucky-room-name {
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
}

.lucky-room-multiplier {
  color: #ffd700;
  font-size: 2.5rem;
  font-weight: 900;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.7), 0 0 40px rgba(255, 215, 0, 0.3);
  line-height: 1;
}

.lucky-room-tier {
  color: #ed8936;
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.lucky-room-coins {
  color: #48bb78;
  font-size: 1rem;
  font-weight: 600;
}
</style>
