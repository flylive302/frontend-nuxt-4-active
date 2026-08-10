<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { navigateTo } from 'nuxt/app'
import type { PhoneModel } from '~/composables/auth/usePhoneSchema'
import { usePhoneSchema, normalizePhone } from '~/composables/auth/usePhoneSchema'
import type { NationalIdImage } from '~/types/asset/upload'
import type { Agency, AgencyNationalIdImage } from '~/types/agency/agency'
import { normalizeFetchError } from '~/utils/api/normalizeFetchError'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Schema
// ========================================

const imageFile = z.instanceof(File, { message: 'Only image files are allowed' })
  .refine(f => /^image\//.test(f.type), 'Only image files are allowed')
  .refine(f => f.size <= 5 * 1024 * 1024, 'Each file must be ≤ 5MB')

// Images are optional at the zod level here — an existing (already-uploaded)
// image is an acceptable substitute for a freshly picked File. That extra
// "file OR existing image" rule is enforced in `isValid` below, not in the schema.
const baseSchema = z.object({
  agencyName: z.string()
    .min(1, 'Agency name is required')
    .max(30, 'Agency name must be less than 30 characters'),
  address: z.string()
    .min(1, 'Address is required'),
  logo: imageFile.optional(),
  idCardFront: imageFile.optional(),
  idCardBack: imageFile.optional(),
})

type BaseSchema = z.output<typeof baseSchema>

// ========================================
// Component State
// ========================================

const ready = ref(false)

const state = reactive<Partial<BaseSchema>>({
  agencyName: undefined,
  address: undefined,
  logo: undefined,
  idCardFront: undefined,
  idCardBack: undefined,
})

const phone = reactive<PhoneModel>({
  countryCode: '',
  dialCode: '',
  phone: '',
})

// Track selected coin reseller ID from ChooseDefaultReseller
const coinResellerId = ref<number | null>(null)

// Previously uploaded images kept from the rejected/cancelled application.
// Replaced (not merged) the moment the owner picks a new file for that slot.
const existingLogo = ref<{ url: string; file_id: string } | null>(null)
const existingIdFront = ref<AgencyNationalIdImage | null>(null)
const existingIdBack = ref<AgencyNationalIdImage | null>(null)

// ========================================
// Composables / Injected Dependencies
// ========================================

const toast = useToast()
const agencyStore = useAgencyStore()
const { resubmitApplication } = useAgencyApplication()
const { fetchUserAgency } = useAgencyMembership()
const { uploadImage: _uploadImage, createUploadState } = useImageUpload()

// ========================================
// Upload States
// ========================================

const logoUpload = createUploadState()
const idFrontUpload = createUploadState()
const idBackUpload = createUploadState()

const processing = ref(false)
const currentStep = ref<'idle' | 'uploading' | 'submitting'>('idle')

// ========================================
// Schema Composition
// ========================================

const phoneSchema = usePhoneSchema(computed(() =>
  phone.countryCode ? { code: phone.countryCode, name: '' } : undefined
))
const pageSchema = computed(() => baseSchema.and(phoneSchema.value))

type FullSchema = z.output<typeof pageSchema.value>

// ========================================
// Computed
// ========================================

const isValid = computed(() => {
  const baseValid = baseSchema.safeParse(state).success
  const phoneValid = phoneSchema.value.safeParse(phone).success
  const hasLogo = !!state.logo || !!existingLogo.value
  const hasIdFront = !!state.idCardFront || !!existingIdFront.value
  const hasIdBack = !!state.idCardBack || !!existingIdBack.value
  return baseValid && phoneValid && hasLogo && hasIdFront && hasIdBack
})

const isUploading = computed(() =>
  logoUpload.state.value.status === 'uploading' ||
  idFrontUpload.state.value.status === 'uploading' ||
  idBackUpload.state.value.status === 'uploading'
)

const overallProgress = computed(() => {
  const states = [logoUpload.state.value, idFrontUpload.state.value, idBackUpload.state.value]
  const total = states.reduce((sum, s) => sum + s.progress, 0)
  return Math.round(total / 3)
})

// ========================================
// Gate — owner-only, rejected/cancelled applications only
// ========================================

function canEditApplication(agency: Agency | null, isOwner: boolean): boolean {
  if (!agency || !isOwner) return false
  return agency.can_resubmit ?? (agency.status === 'rejected' || agency.status === 'cancelled')
}

// ========================================
// Prefill
// ========================================

function prefillFromAgency(agency: Agency): void {
  state.agencyName = agency.name
  state.address = agency.address ?? undefined
  phone.countryCode = agency.country ?? ''

  // The API rejects a logo URL without its file id (`required_with`), so a
  // logo we cannot re-send with its file id counts as "no logo kept" — the
  // owner must pick a new one rather than hit a 422 on submit.
  if (agency.logo && agency.logo_file_id) {
    existingLogo.value = { url: agency.logo, file_id: agency.logo_file_id }
  }

  const idImages = agency.national_id_images ?? []
  existingIdFront.value = idImages.find(img => img.side === 'front') ?? null
  existingIdBack.value = idImages.find(img => img.side === 'back') ?? null

  coinResellerId.value = agency.coin_reseller?.id ?? null
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  if (!agencyStore.userAgency.agency) {
    await fetchUserAgency()
  }

  const agency = agencyStore.userAgency.agency
  if (!canEditApplication(agency, agencyStore.isAgencyOwner) || !agency) {
    await navigateTo('/agency/my-agency')
    return
  }

  prefillFromAgency(agency)
  ready.value = true
})

