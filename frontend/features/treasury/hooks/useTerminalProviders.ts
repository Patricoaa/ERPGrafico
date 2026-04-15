import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import type { PaymentTerminalProvider, PaymentTerminalDevice } from "../types"

/**
 * Hook for managing Payment Terminal Providers
 */
export function useTerminalProviders() {
    const queryClient = useQueryClient()

    const { data: providers = [], isLoading, error, refetch } = useQuery<PaymentTerminalProvider[]>({
        queryKey: ['terminal-providers'],
        queryFn: async () => {
            const res = await api.get('/treasury/terminal-providers/')
            return res.data.results || res.data
        }
    })

    const createProvider = useMutation({
        mutationFn: (data: Partial<PaymentTerminalProvider>) => api.post('/treasury/terminal-providers/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terminal-providers'] })
            toast.success("Proveedor creado exitosamente")
        },
        onError: (err) => showApiError(err, "Error al crear proveedor")
    })

    const updateProvider = useMutation({
        mutationFn: ({ id, data }: { id: number, data: Partial<PaymentTerminalProvider> }) => 
            api.patch(`/treasury/terminal-providers/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terminal-providers'] })
            toast.success("Proveedor actualizado")
        },
        onError: (err) => showApiError(err, "Error al actualizar proveedor")
    })

    const deleteProvider = useMutation({
        mutationFn: (id: number) => api.delete(`/treasury/terminal-providers/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terminal-providers'] })
            toast.success("Proveedor eliminado")
        },
        onError: (err) => showApiError(err, "No se pudo eliminar el proveedor")
    })

    return {
        providers,
        isLoading,
        error,
        refetch,
        createProvider,
        updateProvider,
        deleteProvider
    }
}

/**
 * Hook for managing Payment Terminal Devices (Hardware)
 */
export function useTerminalDevices() {
    const queryClient = useQueryClient()

    const { data: devices = [], isLoading, error, refetch } = useQuery<PaymentTerminalDevice[]>({
        queryKey: ['terminal-devices'],
        queryFn: async () => {
            const res = await api.get('/treasury/terminal-devices/')
            return res.data.results || res.data
        }
    })

    const createDevice = useMutation({
        mutationFn: (data: Partial<PaymentTerminalDevice>) => api.post('/treasury/terminal-devices/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terminal-devices'] })
            toast.success("Dispositivo registrado")
        },
        onError: (err) => showApiError(err, "Error al registrar dispositivo")
    })

    const updateDevice = useMutation({
        mutationFn: ({ id, data }: { id: number, data: Partial<PaymentTerminalDevice> }) => 
            api.patch(`/treasury/terminal-devices/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terminal-devices'] })
            toast.success("Dispositivo actualizado")
        },
        onError: (err) => showApiError(err, "Error al actualizar dispositivo")
    })

    const deleteDevice = useMutation({
        mutationFn: (id: number) => api.delete(`/treasury/terminal-devices/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['terminal-devices'] })
            toast.success("Dispositivo eliminado")
        },
        onError: (err) => showApiError(err, "No se pudo eliminar el dispositivo")
    })

    return {
        devices,
        isLoading,
        error,
        refetch,
        createDevice,
        updateDevice,
        deleteDevice
    }
}
