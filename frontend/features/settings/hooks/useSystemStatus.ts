import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "../api/settingsApi"

export const useSystemStatus = () => {
    return useQuery({
        queryKey: ["system-status"],
        queryFn: () => settingsApi.getSystemStatus(),
        refetchInterval: 30000, // Refresh every 30 seconds
    })
}
