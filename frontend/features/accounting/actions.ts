'use server'

import api from '@/lib/api'

/**
 * Checks if a specific date belongs to a CLOSED accounting period.
 * @param date ISO Date string (YYYY-MM-DD)
 */
export async function validateAccountingPeriod(date: string) {
    if (!date) return { is_closed: false }
    
    try {
        const response = await api.get(`tax/accounting-periods/check_closed/?date=${date}`)
        return response.data as { is_closed: boolean; date: string; period_name?: string }
    } catch (error: any) {
        console.error('Error validating accounting period:', error)
        // If there's an error, we don't block by default but report it
        return { is_closed: false, error: error.response?.data?.error || 'Failed to validate period' }
    }
}
