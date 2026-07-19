<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
/**
 * Profile Completion Wizard
 *
 * Multi-step onboarding flow with View Transition API animations.
 * INTENT layer: UI + step navigation. All business logic in useProfileCompletion().
 */
import { CalendarDate } from '@internationalized/date'
import { GENDER_MALE, GENDER_FEMALE } from '~/composables/auth/useProfileCompletion'
import { isValidE164Phone } from '~/composables/auth/usePhoneSchema'

const {
  needsConsent, needsGender, needsDateOfBirth, needsEmail, needsCountry, needsPhone, needsAvatar,
  formState, GENDER_OPTIONS,
  countryError, phoneError,
  avatarUrl, isUploadingAvatar, handleAvatarSelected,
  isSubmitting, generalError, submitWizardData,
  initCountryDetection,
} = useProfileCompletion()

const { hasGrantedMic, requestMicAccess } = useMicPermission()

// Microphone permission, requested inline on the consent step (INTENT only).
const micState = ref<'idle' | 'granted' | 'denied'>('idle')
const micGranted = computed(() => micState.value === 'granted')
const micStatusText = computed(() =>
  micState.value === 'granted' ? "You're all set to speak in rooms"
    : micState.value === 'denied' ? 'Blocked — enable it in your device settings'
      : 'So you can speak in audio rooms'
)

async function handleAllowMic() {
  const result = await requestMicAccess()
  micState.value = result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'idle'
}

const { hasGrantedCamera, requestCameraAccess } = useCameraPermission()

// Camera permission — same inline pattern as the mic, so the DM camera
// button can open the camera later without a capture-time prompt.
const cameraState = ref<'idle' | 'granted' | 'denied'>('idle')
const cameraGranted = computed(() => cameraState.value === 'granted')
const cameraStatusText = computed(() =>
  cameraState.value === 'granted' ? "You're all set to snap photos in chats"
    : cameraState.value === 'denied' ? 'Blocked — enable it in your device settings'
      : 'So you can send photos in chats'
)

async function handleAllowCamera() {
  const result = await requestCameraAccess()
  cameraState.value = result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'idle'
}

// ── Step computation ──────────────────────────────
// Snapshot on mount — prevents steps from vanishing when a field
// is filled mid-flow (e.g. avatar upload updates the store immediately).
type StepId = 'consent' | 'gender' | 'dob' | 'email' | 'country' | 'phone' | 'avatar'
interface Step { id: StepId; label: string }

const steps = ref<Step[]>([])

const stepIndex = ref(0)
const currentStep = computed(() => steps.value[stepIndex.value])
const isLastStep = computed(() => stepIndex.value === steps.value.length - 1)

// ── Step titles ──────────────────────────────
const stepTitles: Record<StepId, string> = {
  consent: 'Before we begin',
  gender: 'Your gender?',
  dob: 'When were you born?',
  email: 'What\'s your email?',
  country: 'Where are you from?',
  phone: 'Your phone number',
  avatar: 'Add a profile photo',
}

// ── View Transition navigation ──────────────────
function transitionStep(delta: number) {
  const next = stepIndex.value + delta
  if (next < 0 || next >= steps.value.length) return

  const dir = delta > 0 ? 'forward' : 'back'

  if (document.startViewTransition) {
    document.documentElement.dataset.wizardDir = dir
    const t = document.startViewTransition(async () => {
      stepIndex.value = next
      await nextTick()
    })
    t.finished.then(() => delete document.documentElement.dataset.wizardDir)
  } else {
    stepIndex.value = next
  }
}

// ── Per-step validation ──────────────────────────
const stepError = ref('')

const canProceed = computed(() => {
  if (!currentStep.value) return false
  switch (currentStep.value.id) {
    case 'consent': return formState.termsAccepted && formState.privacyAccepted
    case 'gender': return formState.gender !== undefined
    case 'dob': return !!formState.dateOfBirth
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)
    case 'country': return !!formState.country && formState.country.length >= 2
    case 'phone': return isValidE164Phone(formState.phone)
    case 'avatar': return true // optional, can skip
    default: return false
  }
})

