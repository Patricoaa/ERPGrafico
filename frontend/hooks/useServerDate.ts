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
    const [rawDate, setRawDate] = useState<string>('')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        const fetchServerDate = async () => {
            try {
                const response = await api.get<ServerDateResponse>('/core/server-time/')
                setServerDate(new Date(response.data.datetime))
                setRawDate(response.data.date)
                setError(null)
            } catch (err) {
                console.error('Error fetching server date:', err)
                setError(err as Error)
                const now = new Date()
                setServerDate(now)
                setRawDate(now.toISOString().split('T')[0])
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
        dateString: rawDate,
        year: serverDate?.getFullYear() || new Date().getFullYear(),
        month: serverDate ? serverDate.getMonth() + 1 : new Date().getMonth() + 1
    }
}
