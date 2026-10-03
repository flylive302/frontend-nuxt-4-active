/**
 * useVipGlint
 *
 * State for the VIP name glint shared by `<VipName>` and `<MarqueeName>`:
 * the accent colour, whether the glint should be mounted right now, and the
 * CSS variables that drive it (markup + keyframes: `assets/css/main.css`
 * § VIP display name).
 *
 * The glint is mounted only while the name is on screen (shared
 * IntersectionObserver), so off-screen names cost no layers and no animation.
 * Each mount picks up the global phase, so every glint sweeps in step.
 */
import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { VIP_GLINT_PERIOD_MS } from '~/constants/vip'
import { glintPhaseDelayMs } from '~/utils/vip-glint'

/**
 * @param vip VIP level (live — `vip.updated` patches it).
 * @param target Element whose visibility gates the glint.
 * @param alsoObserve Keep observing `target` even without a VIP colour (a
 *   scrolling marquee pauses off-screen too). `inView` is only meaningful
 *   while the colour or this flag is truthy.
 */
export function useVipGlint(
  vip: MaybeRefOrGetter<number | null | undefined>,
  target: Readonly<Ref<HTMLElement | null>>,
  alsoObserve: MaybeRefOrGetter<boolean> = false,
) {
  const { vipNameColor } = useVipNameColor()

  // Computed, not a setup-time snapshot: `vip` changes live
  // (vip.updated socket → authStore.patchVip, or the profile page's syncUser()).
  const color = computed(() => vipNameColor(toValue(vip)))
  const inView = useInViewport(target, () => !!color.value || toValue(alsoObserve))
  const active = computed(() => !!color.value && inView.value)

  // Read the clock only when the glint (re)mounts — never per render.
  const phaseDelayMs = ref(0)
  watch(active, (on) => {
    if (on) phaseDelayMs.value = glintPhaseDelayMs(performance.now(), VIP_GLINT_PERIOD_MS)
  })

  /** On the name host: white text + the colour the glint (and reduced-motion glow) uses. */
  const hostStyle = computed(() => (color.value ? { '--vip-glint-color': color.value } : undefined))

  /** On the `.vip-glint` window; its inner copy inherits the same timing. */
  const glintStyle = computed(() => ({
    '--vip-glint-period': `${VIP_GLINT_PERIOD_MS}ms`,
    '--vip-glint-delay': `${phaseDelayMs.value}ms`,
  }))

  return { color, inView, active, hostStyle, glintStyle }
}
