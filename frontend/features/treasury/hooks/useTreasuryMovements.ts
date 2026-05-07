import { useSuspenseQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface TreasuryMovement {
    id: number
    display_id: string
    movement_type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    movement_type_display: string
    payment_method: string
    payment_method_display: string
    amount: number
    created_at: string
    date: string
    created_by_name: string
    notes: string
    pos_session: number | null
    from_account: number | null
    from_account_name: string | null
    from_account_account_id: number | null
    from_account_code: string | null
    to_account: number | null
    to_account_name: string | null
    to_account_account_id: number | null
    to_account_code: string | null
    justify_reason: string | null
    justify_reason_display: string | null
    partner_name: string | null
    partner_id: number | null
    reference: string | null
    involved_accounts?: string[]
    document_info?: {
        type: string | null
        id: number | null
        number: string | null
        label: string | null
    } | null
}

export const TREASURY_MOVEMENTS_QUERY_KEY = ['treasuryMovements']

export function useTreasuryMovements() {
    const { data: movements, refetch } = useSuspenseQuery({
        queryKey: TREASURY_MOVEMENTS_QUERY_KEY,
        queryFn: async (): Promise<TreasuryMovement[]> => {
            const response = await api.get('/treasury/movements/')
            return response.data.results || response.data
        },
    })

    return {
        movements,
        refetch,
    }
}
