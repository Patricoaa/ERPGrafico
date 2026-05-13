import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { accountingApi } from '@/features/accounting/api/accountingApi'
import { Account } from '@/features/accounting/types'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'

export type MappingType = 'is' | 'cf' | 'bs'

export function useAccountMappings(mappingType: MappingType) {
    const queryClient = useQueryClient()
    const [pendingChanges, setPendingChanges] = useState<Map<number, string | null>>(new Map())
    const [isSaving, setIsSaving] = useState(false)

    // Load ALL accounts since filtering happens mostly on the frontend based on mappingType
    const { data: accounts = [], isLoading, error } = useQuery<Account[]>({
        queryKey: ['accounts', 'mappings'], 
        queryFn: () => accountingApi.getAccounts(),
        refetchOnWindowFocus: false,
        staleTime: 15 * 60 * 1000, // 15 min — cuentas son quasi-estáticas
    })

    // Filter relevant accounts based on mapping type
    const relevantAccounts = useMemo(() => {
        if (!accounts.length) return []
        
        const leafAccounts = accounts.filter(a => a.is_selectable)

        switch (mappingType) {
            case 'is':
                // Income Statement: Only Income and Expense accounts
                return leafAccounts.filter(a => ['INCOME', 'EXPENSE'].includes(a.account_type))
            case 'cf':
                // Cash flow: normally applies to all
                return leafAccounts
            case 'bs':
                // Balance Sheet / Ratios: Only Asset, Liability, Equity
                return leafAccounts.filter(a => ['ASSET', 'LIABILITY', 'EQUITY'].includes(a.account_type))
            default:
                return []
        }
    }, [accounts, mappingType])

    const getFieldForType = (type: MappingType) => {
        switch (type) {
            case 'is': return 'is_category'
            case 'cf': return 'cf_category'
            case 'bs': return 'bs_category'
        }
    }

    const fieldName = getFieldForType(mappingType)

    const updateMapping = useCallback((accountId: number, value: string | null) => {
        setPendingChanges(prev => {
            const next = new Map(prev)
            const originalVal = accounts.find(a => a.id === accountId)?.[fieldName as keyof Account] as string | null
            if (value === 'none') value = null;
            
            if (value === originalVal) {
                next.delete(accountId)
            } else {
                next.set(accountId, value)
            }
            return next
        })
    }, [accounts, fieldName])

    const saveAll = useCallback(async () => {
        if (pendingChanges.size === 0) return

        setIsSaving(true)
        try {
            const updates = Array.from(pendingChanges.entries()).map(([id, value]) => ({
                id,
                field: fieldName,
                value
            }))

            await accountingApi.updateAccountMappings(updates)
            toast.success(`Mapeo guardado (${updates.length} cuentas actualizadas)`)
            
            setPendingChanges(new Map())
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            return true
        } catch (e) {
            console.error('Error saving mappings:', e)
            showApiError(e)
            return false
        } finally {
            setIsSaving(false)
        }
    }, [pendingChanges, fieldName, queryClient])

    return {
        accounts: relevantAccounts,
        isLoading: isLoading || (!accounts.length && !error),
        isSaving,
        pendingChanges,
        updateMapping,
        saveAll,
        hasChanges: pendingChanges.size > 0,
        originalAccounts: accounts
    }
}
