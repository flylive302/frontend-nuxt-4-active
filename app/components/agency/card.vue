<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import type { AgencyStatus } from '~/types/agency/agency'
import { AGENCY_STATUS_CONFIG } from '~/types/agency/agency'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  id: string
  name: string
  members?: number
  countryCode?: string
  avatar?: string
  status?: AgencyStatus
}>(), {
  members: 0,
  countryCode: 'us',
  avatar: undefined,
  status: 'approved',
})

// ========================================
// Computed
// ========================================

const statusConfig = computed(() => AGENCY_STATUS_CONFIG[props.status])

const flagIcon = computed(() => getFlagIcon(props.countryCode))

const avatarSrc = computed(() =>
  // Helper no-ops on the Dicebear fallback (not an ImageKit host), so wrapping the whole
  // expression is safe and keeps the agency logo from being served at full resolution.
  withImageKitTransform(props.avatar, { w: 256 })
  || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(props.name)}`
)

const isApproved = computed(() => props.status === 'approved')
</script>

<template>
  <NuxtLink 
    :to="`/agency/${id}`" 
    class="rounded-lg overflow-hidden border-2 transition-all"
    :class="[
      isApproved ? 'border-primary hover:border-primary/80' : 'border-muted opacity-75'
    ]"
  >
    <!-- Logo -->
    <div class="relative">
      <NuxtImg 
        :src="avatarSrc" 
        :alt="name"
        class="aspect-square object-cover w-full"
      />
      
      <!-- Status Badge (for non-approved) -->
      <div
        v-if="!isApproved"
        class="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-semibold"
        :class="[
          statusConfig.color === 'warning' ? 'bg-warning/90 text-warning-foreground' : '',
          statusConfig.color === 'error' ? 'bg-error/90 text-error-foreground' : '',
          statusConfig.color === 'neutral' ? 'bg-muted/90 text-muted-foreground' : '',
        ]"
      >
        {{ statusConfig.label }}
      </div>
    </div>
    
    <!-- Info -->
    <div class="p-2 bg-gradient-to-br from-transparent to-primary/40">
      <h2 class="text-base font-bold truncate">{{ name }}</h2>
      <div class="flex justify-between items-center mt-1">
        <icon :name="flagIcon" class="size-8 rounded overflow-hidden h-6 shadow-md shadow-primary/50" />
        <p class="text-2xl font-bold flex gap-2 leading-none items-center">
          <icon class="size-6" name="i-lucide-users" />
          {{ members }}
        </p>
      </div>
    </div>
  </NuxtLink>
</template>