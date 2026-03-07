/**
 * Lucky Announcement Lifecycle Composable
 *
 * Shared animation lifecycle for lucky announcement components
 * (LuckyRoomAnnouncement, LuckyAppAnnouncement).
 *
 * Manages: SVGA player setup, slide-in → stay → slide-out → dismiss phases.
 */

// ============================================
// Types
// ============================================

type AnimationPhase = 'enter' | 'stay' | 'exit' | 'done';

interface AnnouncementLifecycleOptions {
  /** Canvas ref for SVGA rendering */
  canvasRef: Ref<HTMLCanvasElement | null>;
  /** SVGA asset URL (reactive) */
  svgaUrl: Ref<string>;
  /** Duration (ms) the announcement stays visible after slide-in */
  stayDuration: number;
  /** Whether the announcement is visible (reactive) */
  visible: Ref<boolean>;
  /** Callback when the announcement should be dismissed */
  onDismiss: () => void;
}

// ============================================
// Composable
// ============================================

/**
 * Encapsulates the slide-in → stay → slide-out animation lifecycle
 * shared by room and app-wide lucky announcements.
 */
export function useLuckyAnnouncementLifecycle(options: AnnouncementLifecycleOptions) {
  const { canvasRef, svgaUrl, stayDuration, visible, onDismiss } = options;

  const animationPhase = ref<AnimationPhase>('enter');
  let stayTimeout: ReturnType<typeof setTimeout> | undefined;

  // SVGA player — auto-starts on mount, triggers exit on completion
  useSvgaPlayer(canvasRef, {
    name: svgaUrl,
    loop: ref(1),
    autoplay: ref(true),
    onComplete: () => {
      startExit();
    },
  });

  // Visibility watcher — drives the enter → stay → exit sequence.
  // immediate: true is essential because the component mounts with visible=true
  // (gated by v-if="announcement" in parent), so a regular watcher would never fire.
  watch(visible, (isVisible) => {
    if (isVisible) {
      animationPhase.value = 'enter';
      // After slide-in animation (600ms), move to stay phase
      setTimeout(() => {
        animationPhase.value = 'stay';
        stayTimeout = setTimeout(() => {
          startExit();
        }, stayDuration);
      }, 600);
    }
  }, { immediate: true });

  /**
   * Trigger the exit animation and dismiss after slide-out.
   */
  function startExit(): void {
    if (animationPhase.value === 'done') return;
    clearTimeout(stayTimeout);
    animationPhase.value = 'exit';
    // After slide-out animation (600ms), dismiss
    setTimeout(() => {
      animationPhase.value = 'done';
      onDismiss();
    }, 600);
  }

  onBeforeUnmount(() => {
    clearTimeout(stayTimeout);
  });

  return { animationPhase };
}
