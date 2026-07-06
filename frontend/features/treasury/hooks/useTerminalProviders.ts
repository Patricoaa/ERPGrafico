import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { invalidateCrossFeature } from "@/lib/invalidation"
import { useRealtime } from "@/features/realtime"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { treasuryApi } from "../api/treasuryApi"
import { TERMINAL_PROVIDERS_KEYS, TERMINAL_DEVICES_KEYS } from "./queryKeys"
import type { PaymentTerminalProvider, PaymentTerminalProviderCreatePayload, PaymentTerminalProviderUpdatePayload } from "../types"
import type { PaymentTerminalDevice, PaymentTerminalDeviceCreatePayload, PaymentTerminalDeviceUpdatePayload } from "../types"
export type { PaymentTerminalProvider, PaymentTerminalDevice }

export function useTerminalProviders() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: providers, isLoading, error, refetch } = useQuery<PaymentTerminalProvider[]>({
        queryKey: TERMINAL_PROVIDERS_KEYS.lists(),
        queryFn: treasuryApi.getTerminalProviders,
        staleTime: 5 * 60 * 1000,
    })

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [TERMINAL_PROVIDERS_KEYS.all])
    }

    const createProvider = useMutation({
        mutationFn: (data: PaymentTerminalProviderCreatePayload) => treasuryApi.createTerminalProvider(data),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success("Proveedor creado exitosamente")
        },
        onError: (err) => showApiError(err, "Error al crear proveedor")
    })

    const updateProvider = useMutation({
        mutationFn: ({ id, data }: { id: number; data: PaymentTerminalProviderUpdatePayload }) =>
            treasuryApi.updateTerminalProvider(id, data),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success("Proveedor actualizado")
        },
        onError: (err) => showApiError(err, "Error al actualizar proveedor")
    })

    const deleteProvider = useMutation({
        mutationFn: (id: number) => treasuryApi.deleteTerminalProvider(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success("Proveedor eliminado")
        },
        onError: (err) => showApiError(err, "No se pudo eliminar el proveedor")
    })

    return {
        providers: providers ?? [],
        isLoading,
        error,
        refetch,
        createProvider: createProvider.mutateAsync,
        updateProvider: updateProvider.mutateAsync,
        deleteProvider: deleteProvider.mutateAsync,
    }
}

export function useTerminalDevices(filters?: Record<string, string>) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: devices, isLoading, error, refetch } = useQuery<PaymentTerminalDevice[]>({
        queryKey: [...TERMINAL_DEVICES_KEYS.lists(), filters],
        queryFn: () => treasuryApi.getTerminalDevices(filters),
        staleTime: 15 * 60 * 1000,
    })

    const invalidate = () => {
        invalidateCrossFeature(queryClient, [TERMINAL_DEVICES_KEYS.all])
    }

    const createDevice = useMutation({
        mutationFn: (data: PaymentTerminalDeviceCreatePayload) => treasuryApi.createTerminalDevice(data),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success("Dispositivo registrado")
        },
        onError: (err) => showApiError(err, "Error al registrar dispositivo")
    })

    const updateDevice = useMutation({
        mutationFn: ({ id, data }: { id: number; data: PaymentTerminalDeviceUpdatePayload }) =>
            treasuryApi.updateTerminalDevice(id, data),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success("Dispositivo actualizado")
        },
        onError: (err) => showApiError(err, "Error al actualizar dispositivo")
    })

    const deleteDevice = useMutation({
        mutationFn: (id: number) => treasuryApi.deleteTerminalDevice(id),
        onSuccess: () => {
            markLocalMutation()
            invalidate()
            toast.success("Dispositivo eliminado")
        },
        onError: (err) => showApiError(err, "No se pudo eliminar el dispositivo")
    })

    return {
        devices: devices ?? [],
        isLoading,
        error,
        refetch,
        createDevice: createDevice.mutateAsync,
        updateDevice: updateDevice.mutateAsync,
        deleteDevice: deleteDevice.mutateAsync,
    }
}
