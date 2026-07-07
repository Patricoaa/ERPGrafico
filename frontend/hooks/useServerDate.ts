import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface ServerDateResponse {
    datetime: string
    date: string
    year: number
    month: number
    day: number
    timezone: string
}

export function useServerDate() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['server-time'],
        queryFn: async () => {
            try {
                const response = await api.get<ServerDateResponse>('/core/server-time/')
                return response.data
            } catch (err: unknown) {
                // If the server fails or rate limits, fallback to the local machine time.
                // This prevents the application from breaking over a minor utility endpoint.
                console.warn('Could not fetch server time, falling back to local time', err instanceof Error ? err.message : err)
                const now = new Date()
                return {
                    datetime: now.toISOString(),
                    date: now.toISOString().split('T')[0],
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                    day: now.getDate(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                } as ServerDateResponse
            }
        },
        staleTime: 30 * 1000, 
        refetchOnWindowFocus: false,
    })

    const serverDate = useMemo(
        () => (data ? new Date(data.year, data.month - 1, data.day) : null),
        [data?.year, data?.month, data?.day]
    )

    return {
        serverDate,
        isLoading,
        isError,
        dateString: data?.date || '',
        year: data?.year || null,
        month: data?.month || null
    }
}
