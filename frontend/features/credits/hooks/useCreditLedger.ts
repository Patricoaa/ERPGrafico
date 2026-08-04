import { useState, useEffect, useCallback, useRef } from 'react'
import { getContactCreditLedger, type CreditLedgerEntry } from '../api/creditsApi'

interface UseCreditLedgerOptions {
    includeAll?: boolean;
    onError?: (error: unknown) => void;
}

export function useCreditLedger(
    contactId: number,
    options?: UseCreditLedgerOptions
) {
    const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const onErrorRef = useRef(options?.onError)

    useEffect(() => {
        onErrorRef.current = options?.onError
    })

    useEffect(() => {
        if (ledger !== null || isLoading) return

        requestAnimationFrame(() => {
            setIsLoading(true)
            getContactCreditLedger(contactId, options?.includeAll)
                .then(setLedger)
                .catch((err) => {
                    onErrorRef.current?.(err)
                    setLedger([])
                })
                .finally(() => setIsLoading(false))
        })
    }, [contactId, ledger, isLoading, options?.includeAll])

    const refetch = useCallback(() => setLedger(null), [])

    return { ledger: ledger ?? [], isLoading, refetch }
}
