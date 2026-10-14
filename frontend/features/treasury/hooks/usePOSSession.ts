import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { staleTime } from '@/lib/query-config'

export function usePOSSession(id: number | null) {
    const { data, isLoading } = useQuery({
        queryKey: ['pos-session', id],
        queryFn: () => treasuryApi.getPOSSession(id as number),
        staleTime: staleTime.volatile,
        enabled: !!id,
    })

    return {
        session: data ?? null,
        isLoading,
    }
}