// ── Gender helpers ──────────────────────────────
function selectGender(value: number) {
  formState.gender = value
  stepError.value = ''
  // Auto-advance after selection animation
  setTimeout(() => transitionStep(1), 500)
}

const otherGenders = GENDER_OPTIONS.filter(g => g.value !== GENDER_MALE && g.value !== GENDER_FEMALE)
const showOtherGenders = ref(false)

// ── DOB helpers ──────────────────────────────
const dobString = ref('')

function onDobChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  dobString.value = val
  if (val) {
    const parts = val.split('-').map(Number) as [number, number, number]
    formState.dateOfBirth = new CalendarDate(parts[0], parts[1], parts[2])
  } else {
    formState.dateOfBirth = null
  }
  stepError.value = ''
}

// Max date = 18 years ago from today
const maxDobDate = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().split('T')[0]
})

// ── Navigation actions ──────────────────────────
async function handleContinue() {
  if (!canProceed.value) {
    stepError.value = 'Please complete this step'
    return
  }
  stepError.value = ''

  if (isLastStep.value) {
    await submitWizardData()
  } else {
    transitionStep(1)
  }
}

// ── Lifecycle ──────────────────────────────
onMounted(() => {
  // Snapshot which steps are needed (prevents reactive shifts mid-flow)
  const s: Step[] = []
  if (needsConsent.value) s.push({ id: 'consent', label: 'Agreements' })
  if (needsGender.value) s.push({ id: 'gender', label: 'Gender' })
  if (needsDateOfBirth.value) s.push({ id: 'dob', label: 'Date of Birth' })
  if (needsEmail.value) s.push({ id: 'email', label: 'Email' })
  if (needsCountry.value) s.push({ id: 'country', label: 'Country' })
  if (needsPhone.value) s.push({ id: 'phone', label: 'Phone' })
  if (needsAvatar.value) s.push({ id: 'avatar', label: 'Avatar' })
  steps.value = s

  // Reflect an existing device grant so returning users see it already enabled.
  if (hasGrantedMic()) micState.value = 'granted'
  if (hasGrantedCamera()) cameraState.value = 'granted'

  initCountryDetection()
})

// Avatar upload → auto-finish (user interaction triggers this, not a watcher)
async function onAvatarFileSelected(file: File) {
  await handleAvatarSelected(file)
  // If upload succeeded (avatarUrl changed), auto-submit remaining data
  if (avatarUrl.value) {
    await submitWizardData()
  }
}
</script>

