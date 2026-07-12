import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getGlobalHRSettings,
    updateGlobalHRSettings,
    getPayrollConcepts,
    createPayrollConcept,
    updatePayrollConcept,
    deletePayrollConcept,
    getAFPs,
    createAFP,
    updateAFP,
    deleteAFP,
} from '../api/hrApi'
import type { AFP, PayrollConcept } from '@/types/hr'

export const HR_SETTINGS_KEYS = {
    all: ['hr'] as const,
    settings: () => [...HR_SETTINGS_KEYS.all, 'settings'] as const,
    concepts: () => [...HR_SETTINGS_KEYS.all, 'concepts'] as const,
    afps: () => [...HR_SETTINGS_KEYS.all, 'afps'] as const,
}

interface GlobalHRSettings {
    uf_current_value: string
    utm_current_value: string
    min_wage_value: string
}

export function useHrSettings() {
    const queryClient = useQueryClient()

    const settingsQuery = useQuery<GlobalHRSettings>({
        queryKey: HR_SETTINGS_KEYS.settings(),
        queryFn: () => getGlobalHRSettings(),
        staleTime: 10 * 60 * 1000,
    })

    const conceptsQuery = useQuery<PayrollConcept[]>({
        queryKey: HR_SETTINGS_KEYS.concepts(),
        queryFn: () => getPayrollConcepts(),
        staleTime: 10 * 60 * 1000,
    })

    const afpsQuery = useQuery<AFP[]>({
        queryKey: HR_SETTINGS_KEYS.afps(),
        queryFn: () => getAFPs(),
        staleTime: 15 * 60 * 1000,
    })

    const updateSettingsMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => updateGlobalHRSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.settings() })
        },
    })

    const createConceptMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => createPayrollConcept(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.concepts() })
        },
    })

    const updateConceptMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            updatePayrollConcept(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.concepts() })
        },
    })

    const deleteConceptMutation = useMutation({
        mutationFn: (id: number) => deletePayrollConcept(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.concepts() })
        },
    })

    const createAfpMutation = useMutation({
        mutationFn: (data: Record<string, unknown>) => createAFP(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.afps() })
        },
    })

    const updateAfpMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
            updateAFP(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.afps() })
        },
    })

    const deleteAfpMutation = useMutation({
        mutationFn: (id: number) => deleteAFP(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: HR_SETTINGS_KEYS.afps() })
        },
    })

    const isLoading = settingsQuery.isLoading || conceptsQuery.isLoading || afpsQuery.isLoading

    return {
        settings: settingsQuery.data ?? null,
        concepts: conceptsQuery.data ?? [],
        afps: afpsQuery.data ?? [],
        isLoading,

        updateSettings: updateSettingsMutation.mutateAsync,
        createConcept: createConceptMutation.mutateAsync,
        updateConcept: (id: number, data: Record<string, unknown>) =>
            updateConceptMutation.mutateAsync({ id, data }),
        deleteConcept: deleteConceptMutation.mutateAsync,
        createAfp: createAfpMutation.mutateAsync,
        updateAfp: (id: number, data: Record<string, unknown>) =>
            updateAfpMutation.mutateAsync({ id, data }),
        deleteAfp: deleteAfpMutation.mutateAsync,

        refetch: () => {
            settingsQuery.refetch()
            conceptsQuery.refetch()
            afpsQuery.refetch()
        },
    }
}
