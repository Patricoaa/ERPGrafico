import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "../api/settingsApi"

export interface BackgroundJob {
    id: number
    job_type: string
    job_type_display: string
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
    status_display: string
    title: string
    progress_percent: number
    result_file_url: string | null
    error_message: string
    completed_at: string | null
    created_at: string
}

export function useBackgroundJobs() {
    const { data: jobs = [], isLoading, error, refetch } = useQuery<BackgroundJob[]>({
        queryKey: ["background_jobs"],
        queryFn: async () => {
            const data = await settingsApi.getBackgroundJobs()
            return data as unknown as BackgroundJob[]
        },
        refetchInterval: (query) => {
            const hasActiveJobs = query.state.data?.some(j => j.status === "PENDING" || j.status === "PROCESSING")
            return hasActiveJobs ? 3000 : false
        },
    })

    return { jobs, isLoading, error, refetch }
}
