<script setup lang="ts">
/**
 * Gift SVGA Player
 *
 * Plays SVGA animation gift assets with completion callback. A personalized
 * playback (e.g. the CP bind FX) also fills the file's image and text slots.
 */
import { useSvgaPlayer } from '~/composables/gift/useSvgaPlayer';
import {
  GIFT_SVGA_TEXT_COLOR,
  GIFT_SVGA_TEXT_FONT_FAMILY,
  GIFT_SVGA_TEXT_FONT_WEIGHT,
  GIFT_SVGA_TEXT_MAX_FONT_SIZE,
  GIFT_SVGA_TEXT_MIN_FONT_SIZE,
  GIFT_SVGA_TEXT_PADDING_X,
  GIFT_SVGA_TEXT_SLOT_RATIO,
} from '~/constants/gift';
import { buildSvgaTextFactories } from '~/utils/svga-text-canvas';

const props = withDefaults(
  defineProps<{
    name: string;
    autoplay?: boolean;
    loop?: number;
    /** SVGA image key → URL. */
    replaceElements?: Record<string, string | null | undefined>;
    /** SVGA text key → string, drawn fitted to the key's slot. */
    texts?: Record<string, string>;
  }>(),
  {
    autoplay: true,
    loop: 1, // Play once by default
    replaceElements: undefined,
    texts: undefined,
  }
);

const emit = defineEmits<{
  complete: [];
  /** Heartbeat while playback advances — feeds the queue's stall detector */
  progress: [];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);

// Personalized playback only — a plain gift passes neither, so it keeps
// mounting the shared cached entity untouched. Both are fixed per instance:
// the playback modal keys this player by playback id.
const replaceElements = props.replaceElements
  ? computed(() => props.replaceElements ?? {})
  : undefined;
const textFactories = props.texts
  ? buildSvgaTextFactories(props.texts, {
      color: GIFT_SVGA_TEXT_COLOR,
      fontFamily: GIFT_SVGA_TEXT_FONT_FAMILY,
      fontWeight: GIFT_SVGA_TEXT_FONT_WEIGHT,
      minFontSize: GIFT_SVGA_TEXT_MIN_FONT_SIZE,
      maxFontSize: GIFT_SVGA_TEXT_MAX_FONT_SIZE,
      slotRatio: GIFT_SVGA_TEXT_SLOT_RATIO,
      maxLines: 1,
      lineHeight: 1,
      paddingX: GIFT_SVGA_TEXT_PADDING_X,
    })
  : undefined;

const { restart, isPlaying } = useSvgaPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay'),
  replaceElements,
  dynamicElementFactories: textFactories,
  onComplete: () => {
    emit('complete');
  },
  onProcess: () => {
    emit('progress');
  },
  // One-shot playback whose `complete` gates the gift queue — must never be
  // frozen by the global motion-pause (room-battery-perf/03).
  motionPause: false,
});

// Expose restart method for combo mode
defineExpose({ restart, isPlaying });
</script>

<template>
  <canvas ref="canvas" class="w-full h-full" />
</template>
