<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  showStrength?: boolean
}>(), {
  showStrength: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const show = ref(false)
const isFocused = ref(false)

const password = computed({
  get: () => props.modelValue ?? '',
  set: (val) => emit('update:modelValue', val)
})

function checkStrength(str: string) {
  const requirements = [
    { regex: /.{8,}/, text: 'At least 8 characters' },
    { regex: /\d/, text: 'At least 1 number' },
    { regex: /[a-z]/, text: 'At least 1 lowercase letter' },
    { regex: /[A-Z]/, text: 'At least 1 uppercase letter' },
    { regex: /[\W_]/, text: 'At least 1 special character' }
  ]

  return requirements.map(req => ({ met: req.regex.test(str), text: req.text }))
}

const strength = computed(() => checkStrength(password.value))
const score = computed(() => strength.value.filter(req => req.met).length)

const color = computed(() => {
  if (score.value === 0) return 'neutral'
  if (score.value <= 2) return 'error' // 1-2 met
  if (score.value <= 4) return 'warning' // 3-4 met
  return 'success' // 5 met
})

const text = computed(() => {
  if (score.value === 0) return 'Enter a password'
  if (score.value <= 2) return 'Weak password'
  if (score.value <= 4) return 'Medium password'
  return 'Strong password'
})
</script>

<template>
  <div class="space-y-2">
    <UInput
      v-bind="$attrs"
      v-model="password"
      :placeholder="placeholder || 'Password'"
      :color="showStrength ? color : undefined"
      :type="show ? 'text' : 'password'"
      :disabled="disabled"
      :aria-invalid="showStrength ? score < 5 : undefined"
      :aria-describedby="showStrength ? 'password-strength' : undefined"
      :ui="{ trailing: 'pe-1' }"
      class="w-full"
      size="lg"
      icon="i-lucide-lock"
      @focus="isFocused = true"
      @blur="isFocused = false"
    >
      <template #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="show ? 'Hide password' : 'Show password'"
          :aria-pressed="show"
          aria-controls="password"
          @click="show = !show"
        />
      </template>
    </UInput>

    <div v-if="showStrength && (isFocused || password.length > 0)" class="space-y-2 mt-2">
      <UProgress
        :color="color"
        :indicator="text"
        :model-value="score"
        :max="5"
        size="sm"
      />
  
      <p id="password-strength" class="text-sm font-medium">
        {{ text }}. Must contain:
      </p>
  
      <ul class="space-y-1 bg-primary/10 rounded-lg p-2 inset-shadow-sm" aria-label="Password requirements">
        <!-- List items ... -->
        <li
          v-for="(req, index) in strength"
          :key="index"
          class="flex items-center gap-0.5"
          :class="req.met ? 'text-success' : 'text-muted'"
        >
          <UIcon :name="req.met ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-4 shrink-0" />
  
          <span class="text-xs font-light">
            {{ req.text }}
            <span class="sr-only">
              {{ req.met ? ' - Requirement met' : ' - Requirement not met' }}
            </span>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
