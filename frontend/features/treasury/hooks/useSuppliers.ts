import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import type { ContactBrief } from '../types'
import { staleTime } from '@/lib/query-config'

export function useSuppliers(hasTerminalPaymentMethod = true) {
    const { data: suppliers, isLoading } = useQuery<ContactBrief[]>({
        queryKey: ['suppliers', { has_terminal_payment_method: hasTerminalPaymentMethod }],
        queryFn: () => treasuryApi.getSuppliers({
            is_supplier: true,
            has_terminal_payment_method: hasTerminalPaymentMethod,
        }),
        staleTime: staleTime.stable,
    })

    return {
        suppliers: suppliers ?? [],
        isLoading,
    }
}
