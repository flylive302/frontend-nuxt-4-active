<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, SelectItem } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'
import { computed, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'

definePageMeta({
  layout: 'auth',
  middleware: 'auth'
})

// ---------- schema ----------
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  gender: z.string().min(1, 'Please select a gender'),
  email: z.email('Invalid email'),
  dateOfBirth: z.custom<CalendarDate>(
      (val) => val instanceof CalendarDate,
      { message: 'Please select a valid date of birth' }
  ).refine((date) => {
    const today = new Date()
    const birth = date.toDate('UTC')
    const age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    const adj = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age
    return adj >= 18
  }, { message: 'You must be at least 18 years old' }),
})

type FormSchema = z.infer<typeof formSchema>

// ---------- reactive state ----------
const state = reactive<Partial<FormSchema>>({
  name: undefined,
  gender: undefined,
  email: undefined,
  dateOfBirth: undefined as CalendarDate | undefined,
})

// ---------- gender dropdown ----------
const genderOptions: SelectItem[] = [
  { label: 'Male', value: 'male', icon: 'i-lucide-mars' },
  { label: 'Female', value: 'female', icon: 'i-lucide-venus' },
  { label: 'Non-binary', value: 'non_binary', icon: 'i-lucide-non-binary' },
  { label: 'Prefer not to say', value: 'not_specified', icon: 'i-lucide-help-circle' },
]
const selectedIcon = computed(() =>
    genderOptions.find(o => o?.value === state.gender)?.icon ?? 'i-lucide-venus-and-mars'
)

const calendarDefault = new CalendarDate(2000, 1, 1)

// ---------- validity ----------
const isValid = computed(() => formSchema.safeParse({ ...state }).success)

// ---------- submit ----------
const toast = useToast()
const processing = ref(false)
const { updateProfile } = useAuth()
const { normalizeError } = useApi()

async function onSubmit(_e: FormSubmitEvent<FormSchema>) {
  processing.value = true
  try {
    const parsed = formSchema.safeParse({ ...state })
    if (!parsed.success) {
      return
    }

    await updateProfile({
        name: parsed.data.name,
        // gender: parsed.data.gender, // Assuming API supports this
        email: parsed.data.email,
        // dateOfBirth: parsed.data.dateOfBirth?.toString() // Assuming API supports this
    })

    navigateTo('/')
  } catch (error: any) {
      const err = normalizeError(error)
      toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <main>
    <UForm :schema="formSchema" :state="state" class="space-y-3" @submit="onSubmit">
      <UFormField label="Name" name="name" required>
        <UInput v-model="state.name" class="w-full" size="lg" icon="i-lucide-user-pen" placeholder="Enter your full name" />
      </UFormField>

      <UFormField label="Gender" name="gender" required>
        <USelect
            v-model="state.gender" class="w-full"
            :items="genderOptions"
            :icon="selectedIcon"
            size="lg"
            placeholder="Select your gender"
        />
      </UFormField>

      <UFormField label="Date of Birth" name="dateOfBirth" required>
        <UPopover>
          <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-calendar"
              size="lg"
              class="justify-start text-dimmed"
              block
          >
            {{ state.dateOfBirth ? state.dateOfBirth.toString() : 'Select date of birth' }}
          </UButton>
          <template #content>
            <UCalendar v-model="state.dateOfBirth" :default-placeholder="calendarDefault" class="p-2" />
          </template>
        </UPopover>
      </UFormField>

      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" class="w-full" size="lg" icon="i-lucide-at-sign" placeholder="email@example.com" />
      </UFormField>

      <UButton type="submit" size="xl" class="w-full justify-center disabled:bg-primary-400" icon="i-lucide-send" :loading="processing" :disabled="!isValid">
        Submit
      </UButton>
    </UForm>
  </main>
</template>
