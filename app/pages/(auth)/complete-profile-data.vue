<script setup lang="ts">
/**
 * Complete Profile Data Page
 *
 * Thin page: route binding + layout only.
 * All logic lives in useProfileCompletion() composable.
 * All UI lives in <AuthCompleteProfileForm /> component.
 */
definePageMeta({
  layout: 'auth',
  middleware: ['profile-completion']
})

/**
 * INTENT layer: renders the profile completion form UI.
 * All business logic, schema, state, and submission live in useProfileCompletion().
 */
import type { Country } from '~/composables/auth/usePhoneSchema'

const {
  // Form ref
  formRef,

  // User info
  userName,
  userSignature,

  // Missing-field flags
  needsGender,
  needsEmail,
  needsDateOfBirth,
  needsCountry,
  needsAvatar,
  hasMissingFields,

  // Schema + state
  formSchema,
  formState,

  // Calendar
  calendarModel,
  calendarDefaultDate,

  // Country
  countries,
  countriesLoading,
  selectedCountry,
  getFlagIconName,
  onCountryChange,
  initCountryDetection,
  DEFAULT_FLAG_ICON,

  // Gender
  GENDER_OPTIONS,
  selectedGenderIcon,

  // Field errors
  emailError,
  genderError,
  dateOfBirthError,
  countryError,
  generalError,

  // Avatar
  avatarUrl,
  isUploadingAvatar,
  handleAvatarSelected,

  // Submission
  isSubmitting,
  submitProfileCompletion,
} = useProfileCompletion()

onMounted(() => {
  initCountryDetection()
})
</script>


<template>
  <main>
    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error"
      variant="soft"
      title="Update Failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <SectionTitle class="my-3">Complete your Profile</SectionTitle>

    <!-- Avatar + Welcome Section — always shown -->
    <div class="my-3 flex gap-2">
      <FileUpload
        v-if="needsAvatar"
        :current-image="avatarUrl"
        :loading="isUploadingAvatar"
        crop
        @file-selected="handleAvatarSelected"
      />
      <div>
        <h1 class="text-md font-semibold text-white">
          Hy! {{ userName }}. here is your Signature
          <UBadge color="success" variant="soft" icon="i-lucide-pen-tool" class="text-success-200 text-md font-semibold">{{ userSignature }}</UBadge>
        </h1>
        <p v-if="needsAvatar" class="text-sm text-warning-400"> <UIcon name="i-lucide-arrow-left" class="animate-pulse"/> You may Please Upload your profile picture from the input on left.</p>
      </div>
    </div>

    <!-- If all required fields are filled, show a success message -->
    <div v-if="!hasMissingFields" class="text-center py-8">
      <UIcon name="i-lucide-check-circle" class="size-12 text-success mb-4" />
      <p class="text-lg text-success-400 font-semibold">Your profile is complete!</p>
      <UButton class="mt-4" variant="solid" color="primary" @click="navigateTo('/', { replace: true })">
        Continue to App
      </UButton>
    </div>

    <!-- Dynamic form: only shows missing fields -->
    <UForm
      v-else
      ref="formRef"
      :schema="formSchema"
      :state="formState"
      class="space-y-3"
      @submit="submitProfileCompletion"
    >
      <!-- Gender -->
      <UFormField v-if="needsGender" label="Gender" name="gender" required :error="genderError">
        <USelect
          v-model.number="formState.gender"
          :items="GENDER_OPTIONS"
          :icon="selectedGenderIcon"
          class="w-full"
          size="lg" placeholder="Select your gender"
          option-attribute="label" value-attribute="value"
        />
      </UFormField>

      <!-- Date of Birth -->
      <UFormField v-if="needsDateOfBirth" label="Date of Birth" name="dateOfBirth" required :error="dateOfBirthError">
        <UPopover>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-calendar"
            size="lg"
            class="justify-start text-dimmed" block
          >
            {{ formState.dateOfBirth ? formState.dateOfBirth.toString() : 'Select date of birth' }}
          </UButton>
          <template #content>
            <UCalendar
              v-model="calendarModel"
              :default-placeholder="calendarDefaultDate"
              class="p-2"
            />
          </template>
        </UPopover>
      </UFormField>

      <!-- Email -->
      <UFormField v-if="needsEmail" label="Email" name="email" required :error="emailError">
        <UInput
          v-model="formState.email"
          class="w-full"
          size="lg"
          icon="i-lucide-at-sign"
          placeholder="email@example.com"
        />
      </UFormField>

      <!-- Country -->
      <UFormField v-if="needsCountry" label="Country" name="country" required :error="countryError">
        <USelectMenu
          v-model="selectedCountry"
          :items="(countries as Country[])"
          :loading="countriesLoading"
          virtualize
          label-key="name"
          placeholder="Select your country"
          :search-input="{ icon: 'i-lucide-search', placeholder: 'Search countries...' }"
          size="lg"
          class="w-full"
          @update:model-value="onCountryChange"
        >
          <template #leading>
            <UIcon
              v-if="selectedCountry?.code"
              :name="getFlagIconName(selectedCountry.code)"
              class="size-5 rounded overflow-hidden h-4"
            />
            <UIcon v-else :name="DEFAULT_FLAG_ICON" />
          </template>

          <template #item-leading="{ item }">
            <UIcon
              v-if="(item as Country)?.code"
              :name="getFlagIconName((item as Country).code)"
              class="size-5 rounded overflow-hidden h-4"
            />
          </template>

          <template #item-label="{ item }">
            <template v-if="item">
              {{ (item as Country).name }}
            </template>
          </template>
        </USelectMenu>
      </UFormField>

      <UButton
        :loading="isSubmitting"
        type="submit"
        size="xl"
        icon="i-lucide-send"
        class="w-full justify-center disabled:bg-primary-400"
      >
        Submit
      </UButton>
    </UForm>
  </main>
</template>
