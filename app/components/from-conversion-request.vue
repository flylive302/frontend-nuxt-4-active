<!-- ~/components/from-conversion-request.vue -->
<!-- Coin Request Form - Creates coin requests using the user's default reseller -->
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch, toRef } from 'vue'
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Colors } from '~/types/colors'
import type { CoinRequest } from '~/types/coin-request'
import { useCoinRequests } from '~/composables/useCoinRequests'
import { useColorClasses } from '~/composables/useColorClasses'

// ========================================
// Props & Emits
// ========================================
const props = withDefaults(defineProps<{
  color?: Colors
  disabled?: boolean
}>(), {
  color: 'tertiary',
  disabled: false
})

const color = toRef(props, 'color')
const { borderClass, emphasisClass } = useColorClasses(color)

const emit = defineEmits<{
  (e: 'success', request: CoinRequest): void
  (e: 'error', payload: { message: string; details?: unknown }): void
}>()

// ========================================
// Schema (amount ≥1, optional message, max 3 proofs)
// ========================================
const imageFile = z.instanceof(File, { message: 'Only image files are allowed' })
  .refine(f => /^image\//.test(f.type), 'Only image files are allowed')
  .refine(f => f.size <= 5 * 1024 * 1024, 'Each file must be ≤ 5MB')

const schema = z.object({
  amount: z.coerce.number()
    .refine(val => !Number.isNaN(val), 'Invalid number')
    .int('Must be a whole number')
    .gte(1, 'Minimum amount is 1'),
  message: z.string().trim().max(1000, 'Message too long').optional(),
  proofs: z.array(imageFile).max(3, 'Up to 3 images only').optional()
})

type Schema = z.infer<typeof schema>

// ========================================
// State
// ========================================
const state = reactive<Schema>({
  amount: 100,
  message: undefined,
  proofs: []
})
const initialState: Schema = { amount: 100, message: undefined, proofs: [] }

const formRef = ref<{ validate: () => unknown; clear: () => void } | null>(null)
const showSuccess = ref(false)
const formError = ref('')
const serverFieldErrors = reactive<Record<string, string[]>>({})
const isSubmitting = ref(false)
let abortController: AbortController | null = null

// ========================================
// Composables
// ========================================
const { createRequest, normalizeError } = useCoinRequests()
const toast = useToast()
const uiColor = computed(() => color.value)

// ========================================
// Live Validation (debounced)
// ========================================
let handle: number | undefined
watch(state, () => {
  if (handle) clearTimeout(handle)
  handle = window.setTimeout(() => formRef.value?.validate(), 250)
}, { deep: true })

// ========================================
// Form Submission
// ========================================
async function onSubmit(e: FormSubmitEvent<Schema>) {
  if (props.disabled || isSubmitting.value) return

  formError.value = ''
  // Clear field errors by setting to empty object
  for (const key of Object.keys(serverFieldErrors)) {
    serverFieldErrors[key] = []
  }
  isSubmitting.value = true
  abortController = new AbortController()

  try {
    const response = await createRequest({
      amount: e.data.amount,
      message: e.data.message || undefined,
      proofs: e.data.proofs?.length ? e.data.proofs : undefined
    })

    if (response.status === 'success' && response.data) {
      toast.add({
        title: 'Coin request created!',
        description: `Requested ${response.data.amount} coins`,
        color: 'success'
      })

      // Reset form
      Object.assign(state, initialState, { proofs: [] })
      formRef.value?.clear()
      showSuccess.value = true

      emit('success', response.data)
    }
  } catch (error: unknown) {
    const normalized = normalizeError(error)
    formError.value = normalized.message

    // Map field errors (422) under inputs
    if (normalized.fieldErrors) {
      for (const [k, v] of Object.entries(normalized.fieldErrors)) {
        serverFieldErrors[k] = v
      }
    }

    toast.add({ title: 'Error', description: normalized.message, color: 'error' })
    emit('error', { message: normalized.message, details: normalized })
  } finally {
    isSubmitting.value = false
    abortController = null
  }
}

function submitAnother() {
  showSuccess.value = false
  formError.value = ''
  // Clear field errors
  for (const key of Object.keys(serverFieldErrors)) {
    serverFieldErrors[key] = []
  }
}

onBeforeUnmount(() => {
  abortController?.abort()
})
</script>

<template>
  <div>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <UForm
        v-if="!showSuccess"
        ref="formRef"
        :schema="schema"
        :state="state"
        :ui="{ wrapper: 'space-y-4' }"
        :class="[borderClass, emphasisClass]"
        class="space-y-4 rounded-lg shadow-lg border-2 p-3"
        @submit="onSubmit"
      >
        <UAlert
          v-if="formError"
          icon="i-lucide-alert-triangle"
          color="error"
          variant="subtle"
          :description="formError"
          class="mb-2"
          aria-live="assertive"
        />

        <UFormField label="Amount (Coins)" name="amount" hint="Minimum 1 coin">
          <UInputNumber
            v-model="state.amount"
            :min="1"
            :step="1"
            :disabled="disabled || isSubmitting"
            :color="uiColor"
            placeholder="100"
            orientation="vertical"
            class="w-full"
            required
          />
          <p v-if="serverFieldErrors['amount']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['amount'][0] }}
          </p>
        </UFormField>

        <UFormField label="Message (optional)" name="message" hint="Max 1000 characters">
          <UTextarea
            v-model="state.message"
            :disabled="disabled || isSubmitting"
            :color="uiColor"
            :rows="2"
            class="w-full"
            placeholder="Add a note for the reseller..."
          />
          <p v-if="serverFieldErrors['message']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['message'][0] }}
          </p>
        </UFormField>

        <UFormField label="Proof Images (optional)" name="proofs" hint="Max 3 images, 5MB each">
          <UFileUpload
            v-model="state.proofs"
            multiple
            highlight
            :color="uiColor"
            accept="image/jpeg,image/png,image/webp"
            :disabled="disabled || isSubmitting"
            class="w-full min-h-32"
          />
          <div v-if="state.proofs?.length" class="mt-2 flex flex-wrap gap-2">
            <UBadge
              v-for="f in state.proofs"
              :key="f.name + f.size"
              variant="soft"
              color="neutral"
            >
              {{ f.name }}
            </UBadge>
          </div>
          <p v-if="serverFieldErrors['proofs']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['proofs'][0] }}
          </p>
          <p v-if="serverFieldErrors['proofs.0']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['proofs.0'][0] }}
          </p>
        </UFormField>

        <UButton
          type="submit"
          :color="uiColor"
          :loading="isSubmitting"
          :disabled="disabled || isSubmitting"
          class="w-full justify-center"
          icon="i-lucide-send"
        >
          Submit Request
        </UButton>
      </UForm>
    </Transition>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showSuccess"
        class="rounded-lg border-2 border-success/30 bg-success/5 p-6 text-center"
      >
        <div class="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
          <UIcon name="i-lucide-badge-check" class="h-5 w-5 text-success" />
        </div>
        <p class="text-base font-medium">Request submitted!</p>
        <p class="mt-1 text-sm text-gray-600">
          Your reseller will process your request soon.
        </p>
        <UButton class="mt-4" :color="uiColor" @click="submitAnother">
          Submit another request
        </UButton>
      </div>
    </Transition>
  </div>
</template>
