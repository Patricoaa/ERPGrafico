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
    } catch (error: unknown) {
        console.error('Error validating accounting period:', error)
        const apiError = error as { response?: { data?: { error?: string } } }
        return { is_closed: false, error: apiError.response?.data?.error || 'Failed to validate period' }
    }
}
