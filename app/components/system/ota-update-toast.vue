<script setup lang="ts">
// ========================================
// OTA Update Toast (Capacitor native only)
// ========================================
// INTENT-only: shows when a downloaded OTA bundle is staged and lets the user
// apply it instantly instead of waiting for the next kill + relaunch.
// All logic lives in useOtaUpdate(); this component just binds to it.

// ========================================
// State
// ========================================

const { pendingUpdate, applyPendingUpdate } = useOtaUpdate()

const isDismissed = ref(false)
const isApplying = ref(false)

const isVisible = computed(() => !!pendingUpdate.value && !isDismissed.value)

// ========================================
// Handlers
// ========================================

async function handleUpdate(): Promise<void> {
  isApplying.value = true
  await applyPendingUpdate()
  // Only reached on failure — success reloads the WebView.
  isApplying.value = false
}

function handleDismiss(): void {
  isDismissed.value = true
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl bg-neutral-900 p-4 shadow-xl ring-1 ring-neutral-800"
    >
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
          <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 text-success" />
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h4 class="text-sm font-medium text-white">
            Update Ready
          </h4>
          <p class="text-xs text-neutral-400">
            A new version of FlyLive is ready to install
          </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <UButton
            size="sm"
            color="success"
            :loading="isApplying"
            @click="handleUpdate"
          >
            Update
          </UButton>
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            @click="handleDismiss"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>
