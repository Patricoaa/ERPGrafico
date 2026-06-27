'use server'

import { taxApi } from './api/taxApi'

export async function validateTaxPeriod(date: string) {
    if (!date) return { is_closed: false }
    try {
        return await taxApi.checkPeriodClosed(date) as { is_closed: boolean; date: string }
    } catch (error: unknown) {
        console.error('Error validating tax period:', error)
        const apiError = error as { response?: { data?: { error?: string } } }
        return { is_closed: false, error: apiError.response?.data?.error || 'Failed to validate' }
    }
}
