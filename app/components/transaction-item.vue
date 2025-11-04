<script setup lang="ts">
import { computed } from 'vue';
import type { BalanceChange } from '@/types/wallet';

interface TimelineDetail {
  label: string;
  value: string;
}

interface TimelineEntry {
  title: string;
  summary?: string;
  details?: TimelineDetail[];
  icon: string;
}

interface TransactionItemProps {
  thumbnail?: string;
  time?: string;
  title?: string;
  itemsInvolved?: string;
  initiator?: string;
  concerned?: string;
  coins?: BalanceChange;
  diamonds?: BalanceChange | null;
  wealthXp?: BalanceChange | null;
  charmXp?: BalanceChange | null;
}

const props = withDefaults(defineProps<TransactionItemProps>(), {
  thumbnail: '/siteAssets/badges/badge-charm-level-1.webp',
  time: '14:30PM',
  title: 'Coins Purchased',
  itemsInvolved: 'Coins Purchased',
  initiator: '[userSignature]',
  concerned: '[userSignature]',
  coins: () => ({
    before: '200',
    after: '- 350',
    total: '+150',
  }),
  diamonds: null,
  wealthXp: null,
  charmXp: null,
});

const buildBalanceEntry = (label: string, balance?: BalanceChange | null): TimelineEntry => {
  if (!balance) {
    return {
      title: `${label} Balance Change`,
      summary: '[No Effect]',
      icon: 'i-lucide-check-check',
    };
  }

  return {
    title: `${label} Balance Change`,
    details: [
      { label: 'Before', value: balance.before },
      { label: 'After', value: balance.after },
      { label: 'Total Change', value: balance.total },
    ],
    icon: 'i-lucide-check-check',
  };
};

const timelineItems = computed<TimelineEntry[]>(() => [
  {
    title: 'Item Involved',
    summary: props.itemsInvolved ?? props.title,
    icon: 'i-lucide-check-check',
  },
  {
    title: 'Initiated by',
    summary: props.initiator,
    icon: 'i-lucide-check-check',
  },
  {
    title: 'Concerned Party',
    summary: props.concerned,
    icon: 'i-lucide-check-check',
  },
  buildBalanceEntry('Coin', props.coins),
  buildBalanceEntry('Diamond', props.diamonds),
  buildBalanceEntry('Wealth XP', props.wealthXp),
  buildBalanceEntry('Charm XP', props.charmXp),
  {
    title: 'Transaction Completed Successfully',
    icon: 'i-lucide-thumbs-up',
  },
]);

const activeTimelineIndex = computed<number | undefined>(() => {
  const { length } = timelineItems.value;
  return length ? length - 1 : undefined;
});
</script>

<template>
  <UCollapsible>
    <div class="grid grid-cols-14 gap-1 bg-primary/20 p-1">
      <NuxtImg
        class="col-span-2 w-full"
        provider="imagekit"
        :src="thumbnail"
        :alt="title"
      />
      <div class="col-span-8">
        <p class="text-sm font-bold leading-tight">{{ title }}</p>
        <div class="flex gap-1 text-muted">
          <p class="w-full truncate text-xs font-bold leading-tight">
            Initiator:
            <br>
            {{ initiator }}
          </p>
          <p class="w-full truncate text-xs font-bold leading-tight">
            Concerned:
            <br>
            {{ concerned }}
          </p>
        </div>
      </div>
      <div class="col-span-4 flex flex-col justify-between">
        <p class="text-xs leading-tight">time: {{ time }}</p>
        <UButton
          block
          class="px-1 shadow-lg"
          icon="i-lucide-coins"
          size="xs"
          trailing-icon="i-lucide-arrow-down"
          variant="subtle"
        >
          {{ coins?.total ?? '--' }}
        </UButton>
      </div>
    </div>
    <template #content>
      <UTimeline
        :default-value="activeTimelineIndex"
        :items="timelineItems"
        :ui="{ indicator: '!text-white p-0 text-xl' }"
        class="p-3"
      >
        <template #title="{ item }">
          <div class="space-y-1">
            <p class="flex justify-between">
              <span class="text-muted">{{ item.title }}</span>
              <span v-if="item.summary">{{ item.summary }}</span>
            </p>
            <p
              v-for="detail in item.details"
              :key="detail.label"
              class="flex justify-between"
            >
              <span class="text-muted">{{ detail.label }}</span>
              <span>{{ detail.value }}</span>
            </p>
          </div>
        </template>
      </UTimeline>
    </template>
  </UCollapsible>
</template>
