// ========================================
// Imports & Types
// ========================================
import { z } from 'zod'
import { computed, toValue, type MaybeRef } from 'vue'
import type { CountryCode } from 'libphonenumber-js/min'

// Loaded asynchronously — 118 KB that must not block initial render.
// Starts fetching when this module first evaluates; by the time a user
// selects a country and types digits, it is already resolved.
let _parsePhone: typeof import('libphonenumber-js/min').parsePhoneNumber | null = null
import('libphonenumber-js/min').then(m => { _parsePhone = m.parsePhoneNumber }).catch(() => {})

// ========================================
// Types
// ========================================
export interface Country {
  name: string
  flag: string
  code: string // ISO-2
  dial_code: string // "+93"
}

export interface PhoneModel {
  countryCode: string // ISO-2
  dialCode: string // "+93"
  phone: string // national digits
}

// ========================================
// Helpers / Utilities
// ========================================

/**
 * Normalizes a phone number by combining dial code and phone number, removing non-digits.
 * @param dialCode - The country dial code (e.g., "+1")
 * @param phone - The phone number string
 * @returns The normalized phone string
 */
export function normalizePhone(dialCode: string, phone: string): string {
  return `${dialCode}${phone.replace(/\D/g, '')}`
}

// ========================================
// Composable
// ========================================

/**
 * Creates a Zod schema for phone number validation based on the selected country.
 * @param country - The selected country object (reactive or static)
 * @returns A computed Zod schema for phone validation
 */
export function usePhoneSchema(country: MaybeRef<Pick<Country, 'code' | 'name'> | undefined>) {
  return computed(() =>
    z.object({
      countryCode: z.string().min(2, 'Country is required'),
      dialCode: z.string().startsWith('+', 'Invalid dial code'),
      phone: z.string().min(1, 'Phone number is required'),
    }).superRefine((data, ctx) => {
      const c = toValue(country)

      if (!c?.code) {
        ctx.addIssue({
          code: "custom",
          path: ['phone'],
          message: 'Select a country'
        })
        return
      }

      if (!_parsePhone) return

      try {
        const e164 = normalizePhone(data.dialCode, data.phone)
        const parsed = _parsePhone(e164, c.code.toUpperCase() as CountryCode)

        if (!parsed?.isValid()) {
          throw new Error('invalid')
        }
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ['phone'],
          message: `Invalid phone number for ${c.name ?? 'country'}`
        })
      }
    })
  )
}
