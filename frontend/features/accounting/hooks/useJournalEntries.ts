import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { showApiError } from '@/lib/errors'
import { accountingApi } from '../api/accountingApi'
import { LEDGER_QUERY_KEY } from './useLedger'

export function useDeleteJournalEntry(options?: { onSuccess?: () => void }) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: number) => accountingApi.deleteEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [LEDGER_QUERY_KEY] })
            toast.success('Asiento eliminado correctamente')
            options?.onSuccess?.()
        },
        onError: (error: Error) => showApiError(error, 'Error al eliminar el asiento'),
    })
}
