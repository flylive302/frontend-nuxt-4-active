<!-- ~/components/from-conversion-request.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch, toRef } from 'vue'
import { z } from 'zod'
import { useSubmitRequest } from '~/composables/useSubmitRequest'
import { toFormData } from '~/utils/toFormData'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Colors } from '~/types/colors'

const props = withDefaults(defineProps<{
  color?: Colors
  apiUrl?: string
  disabled?: boolean
}>(), {
  color: 'tertiary',
  apiUrl: '/form',
  disabled: false
})
const color = toRef(props, 'color')

const emit = defineEmits<{
  (e: 'submitted', payload: { data: SubmitData; response: unknown }): void
  (e: 'error', payload: { message: string; details?: unknown }): void
}>()

/** -------- Schema (message optional) -------- */
const imageFile = z.instanceof(File, { message: 'Only image files are allowed' })
    .refine(f => /^image\//.test(f.type), 'Only image files are allowed')
    .refine(f => f.size <= 2 * 1024 * 1024, 'Each file must be ≤ 2MB')

const schema = z.object({
  number: z.coerce.number()
      .refine(val => !Number.isNaN(val), 'Invalid number') // custom message on failed coercion
      .int('Must be a whole number')
      .nonnegative('Must be non-negative')
      .gte(500, 'Minimum is 500')
      .multipleOf(500, 'Must be in 500 increments'),
  message: z.string().trim().optional(),
  proofs: z.array(imageFile).min(1, 'Attach at least one image').max(5, 'Up to 5 images')
})
type Schema = z.infer<typeof schema>
type SubmitData = { number: number; message?: string; proofs: File[] }

/** -------- State -------- */
const state = reactive<Schema>({
  number: 500,
  message: undefined,
  proofs: []
})
const initialState: Schema = { number: 500, message: undefined, proofs: [] }

const formRef = ref<{ validate: () => unknown; clear: () => void } | null>(null)
const showSuccess = ref(false)
const formError = ref('')
const serverFieldErrors = reactive<Record<string, string[]>>({})

/** -------- Live validation (debounced) -------- */
let handle: number | undefined
watch(state, () => {
  if (handle) clearTimeout(handle)
  handle = window.setTimeout(() => formRef.value?.validate(), 250)
}, { deep: true })

/** -------- Submit integration -------- */
const { submit, abort, isSubmitting, mapError } = useSubmitRequest()
const toast = useToast()

// Use semantic color directly - Nuxt UI components accept semantic colors configured in app.config.ts
const uiColor = computed(() => color.value)

const cardVariants: Record<Colors, { border: string; shadow: string }> = {
  primary: { border: 'border-primary', shadow: 'ring-1 ring-primary/40' },
  secondary: { border: 'border-secondary', shadow: 'ring-1 ring-secondary/40' },
  tertiary: { border: 'border-tertiary', shadow: 'ring-1 ring-tertiary/40' },
  success: { border: 'border-success', shadow: 'ring-1 ring-success/40' },
  info: { border: 'border-info', shadow: 'ring-1 ring-info/40' },
  warning: { border: 'border-warning', shadow: 'ring-1 ring-warning/40' },
  error: { border: 'border-error', shadow: 'ring-1 ring-error/40' }
}

async function onSubmit(e: FormSubmitEvent<Schema>) {
  if (props.disabled || isSubmitting.value) return
  formError.value = ''
  Object.keys(serverFieldErrors).forEach(k => delete serverFieldErrors[k])

  // Build FormData (Laravel-friendly)
  const payloadFD = toFormData({
    number: e.data.number,
    message: e.data.message,
    proofs: e.data.proofs
  })

  try {
    const response = await submit({
      endpoint: props.apiUrl!,
      method: 'POST',
      body: payloadFD,
      asFormData: true,
      retryPost: false
    })

    toast.add({ title: 'Success', description: 'Your request was submitted.', color: 'success' })

    // Reset form state
    Object.assign(state, initialState, { proofs: [] })
    formRef.value?.clear()

    showSuccess.value = true
    emit('submitted', { data: e.data, response })
  } catch (error: unknown) {
    const n = mapError(error)
    formError.value = n.message

    // Map field errors (422) under inputs
    if (n.fieldErrors) {
      for (const [k, v] of Object.entries(n.fieldErrors)) serverFieldErrors[k] = v
    }

    toast.add({ title: 'Error', description: n.message, color: 'error' })
    emit('error', { message: n.message, details: n })
  }
}

function submitAnother() {
  showSuccess.value = false
  formError.value = ''
  Object.keys(serverFieldErrors).forEach(k => delete serverFieldErrors[k])
}

onBeforeUnmount(() => abort())
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
          :class="[cardVariants[color].border, cardVariants[color].shadow]"
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

        <UFormField label="Amount in Local Currency" name="number" hint="Must be ≥ 500 in 500 steps">
          <UInputNumber
              v-model="state.number"
              :min="0"
              :step="500"
              :disabled="disabled || isSubmitting"
              :color="uiColor"
              placeholder="500"
              orientation="vertical"
              class="w-full"
              required
          />
          <p v-if="serverFieldErrors['number']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['number'][0] }}
          </p>
        </UFormField>

        <UFormField label="Message (optional)" name="message">
          <UInput
              v-model="state.message"
              :disabled="disabled || isSubmitting"
              :color="uiColor"
              type="text"
              class="w-full"
              placeholder="Write a short note…"
          />
          <p v-if="serverFieldErrors['message']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['message'][0] }}
          </p>
        </UFormField>

        <UFormField label="Upload Proof of Transaction" name="proofs" hint="Images only. Up to 5 files, 2MB each.">
          <UFileUpload
              v-model="state.proofs"
              multiple
              highlight
              :color="uiColor"
              accept="image/*"
              :disabled="disabled || isSubmitting"
              class="w-full min-h-40"
          />
          <div v-if="state.proofs?.length" class="mt-2">
            <UBadge
                v-for="f in state.proofs"
                :key="f.name + f.size"
                variant="soft"
                color="neutral"
                class="mr-2 mb-2"
            >
              {{ f.name }}
            </UBadge>
          </div>
          <p v-if="serverFieldErrors['proofs']" class="mt-1 text-xs text-error">
            {{ serverFieldErrors['proofs'][0] }}
          </p>
          <!-- Laravel may send proofs.0 errors -->
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
          Submit
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
        <p class="text-base font-medium">Request submitted</p>
        <p class="mt-1 text-sm text-gray-600">
          We’ll update you soon once it’s processed.
        </p>
        <UButton class="mt-4" :color="uiColor" @click="submitAnother">
          Submit another request
        </UButton>
      </div>
    </Transition>
  </div>
</template>
