<script setup lang="ts">
/**
 * Privacy Policy Page
 *
 * Public-facing — no auth required.
 * Required by Google Play Store and OAuth consent screen.
 *
 * TODO: Replace placeholder content with actual privacy policy
 * generated during the Privacy Policy Q&A session (Phase 4).
 */
definePageMeta({
  layout: false,
})

useHead({
  title: 'Privacy Policy — FlyLive',
  meta: [
    { name: 'description', content: 'FlyLive Privacy Policy — how we collect, use, and protect your personal information.' },
  ],
})
</script>

<template>
  <div class="min-h-dvh bg-neutral-900 text-white">
    <!-- Header -->
    <header class="px-6 pt-12 pb-6 safe-area-top border-b border-white/[0.06]">
      <div class="max-w-lg mx-auto">
        <NuxtLink to="/welcome" class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-4 inline-flex items-center gap-1">
          <UIcon name="i-lucide-arrow-left" class="size-3" />
          Back to Home
        </NuxtLink>
        <h1 class="text-2xl font-bold mt-3">Privacy Policy</h1>
        <p class="text-sm text-neutral-500 mt-1">Last updated: May 2026</p>
      </div>
    </header>

    <!-- Content -->
    <main class="px-6 py-8">
      <article class="max-w-lg mx-auto prose prose-invert prose-sm prose-neutral">
        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">1. Introduction</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            FlyLive ("we", "our", "us") operates the FlyLive mobile application and website
            (flyliveapp.com). This Privacy Policy explains how we collect, use, disclose,
            and safeguard your information when you use our service.
          </p>
          <p class="text-neutral-400 text-sm leading-relaxed mt-2">
            By using FlyLive, you agree to the collection and use of information in accordance
            with this policy. If you do not agree, please do not use our service.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">2. Information We Collect</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            We collect information you provide directly, including:
          </p>
          <ul class="text-neutral-400 text-sm space-y-1 mt-2 list-disc pl-5">
            <li>Name and profile information</li>
            <li>Phone number and country</li>
            <li>Email address (optional, via social login)</li>
            <li>Date of birth and gender</li>
            <li>Profile photos and room images</li>
            <li>Transaction and virtual currency data</li>
          </ul>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">3. Account Deletion</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            You can delete your account at any time through the app's profile settings.
            Upon deletion, your account enters a 30-day grace period during which you
            can contact support to cancel. After 30 days, your personal data is permanently
            deleted from our servers, except for transaction records retained for legal compliance.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">4. Contact Us</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            For privacy-related questions, contact us at:
            <a href="mailto:support@flyliveapp.com" class="text-primary hover:underline">support@flyliveapp.com</a>
          </p>
        </section>

        <!-- Placeholder notice -->
        <div class="mt-8 p-4 rounded-xl bg-amber-950/30 border border-amber-800/30">
          <p class="text-amber-400 text-xs">
            <strong>Note:</strong> This is a preliminary privacy policy. A comprehensive version
            covering all data practices, third-party services, and international data transfers
            will be published before the app's public release on the Google Play Store.
          </p>
        </div>
      </article>
    </main>
  </div>
</template>
