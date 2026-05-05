<script setup lang="ts">
useThemeColor('#000002')

const route = useRoute()

const authHeading = computed(() => route.meta.authHeading as string | undefined)
const hasHeroChrome = computed(() => !!authHeading.value)

const showForm = ref(false)

// Defer decorative card carousel until after LCP — browser is idle
const cardsVisible = ref(false)
onMounted(() => {
  const schedule = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 200)
  schedule(() => { cardsVisible.value = true })
})
</script>

<template>
  <main>
    <template v-if="hasHeroChrome">

      <!-- Hero – height animates via interpolate-size -->
      <div
        class="hero-area flex flex-col justify-end bg-neutral-200 rounded-b-4xl overflow-hidden relative animated-gradient"
        :class="{ 'hero-area--collapsed': showForm }"
      >
        <LogoLarge class="mx-auto relative z-20 hero-logo" :class="{ 'hero-logo--small': showForm }"/>
        <Transition name="cards-fade">
          <AuthScrollingCards v-if="cardsVisible" />
        </Transition>
      </div>

      <h1 class="text-center font-bold text-lg mt-4">{{ authHeading }}</h1>

      <div class="flex mx-8 gap-13 mt-2">
        <AuthSocialAuth class="w-full" />

        <!-- Mail button – morphs into form -->
        <div class="mail-btn-anchor rounded-lg aspect-square glowing-border" :class="{ 'mail-btn-anchor--open': showForm }">
          <UButton
            variant="solid"
            color="neutral"
            class="inset-shadow-sm inset-shadow-neutral-950/50"
            size="xl"
            :square="true"
            :aria-label="showForm ? 'Close email sign-in form' : 'Sign in with Email'"
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
  transform: translateY(5%);
}

.hero-logo--small {
  transform: translateY(33%) scale(0.70);
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

.animated-gradient::before,
.animated-gradient::after{
  content:"";
  position:absolute;
  inset:-30%;
  background:
      radial-gradient(60% 60% at 50% 50%, var(--gradient-primary-soft), transparent 50%),
      radial-gradient(50% 50% at 70% 60%, var(--gradient-secondary-soft), transparent 70%),
      radial-gradient(60% 60% at 40% 80%, var(--gradient-info-soft), transparent 70%),
      radial-gradient(50% 50% at 30% 40%, var(--gradient-tertiary-soft), transparent 40%),
      linear-gradient(180deg, var(--color-neutral-900), var(--color-neutral-950));

  animation:move 18s ease-in-out infinite alternate;
  will-change:transform;
  filter: blur(50px) saturate(120%);
}

@keyframes move {
  0%{transform:translate(-10%,-10%) scale(1)}
  30%{transform:translate(20%,10%) scale(1.5)}
  50%{transform:translate(-20%,15%) scale(1.1)}
  70%{transform:translate(10%,-10%) scale(1.9)}
  100%{transform:translate(-5%,10%) scale(1)}
}

/* Cards fade-in after idle */
.cards-fade-enter-active { transition: opacity 0.6s ease; }
.cards-fade-enter-from   { opacity: 0; }
</style>