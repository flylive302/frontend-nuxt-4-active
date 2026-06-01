<script setup lang="ts">
import { useReporting, type ReportableType, type ReportReason } from '~/composables/user/useReporting'

const REASON_OPTIONS: { label: string; value: ReportReason }[] = [
  { label: 'Harassment or Bullying', value: 'harassment' },
  { label: 'Spam or Scam', value: 'spam' },
  { label: 'Inappropriate Content', value: 'inappropriate_content' },
  { label: 'Impersonation', value: 'impersonation' },
  { label: 'Hate Speech or Discrimination', value: 'hate_speech' },
  { label: 'Other', value: 'other' },
]

const props = defineProps<{
  open: boolean
  reportableType: ReportableType
  reportableId: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submitted: []
}>()

const { submitReport } = useReporting()

const reason = ref<ReportReason | undefined>(undefined)
const description = ref('')
const isSubmitting = ref(false)

watch(() => props.open, (open) => {
  if (open) {
    reason.value = undefined
    description.value = ''
  }
})

async function handleSubmit(): Promise<void> {
  if (!reason.value) return

  isSubmitting.value = true
  const ok = await submitReport({
    reportableType: props.reportableType,
    reportableId: props.reportableId,
    reason: reason.value,
    description: description.value,
  })
  isSubmitting.value = false

  if (ok) {
    emit('update:open', false)
    emit('submitted')
  }
}
</script>

<template>
  <UModal
      :open="open"
      title="Report"
      :ui="{ content: 'bg-neutral-900 border border-white/10' }"
      @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-neutral-400">
          Help us keep FlyLive safe. Select the reason for your report.
        </p>

        <USelect
            v-model="reason"
            :items="REASON_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Select a reason"
            class="w-full"
        />

        <UTextarea
            v-model="description"
            placeholder="Additional details (optional)"
            :rows="3"
            :maxlength="500"
            class="w-full"
        />

        <p class="text-xs text-neutral-500">
          We review all reports within 24 hours. Submitting false reports is a violation of our Terms of Service.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
            variant="ghost"
            color="neutral"
            class="flex-1"
            @click="$emit('update:open', false)"
        >
          Cancel
        </UButton>
        <UButton
            color="error"
            class="flex-1"
            :disabled="!reason"
            :loading="isSubmitting"
            @click="handleSubmit"
        >
          Submit Report
        </UButton>
      </div>
    </template>
  </UModal>
</template>
