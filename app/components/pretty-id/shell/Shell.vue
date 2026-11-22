<script setup lang="ts">
/**
 * Common frame of both Pretty ID layouts (`pretty-id` = the three tabs,
 * `pretty-id-sub` = lot / search / winners / weekly): the theme root, the
 * phone-width marble column, and the overlays that can open from any event
 * page — claim confirm, "ID taken", the celebration and the dev panel.
 *
 * Loads `me` once on entry; every page under it reads the store. If that first
 * load fails there is nothing to render, so the page gives way to a retry screen.
 */
import { PRETTY_ID_THEME_COLOR } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'

const store = usePrettyIdStore()
const { loadMe } = usePrettyIdData()

useThemeColor(PRETTY_ID_THEME_COLOR)

onMounted(() => {
  void loadMe()
})
</script>

<template>
  <PrettyIdTheme class="pid-shell">
    <div class="pid-shell__column">
      <PrettyIdLoadError v-if="store.isMeFailed" :retrying="store.isMeLoading" @retry="loadMe" />
      <slot v-else />
    </div>

    <PrettyIdClaimModal />
    <PrettyIdRaceModal />
    <PrettyIdCelebration />
    <PrettyIdDevPanel />
  </PrettyIdTheme>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* Letterbox colour either side of the column on a wide screen. */
  .pid-shell {
    min-height: 100dvh;
    background: var(--pid-bg-deep);
  }

  .pid-shell__column {
    position: relative;
    max-width: 480px;
    min-height: 100dvh;
    margin: 0 auto;
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    overflow-x: clip;
    background: var(--pid-bg) var(--pid-img-marble) center / 420px repeat;
  }
}
</style>
