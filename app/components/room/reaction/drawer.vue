<script setup lang="ts">
/**
 * Reaction Drawer (ADR 0015 / seat-reactions slice 03)
 *
 * WhatsApp-style bottom drawer over the full Reaction Manifest: category
 * tabs + jump-to-section, sticky section headers, search-by-name/tag. All
 * grouping/filtering logic lives in useReactionCatalog + reactionGrid utils
 * — this component only wires them together.
 */
import { useReactionCatalog } from '~/composables/room/useReactionCatalog';
import { useSeatReactions } from '~/composables/room/useSeatReactions';
import { REACTION_GRID_COLUMNS } from '~/constants/reactions';
import {
  buildFlatReactionRows,
  buildSectionedReactionRows,
  findSectionHeaderIndex,
  type ReactionGridRow,
} from '~/utils/reactionGrid';

const isOpen = defineModel<boolean>('open', { default: false });

const { query, sections, categories, isSearching, searchResults } = useReactionCatalog();
const { sendReaction, isSelfSeated, isSelfReactionPlaying } = useSeatReactions();

const activeCategory = ref<string | null>(null);

const sectionedRows = computed<ReactionGridRow[]>(() =>
  buildSectionedReactionRows(sections.value, REACTION_GRID_COLUMNS),
);

const searchRows = computed<ReactionGridRow[]>(() =>
  buildFlatReactionRows(searchResults.value, REACTION_GRID_COLUMNS),
);

const rows = computed(() => (isSearching.value ? searchRows.value : sectionedRows.value));

interface GridHandle {
  scrollToRow: (index: number) => void;
}

const grid = ref<GridHandle | null>(null);

function handleSelectCategory(category: string): void {
  activeCategory.value = category;
  const index = findSectionHeaderIndex(sectionedRows.value, category);
  grid.value?.scrollToRow(index);
}

function handleSelectReaction(code: string): void {
  sendReaction(code);
  isOpen.value = false;
}

// Room-covered signal (room-battery-perf/03): pause seat/frame animation
// behind the drawer while it's open. Auto-released on unmount.
const { cover, uncover } = useRoomCovered();

watch(isOpen, (open) => {
  if (open) {
    cover();
  } else {
    uncover();
  }
  if (!open) {
    query.value = '';
    activeCategory.value = null;
  } else if (activeCategory.value === null && categories.value.length > 0) {
    activeCategory.value = categories.value[0] ?? null;
  }
});
</script>

<template>
  <UDrawer
    v-model:open="isOpen"
    title="Reactions"
    :overlay="false"
    :ui="{
      content: 'bg-transparent bg-neutral-900/80 ring-0',
      handle: 'bg-white!',
    }"
    description="Send a reaction from your Seat"
  >
    <!-- Trigger Button — only while seated, disabled while own reaction plays -->
    <UButton
      v-if="isSelfSeated"
      size="md"
      icon="i-lucide-laugh"
      variant="subtle"
      color="primary"
      class="backdrop-blur-lg text-primary"
      :disabled="isSelfReactionPlaying"
    />

    <template #content>
      <div class="flex flex-col gap-2 p-2">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="Search reactions…"
          size="sm"
          class="w-full"
        />

        <RoomReactionCategoryTabs
          v-if="!isSearching"
          :categories="categories"
          :active-category="activeCategory"
          @select="handleSelectCategory"
        />

        <RoomReactionGrid ref="grid" :rows="rows" @select="handleSelectReaction" />
      </div>
    </template>
  </UDrawer>
</template>
