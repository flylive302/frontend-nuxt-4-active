<script setup lang="ts">
/**
 * Auth Layout
 *
 * Shared shell for login, sign-up, and forgot-password pages.
 * Owns the hero area, social auth buttons, mail/close morph toggle,
 * and the animated form reveal. Pages supply only their form via <slot />.
 *
 * Pages that set `authHeading` in definePageMeta() get the full hero chrome.
 * Pages without it (complete-profile, callback) get a plain slot.
 */

useThemeColor('#E5E5E5')

const route = useRoute()

const authHeading = computed(() => route.meta.authHeading as string | undefined)
const hasHeroChrome = computed(() => !!authHeading.value)

const showForm = ref(false)
</script>

<template>
  <main>
    <template v-if="hasHeroChrome">

      <!-- Hero – height animates via interpolate-size -->
      <div
        class="hero-area p-4 bg-neutral-200 rounded-b-4xl overflow-hidden relative inset-shadow-sm shadow-primary/30"
        :class="{ 'hero-area--collapsed': showForm }"
      >
        <LogoLarge class="mx-auto max-w-64 relative z-10 hero-logo" :class="{ 'hero-logo--small': showForm }"/>
        <AuthScrollingCards />
      </div>

      <h1 class="text-center font-bold text-lg mt-2">{{ authHeading }}</h1>

      <div class="flex mx-8 gap-13 mt-2">
        <AuthSocialAuth class="w-full" />

        <!-- Mail button – morphs into form -->
        <div class="mail-btn-anchor" :class="{ 'mail-btn-anchor--open': showForm }">
          <UButton
            variant="solid"
            color="neutral"
            size="xl"
            :square="true"
            @click="showForm = !showForm"
          >
            <span class="icon-morph">
              <UIcon name="i-lucide-mail" class="size-8 icon-morph__icon" :class="{ 'icon-morph__icon--out': showForm }" />
              <UIcon name="i-lucide-x"    class="size-8 icon-morph__icon icon-morph__icon--x" :class="{ 'icon-morph__icon--in': showForm }" />
            </span>
          </UButton>
        </div>
      </div>

      <!-- Form panel – grid-row trick for smooth height -->
      <div class="form-reveal" :class="{ 'form-reveal--open': showForm }">
        <div class="form-reveal__inner mx-8">
          <USeparator color="primary" class="my-4" label="OR" />
          <slot />
        </div>
      </div>

    </template>

    <!-- Plain slot for pages without hero chrome (complete-profile, callback) -->
    <slot v-else />
  </main>
</template>

<style scoped>
/* ── Hero collapse ───────────────────────────── */
.hero-area {
  height: 75vh;
  transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: height;
  interpolate-size: allow-keywords;     /* opt-in for keyword interpolation */
  contain: layout style;                /* perf: isolate layout recalc */
}

.hero-area--collapsed {
  height: 30vh;
}

.hero-logo {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top center;
}

.hero-logo--small {
  transform: scale(0.55);
}

/* ── Form reveal (grid-row 0fr → 1fr) ───────── */
.form-reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.4s ease;
  opacity: 0;
}

.form-reveal--open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.form-reveal__inner {
  overflow: hidden;
}

/* ── Mail button anchor (optional subtle scale) ─ */
.mail-btn-anchor {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mail-btn-anchor--open {
  transform: scale(0.95);
}

/* ── Icon crossfade morph ────────────────────── */
.icon-morph {
  position: relative;
  display: grid;
  place-items: center;
}

.icon-morph__icon {
  grid-area: 1 / 1;
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mail icon – visible by default */
.icon-morph__icon--out {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

/* X icon – hidden by default, revealed when --in */
.icon-morph__icon--x {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.icon-morph__icon--in {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}
</style>