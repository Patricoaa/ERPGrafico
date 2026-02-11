import { useState, useEffect } from 'react'
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
    const [serverDate, setServerDate] = useState<Date | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        const fetchServerDate = async () => {
            try {
                const response = await api.get<ServerDateResponse>('/core/server-time/')
                setServerDate(new Date(response.data.datetime))
                setError(null)
            } catch (err) {
                console.error('Error fetching server date:', err)
                setError(err as Error)
                // Fallback to client date with simple warning logs, 
                // but application continues using client date.
                setServerDate(new Date())
            } finally {
                setIsLoading(false)
            }
        }
        fetchServerDate()
    }, [])

    return {
        serverDate,
        isLoading,
        error,
        dateString: serverDate?.toISOString().split('T')[0] || '',
        year: serverDate?.getFullYear() || new Date().getFullYear(),
        month: serverDate ? serverDate.getMonth() + 1 : new Date().getMonth() + 1
    }
}
