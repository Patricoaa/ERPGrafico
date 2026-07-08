import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'

export function usePOSSession(id: number | null) {
    const { data, isLoading } = useQuery({
        queryKey: ['pos-session', id],
        queryFn: () => treasuryApi.getPOSSession(id as number),
        staleTime: 1 * 60 * 1000,
        enabled: !!id,
    })

    return {
        session: data ?? null,
        isLoading,
    }
}
