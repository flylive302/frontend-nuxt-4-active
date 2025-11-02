export const useGeolocation = () => {
    const detectCountry = async (): Promise<string | null> => {
        try {
            const { country_code } = await $fetch<{ country_code: string | null }>('/api/detect-country')
            return country_code
        } catch (error) {
            console.error('Failed to detect country:', error)
            return null
        }
    }
    return { detectCountry }
}