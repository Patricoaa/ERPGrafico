import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { Account } from "@/types/entities"

interface UseAccountSearchReturn {
    accounts: Account[]
    loading: boolean
    fetchAccounts: (search?: string, isLeaf?: boolean) => Promise<void>
}

const globalCache: Record<string, Account[]> = {}

export function useAccountSearch(): UseAccountSearchReturn {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(false)

    const fetchAccounts = useCallback(async (search: string = "", isLeaf: boolean = false) => {
        const cacheKey = `${search}_${isLeaf}`
        if (globalCache[cacheKey]) {
            setAccounts(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            if (isLeaf) params.append("is_leaf", "true")
            
            // Limit to 50 for search
            if (search) params.append("limit", "50")

            const res = await api.get(`/accounting/accounts/?${params.toString()}`)
            const data = res.data.results || res.data
            
            globalCache[cacheKey] = data
            setAccounts(data)
        } catch (err) {
            showApiError(err, "Error al buscar cuentas contables")
            setAccounts([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { accounts, loading, fetchAccounts }
}
