import { z } from 'zod'
import { computed, toValue, type MaybeRef } from 'vue'
import { parsePhoneNumber } from 'libphonenumber-js'

export type Country = {
    name: string
    flag: string
    code: string   // ISO-2
    dial_code: string // "+93"
}

export type PhoneModel = {
    countryCode: string   // ISO-2
    dialCode: string      // "+93"
    phone: string         // national digits
}

export const normalizePhone = (dialCode: string, phone: string) =>
    `${dialCode}${phone.replace(/\D/g, '')}`

export const usePhoneSchema = (
    country: MaybeRef<Pick<Country, 'code' | 'name'> | undefined>
) => computed(() =>
    z.object({
        countryCode: z.string().min(2, 'Country is required'),
        dialCode: z.string().startsWith('+', 'Invalid dial code'),
        phone: z.string().min(1, 'Phone number is required'),
    }).superRefine((data, ctx) => {
        const c = toValue(country)
        if (!c?.code) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'Select a country' })
            return
        }
        try {
            const e164 = normalizePhone(data.dialCode, data.phone)
            const parsed = parsePhoneNumber(e164, c.code as any)
            if (!parsed?.isValid()) throw new Error('invalid')
        } catch {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: `Invalid phone number for ${c.name ?? 'country'}` })
        }
    })
)
