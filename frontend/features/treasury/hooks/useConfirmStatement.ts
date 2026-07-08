import { useMutation } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'

export function useConfirmStatement() {
    return useMutation({
        mutationFn: (id: number) => treasuryApi.confirmStatement(id),
    })
}
