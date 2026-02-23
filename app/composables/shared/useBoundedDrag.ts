/**
 * Bounded Drag Composable
 *
 * Provides draggable behavior constrained to viewport bounds.
 * Uses useDraggable from @vueuse/core with edge-clamping and
 * automatic re-clamping on window resize.
 */
import { useDraggable, useWindowSize, useElementSize } from '@vueuse/core';

// ========================================
// Types
// ========================================

interface UseBoundedDragOptions {
  /** Minimum padding from screen edges in px (default: 4) */
  edgePadding?: number;
}

// ========================================
// Composable
// ========================================

/**
 * Make an element draggable within viewport bounds.
 *
 * @param options - Configuration options
 * @returns Reactive drag state and helpers
 */
export function useBoundedDrag(options?: UseBoundedDragOptions) {
  const EDGE_PADDING = options?.edgePadding ?? 4;

  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, n));

  const dragEl = ref<HTMLElement | null>(null);
  const { width: winW, height: winH } = useWindowSize();
  const { width: elW, height: elH } = useElementSize(dragEl);

  // Setup draggable with clamped movement on all 4 sides
  const { position, isDragging } = useDraggable(dragEl, {
    initialValue: { x: 0, y: 0 },
    onMove: (pos) => {
      pos.x = clamp(pos.x, EDGE_PADDING, winW.value - elW.value - EDGE_PADDING);
      pos.y = clamp(pos.y, EDGE_PADDING, winH.value - elH.value - EDGE_PADDING);
    },
  });

  // Re-clamp on window resize
  watch([winW, winH], () => {
    if (!dragEl.value) return;

    position.value = {
      x: clamp(position.value.x, EDGE_PADDING, winW.value - elW.value - EDGE_PADDING),
      y: clamp(position.value.y, EDGE_PADDING, winH.value - elH.value - EDGE_PADDING),
    };
  });

  /**
   * Set position with automatic clamping to viewport bounds.
   */
  function setPosition(x: number, y: number) {
    position.value = {
      x: clamp(x, EDGE_PADDING, winW.value - elW.value - EDGE_PADDING),
      y: clamp(y, EDGE_PADDING, winH.value - elH.value - EDGE_PADDING),
    };
  }

  return {
    /** Ref to bind to the draggable element */
    dragEl,
    /** Reactive position { x, y } */
    position,
    /** Set position with automatic viewport clamping */
    setPosition,
    /** Reactive viewport width */
    winW,
    /** Reactive viewport height */
    winH,
    /** Reactive element width */
    elW,
    /** Reactive element height */
    elH,
    /** Whether the user is actively dragging */
    isDragging,
  };
}
