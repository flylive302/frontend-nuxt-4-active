import { describe, it, expect } from 'vitest'

import { toFormData } from '../../app/utils/toFormData'

function createFile(name: string, content: string, type = 'text/plain'): File {
    return new File([content], name, { type })
}

describe('toFormData', () => {
    it('stringifies numbers, trims message, and appends proofs', () => {
        const files = [
            createFile('proof-1.txt', 'first-proof'),
            createFile('proof-2.txt', 'second-proof'),
        ]

        const fd = toFormData({ number: 42, message: '  please review  ', proofs: files })

        expect(fd.get('number')).toBe('42')
        expect(fd.get('message')).toBe('please review')

        const entries = Array.from(fd.getAll('proofs[]'))
        expect(entries).toHaveLength(2)
        expect(entries[0]).toBe(files[0])
        expect(entries[1]).toBe(files[1])
    })

    it('omits empty message and still appends proofs', () => {
        const files = [createFile('proof-only.txt', 'data')]

        const fd = toFormData({ number: 7, message: '   ', proofs: files })

        expect(fd.get('number')).toBe('7')
        expect(fd.has('message')).toBe(false)
        expect(fd.getAll('proofs[]')).toEqual(files)
    })
})
