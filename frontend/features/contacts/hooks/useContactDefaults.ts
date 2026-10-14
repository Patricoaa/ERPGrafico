import { useQuery } from "@tanstack/react-query"
import { contactsApi } from "../api/contactsApi"
import { staleTime } from '@/lib/query-config'

export function useDefaultCustomer(enabled: boolean) {
    const { data: defaultCustomer, isLoading, isError } = useQuery({
        queryKey: ['contacts', 'defaultCustomer'],
        queryFn: async () => {
            const data = await contactsApi.getContacts({ is_default_customer: true })
            return data?.[0] ?? null
        },
        staleTime: staleTime.slow,
        enabled
    })
    return { defaultCustomer: defaultCustomer ?? null, isLoading, isError }
}

export function useDefaultVendor(enabled: boolean) {
    const { data: defaultVendor, isLoading, isError } = useQuery({
        queryKey: ['contacts', 'defaultVendor'],
        queryFn: async () => {
            const data = await contactsApi.getContacts({ is_default_vendor: true })
            return data?.[0] ?? null
        },
        staleTime: staleTime.slow,
        enabled
    })
    return { defaultVendor: defaultVendor ?? null, isLoading, isError }
}
