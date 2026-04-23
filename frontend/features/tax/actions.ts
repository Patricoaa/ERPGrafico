'use server'

import api from '@/lib/api'

/**
 * Checks if a specific date belongs to a CLOSED tax period.
 * @param date ISO Date string (YYYY-MM-DD)
 */
export async function validateTaxPeriod(date: string) {
    if (!date) return { is_closed: false }
    
    try {
        const response = await api.get(`tax/periods/check_closed/?date=${date}`)
        return response.data as { is_closed: boolean; date: string }
    } catch (error: any) {
        console.error('Error validating tax period:', error)
        // If there's an error, we don't block by default, but we log it
        return { is_closed: false, error: error.response?.data?.error || 'Failed to validate' }
    }
}
