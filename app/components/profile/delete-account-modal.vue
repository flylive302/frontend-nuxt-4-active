<script setup lang="ts">
// ========================================
// Delete Account Modal
// ========================================
// Two-step GDPR-compliant warning modal for account deletion.
// Step 1: Information disclosure (what's deleted vs retained)
// Step 2: Confirmation (type DELETE + optional reason)

// ========================================
// Props & Emits
// ========================================

interface Props {
  /** Whether the modal is visible */
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// ========================================
// Composables
// ========================================

const { deleteAccount, isDeleting } = useAccountDeletion()

// ========================================
// State
// ========================================

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const GRACE_PERIOD_DAYS = 30

/** Current step: 'info' or 'confirm' */
const step = ref<'info' | 'confirm'>('info')

/** Confirmation text — must type DELETE */
const confirmText = ref('')

/** Optional deletion reason */
const reason = ref('')

// ========================================
// Computed
// ========================================

const isConfirmValid = computed(() => confirmText.value === 'DELETE')

// ========================================
// Actions
// ========================================

function handleClose(): void {
  isOpen.value = false
  // Reset state on close
  step.value = 'info'
  confirmText.value = ''
  reason.value = ''
}

function proceedToConfirm(): void {
  step.value = 'confirm'
}

function goBackToInfo(): void {
  step.value = 'info'
}

async function handleDelete(): Promise<void> {
  if (!isConfirmValid.value || isDeleting.value) return

  try {
    await deleteAccount(reason.value || undefined)
    handleClose()
  } catch {
    // Error already handled by composable toast
  }
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-3 mx-auto overflow-y-scroll">
        <!-- ============================== -->
        <!-- Step 1: Information & Warning -->
        <!-- ============================== -->
        <template v-if="step === 'info'">
          <!-- Header -->
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/50 border border-red-900/30">
                <UIcon name="i-lucide-alert-triangle" class="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-white">
                  Delete Your Account
                </h3>
                <p class="text-sm text-neutral-400">
                  This action cannot be undone after {{ GRACE_PERIOD_DAYS }} days
                </p>
              </div>
            </div>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              size="sm"
              @click="handleClose"
            />
          </div>

          <!-- Grace Period Notice -->
          <div class="mb-5 rounded-lg bg-amber-950/30 border border-amber-800/30 p-3">
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-clock" class="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p class="text-sm font-medium text-amber-300">{{ GRACE_PERIOD_DAYS }}-Day Grace Period</p>
                <p class="text-xs text-amber-400/70 mt-1">
                  Your account will be deactivated immediately but your data won't be permanently deleted for {{ GRACE_PERIOD_DAYS }} days.
                  Contact support within this period to cancel.
                </p>
              </div>
            </div>
          </div>

          <!-- What Gets Deleted -->
          <div class="mb-4">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-red-400 mb-2">
              <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
              Permanently Deleted After {{ GRACE_PERIOD_DAYS }} Days
            </h4>
            <ul class="space-y-1.5 text-sm text-neutral-400 pl-6">
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-red-400 shrink-0" />
                Your name, email, phone number, and date of birth
              </li>
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-red-400 shrink-0" />
                Avatar and cover photos (removed from our servers)
              </li>
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-red-400 shrink-0" />
                Room images (logo and background)
              </li>
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-red-400 shrink-0" />
                Social connections (followers and following)
              </li>
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-red-400 shrink-0" />
                VIP membership and all account balances
              </li>
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-red-400 shrink-0" />
                Linked social accounts and login credentials
              </li>
            </ul>
          </div>

          <!-- What Gets Retained -->
          <div class="mb-5">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-2">
              <UIcon name="i-lucide-shield-check" class="h-4 w-4" />
              Retained for Legal Compliance
            </h4>
            <ul class="space-y-1.5 text-sm text-neutral-400 pl-6">
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                Transaction history (required by tax and financial regulations)
              </li>
              <li class="flex items-center gap-2">
                <span class="h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                Your unique signature ID (for financial audit trails)
              </li>
            </ul>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2">
            <UButton
              block
              color="error"
              variant="subtle"
              icon="i-lucide-arrow-right"
              @click="proceedToConfirm"
            >
              I Understand, Continue
            </UButton>
            <UButton
              block
              variant="outline"
              color="neutral"
              @click="handleClose"
            >
              Cancel
            </UButton>
          </div>
        </template>

        <!-- ============================== -->
        <!-- Step 2: Confirmation -->
        <!-- ============================== -->
        <template v-if="step === 'confirm'">
          <!-- Header -->
          <div class="flex items-start justify-between mb-5">
            <div class="flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-950/50 border border-red-900/30">
                <UIcon name="i-lucide-shield-alert" class="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-white">
                  Confirm Deletion
                </h3>
                <p class="text-sm text-neutral-400">
                  Final step — this will deactivate your account
                </p>
              </div>
            </div>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              size="sm"
              @click="handleClose"
            />
          </div>

          <!-- Reason (optional) -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-neutral-300 mb-1.5">
              Reason for leaving
              <span class="text-neutral-500">(optional)</span>
            </label>
            <textarea
              v-model="reason"
              rows="2"
              maxlength="500"
              placeholder="Help us improve — tell us why you're leaving..."
              class="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none resize-none"
            />
          </div>

          <!-- Type DELETE -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-neutral-300 mb-1.5">
              Type <span class="font-mono text-red-400 font-bold">DELETE</span> to confirm
            </label>
            <input
              v-model="confirmText"
              type="text"
              placeholder="Type DELETE here"
              autocomplete="off"
              class="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none font-mono tracking-wider"
              :class="{ 'border-red-500/50': confirmText.length > 0 && !isConfirmValid }"
            >
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2">
            <UButton
              block
              color="error"
              icon="i-lucide-trash-2"
              :disabled="!isConfirmValid || isDeleting"
              :loading="isDeleting"
              @click="handleDelete"
            >
              {{ isDeleting ? 'Deleting Account...' : 'Delete My Account' }}
            </UButton>
            <UButton
              block
              variant="outline"
              color="neutral"
              icon="i-lucide-arrow-left"
              :disabled="isDeleting"
              @click="goBackToInfo"
            >
              Go Back
            </UButton>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
