'use server'

import { accountingApi } from './api/accountingApi'

/**
 * Checks if a specific date belongs to a CLOSED accounting period.
 * @param date ISO Date string (YYYY-MM-DD)
 */
export async function validateAccountingPeriod(date: string) {
    if (!date) return { is_closed: false }
    
    try {
        return await accountingApi.checkPeriodClosed(date)
    } catch (error: unknown) {
        console.error('Error validating accounting period:', error)
        const apiError = error as { response?: { data?: { error?: string } } }
        return { is_closed: false, error: apiError.response?.data?.error || 'Failed to validate period' }
    }
}
