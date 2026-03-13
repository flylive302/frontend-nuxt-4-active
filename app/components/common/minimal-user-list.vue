<script setup lang="ts">
import { getGenderInfo } from '~/utils/gender'
import { getAge } from '~/utils/date'
import type { MinimalUser } from '~/types/user/bootstrap'
import { useSlots } from 'vue';

const props = defineProps<{
  user: MinimalUser
}>()



// ========================================
// Composables
// ========================================

const bootstrapStore = useBootstrapStore()

const roomStore = useRoomStore();

const slots = useSlots();

// ========================================
// Refs
// ========================================

const nameRef = ref<HTMLElement | null>(null)
const isOverflowing = useTextOverflow(nameRef)

// ========================================
// Computed
// ========================================

/**
 * Get wealth level info from user's XP.
 */
const wealthLevel = computed(() =>
    bootstrapStore.getLevelFromXp(props.user.wealth_xp, 'wealth')
)

/**
 * Get charm level info from user's XP.
 */
const charmLevel = computed(() =>
    bootstrapStore.getLevelFromXp(props.user.charm_xp, 'charm')
)

</script>

<template>
  <div class="overflow-hidden relative rounded-lg bg-linear-to-bl to-neutral-950 border-2 border-neutral-700 shadow-md shadow-neutral-900">

    <div class="flex grow shadow-lg shadow-primary/10 pb-1">
      <UserAvatar 
        :img="user.avatar" 
        animated 
        :frame-asset-url="user.frame ?? undefined" 
        class="w-14 ml-1"
        @click="async () => {
          roomStore.minimizeRoom();
          navigateTo(`/profile/${user.signature}`);
        }" 
      />

      <div class="flex flex-col justify-center min-h-full px-2">
        <div class="flex items-center gap-1">
          <h3 ref="nameRef" class="text-sm font-bold grow leading-tight overflow-hidden" :class="{ 'marquee-container': isOverflowing }">
            <span :class="{ 'marquee-text': isOverflowing }">{{ user.name }}</span>
          </h3>
          <UBadge
              :color="getGenderInfo(user.gender).color as 'primary' | 'secondary' | 'tertiary' | 'neutral'"
              :icon="getGenderInfo(user.gender).icon"
              size="xs"
              square
              class="text-secondary-100 text-shadow-xs pr-1 py-0.5 rounded-md gap-1 font-bold"
          >
            {{ getAge(user.date_of_birth) }}
          </UBadge>
        </div>
        <div class="flex items-center gap-1 mt-1">
          <ProfileBadge :txt="user.signature" :show-badge="false" />
          <ProfileBadge
              v-if="wealthLevel.badge"
              :badge-src="wealthLevel.badge.image_url"
              color="tertiary"
              :txt="String(wealthLevel.level)"
          />
          <ProfileBadge
              v-if="charmLevel.badge"
              :badge-src="charmLevel.badge.image_url"
              color="secondary"
              :txt="String(charmLevel.level)"
          />
        </div>
      </div>

      <div v-if="slots.default" class="flex flex-col justify-center min-h-full">
        <slot />
      </div>
    </div>

    <div v-if="slots.actions">
      <slot name="actions"/>
    </div>
  </div>
</template>

<style scoped>

</style>