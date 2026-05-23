import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import type { ContactBrief } from '../types'

export function useSuppliers(hasTerminalPaymentMethod = true) {
    const { data: suppliers, isLoading } = useQuery<ContactBrief[]>({
        queryKey: ['suppliers', { has_terminal_payment_method: hasTerminalPaymentMethod }],
        queryFn: () => treasuryApi.getSuppliers({
            is_supplier: true,
            has_terminal_payment_method: hasTerminalPaymentMethod,
        }),
        staleTime: 5 * 60 * 1000,
    })

    return {
        suppliers: suppliers ?? [],
        isLoading,
    }
}
