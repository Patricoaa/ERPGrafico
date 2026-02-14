import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { settingsApi } from '../api/settingsApi'
import type { InventorySettings, InventorySettingsUpdatePayload } from '../types'

interface UseInventorySettingsReturn {
    settings: Partial<InventorySettings>
    loading: boolean
    saving: boolean
    error: Error | null
    updateSettings: (payload: InventorySettingsUpdatePayload) => Promise<void>
    refetch: () => Promise<void>
}

/**
 * Custom hook for managing inventory settings
 * Handles fetching and updating inventory-related accounting settings
 */
export function useInventorySettings(): UseInventorySettingsReturn {
    const [settings, setSettings] = useState<Partial<InventorySettings>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchSettings = useCallback(async (): Promise<void> => {
        try {
            setLoading(true)
            setError(null)
            const data = await settingsApi.getInventorySettings()
            setSettings(data)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to fetch inventory settings')
            setError(error)
            toast.error('Error al cargar configuración de inventario')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const updateSettings = useCallback(async (payload: InventorySettingsUpdatePayload): Promise<void> => {
        try {
            setSaving(true)
            await settingsApi.updateInventorySettings(payload)
            toast.success('Configuración de inventario aplicada')
            await fetchSettings()
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update inventory settings')
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
