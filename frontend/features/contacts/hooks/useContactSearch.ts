import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Contact } from '@/types/entities'

export interface ContactSearchParams {
    search?: string
    contactType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | 'NONE'
    isPartnerOnly?: boolean
    isCustomer?: boolean
    isVendor?: boolean
    limit?: number
    fetchSingleId?: string | number | null
}

export const CONTACT_KEYS = {
    all: ['contacts'] as const,
    search: (params: ContactSearchParams) => [...CONTACT_KEYS.all, 'search', params] as const,
    detail: (id: string | number) => [...CONTACT_KEYS.all, 'detail', id] as const,
}

export function useContactSearch(params: ContactSearchParams = {}, enabled: boolean = true) {
    const { search = "", contactType, isCustomer, isVendor, isPartnerOnly, limit = 50 } = params

    const query = useQuery({
        queryKey: CONTACT_KEYS.search({ search, contactType, isCustomer, isVendor, isPartnerOnly, limit }),
        queryFn: async ({ signal }) => {
            const q = new URLSearchParams()
            if (search) q.append("search", search)
            if (contactType) q.append("type", contactType)
            if (isCustomer !== undefined && isCustomer) q.append("is_customer", "true")
            if (isVendor !== undefined && isVendor) q.append("is_vendor", "true")
            if (isPartnerOnly) q.append("is_partner", "true")
            
            const res = await api.get(`/contacts/?${q.toString()}`, { signal })
            return (res.data.results || res.data) as Contact[]
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        contacts: query.data ?? [],
        loading: query.isLoading,
        isFetching: query.isFetching,
    }
}

export function useSingleContact(id: string | number | null) {
    const query = useQuery({
        queryKey: CONTACT_KEYS.detail(id!),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/contacts/${id}/`, { signal })
            return res.data as Contact
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        contact: query.data ?? null,
        loading: query.isLoading,
    }
}