<template>
  <div class="flex flex-col min-h-[80dvh] py-6 px-4 contain-[layout_style]">
    <!-- Progress dots -->
    <div class="flex justify-center gap-2 mb-8">
      <button
        v-for="(step, i) in steps" :key="step.id"
        class="dot size-2 rounded-full bg-neutral-700 p-0 cursor-pointer"
        :class="{ 'dot--active': i === stepIndex, 'dot--done': i < stepIndex }"
        :aria-label="`Step ${i + 1}: ${step.label}`"
        @click="i < stepIndex && transitionStep(i - stepIndex)"
      />
    </div>

    <!-- Back button -->
    <button
      v-if="stepIndex > 0"
      class="absolute top-6 left-4 size-10 flex items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 transition-transform active:scale-90"
      aria-label="Go back"
      @click="transitionStep(-1)"
    >
      <UIcon name="i-lucide-arrow-left" class="size-5" />
    </button>

    <!-- Error banner -->
    <UAlert
      v-if="generalError"
      :description="generalError"
      color="error" variant="soft"
      title="Update Failed"
      class="mb-4"
      icon="i-lucide-alert-circle"
    />

    <!-- Step content (view-transition target) -->
    <div v-if="currentStep" class="wizard-content flex-1 flex flex-col items-center">

      <!-- ═══ Consent Step ═══ -->
      <template v-if="currentStep.id === 'consent'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.consent }}</h1>
        <p class="text-sm text-neutral-400 text-center mb-8">Please review and accept our agreements to continue</p>

        <div class="flex flex-col gap-4 w-full max-w-88 mx-auto">
          <label class="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border border-neutral-700 bg-neutral-900 transition-colors" :class="{ 'border-primary-500 bg-neutral-800': formState.termsAccepted }">
            <input
              v-model="formState.termsAccepted"
              type="checkbox"
              class="mt-0.5 size-5 accent-primary-500 cursor-pointer flex-shrink-0"
            >
            <span class="text-sm text-neutral-300 leading-relaxed">
              I agree to the
              <a href="/terms-of-service" target="_blank" class="text-primary-400 hover:text-primary-300 underline underline-offset-2">Terms of Service</a>
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer p-4 rounded-2xl border border-neutral-700 bg-neutral-900 transition-colors" :class="{ 'border-primary-500 bg-neutral-800': formState.privacyAccepted }">
            <input
              v-model="formState.privacyAccepted"
              type="checkbox"
              class="mt-0.5 size-5 accent-primary-500 cursor-pointer flex-shrink-0"
            >
            <span class="text-sm text-neutral-300 leading-relaxed">
              I agree to the
              <a href="/privacy-policy" target="_blank" class="text-primary-400 hover:text-primary-300 underline underline-offset-2">Privacy Policy</a>
            </span>
          </label>

          <!-- Microphone permission — request inline so audio rooms work later without a seat-time prompt -->
          <button
            type="button"
            class="flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors disabled:cursor-default"
            :class="micGranted ? 'border-primary-500 bg-neutral-800' : 'border-neutral-700 bg-neutral-900'"
            :disabled="micGranted"
            @click="handleAllowMic"
          >
            <div class="flex items-center justify-center size-9 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
              <UIcon :name="micGranted ? 'i-lucide-check' : 'i-lucide-mic'" class="size-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-neutral-200 font-medium">{{ micGranted ? 'Microphone enabled' : 'Allow microphone' }}</p>
              <p class="text-xs text-neutral-400 leading-relaxed">{{ micStatusText }}</p>
            </div>
            <span v-if="!micGranted" class="text-xs font-medium text-primary-400 flex-shrink-0">Allow</span>
          </button>

          <!-- Camera permission — same inline pattern, for DM photo capture -->
          <button
            type="button"
            class="flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors disabled:cursor-default"
            :class="cameraGranted ? 'border-primary-500 bg-neutral-800' : 'border-neutral-700 bg-neutral-900'"
            :disabled="cameraGranted"
            @click="handleAllowCamera"
          >
            <div class="flex items-center justify-center size-9 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
              <UIcon :name="cameraGranted ? 'i-lucide-check' : 'i-lucide-camera'" class="size-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-neutral-200 font-medium">{{ cameraGranted ? 'Camera enabled' : 'Allow camera' }}</p>
              <p class="text-xs text-neutral-400 leading-relaxed">{{ cameraStatusText }}</p>
            </div>
            <span v-if="!cameraGranted" class="text-xs font-medium text-primary-400 flex-shrink-0">Allow</span>
          </button>
        </div>
      </template>

      <!-- ═══ Gender Step ═══ -->
      <template v-if="currentStep.id === 'gender'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.gender }}</h1>

        <div class="grid grid-cols-2 gap-4 w-full max-w-88 mx-auto my-6">
          <button
            class="gender-card"
            :class="{ 'gender-card--female-selected': formState.gender === GENDER_FEMALE }"
            @click="selectGender(GENDER_FEMALE)"
          >
            <NuxtImg :src="ASSETS.GENDER_FEMALE" alt="Female" class="gender-card__img w-full aspect-square object-contain rounded-xl" preload />
            <span class="mt-3 text-base font-semibold text-neutral-200">Female</span>
          </button>

          <button
            class="gender-card"
            :class="{ 'gender-card--male-selected': formState.gender === GENDER_MALE }"
            @click="selectGender(GENDER_MALE)"
          >
            <NuxtImg :src="ASSETS.GENDER_MALE" alt="Male" class="gender-card__img w-full aspect-square object-contain rounded-xl" preload />
            <span class="mt-3 text-base font-semibold text-neutral-200">Male</span>
          </button>
        </div>

        <!-- Other options -->
        <button class="flex items-center gap-1 mt-4 text-xs text-neutral-400 cursor-pointer" @click="showOtherGenders = !showOtherGenders">
          <span>More options</span>
          <UIcon
            name="i-lucide-chevron-down" class="size-4 transition-transform"
            :class="{ 'rotate-180': showOtherGenders }"
          />
        </button>
        <div v-if="showOtherGenders" class="other-genders flex flex-wrap gap-2 mt-3">
          <button
            v-for="g in otherGenders" :key="g.value"
            class="other-gender-btn flex items-center gap-2 py-2 px-4 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 text-sm cursor-pointer active:scale-95"
            :class="{ 'other-gender-btn--selected': formState.gender === g.value }"
            @click="selectGender(g.value)"
          >
            <UIcon :name="g.icon" class="size-5" />
            {{ g.label }}
          </button>
        </div>
      </template>

      <!-- ═══ Date of Birth Step ═══ -->
      <template v-else-if="currentStep.id === 'dob'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.dob }}</h1>
        <p class="text-sm text-neutral-400 text-center mb-8">You must be at least 18 years old</p>

        <div class="dob-wrapper flex items-center gap-3 w-full max-w-88 py-4 px-5 rounded-2xl border-2 border-neutral-700 bg-neutral-900">
          <UIcon name="i-lucide-calendar" class="size-6 text-primary-400" />
          <input
            type="date"
            class="dob-input flex-1 bg-transparent border-none outline-none text-white text-lg font-medium"
            :value="dobString"
            :max="maxDobDate"
            required
            @change="onDobChange"
          >
        </div>
      </template>

      <!-- ═══ Email Step ═══ -->
      <template v-else-if="currentStep.id === 'email'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.email }}</h1>
        <p class="text-sm text-neutral-400 text-center mb-8">We'll use this to keep your account secure</p>

        <UInput
          v-model="formState.email"
          size="xl"
          icon="i-lucide-at-sign"
          placeholder="email@example.com"
          type="email"
          class="w-full"
          autocomplete="email"
          @keyup.enter="handleContinue"
        />
      </template>

      <!-- ═══ Country Step (residence — independent of phone) ═══ -->
      <template v-else-if="currentStep.id === 'country'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.country }}</h1>
        <p class="text-sm text-neutral-400 text-center mb-8">Select your country of residence</p>

        <div class="w-full max-w-88 mx-auto">
          <FormsCountrySelect
            v-model="formState.country"
            label=""
            :error="countryError"
          />
        </div>
      </template>

      <!-- ═══ Phone Step (independent number + own dial code) ═══ -->
      <template v-else-if="currentStep.id === 'phone'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.phone }}</h1>
        <p class="text-sm text-neutral-400 text-center mb-8">Choose any dial code and enter your number</p>

        <div class="w-full max-w-88 mx-auto">
          <FormsPhoneNumberInput
            v-model="formState.phone"
            label=""
            auto-detect
            :error="phoneError"
          />
        </div>
      </template>

      <!-- ═══ Avatar Step ═══ -->
      <template v-else-if="currentStep.id === 'avatar'">
        <h1 class="text-2xl font-bold text-neutral-50 text-center mb-2">{{ stepTitles.avatar }}</h1>
        <p class="text-sm text-neutral-400 text-center mb-8">Show the world who you are</p>

        <div class="flex flex-col items-center mt-4">
          <FileUpload
            :current-image="avatarUrl"
            :loading="isUploadingAvatar"
            size="xl"
            crop
            @file-selected="onAvatarFileSelected"
          />
          <p class="text-sm text-neutral-400 mt-3">Tap to upload</p>
        </div>
      </template>

      <!-- Step error -->
      <p v-if="stepError" class="mt-3 text-sm text-error-400 text-center">{{ stepError }}</p>
    </div>

    <!-- Continue button (hidden for gender since it auto-advances) -->
    <div v-if="currentStep && currentStep.id !== 'gender'" class="mt-auto pt-6 flex flex-col gap-3 items-center">
      <UButton
        :loading="isSubmitting"
        size="xl"
        block
        :disabled="!canProceed && currentStep.id !== 'avatar'"
        class="justify-center"
        @click="handleContinue"
      >
        {{ isLastStep ? 'Finish' : 'Continue' }}
        <template #trailing>
          <UIcon :name="isLastStep ? 'i-lucide-check' : 'i-lucide-arrow-right'" class="size-5" />
        </template>
      </UButton>

      <button
        v-if="currentStep.id === 'avatar'"
        class="text-sm text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer p-2"
        @click="submitWizardData()"
      >
        Skip for now
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
 * Only CSS that Tailwind can't express:
 * animations, color-mix(), complex transitions, vendor pseudo-elements
 */

