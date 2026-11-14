"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { showApiError } from '@/lib/errors'
import { staleTime } from '@/lib/query-config'
import { useRealtime } from '@/features/realtime'
import { rcvApi } from '../api/rcvApi'
import { RCV_KEYS } from './queryKeys'
import type { RcvApiKeyPayload, RcvSettingsPatch } from '../types'

export function useRcvSettings() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: RCV_KEYS.settings(),
        queryFn: () => rcvApi.getSettings(),
        staleTime: staleTime.stable,
    })

    return { settings: data, isLoading, isError, refetch }
}

export function useUpdateRcvSettings() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const mutation = useMutation({
        mutationFn: (patch: RcvSettingsPatch) => rcvApi.updateSettings(patch),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [RCV_KEYS.settings()])
            toast.success('Configuración RCV guardada')
        },
        onError: (err) => showApiError(err, 'Error al guardar la configuración RCV'),
    })

    return { updateSettings: mutation.mutateAsync, isUpdating: mutation.isPending }
}

export function useRcvApiKeys() {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: RCV_KEYS.apiKeys(),
        queryFn: () => rcvApi.getApiKeys(),
        staleTime: staleTime.stable,
    })

    return { apiKeys: data ?? [], isLoading, isError, refetch }
}

export function useRcvApiKeyMutations() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    // Cupo y claves se reflejan también en la configuración (cuota total estimada).
    const onDone = (message: string) => {
        invalidateCrossFeature(queryClient, [RCV_KEYS.apiKeys(), RCV_KEYS.settings()])
        toast.success(message)
    }

    const create = useMutation({
        mutationFn: (payload: RcvApiKeyPayload) => rcvApi.createApiKey(payload),
        onSuccess: () => {
            markLocalMutation()
            onDone('API key agregada')
        },
        onError: (err) => showApiError(err, 'Error al agregar la API key'),
    })

    const update = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: RcvApiKeyPayload }) => rcvApi.updateApiKey(id, payload),
        onSuccess: () => {
            markLocalMutation()
            onDone('API key actualizada')
        },
        onError: (err) => showApiError(err, 'Error al actualizar la API key'),
    })

    const remove = useMutation({
        mutationFn: (id: number) => rcvApi.deleteApiKey(id),
        onSuccess: () => {
            markLocalMutation()
            onDone('API key eliminada')
        },
        onError: (err) => showApiError(err, 'Error al eliminar la API key'),
    })

    return {
        create: create.mutateAsync,
        update: update.mutateAsync,
        remove: remove.mutateAsync,
        isCreating: create.isPending,
        isUpdating: update.isPending,
        isRemoving: remove.isPending,
    }
}
