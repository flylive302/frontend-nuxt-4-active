<script setup lang="ts">
/**
 * Gift Recipient Selector
 *
 * Displays eligible recipients (speakers) with selection toggle.
 * Excludes current user (sender cannot gift themselves).
 */

const giftStore = useGiftStore();

// Get eligible recipients from store (speakers only, excluding self)
const recipients = computed(() => giftStore.eligibleRecipients);
const selectedRecipients = computed(() => giftStore.selectedRecipients);

/**
 * Toggle recipient selection
 */
function toggleRecipient(userId: number) {
  giftStore.toggleRecipient(userId);
}

/**
 * Select all eligible recipients
 */
function selectAll() {
  giftStore.selectAllRecipients();
}

/**
 * Check if a recipient is selected
 */
function isSelected(userId: number): boolean {
  return selectedRecipients.value.includes(userId);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Select All Button -->
    <UButton size="md" square class="rounded-lg size-7 justify-center" @click="selectAll">
      All
    </UButton>

    <!-- Recipient Avatars -->
    <div class="flex items-center gap-1 overflow-x-auto scrollbar-thin w-full">
      <template v-if="recipients.length > 0">
        <div
            v-for="recipient in recipients"
            :key="recipient.id"
            class="shrink-0 cursor-pointer transition-transform focus:scale-105"
            @click="toggleRecipient(recipient.id)"
        >
          <UAvatar
            :src="recipient.avatar || 'https://i.pravatar.cc/150'"
            :alt="recipient.name"
            size="md"
            :class="[
              'border-2 transition-all',
              isSelected(recipient.id)
                ? 'border-primary'
                : 'border-transparent',
            ]"
          />
        </div>
      </template>
      <template v-else>
        <span class="text-xs text-gray-400">No speakers available</span>
      </template>
      <!-- Info Button -->
      <UButton size="sm" variant="subtle" icon="i-lucide-info" />
    </div>
  </div>
</template>
