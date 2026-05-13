import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { AccountingPeriod } from '../types';
import { showApiError } from '@/lib/errors';

import { ACCOUNTING_PERIODS_QUERY_KEY } from './queryKeys'

export { ACCOUNTING_PERIODS_QUERY_KEY }

export function useAccountingPeriods() {
    const queryClient = useQueryClient();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ACCOUNTING_PERIODS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/tax/accounting-periods/?ordering=-year,-month');
            return response.data.results || response.data;
        },
        staleTime: 10 * 60 * 1000, // 10 min
    });

    const closeMutation = useMutation({
        mutationFn: (periodId: number) => api.post(`/tax/accounting-periods/${periodId}/close/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIODS_QUERY_KEY });
            toast.success('Periodo contable cerrado exitosamente');
        },
        onError: (error) => showApiError(error, 'Error al cerrar el periodo'),
    });

    const reopenMutation = useMutation({
        mutationFn: (periodId: number) => api.post(`/tax/accounting-periods/${periodId}/reopen/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIODS_QUERY_KEY });
            toast.success('Periodo contable reabierto exitosamente');
        },
        onError: (error) => showApiError(error, 'Error al reabrir el periodo'),
    });

    const createMutation = useMutation({
        mutationFn: ({ year, month }: { year: number, month: number }) => api.post('/tax/accounting-periods/', { year, month }),
        onSuccess: (_, { year, month }) => {
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIODS_QUERY_KEY });
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
