<script setup lang="ts">
import {
  CP_PROFILE_FRAME_BINDER_KEY,
  CP_PROFILE_FRAME_PARTNER_KEY,
  CP_PROFILE_FRAME_SVGA,
} from '~/constants/cp-event'
import { cpProfilePath } from '~/utils/cp'
import { formatCurrency } from '~/utils/currency'
import { avatarImageSrc } from '~/utils/imagekit'

// "Cp RelationShips" block on the regular profile pages. Renders nothing while
// the CP event is off; fetches the profile only once the block scrolls into view.

const props = defineProps<{
  signature: string | null | undefined
}>()

const bootstrapStore = useBootstrapStore()
const rootRef = ref<HTMLElement | null>(null)
const signatureRef = computed(() => props.signature)

const { frameAnimationEnabled } = useFrameAnimationBudget()
const { isVisible } = useDeferredVisibility(rootRef, true)
const { profile, status } = useCpProfile(signatureRef, isVisible)

const topPair = computed(() => profile.value?.top_pair ?? null)

// Pair avatars into the banner's image slots, same URL variant as the avatar
// cards. No pair → empty URLs → the baked placeholders show.
const frameAvatars = computed(() => ({
  [CP_PROFILE_FRAME_BINDER_KEY]: avatarImageSrc(topPair.value?.binder.avatar),
  [CP_PROFILE_FRAME_PARTNER_KEY]: avatarImageSrc(topPair.value?.partner.avatar),
}))
// Mount once the profile has settled, so the banner doesn't play empty and
// then restart when the avatars arrive.
const profileSettled = computed(() => status.value !== 'idle' && status.value !== 'loading')
</script>

<template>
  <div v-if="bootstrapStore.cpEnabled && signature" ref="rootRef" class="w-full mb-3">
    <NuxtLink :to="cpProfilePath(signature)" class="flex justify-between">
      <SectionTitle>Cp RelationShips</SectionTitle>
      <!-- Decorative: the whole row is the (labelled) link. Mirrors UButton soft/md icon-only. -->
      <span class="inline-flex items-center justify-center rounded-md p-1.5 text-primary bg-primary/10" aria-hidden="true">
        <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0" />
      </span>
    </NuxtLink>

    <NuxtLink v-if="topPair" :to="cpProfilePath(signature)" class="block">
      <!-- Animated pair banner: live only on capable devices, only while on-screen.
           Devices without the animation budget get the static pair row instead. -->
      <SvgaPlayer
          v-if="frameAnimationEnabled && isVisible && profileSettled"
          :name="CP_PROFILE_FRAME_SVGA"
          :replace-elements="frameAvatars"
      />
      <CpEventCouplePair v-else-if="!frameAnimationEnabled" :pair="topPair" variant="row" />
      <p class="text-center text-xs">{{ topPair.days }} days · ❤️ {{ formatCurrency(topPair.lifetime_intimacy) }}</p>
    </NuxtLink>
    <p v-else-if="status === 'ready'" class="py-2 text-center text-sm">No CP yet</p>
    <p v-else-if="status === 'blocked'" class="py-2 text-center text-sm">Unavailable</p>
  </div>
</template>
