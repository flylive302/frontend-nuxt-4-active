<script setup lang="ts">
/**
 * Welcome / Landing Page
 *
 * Public-facing page accessible without authentication.
 * Required for:
 * 1. Google OAuth consent screen verification (homepage URL)
 * 2. Google Play Store listing (website URL)
 * 3. Social auth provider verification
 *
 * This page must NEVER be behind auth middleware.
 */
import { ASSETS } from '~/constants/assets'

definePageMeta({
  layout: false,
})

useHead({
  title: 'FlyLive — Live Audio Rooms & Social Platform',
  meta: [
    { name: 'description', content: 'Join live audio rooms, connect with people worldwide, send gifts, and stream on FlyLive. Your social audio experience starts here.' },
    { name: 'theme-color', content: '#000002' },
  ],
})

useThemeColor('#000002')

const features = [
  {
    icon: 'i-lucide-mic-vocal',
    title: 'Live Audio Rooms',
    description: 'Join or create live audio rooms. Chat, sing, and connect with people from around the world in real time.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: 'i-lucide-gift',
    title: 'Virtual Gifts',
    description: 'Send stunning animated gifts to your favorite hosts. Show love and appreciation with unique collectibles.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  {
    icon: 'i-lucide-crown',
    title: 'VIP Experience',
    description: 'Unlock exclusive badges, animated frames, chat bubbles, and premium features with VIP membership.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: 'i-lucide-users-round',
    title: 'Global Community',
    description: 'Discover rooms by country, follow your favorite creators, and build meaningful connections across borders.',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
  },
]
</script>

<template>
  <div class="min-h-dvh bg-neutral-900 text-white">
    <!-- ─── Hero Section ─── -->
    <header class="relative overflow-hidden">
      <!-- Background gradient -->
      <div class="absolute inset-0 bg-linear-to-b from-primary/20 via-neutral-900/80 to-neutral-900" />
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <div class="relative z-10 px-6 pt-16 pb-12 safe-area-top">
        <!-- Logo -->
        <div class="flex flex-col items-center mb-8">
          <NuxtImg
            :src="ASSETS.LOGO_MAIN"
            alt="FlyLive Logo"
            class="w-34 h-auto mt-12"
            fetchpriority="high"
          />
          <NuxtImg
            :src="ASSETS.LOGO_TEXT"
            alt="FlyLive"
            class="w-28"
            fetchpriority="high"
          />
        </div>

        <!-- Tagline -->
        <h1 class="text-center text-2xl font-bold leading-tight mb-3">
          Your Social Audio
          <span class="text-transparent bg-clip-text bg-linear-to-r from-primary via-pink-400 to-purple-400">
            Experience
          </span>
        </h1>
        <p class="text-center text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto mb-8">
          Join live audio rooms, connect with people worldwide, send gifts, and stream with FlyLive.
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col gap-3 max-w-xs mx-auto">
          <UButton
            to="/log-in"
            size="xl"
            class="w-full justify-center"
            icon="i-lucide-log-in"
          >
            Open FlyLive
          </UButton>
          <UButton
            to="/sign-up"
            size="xl"
            variant="outline"
            color="neutral"
            class="w-full justify-center"
            icon="i-lucide-user-plus"
          >
            Create Account
          </UButton>
        </div>
      </div>
    </header>

    <!-- ─── Features Section ─── -->
    <section class="px-6 py-10">
      <h2 class="text-center text-lg font-semibold mb-6">
        Why FlyLive?
      </h2>
      <div class="grid gap-4 max-w-md mx-auto">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="flex gap-4 items-start p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
        >
          <div
            class="shrink-0 size-11 rounded-xl flex items-center justify-center"
            :class="feature.bg"
          >
            <UIcon :name="feature.icon" class="size-5" :class="feature.color" />
          </div>
          <div>
            <h3 class="font-semibold text-sm mb-1">{{ feature.title }}</h3>
            <p class="text-xs text-neutral-400 leading-relaxed">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── Social Proof / Stats ─── -->
    <section class="px-6 py-8 bg-white/[0.02]">
      <div class="flex justify-around max-w-sm mx-auto">
        <div class="text-center">
          <p class="text-xl font-bold text-primary">18+</p>
          <p class="text-xs text-neutral-500 mt-1">Age Required</p>
        </div>
        <div class="h-8 w-px bg-white/10" />
        <div class="text-center">
          <p class="text-xl font-bold text-primary">🌍</p>
          <p class="text-xs text-neutral-500 mt-1">Global Community</p>
        </div>
        <div class="h-8 w-px bg-white/10" />
        <div class="text-center">
          <p class="text-xl font-bold text-primary">24/7</p>
          <p class="text-xs text-neutral-500 mt-1">Live Rooms</p>
        </div>
      </div>
    </section>

    <!-- ─── Footer ─── -->
    <footer class="px-6 py-8 border-t border-white/[0.06]">
      <div class="max-w-md mx-auto text-center">
        <!-- Legal Links -->
        <nav class="flex justify-center gap-6 mb-4" aria-label="Legal">
          <NuxtLink
            to="/privacy-policy"
            class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Privacy Policy
          </NuxtLink>
          <NuxtLink
            to="/terms-of-service"
            class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Terms of Service
          </NuxtLink>
        </nav>

        <!-- Contact -->
        <p class="text-xs text-neutral-600 mb-2">
          Questions? Reach us at
          <a href="mailto:support@flyliveapp.com" class="text-neutral-400 hover:text-primary transition-colors">
            support@flyliveapp.com
          </a>
        </p>

        <!-- Copyright -->
        <p class="text-xs text-neutral-700">
          &copy; {{ new Date().getFullYear() }} FlyLive. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
</template>
