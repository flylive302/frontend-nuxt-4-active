// server/api/detect-country.ts
import { getRequestIP } from 'h3'

export default defineEventHandler(async (event) => {
    try {
        // Get the client's IP address from the request
        const ip = getRequestIP(event, { xForwardedFor: true })

        // For development, you might get localhost IPs
        if (!ip || ip === '127.0.0.1' || ip === '::1') {
            // Return a default or use a test IP
            return { country_code: null }
        }

        // Use a free geolocation service
        const response = await $fetch<{ country: string }>(`https://get.geojs.io/v1/ip/country/${ip}.json`, {
            timeout: 3000, // 3 second timeout
        })
        
        return {
            country_code: response.country?.toLowerCase() ?? null,
        }
    } catch (error) {
        console.error('Geolocation error:', error)
        return { country_code: null }
    }
})