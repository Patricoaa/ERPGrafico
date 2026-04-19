import { showApiError } from "@/lib/errors"
import { useQueryClient, useMutation, useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { contactsApi } from '../api/contactsApi'
import { toast } from 'sonner'
import { ContactFilters, ContactPayload } from '../types'

const CONTACTS_KEYS = {
    all: ['contacts'] as const,
    lists: () => [...CONTACTS_KEYS.all, 'list'] as const,
    list: (filters: ContactFilters) => [...CONTACTS_KEYS.lists(), { filters }] as const,
    details: () => [...CONTACTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...CONTACTS_KEYS.details(), id] as const,
    insights: (id: number) => [...CONTACTS_KEYS.detail(id), 'insights'] as const,
}

export function useContacts({ filters }: { filters?: ContactFilters } = {}) {
    const queryClient = useQueryClient()

    const { data: contacts, refetch } = useSuspenseQuery({
        queryKey: CONTACTS_KEYS.list(filters || {}),
        queryFn: () => contactsApi.getContacts(filters),
    })

    return {
        contacts,
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
        queryKey: CONTACTS_KEYS.insights(id!),
        queryFn: () => contactsApi.getInsights(id!),
        enabled: !!id,
    })
}
