import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { FiscalYear, FiscalYearPreviewResult } from '../types';
import { showApiError } from '@/lib/errors';

export const FISCAL_YEARS_QUERY_KEY = ['fiscal-years'];

export function useFiscalYears() {
    const queryClient = useQueryClient();

    const { data, refetch } = useSuspenseQuery({
        queryKey: FISCAL_YEARS_QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('/accounting/fiscal-years/?ordering=-year');
            return response.data.results || response.data;
        },
    });

    const closeMutation = useMutation({
        mutationFn: (year: number) => api.post(`/accounting/fiscal-years/${year}/close/`),
        onSuccess: (_, year) => {
            queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_QUERY_KEY });
            toast.success(`Año contable ${year} cerrado exitosamente.`);
        },
        onError: (error, year) => showApiError(error, `Error al cerrar el año contable ${year}`),
    });

    const reopenMutation = useMutation({
        mutationFn: (year: number) => api.post(`/accounting/fiscal-years/${year}/reopen/`),
        onSuccess: (_, year) => {
            queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_QUERY_KEY });
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

    const previewClosing = async (year: number): Promise<FiscalYearPreviewResult | null> => {
        try {
            const response = await api.get(`/accounting/fiscal-years/${year}/preview-closing/`);
            return response.data;
        } catch (error) {
            showApiError(error, `Error al previsualizar el cierre del año ${year}`);
            return null;
        }
    };

    return {
        data: data as FiscalYear[],
        refetch,
        isActionLoading: closeMutation.isPending || reopenMutation.isPending || generateOpeningMutation.isPending,
        previewClosing,
        closeFiscalYear: closeMutation.mutateAsync,
        reopenFiscalYear: reopenMutation.mutateAsync,
        generateOpeningEntry: generateOpeningMutation.mutateAsync,
        isClosing: closeMutation.isPending,
        isReopening: reopenMutation.isPending,
        isGeneratingOpening: generateOpeningMutation.isPending,
    };
}
