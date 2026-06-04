<script setup lang="ts">
/**
 * Gift Grid
 *
 * Displays gifts in a responsive grid with selection.
 */
import type { Gift } from '~/types/gift/gift';

defineProps<{
  gifts: Gift[];
  selectedGiftId?: number;
  selectedGiftReadiness?: 'idle' | 'checking' | 'ready' | 'error';
}>();

const emit = defineEmits<{
  select: [gift: Gift];
}>();
</script>

<template>
  <div
    class="grid grid-cols-4 gap-2 rounded-t-lg p-2! max-h-[30vh] overflow-y-auto scrollbar-thin"
  >
    <RoomGiftCard
      v-for="gift in gifts"
      :key="gift.id"
      :gift="gift"
      :selected="selectedGiftId === gift.id"
      :readiness="selectedGiftId === gift.id ? selectedGiftReadiness : undefined"
      @click="emit('select', gift)"
    />

    <div v-if="gifts.length === 0" class="col-span-4 text-center py-8 text-gray-400">
      No gifts in this category
    </div>
  </div>
</template>
