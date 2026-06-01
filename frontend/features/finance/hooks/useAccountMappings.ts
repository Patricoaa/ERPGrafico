import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { accountingApi } from '@/features/accounting/api/accountingApi'
import { Account } from '@/features/accounting/types'

export type MappingType = 'is' | 'cf' | 'bs'

export function useAccountMappings(mappingType: MappingType) {
    const queryClient = useQueryClient()

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

    // Mutation for updating account mappings
    const updateMappingsMutation = useMutation({
        mutationFn: (updates: { id: number; field: string; value: string | null }[]) =>
            accountingApi.updateAccountMappings(updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        }
    })

    const saveAll = useCallback(async (updates: { id: number; field: string; value: string | null }[]) => {
        if (updates.length === 0) return
        await updateMappingsMutation.mutateAsync(updates)
    }, [updateMappingsMutation])

    return {
        accounts: relevantAccounts,
        isLoading: isLoading || (!accounts.length && !error),
        fieldName,
        saveAll,
        isSaving: updateMappingsMutation.isPending,
        originalAccounts: accounts
    }
}

