import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { BillingSettings, BillingSettingsUpdatePayload } from '../types'

interface UseBillingSettingsReturn {
    settings: Partial<BillingSettings>
    loading: boolean
    saving: boolean
    error: Error | null
    updateSettings: (payload: BillingSettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<void>
}

/**
 * Custom hook for managing billing settings
 * Handles fetching and updating billing-related accounting settings
 */
export function useBillingSettings(): UseBillingSettingsReturn {
    const [settings, setSettings] = useState<Partial<BillingSettings>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchSettings = useCallback(async (): Promise<void> => {
        try {
            setLoading(true)
            setError(null)
            const data = await settingsApi.getBillingSettings()
            setSettings(data)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch billing settings')
            setError(error)
            toast.error('Error al cargar configuración de facturación')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const updateSettings = useCallback(async (payload: BillingSettingsUpdatePayload): Promise<void> => {
        try {
            setSaving(true)
            await settingsApi.updateBillingSettings(payload)
            toast.success('Configuración de facturación aplicada')
            await fetchSettings()
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update billing settings')
            setError(error)
            toast.error('Error al guardar cambios')
            throw error
        } finally {
            setSaving(false)
        }
    }, [fetchSettings])

    return {
        settings,
        loading,
        saving,
        error,
        updateSettings,
        refetch: fetchSettings,
    }
}
