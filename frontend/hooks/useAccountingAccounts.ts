import { useState, useEffect } from "react"
import api from "@/lib/api"

/**
 * Shared state to cache accounts and the active fetch promise across all hook instances.
 */
let leafAccountsCache: any[] | null = null
let leafAccountsPromise: Promise<any[]> | null = null

export interface UseAccountingAccountsReturn {
    accounts: any[]
    loading: boolean
    error: string | null
    refetch: () => void
}

/**
 * Hook to fetch accounting accounts with built-in caching.
 * Leaf accounts (?is_leaf=true) are cached globally to prevent redundant requests.
 */
export function useAccountingAccounts(isLeaf: boolean = true): UseAccountingAccountsReturn {
    const [accounts, setAccounts] = useState<any[]>(isLeaf && leafAccountsCache ? leafAccountsCache : [])
    const [loading, setLoading] = useState(!isLeaf || !leafAccountsCache)
    const [error, setError] = useState<string | null>(null)

    const fetchAccounts = async (force: boolean = false) => {
        // If we want leaf accounts and have them cached, just return them
        if (isLeaf && leafAccountsCache && !force) {
            setAccounts(leafAccountsCache)
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            // For leaf accounts, use a shared promise if it exists
            if (isLeaf) {
                if (!leafAccountsPromise || force) {
                    leafAccountsPromise = api.get("/accounting/accounts/?is_leaf=true")
                        .then(res => {
                            const data = res.data.results || res.data
                            leafAccountsCache = data
                            return data
                        })
                        .catch(err => {
                            leafAccountsPromise = null // Reset on error so next attempt can retry
                            throw err
                        })
                }
                const data = await leafAccountsPromise
                setAccounts(data)
            } else {
                // Non-leaf/All accounts are usually fetched less frequently, fetch directly without global cache for now
                const res = await api.get("/accounting/accounts/")
                setAccounts(res.data.results || res.data)
            }
        } catch (err: any) {
            console.error("Error fetching accounting accounts:", err)
            setError(err.message || "Error al cargar cuentas contables")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [isLeaf])

    return {
        accounts,
        loading,
        error,
        refetch: () => fetchAccounts(true)
    }
}
