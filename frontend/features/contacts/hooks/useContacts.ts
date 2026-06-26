import { showApiError } from "@/lib/errors"
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { contactsApi } from '../api/contactsApi'
import { toast } from 'sonner'
import { type ContactFilters, type ContactPayload, type Contact } from '../types'
import { SALES_KEYS } from '@/features/sales/hooks/useSalesOrders'
import { PURCHASING_KEYS } from '@/features/purchasing/hooks/usePurchasing'

import { CONTACTS_KEYS } from './queryKeys'

export { CONTACTS_KEYS }

export function useContacts({ filters, initialData }: { filters?: ContactFilters, initialData?: Contact[] } = {}) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: CONTACTS_KEYS.list(filters || {}),
        queryFn: () => contactsApi.getContacts(filters),
        staleTime: 5 * 60 * 1000, // 5 min
        initialData,
        placeholderData: (prev) => prev,
    })

    const contacts = query.data ?? []
    const showSkeleton = query.isLoading && !contacts.length
    const isRefetching = query.isFetching && !showSkeleton
    const refetch = query.refetch

    return {
        contacts,
        isLoading: showSkeleton,
        isRefetching,
        refetch,
        ...useContactMutations()
    }
}

export function useContactMutations() {
    const queryClient = useQueryClient()

    const createMutation = useMutation({
        mutationFn: contactsApi.createContact,
        onSuccess: () => {
            toast.success('Contacto creado exitosamente')
            queryClient.invalidateQueries({ queryKey: CONTACTS_KEYS.lists() })
            // A new contact might appear in order/purchase contact filter dropdowns
            queryClient.invalidateQueries({ queryKey: [...SALES_KEYS.all, 'orders'] })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.orders() })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al crear el contacto')
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number, payload: Partial<ContactPayload> }) =>
            contactsApi.updateContact(id, payload),
        onSuccess: (data) => {
            toast.success('Contacto actualizado exitosamente')
            queryClient.invalidateQueries({ queryKey: CONTACTS_KEYS.lists() })
            queryClient.invalidateQueries({ queryKey: CONTACTS_KEYS.detail(data.id) })
            // Contact name change propagates to order/purchase contact display
            queryClient.invalidateQueries({ queryKey: [...SALES_KEYS.all, 'orders'] })
            queryClient.invalidateQueries({ queryKey: PURCHASING_KEYS.orders() })
        },
        onError: (error: Error) => {
            showApiError(error, 'Error al actualizar el contacto')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: contactsApi.deleteContact,
        onSuccess: () => {
            toast.success('Contacto eliminado exitosamente')
            queryClient.invalidateQueries({ queryKey: CONTACTS_KEYS.lists() })
        },
        onError: (error: Error) => {
            console.error(error)
            toast.error('No se pudo eliminar el contacto. Puede que tenga documentos asociados.')
        }
    })

    return {
        createContact: createMutation.mutateAsync,
        updateContact: updateMutation.mutateAsync,
        deleteContact: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    }
}

export function useContactInsights(id: number | undefined) {
    return useQuery({
        queryKey: id ? CONTACTS_KEYS.insights(id) : ['contacts', 'insights', 'noop'],
        queryFn: () => contactsApi.getInsights(id as number),
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 min
    })
}

/** Detalle reactivo de un contact. */
export function useContact(id: number | null | undefined) {
    return useQuery({
        queryKey: id ? CONTACTS_KEYS.detail(id) : ['contacts', 'detail', 'noop'],
        queryFn: () => contactsApi.getContact(id as number),
        staleTime: 5 * 60 * 1000,
        enabled: !!id,
    })
}

export interface PendingDebt {
    id: number
    balance: string | number
    [key: string]: unknown
}

/**
 * Ledger de crédito del contacto: lista de deudas pendientes (saldo > 0).
 * El componente recibe solo las que tienen balance positivo (filtro
 * client-side preservado para no romper el contrato existente).
 */
export function useContactCreditLedger(contactId: number | null | undefined) {
    return useQuery<PendingDebt[]>({
        queryKey: contactId ? [...CONTACTS_KEYS.detail(contactId), 'creditLedger'] : ['contacts', 'creditLedger', 'noop'],
        queryFn: async () => {
            const data = await contactsApi.getCreditLedger(contactId as number)
            return data.filter(d => Number(d.balance) > 0)
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!contactId,
    })
}
