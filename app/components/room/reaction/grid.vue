<script setup lang="ts">
/**
 * Reaction Grid — INTENT only. Virtualized 4-column grid of static thumbnail
 * rows, with sticky category section headers. Mirrors the DynamicScroller
 * pattern used by RoomChatPanel / RoomInfo (async-loaded so the scroller
 * chunk + its CSS don't render-block routes that don't need it).
 */
import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import { REACTION_GRID_ROW_MIN_SIZE_PX } from '~/constants/reactions';
import type { ReactionGridRow } from '~/utils/reactionGrid';

const DynamicScroller = defineAsyncComponent(async () => {
  if (import.meta.client) await import('vue-virtual-scroller/dist/vue-virtual-scroller.css');
  return (await import('vue-virtual-scroller')).DynamicScroller as unknown as Component;
});
const DynamicScrollerItem = defineAsyncComponent(async () =>
  (await import('vue-virtual-scroller')).DynamicScrollerItem as unknown as Component
);

const props = defineProps<{
  rows: ReactionGridRow[];
}>();

const emit = defineEmits<{
  select: [code: string];
}>();

interface ScrollerHandle {
  scrollToItem: (index: number) => void;
}

const scroller = ref<ScrollerHandle | null>(null);

function scrollToRow(index: number): void {
  if (index < 0) return;
  scroller.value?.scrollToItem(index);
}

defineExpose({ scrollToRow });

// ========================================
// Sticky section header overlay
// ========================================
// DynamicScroller absolutely-positions each row (transform: translateY), so
// a `position: sticky` element *inside* a row only sticks within that row's
// own box — it scrolls away with it. Real sticky-to-viewport behavior needs
// a floating label rendered outside the virtualized rows, kept in sync with
// whichever header row is at/above the current scroll position.
const stickyCategory = ref<string | null>(null);

function handleScrollerUpdate(startIndex: number): void {
  for (let i = startIndex; i >= 0; i -= 1) {
    const row = props.rows[i];
    if (row?.kind === 'header') {
      stickyCategory.value = row.category;
      return;
    }
  }
  stickyCategory.value = null;
}
</script>

<template>
  <ClientOnly :ssr="false">
    <template #fallback>
      <div class="min-h-32 py-6 text-center text-sm text-white/70">Loading…</div>
    </template>
    <div class="relative">
      <div
        v-if="stickyCategory"
        class="absolute inset-x-0 top-0 z-20 bg-neutral-900/95 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white/60 backdrop-blur"
      >
        {{ stickyCategory }}
      </div>

      <DynamicScroller
        ref="scroller"
        :items="rows"
        key-field="key"
        :min-item-size="REACTION_GRID_ROW_MIN_SIZE_PX"
        class="max-h-[50vh] overflow-y-auto scrollbar-thin"
        @update="handleScrollerUpdate"
      >
        <template #default="{ item, active }">
          <DynamicScrollerItem :item="item" :active="active" :size-dependencies="[item.kind]">
            <div
              v-if="item.kind === 'header'"
              class="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white/60"
            >
              {{ item.category }}
            </div>
            <div v-else class="grid grid-cols-4 gap-1 px-1">
              <RoomReactionCard
                v-for="entry in item.entries"
                :key="entry.code"
                :entry="entry"
                @select="(code) => emit('select', code)"
              />
            </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
    </div>

    <div v-if="rows.length === 0" class="py-8 text-center text-sm text-white/50">
      No reactions match your search
    </div>
  </ClientOnly>
</template>
