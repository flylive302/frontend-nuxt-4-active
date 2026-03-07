<script setup lang="ts">
/**
 * LuckyAppAnnouncement
 *
 * SVGA slide-in animation for app-wide mega wins (Mega, Ultra, Jackpot).
 * Same slide-in/stay/slide-out pattern as LuckyRoomAnnouncement
 * but broadcast to ALL rooms via MSAB.
 *
 * The SVGA URL comes from the backend via `lucky_app_announcement_svga` setting.
 */
import type { LuckyAppAnnouncement } from '~/types/lucky';

// ============================================
// Props & Emits
// ============================================

const props = defineProps<{
  announcement: LuckyAppAnnouncement;
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
  stayDuration: 5000,
  visible: toRef(props, 'visible'),
  onDismiss: () => emit('dismiss'),
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && animationPhase !== 'done'"
      class="lucky-app-overlay"
      :class="`lucky-app--${animationPhase}`"
    >
      <!-- Semi-transparent backdrop for app-wide announcements -->
      <div class="lucky-app-backdrop" />

      <div class="lucky-app-content">
        <!-- SVGA Animation Canvas -->
        <canvas
          ref="canvasRef"
          class="lucky-app-svga"
          width="500"
          height="400"
        />

        <!-- Text Overlay -->
        <div class="lucky-app-text">
          <div class="lucky-app-banner">🎰 MEGA WIN 🎰</div>
          <div class="lucky-app-user">
            <img
              v-if="announcement.user_avatar"
              :src="announcement.user_avatar"
              :alt="announcement.user_name"
              class="lucky-app-avatar"
            />
            <span class="lucky-app-name">{{ announcement.user_name }}</span>
          </div>
          <div class="lucky-app-multiplier">
            ×{{ announcement.multiplier }}
          </div>
          <div class="lucky-app-tier">{{ announcement.tier_name }}</div>
          <div class="lucky-app-coins">
            +{{ announcement.coins_won.toLocaleString() }} coins
          </div>
          <div class="lucky-app-room">
            in {{ announcement.room_name }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lucky-app-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: none;
}

.lucky-app-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 215, 0, 0.08) 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
  animation: fadeInBackdrop 0.6s ease-out;
}

.lucky-app-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Slide-in from right */
.lucky-app--enter .lucky-app-content {
  transform: translateX(120vw);
}

/* Center stay */
.lucky-app--stay .lucky-app-content {
  transform: translateX(0);
}

/* Slide-out to left */
.lucky-app--exit .lucky-app-content {
  transform: translateX(-120vw);
}

.lucky-app-svga {
  width: 350px;
  height: 300px;
  object-fit: contain;
}

.lucky-app-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}

.lucky-app-banner {
  color: #ffd700;
  font-size: 1.2rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 4px;
  animation: pulseBanner 1s ease-in-out infinite alternate;
}

.lucky-app-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lucky-app-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid #ffd700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.lucky-app-name {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}

.lucky-app-multiplier {
  color: #ffd700;
  font-size: 3rem;
  font-weight: 900;
  text-shadow:
    0 0 30px rgba(255, 215, 0, 0.8),
    0 0 60px rgba(255, 215, 0, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.6);
  line-height: 1;
}

.lucky-app-tier {
  color: #f56565;
  font-size: 1.3rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 3px;
}

.lucky-app-coins {
  color: #48bb78;
  font-size: 1.1rem;
  font-weight: 700;
}

.lucky-app-room {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  font-style: italic;
}

@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulseBanner {
  from { opacity: 0.7; }
  to { opacity: 1; }
}
</style>
