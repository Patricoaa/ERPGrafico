import { useQuery } from "@tanstack/react-query"
import { contactsApi } from "../api/contactsApi"

export function useDefaultCustomer(enabled: boolean) {
    return useQuery({
        queryKey: ['contacts', 'defaultCustomer'],
        queryFn: async () => {
            const data = await contactsApi.getContacts({ is_default_customer: true })
            return data?.[0] ?? null
        },
        staleTime: 10 * 60 * 1000,
        enabled
    })
}

export function useDefaultVendor(enabled: boolean) {
    return useQuery({
        queryKey: ['contacts', 'defaultVendor'],
        queryFn: async () => {
            const data = await contactsApi.getContacts({ is_default_vendor: true })
            return data?.[0] ?? null
        },
        staleTime: 10 * 60 * 1000,
        enabled
    })
}
