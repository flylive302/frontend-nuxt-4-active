<script setup lang="ts">
import { CP_PROFILE_FRAME_SVGA } from '~/constants/cp-event'
import { cpProfilePath } from '~/utils/cp'
import { formatCurrency } from '~/utils/currency'

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
      <CpEventCouplePair :pair="topPair" variant="row" />
      <p class="text-center text-xs">{{ topPair.days }} days · ❤️ {{ formatCurrency(topPair.lifetime_intimacy) }}</p>
    </NuxtLink>
    <p v-else-if="status === 'ready'" class="py-2 text-center text-sm">No CP yet</p>
    <p v-else-if="status === 'blocked'" class="py-2 text-center text-sm">Unavailable</p>

    <!-- Decorative banner: live only on capable devices, only while on-screen -->
    <SvgaPlayer v-if="frameAnimationEnabled && isVisible" :name="CP_PROFILE_FRAME_SVGA" />
  </div>
</template>
