import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { TreasuryAccount } from "@/types/entities"

interface UseTreasuryAccountSearchReturn {
    accounts: TreasuryAccount[]
    singleAccount: TreasuryAccount | null
    loading: boolean
    fetchAccounts: (search?: string) => Promise<void>
    fetchSingleAccount: (id: string | number) => Promise<void>
}

const globalCache: Record<string, TreasuryAccount[]> = {}

export function useTreasuryAccountSearch(): UseTreasuryAccountSearchReturn {
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [singleAccount, setSingleAccount] = useState<TreasuryAccount | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleAccount = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/treasury/accounts/${id}/`)
            setSingleAccount(res.data)
        } catch (e) {
            console.error("Error fetching single treasury account", e)
        }
    }, [])

    const fetchAccounts = useCallback(async (search: string = "") => {
        const cacheKey = search
        if (globalCache[cacheKey]) {
            setAccounts(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await api.get(`/treasury/accounts/?${params.toString()}`)
            const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
            
            globalCache[cacheKey] = list
            setAccounts(list)
        } catch (err) {
            showApiError(err, "Error al buscar cuentas de tesorería")
            setAccounts([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { accounts, singleAccount, loading, fetchAccounts, fetchSingleAccount }
}