/* ── Entry animation ───────────────────────────── */
.wizard-content {
  animation: fadeUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Progress dots — width animation + glow ────── */
.dot {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.dot--active {
  width: 1.5rem;
  background: var(--ui-color-primary-500);
  box-shadow: 0 0 12px var(--ui-color-primary-500);
}

.dot--done {
  background: var(--ui-color-primary-400);
}

/* ── Gender cards — multi-property transition + color-mix ── */
.gender-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.5rem;
  border-radius: 1.25rem;
  border: 2px solid var(--ui-color-neutral-700);
  background: var(--ui-color-neutral-900);
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s ease,
    box-shadow 0.3s ease;

  &:active {
    transform: scale(0.95);
  }
}

.gender-card--female-selected {
  border-color: var(--ui-color-primary-500);
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--ui-color-primary-500) 25%, transparent),
    var(--ui-color-neutral-900)
  );
  box-shadow:
    0 0 24px color-mix(in srgb, var(--ui-color-primary-500) 30%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-color-primary-300) 20%, transparent);
}

.gender-card--male-selected {
  border-color: var(--ui-color-info-500);
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--ui-color-info-500) 20%, transparent),
    var(--ui-color-neutral-900)
  );
  box-shadow:
    0 0 24px color-mix(in srgb, var(--ui-color-info-500) 25%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-color-info-300) 20%, transparent);
}

