import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface VatRateResponse {
    rate: number
    multiplier: number
}

export const VAT_RATE_QUERY_KEY = ['accounting', 'vat_rate'] as const

async function fetchVatRate(): Promise<VatRateResponse> {
    const res = await api.get<VatRateResponse>('/accounting/settings/vat/')
    return res.data
}

export function useVatRate() {
    const query = useQuery({
        queryKey: VAT_RATE_QUERY_KEY,
        queryFn: fetchVatRate,
        staleTime: Infinity,
    })

    return {
        rate: query.data?.rate ?? 19,
        multiplier: query.data?.multiplier ?? 1.19,
        isLoading: query.isLoading,
    }
}
