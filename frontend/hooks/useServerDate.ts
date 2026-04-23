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
    const { data, isLoading, error } = useQuery({
        queryKey: ['server-time'],
        queryFn: async () => {
            try {
                const response = await api.get<ServerDateResponse>('/core/server-time/')
                return response.data
            } catch (err: any) {
                // If the server fails or rate limits, fallback to the local machine date.
                // This prevents the application from breaking over a minor utility endpoint.
                console.warn('Could not fetch server time, falling back to local time', err?.message)
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
        staleTime: 5 * 60 * 1000, 
        refetchOnWindowFocus: false,
    })

    const serverDate = data ? new Date(data.year, data.month - 1, data.day) : null

    return {
        serverDate,
        isLoading,
        error: error ? (error as Error) : null,
        dateString: data?.date || '',
        year: data?.year || null,
        month: data?.month || null
    }
}
