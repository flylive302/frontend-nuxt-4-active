// ~/utils/toFormData.ts
export type ToFormDataInput = {
    number: number
    message?: string
    proofs: File[]
}

export function toFormData(input: ToFormDataInput): FormData {
    const fd = new FormData()
    fd.set('number', String(input.number))
    if (input.message && input.message.trim().length) fd.set('message', input.message.trim())
    for (const file of input.proofs) {
        fd.append('proofs[]', file)
    }
    return fd
}
