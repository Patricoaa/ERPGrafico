import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { FiscalYear, FiscalYearPreviewResult } from '../types';
import { showApiError } from '@/lib/errors';
import { ACCOUNTING_PERIODS_QUERY_KEY } from './queryKeys';
import { FISCAL_YEARS_QUERY_KEY } from './queryKeys';

export { FISCAL_YEARS_QUERY_KEY };

export function useFiscalYears() {
    const queryClient = useQueryClient();

    const { data, isLoading, refetch } = useQuery({
        queryKey: FISCAL_YEARS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/accounting/fiscal-years/?ordering=-year');
            return response.data.results || response.data;
        },
        staleTime: 10 * 60 * 1000, // 10 min
    });

    const closeMutation = useMutation({
        mutationFn: (year: number) => api.post(`/accounting/fiscal-years/${year}/close/`),
        onSuccess: (_, year) => {
            queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_QUERY_KEY });
            // Closing a year changes period states within it
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIODS_QUERY_KEY });
            toast.success(`Año contable ${year} cerrado exitosamente.`);
        },
        onError: (error, year) => showApiError(error, `Error al cerrar el año contable ${year}`),
    });

    const reopenMutation = useMutation({
        mutationFn: (year: number) => api.post(`/accounting/fiscal-years/${year}/reopen/`),
        onSuccess: (_, year) => {
            queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_QUERY_KEY });
            // Reopening a year also changes period states
            queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIODS_QUERY_KEY });
            toast.success(`Año contable ${year} reabierto exitosamente.`);
        },
        onError: (error, year) => showApiError(error, `Error al reabrir el año contable ${year}`),
    });

    const generateOpeningMutation = useMutation({
        mutationFn: (year: number) => api.post(`/accounting/fiscal-years/${year}/generate-opening/`),
        onSuccess: (_, year) => {
            queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_QUERY_KEY });
            toast.success(`Asiento de apertura para el año ${year + 1} generado exitosamente.`);
        },
        onError: (error, year) => showApiError(error, `Error al generar el asiento de apertura para el año ${year + 1}`),
    });

    const previewClosingMutation = useMutation({
        mutationFn: async (year: number) => {
            const response = await api.get(`/accounting/fiscal-years/${year}/preview-closing/`);
            return response.data as FiscalYearPreviewResult;
        },
        onError: (error, year) => showApiError(error, `Error al previsualizar el cierre del año ${year}`),
    });

    return {
        data: (data as FiscalYear[]) ?? [],
        isLoading,
        refetch,
        isActionLoading: closeMutation.isPending || reopenMutation.isPending || generateOpeningMutation.isPending || previewClosingMutation.isPending,
        previewClosing: previewClosingMutation.mutateAsync,
        closeFiscalYear: closeMutation.mutateAsync,
        reopenFiscalYear: reopenMutation.mutateAsync,
        generateOpeningEntry: generateOpeningMutation.mutateAsync,
        isClosing: closeMutation.isPending,
        isReopening: reopenMutation.isPending,
        isGeneratingOpening: generateOpeningMutation.isPending,
        isPreviewing: previewClosingMutation.isPending,
    };
}