.gender-card__img {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.gender-card--female-selected .gender-card__img,
.gender-card--male-selected .gender-card__img {
  transform: scale(1.05);
}

/* ── Other genders — entry animation + color-mix ── */
.other-genders {
  animation: fadeUp 0.25s ease;
}

.other-gender-btn {
  transition: all 0.2s ease;
}

.other-gender-btn--selected {
  border-color: var(--ui-color-primary-500);
  background: color-mix(in srgb, var(--ui-color-primary-500) 15%, transparent);
  color: var(--ui-color-primary-200);
}

/* ── DOB native input — vendor pseudo + focus state ── */
.dob-wrapper {
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: var(--ui-color-primary-500);
  }
}

.dob-input {
  color-scheme: white;

  &::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
    opacity: 0.8;
  }
}

/* ── Keyframes ─────────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(0.75rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Reduced motion ────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .wizard-content { animation: none; }
  .gender-card, .dot, .other-gender-btn { transition-duration: 0.01s; }
}
</style>

<!-- View Transition pseudo-elements are document-level — cannot be scoped -->
<style>
/* Own the shared name ONLY while the wizard is actively stepping (data-wizard-dir
   is set by transitionStep just for the duration of its own startViewTransition).
   Every navigation is a global View Transition now (nuxt.config), so gating the
   name here keeps route navs in/out of this page from lifting the wizard content
   out of the root slide — off-step it slides with the page like any other view. */
:root[data-wizard-dir] .wizard-content {
  view-transition-name: wizard-step;
}

::view-transition-old(wizard-step) {
  animation: vt-slide-out-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
::view-transition-new(wizard-step) {
  animation: vt-slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:root[data-wizard-dir="back"]::view-transition-old(wizard-step) {
  animation: vt-slide-out-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
:root[data-wizard-dir="back"]::view-transition-new(wizard-step) {
  animation: vt-slide-in-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes vt-slide-out-left {
  to { opacity: 0; transform: translateX(-2rem); }
}
@keyframes vt-slide-in-right {
  from { opacity: 0; transform: translateX(2rem); }
}
@keyframes vt-slide-out-right {
  to { opacity: 0; transform: translateX(2rem); }
}
@keyframes vt-slide-in-left {
  from { opacity: 0; transform: translateX(-2rem); }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(wizard-step),
  ::view-transition-new(wizard-step) { animation-duration: 0.01s; }
}
</style>

