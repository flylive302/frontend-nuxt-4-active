<script setup lang="ts">
import { getGenderInfo } from '~/utils/gender'
import { getAge } from '~/utils/date'
import type { MinimalUser } from '~/types/user/bootstrap'
import { useSlots } from 'vue';
import MarqueeName from "~/components/common/marquee-name.vue";

const props = defineProps<{
  user: MinimalUser
  marqueeDelay?: string
}>()

// ========================================
// Composables
// ========================================

const { getLevelFromXp } = useLevelLookup()
const { resolvePropAsset } = usePropLookup()

const roomStore = useRoomStore();

const slots = useSlots();

// ========================================
// Computed
// ========================================

const wealthLevel = computed(() =>
    getLevelFromXp(props.user.wealth_xp, 'wealth')
)

const charmLevel = computed(() =>
    getLevelFromXp(props.user.charm_xp, 'charm')
)

const genderColor = computed(() =>
  getGenderInfo(props.user.gender).color as 'primary' | 'secondary' | 'tertiary' | 'neutral'
)

</script>

<template>
  <div class="overflow-hidden relative rounded-lg bg-linear-to-bl to-neutral-950 border-2 border-neutral-700 shadow-md shadow-neutral-900">

    <div class="flex">
      <UserAvatar
        :img="user.avatar"
        animated
        :frame-asset-url="resolvePropAsset(user.frame_id) ?? undefined"
        class="w-14 ml-1 shrink-0"
        @click="async () => {
          roomStore.minimizeRoom();
          navigateTo(`/profile/${user.signature}`);
        }"
      />

      <div class="flex flex-col justify-center min-h-full px-2 flex-1 min-w-0 py-1">
        <div class="flex items-center gap-1 min-w-0">
          <MarqueeName
            class="flex-1 max-w-24"
            text-class="text-sm leading-none font-semibold"
            :name="user.name"
            :delay="marqueeDelay"
          />
          <UBadge
              :color="genderColor"
              :icon="getGenderInfo(user.gender).icon"
              size="xs"
              square
              class="text-secondary-100 text-shadow-xs pr-1 py-0.5 rounded-md gap-1 font-bold shrink-0"
          >
            {{ getAge(user.date_of_birth) }}
          </UBadge>
        </div>
        <div class="flex items-center gap-0.5 ">
          <ProfileBadge :txt="user.signature" :vip="user.vip_level" class="shrink-0 max-w-24" />
          <UIcon
            v-if="user.country"
            :name="`i-flag-${user.country.toLowerCase().trim()}-4x3`"
            class="rounded overflow-hidden h-5 size-6 shadow-lg"
          />
          <img v-if="wealthLevel.badge" :src="wealthLevel.badge.image_url" class="h-5" alt="users wealth badge" >
          <img v-if="user.vip_level" :src="`https://ik.imagekit.io/flylive/vip/${user.vip_level}/badge.png`" class="w-9" alt="" >
          <img v-if="charmLevel.badge" :src="charmLevel.badge.image_url" class="h-4 ml-1" alt="users charm badge" >
        </div>

        <BadgesEquippedBadgeMarquee
          v-if="user.equipped_badges?.length"
          :equipped-badges="user.equipped_badges"
          class="max-w-24"
        />
      </div>

      <div v-if="slots.default" class="flex flex-col justify-center min-h-full shrink-0">
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
