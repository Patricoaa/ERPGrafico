import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "../api/settingsApi"
import type { SystemStatus } from "../types"

interface UseSystemStatusReturn {
    status: SystemStatus | undefined
    isLoading: boolean
    refetch: () => Promise<unknown>
}

export function useSystemStatus(): UseSystemStatusReturn {
    const { data: status, isLoading, refetch } = useQuery({
        queryKey: ["system-status"],
        queryFn: () => settingsApi.getSystemStatus(),
        refetchInterval: 30000,
    })

    return { status, isLoading, refetch }
}
