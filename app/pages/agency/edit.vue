<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { onMounted, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import { ALLOWED_IMAGE_ACCEPT } from '~/types/asset/upload'
import { canEditAgencyApplication, useAgencyApplicationForm } from '~/composables/agency/useAgencyApplicationForm'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// State
// ========================================

const ready = ref(false)

// ========================================
// Composables
// ========================================

const agencyStore = useAgencyStore()
const { fetchUserAgency } = useAgencyMembership()

// Whole GATE → EXECUTE → REACT pipeline lives in the composable.
const {
  state,
  phone,
  coinResellerId,
  existingLogo,
  existingIdFront,
  existingIdBack,
  logoUpload,
  idFrontUpload,
  idBackUpload,
  processing,
  currentStep,
  pageSchema,
  isValid,
  isUploading,
  overallProgress,
  prefillFromAgency,
  submit: onSubmit,
} = useAgencyApplicationForm('edit')

// ========================================
// Lifecycle — route-level data loading
// ========================================

onMounted(async () => {
  if (!agencyStore.userAgency.agency) {
    await fetchUserAgency()
  }

  const agency = agencyStore.userAgency.agency
  if (!agency || !canEditAgencyApplication(agency, agencyStore.isAgencyOwner)) {
    await navigateTo('/agency/my-agency')
    return
  }

  prefillFromAgency(agency)
  ready.value = true
})

// ========================================
// Helpers (template display only)
// ========================================

function getUploadStatusIcon(status: string): string {
  switch (status) {
    case 'uploading': return 'i-lucide-loader-2'
    case 'success': return 'i-lucide-check-circle'
    case 'error': return 'i-lucide-alert-circle'
    default: return 'i-lucide-upload'
  }
}

function getUploadStatusColor(status: string): string {
  switch (status) {
    case 'uploading': return 'text-primary'
    case 'success': return 'text-success'
    case 'error': return 'text-error'
    default: return 'text-muted'
  }
}
</script>

<template>
  <main v-if="ready">
    <NavAlt spacer back-to="/agency/my-agency">Edit Agency Application</NavAlt>

    <div class="px-3 py-14 pt-18 space-y-6">
      <!-- Upload Progress Banner -->
      <div
        v-if="isUploading || currentStep === 'submitting'"
        class="fixed inset-x-0 top-12 z-50 bg-primary/90 text-white px-4 py-3"
      >
        <div class="flex items-center gap-3 max-w-md mx-auto">
          <icon name="i-lucide-loader-2" class="size-5 animate-spin" />
          <div class="flex-1">
            <p class="text-sm font-medium">
              {{ currentStep === 'submitting' ? 'Resubmitting application...' : 'Uploading images...' }}
            </p>
            <div v-if="isUploading" class="mt-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                class="h-full bg-white rounded-full transition-all duration-300"
                :style="{ width: `${overallProgress}%` }"
              />
            </div>
          </div>
          <span v-if="isUploading" class="text-sm font-bold">{{ overallProgress }}%</span>
        </div>
      </div>

      <UForm :schema="pageSchema" :state="{ ...state, ...phone }" class="space-y-6 mt-14" @submit="onSubmit">
        <!-- Agency Name -->
        <UFormField label="Agency Name" name="agencyName" required>
          <UInput
            v-model="state.agencyName"
            class="w-full"
            size="lg"
            icon="i-lucide-building-2"
            placeholder="Choose a name less than 30 characters"
            :maxlength="30"
            :disabled="processing"
          />
        </UFormField>

        <!-- Country and Phone -->
        <FormsCountryPhoneInput
          v-model:country-code="phone.countryCode"
          v-model:dial-code="phone.dialCode"
          v-model:phone="phone.phone"
          :disabled="processing"
        />

        <!-- Address -->
        <UFormField label="Address" name="address" required>
          <UInput
v-model="state.address" class="w-full" size="lg" icon="i-lucide-map-pin"
            placeholder="Add your current address" :disabled="processing" />
        </UFormField>

        <!-- Logo Upload -->
        <UFormField label="Add a Logo for your Agency" name="logo" required>
          <template #hint>
            <div class="flex items-center gap-1.5">
              <icon
                :name="getUploadStatusIcon(logoUpload.state.value.status)"
                :class="[getUploadStatusColor(logoUpload.state.value.status), 'size-4', { 'animate-spin': logoUpload.state.value.status === 'uploading' }]"
              />
              <span v-if="logoUpload.state.value.status === 'uploading'" class="text-xs">
                {{ logoUpload.state.value.progress }}%
              </span>
              <span v-else-if="logoUpload.state.value.status === 'success'" class="text-xs text-success">
                Uploaded
              </span>
              <span v-else-if="existingLogo && !state.logo" class="text-xs text-muted">
                Keeping current logo
              </span>
            </div>
          </template>
          <div v-if="existingLogo && !state.logo" class="flex items-center gap-3 mb-2">
            <img :src="existingLogo.url" alt="Current agency logo" class="size-16 rounded-lg object-cover border border-default" >
            <p class="text-xs text-muted">Pick a new file below to replace this logo.</p>
          </div>
          <UFileUpload
            v-model="state.logo"
            color="primary"
            :accept="ALLOWED_IMAGE_ACCEPT"
            :disabled="processing"
            label="Drop your Agency Logo here"
            description="JPG, PNG, WebP (max. 5MB)"
            class="w-full min-h-40"
            highlight
          />
        </UFormField>

        <!-- ID Card Front -->
        <UFormField label="Upload the front Side of your ID Card" name="idCardFront" required>
          <template #hint>
            <div class="flex items-center gap-1.5">
              <icon
                :name="getUploadStatusIcon(idFrontUpload.state.value.status)"
                :class="[getUploadStatusColor(idFrontUpload.state.value.status), 'size-4', { 'animate-spin': idFrontUpload.state.value.status === 'uploading' }]"
              />
              <span v-if="idFrontUpload.state.value.status === 'uploading'" class="text-xs">
                {{ idFrontUpload.state.value.progress }}%
              </span>
              <span v-else-if="idFrontUpload.state.value.status === 'success'" class="text-xs text-success">
                Uploaded
              </span>
              <span v-else-if="existingIdFront && !state.idCardFront" class="text-xs text-muted">
                Keeping current ID
              </span>
            </div>
          </template>
          <div v-if="existingIdFront && !state.idCardFront" class="flex items-center gap-3 mb-2">
            <img :src="existingIdFront.url" alt="Current ID card front" class="size-16 rounded-lg object-cover border border-default" >
            <p class="text-xs text-muted">Pick a new file below to replace this image.</p>
          </div>
          <UFileUpload
            v-model="state.idCardFront"
            color="primary"
            :accept="ALLOWED_IMAGE_ACCEPT"
            :disabled="processing"
            label="Make Sure It's clear and fully readable"
            description="JPG, PNG, WebP (max. 5MB)"
            class="w-full min-h-40"
            highlight
          />
        </UFormField>

        <!-- ID Card Back -->
        <UFormField label="Upload the Back Side of your ID Card" name="idCardBack" required>
          <template #hint>
            <div class="flex items-center gap-1.5">
              <icon
                :name="getUploadStatusIcon(idBackUpload.state.value.status)"
                :class="[getUploadStatusColor(idBackUpload.state.value.status), 'size-4', { 'animate-spin': idBackUpload.state.value.status === 'uploading' }]"
              />
              <span v-if="idBackUpload.state.value.status === 'uploading'" class="text-xs">
                {{ idBackUpload.state.value.progress }}%
              </span>
              <span v-else-if="idBackUpload.state.value.status === 'success'" class="text-xs text-success">
                Uploaded
              </span>
              <span v-else-if="existingIdBack && !state.idCardBack" class="text-xs text-muted">
                Keeping current ID
              </span>
            </div>
          </template>
          <div v-if="existingIdBack && !state.idCardBack" class="flex items-center gap-3 mb-2">
            <img :src="existingIdBack.url" alt="Current ID card back" class="size-16 rounded-lg object-cover border border-default" >
            <p class="text-xs text-muted">Pick a new file below to replace this image.</p>
          </div>
          <UFileUpload
            v-model="state.idCardBack"
            color="primary"
            :accept="ALLOWED_IMAGE_ACCEPT"
            :disabled="processing"
            label="Make Sure It's clear and fully readable"
            description="JPG, PNG, WebP (max. 5MB)"
            class="w-full min-h-40"
            highlight
          />
        </UFormField>

        <!-- Default Reseller -->
        <EconomyChooseDefaultReseller v-model="coinResellerId" color="primary" />

        <!-- Submit Button -->
        <UButton
          type="submit"
          size="xl"
          class="w-full justify-center"
          icon="i-lucide-send"
          :loading="processing"
          :disabled="!isValid || processing"
          color="primary"
        >
          {{ isUploading ? 'Uploading...' : currentStep === 'submitting' ? 'Resubmitting...' : 'Resubmit For Review' }}
        </UButton>
      </UForm>
    </div>
  </main>
</template>
