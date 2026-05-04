<script setup lang="ts">
/**
 * Terms of Service Page
 *
 * Public-facing — no auth required.
 * Required by Google Play Store and OAuth consent screen.
 *
 * TODO: Replace placeholder content with actual terms
 * generated during the Privacy Policy Q&A session (Phase 4).
 */
definePageMeta({
  layout: false,
})

useHead({
  title: 'Terms of Service — FlyLive',
  meta: [
    { name: 'description', content: 'FlyLive Terms of Service — rules and guidelines for using our platform.' },
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
        <h1 class="text-2xl font-bold mt-3">Terms of Service</h1>
        <p class="text-sm text-neutral-500 mt-1">Last updated: May 2026</p>
      </div>
    </header>

    <!-- Content -->
    <main class="px-6 py-8">
      <article class="max-w-lg mx-auto prose prose-invert prose-sm prose-neutral">
        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">1. Acceptance of Terms</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            By accessing or using FlyLive, you agree to be bound by these Terms of Service.
            If you disagree with any part of the terms, you may not access the service.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">2. Age Requirement</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            You must be at least 18 years old to use FlyLive. By creating an account,
            you confirm that you are at least 18 years of age. We do not knowingly
            collect information from anyone under the age of 18.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">3. User Conduct</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            You agree not to engage in any of the following prohibited activities:
          </p>
          <ul class="text-neutral-400 text-sm space-y-1 mt-2 list-disc pl-5">
            <li>Posting or sharing explicit, pornographic, or sexually suggestive content</li>
            <li>Harassment, bullying, or threatening behavior toward other users</li>
            <li>Sharing content that promotes violence, hatred, or discrimination</li>
            <li>Impersonating other users or public figures</li>
            <li>Engaging in fraud, scams, or deceptive practices</li>
            <li>Attempting to exploit, manipulate, or circumvent platform systems</li>
          </ul>
          <p class="text-neutral-400 text-sm leading-relaxed mt-2">
            Violation of these rules will result in immediate and permanent account suspension.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">4. Virtual Currency & Gifts</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            FlyLive features virtual currencies (diamonds, coins) and virtual gifts.
            Virtual currencies have no real-world monetary value and cannot be exchanged
            for real currency except through our official programs. All purchases of
            virtual currency are final and non-refundable.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">5. Account Termination</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            We reserve the right to terminate or suspend your account immediately,
            without prior notice, for conduct that we determine violates these Terms
            or is harmful to other users, us, or third parties. You may delete your
            account at any time through the app settings.
          </p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-white mt-6 mb-3">6. Contact</h2>
          <p class="text-neutral-400 text-sm leading-relaxed">
            Questions about these Terms? Contact us at
            <a href="mailto:support@flyliveapp.com" class="text-primary hover:underline">support@flyliveapp.com</a>
          </p>
        </section>

        <!-- Placeholder notice -->
        <div class="mt-8 p-4 rounded-xl bg-amber-950/30 border border-amber-800/30">
          <p class="text-amber-400 text-xs">
            <strong>Note:</strong> This is a preliminary Terms of Service. A comprehensive version
            will be published before the app's public release on the Google Play Store.
          </p>
        </div>
      </article>
    </main>
  </div>
</template>
