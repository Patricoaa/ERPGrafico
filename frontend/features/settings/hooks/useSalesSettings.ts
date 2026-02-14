import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { SalesSettings, SalesSettingsUpdatePayload } from '../types'

interface UseSalesSettingsReturn {
    settings: Partial<SalesSettings>
    loading: boolean
    saving: boolean
    error: Error | null
    updateSettings: (payload: SalesSettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<void>
}

/**
 * Custom hook for managing sales settings
 * Handles fetching and updating sales-related accounting settings
 */
export function useSalesSettings(): UseSalesSettingsReturn {
    const [settings, setSettings] = useState<Partial<SalesSettings>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchSettings = useCallback(async (): Promise<void> => {
        try {
            setLoading(true)
            setError(null)
            const data = await settingsApi.getSalesSettings()
            setSettings(data)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch sales settings')
            setError(error)
            toast.error('Error al cargar configuración de ventas')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const updateSettings = useCallback(async (payload: SalesSettingsUpdatePayload): Promise<void> => {
        try {
            setSaving(true)
            await settingsApi.updateSalesSettings(payload)
            toast.success('Configuración de ventas aplicada')
            await fetchSettings()
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update sales settings')
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