// ========================================
// Event Handlers
// ========================================

async function onSubmit(_e: FormSubmitEvent<FullSchema>): Promise<void> {
  processing.value = true
  currentStep.value = 'idle'

  try {
    const parsed = pageSchema.value.safeParse({ ...state, ...phone })
    if (!parsed.success) {
      toast.add({ title: 'Validation Error', description: 'Please check all required fields', color: 'error' })
      return
    }

    // Step 1: Upload any newly-picked images to ImageKit; keep existing ones untouched
    currentStep.value = 'uploading'

    let logoUrl: string
    let logoFileId: string | number | null

    if (parsed.data.logo) {
      const logoResult = await logoUpload.upload(parsed.data.logo, 'agencies/logos')
      if (!logoResult) {
        toast.add({ title: 'Upload Failed', description: 'Failed to upload logo', color: 'error' })
        return
      }
      logoUrl = logoResult.url
      logoFileId = logoResult.fileId
    } else if (existingLogo.value) {
      logoUrl = existingLogo.value.url
      logoFileId = existingLogo.value.file_id
    } else {
      toast.add({ title: 'Missing Logo', description: 'Please add a logo for your agency', color: 'error' })
      return
    }

    let idFrontImage: NationalIdImage
    if (parsed.data.idCardFront) {
      const idFrontResult = await idFrontUpload.upload(parsed.data.idCardFront, 'agencies/national-ids')
      if (!idFrontResult) {
        toast.add({ title: 'Upload Failed', description: 'Failed to upload ID card front', color: 'error' })
        return
      }
      idFrontImage = { url: idFrontResult.url, file_id: idFrontResult.fileId, side: 'front' }
    } else if (existingIdFront.value) {
      idFrontImage = existingIdFront.value
    } else {
      toast.add({ title: 'Missing ID', description: 'Please add the front of your ID card', color: 'error' })
      return
    }

    let idBackImage: NationalIdImage
    if (parsed.data.idCardBack) {
      const idBackResult = await idBackUpload.upload(parsed.data.idCardBack, 'agencies/national-ids')
      if (!idBackResult) {
        toast.add({ title: 'Upload Failed', description: 'Failed to upload ID card back', color: 'error' })
        return
      }
      idBackImage = { url: idBackResult.url, file_id: idBackResult.fileId, side: 'back' }
    } else if (existingIdBack.value) {
      idBackImage = existingIdBack.value
    } else {
      toast.add({ title: 'Missing ID', description: 'Please add the back of your ID card', color: 'error' })
      return
    }

    // Step 2: Resubmit to API — same payload shape as the initial create request
    currentStep.value = 'submitting'

    const payload = {
      name: parsed.data.agencyName,
      address: parsed.data.address,
      country: parsed.data.countryCode.toUpperCase(),
      logo_url: logoUrl,
      logo_file_id: logoFileId,
      national_id_images: [idFrontImage, idBackImage],
      // Phone info
      phone_country_code: parsed.data.countryCode,
      phone_dial_code: parsed.data.dialCode,
      phone: parsed.data.phone,
      phone_e164: normalizePhone(parsed.data.dialCode, parsed.data.phone),
      // Coin reseller (from user's default reseller selection)
      ...(coinResellerId.value && { coin_reseller_id: coinResellerId.value }),
    }

    const success = await resubmitApplication(payload)
    if (!success) return

    // Navigate to my-agency dashboard. Immediate — leaving the submit button
    // live after success lets a second click re-POST an already-pending
    // application.
    await navigateTo('/agency/my-agency')

  } catch (error: unknown) {
    const normalizedError = normalizeFetchError(error)

    const errorDescription = normalizedError.fieldErrors
      ? Object.values(normalizedError.fieldErrors).flat()[0]
      : normalizedError.message

    toast.add({
      title: 'Error',
      description: errorDescription || 'Failed to resubmit agency application. Please try again.',
      color: 'error'
    })
  } finally {
    processing.value = false
    currentStep.value = 'idle'
  }
}

// ========================================
// Helpers
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
            accept="image/*"
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
            accept="image/*"
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
            accept="image/*"
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
