import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchChecklist, updateChecklistItem, type ChecklistItem } from '../api/closingChecklistApi'

export function useClosingChecklist(year: number, enabled: boolean) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['closing-checklist', year],
        queryFn: () => fetchChecklist(year),
        enabled: enabled && year > 0,
        // Don't retry on errors (e.g. 404 when FiscalYear doesn't exist yet)
        // to avoid an infinite loading spinner.
        retry: false,
    })

    const toggleItem = useCallback(async (item: ChecklistItem) => {
        await updateChecklistItem(year, item.id, {
            is_completed: !item.is_completed,
        })
        queryClient.invalidateQueries({ queryKey: ['closing-checklist', year] })
    }, [year, queryClient])

    const requiredIncomplete = query.data?.filter(i => i.is_required && !i.is_completed) ?? []
    const checklistPassed = requiredIncomplete.length === 0

    return {
        items: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
        toggleItem,
        requiredIncomplete,
        checklistPassed,
    }
}

