import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { type AccountingPeriod } from '../types';
import { showApiError } from '@/lib/errors';
import { useRealtime } from '@/features/realtime';
import { invalidateCrossFeature } from '@/lib/invalidation';
import { accountingApi } from '../api/accountingApi';

import { ACCOUNTING_PERIODS_QUERY_KEY } from './queryKeys'

export { ACCOUNTING_PERIODS_QUERY_KEY }

export function useAccountingPeriods() {
    const queryClient = useQueryClient();
    const { markLocalMutation } = useRealtime();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_PERIODS_QUERY_KEY,
        queryFn: () => accountingApi.getAccountingPeriods({ ordering: '-year,-month' }),
        staleTime: 10 * 60 * 1000, // 10 min
    });

    const closeMutation = useMutation({
        mutationFn: (periodId: number) => {
            const key = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                    const r = (Math.random() * 16) | 0
                    const v = c === 'x' ? r : (r & 0x3) | 0x8
                    return v.toString(16)
                })
            return api.post(`/tax/accounting-periods/${periodId}/close/`, undefined, {
                headers: { 'Idempotency-Key': key },
            })
        },
        onSuccess: () => {
            markLocalMutation();
            invalidateCrossFeature(queryClient, [ACCOUNTING_PERIODS_QUERY_KEY]);
            toast.success('Periodo contable cerrado exitosamente');
        },
        onError: (error) => showApiError(error, 'Error al cerrar el periodo'),
    });

    const reopenMutation = useMutation({
        mutationFn: (params: { id: number; reason?: string }) =>
            api.post(`/tax/accounting-periods/${params.id}/reopen/`, { reason: params.reason }),
        onSuccess: () => {
            markLocalMutation();
            invalidateCrossFeature(queryClient, [ACCOUNTING_PERIODS_QUERY_KEY]);
            toast.success('Periodo contable reabierto exitosamente');
        },
        onError: (error) => showApiError(error, 'Error al reabrir el periodo'),
    });

    const createMutation = useMutation({
        mutationFn: ({ year, month }: { year: number, month: number }) => api.post('/tax/accounting-periods/', { year, month }),
        onSuccess: (_, { year, month }) => {
            markLocalMutation();
            invalidateCrossFeature(queryClient, [ACCOUNTING_PERIODS_QUERY_KEY]);
            toast.success(`Periodo ${month}/${year} inicializado correctamente`);
        },
        onError: (error) => showApiError(error, 'Error al crear el periodo'),
    });

    return {
        data: (data as AccountingPeriod[]) ?? [],
        isLoading,
        refetch,
        isActionLoading: closeMutation.isPending || reopenMutation.isPending || createMutation.isPending,
        closePeriod: closeMutation.mutateAsync,
        reopenPeriod: reopenMutation.mutateAsync,
        createPeriod: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isClosing: closeMutation.isPending,
        isReopening: reopenMutation.isPending,
    };
}
