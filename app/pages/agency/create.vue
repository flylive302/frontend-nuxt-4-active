<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { ALLOWED_IMAGE_ACCEPT } from '~/types/asset/upload'
import { useAgencyApplicationForm } from '~/composables/agency/useAgencyApplicationForm'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Composables
// ========================================

// Whole GATE → EXECUTE → REACT pipeline lives in the composable.
const {
  state,
  phone,
  coinResellerId,
  logoUpload,
  idFrontUpload,
  idBackUpload,
  processing,
  currentStep,
  pageSchema,
  isValid,
  isUploading,
  overallProgress,
  submit: onSubmit,
} = useAgencyApplicationForm('create')

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
  <main>
    <NavAlt spacer back-to="/agency/list">Create New Agency</NavAlt>

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
              {{ currentStep === 'submitting' ? 'Creating agency...' : 'Uploading images...' }}
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
          <template #hint>
            <p class="text-xs text-muted">Cannot be modified once created</p>
          </template>
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
          <template #hint>
            <p class="text-xs text-muted">Cannot be modified once created</p>
          </template>
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
            </div>
          </template>
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
            </div>
          </template>
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
            </div>
          </template>
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
          {{ isUploading ? 'Uploading...' : currentStep === 'submitting' ? 'Creating...' : 'Submit For Review' }}
        </UButton>
      </UForm>
    </div>
  </main>
</template>
