import { useState, useEffect } from 'react'
import api from '@/lib/api'

export function useSuggestions(url: string | undefined, query: string) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!url || query.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      setIsLoading(true)
      try {
        const { data } = await api.get<string[]>(url, { params: { q: query } })
        if (!cancelled) setSuggestions(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [url, query])

  return { suggestions, isLoading }
}
