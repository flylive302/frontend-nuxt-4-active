// composables/useGeolocation.ts
export const useGeolocation = () => {
    const detectCountry = async (): Promise<string | null> => {
        try {
            // Using a free IP geolocation API
            const response = await fetch('https://ipapi.co/json/')
            const data = await response.json()
            return data.country // Returns country code like 'US', 'GB', etc.
        } catch (error) {
            console.error('Failed to detect country:', error)
            return null
        }
    }

    return {
        detectCountry
    }
}
